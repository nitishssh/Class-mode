# Over-Reliance Dashboard — Feature Plan

> **Status:** Phase 1 built (help_depth fix + reliance read model, endpoint, page). Phases 2–3 open.
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

### Phase 2 — The two dormant cohorts

`prerequisite_gap` (low reliance + failed transfer + weak `learner_mastery` on the lesson's
`primary_concept_id`) and `recall_overdue` (mastered once, now past SM-2 `due_at`). Both write
through the existing interventions endpoint. Needs no schema change either.

### Phase 3 — Trend durability

Only if teachers use Phase 1: a nightly rollup table so the window is not recomputed per page
load, and a weekly digest via `scripts/metrics-weekly.ts`.

### Explicitly out of scope

Student-facing reliance scores (a "you're too reliant" badge is a shaming mechanic, and it
teaches gaming the hint button rather than thinking); parent-facing exposure; any change to
the lesson player, the director, or scene generation; anything requiring an LLM call.

---

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
