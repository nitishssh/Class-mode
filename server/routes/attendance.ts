import { Router, Request, Response } from "express";
import { z } from "zod";
import { authenticateToken, requireRole } from "../middleware";
import { resolveTenantScope } from "../lib/tenant";
import {
  pgMarkAttendance,
  pgGetAttendanceByClassDate,
  pgGetStudentAttendanceSummary,
  pgGetSchoolAttendanceSummary,
  pgGetAbsenteesByDate,
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
import { whatsappService } from "../services/whatsapp";

const router = Router();

const MarkSchema = z.object({
  className: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  markedAt: z.string().datetime().optional(),
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

const MAX_BACKFILL_DAYS = 3;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Server-authoritative marking window for non-platform-admin roles (W-6):
 * no future dates, and corrections at most MAX_BACKFILL_DAYS back. Schools
 * have no timezone column, so the window is computed from the server clock
 * (UTC) with slack covering every real-world UTC offset (-12h..+14h): a date
 * that is "today" anywhere on Earth is always accepted; anything outside the
 * window cannot be a legitimate local date.
 */
function attendanceDateWindow(now = Date.now()): { minDate: string; maxDate: string } {
  const maxDate = new Date(now + 14 * HOUR_MS).toISOString().slice(0, 10);
  const minDate = new Date(now - 12 * HOUR_MS - MAX_BACKFILL_DAYS * DAY_MS)
    .toISOString()
    .slice(0, 10);
  return { minDate, maxDate };
}

/**
 * POST /api/attendance — a teacher/admin marks attendance for a class on a date.
 * Tenant-scoped: school-bound roles stamp writes with their own school_code;
 * platform admins derive it from the students being marked (#336). A write
 * whose school_code cannot be resolved is rejected (fail-closed) — attendance
 * rows must never persist with a NULL school_code.
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

    if (!t.scope.isPlatformAdmin) {
      const { minDate, maxDate } = attendanceDateWindow();
      if (parsed.data.date > maxDate) {
        return res.status(400).json({ message: "Cannot mark attendance for a future date" });
      }
      if (parsed.data.date < minDate) {
        return res.status(400).json({
          message: `Attendance older than ${MAX_BACKFILL_DAYS} days is read-only — contact your school admin`,
        });
      }
    }

    // W-6: every mark must target a student of this class in the requester's
    // school. The attendance upsert key is global (student_id, date), so an
    // unvalidated studentId would let one school overwrite another school's
    // rows. Fail closed: one foreign id rejects the whole batch.
    const roster = await pgFindUsers(
      t.scope.isPlatformAdmin
        ? { role: "student", classname: parsed.data.className }
        : { role: "student", classname: parsed.data.className, schoolCode: t.scope.schoolCode }
    );
    const rosterIds = new Set(roster.map((s) => s.id));
    const foreignIds = parsed.data.marks.map((m) => m.studentId).filter((id) => !rosterIds.has(id));
    if (foreignIds.length > 0) {
      logger.warn("[attendance] rejected marks for students outside tenant scope", {
        userId: user.id,
        className: parsed.data.className,
        foreignIds,
      });
      return res
        .status(403)
        .json({ message: "Forbidden: some students are not in this class in your school" });
    }

    // #336 (B2): a platform-admin account has no school of its own — stamping
    // the marker's school_code produced NULL attendance rows that no
    // school-scoped read could ever see. Derive the school from the students
    // being marked instead, and fail closed (400) when it does not resolve to
    // exactly one school. Non-admin writes keep their validated tenant scope.
    let schoolCode: string;
    if (t.scope.isPlatformAdmin) {
      const markedIds = new Set(parsed.data.marks.map((m) => m.studentId));
      const schools = new Set(
        roster.filter((s) => markedIds.has(s.id)).map((s) => s.schoolCode ?? null)
      );
      const resolved = schools.size === 1 ? [...schools][0] : null;
      if (!resolved) {
        logger.warn("[attendance] admin mark rejected: unresolvable school_code", {
          userId: user.id,
          className: parsed.data.className,
          schools: [...schools],
        });
        return res.status(400).json({
          message: "Cannot resolve a single school for these students — attendance not saved",
        });
      }
      schoolCode = resolved;
    } else {
      schoolCode = t.scope.schoolCode!;
    }
    // W-2a: a failed write must be a failed response. pgMarkAttendance now
    // throws on DB errors (it used to swallow them and return 0, which made
    // the route reply success:true for a save that never happened — an
    // offline client would dequeue and lose the day's marking).
    let written: number;
    try {
      written = await pgMarkAttendance({
        schoolCode,
        className: parsed.data.className,
        date: parsed.data.date,
        markedAt: parsed.data.markedAt,
        markedBy: user.id,
        marks: parsed.data.marks,
      });
    } catch (err) {
      logger.error("[attendance] mark write failed", {
        userId: user.id,
        className: parsed.data.className,
        date: parsed.data.date,
        error: String(err),
      });
      return res.status(500).json({ message: "Attendance save failed — please retry" });
    }

    pgTrackFeatureUsage({ feature: "attendance", userId: user.id, schoolCode });
    if (req.headers["x-client"] === "mobile") {
      pgTrackFeatureUsage({ feature: "attendance_mobile", userId: user.id, schoolCode });
    }

    // Close the parent loop: WhatsApp the parent of every student marked
    // absent, when a parent phone is on file. With Redis on, this goes through
    // the durable event bus (crash between save and send no longer loses
    // alerts); without Redis it falls back to the inline fire-and-forget send.
    // Either way the teacher's save never blocks on delivery.
    //
    // WHATSAPP_ALERTS_ENABLED gate (#335 follow-up): the automated pipe is a
    // deliberately paused product decision, and every UI/offer surface now
    // says "we do not auto-send WhatsApp messages today". Configuring Meta
    // credentials alone must NOT silently turn undisclosed automated messages
    // to real parents back on — flipping this flag is the explicit act.
    const alertsEnabled =
      process.env.WHATSAPP_ALERTS_ENABLED === "true" && whatsappService.isConfigured();
    const absentIds = new Set(
      parsed.data.marks.filter((m) => m.status === "absent").map((m) => m.studentId)
    );
    let notified = 0;
    if (alertsEnabled && absentIds.size > 0) {
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

    res.json({
      success: true,
      written,
      notified,
      alerts: { channel: "whatsapp", enabled: alertsEnabled, attempted: notified },
    });
  }
);

/**
 * GET /api/attendance/school-summary?date= — principal/school-admin live view:
 * class coverage, absent counts, and unmarked-class nudges for one school day.
 */
router.get(
  "/school-summary",
  authenticateToken,
  requireRole("admin", "principal", "school_admin"),
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const t = resolveTenantScope(user);
    if ("error" in t) return res.status(t.error.status).json({ message: t.error.message });

    const date = String(req.query.date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: "date (YYYY-MM-DD) is required" });
    }

    const summary = await pgGetSchoolAttendanceSummary({
      schoolCode: t.scope.isPlatformAdmin ? undefined : t.scope.schoolCode,
      date,
    });
    res.json(summary);
  }
);

/**
 * GET /api/attendance/absentees?date=YYYY-MM-DD — the day's absentee call
 * list (student, class, parent phone) across all classes of one school.
 * School-scoped; a platform admin must name a school via ?schoolCode=.
 * Per spec E5 a query failure is a 500, never an empty list.
 */
router.get(
  "/absentees",
  authenticateToken,
  requireRole("admin", "principal", "school_admin"),
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const t = resolveTenantScope(user);
    if ("error" in t) return res.status(t.error.status).json({ message: t.error.message });

    const date = String(req.query.date || "");
    // Regex + round-trip: rejects well-formed-but-impossible dates (2026-02-31)
    // as a 400 instead of letting Postgres throw a cast error into the 500 path.
    const parsed = new Date(`${date}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(+parsed) ||
      parsed.toISOString().slice(0, 10) !== date
    ) {
      return res.status(400).json({ message: "date (YYYY-MM-DD) is required" });
    }

    const schoolCode = t.scope.isPlatformAdmin
      ? String(req.query.schoolCode || "")
      : t.scope.schoolCode!;
    if (!schoolCode) {
      return res.status(400).json({ message: "schoolCode is required" });
    }

    try {
      const absentees = await pgGetAbsenteesByDate({ schoolCode, date });
      return res.json({ date, count: absentees.length, absentees });
    } catch (err) {
      logger.error("[attendance] absentee list failed", { err: String(err) });
      return res.status(500).json({ message: "Absentee list could not be generated" });
    }
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
    // W-6: mobile clients cache rosters in plaintext AsyncStorage — never send
    // them guardian phone numbers (minors' PII). Web keeps parentPhone for the
    // roster's edit-phone affordance.
    if (req.headers["x-client"] === "mobile") {
      return res.json(students.map((s) => ({ id: s.id, name: s.name })));
    }
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
