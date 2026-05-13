import { z } from "zod";
import { MongoUser, MongoTest, MongoGradingResult } from "../../shared/mongo-schema";
import { authenticateToken } from "../routes";
import { requireRole } from "../middleware";
import { requireSubscription } from "../middleware/requireSubscription";
import { Router, Request, Response } from "express";

const router = Router();

// Dashboard
router.get(
  "/dashboard",
  authenticateToken,
  requireRole("teacher", "admin"),
  requireSubscription("educator"),
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const [students, tests, pendingGrading] = await Promise.all([
      MongoUser.countDocuments({ role: "student", school_code: user.school_code }),
      MongoTest.countDocuments({ teacherId: user.id }),
      MongoGradingResult.countDocuments({ teacherId: user.id, status: "pending" }),
    ]);
    res.json({ students, tests, pendingGrading });
  }
);

// Students roster
router.get(
  "/students",
  authenticateToken,
  requireRole("teacher", "admin"),
  requireSubscription("educator"),
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const students = await MongoUser.find({ role: "student", school_code: user.school_code })
      .select("id name email class grade avatar")
      .lean();
    res.json(students);
  }
);

// Pending grading
router.get(
  "/grading/pending",
  authenticateToken,
  requireRole("teacher", "admin"),
  requireSubscription("educator"),
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const pending = await MongoGradingResult.find({ teacherId: user.id, status: "pending" }).lean();
    res.json(pending);
  }
);

// Override grade
const OverrideSchema = z.object({ score: z.number(), feedback: z.string().optional() });
router.post(
  "/grading/:id/override",
  authenticateToken,
  requireRole("teacher", "admin"),
  requireSubscription("educator"),
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { score, feedback } = OverrideSchema.parse(req.body);
    const result = await MongoGradingResult.findOne({ _id: req.params.id, teacherId: user.id });
    if (!result) return res.status(404).json({ error: "Not found" });
    result.scoreBreakdown = { totalScore: score } as any;
    result.overallFeedback = feedback || "";
    result.status = "completed";
    await result.save();
    res.json({ success: true });
  }
);

export default router;
