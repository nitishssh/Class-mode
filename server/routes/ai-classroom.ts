import { Router, Request, Response } from "express";
import { z } from "zod";
import multer from "multer";
import OpenAI from "openai";
import { createRequire } from "module";
const _require = createRequire(import.meta.url);
const archiver = _require("archiver") as typeof import("archiver");
import { studyArenaInternalService } from "../services/study-arena/internal-service";
import { pgFindAIClassroomById } from "../lib/pg-queries";
import { orchestrateChat } from "../services/study-arena/orchestrator";
import { StatelessChatRequest } from "@shared/study-arena";
import { generatePPTX } from "../services/study-arena/pptx-export";
import { generateClassroomHTML } from "../services/study-arena/html-export";
import { logger } from "../lib/logger";
import { authenticateToken } from "../middleware";
import { checkAIQuota } from "../middleware/aiQuota";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const router = Router();

// Request schemas
const createClassroomSchema = z.object({
  topic: z.string().min(1, "Topic is required").max(500, "Topic must be 500 characters or fewer"),
  language: z.string().optional(),
  enableTTS: z.boolean().optional(),
  enableWebSearch: z.boolean().optional(),
  sceneTypes: z.array(z.enum(["slides", "quiz", "simulation", "pbl"])).optional(),
});

/**
 * GET /api/ai-classroom/health
 * Public health check for the Study Arena service
 */
router.get("/health", async (req, res) => {
  res.json({
    available: true,
    status: "healthy",
    service: "study-arena-native",
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/ai-classroom/providers
 * Returns which LLM providers are currently configured
 */
router.get("/providers", (_req, res) => {
  const providers = [
    { id: "gemini", name: "Google Gemini", configured: !!process.env.GOOGLE_API_KEY },
    { id: "anthropic", name: "Anthropic Claude", configured: !!process.env.ANTHROPIC_API_KEY },
    { id: "deepseek", name: "DeepSeek", configured: !!process.env.DEEPSEEK_API_KEY },
    { id: "qwen", name: "Qwen (Alibaba)", configured: !!process.env.QWEN_API_KEY },
    { id: "openrouter", name: "OpenRouter", configured: !!process.env.OPENROUTER_API_KEY },
    { id: "kimi", name: "Kimi (Moonshot)", configured: !!process.env.KIMI_API_KEY },
    { id: "grok", name: "Grok (xAI)", configured: !!process.env.GROK_API_KEY },
    { id: "ollama", name: "Ollama (local)", configured: !!process.env.OLLAMA_BASE_URL },
    { id: "openai", name: "OpenAI", configured: !!process.env.OPENAI_API_KEY },
  ];
  res.json({ providers, active: providers.filter((p) => p.configured).map((p) => p.id) });
});

// Middleware to protect subsequent routes
router.use(authenticateToken);

router.post("/create", await checkAIQuota("ai_classroom"), async (req: Request, res: Response) => {
  try {
    const data = createClassroomSchema.parse(req.body);
    const user = (req as any).user;
    const workspace = (req as any).workspace;
    const teacherId = user?.id || req.session?.userId;
    if (!teacherId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Submit async generation job internally
    const { jobId } = await studyArenaInternalService.createClassroom(
      data.topic,
      teacherId,
      workspace?.id
    );

    res.status(202).json({
      jobId,
      status: "generating",
      message: "Classroom generation started (Native)",
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", issues: error.errors });
    }
    logger.error("Error creating classroom:", error);
    res.status(500).json({
      error: (error as Error).message || "Failed to create classroom",
    });
  }
});

router.get("/status/:jobId", async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const jobStatus = await studyArenaInternalService.pollJob(jobId);

    res.json(jobStatus);
  } catch (error: unknown) {
    logger.error("Error polling job:", error);
    res.status(500).json({
      error: (error as Error).message || "Failed to poll job status",
    });
  }
});

router.delete("/status/:jobId", async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const cancelled = studyArenaInternalService.cancelJob(jobId);
    if (!cancelled) {
      return res.status(404).json({ error: "No active job found to cancel" });
    }
    res.json({ message: "Job cancelled" });
  } catch (error: unknown) {
    logger.error("Error cancelling job:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/ai-classroom/my-classrooms
 * Fetch the current user's generated AI classrooms
 */
router.get("/my-classrooms", async (req: Request, res: Response) => {
  try {
    const user = req.user as { id: number } | undefined;
    const teacherId = user?.id || req.session?.userId;
    if (!teacherId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
    const result = await studyArenaInternalService.listClassrooms(teacherId, limit, offset);
    res.json(result);
  } catch (error: unknown) {
    logger.error("Error fetching classrooms:", error);
    res.status(500).json({
      error: (error as Error).message || "Failed to fetch classrooms",
    });
  }
});

router.delete("/classroom/:classroomId", async (req: Request, res: Response) => {
  try {
    const user = req.user as { id: number } | undefined;
    const userId = user?.id || req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const deleted = await studyArenaInternalService.deleteClassroom(
      parseInt(req.params.classroomId),
      userId
    );
    if (!deleted) {
      return res.status(404).json({ error: "Classroom not found or access denied" });
    }
    res.json({ message: "Classroom deleted" });
  } catch (error: unknown) {
    logger.error("Error deleting classroom:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get("/classroom/:classroomId", async (req, res) => {
  try {
    const { classroomId } = req.params;
    const user = req.user as { id: number } | undefined;
    const userId = user?.id || req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const classroom = await pgFindAIClassroomById(parseInt(classroomId));
    if (!classroom) {
      return res.status(404).json({ error: "Classroom not found" });
    }
    if (classroom.teacherId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(classroom.data);
  } catch (error: unknown) {
    logger.error("Error fetching classroom:", error);
    res.status(500).json({
      error: (error as Error).message || "Failed to fetch classroom",
    });
  }
});

// ── SSE Progress Streaming ──────────────────────────────────────────────

router.get("/status/:jobId/stream", async (req: Request, res: Response) => {
  const { jobId } = req.params;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendStatus = (status: any) => {
    res.write(`data: ${JSON.stringify(status)}\n\n`);
  };

  try {
    const current = await studyArenaInternalService.pollJob(jobId);
    sendStatus(current);
    if (current.done) {
      res.end();
      return;
    }
  } catch {
    res.write(`data: ${JSON.stringify({ error: "Job not found" })}\n\n`);
    res.end();
    return;
  }

  const onUpdate = (status: any) => {
    sendStatus(status);
    if (status.done) {
      cleanup();
      res.end();
    }
  };

  const eventName = `job:${jobId}`;
  studyArenaInternalService.on(eventName, onUpdate);

  const cleanup = () => {
    studyArenaInternalService.removeListener(eventName, onUpdate);
  };

  req.on("close", cleanup);
});

// ── Stateless Multi-Agent Chat ──────────────────────────────────────────

const chatRequestSchema = z.object({
  config: z.object({
    agentIds: z.array(z.string()).min(1),
    agentConfigs: z
      .array(
        z
          .object({
            id: z.string(),
            name: z.string(),
            role: z.string(),
            persona: z.string(),
          })
          .passthrough()
      )
      .optional(),
    discussionTopic: z.string().optional(),
    discussionPrompt: z.string().optional(),
    triggerAgentId: z.string().optional(),
    enableTTS: z.boolean().optional(),
  }),
  messages: z.array(
    z.object({
      role: z.string(),
      content: z.string(),
    })
  ),
  storeState: z.record(z.unknown()).optional(),
  userProfile: z
    .object({
      nickname: z.string().optional(),
      bio: z.string().optional(),
    })
    .optional(),
  directorState: z.record(z.unknown()).optional(),
});

router.post("/chat", async (req, res) => {
  const parsed = chatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.message });
  }
  const request = parsed.data as StatelessChatRequest;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const abortController = new AbortController();
  req.on("close", () => {
    abortController.abort();
  });

  try {
    const stream = orchestrateChat(request, abortController.signal);

    for await (const event of stream) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    res.end();
  } catch (error) {
    logger.error("Chat orchestration error:", error);
    res.write(`data: ${JSON.stringify({ type: "error", data: { message: String(error) } })}\n\n`);
    res.end();
  }
});

// ── TTS ─────────────────────────────────────────────────────────────────────

router.post("/tts", async (req: Request, res: Response) => {
  const { text, voice = "alloy", speed = 1.0 } = req.body;
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "text required" });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: "TTS not configured (OPENAI_API_KEY missing)" });
  }
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: voice as any,
      input: text.slice(0, 4096),
      speed: Math.max(0.25, Math.min(4.0, Number(speed) || 1.0)),
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(buffer);
  } catch (err: any) {
    logger.error("TTS error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── ASR ─────────────────────────────────────────────────────────────────────

router.post("/asr", upload.single("audio"), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "audio file required" });
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: "ASR not configured (OPENAI_API_KEY missing)" });
  }
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const audioFile = new File([req.file.buffer], "audio.webm", { type: req.file.mimetype });
    const transcription = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file: audioFile,
      language: (req.body.language as string) || undefined,
    });
    res.json({ text: transcription.text });
  } catch (err: any) {
    logger.error("ASR error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── PPTX Export ─────────────────────────────────────────────────────────────

router.post("/export/:classroomId", async (req: Request, res: Response) => {
  try {
    const user = req.user as { id: number } | undefined;
    const userId = user?.id || req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const classroom = await pgFindAIClassroomById(parseInt(req.params.classroomId));
    if (!classroom) return res.status(404).json({ error: "Classroom not found" });
    if (classroom.teacherId !== userId) return res.status(403).json({ error: "Access denied" });

    const pptxBuffer = await generatePPTX(classroom.data as any);
    const filename = `classroom-${classroom.data.topic?.slice(0, 30).replace(/[^a-z0-9]/gi, "-") || "export"}.pptx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(pptxBuffer);
  } catch (error: unknown) {
    logger.error("PPTX export error:", error);
    res.status(500).json({ error: (error as Error).message || "Export failed" });
  }
});

// ── HTML Export ──────────────────────────────────────────────────────────────

router.get("/export/:classroomId/html", async (req: Request, res: Response) => {
  try {
    const user = req.user as { id: number } | undefined;
    const userId = user?.id || req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const classroom = await pgFindAIClassroomById(parseInt(req.params.classroomId));
    if (!classroom) return res.status(404).json({ error: "Classroom not found" });
    if (classroom.teacherId !== userId) return res.status(403).json({ error: "Access denied" });

    const html = generateClassroomHTML(classroom.data as any);
    const filename = `classroom-${(classroom.data as any).topic?.slice(0, 30).replace(/[^a-z0-9]/gi, "-") || "export"}.html`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(html);
  } catch (err: any) {
    logger.error("HTML export error:", err);
    res.status(500).json({ error: err.message || "Export failed" });
  }
});

// ── ZIP Export ───────────────────────────────────────────────────────────────

router.get("/export/:classroomId/zip", async (req: Request, res: Response) => {
  try {
    const user = req.user as { id: number } | undefined;
    const userId = user?.id || req.session?.userId;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const classroom = await pgFindAIClassroomById(parseInt(req.params.classroomId));
    if (!classroom) return res.status(404).json({ error: "Classroom not found" });
    if (classroom.teacherId !== userId) return res.status(403).json({ error: "Access denied" });

    const html = generateClassroomHTML(classroom.data as any);
    const dataJson = JSON.stringify(classroom.data, null, 2);
    const topicSlug =
      (classroom.data as any).topic?.slice(0, 30).replace(/[^a-z0-9]/gi, "-") || "export";

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="classroom-${topicSlug}.zip"`);

    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.on("error", (err) => {
      logger.error("ZIP error:", err);
    });
    archive.pipe(res);
    archive.append(html, { name: "classroom.html" });
    archive.append(dataJson, { name: "classroom-data.json" });
    archive.finalize();
  } catch (err: any) {
    logger.error("ZIP export error:", err);
    res.status(500).json({ error: err.message || "Export failed" });
  }
});

export default router;
