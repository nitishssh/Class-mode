import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { connectPostgres, getPgPool } from "../server/db-pg";

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
    `SELECT COUNT(DISTINCT marked_by) FILTER (WHERE marked_by IS NOT NULL)::int AS active_teachers,
            COUNT(*)::int                                                       AS rows_written,
            COUNT(DISTINCT (school_code, class_name, date))::int                AS class_days_marked,
            COUNT(DISTINCT date)::int                                           AS distinct_school_days
       FROM attendance
      WHERE date >= $1::date AND date < $2::date
        AND school_code IS NOT NULL
        AND school_code NOT LIKE 'E2E%'`,
    [weekStart, weekEnd]
  );

  const [fee] = await q(
    `SELECT COUNT(DISTINCT created_by) FILTER (WHERE created_by IS NOT NULL)::int AS active_staff,
            COUNT(*)::int                                                          AS rows_created
       FROM fees
      WHERE created_at >= $1 AND created_at < $2
        AND school_code IS NOT NULL
        AND school_code NOT LIKE 'E2E%'`,
    [weekStart, weekEnd]
  );

  const usage = await q(
    `SELECT feature,
            COUNT(*)::int                 AS events,
            COUNT(DISTINCT user_id)::int  AS distinct_users
       FROM feature_usage
      WHERE created_at >= $1 AND created_at < $2
        AND school_code IS NOT NULL
        AND school_code NOT LIKE 'E2E%'
      GROUP BY feature
      ORDER BY events DESC`,
    [weekStart, weekEnd]
  );

  const [totals] = await q(
    `SELECT COUNT(*)::int                                        AS users,
            COUNT(*) FILTER (WHERE role = 'teacher')::int        AS teachers,
            COUNT(*) FILTER (WHERE role = 'student')::int        AS students
       FROM users
      WHERE school_code IS NULL OR school_code NOT LIKE 'E2E%'`
  );

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
  lines.push("");

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
