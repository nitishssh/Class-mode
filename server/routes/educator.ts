import { z } from "zod";
import { authenticateToken } from "../middleware";
import { requireRole } from "../middleware";
import { requireSubscription } from "../middleware/requireSubscription";
import { Router, Request, Response } from "express";
import {
  pgCountUsers,
  pgFindUsers,
  pgCountTests,
  pgFindGradingResults,
  pgCountGradingResults,
  pgUpdateGradingResultById,
} from "../lib/pg-queries";

const router = Router();

router.get(
  "/dashboard",
  authenticateToken,
  requireRole("teacher", "admin"),
  requireSubscription("educator"),
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const [students, tests, pendingGrading] = await Promise.all([
      pgCountUsers({ role: "student", schoolCode: user.school_code }),
      pgCountTests(user.id),
      pgCountGradingResults({ teacherId: user.id, status: "pending" }),
    ]);
    res.json({ students, tests, pendingGrading });
  }
);

router.get(
  "/students",
  authenticateToken,
  requireRole("teacher", "admin"),
  requireSubscription("educator"),
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const students = await pgFindUsers({ role: "student", schoolCode: user.school_code });
    res.json(
      students.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        class: s.class,
        grade: s.grade,
        avatar: s.avatar,
      }))
    );
  }
);

router.get(
  "/grading/pending",
  authenticateToken,
  requireRole("teacher", "admin"),
  requireSubscription("educator"),
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const pending = await pgFindGradingResults({ teacherId: user.id, status: "pending" });
    res.json(pending);
  }
);

const OverrideSchema = z.object({ score: z.number(), feedback: z.string().optional() });

router.post(
  "/grading/:id/override",
  authenticateToken,
  requireRole("teacher", "admin"),
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const parsed = OverrideSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    const id = parseInt(req.params.id, 10);
    const updated = await pgUpdateGradingResultById(id, {
      score: parsed.data.score,
      feedback: parsed.data.feedback,
      status: "completed",
    });
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  }
);

export default router;
