import { describe, it, expect } from "vitest";
import {
  METRIC_VERSION,
  isoWeekOf,
  previousIsoWeek,
  weekIsComplete,
  zonedMidnightInstant,
  zonedYmd,
  partitionByVersion,
  selectBaseline,
  selectPreviousWeek,
  resolveTimezone,
  evaluateThreshold,
  BREACH_FRACTION,
  DEFAULT_METRICS_TIMEZONE,
} from "../../scripts/metric-semantics";

const IST = "Asia/Kolkata";

/**
 * The frozen measurement rules. These are not incidental helpers — each one
 * decides a number the pilot's continue/kill decision is read from, so each
 * failure mode below is a way the experiment silently lies.
 */

describe("week boundary is evaluated in the reporting timezone", () => {
  it("counts an early-Monday IST mark as Monday, not the previous week", () => {
    // 19:00Z Sunday is 00:30 IST Monday. Under UTC-midnight boundaries this
    // teacher's first mark of the week lands in the PREVIOUS week, understating
    // Monday and inflating the week before it.
    const at = new Date("2026-08-16T19:00:00Z");

    expect(zonedYmd(at, IST)).toBe("2026-08-17");
    expect(isoWeekOf(at, IST).weekStart).toBe("2026-08-17");
    expect(isoWeekOf(at, "UTC").weekStart).toBe("2026-08-10");
  });

  it("puts late-Sunday-night IST in the week that is ending", () => {
    const at = new Date("2026-08-16T18:00:00Z"); // 23:30 IST Sunday
    expect(zonedYmd(at, IST)).toBe("2026-08-16");
    expect(isoWeekOf(at, IST).weekStart).toBe("2026-08-10");
  });

  it("derives local midnight as a real instant", () => {
    // IST is UTC+5:30, so local midnight is 18:30Z the previous day.
    expect(zonedMidnightInstant("2026-08-17", IST).toISOString()).toBe("2026-08-16T18:30:00.000Z");
    expect(zonedMidnightInstant("2026-08-17", "UTC").toISOString()).toBe(
      "2026-08-17T00:00:00.000Z"
    );
  });

  it("rejects an invalid timezone rather than measuring against an undefined week", () => {
    const prev = process.env.METRICS_TIMEZONE;
    process.env.METRICS_TIMEZONE = "Mars/Olympus_Mons";
    expect(() => resolveTimezone()).toThrow(/not a valid IANA timezone/);
    process.env.METRICS_TIMEZONE = prev;
  });

  it("defaults to the schools' timezone", () => {
    const prev = process.env.METRICS_TIMEZONE;
    delete process.env.METRICS_TIMEZONE;
    expect(resolveTimezone()).toBe(DEFAULT_METRICS_TIMEZONE);
    if (prev !== undefined) process.env.METRICS_TIMEZONE = prev;
  });
});

describe("partial weeks", () => {
  const week = isoWeekOf(new Date("2026-08-19T12:00:00Z"), IST); // Wed of 2026-W34

  it("is incomplete while the week is still running", () => {
    expect(weekIsComplete(week, new Date("2026-08-19T12:00:00Z"), IST)).toBe(false);
  });

  it("is complete only once local midnight of weekEnd has passed", () => {
    const boundary = zonedMidnightInstant(week.weekEnd, IST);
    expect(weekIsComplete(week, new Date(boundary.getTime() - 1), IST)).toBe(false);
    expect(weekIsComplete(week, boundary, IST)).toBe(true);
  });
});

describe("ISO week adjacency", () => {
  it("names the immediately preceding week", () => {
    const w = isoWeekOf(new Date("2026-08-19T12:00:00Z"), IST);
    expect(previousIsoWeek(w, IST)).toBe(isoWeekOf(new Date("2026-08-12T12:00:00Z"), IST).isoWeek);
  });

  it("crosses a year boundary without inventing a week", () => {
    const w = isoWeekOf(new Date("2027-01-06T12:00:00Z"), IST);
    const prev = previousIsoWeek(w, IST);
    expect(prev).toBe(isoWeekOf(new Date("2026-12-30T12:00:00Z"), IST).isoWeek);
    expect(prev).not.toBe(w.isoWeek);
  });
});

describe("baseline selection", () => {
  const snap = (
    isoWeek: string,
    activeTeachers: number,
    complete: boolean,
    version = METRIC_VERSION
  ) => ({
    isoWeek,
    metricVersion: version,
    complete,
    attendance: { activeTeachers },
  });

  it("skips launch weeks with no activity", () => {
    // Anchoring on the first snapshot regardless pins the bar at 0, and
    // 0 * 0.5 = 0 can never be breached — the kill switch never fires.
    const priors = [snap("2026-W29", 0, true), snap("2026-W30", 4, true)];
    expect(selectBaseline(priors)?.isoWeek).toBe("2026-W30");
  });

  it("refuses a partial week even when it has activity", () => {
    // A Tuesday snapshot of the first active week understates the bar
    // permanently — disarming the threshold just as effectively, but quietly.
    const priors = [snap("2026-W30", 2, false), snap("2026-W31", 6, true)];
    expect(selectBaseline(priors)?.isoWeek).toBe("2026-W31");
  });

  it("returns nothing when every candidate is partial", () => {
    expect(selectBaseline([snap("2026-W30", 5, false)])).toBeUndefined();
  });
});

describe("previous-week selection for the 2-consecutive-week breach", () => {
  const current = isoWeekOf(new Date("2026-08-19T12:00:00Z"), IST);
  const prevLabel = previousIsoWeek(current, IST);
  const snap = (isoWeek: string, complete: boolean) => ({
    isoWeek,
    metricVersion: METRIC_VERSION,
    complete,
    attendance: { activeTeachers: 1 },
  });

  it("accepts the immediately preceding complete week", () => {
    expect(selectPreviousWeek([snap(prevLabel, true)], current, IST)?.isoWeek).toBe(prevLabel);
  });

  it("refuses to compare across a gap", () => {
    // priors[length-1] is merely the most recent snapshot — it can be months
    // old, and calling that "2 consecutive weeks" is a fabricated breach.
    expect(selectPreviousWeek([snap("2026-W20", true)], current, IST)).toBeUndefined();
  });

  it("refuses a partial previous week", () => {
    expect(selectPreviousWeek([snap(prevLabel, false)], current, IST)).toBeUndefined();
  });
});

describe("cross-version quarantine", () => {
  it("quarantines snapshots measured under different rules", () => {
    const all = [
      { isoWeek: "2026-W29", attendance: { activeTeachers: 0 } }, // pre-freeze, unversioned
      {
        isoWeek: "2026-W30",
        metricVersion: METRIC_VERSION,
        complete: true,
        attendance: { activeTeachers: 3 },
      },
      {
        isoWeek: "2026-W31",
        metricVersion: METRIC_VERSION + 99,
        complete: true,
        attendance: { activeTeachers: 9 },
      },
    ];
    const { compatible, quarantined } = partitionByVersion(all);
    expect(compatible.map((s) => s.isoWeek)).toEqual(["2026-W30"]);
    expect(quarantined.map((s) => s.isoWeek)).toEqual(["2026-W29", "2026-W31"]);
  });

  it("never lets a quarantined snapshot become the baseline", () => {
    const all = [
      { isoWeek: "2026-W29", attendance: { activeTeachers: 12 } }, // unversioned, high count
      {
        isoWeek: "2026-W30",
        metricVersion: METRIC_VERSION,
        complete: true,
        attendance: { activeTeachers: 3 },
      },
    ];
    const { compatible } = partitionByVersion(all);
    expect(selectBaseline(compatible)?.isoWeek).toBe("2026-W30");
  });
});

describe("the kill switch", () => {
  // The most consequential arithmetic in the repo: it decides whether the pilot
  // continues. It previously lived inside a module-private render function
  // where nothing could test it.
  const baseline = { isoWeek: "2026-W30", attendance: { activeTeachers: 10 } };

  it("stays disarmed until a baseline exists", () => {
    const v = evaluateThreshold({
      currentIsoWeek: "2026-W31",
      currentActiveTeachers: 0,
      baseline: undefined,
      previous: { attendance: { activeTeachers: 0 } },
    });
    expect(v.state).toBe("not_armed");
  });

  it("does not fire on the baseline week itself", () => {
    const v = evaluateThreshold({
      currentIsoWeek: "2026-W30",
      currentActiveTeachers: 1,
      baseline,
      previous: { attendance: { activeTeachers: 1 } },
    });
    expect(v.state).toBe("not_armed");
  });

  it("disarms rather than comparing across a gap", () => {
    const v = evaluateThreshold({
      currentIsoWeek: "2026-W40",
      currentActiveTeachers: 0,
      baseline,
      previous: undefined,
    });
    expect(v.state).toBe("not_armed");
    expect(v).toMatchObject({ reason: expect.stringContaining("adjacency") });
  });

  it("warns on the first week below the bar, does not breach", () => {
    const v = evaluateThreshold({
      currentIsoWeek: "2026-W31",
      currentActiveTeachers: 4, // bar is 5
      baseline,
      previous: { attendance: { activeTeachers: 9 } },
    });
    expect(v).toEqual({ state: "warn", bar: 5 });
  });

  it("breaches only on two consecutive weeks below the bar", () => {
    const v = evaluateThreshold({
      currentIsoWeek: "2026-W31",
      currentActiveTeachers: 4,
      baseline,
      previous: { attendance: { activeTeachers: 3 } },
    });
    expect(v).toEqual({ state: "breached", bar: 5 });
  });

  it("treats exactly-at-the-bar as not below", () => {
    // 50% of baseline is the floor, not a breach. An off-by-one here fires the
    // kill switch on a school that is holding steady at half.
    const v = evaluateThreshold({
      currentIsoWeek: "2026-W31",
      currentActiveTeachers: 5,
      baseline,
      previous: { attendance: { activeTeachers: 5 } },
    });
    expect(v).toEqual({ state: "ok", bar: 5 });
  });

  it("uses the documented 50% fraction", () => {
    expect(BREACH_FRACTION).toBe(0.5);
  });
});
