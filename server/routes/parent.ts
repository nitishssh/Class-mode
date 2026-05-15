import { Router, Request, Response } from "express";
import { authenticateToken } from "../routes";
import { requireRole } from "../middleware";
import { pgFindUsers, pgFindGradingResults } from "../lib/pg-queries";
import { storage } from "../storage";

const router = Router();

router.get(
  "/dashboard",
  authenticateToken,
  requireRole("parent", "admin"),
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const children = await pgFindUsers({ parentId: user.id });
    const childIds = children.map((c) => c.id);
    const [allTasks, grades] = await Promise.all([
      Promise.all(childIds.map((id) => storage.getTasksByUser(id))).then((all) => all.flat()),
      childIds.length
        ? Promise.all(childIds.map((id) => pgFindGradingResults({ studentId: id, status: "completed" }))).then((all) => all.flat())
        : [],
    ]);
    res.json({ children, tasks: allTasks.length, grades });
  }
);

router.get(
  "/tasks",
  authenticateToken,
  requireRole("parent", "admin"),
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const children = await pgFindUsers({ parentId: user.id });
    const tasks = (await Promise.all(children.map((c) => storage.getTasksByUser(c.id)))).flat();
    res.json(tasks);
  }
);

router.get(
  "/reports",
  authenticateToken,
  requireRole("parent", "admin"),
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const children = await pgFindUsers({ parentId: user.id });
    const reports = await Promise.all(
      children.map(async (child) => {
        const grades = await pgFindGradingResults({ studentId: child.id, status: "completed" });
        return { studentId: child.id, name: child.name, totalGraded: grades.length };
      })
    );
    res.json(reports);
  }
);

export default router;
