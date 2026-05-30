import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { 
  insertDoubtSchema, 
  insertMilestoneSchema, 
  insertStudentAchievementSchema,
  insertCompetitionSchema
} from "@shared/schema";

const router = Router();

// ─── Doubts ──────────────────────────────────────────────────────────────────

router.post("/doubts", async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ message: "Unauthorized" });

  try {
    const data = insertDoubtSchema.parse({
      ...req.body,
      studentId: user.id,
    });
    const doubt = await storage.createDoubt(data);
    res.status(201).json(doubt);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/doubts/me", async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ message: "Unauthorized" });

  const doubts = await storage.getDoubtsByStudent(user.id);
  res.json(doubts);
});

router.patch("/doubts/:id/resolve", async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ message: "Unauthorized" });

  const { answer } = req.body;
  if (!answer) return res.status(400).json({ message: "Answer is required" });

  const doubt = await storage.resolveDoubt(parseInt(req.params.id), answer);
  if (!doubt) return res.status(404).json({ message: "Doubt not found" });

  res.json(doubt);
});

// ─── Milestones ─────────────────────────────────────────────────────────────

router.post("/milestones", async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ message: "Unauthorized" });

  try {
    const data = insertMilestoneSchema.parse({
      ...req.body,
      studentId: user.id,
    });
    const milestone = await storage.createMilestone(data);
    res.status(201).json(milestone);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/milestones/me", async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ message: "Unauthorized" });

  const milestones = await storage.getMilestonesByStudent(user.id);
  res.json(milestones);
});

// ─── Achievements ──────────────────────────────────────────────────────────

router.post("/achievements", async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ message: "Unauthorized" });

  try {
    const data = insertStudentAchievementSchema.parse(req.body);
    const achievement = await storage.createAchievement(data);
    res.status(201).json(achievement);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/achievements/me", async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ message: "Unauthorized" });

  const achievements = await storage.getAchievementsByStudent(user.id);
  res.json(achievements);
});

export default router;
