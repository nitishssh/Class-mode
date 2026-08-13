import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { connectPostgres, getPgPool } from "../server/db-pg";
import { renderStudyArenaGate } from "./study-arena-gate";

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
 */

interface Snapshot {
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
}

function isoWeekOf(d: Date): { isoWeek: string; weekStart: Date; weekEnd: Date } {
  // Monday-based ISO week containing `d`, formatted 2026-W29.
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (day.getUTCDay() + 6) % 7; // Mon=0
  const weekStart = new Date(day);
  weekStart.setUTCDate(day.getUTCDate() - dow);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 7);
  const thursday = new Date(weekStart);
  thursday.setUTCDate(weekStart.getUTCDate() + 3);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return {
    isoWeek: `${thursday.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`,
    weekStart,
    weekEnd,
  };
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

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
  weekEnd: string
): Promise<Omit<Snapshot, "isoWeek" | "generatedAt" | "weekStart" | "weekEnd">> {
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
      WHERE created_at >= $1 AND created_at < $2
        AND ${REAL_SCHOOL_SQL}
        AND ${notAdminSql("created_by")}`,
    [weekStart, weekEnd]
  );

  const usage = await q(
    `SELECT feature,
            COUNT(*)::int                 AS events,
            COUNT(DISTINCT user_id)::int  AS distinct_users
       FROM feature_usage
      WHERE created_at >= $1 AND created_at < $2
        AND ${REAL_SCHOOL_SQL}
        AND ${notAdminSql("user_id")}
      GROUP BY feature
      ORDER BY events DESC`,
    [weekStart, weekEnd]
  );

  // Eng review T2 (Tension 2): the Sep-30 gate is "≥60% of teachers marking ≥4
  // days/week". Derive it from the APPEND-ONLY feature_usage log (created_at =
  // real activity time), NOT the mutable attendance table — a correction there
  // overwrites marked_by, and a backfilled date would inflate "daily" usage.
  // Dedup to one marking-day per (teacher, calendar day). Group on feature_usage
  // first (unaliased, so REAL_SCHOOL_SQL binds to feature_usage.school_code),
  // then join users for names.
  const matrix = await q<{ user_id: number; name: string; marking_days: number; weekdays: string[] }>(
    `WITH marks AS (
        SELECT user_id, (created_at AT TIME ZONE 'UTC')::date AS d,
               to_char(created_at AT TIME ZONE 'UTC', 'Dy')   AS wd
          FROM feature_usage
         WHERE feature = 'attendance'
           AND created_at >= $1 AND created_at < $2
           AND ${REAL_SCHOOL_SQL}
           AND ${notAdminSql("user_id")}
         GROUP BY user_id, (created_at AT TIME ZONE 'UTC')::date,
                  to_char(created_at AT TIME ZONE 'UTC', 'Dy')
     )
     SELECT m.user_id, u.name,
            COUNT(DISTINCT m.d)::int  AS marking_days,
            ARRAY_AGG(DISTINCT m.wd)  AS weekdays
       FROM marks m
       JOIN users u ON u.id = m.user_id AND u.role = 'teacher'
      GROUP BY m.user_id, u.name
      ORDER BY marking_days DESC, u.name ASC`,
    [weekStart, weekEnd]
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
           AND il.created_at >= $1 AND il.created_at < $2
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

function renderTable(s: Snapshot, prior: Snapshot[]): string {
  // Baseline = the FIRST week with real wedge activity. Anchoring on prior[0]
  // unconditionally would pin the threshold bar to the launch week's zeros
  // forever (0 * 0.5 = 0 can never be breached) — the kill-switch this script
  // exists to provide would be permanently disarmed.
  const baseline = prior.find((p) => p.attendance.activeTeachers > 0);
  const prev = prior[prior.length - 1];
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
    `| Study Arena: distinct students completing | ${s.studyArena.studentsCompleted} | — | — |`
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

  // Decision threshold (plan objective 3): wedge WAT < 50% of baseline, 2 consecutive weeks.
  if (baseline && prev && baseline.isoWeek !== s.isoWeek) {
    const bar = baseline.attendance.activeTeachers * 0.5;
    const thisBelow = s.attendance.activeTeachers < bar;
    const prevBelow = prev.attendance.activeTeachers < bar;
    if (thisBelow && prevBelow) {
      lines.push(
        `> **THRESHOLD BREACHED:** attendance weekly-active-teachers below 50% of baseline (${baseline.attendance.activeTeachers}) for 2 consecutive weeks. Per the plan: adoption is failing — act, don't average it away.`
      );
    } else if (thisBelow) {
      lines.push(
        `> WARN: attendance weekly-active-teachers below 50% of baseline this week (1st week — threshold fires at 2 consecutive).`
      );
    }
  } else if (!baseline || baseline.isoWeek === s.isoWeek) {
    lines.push(
      `> No baseline week with nonzero weekly-active-teachers yet — the 50% adoption threshold is NOT armed. It arms the week after the first week with real teacher activity.`
    );
  }
  return lines.join("\n");
}

async function main() {
  const makeReport = process.argv.includes("--report");
  const { isoWeek, weekStart, weekEnd } = isoWeekOf(new Date());

  await connectPostgres();
  const body = await collect(ymd(weekStart), ymd(weekEnd));
  const snapshot: Snapshot = {
    isoWeek,
    generatedAt: new Date().toISOString(),
    weekStart: ymd(weekStart),
    weekEnd: ymd(weekEnd),
    ...body,
  };

  const metricsDir = path.resolve("docs/dashboard/metrics");
  const prior = loadPriorSnapshots(metricsDir).filter((p) => p.isoWeek !== isoWeek);
  fs.mkdirSync(metricsDir, { recursive: true });
  fs.writeFileSync(path.join(metricsDir, `${isoWeek}.json`), JSON.stringify(snapshot, null, 2));

  const table = renderTable(snapshot, prior);
  console.log(table);
  console.log(`\nSnapshot persisted: docs/dashboard/metrics/${isoWeek}.json`);

  if (makeReport) {
    const weeklyDir = path.resolve("docs/dashboard/weekly");
    fs.mkdirSync(weeklyDir, { recursive: true });
    const reportPath = path.join(weeklyDir, `${isoWeek}.md`);
    if (fs.existsSync(reportPath)) {
      console.log(
        `Weekly report already exists, not overwriting: docs/dashboard/weekly/${isoWeek}.md`
      );
    } else {
      const template = fs.readFileSync(path.resolve("docs/dashboard/weekly/TEMPLATE.md"), "utf8");
      fs.writeFileSync(
        reportPath,
        template.replaceAll("{{WEEK}}", isoWeek).replace("{{METRICS_TABLE}}", table)
      );
      console.log(
        `Weekly report scaffolded: docs/dashboard/weekly/${isoWeek}.md — fill in the narrative sections.`
      );
    }
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("metrics:weekly failed loudly (by design — no silent blanks):", err);
  process.exit(1);
});
