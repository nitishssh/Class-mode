# Over-Reliance Dashboard — Feature Plan

> **Status:** Phases 1–3 built, except the rollup table — measured and found unjustified (below).
> **Lineage:** the Phase-3 piece named "teacher-facing over-reliance dashboard" in
> [study-arena-inspired-by-openmaic.md](study-arena-inspired-by-openmaic.md) — **specced, not built**.
> **Payment-trigger check:** this does _not_ compete on model-interaction quality. It reads
> evidence we already write and turns it into a teacher artifact, so it is on the moat side of
> the freeze, alongside the `interaction_log` work already done pre-trigger.

---

## The problem

OpenMAIC's failure mode is the one our research flagged: the AI performs, the student watches,
and everyone _feels_ like learning happened. Our attempt-first inversion fixes the loop but not
the visibility — a teacher still cannot answer **"which of my students is actually thinking, and
which is riding the hints?"**

Today the closest thing is `GET /api/study-arena-beta/assignments/:id/report`
(`server/routes/study-arena-beta.ts:779`, rendered by `client/src/pages/study-arena-report.tsx`).
It is a **single-assignment snapshot**. Over-reliance is a _pattern across assignments and time_:
one lesson where a student leaned on hints is noise; four in a row is the signal.

---

## What we already have (do not rebuild)

| Asset                                                                                                                 | Where                              | Use                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `study_arena_evidence_events` (`attempt` / `hint` / `assessment` / `intervention`, with `action_index` + `objective`) | `scripts/pg-schema.sql:1030`       | The entire data source. No new event kinds needed.                                                              |
| `study_arena_assessment_evaluations.correct` + `misconception_code`                                                   | schema                             | Independent-transfer outcome per session.                                                                       |
| `study_arena_intervention_actions` (`cohort_key`, `action_note`)                                                      | schema + route `:879`              | Teacher follow-up logging — reuse verbatim.                                                                     |
| Cohort keys `failed_transfer`, `high_help`, **`prerequisite_gap`**, **`recall_overdue`**                              | `interventionSchema`, route `:106` | Two are already accepted by the write path but **never produced** by any read path. This feature produces them. |
| `learner_mastery` / due-review rows                                                                                   | `server/lib/ai/learner-model.ts`   | Feeds `prerequisite_gap` and `recall_overdue`.                                                                  |
| `AUTHORING_ROLES` + `requireFlag` (`STUDY_ARENA_BETA`)                                                                | route `:62`, `:171`                | Auth + flag gating, unchanged.                                                                                  |

**Net new code is one read model, one endpoint, one page.** No schema migration in Phase 1.

---

## Bug to fix first (blocks the metric) — **FIXED**

Route `:779` computes `help_depth` as:

```sql
count(*) ... WHERE event_kind IN ('attempt', 'hint')
```

That counts attempts _and_ hints, so a student who attempted four times unaided and took zero
hints scores `help_depth = 4` and lands in the "High help depth" cohort — the exact inverse of
the intended meaning. The same `IN ('attempt','hint')` count appears at
`server/services/study-arena/assignment-sessions.ts:401` and `:811`; audit whether those two are
also meant to be help-only or genuinely "total interactions" before changing them.

Every number below is wrong until this is corrected, so it is step 1, with a regression test.

**Resolved.** All three sites feed a value named `helpDepth` into `getRecommendedNextAction`
(`adaptive-policy.ts:13`, threshold `>= 3`) or `resolveNextScene`, so all three meant hints and
all three overcounted; all three now filter `event_kind = 'hint'`. The blast radius was wider than
the report: a student who simply attempted three times unaided was being routed to
`supported_retry` by the adaptive policy. Regression tests in
`server/tests/study_arena_beta_route.test.ts`.

---

## The metric: Reliance Index

Per `(student, assignment)`, from evidence events ordered by `action_index`:

- `attempts` = count of `attempt` events
- `hints` = count of `hint` events
- `hint_first` = number of gates where a `hint` precedes any `attempt` at that `action_index`
  — **the load-bearing signal.** Taking a hint _after_ trying is productive struggle; taking one
  _before_ is offloading.
- `transfer` = latest `study_arena_assessment_evaluations.correct` for the session

```
reliance = (0.6 * hint_first_rate) + (0.4 * hint_per_attempt_rate)   # 0..1, higher = more reliant
```

Reported alongside `transfer`, never instead of it. The cell that matters to a teacher is
**high reliance + failed transfer**: the student cannot do it alone and knows it.
**Low reliance + failed transfer** is a different problem (a gap, not a crutch) and routes to
`prerequisite_gap`.

Suppress the index below 3 gates of evidence — show "not enough evidence" rather than a
confident wrong number. This is a teacher-facing judgement about a child; a noisy score here
costs more trust than a blank cell.

---

## Scope

### Phase 1 — Cross-assignment reliance view (the deliverable) — **BUILT**

Shipped: `server/services/study-arena/reliance-model.ts` (pure `buildRelianceModel` +
`getRelianceCohorts` query), `GET /api/study-arena-beta/reliance`,
`client/src/pages/study-arena-reliance.tsx` at `/study-arena-reliance`, linked from the report
page. `latestAssignmentId` was added to each student row so follow-up still writes through the
existing per-assignment interventions endpoint. No schema change, as planned.

1. **Fix `help_depth`** + regression test (above).
2. **`server/services/study-arena/reliance-model.ts`** — pure read model:
   `getRelianceCohorts(workspaceId, { classId?, subject?, sinceDays = 30 })`.
   One SQL pass over `study_arena_evidence_events` joined to assignments/sessions/evaluations,
   window-functioned by `action_index` for `hint_first`. Workspace-scoped in the query itself,
   like every other query in this route file.
3. **`GET /api/study-arena-beta/reliance`** — `requireFlag` + `AUTHORING_ROLES`, returns
   `{ students[], cohorts[], windowDays, insufficientEvidence[] }`. Reuses the existing
   403/409/503 shape from the report route.
4. **`client/src/pages/study-arena-reliance.tsx`** — student rows (name, gates, reliance, transfer,
   trend arrow over last N assignments), sortable by reliance; cohort cards reusing the
   report page's follow-up affordance, which POSTs to the **existing** interventions endpoint.
   Register in `client/src/App.tsx` beside `/study-arena-report` (keep the route-list comment at
   `App.tsx:213` in step, as it instructs).
5. Link from `study-arena-report.tsx` ("see this student across assignments") and from
   `educator/dashboard.tsx`.

### Phase 2 — The two dormant cohorts — **BUILT**

Both cohorts now produce, and both reuse the player's own thresholds, exported from
`adaptive-policy.ts` (`MASTERED_THRESHOLD` 0.7, `WEAK_PREREQUISITE_THRESHOLD` 0.4) rather than a
second set of constants — a student the player routed to `prerequisite_refresh` is the student
the dashboard calls a prerequisite gap.

Two judgement calls worth knowing:

- **`prerequisite_gap` claims the student from `failed_transfer`.** A named prerequisite is the
  more actionable diagnosis, and two overlapping lists of the same child is work a teacher has to
  reconcile by hand. Failed transfer now means "failed, and mastery does not explain why".
- **The rows carry concept names**, not just cohort membership: `prerequisiteGapConcepts` and
  `recallOverdueConcepts` per student, shown on the cohort card and in a table column. A cohort
  says who; the concept says what to reteach.
- **Unknown mastery is never a gap.** A student with no `learner_mastery` row stays in
  `failed_transfer`; absence of evidence is not evidence of a gap.
- **`recall_overdue` requires `repetitions > 0`.** A `review_schedule` row defaults `due_at` to
  `now()`, so a never-reviewed concept is perpetually "due" — that would have flagged everyone.

**Scope limit:** the window only sees students with attempt evidence in it, so a student who
mastered a concept and has since done nothing will not appear as recall-overdue. Widening that
means reading the review schedule independently of the evidence window — Phase 3 territory.

### Phase 2 — original spec

`prerequisite_gap` (low reliance + failed transfer + weak `learner_mastery` on the lesson's
`primary_concept_id`) and `recall_overdue` (mastered once, now past SM-2 `due_at`). Both write
through the existing interventions endpoint. Needs no schema change either.

### Phase 3 — **BUILT, minus the rollup**

**The rollup table was measured, not built.** The plan gated it on adoption, so it was measured
before writing any of it: 400 students, 20 assignments, 480k evidence events, two years of
history (an implausibly heavy single school), 5 runs per window.

| Window  | Median | Students |
| ------- | ------ | -------- |
| 7 days  | 63 ms  | 402      |
| 30 days | 227 ms | 404      |
| 90 days | 266 ms | 404      |

A covering index on `(workspace_id, created_at)` was tried and **removed**: identical timings, so
the cost is aggregating the rows inside the window, not finding them — and an index that does not
pay for itself still taxes every evidence write on a hot append path. At ~230 ms for a page a
teacher opens a few times a day, a nightly rollup would add a table, a job, and a staleness
window to save nothing anyone can feel. Revisit if a single workspace exceeds roughly 2k students
or the window widens past 90 days.

**Built instead:**

1. **Recall-overdue now reads independently of the evidence window.** The scope limit flagged at
   the end of Phase 2 was real: the student most likely to be forgetting is the one who has _not_
   opened a lesson recently, so an in-window read structurally cannot see them. A second query
   walks the review schedule for students enrolled in this workspace, and they join the model with
   `gates: 0`, `reliance: null`, `latestAssignmentId: null`. Verified: a student with zero
   evidence events now surfaces under `recall_overdue`.
2. **Weekly digest line** in `scripts/metrics-weekly.ts`: hint-first gates as a rate, plus how many
   students were mostly hint-first. It mirrors the dashboard's definition, excludes preview
   sessions, and renders a small-but-real rate as `<1%` rather than `0%` — on that instrument a
   zero is a claim ("nobody offloaded"), and rounding one into existence is the same dishonesty as
   substituting a blank for an error.

**One defect the scale run exposed**, introduced in Phase 1: recording a cohort follow-up fired one
POST per student in a single `Promise.all`. Harmless for the four-student fixture, 400 parallel
requests for a real year group. It now walks in batches of 8 and reports how many actually landed.

### Phase 3 — original spec

Only if teachers use Phase 1: a nightly rollup table so the window is not recomputed per page
load, and a weekly digest via `scripts/metrics-weekly.ts`.

### Explicitly out of scope

Student-facing reliance scores (a "you're too reliant" badge is a shaming mechanic, and it
teaches gaming the hint button rather than thinking); parent-facing exposure; any change to
the lesson player, the director, or scene generation; anything requiring an LLM call.

---

## QA against a seeded database

Phase 1 was verified against a real Postgres (`npm run migrate` + `seed-pilot` + the fixture at
`scripts/qa-study-arena-reliance-fixture.sql`), not just mocks. What the run proved:

| Case                                                 | Result                                                                 |
| ---------------------------------------------------- | ---------------------------------------------------------------------- |
| Attempts only, 10 attempts / 0 hints                 | reliance 0 — the pre-fix code would have called this maximally reliant |
| Hint before attempt at every gate                    | reliance 1.0, in the high-help cohort                                  |
| Same hint count taken _after_ attempting             | reliance 0.4, **not** in the cohort                                    |
| Attempted unaided, still failed transfer             | `failed_transfer` only — a gap, not a crutch                           |
| 2 gates of evidence                                  | score withheld, listed in `insufficientEvidence`                       |
| Improving student across two lessons                 | trend −0.75                                                            |
| Assignment 200 days old                              | excluded; `sinceDays` clamps to the 90-day cap                         |
| `classId` / `subject` filters                        | narrow correctly                                                       |
| Second workspace's evidence                          | never appears in workspace 1's read                                    |
| Follow-up POST on another tenant's assignment        | 404, nothing written                                                   |
| **Phase 2:** failed transfer + mastery 0.2           | `prerequisite_gap`, concept named, removed from `failed_transfer`      |
| **Phase 2:** mastered 0.9, review 4 days overdue     | `recall_overdue`                                                       |
| **Phase 2:** mastered 0.85, review due in 4 days     | not flagged                                                            |
| **Phase 2:** past due but `repetitions = 0`          | not flagged                                                            |
| **Phase 2:** follow-up POST with each new cohort key | 201, rows written                                                      |

**One bug found and fixed by this run:** the query counted _teacher preview_ sessions as learner
evidence, so a teacher walking their own lesson appeared in their class's reliance list at
reliance 1.0. The player declines to write preview evidence, so this was unreachable in
production today — but the read model should not depend on the writer for tenant hygiene. The
`scoped` CTE now joins `study_arena_attempt_sessions ... is_preview = false`.

Response codes exercised over HTTP: 200 (teacher), 401 (anonymous), 409 (no active workspace),
400 (`sinceDays` over the cap, non-numeric), 201 + row written (follow-up), 404 (cross-tenant
follow-up).

## Risks

- **Wrong-metric risk.** Reliance is inferred, not observed. Mitigations: the ≥3-gate floor, always
  pairing it with transfer, and the word "suggested" on every cohort action — the existing report
  page's `suggestedAction` framing.
- **Surveillance framing.** Present it as _"where should I spend the next 20 minutes"_, not a
  ranking. Sort default = highest reliance, but no rank numbers, no scores in exports.
- **Cost of the window query.** 30 days × a class is small; the risk is a workspace-wide unbounded
  window. Cap `sinceDays` at 90 server-side and require `classId` or `subject` above a row
  threshold.

## Test plan

- Unit: `hint_first` ordering (hint→attempt vs attempt→hint at the same `action_index`), the ≥3-gate
  suppression, the `help_depth` regression.
- Route: 403 for students, 409 with no workspace, 503 when PG is down, cross-workspace isolation
  (a second workspace's evidence must not appear) — mirroring `server/tests/study_arena_beta_route.test.ts`.
- E2E: teacher opens the page from the report, records a follow-up, sees it persist.

## Definition of done

A teacher with ≥3 published assignments opens one page, sees which students are riding hints
across those assignments (not one), records a follow-up against a cohort, and that follow-up
lands in `study_arena_intervention_actions`. Flag-gated behind `STUDY_ARENA_BETA` like the rest.
