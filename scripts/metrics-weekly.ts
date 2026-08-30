import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { connectPostgres, getPgPool } from "../server/db-pg";
import { renderStudyArenaGate } from "./study-arena-gate";
import {
  METRIC_VERSION,
  METRIC_SEMANTICS,
  resolveTimezone,
  isoWeekOf,
  weekIsComplete,
  zonedMidnightInstant,
  partitionByVersion,
  selectBaseline,
  selectPreviousWeek,
  assertCohortExists,
  blockedBaselineCandidates,
  evaluateThreshold,
  type IsoWeek,
} from "./metric-semantics";

/**
 * Weekly adoption metrics — the dependence-probe instrument from the
 * Sharpened Company 90-day plan (objective 3 / spec E1-E2).
 *
 *   npm run metrics:weekly            print this week's numbers + persist snapshot
 *   npm run report:weekly             same, plus scaffold docs/dashboard/weekly/<week>.md
 *
 * Honesty rules (constitutional): every number is derived from real rows.
 * Zero renders as zero. A query failure aborts loudly — this script never
 * substitutes a plausible-looking blank for an error.
 *
 * Definitions (fixed here so baselines can't silently shift — spec E2):
 * - "active teacher" per workflow = distinct users.id that authored a domain
 *   row in the ISO week (attendance.marked_by / fees.created_by).
 * - "school day marked" = distinct (school_code, class_name, date) with >= 1
 *   attendance row DATED (attendance.date) inside the week — backfilled marks
 *   count toward the school day they describe, not the day they were typed.
 *   Fees have no domain date for activity, so fee metrics use created_at.
 * - feature_usage events are counted per feature name, distinct users per week.
 *   Rows with NULL school_code (platform admin / founder activity) and rows
 *   from E2E% seed schools are EXCLUDED — internal activity must never read
 *   as school adoption (demo-data honesty invariant).
 * - Decision threshold (from the plan): wedge weekly-active-teachers below 50%
 *   of the baseline week for 2 consecutive weeks => adoption failing, act.
 *
 * These definitions are FROZEN and versioned in ./metric-semantics.ts. Every
 * snapshot records the version it was measured under, and snapshots from a
 * different version are quarantined rather than compared. Changing a rule
 * without bumping METRIC_VERSION is how a redefinition becomes an invisible
 * trend — see METRIC_SEMANTICS for the full contract.
 */

interface Snapshot {
  /**
   * The rules this snapshot was measured under. Snapshots carrying a different
   * version are quarantined rather than compared — see ./metric-semantics.
   */
  metricVersion: number;
  /** IANA timezone the week boundary was evaluated in. */
  timezone: string;
  /** False when generated before the week ended. Never eligible as a baseline. */
  complete: boolean;
  /**
   * The frozen rules, copied in verbatim. A snapshot read six months from now
   * states the definitions that produced it instead of requiring archaeology
   * against whatever the script says by then.
   */
  semantics: typeof METRIC_SEMANTICS;
  isoWeek: string;
  generatedAt: string;
  weekStart: string; // inclusive, YYYY-MM-DD (Monday)
  weekEnd: string; // exclusive, YYYY-MM-DD (next Monday)
  attendance: {
    activeTeachers: number;
    rowsWritten: number;
    classDaysMarked: number;
    distinctSchoolDays: number;
  };
  fees: { activeStaff: number; rowsCreated: number };
  featureUsage: Array<{ feature: string; events: number; distinctUsers: number }>;
  totals: { users: number; teachers: number; students: number };
  // Sep-30 adoption gate input (eng review T2): per-teacher marking days this
  // week, from the append-only feature_usage log. The ≥60%/≥4-days verdict is
  // computed in renderTable against totals.teachers (the denominator).
  adoptionMatrix: Array<{
    userId: number;
    name: string;
    markingDays: number;
    weekdays: string[];
  }>;
  // Study Arena adoption signal (the payment-gate decision input). A "completed
  // lesson" = a student answered every gate in one generated lesson.
  studyArena: {
    lessonsStarted: number;
    completedLessons: number;
    studentsCompleted: number;
    pilotStartedAt?: string | null;
    pilotEndsAt?: string | null;
    pilotUnassistedStudentsCompleted?: number | null;
    pilotCompletedLessons?: number | null;
    pilotEstimatedCostInr?: number | null;
    pilotCostPerCompletedLessonInr?: number | null;
    pilotCostRowsMissing?: number | null;
  };
  // Over-reliance signal (docs/over-reliance-dashboard-plan.md). The claim our
  // pedagogy rests on is that these lessons make students attempt rather than
  // offload; the number that would falsify it belongs in the weekly instrument,
  // not only in a page a teacher has to remember to open. A "hint-first" gate is
  // one where a hint was taken BEFORE any attempt at that gate.
  reliance: {
    gates: number;
    hintFirstGates: number;
    hintFirstRate: number | null; // null = no gates this week; never 0-as-unknown
    studentsWithEvidence: number;
    studentsHintFirstMajority: number;
  };
}

// Week arithmetic lives in ./metric-semantics — frozen and versioned.

// Eng review T1 (Codex #2): scope to a single pilot school when PILOT_SCHOOL_CODE
// is set, so the number quoted in a payment conversation is THIS school's, not an
// all-schools aggregate. Validated against a safe charset before interpolation —
// operator-set, but the honesty/safety invariant means we refuse a malformed
// code loudly rather than build unsafe SQL. Unset => original all-real-schools
// behaviour (unchanged).
const PILOT_SCHOOL_CODE = process.env.PILOT_SCHOOL_CODE?.trim() || null;
if (PILOT_SCHOOL_CODE && !/^[A-Za-z0-9_-]{1,64}$/.test(PILOT_SCHOOL_CODE)) {
  throw new Error(
    "PILOT_SCHOOL_CODE must match [A-Za-z0-9_-]{1,64} (got an unsafe value) — refusing to build SQL"
  );
}
const PILOT_AND = PILOT_SCHOOL_CODE ? ` AND school_code = '${PILOT_SCHOOL_CODE}'` : "";

// E2E seed schools carry an 'E2E' school-code prefix; adoption metrics must
// never count them. One SQL fragment per null-semantics so the exclusion
// can't drift apart across the queries below (change here = change everywhere).
// When PILOT_SCHOOL_CODE is set both fragments additionally pin to that school.
const REAL_SCHOOL_SQL = `school_code IS NOT NULL AND school_code NOT LIKE 'E2E%'${PILOT_AND}`;
const REAL_OR_NO_SCHOOL_SQL = PILOT_SCHOOL_CODE
  ? `school_code = '${PILOT_SCHOOL_CODE}'`
  : `(school_code IS NULL OR school_code NOT LIKE 'E2E%')`;

// Platform-admin (founder) activity must never read as school adoption, even
// when the admin account is linked to the pilot school for demos — same
// honesty rule as the E2E exclusion. NULL actor rows are kept (legacy data).
const notAdminSql = (actorCol: string) =>
  `(${actorCol} IS NULL OR ${actorCol} NOT IN (SELECT id FROM users WHERE role = 'admin'))`;

async function collect(
  weekStart: string,
  weekEnd: string,
  weekStartInstant: string,
  weekEndInstant: string,
  tz: string
): Promise<
  Omit<
    Snapshot,
    | "isoWeek"
    | "generatedAt"
    | "weekStart"
    | "weekEnd"
    | "metricVersion"
    | "timezone"
    | "complete"
    | "semantics"
  >
> {
  const pool = getPgPool();
  const q = async <T = any>(sql: string, params: unknown[] = []): Promise<T[]> => {
    // No []-on-error fallback (spec E5): a failed query kills the run loudly.
    const res = await pool.query(sql, params);
    return res.rows as T[];
  };

  const [att] = await q(
    `SELECT COUNT(DISTINCT marked_by) FILTER (WHERE marked_by IN (SELECT id FROM users WHERE role = 'teacher'))::int AS active_teachers,
            COUNT(*)::int                                                       AS rows_written,
            COUNT(DISTINCT (school_code, class_name, date))::int                AS class_days_marked,
            COUNT(DISTINCT date)::int                                           AS distinct_school_days
       FROM attendance
      WHERE date >= $1::date AND date < $2::date
        AND ${REAL_SCHOOL_SQL}
        AND ${notAdminSql("marked_by")}`,
    [weekStart, weekEnd]
  );

  const [fee] = await q(
    `SELECT COUNT(DISTINCT created_by) FILTER (WHERE created_by IS NOT NULL)::int AS active_staff,
            COUNT(*)::int                                                          AS rows_created
       FROM fees
      WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz
        AND ${REAL_SCHOOL_SQL}
        AND ${notAdminSql("created_by")}`,
    [weekStartInstant, weekEndInstant]
  );

  const usage = await q(
    `SELECT feature,
            COUNT(*)::int                 AS events,
            COUNT(DISTINCT user_id)::int  AS distinct_users
       FROM feature_usage
      WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz
        AND ${REAL_SCHOOL_SQL}
        AND ${notAdminSql("user_id")}
      GROUP BY feature
      ORDER BY events DESC`,
    [weekStartInstant, weekEndInstant]
  );

  // Eng review T2 (Tension 2): the Sep-30 gate is "≥60% of teachers marking ≥4
  // days/week". Derive it from the APPEND-ONLY feature_usage log (created_at =
  // real activity time), NOT the mutable attendance table — a correction there
  // overwrites marked_by, and a backfilled date would inflate "daily" usage.
  // Dedup to one marking-day per (teacher, calendar day). Group on feature_usage
  // first (unaliased, so REAL_SCHOOL_SQL binds to feature_usage.school_code),
  // then join users for names.
  const matrix = await q<{
    user_id: number;
    name: string;
    marking_days: number;
    weekdays: string[];
  }>(
    `WITH marks AS (
        SELECT user_id, (created_at AT TIME ZONE $3)::date AS d,
               to_char(created_at AT TIME ZONE $3, 'Dy')   AS wd
          FROM feature_usage
         WHERE feature = 'attendance'
           AND created_at >= $1::timestamptz AND created_at < $2::timestamptz
           AND ${REAL_SCHOOL_SQL}
           AND ${notAdminSql("user_id")}
         GROUP BY user_id, (created_at AT TIME ZONE $3)::date,
                  to_char(created_at AT TIME ZONE $3, 'Dy')
     )
     SELECT m.user_id, u.name,
            COUNT(DISTINCT m.d)::int  AS marking_days,
            ARRAY_AGG(DISTINCT m.wd)  AS weekdays
       FROM marks m
       JOIN users u ON u.id = m.user_id AND u.role = 'teacher'
      GROUP BY m.user_id, u.name
      ORDER BY marking_days DESC, u.name ASC`,
    [weekStartInstant, weekEndInstant, tz]
  );

  const [totals] = await q(
    `SELECT COUNT(*)::int                                        AS users,
            COUNT(*) FILTER (WHERE role = 'teacher')::int        AS teachers,
            COUNT(*) FILTER (WHERE role = 'student')::int        AS students
       FROM users
      WHERE ${REAL_OR_NO_SCHOOL_SQL}`
  );

  // When PILOT_SCHOOL_CODE is set, Study Arena queries must also be pinned to
  // that school — otherwise the gate report can pass on students from other
  // schools and the payment conversation cites the wrong cohort.
  // interaction_log has no school_code column, so we join users for scoping.
  const ARENA_SCHOOL_JOIN = PILOT_SCHOOL_CODE
    ? `JOIN users _u ON _u.id = il.student_id AND _u.school_code = '${PILOT_SCHOOL_CODE}'`
    : "";
  const RELIANCE_SCHOOL_JOIN = PILOT_SCHOOL_CODE
    ? `JOIN users _ru ON _ru.id = ev.student_id AND _ru.school_code = '${PILOT_SCHOOL_CODE}'`
    : "";
  const ARENA_SCHOOL_JOIN_COST = PILOT_SCHOOL_CODE
    ? `JOIN users _u ON _u.id = l.user_id AND _u.school_code = '${PILOT_SCHOOL_CODE}'`
    : "";

  // Study Arena: roll gate-answer rows up into "did the student finish a full
  // gated lesson?". A lesson is complete when the distinct gates answered under
  // one lessonId reach that lesson's totalGates. Only student-role rows are
  // logged (see the beta route), so no role filter is needed here.
  const [arena] = await q(
    `WITH gate_answers AS (
        SELECT il.student_id,
               il.payload->>'lessonId'         AS lesson_id,
               il.payload->>'actionKey'        AS action_key,
               (il.payload->>'totalGates')::int AS total_gates
          FROM interaction_log il
          ${ARENA_SCHOOL_JOIN}
         WHERE il.kind = 'study_arena_gate_answer'
           AND il.created_at >= $1::timestamptz AND il.created_at < $2::timestamptz
           AND il.payload->>'lessonId' IS NOT NULL
     ),
     lessons AS (
        SELECT student_id, lesson_id,
               COUNT(DISTINCT action_key) AS gates_answered,
               MAX(total_gates)           AS total_gates
          FROM gate_answers
         GROUP BY student_id, lesson_id
     )
     SELECT COUNT(*)::int AS lessons_started,
            COUNT(*) FILTER (
              WHERE total_gates IS NOT NULL AND gates_answered >= total_gates
            )::int AS completed_lessons,
            COUNT(DISTINCT student_id) FILTER (
              WHERE total_gates IS NOT NULL AND gates_answered >= total_gates
            )::int AS students_completed
       FROM lessons`,
    [weekStartInstant, weekEndInstant]
  );

  // Reliance: hint-before-attempt at gate granularity. Preview sessions are
  // excluded for the same reason the dashboard excludes them — a teacher walking
  // their own lesson is not a learner. This mirrors the definition in
  // server/services/study-arena/reliance-model.ts; change both together.
  const [reliance] = await q(
    `WITH gates AS (
        SELECT ev.student_id, ev.attempt_session_id, ev.action_index,
               (MIN(ev.created_at) FILTER (WHERE ev.event_kind = 'hint') IS NOT NULL
                AND (MIN(ev.created_at) FILTER (WHERE ev.event_kind = 'attempt') IS NULL
                     OR MIN(ev.created_at) FILTER (WHERE ev.event_kind = 'hint')
                        < MIN(ev.created_at) FILTER (WHERE ev.event_kind = 'attempt'))) AS hint_first
          FROM study_arena_evidence_events ev
          JOIN study_arena_attempt_sessions s
            ON s.id = ev.attempt_session_id AND s.is_preview = false
          ${RELIANCE_SCHOOL_JOIN}
         WHERE ev.event_kind IN ('attempt', 'hint')
           AND ev.created_at >= $1 AND ev.created_at < $2
         GROUP BY ev.student_id, ev.attempt_session_id, ev.action_index
     ),
     per_student AS (
        SELECT student_id,
               COUNT(*)::int AS gates,
               COUNT(*) FILTER (WHERE hint_first)::int AS hint_first_gates
          FROM gates GROUP BY student_id
     )
     SELECT COALESCE(SUM(gates), 0)::int                        AS gates,
            COALESCE(SUM(hint_first_gates), 0)::int             AS hint_first_gates,
            COUNT(*)::int                                       AS students_with_evidence,
            COUNT(*) FILTER (WHERE hint_first_gates * 2 > gates)::int AS students_hint_first_majority
       FROM per_student`,
    [weekStart, weekEnd]
  );

  // The adoption decision is anchored to the explicit pilot-enable timestamp,
  // not to calendar weeks. Without it, the 30-day gate is deliberately
  // unarmed rather than inferred from incomplete snapshots.
  const pilotStartedAt = process.env.STUDY_ARENA_PILOT_ENABLED_AT?.trim() || null;
  let pilotEndsAt: string | null = null;
  let pilotUnassistedStudentsCompleted: number | null = null;
  let pilotCompletedLessons: number | null = null;
  let pilotEstimatedCostInr: number | null = null;
  let pilotCostPerCompletedLessonInr: number | null = null;
  let pilotCostRowsMissing: number | null = null;
  if (pilotStartedAt) {
    const start = new Date(pilotStartedAt);
    if (Number.isNaN(start.getTime())) {
      throw new Error("STUDY_ARENA_PILOT_ENABLED_AT must be an ISO-8601 timestamp");
    }
    const end = new Date(start.getTime() + 30 * 86400000);
    pilotEndsAt = end.toISOString();
    const [pilot] = await q(
      `WITH gate_answers AS (
          SELECT il.student_id,
                 il.payload->>'lessonId'          AS lesson_id,
                 il.payload->>'actionKey'         AS action_key,
                 (il.payload->>'totalGates')::int AS total_gates,
                 (il.payload->>'attempt')::int    AS attempt
            FROM interaction_log il
            ${ARENA_SCHOOL_JOIN}
           WHERE il.kind = 'study_arena_gate_answer'
             AND il.created_at >= $1::timestamptz
             AND il.created_at < $2::timestamptz
             AND il.payload->>'lessonId' IS NOT NULL
       ), lessons AS (
          SELECT student_id, lesson_id,
                 COUNT(DISTINCT action_key) AS gates_answered,
                 MAX(total_gates)           AS total_gates,
                 MAX(attempt)               AS max_attempt
            FROM gate_answers
           GROUP BY student_id, lesson_id
       )
       SELECT COUNT(*) FILTER (
                WHERE total_gates IS NOT NULL AND gates_answered >= total_gates
              )::int AS completed_lessons,
              COUNT(DISTINCT student_id) FILTER (
                WHERE total_gates IS NOT NULL
                  AND gates_answered >= total_gates
                  AND max_attempt = 1
              )::int AS students_completed_unassisted
         FROM lessons`,
      [start.toISOString(), pilotEndsAt]
    );
    pilotUnassistedStudentsCompleted = pilot?.students_completed_unassisted ?? 0;
    pilotCompletedLessons = pilot?.completed_lessons ?? 0;

    const [cost] = await q(
      `WITH expected AS (
         SELECT COUNT(*)::int AS interactions,
                COUNT(DISTINCT il.payload->>'lessonId')::int AS lessons
           FROM interaction_log il
           ${ARENA_SCHOOL_JOIN}
          WHERE il.kind = 'study_arena_gate_answer'
            AND il.created_at >= $1::timestamptz AND il.created_at < $2::timestamptz
       ), usage AS (
         SELECT COALESCE(SUM((l.metadata->>'estimatedCostInr')::numeric), 0)::float AS estimated_cost_inr,
                COUNT(*) FILTER (WHERE l.metadata->>'estimatedCostInr' IS NULL)::int AS null_cost_rows,
                COUNT(*) FILTER (WHERE l.metadata->>'type' = 'study_arena_interaction')::int AS interactions,
                COUNT(DISTINCT l.metadata->>'lessonId') FILTER (
                  WHERE l.metadata->>'type' = 'study_arena_lesson'
                )::int AS lessons
           FROM ai_usage_logs l
           JOIN users u ON u.id = l.user_id AND u.role = 'student'
           ${ARENA_SCHOOL_JOIN_COST}
          WHERE l.created_at >= $1::timestamptz AND l.created_at < $2::timestamptz
            AND l.metadata->>'type' IN ('study_arena_lesson', 'study_arena_interaction')
       )
       SELECT usage.estimated_cost_inr,
              (usage.null_cost_rows
                + GREATEST(expected.interactions - usage.interactions, 0)
                + GREATEST(expected.lessons - usage.lessons, 0))::int AS missing_cost_rows
         FROM expected CROSS JOIN usage`,
      [start.toISOString(), pilotEndsAt]
    );
    pilotCostRowsMissing = cost?.missing_cost_rows ?? 0;
    if (pilotCostRowsMissing === 0) {
      pilotEstimatedCostInr = Number(cost?.estimated_cost_inr ?? 0);
      if (pilotCompletedLessons > 0) {
        pilotCostPerCompletedLessonInr = pilotEstimatedCostInr / pilotCompletedLessons;
      }
    }
  }

  return {
    attendance: {
      activeTeachers: att.active_teachers,
      rowsWritten: att.rows_written,
      classDaysMarked: att.class_days_marked,
      distinctSchoolDays: att.distinct_school_days,
    },
    fees: { activeStaff: fee.active_staff, rowsCreated: fee.rows_created },
    featureUsage: usage.map((u) => ({
      feature: u.feature,
      events: u.events,
      distinctUsers: u.distinct_users,
    })),
    totals: { users: totals.users, teachers: totals.teachers, students: totals.students },
    adoptionMatrix: matrix.map((m) => ({
      userId: m.user_id,
      name: m.name,
      markingDays: m.marking_days,
      weekdays: m.weekdays ?? [],
    })),
    studyArena: {
      lessonsStarted: arena?.lessons_started ?? 0,
      completedLessons: arena?.completed_lessons ?? 0,
      studentsCompleted: arena?.students_completed ?? 0,
      pilotStartedAt,
      pilotEndsAt,
      pilotUnassistedStudentsCompleted,
      pilotCompletedLessons,
      pilotEstimatedCostInr,
      pilotCostPerCompletedLessonInr,
      pilotCostRowsMissing,
    },
    reliance: {
      gates: reliance?.gates ?? 0,
      hintFirstGates: reliance?.hint_first_gates ?? 0,
      // No gates means unknown, not "nobody offloaded". Rendering 0% on a week
      // when nobody used the feature would read as a pedagogy win.
      hintFirstRate: (reliance?.gates ?? 0) > 0 ? reliance.hint_first_gates / reliance.gates : null,
      studentsWithEvidence: reliance?.students_with_evidence ?? 0,
      studentsHintFirstMajority: reliance?.students_hint_first_majority ?? 0,
    },
  };
}

function loadPriorSnapshots(dir: string): Snapshot[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as Snapshot);
}

/**
 * A rate that is small but real must not render as "0%" — on this instrument a
 * zero is a claim ("nobody offloaded this week"), and rounding one into
 * existence is the same dishonesty as substituting a blank for an error.
 */
function formatRate(rate: number): string {
  const pct = rate * 100;
  if (pct === 0) return "0%";
  if (pct < 1) return "<1%";
  return `${pct.toFixed(0)}%`;
}

function renderTable(s: Snapshot, prior: Snapshot[], week: IsoWeek, tz: string): string {
  // Both selections are frozen rules, not local judgement — see
  // ./metric-semantics. Baseline skips zero-activity AND partial weeks; the
  // comparison week must be the immediately preceding ISO week and complete,
  // so a gap disarms the breach check instead of being compared across.
  const baseline = selectBaseline(prior);
  const prev = selectPreviousWeek(prior, week, tz);
  const delta = (cur: number, past?: number) =>
    past === undefined
      ? "—"
      : past === 0
        ? cur > 0
          ? "new"
          : "0"
        : `${cur >= past ? "+" : ""}${(((cur - past) / past) * 100).toFixed(0)}%`;

  const lines: string[] = [];
  lines.push(`# Weekly metrics — ${s.isoWeek} (${s.weekStart} → ${s.weekEnd}, exclusive)`);
  lines.push("");
  lines.push(
    `| Metric | This week | vs prev | vs baseline${baseline ? ` (${baseline.isoWeek})` : ""} |`
  );
  lines.push(`|--------|-----------|---------|-------------|`);
  lines.push(
    `| Attendance: active teachers | ${s.attendance.activeTeachers} | ${delta(s.attendance.activeTeachers, prev?.attendance.activeTeachers)} | ${delta(s.attendance.activeTeachers, baseline?.attendance.activeTeachers)} |`
  );
  lines.push(
    `| Attendance: rows written | ${s.attendance.rowsWritten} | ${delta(s.attendance.rowsWritten, prev?.attendance.rowsWritten)} | ${delta(s.attendance.rowsWritten, baseline?.attendance.rowsWritten)} |`
  );
  lines.push(
    `| Attendance: class-days marked | ${s.attendance.classDaysMarked} | ${delta(s.attendance.classDaysMarked, prev?.attendance.classDaysMarked)} | ${delta(s.attendance.classDaysMarked, baseline?.attendance.classDaysMarked)} |`
  );
  lines.push(
    `| Fees: active staff | ${s.fees.activeStaff} | ${delta(s.fees.activeStaff, prev?.fees.activeStaff)} | ${delta(s.fees.activeStaff, baseline?.fees.activeStaff)} |`
  );
  lines.push(
    `| Fees: rows created | ${s.fees.rowsCreated} | ${delta(s.fees.rowsCreated, prev?.fees.rowsCreated)} | ${delta(s.fees.rowsCreated, baseline?.fees.rowsCreated)} |`
  );
  for (const u of s.featureUsage.slice(0, 10)) {
    lines.push(
      `| feature_usage: ${u.feature} | ${u.events} ev / ${u.distinctUsers} users | — | — |`
    );
  }
  lines.push(
    `| Accounts (users/teachers/students) | ${s.totals.users} / ${s.totals.teachers} / ${s.totals.students} | — | — |`
  );
  lines.push(
    `| Study Arena: lessons completed / started | ${s.studyArena.completedLessons} / ${s.studyArena.lessonsStarted} | ${delta(s.studyArena.completedLessons, prev?.studyArena?.completedLessons)} | — |`
  );
  lines.push(
    `| Study Arena: distinct students completing | ${s.studyArena.studentsCompleted} | — | — |`,
    `| Study Arena: hint-first gates | ${
      s.reliance.hintFirstRate === null
        ? "no gates this week"
        : `${formatRate(s.reliance.hintFirstRate)} (${s.reliance.hintFirstGates}/${s.reliance.gates})`
    } | ${
      prev?.reliance?.hintFirstRate == null || s.reliance.hintFirstRate === null
        ? "—"
        : `${((s.reliance.hintFirstRate - prev.reliance.hintFirstRate) * 100).toFixed(0)}pp`
    } | lower is better |`,
    `| Study Arena: students mostly hint-first | ${s.reliance.studentsHintFirstMajority} / ${s.reliance.studentsWithEvidence} | — | — |`
  );
  lines.push("");

  // Sep-30 adoption gate (eng review T2): ≥60% of teachers marking ≥4 days/week,
  // from the append-only feature_usage log. Denominator = all teacher accounts in
  // scope (totals.teachers) — the conservative, explicit definition (Codex #3).
  const WD_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const meetingBar = s.adoptionMatrix.filter((t) => t.markingDays >= 4).length;
  const denom = s.totals.teachers;
  const pct = denom > 0 ? Math.round((meetingBar / denom) * 100) : 0;
  lines.push(`## Adoption matrix — per-teacher marking days (feature_usage, append-only)`);
  lines.push("");
  lines.push(`| Teacher | Marking days | Weekdays |`);
  lines.push(`|---------|--------------|----------|`);
  if (s.adoptionMatrix.length === 0) {
    lines.push(`| _(no teacher marked attendance this week)_ | 0 | — |`);
  } else {
    for (const t of s.adoptionMatrix) {
      const days = WD_ORDER.filter((d) => t.weekdays.includes(d)).join(" ");
      lines.push(
        `| ${t.name} | ${t.markingDays}${t.markingDays >= 4 ? " ✓" : ""} | ${days || "—"} |`
      );
    }
  }
  lines.push("");
  lines.push(
    `Sep-30 gate: ${meetingBar}/${denom} teachers marked ≥4 days = **${pct}%** (target ≥60%) — ` +
      `${pct >= 60 ? "**PASS**" : "not yet met"}.` +
      (PILOT_SCHOOL_CODE
        ? ` [scoped to ${PILOT_SCHOOL_CODE}]`
        : " [ALL real schools — set PILOT_SCHOOL_CODE to scope to the pilot]")
  );
  lines.push("");

  // Study Arena adoption gate (autoplan T3, 2026-07-21). The pilot bet is
  // attempt-first lessons. Kill criterion: within 30 days of enabling the flag
  // for the pilot, ≥5 distinct students each complete ≥1 full gated lesson
  // unassisted (and a teacher looks at the resulting signal). If not, mothball
  // Study Arena behind the flag and redeploy the effort to the paid wedge.
  lines.push(
    renderStudyArenaGate({
      pilotStartedAt: s.studyArena.pilotStartedAt,
      pilotEndsAt: s.studyArena.pilotEndsAt,
      unassistedStudentsCompleted: s.studyArena.pilotUnassistedStudentsCompleted,
      costPerCompletedLessonInr: s.studyArena.pilotCostPerCompletedLessonInr,
      costRowsMissing: s.studyArena.pilotCostRowsMissing,
      teacherReviewed: process.env.STUDY_ARENA_SIGNAL_REVIEWED === "true",
    })
  );

  // Decision threshold (plan objective 3). The arithmetic lives in
  // ./metric-semantics so it is testable — this only renders the verdict.
  const verdict = evaluateThreshold({
    currentIsoWeek: s.isoWeek,
    currentActiveTeachers: s.attendance.activeTeachers,
    baseline,
    previous: prev,
  });
  if (verdict.state === "breached") {
    lines.push(
      `> **THRESHOLD BREACHED:** attendance weekly-active-teachers below 50% of baseline (${baseline!.attendance.activeTeachers}) for 2 consecutive weeks. Per the plan: adoption is failing — act, don't average it away.`
    );
  } else if (verdict.state === "warn") {
    lines.push(
      `> WARN: attendance weekly-active-teachers below 50% of baseline this week (1st week — threshold fires at 2 consecutive).`
    );
  } else if (verdict.state === "not_armed") {
    // A partial week with real activity is a MEASUREMENT GAP, not an absent
    // pilot, and the two look identical in the generic message below. Say which
    // it is: an operator who only ever runs mid-week produces nothing complete,
    // so the threshold never arms — the exact silent disarmament the
    // partial-week rule exists to prevent, in a new shape.
    const blocked = blockedBaselineCandidates(prior);
    if (!baseline && blocked.length > 0) {
      lines.push(
        `> **THRESHOLD BLOCKED, NOT UNARMED.** ${blocked.length} week(s) with real teacher activity ` +
          `(${blocked.map((b) => b.isoWeek).join(", ")}) are recorded as PARTIAL, so none can serve as ` +
          `the baseline and the 50% threshold can never fire. This is a measurement gap, not "no ` +
          `adoption yet". Re-run after those weeks closed to supersede them.`
      );
    } else {
      lines.push(`> Threshold NOT armed: ${verdict.reason}.`);
    }
  }
  if (!s.complete) {
    lines.push("");
    lines.push(
      `> **PARTIAL WEEK.** Generated before ${s.weekEnd} (${tz}), so this week is still accumulating. It is recorded but excluded from baseline selection and from the threshold check. Re-run after the week closes to supersede it.`
    );
  }
  return lines.join("\n");
}

async function main() {
  const makeReport = process.argv.includes("--report");
  // Persisting is the default, but a snapshot written from a QA or local
  // database silently joins the trend and there is no way to tell later which
  // rows it came from. Any run not pointed at production should use --dry-run.
  const dryRun = process.argv.includes("--dry-run");
  const tz = resolveTimezone();
  const now = new Date();
  const week = isoWeekOf(now, tz);
  const complete = weekIsComplete(week, now, tz);

  await connectPostgres();

  // Cohort integrity (spec E5 / adoption-denominator P0). Rule lives in
  // ./metric-semantics so it is testable without a database.
  await assertCohortExists(async (code) => {
    const { rows } = await getPgPool().query(
      `SELECT COUNT(*)::int AS n FROM schools WHERE code = $1`,
      [code]
    );
    return rows[0]?.n ?? 0;
  }, PILOT_SCHOOL_CODE);

  const body = await collect(
    week.weekStart,
    week.weekEnd,
    zonedMidnightInstant(week.weekStart, tz).toISOString(),
    zonedMidnightInstant(week.weekEnd, tz).toISOString(),
    tz
  );
  const snapshot: Snapshot = {
    metricVersion: METRIC_VERSION,
    timezone: tz,
    complete,
    semantics: METRIC_SEMANTICS,
    isoWeek: week.isoWeek,
    generatedAt: now.toISOString(),
    weekStart: week.weekStart,
    weekEnd: week.weekEnd,
    ...body,
  };

  const metricsDir = path.resolve("docs/dashboard/metrics");
  const all = loadPriorSnapshots(metricsDir).filter((p) => p.isoWeek !== week.isoWeek);
  const { compatible: prior, quarantined } = partitionByVersion(all);
  if (!dryRun) {
    fs.mkdirSync(metricsDir, { recursive: true });
    fs.writeFileSync(
      path.join(metricsDir, `${week.isoWeek}.json`),
      JSON.stringify(snapshot, null, 2)
    );
  }

  const table = renderTable(snapshot, prior, week, tz);
  console.log(table);
  console.log(
    dryRun
      ? `\n--dry-run: nothing persisted. Snapshot WOULD be docs/dashboard/metrics/${week.isoWeek}.json`
      : `\nSnapshot persisted: docs/dashboard/metrics/${week.isoWeek}.json`
  );
  console.log(
    `Metric semantics v${METRIC_VERSION}, week boundary in ${tz}, week ${complete ? "complete" : "PARTIAL"}.`
  );
  if (quarantined.length > 0) {
    // Loud, not silent: these are real files on disk that a reader would
    // reasonably assume are part of the trend. They are not.
    console.log(
      `\n${quarantined.length} snapshot(s) QUARANTINED — measured under different rules, excluded from every comparison:`
    );
    for (const s2 of quarantined) {
      console.log(
        `  - ${s2.isoWeek}: metricVersion=${(s2 as Snapshot).metricVersion ?? "none (pre-freeze)"}`
      );
    }
    console.log(
      `  These cannot be repaired by re-stamping: the rules that produced them are unknown, and`
    );
    console.log(
      `  the queries are live, so a past week cannot be recomputed. They stay as historical record only.`
    );
  }

  if (makeReport && dryRun) {
    console.log("--dry-run: skipping weekly report scaffold.");
  } else if (makeReport) {
    const weeklyDir = path.resolve("docs/dashboard/weekly");
    fs.mkdirSync(weeklyDir, { recursive: true });
    const reportPath = path.join(weeklyDir, `${week.isoWeek}.md`);
    if (fs.existsSync(reportPath)) {
      console.log(
        `Weekly report already exists, not overwriting: docs/dashboard/weekly/${week.isoWeek}.md`
      );
    } else {
      const template = fs.readFileSync(path.resolve("docs/dashboard/weekly/TEMPLATE.md"), "utf8");
      fs.writeFileSync(
        reportPath,
        template.replaceAll("{{WEEK}}", week.isoWeek).replace("{{METRICS_TABLE}}", table)
      );
      console.log(
        `Weekly report scaffolded: docs/dashboard/weekly/${week.isoWeek}.md — fill in the narrative sections.`
      );
    }
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("metrics:weekly failed loudly (by design — no silent blanks):", err);
  process.exit(1);
});
