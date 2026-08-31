import { Router, Request, Response } from "express";
import { z } from "zod";
import { authenticateToken, requireRole } from "../middleware";
import { resolveTenantScope } from "../lib/auth/tenant";
import {
  pgMarkAttendance,
  type MarkAttendanceResult,
  pgGetAttendanceByClassDate,
  pgGetStudentAttendanceSummary,
  pgGetSchoolAttendanceSummary,
  pgGetAbsenteesByDate,
  pgTrackFeatureUsage,
  pgGetClassNames,
  pgFindUsers,
  pgFindUserById,
  pgUpdateUser,
} from "../lib/db/pg-queries";
import { logger } from "../lib/logger";
import { isRedisConfigured } from "../lib/db/redis";
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
  // Idempotency key (eng review T4). The offline queue stamps one opId per save
  // attempt and reuses it on every replay, so the server fires side effects
  // (feature_usage, parent WhatsApp) exactly once. Optional: online saves that
  // omit it keep the legacy always-fire behaviour.
  opId: z.string().min(1).max(128).optional(),
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

// Exported so the processed_operations retention window can be DERIVED from it
// rather than duplicating the number: purging an op_id while a client could
// still replay that save would make the replay look new, re-firing parent
// alerts and adoption tracking. See services/processed-operations-retention.ts.
export const MAX_BACKFILL_DAYS = 3;
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
    // Computed before the write because the outbox payload is built inside the
    // write's transaction (T12) and must know whether an event is wanted at all.
    //
    // WHATSAPP_ALERTS_ENABLED gate (#335 follow-up): the automated pipe is a
    // deliberately paused product decision, and every UI/offer surface says
    // "we do not auto-send WhatsApp messages today". Configuring Meta
    // credentials alone must NOT silently turn undisclosed automated messages
    // to real parents back on — flipping this flag is the explicit act.
    const alertsEnabled =
      process.env.WHATSAPP_ALERTS_ENABLED === "true" && whatsappService.isConfigured();

    // W-2a: a failed write must be a failed response. pgMarkAttendance now
    // throws on DB errors (it used to swallow them and return 0, which made
    // the route reply success:true for a save that never happened — an
    // offline client would dequeue and lose the day's marking).
    let mark: MarkAttendanceResult;
    try {
      // Clamp client clocks to now + a little skew: markedAt becomes the
      // row's updated_at, and the upsert skips rows whose stored updated_at
      // is newer — an absurd future timestamp (bad device clock or malice)
      // would otherwise freeze those students' rows against all later saves.
      const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
      let markedAt = parsed.data.markedAt;
      if (markedAt && new Date(markedAt).getTime() > Date.now() + MAX_CLOCK_SKEW_MS) {
        markedAt = new Date().toISOString();
      }
      // Autoplan T12: the idempotency claim and the outbox row now commit in
      // the SAME transaction as the marks. Previously the claim was a separate
      // statement followed by a fire-and-forget publish — a lost publish left
      // the key claimed, so every retry read as a replay and the parent alert
      // was suppressed permanently and silently.
      mark = await pgMarkAttendance({
        schoolCode,
        className: parsed.data.className,
        date: parsed.data.date,
        markedAt,
        markedBy: user.id,
        marks: parsed.data.marks,
        opId: parsed.data.opId ?? null,
        outbox: alertsEnabled && isRedisConfigured()
          ? {
              topic: "attendance.marked",
              // Built from APPLIED ids inside the transaction (T10 + T12): the
              // event describes what landed, and it exists only if the marks do.
              payloadFor: (appliedIds: number[]) => {
                const applied = new Set(appliedIds);
                const absentees = roster
                  .filter(
                    (s) =>
                      s.parentPhone &&
                      applied.has(s.id) &&
                      parsed.data.marks.some(
                        (m) => m.studentId === s.id && m.status === "absent"
                      )
                  )
                  .map((s) => ({ id: s.id, name: s.name, parentPhone: s.parentPhone as string }));
                if (absentees.length === 0) return null;
                return {
                  className: parsed.data.className,
                  date: parsed.data.date,
                  absentees,
                } satisfies AttendanceMarkedPayload;
              },
            }
          : null,
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

    // Eng review T4 / autoplan T12: side effects fire exactly once per save. An
    // offline replay carries the same opId; the claim conflicted inside the write
    // transaction above, so no outbox row exists and we skip the rest here too.
    if (!mark.sideEffectsFresh) {
      logger.info("[attendance] replay detected, skipping side effects", {
        userId: user.id,
        opId: parsed.data.opId,
      });
      return res.json({
        success: true,
        written: mark.written,
        applied: mark.appliedIds,
        skipped: mark.skippedIds,
        notified: 0,
        replay: true,
        alerts: { channel: "whatsapp", enabled: false, attempted: 0 },
      });
    }

    // Autoplan T11: adoption is only real when a row actually landed. This used
    // to fire on every 200 — including a stale replay that wrote nothing — which
    // inflated the Sep-30 marking-day count. `subjectDate` records the school day
    // being marked rather than the day the request arrived, so three offline days
    // flushed on one reconnect score as three days, not one.
    if (mark.appliedIds.length > 0) {
      pgTrackFeatureUsage({
        feature: "attendance",
        userId: user.id,
        schoolCode,
        subjectDate: parsed.data.date,
      });
      if (req.headers["x-client"] === "mobile") {
        pgTrackFeatureUsage({
          feature: "attendance_mobile",
          userId: user.id,
          schoolCode,
          subjectDate: parsed.data.date,
        });
      }
    } else {
      logger.info("[attendance] no rows applied — not counting adoption", {
        userId: user.id,
        className: parsed.data.className,
        date: parsed.data.date,
        skipped: mark.skippedIds.length,
      });
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
    // Autoplan T10: intersect with the rows the upsert ACTUALLY wrote. Building
    // this from the request alone meant a stale offline replay messaged the
    // parent of a student whose absence was never recorded — and could
    // contradict a newer correction that had already marked them present.
    const applied = new Set(mark.appliedIds);
    const absentIds = new Set(
      parsed.data.marks
        .filter((m) => m.status === "absent" && applied.has(m.studentId))
        .map((m) => m.studentId)
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
        // Autoplan T12: with Redis on, the event was already committed to the
        // outbox inside the write transaction above and the dispatcher
        // publishes it — publishing again here would double-message. Without
        // Redis there is no bus and no dispatcher, so the inline send remains
        // the only path.
        if (!isRedisConfigured()) {
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
      written: mark.written,
      // Autoplan T6: `written` alone told a teacher that 3 of 50 marks were
      // skipped, never which three. These name them, so the client can show the
      // students whose newer mark won instead of a bare count mismatch.
      applied: mark.appliedIds,
      skipped: mark.skippedIds,
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

    // Eng review T3: a read failure must surface as 500, never a false-empty 200.
    // pgGetAttendanceByClassDate now throws instead of returning []; the client
    // checks this error and blocks marking rather than showing an empty,
    // editable register for a day that may already be recorded.
    try {
      const rows = await pgGetAttendanceByClassDate({
        schoolCode: t.scope.isPlatformAdmin ? undefined : t.scope.schoolCode,
        className,
        date,
      });
      res.json(rows);
    } catch (err) {
      logger.error("[attendance] read failed", {
        userId: user.id,
        className,
        date,
        error: String(err),
      });
      res.status(500).json({ message: "Could not load saved attendance — please retry" });
    }
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
