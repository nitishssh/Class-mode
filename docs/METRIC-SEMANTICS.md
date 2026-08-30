# Metric semantics — frozen contract

**Version 1. Frozen 2026-08-19, before the 30-school-day streak clock starts on 8 September.**

Source of truth: `scripts/metric-semantics.ts`. This document explains the rules and why each one exists; the code is what runs. If they disagree, the code is right and this file is stale — fix it.

## Why freeze

The streak and the 30 September adoption gate are an experiment. Six choices decide every number it produces: cohort, timezone, week boundary, baseline, adjacency, and how partial weeks are treated. Change one while the experiment runs and every comparison against earlier weeks silently means something different — the redefinition shows up as a trend.

So the rules are versioned. Every snapshot records the version it was measured under, and snapshots from a different version are **quarantined, never compared**.

**Changing any rule below requires bumping `METRIC_VERSION`.** That is the point: the bump makes the discontinuity visible instead of letting it masquerade as movement.

## The rules

| Rule                   | Definition                                                                                                                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Week boundary**      | ISO-8601 week. Monday 00:00 inclusive → following Monday 00:00 exclusive, evaluated in the **reporting timezone**, not UTC.                                                            |
| **Reporting timezone** | `METRICS_TIMEZONE`, default `Asia/Kolkata`. An invalid value aborts the run.                                                                                                           |
| **Cohort**             | Rows with a non-NULL `school_code` not beginning with `E2E`. With `PILOT_SCHOOL_CODE` set, exactly that school. Platform-admin actors are excluded from every activity metric.         |
| **Active teacher**     | A distinct `users.id` with `role='teacher'` that authored a domain row inside the week. Attendance is dated by `attendance.date` — the school day described, not the day it was typed. |
| **Adoption gate**      | Share of teacher accounts in cohort recording ≥4 distinct marking days in the week, from the **append-only** `feature_usage` log.                                                      |
| **Baseline**           | The first **complete** week with `activeTeachers > 0`.                                                                                                                                 |
| **Adjacency**          | The 2-consecutive-week breach requires the compared week to be the immediately preceding ISO week **and** complete.                                                                    |
| **Partial weeks**      | A snapshot generated before its week ends is `complete: false`. Persisted, but never eligible as a baseline or as the prior week.                                                      |
| **Cross-version**      | Different `metricVersion` ⇒ quarantined.                                                                                                                                               |

## Why each rule is written that way

**Timezone.** IST is UTC+05:30, so under UTC-midnight boundaries a teacher marking the register at 08:00 IST on Monday is recorded in the _previous_ week — for the first 5½ hours of every Monday. That both understates Monday and inflates the week before it, on the exact metric the Sep-30 gate reads. The per-teacher day buckets in the adoption matrix are bucketed in the reporting timezone for the same reason.

**Baseline skips zero-activity weeks.** Anchoring on the first snapshot regardless pins the bar at zero, and `0 × 0.5 = 0` can never be breached. The kill switch would be permanently disarmed.

**Baseline skips partial weeks.** A Tuesday snapshot of the first active week understates the bar permanently — disarming the threshold just as effectively as the zero case, but far less visibly. There was already one such artifact on disk (`2026-W29.json`, generated on a Wednesday) before this freeze.

**Adjacency.** `priors[priors.length - 1]` is merely the most recent snapshot; it can be months old. Calling that "2 consecutive weeks below baseline" reports a breach that never happened. Without an adjacent complete week the check is disarmed and says so.

**Cohort integrity.** A `PILOT_SCHOOL_CODE` matching no school makes every scoped query return 0 — and 0 is indistinguishable from "the school did nothing". A typo would read as total adoption failure. The run aborts instead.

## Operating notes

- **Never run against a non-production database without `--dry-run`.** A snapshot written from a QA or local database joins the trend, and afterwards there is no way to tell which rows produced it.
- Re-running after a week closes supersedes that week's partial snapshot.
- Quarantined snapshots cannot be repaired by re-stamping: the rules that produced them are unknown, and the queries are live, so a past week cannot be recomputed. They remain as historical record only.

## Known gaps at v1

- `schools.is_synthetic` does not exist yet; the cohort filter still uses the `E2E%` prefix heuristic. A real school whose code begins with those characters would be excluded from adoption metrics. Closing this needs the versioned migration ledger first — both are tracked in `TODOS.md`.
- Fees have no domain date, so fee metrics use `created_at` rather than a school-day date.
