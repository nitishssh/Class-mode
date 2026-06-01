import { Router, Request, Response } from "express";
import { z } from "zod";
import { authenticateToken } from "../middleware";
import { aiChat } from "../lib/openai";
import { checkAIQuota } from "../middleware/aiQuota";
import { pgIncrementAIUsage } from "../lib/pg-queries";
import { logger } from "../lib/logger";

const router = Router();

const aiChatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string(),
    })
  ),
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

      const { messages } = parseResult.data;
      const userId = (req.user?.id || req.session?.userId) as number;
      const workspace = (req as any).workspace;

      const response = await aiChat(messages);

      // Increment Usage
      await pgIncrementAIUsage({
        userId,
        workspaceId: workspace?.id,
        feature: "ai_tutor",
        metadata: { type: "ai_chat" },
      });

      res.json(response);
    } catch (error) {
      logger.error("AI chat error:", error);
      res.status(500).json({ message: "Failed to generate AI response" });
    }
  }
);

export default router;
