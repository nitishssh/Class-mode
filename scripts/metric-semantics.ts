/**
 * FROZEN METRIC SEMANTICS — the measurement contract.
 *
 * The 30-school-day streak and the Sep-30 adoption gate are an experiment. An
 * experiment whose rules move while it runs produces a number nobody can act
 * on: cohort, timezone, week boundary, adjacency, baseline and partial-week
 * handling each change the answer, and changing one mid-flight silently
 * rewrites every comparison against earlier weeks.
 *
 * So the rules live here, versioned. Every persisted snapshot carries the
 * version it was measured under, and snapshots measured under a different
 * version are never compared against the current one — they are quarantined
 * loudly instead.
 *
 * CHANGING ANY RULE BELOW REQUIRES BUMPING `METRIC_VERSION`. That is the whole
 * point: a bump makes the discontinuity visible in the report instead of
 * letting a redefinition masquerade as a trend.
 */

/** Bump when any rule in METRIC_SEMANTICS changes. */
export const METRIC_VERSION = 1;

/**
 * Reporting timezone. Schools are in India; a teacher marking the register at
 * 08:00 IST on Monday is marking on Monday, not on Sunday. UTC-midnight week
 * boundaries put IST Monday 00:00–05:30 in the previous week.
 */
export const DEFAULT_METRICS_TIMEZONE = "Asia/Kolkata";

export function resolveTimezone(): string {
  const tz = process.env.METRICS_TIMEZONE?.trim() || DEFAULT_METRICS_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    throw new Error(
      `METRICS_TIMEZONE is not a valid IANA timezone: ${tz}. ` +
        `Refusing to measure against an undefined week boundary.`
    );
  }
  return tz;
}

/** The frozen rules, recorded in every snapshot so a reader can audit them. */
export const METRIC_SEMANTICS = {
  version: METRIC_VERSION,
  weekBoundary:
    "ISO-8601 week, Monday 00:00 inclusive to the following Monday 00:00 exclusive, " +
    "evaluated in the reporting timezone (not UTC).",
  cohort:
    "Rows whose school_code is non-NULL and does not begin with 'E2E'. When " +
    "PILOT_SCHOOL_CODE is set, exactly that school. Platform-admin actors are " +
    "excluded from every activity metric.",
  activeTeacher:
    "A distinct users.id with role='teacher' that authored a domain row inside " +
    "the week. Attendance is dated by attendance.date (the school day described), " +
    "not by when it was typed.",
  adoptionGate:
    "Sep-30 gate: share of teacher accounts in cohort that recorded >=4 distinct " +
    "marking days in the week, derived from the append-only feature_usage log.",
  baseline:
    "The FIRST COMPLETE week with activeTeachers > 0. Partial weeks are never " +
    "eligible — a mid-week snapshot understates the bar permanently.",
  adjacency:
    "The 2-consecutive-week breach requires the compared week to be the " +
    "immediately preceding ISO week AND complete. A gap disarms the check " +
    "rather than comparing across it.",
  partialWeeks:
    "A snapshot generated before its week has ended is marked complete=false. " +
    "It is persisted (so the run is not lost) but is excluded from baseline " +
    "selection and from the breach check until re-run after the week closes.",
  crossVersion: "Snapshots carrying a different metricVersion are quarantined, never compared.",
} as const;

// ── Timezone-aware calendar helpers ──────────────────────────────────────────

/** Offset of `tz` from UTC at instant `at`, in milliseconds. */
function tzOffsetMs(at: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, number> = {};
  for (const { type, value } of dtf.formatToParts(at)) {
    if (type !== "literal") p[type] = Number(value);
  }
  // Intl renders hour 24 for midnight under hour12:false in some ICU versions.
  const hour = p.hour === 24 ? 0 : p.hour;
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, hour, p.minute, p.second);
  return asUtc - at.getTime();
}

/** Calendar date (YYYY-MM-DD) that instant `at` falls on, in `tz`. */
export function zonedYmd(at: Date, tz: string): string {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return dtf.format(at);
}

/**
 * The UTC instant of local midnight starting `ymd` in `tz`.
 *
 * Two-step: guess UTC midnight, then correct by the zone's offset at that
 * instant. Exact for fixed-offset zones (IST). In a DST zone a transition
 * landing exactly at midnight could be off by the transition amount; India
 * observes no DST, and the reporting timezone is an explicit operator choice.
 */
export function zonedMidnightInstant(ymd: string, tz: string): Date {
  const guess = new Date(`${ymd}T00:00:00Z`);
  return new Date(guess.getTime() - tzOffsetMs(guess, tz));
}

export interface IsoWeek {
  isoWeek: string; // 2026-W34
  weekStart: string; // YYYY-MM-DD, inclusive, local Monday
  weekEnd: string; // YYYY-MM-DD, exclusive, next local Monday
}

/** The ISO week containing instant `at`, evaluated in `tz`. */
export function isoWeekOf(at: Date, tz: string): IsoWeek {
  const [y, m, d] = zonedYmd(at, tz).split("-").map(Number);
  // Calendrical arithmetic only — anchor on a UTC date so no zone maths leaks in.
  const local = new Date(Date.UTC(y, m - 1, d));
  const dow = (local.getUTCDay() + 6) % 7; // Mon=0
  const start = new Date(local);
  start.setUTCDate(local.getUTCDate() - dow);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  const thursday = new Date(start);
  thursday.setUTCDate(start.getUTCDate() + 3);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const ymd = (x: Date) => x.toISOString().slice(0, 10);
  return {
    isoWeek: `${thursday.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`,
    weekStart: ymd(start),
    weekEnd: ymd(end),
  };
}

/** The ISO week immediately before `isoWeek`, by label. */
export function previousIsoWeek(week: IsoWeek, tz: string): string {
  const prevStart = new Date(`${week.weekStart}T00:00:00Z`);
  prevStart.setUTCDate(prevStart.getUTCDate() - 7);
  // Midday avoids any boundary ambiguity when re-deriving the label.
  return isoWeekOf(zonedMidnightInstant(prevStart.toISOString().slice(0, 10), tz), tz).isoWeek;
}

/** True once the week has actually ended in the reporting timezone. */
export function weekIsComplete(week: IsoWeek, now: Date, tz: string): boolean {
  return now.getTime() >= zonedMidnightInstant(week.weekEnd, tz).getTime();
}

// ── Snapshot selection rules ─────────────────────────────────────────────────

/** The subset of a snapshot these rules need. Keeps the helpers testable. */
export interface ComparableSnapshot {
  isoWeek: string;
  metricVersion?: number;
  complete?: boolean;
  attendance: { activeTeachers: number };
}

export interface Partitioned<T> {
  compatible: T[];
  quarantined: T[];
}

/**
 * Split snapshots into those measured under the current rules and those that
 * were not. Unversioned snapshots predate the freeze and are quarantined: we
 * cannot know which rules produced them, and guessing is how a redefinition
 * becomes an invisible trend.
 */
export function partitionByVersion<T extends ComparableSnapshot>(all: T[]): Partitioned<T> {
  const compatible: T[] = [];
  const quarantined: T[] = [];
  for (const s of all) (s.metricVersion === METRIC_VERSION ? compatible : quarantined).push(s);
  return { compatible, quarantined };
}

/**
 * Baseline = first COMPLETE week with real teacher activity.
 *
 * Two rules in one: anchoring on the first snapshot regardless of activity pins
 * the bar to launch-week zeros forever (0 * 0.5 = 0 is unbreachable, so the
 * kill switch never fires), and anchoring on a PARTIAL week understates the bar
 * permanently, which disarms it just as effectively but less visibly.
 */
export function selectBaseline<T extends ComparableSnapshot>(priors: T[]): T | undefined {
  return priors.find((p) => p.complete === true && p.attendance.activeTeachers > 0);
}

/**
 * Partial snapshots that WOULD have qualified as the baseline had they been
 * complete.
 *
 * Without this, the partial-week rule recreates the failure it exists to
 * prevent. Excluding partial weeks stops a mid-week snapshot from understating
 * the bar — but an operator who only ever runs mid-week produces nothing
 * complete, so `selectBaseline` returns undefined forever and the threshold
 * never arms. Silently, and looking exactly like a pilot that has not started
 * yet. Name them so a re-run is an obvious action rather than a guess.
 */
export function blockedBaselineCandidates<T extends ComparableSnapshot>(priors: T[]): T[] {
  if (selectBaseline(priors)) return [];
  return priors.filter((p) => p.complete !== true && p.attendance.activeTeachers > 0);
}

/**
 * The prior week eligible for the 2-consecutive-week breach check: it must be
 * the immediately preceding ISO week AND complete. `priors[priors.length - 1]`
 * is merely the most recent snapshot, which may be months earlier — comparing
 * against it reports a "2 consecutive week" breach across a gap.
 */
export function selectPreviousWeek<T extends ComparableSnapshot>(
  priors: T[],
  current: IsoWeek,
  tz: string
): T | undefined {
  const wanted = previousIsoWeek(current, tz);
  return priors.find((p) => p.isoWeek === wanted && p.complete === true);
}

// ── The decision itself ──────────────────────────────────────────────────────

/** Fraction of the baseline that weekly-active-teachers may fall to before the alarm. */
export const BREACH_FRACTION = 0.5;

/** Consecutive weeks below the bar required to declare adoption failing. */
export const BREACH_CONSECUTIVE_WEEKS = 2;

export type ThresholdVerdict =
  | { state: "not_armed"; reason: string }
  | { state: "ok"; bar: number }
  | { state: "warn"; bar: number }
  | { state: "breached"; bar: number };

/**
 * The kill switch: weekly-active-teachers below 50% of the baseline week for 2
 * consecutive weeks means adoption is failing and the plan says act rather than
 * average it away.
 *
 * Pure and exported because this is the single most consequential arithmetic in
 * the repo — it decides whether the pilot continues — and it previously lived
 * inside a module-private render function where nothing could test it.
 */
export function evaluateThreshold(args: {
  currentIsoWeek: string;
  currentActiveTeachers: number;
  baseline?: { isoWeek: string; attendance: { activeTeachers: number } };
  previous?: { attendance: { activeTeachers: number } };
}): ThresholdVerdict {
  const { currentIsoWeek, currentActiveTeachers, baseline, previous } = args;
  if (!baseline) {
    return {
      state: "not_armed",
      reason:
        "no COMPLETE baseline week with nonzero weekly-active-teachers yet — arms the week after the first full week of real teacher activity",
    };
  }
  if (baseline.isoWeek === currentIsoWeek) {
    return { state: "not_armed", reason: "this week IS the baseline week" };
  }
  const bar = baseline.attendance.activeTeachers * BREACH_FRACTION;
  if (!previous) {
    return {
      state: "not_armed",
      reason:
        "no complete snapshot for the immediately preceding ISO week — the 2-consecutive-week rule needs adjacency, and comparing across a gap would report a breach that never happened",
    };
  }
  const thisBelow = currentActiveTeachers < bar;
  const prevBelow = previous.attendance.activeTeachers < bar;
  if (thisBelow && prevBelow) return { state: "breached", bar };
  if (thisBelow) return { state: "warn", bar };
  return { state: "ok", bar };
}

// ── Cohort integrity ─────────────────────────────────────────────────────────

/**
 * Refuse to measure a cohort that does not exist.
 *
 * A PILOT_SCHOOL_CODE matching no school makes every scoped query return 0, and
 * 0 is indistinguishable from "the school did nothing" — a typo reads as total
 * adoption failure in the one report a payment conversation is based on.
 *
 * Takes a counting function rather than a pool so the rule is testable without
 * a database, and so this module stays free of server imports.
 */
export async function assertCohortExists(
  countSchoolsWithCode: (code: string) => Promise<number>,
  pilotSchoolCode: string | null
): Promise<void> {
  if (!pilotSchoolCode) return;
  const n = await countSchoolsWithCode(pilotSchoolCode);
  if (n === 0) {
    throw new Error(
      `PILOT_SCHOOL_CODE='${pilotSchoolCode}' matches no row in schools. ` +
        `Every scoped metric would return 0, which reads as "no adoption" rather ` +
        `than "wrong code". Fix the value or unset it.`
    );
  }
}
