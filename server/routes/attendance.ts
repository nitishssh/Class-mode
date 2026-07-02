import { Router, Request, Response } from "express";
import { z } from "zod";
import { authenticateToken, requireRole } from "../middleware";
import { resolveTenantScope } from "../lib/tenant";
import {
  pgMarkAttendance,
  pgGetAttendanceByClassDate,
  pgGetStudentAttendanceSummary,
  pgTrackFeatureUsage,
  pgGetClassNames,
  pgFindUsers,
  pgFindUserById,
  pgUpdateUser,
} from "../lib/pg-queries";
import { logger } from "../lib/logger";
import { publishEvent } from "../lib/events";
import { isRedisConfigured } from "../lib/redis";
import {
  handleAttendanceMarked,
  type AttendanceMarkedPayload,
} from "../services/notifications-consumer";

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

    const schoolCode = t.scope.isPlatformAdmin ? (user.school_code ?? null) : t.scope.schoolCode!;
    const written = await pgMarkAttendance({
      schoolCode,
      className: parsed.data.className,
      date: parsed.data.date,
      markedBy: user.id,
      marks: parsed.data.marks,
    });

    pgTrackFeatureUsage({ feature: "attendance", userId: user.id, schoolCode });

    // Close the parent loop: WhatsApp the parent of every student marked
    // absent, when a parent phone is on file. With Redis on, this goes through
    // the durable event bus (crash between save and send no longer loses
    // alerts); without Redis it falls back to the inline fire-and-forget send.
    // Either way the teacher's save never blocks on delivery.
    const absentIds = new Set(
      parsed.data.marks.filter((m) => m.status === "absent").map((m) => m.studentId)
    );
    let notified = 0;
    if (absentIds.size > 0) {
      const roster = await pgFindUsers(
        t.scope.isPlatformAdmin
          ? { role: "student", classname: parsed.data.className }
          : { role: "student", classname: parsed.data.className, schoolCode: t.scope.schoolCode }
      );
      const absentees = roster
        .filter((s) => absentIds.has(s.id) && s.parentPhone)
        .map((s) => ({ id: s.id, name: s.name, parentPhone: s.parentPhone as string }));
      notified = absentees.length;
      if (notified > 0) {
        pgTrackFeatureUsage({ feature: "attendance_notify", userId: user.id, schoolCode });
        const payload: AttendanceMarkedPayload = {
          className: parsed.data.className,
          date: parsed.data.date,
          absentees,
        };
        if (isRedisConfigured()) {
          publishEvent<AttendanceMarkedPayload>("attendance.marked", {
            schoolCode,
            userId: user.id,
            payload,
          });
        } else {
          void handleAttendanceMarked({
            topic: "attendance.marked",
            at: new Date().toISOString(),
            schoolCode,
            userId: user.id,
            payload,
          }).catch((err) =>
            logger.warn("[attendance] inline absence notification failed", { err: String(err) })
          );
        }
      }
    }

    res.json({ success: true, written, notified });
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

/**
 * GET /api/attendance/classes — distinct class names in the requester's school
 * (teacher-accessible, unlike the admin-only /api/admin/classes).
 */
router.get(
  "/classes",
  authenticateToken,
  requireRole("teacher", "admin", "principal", "school_admin"),
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const t = resolveTenantScope(user);
    if ("error" in t) return res.status(t.error.status).json({ message: t.error.message });

    const classes = await pgGetClassNames(t.scope.isPlatformAdmin ? undefined : t.scope.schoolCode);
    res.json(classes);
  }
);

/**
 * GET /api/attendance/roster?className= — students of a class in the
 * requester's school (teacher-accessible roster for marking attendance).
 */
router.get(
  "/roster",
  authenticateToken,
  requireRole("teacher", "admin", "principal", "school_admin"),
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const t = resolveTenantScope(user);
    if ("error" in t) return res.status(t.error.status).json({ message: t.error.message });

    const className = String(req.query.className || "");
    if (!className) return res.status(400).json({ message: "className is required" });

    const students = await pgFindUsers(
      t.scope.isPlatformAdmin
        ? { role: "student", classname: className }
        : { role: "student", classname: className, schoolCode: t.scope.schoolCode }
    );
    res.json(students.map((s) => ({ id: s.id, name: s.name, parentPhone: s.parentPhone })));
  }
);

/**
 * PATCH /api/attendance/roster/:studentId/parent-phone — set the parent's
 * WhatsApp number on a student record. Teacher-accessible but tenant-guarded:
 * the student must belong to the requester's school.
 */
router.patch(
  "/roster/:studentId/parent-phone",
  authenticateToken,
  requireRole("teacher", "admin", "principal", "school_admin"),
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const t = resolveTenantScope(user);
    if ("error" in t) return res.status(t.error.status).json({ message: t.error.message });

    const studentId = parseInt(req.params.studentId, 10);
    if (isNaN(studentId)) return res.status(400).json({ message: "Invalid student ID" });

    const phone = String(req.body?.phone ?? "").trim();
    if (phone && !/^\+?[0-9\s()-]{7,20}$/.test(phone)) {
      return res.status(400).json({ message: "Invalid phone number" });
    }

    const student = await pgFindUserById(studentId);
    if (!student || student.role !== "student") {
      return res.status(404).json({ message: "Student not found" });
    }
    if (!t.scope.isPlatformAdmin && student.schoolCode !== t.scope.schoolCode) {
      return res.status(403).json({ message: "Forbidden: student belongs to another school" });
    }

    // Empty string clears the number.
    const updated = await pgUpdateUser(studentId, { parentPhone: phone || null });
    if (!updated) return res.status(500).json({ message: "Failed to update parent phone" });
    res.json({ success: true, parentPhone: updated.parentPhone });
  }
);

export default router;
