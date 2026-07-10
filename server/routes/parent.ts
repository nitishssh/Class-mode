import { Router, Request, Response } from "express";
import { z } from "zod";
import { authenticateToken } from "../middleware";
import { requireRole } from "../middleware";
import {
  pgFindUsers,
  pgFindUserById,
  pgFindGradingResults,
  pgGetParentChildrenWithStatus,
  pgGetParentChildAttendanceHistory,
  pgGetParentChildFeeSummary,
  pgUpdateUser,
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

const ClaimSchema = z.object({
  code: z.string().min(3).max(80),
  parentPhone: z.string().min(6).max(32),
});

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseStudentId(raw: string): number | null {
  const id = Number.parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function parseClaimCode(raw: string): { schoolCode: string; studentId: number } | null {
  const normalized = raw.trim().toUpperCase().replace(/\s+/g, "");
  const code = normalized.startsWith("CM-") ? normalized.slice(3) : normalized;
  const match = code.match(/^(.+)-(\d+)$/);
  if (!match) return null;
  const studentId = parseStudentId(match[2]);
  return studentId ? { schoolCode: match[1], studentId } : null;
}

function phoneTail(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length < 6) return null;
  return digits.slice(-10);
}

function phonesMatch(input: string, stored: string | null | undefined): boolean {
  const inputTail = phoneTail(input);
  const storedTail = phoneTail(stored);
  return Boolean(inputTail && storedTail && inputTail === storedTail);
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

router.post(
  "/claim",
  authenticateToken,
  requireRole("parent"),
  async (req: Request, res: Response) => {
    const parsedBody = ClaimSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ errors: parsedBody.error.flatten().fieldErrors });
    }

    const parsedCode = parseClaimCode(parsedBody.data.code);
    if (!parsedCode) {
      return res.status(400).json({ message: "Invalid claim code" });
    }

    const student = await pgFindUserById(parsedCode.studentId);
    if (
      !student ||
      student.role !== "student" ||
      (student.schoolCode ?? "").toUpperCase() !== parsedCode.schoolCode
    ) {
      return res.status(404).json({ message: "Wrong claim code" });
    }

    if (!student.parentPhone) {
      return res
        .status(409)
        .json({ message: "School has not added a parent phone for this child" });
    }

    if (!phonesMatch(parsedBody.data.parentPhone, student.parentPhone)) {
      return res.status(403).json({ message: "Phone does not match school record" });
    }

    if (student.parentId != null) {
      return res.status(409).json({ message: "Child is already linked to a parent account" });
    }

    const user = (req as any).user;
    const updated = await pgUpdateUser(student.id, { parentId: user.id });
    if (!updated) {
      return res.status(500).json({ message: "Could not link child" });
    }

    res.json({ success: true, studentId: student.id });
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
