import { Router, Request, Response } from "express";
import { z } from "zod";
import { authenticateToken } from "../middleware";
import { requireRole } from "../middleware";
import {
  pgFindUsers,
  pgFindGradingResults,
  pgGetParentChildrenWithStatus,
  pgGetParentChildAttendanceHistory,
  pgGetParentChildFeeSummary,
} from "../lib/pg-queries";
import { storage } from "../storage";

const router = Router();

const DateQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const HistoryQuerySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  limit: z.coerce.number().int().min(1).max(180).optional(),
});

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseStudentId(raw: string): number | null {
  const id = Number.parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

router.get(
  "/children",
  authenticateToken,
  requireRole("parent"),
  async (req: Request, res: Response) => {
    const parsed = DateQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    }

    const user = (req as any).user;
    const date = parsed.data.date ?? today();
    const children = await pgGetParentChildrenWithStatus({ parentId: user.id, date });
    res.json({ date, children });
  }
);

router.get(
  "/children/:studentId/attendance",
  authenticateToken,
  requireRole("parent"),
  async (req: Request, res: Response) => {
    const studentId = parseStudentId(req.params.studentId);
    if (!studentId) return res.status(400).json({ message: "Invalid student ID" });

    const parsed = HistoryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    }

    const user = (req as any).user;
    const history = await pgGetParentChildAttendanceHistory({
      parentId: user.id,
      studentId,
      from: parsed.data.from,
      to: parsed.data.to,
      limit: parsed.data.limit,
    });
    if (history == null) return res.status(404).json({ message: "Child not found" });
    res.json({ studentId, attendance: history });
  }
);

router.get(
  "/children/:studentId/fees",
  authenticateToken,
  requireRole("parent"),
  async (req: Request, res: Response) => {
    const studentId = parseStudentId(req.params.studentId);
    if (!studentId) return res.status(400).json({ message: "Invalid student ID" });

    const user = (req as any).user;
    const summary = await pgGetParentChildFeeSummary({ parentId: user.id, studentId });
    if (summary == null) return res.status(404).json({ message: "Child not found" });
    res.json({ studentId, ...summary });
  }
);

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
        ? Promise.all(
            childIds.map((id) => pgFindGradingResults({ studentId: id, status: "completed" }))
          ).then((all) => all.flat())
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
