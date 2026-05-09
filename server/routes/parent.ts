import { Router, Request, Response } from "express";
import { MongoUser, MongoGradingResult, MongoTask } from "../../shared/mongo-schema";
import { authenticateToken } from "../routes";
import { requireRole } from "../middleware";

const router = Router();

// Dashboard
router.get("/dashboard", authenticateToken, requireRole("parent", "admin"), async (req: Request, res: Response) => {
  const user = (req as any).user;
  const children = await MongoUser.find({ parentId: user.id }).select("id name class grade").lean();
  const childIds = children.map((c: any) => c.id);
  const [tasks, grades] = await Promise.all([
    MongoTask.countDocuments({ userId: { $in: childIds } }),
    MongoGradingResult.find({ studentId: { $in: childIds }, status: "completed" }).lean(),
  ]);
  res.json({ children, tasks, grades });
});

// Child tasks
router.get("/tasks", authenticateToken, requireRole("parent", "admin"), async (req: Request, res: Response) => {
  const user = (req as any).user;
  const children = await MongoUser.find({ parentId: user.id }).select("id").lean();
  const tasks = await MongoTask.find({ userId: { $in: children.map((c: any) => c.id) } }).lean();
  res.json(tasks);
});

// Reports
router.get("/reports", authenticateToken, requireRole("parent", "admin"), async (req: Request, res: Response) => {
  const user = (req as any).user;
  const children = await MongoUser.find({ parentId: user.id }).select("id name").lean();
  const reports = await Promise.all(
    children.map(async (child: any) => {
      const grades = await MongoGradingResult.find({ studentId: child.id, status: "completed" }).lean();
      return { studentId: child.id, name: child.name, totalGraded: grades.length };
    })
  );
  res.json(reports);
});

export default router;
