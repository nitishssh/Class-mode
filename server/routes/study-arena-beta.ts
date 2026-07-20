/**
 * Study Arena (Beta) — attempt-first interactive lessons.
 *
 * Phase 1 of the "inspired by OpenMAIC" rebuild. Isolated behind a feature flag
 * so it sits alongside the existing /api/ai-classroom path without disturbing it.
 * See docs/study-arena-inspired-by-openmaic.md.
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { authenticateToken } from "../middleware";
import { checkAIQuota } from "../middleware/aiQuota";
import { pgIncrementAIUsage } from "../lib/pg-queries";
import { generateLessonScript, respondToInteraction } from "../services/study-arena/lesson-script";
import { commitLearnerUpdate } from "../lib/learner-model";
import { logger } from "../lib/logger";

const router = Router();

function configuredCost(name: string): number | null {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    logger.error("[study-arena-beta] invalid configured AI cost", { name });
    return null;
  }
  return value;
}

/** Feature flag — default ON in dev, gated by env in prod. */
export const STUDY_ARENA_BETA_ENABLED =
  process.env.STUDY_ARENA_BETA !== "false" && process.env.NODE_ENV !== "production"
    ? true
    : process.env.STUDY_ARENA_BETA === "true";

function requireFlag(_req: Request, res: Response, next: () => void) {
  if (!STUDY_ARENA_BETA_ENABLED) {
    return res.status(404).json({ message: "Study Arena beta is not enabled" });
  }
  next();
}

router.get("/health", (_req, res) => {
  res.json({ enabled: STUDY_ARENA_BETA_ENABLED, service: "study-arena-beta" });
});

const generateSchema = z.object({
  topic: z.string().min(1).max(300),
  lessonId: z.string().uuid().optional(),
  language: z.string().max(40).optional(),
  sceneCount: z.number().int().min(2).max(8).optional(),
});

router.post(
  "/lesson-script",
  requireFlag,
  authenticateToken,
  await checkAIQuota("ai_tutor"),
  async (req: Request, res: Response) => {
    const parsed = generateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
    }
    try {
      const script = await generateLessonScript(parsed.data.topic, {
        language: parsed.data.language,
        sceneCount: parsed.data.sceneCount,
      });

      const userId = (req.user?.id || req.session?.userId) as number;
      await pgIncrementAIUsage({
        userId,
        workspaceId: (req as any).workspace?.id,
        feature: "ai_tutor",
        metadata: {
          type: "study_arena_lesson",
          lessonId: parsed.data.lessonId ?? null,
          scenes: script.scenes.length,
          estimatedCostInr: configuredCost("STUDY_ARENA_GENERATION_COST_INR"),
        },
      });

      res.json(script);
    } catch (error) {
      logger.error("[study-arena-beta] lesson generation failed", { error: String(error) });
      res.status(500).json({ message: "Failed to generate lesson" });
    }
  }
);

const interactionSchema = z.object({
  topic: z.string().min(1).max(300),
  question: z.string().min(1).max(2000),
  answer: z.string().max(4000),
  language: z.string().max(40).optional(),
  // Grouping keys so gate answers can be rolled up into "did this student
  // complete a full gated lesson?" — the pilot's adoption signal. All optional
  // so an older client still works; the metric simply can't group its rows.
  lessonId: z.string().uuid().optional(),
  actionKey: z.string().max(40).optional(),
  gateIndex: z.number().int().min(0).max(64).optional(),
  totalGates: z.number().int().min(1).max(64).optional(),
  attempt: z.number().int().min(1).max(20).optional(),
});

router.post(
  "/interaction",
  requireFlag,
  authenticateToken,
  await checkAIQuota("ai_tutor"),
  async (req: Request, res: Response) => {
    const parsed = interactionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
    }
    try {
      const result = await respondToInteraction(parsed.data);
      const userId = (req.user?.id || req.session?.userId) as number;

      if (result.proceed) {
        await pgIncrementAIUsage({
          userId,
          workspaceId: (req as any).workspace?.id,
          feature: "ai_tutor",
          metadata: {
            type: "study_arena_interaction",
            lessonId: parsed.data.lessonId ?? null,
            attempt: result.attempt,
            estimatedCostInr: configuredCost("STUDY_ARENA_INTERACTION_COST_INR"),
          },
        });

        // Record the gate answer for the adoption metric — but ONLY for real
        // students (a teacher/principal poking the beta would pollute the
        // "students completing lessons" signal), and NEVER let a logging
        // failure break the student's flow. Writes through the learner-model
        // single writer, tagged so the metric can filter cleanly.
        if (req.user?.role === "student" && parsed.data.lessonId) {
          try {
            const committed = await commitLearnerUpdate(userId, {
              interaction: {
                kind: "study_arena_gate_answer",
                concept: parsed.data.topic.slice(0, 120),
                payload: {
                  lessonId: parsed.data.lessonId,
                  actionKey: parsed.data.actionKey ?? null,
                  gateIndex: parsed.data.gateIndex ?? null,
                  totalGates: parsed.data.totalGates ?? null,
                  attempt: result.attempt,
                  answer: parsed.data.answer.trim(),
                },
              },
            });
            if (!committed) {
              logger.error("[study-arena-beta] gate-answer log failed (non-blocking)", {
                userId,
                lessonId: parsed.data.lessonId,
                reason: "commitLearnerUpdate returned false",
              });
            }
          } catch (logErr) {
            logger.error("[study-arena-beta] gate-answer log failed (non-blocking)", {
              error: String(logErr),
            });
          }
        }
      }

      res.json(result);
    } catch (error) {
      logger.error("[study-arena-beta] interaction failed", { error: String(error) });
      res.status(500).json({ message: "Failed to process answer" });
    }
  }
);

export default router;
