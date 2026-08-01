import { Router, Request, Response } from "express";
import { z } from "zod";
import { authenticateToken } from "../middleware";
import { runTutorTurn } from "../lib/ai/orchestrator";
import { gradeTutorTurn } from "../lib/ai/grader-service";
import { getMasteryDashboard } from "../lib/ai/learner-model";
import { webSearch } from "../services/web-search";
import { buildTutorSystemPrompt } from "../lib/prompts/tutor";
import { checkAIQuota } from "../middleware/aiQuota";
import { pgIncrementAIUsage } from "../lib/db/pg-queries";
import { logger } from "../lib/logger";

const router = Router();

const aiChatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string(),
    })
  ),
  // Attempt-first tutor controls (all optional — safe defaults).
  subject: z.string().max(120).optional(),
  concept: z.string().max(120).optional(),
  hintLevel: z.number().int().min(0).max(4).optional(),
  gradedMode: z.boolean().optional(),
  language: z.string().max(40).optional(),
});

// POST /api/ai-chat — Conversational AI interaction (AI Tutor)
router.post(
  "/ai-chat",
  authenticateToken,
  await checkAIQuota("ai_tutor"),
  async (req: Request, res: Response) => {
    try {
      const parseResult = aiChatSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res
          .status(400)
          .json({ message: "Invalid messages array", errors: parseResult.error.errors });
      }

      const { messages, subject, concept, hintLevel, gradedMode, language } = parseResult.data;
      const userId = (req.user?.id || req.session?.userId) as number;
      const workspace = (req as any).workspace;

      if (messages.length === 0) {
        return res.status(400).json({ message: "Messages array cannot be empty" });
      }

      // Attempt-first "second tutor" behaviour: never hand over answers on
      // demand, escalate help only through graduated hint levels the student
      // unlocks. See docs/student-ai-problems-market-research.md.
      const systemPrompt = buildTutorSystemPrompt({
        subject,
        hintLevel: hintLevel as 0 | 1 | 2 | 3 | 4 | undefined,
        gradedMode,
        language,
      });

      const history = messages.slice(0, -1);
      const latestMessage = messages[messages.length - 1].content;

      const response = await runTutorTurn({
        studentId: userId,
        systemPrompt,
        history,
        message: latestMessage,
        concept,
        subject,
        graded: gradedMode,
      });

      // Increment Usage
      await pgIncrementAIUsage({
        userId,
        workspaceId: workspace?.id,
        feature: "ai_tutor",
        metadata: { type: "ai_chat", hintLevel: hintLevel ?? 0, gradedMode: gradedMode ?? false },
      });

      // Grade the turn out-of-band on response finish if concept is specified
      if (concept) {
        res.on("finish", () => {
          void gradeTutorTurn({
            studentId: userId,
            concept,
            subject,
            history,
            latestMessage,
          }).catch((err) => {
            logger.error("[AI Chat Route] Background grading trigger error:", err);
          });
        });
      }

      res.json({ content: response.reply });
    } catch (error) {
      logger.error("AI chat error:", error);
      res.status(500).json({ message: "Failed to generate AI response" });
    }
  }
);

// GET /api/learn/mastery — Learner mastery vector + spaced-repetition schedule
// for the authenticated student, powering the Learn Hub Progress dashboard.
router.get("/learn/mastery", authenticateToken, async (req: Request, res: Response) => {
  try {
    const studentId = (req.user?.id || req.session?.userId) as number;
    if (!studentId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const dashboard = await getMasteryDashboard(studentId);
    res.json(dashboard);
  } catch (error) {
    logger.error("Mastery dashboard error:", error);
    res.status(500).json({ message: "Failed to load mastery dashboard" });
  }
});

const webSearchSchema = z.object({
  query: z.string().min(1).max(300),
  maxResults: z.number().int().min(1).max(10).optional(),
});

// POST /api/ai/web-search — Real-time web search for AI agents. Works keyless
// via DuckDuckGo and upgrades to Tavily/Serper when an API key is configured.
router.post("/ai/web-search", authenticateToken, async (req: Request, res: Response) => {
  const parsed = webSearchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid query", errors: parsed.error.errors });
  }
  try {
    const result = await webSearch(parsed.data.query, parsed.data.maxResults);
    res.json(result);
  } catch (error) {
    logger.error("Web search error:", error);
    res.status(500).json({ message: "Web search failed" });
  }
});

export default router;
