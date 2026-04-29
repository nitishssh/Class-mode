import { Router, Request, Response } from "express";
import { z } from "zod";
import { studyArenaInternalService } from "../services/study-arena/internal-service";
import { MongoAIClassroom, getNextSequenceValue } from "../../shared/mongo-schema";
import { orchestrateChat } from '../services/study-arena/orchestrator';
import { StatelessChatRequest } from '../services/study-arena/types';
import { logger } from '../lib/logger';
import { authenticateToken } from "../routes";

const router = Router();

// Request schemas
const createClassroomSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
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

// Middleware to protect subsequent routes
router.use(authenticateToken);

router.post("/create", async (req: Request, res: Response) => {
  try {
    const data = createClassroomSchema.parse(req.body);
    const user = req.user as { id: number } | undefined;
    const teacherId = user?.id || req.session?.userId;
    if (!teacherId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Submit async generation job internally
    const { jobId } = await studyArenaInternalService.createClassroom(data.topic, teacherId);

    res.status(202).json({
      jobId,
      status: "generating",
      message: "Classroom generation started (Native)",
    });
  } catch (error: unknown) {
    console.error("Error creating classroom:", error);
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
    console.error("Error polling job:", error);
    res.status(500).json({
      error: (error as Error).message || "Failed to poll job status",
    });
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
    const classrooms = await MongoAIClassroom.find({ teacherId }).sort({ createdAt: -1 });
    res.json(classrooms);
  } catch (error: unknown) {
    console.error("Error fetching classrooms:", error);
    res.status(500).json({
      error: (error as Error).message || "Failed to fetch classrooms",
    });
  }
});

router.get("/classroom/:classroomId", async (req, res) => {
  try {
    const { classroomId } = req.params;
    const classroom = await studyArenaInternalService.getClassroom(parseInt(classroomId));

    if (!classroom) {
      return res.status(404).json({ error: "Classroom not found" });
    }

    res.json(classroom);
  } catch (error: unknown) {
    console.error("Error fetching classroom:", error);
    res.status(500).json({
      error: (error as Error).message || "Failed to fetch classroom",
    });
  }
});

// ── Stateless Multi-Agent Chat ──────────────────────────────────────────

const chatRequestSchema = z.object({
  config: z.object({
    agentIds: z.array(z.string()).min(1),
    agentConfigs: z.array(z.object({
      id: z.string(),
      name: z.string(),
      role: z.string(),
      persona: z.string(),
    }).passthrough()).optional(),
    discussionTopic: z.string().optional(),
    discussionPrompt: z.string().optional(),
    triggerAgentId: z.string().optional(),
    enableTTS: z.boolean().optional(),
  }),
  messages: z.array(z.object({
    role: z.string(),
    content: z.string(),
  })),
  storeState: z.record(z.unknown()).optional(),
  userProfile: z.object({
    nickname: z.string().optional(),
    bio: z.string().optional(),
  }).optional(),
  directorState: z.record(z.unknown()).optional(),
});

router.post('/chat', async (req, res) => {
  const parsed = chatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.message });
  }
  const request = parsed.data as StatelessChatRequest;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const abortController = new AbortController();
  req.on('close', () => {
    abortController.abort();
  });

  try {
    const stream = orchestrateChat(request, abortController.signal);

    for await (const event of stream) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    res.end();
  } catch (error) {
    logger.error('Chat orchestration error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', data: { message: String(error) } })}\n\n`);
    res.end();
  }
});

export default router;
