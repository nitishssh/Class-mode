import { Router, Request, Response } from "express";
import { z } from "zod";
import { authenticateToken, requireRole } from "../middleware";
import { resolveTenantScope } from "../lib/tenant";
import {
  pgMarkAttendance,
  pgGetAttendanceByClassDate,
  pgGetStudentAttendanceSummary,
} from "../lib/pg-queries";

const router = Router();

const MarkSchema = z.object({
  className: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  marks: z
    .array(
      z.object({
        studentId: z.number().int().positive(),
        status: z.enum(["present", "absent", "late", "excused"]),
        note: z.string().optional(),
      })
    )
    .min(1),
});

/**
 * POST /api/attendance — a teacher/admin marks attendance for a class on a date.
 * Tenant-scoped: writes are stamped with the marker's school_code; an account
 * without a school is denied (fail-closed).
 */
router.post(
  "/",
  authenticateToken,
  requireRole("teacher", "admin", "principal", "school_admin"),
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const t = resolveTenantScope(user);
    if ("error" in t) return res.status(t.error.status).json({ message: t.error.message });

    const parsed = MarkSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    }

    const written = await pgMarkAttendance({
      schoolCode: t.scope.isPlatformAdmin ? (user.school_code ?? null) : t.scope.schoolCode!,
      className: parsed.data.className,
      date: parsed.data.date,
      markedBy: user.id,
      marks: parsed.data.marks,
    });

    res.json({ success: true, written });
  }
);

/**
 * GET /api/attendance?className=&date= — attendance for a class on a date,
 * scoped to the requester's school (platform admin sees any school).
 */
router.get(
  "/",
  authenticateToken,
  requireRole("teacher", "admin", "principal", "school_admin"),
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const t = resolveTenantScope(user);
    if ("error" in t) return res.status(t.error.status).json({ message: t.error.message });

    const className = String(req.query.className || "");
    const date = String(req.query.date || "");
    if (!className || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: "className and date (YYYY-MM-DD) are required" });
    }

    const rows = await pgGetAttendanceByClassDate({
      schoolCode: t.scope.isPlatformAdmin ? undefined : t.scope.schoolCode,
      className,
      date,
    });
    res.json(rows);
  }
);

/**
 * GET /api/attendance/summary/:studentId — per-status attendance counts for a
 * student, scoped to the requester's school.
 */
router.get(
  "/summary/:studentId",
  authenticateToken,
  requireRole("teacher", "admin", "principal", "school_admin"),
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const t = resolveTenantScope(user);
    if ("error" in t) return res.status(t.error.status).json({ message: t.error.message });

    const studentId = parseInt(req.params.studentId, 10);
    if (isNaN(studentId)) return res.status(400).json({ message: "Invalid student ID" });

    const summary = await pgGetStudentAttendanceSummary({
      studentId,
      schoolCode: t.scope.isPlatformAdmin ? undefined : t.scope.schoolCode,
    });
    res.json(summary);
  }
);

export default router;
