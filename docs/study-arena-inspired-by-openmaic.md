<!-- /autoplan restore point: /Users/friday/.gstack/projects/NitishKumar-ai-Class-mode/main-autoplan-restore-20260721-003224.md -->

# Study Arena: Inspired by OpenMAIC, Not Copied

**Goal:** Replace the vendored OpenMAIC microservice (`features/ai-classroom/studyArena`)
with a lean, native implementation in _our_ stack — borrowing OpenMAIC's good ideas,
dropping its bloat, and fusing it with our **attempt-first** pedagogy so the classroom
makes students _think_, not just watch.

- **Upstream we're learning from:** [THU-MAIC/OpenMAIC](https://github.com/THU-MAIC/OpenMAIC) (MIT). See `features/ai-classroom/studyArena/NOTICE.md`.
- **Our stack:** Express/TS (`server/`), React + Vite (`client/`), Postgres. _Not_ Next.js.
- **Pedagogy anchor:** [docs/student-ai-problems-market-research.md](student-ai-problems-market-research.md) — passive lecture-playback is the pattern that _harms_ learning. We adapt OpenMAIC's engagement, not its passivity.

---

## The core insight

OpenMAIC is a brilliant **lecture-playback** engine: AI teachers + classmates perform a
scripted lesson (speak, draw, show slides) while the student watches. That polish is worth
borrowing — but "AI talks _at_ you" is exactly the cognitive-offloading trap our research
flagged. So the inspired-by version keeps the **multi-agent stage** and **rich scenes**, but
inverts the loop: **the lesson pauses and hands the next move to the student.** Same magic,
opposite pedagogy.

---

## Concept map: borrow / adapt / drop

OpenMAIC's internals (`features/ai-classroom/studyArena/lib/*`) mapped to our plan:

| OpenMAIC piece                                               | What it does                                               | Verdict            | Our lean version                                                                                                                     |
| ------------------------------------------------------------ | ---------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `lib/orchestration` (LangGraph multi-agent)                  | State machine sequencing teacher/TA/classmate turns        | **Adapt**          | A small TS orchestrator in `server/services/study-arena/` — no LangGraph dependency; a typed turn-planner that emits a scene script. |
| `lib/playback` (playback engine)                             | Drives lesson timeline + live interaction                  | **Adapt**          | A client-side `PlaybackController` that plays a scene script **and stops at interaction points**.                                    |
| `lib/action` (28+ action types)                              | speak, whiteboard draw/text/shape/chart, spotlight, laser… | **Borrow (trim)**  | Keep ~6 high-value actions: `speak`, `draw`, `write`, `highlight`, `showSlide`, `ask`. Drop laser/spotlight/etc.                     |
| `components/roundtable`                                      | Multi-agent discussion UI                                  | **Borrow**         | Reuse the _idea_ of 2–3 agents (Teacher, Curious Classmate, Coach) — rebuild as lightweight React components.                        |
| `components/scene-renderers`, `slide-renderer`, `whiteboard` | Render slides / board                                      | **Borrow**         | Reuse our existing whiteboard/TTS from the current AI classroom; render scenes natively.                                             |
| `lib/generation` + `app/api/generate-classroom`              | One-click lesson from topic/doc                            | **Adapt**          | A `generateLessonScript()` server service that returns our scene-script JSON.                                                        |
| `lib/pbl` + `app/api/pbl`                                    | Project-based learning                                     | **Defer**          | Phase 3 — valuable but not MVP.                                                                                                      |
| `app/api/quiz-grade`                                         | Quiz generation + grading                                  | **Borrow**         | We already have test-gen + `gradingService.ts`; reuse, don't re-add.                                                                 |
| `lib/export` (pptx/html)                                     | Export slides                                              | **Drop (for now)** | Nice-to-have; not core to learning.                                                                                                  |
| `lib/pdf` (MinerU parse), `app/api/parse-pdf`                | Document ingestion                                         | **Adapt**          | We have `ocr-scan` + upload; reuse our pipeline.                                                                                     |
| `lib/audio` + `app/api/transcription` (TTS/ASR)              | Voice in/out                                               | **Borrow**         | We already have TTS + Whisper ASR in the AI classroom — reuse.                                                                       |
| Next.js app shell, `copilotkit`, `@ag-ui/*`, Next API routes | Framework plumbing                                         | **Drop**           | Replaced by our Express + React/Vite stack. This is the bulk of the bloat removed.                                                   |
| `skills/iniclaw`, FridayLearning gateway                     | Chat-app integration (Feishu/Slack)                        | **Drop**           | Out of scope for us.                                                                                                                 |

**Net effect:** we keep the ~5 ideas that make OpenMAIC special and shed an entire Next.js
app, CopilotKit/AG-UI/LangGraph dependencies, and the chat-app gateway — all reimplemented
natively, all ours, no upstream drift.

---

## The one schema that makes it work: the Scene Script

Everything centers on a single JSON contract the server generates and the client plays.
This is the "inspired-by" distillation of OpenMAIC's action/playback engines.

```ts
// server/services/study-arena/types.ts
type AgentRole = "teacher" | "classmate" | "coach";

type SceneAction =
  | { type: "speak"; agent: AgentRole; text: string }
  | { type: "showSlide"; title: string; bullets: string[] }
  | { type: "write"; latex: string } // formula on the board
  | { type: "draw"; shape: "diagram"; spec: unknown }
  | { type: "highlight"; target: string } // attention signal, not a solution
  // ── the pedagogy inversion: playback BLOCKS here until the student acts ──
  | {
      type: "ask";
      agent: AgentRole;
      prompt: string;
      expects: "freeText" | "choice" | "work";
      gate: true;
    }; // student must respond to continue

interface LessonScript {
  topic: string;
  conceptIds: string[];
  scenes: { id: string; actions: SceneAction[] }[];
}
```

The `ask … gate:true` action is the whole point: OpenMAIC's timeline plays straight through;
**ours stops and won't continue until the student attempts.** That single field turns a
lecture into active learning — and it reuses the exact attempt-first principle we already
shipped in the AI Tutor.

---

## Architecture (native, no Next.js)

```
client/ (React + Vite)
  pages/study-arena.tsx ────────────► <ClassroomStage>
                                         ├─ <AgentRoundtable>   (Teacher / Classmate / Coach)
                                         ├─ <SceneRenderer>     (slide / whiteboard / formula)
                                         └─ PlaybackController  (plays script, HALTS on `ask.gate`)
                                                │  POST student response
                                                ▼
server/ (Express + TS)
  routes/ai-classroom.ts
    └─ services/study-arena/
         ├─ generateLessonScript()   → LessonScript JSON   (topic/doc → scenes)
         ├─ resolveInteraction()     → grades the gated answer, picks next scene
         └─ (reuses) gradingService, TTS, Whisper ASR, test-gen
  Postgres: lesson_scripts, classroom_sessions, interaction_log (mastery/over-reliance signals)
```

No new heavy deps. Reuses what we already built (gradingService, TTS/ASR, attempt-first tutor prompt).

---

## Phased migration (keep Study Arena working the whole time)

**Phase 0 — Stop the bleeding (today, ~30 min).** Done: `NOTICE.md` restores MIT attribution.
Decide MIT-vs-AGPL (see NOTICE). The vendored service keeps running untouched.

**Phase 1 — Native script player (MVP).** Build the `LessonScript` schema + a client
`PlaybackController` + `<ClassroomStage>` that renders `speak`/`showSlide`/`ask`. Server
`generateLessonScript()` produces a script from a topic. Wire it behind a feature flag next
to the existing OpenMAIC-powered Study Arena. **No multi-agent, no whiteboard yet** — just a
single teacher that lectures _and stops to ask_. This alone proves the inverted loop.

**Phase 2 — Multi-agent + board.** Add the Curious Classmate and Coach roles
(`AgentRoundtable`), the whiteboard/formula scenes (reuse current AI-classroom whiteboard),
and `resolveInteraction()` grading via our `gradingService`. Now it's a real interactive
classroom, natively.

**Phase 3 — Depth.** PBL scenes, document-to-lesson ingestion (reuse OCR/upload), and the
over-reliance signals from `interaction_log` feeding the teacher dashboard.

**Phase 4 — Retire the copy.** Once Phases 1–3 cover the used surface, delete
`features/ai-classroom/studyArena` and the `study-arena` Docker service. The stack loses a
whole Next.js app and its dependency tree.

---

## Why this is genuinely "inspired by," not copied

1. **Different code, our stack** — Express/React/Vite/Postgres vs their Next.js/CopilotKit/LangGraph. Ideas and architecture aren't copyrightable; the reimplementation is ours.
2. **Different pedagogy** — gated `ask` actions invert lecture-playback into attempt-first active learning. That's the differentiator the market research said matters.
3. **Smaller surface** — ~6 actions and 3 agents vs 28+ actions and the full gateway; we keep the magic, drop the bloat.
4. **Clean attribution** — we still credit OpenMAIC (MIT) in `NOTICE.md`, because borrowing ideas openly is the honest move even when not legally required.

---

<!-- AUTONOMOUS DECISION LOG -->

## /autoplan Review Appendix (2026-07-21, commit a6c0ab9)

### Ground truth vs the plan (Step 0 reality check)

The plan describes future work that is mostly **already shipped**:

| Plan phase                         | Status on main                                                                                                                                                                                                                                                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0 (NOTICE/attribution)       | DONE — but AGPL-vs-MIT decision never made (`features/ai-classroom/studyArena/LICENSE` + `package.json` still AGPL-3.0 over MIT upstream)                                                                                                                                                                       |
| Phase 1 (native script player MVP) | DONE — `server/routes/study-arena-beta.ts` (flag `STUDY_ARENA_BETA`, dark in prod), `server/services/study-arena/lesson-script.ts` (gated-ask schema exactly as speced), `client/src/pages/study-arena-beta.tsx` (395 LOC), shipped via PR #260                                                                 |
| Phase 2 (multi-agent + board)      | PARTIAL — roles typed + styled client-side; multi-agent wire contract in `@shared/study-arena` (commit 206692d); NO whiteboard actions (`write`/`draw`/`highlight` absent from schema); `respondToInteraction` uses tutor prompt, not `gradingService`                                                          |
| Phase 3 (depth/PBL/signals)        | PARTIAL — orchestrator/director-graph/job-queue/pptx-export/html-export exist (~2,868 LOC total) despite the plan marking export "Drop (for now)"; `interaction_log` table exists in `scripts/pg-schema.sql:870` but **nothing writes to it** — the over-reliance/mastery signal (the moat piece) is unrealized |
| Phase 4 (retire the copy)          | NOT DONE — `features/ai-classroom/studyArena` is 75MB/~93k LOC, imported by nothing, client route retired, never in Azure prod; carries ~95 of the repo's ~109 open Dependabot alerts incl. the only critical (babel-traverse ACE)                                                                              |

### 0A Premise Challenge

1. **"Attempt-first gating differentiates us"** — supported by cited research (Wharton 30%-vs-64%), but zero pilot-student validation; no success metric, no kill criterion, no cost-per-lesson economics. Status: keep as HYPOTHESIS, not fact.
2. **"Keep Study Arena working the whole time"** — FALSE premise. The vendored service has zero users (never deployed, `/study-arena` client route retired). This inflated a delete-dead-code task into a 4-phase parity migration.
3. **"Native rebuild beats vendored service"** — TRUE and now moot (rebuild shipped).
4. **"Phase 4 gated on Phases 1–3 covering the used surface"** — gate satisfied vacuously; used surface was zero. Deletion is available today.
5. **Implicit: "building this now is the right use of capacity"** — conflicts with standing decisions (expansion AI features gated on first payment/signed commitment; never-build list: no standalone AI tutor app — the current free-text topic box is student-self-serve tutoring in all but name).

### 0B Existing Code Leverage

All sub-problems map to existing code: gated-script generation (lesson-script.ts), quota (`checkAIQuota`), grading (gradingService — unwired), TTS/ASR (ai-classroom), telemetry sink (`interaction_log` — unwired), usage metering (`pgIncrementAIUsage` — wired).

### 0C Dream State

```
CURRENT                          REMAINING PLAN DELTA                12-MONTH IDEAL (per thesis)
Phase-1 beta live (dark in       Delete dead 75MB tree (-95         Teacher assigns gated lessons;
prod), moat signal unwired,      alerts incl critical); doc         interaction_log feeds per-student
75MB dead tree, 109 alerts,      truth; instrument usage +          learning record + teacher dashboard;
AGPL/MIT unresolved              kill-criterion; freeze P2/P3       built ONLY post-payment-trigger
                                 until payment trigger
```

### 0C-bis Implementation Alternatives (for the REMAINING work)

```
APPROACH A: Close the books (minimal viable)
  Summary: Delete vendored tree (+ evaluate ini_claw), resolve AGPL leftovers by deletion,
           rewrite plan doc to reflect shipped state, wire interaction_log writes + a
           30-day usage metric with an explicit kill criterion.
  Effort:  S (human ~1 day / CC ~1-2 h)   Risk: Low   Completeness: 8/10
APPROACH B: Moat-first (ideal architecture)
  Summary: A + spec (not build) the teacher-assign flow and over-reliance dashboard signal,
           scheduled to build at the graduation trigger. Data exhaust > classroom UI.
  Effort:  M (spec only now)   Risk: Low-Med   Completeness: 10/10
APPROACH C: Continue plan as written (Phase 2 build now)
  Summary: Multi-agent roundtable + whiteboard + gradingService wiring pre-payment.
  Effort:  L   Risk: High (violates payment gate; competes on model-quality axis)   Completeness: 3/10 vs thesis
RECOMMENDATION: B — completeness on the thesis-aligned surface, zero pre-trigger build spend.
```

### 0D SELECTIVE EXPANSION analysis

Complexity check: remaining work touches <8 files if Approach A/B chosen. Expansion candidates auto-decided per /autoplan rules:

- Wire `interaction_log` writes from the beta route — **APPROVED** (blast radius, <1d, it's the moat's data source)
- Cost-per-lesson metadata on `pgIncrementAIUsage` calls — **APPROVED** (blast radius, hours)
- Success metric + kill criterion written into this doc — **APPROVED** (docs, S)
- Delete/keep `features/ai-classroom/ini_claw` (10 more alerts) — **TASTE DECISION** (borderline blast radius)
- Teacher-assign flow + dashboard signals build — **DEFERRED to TODOS** (post-trigger)

### 0E Temporal Interrogation (remaining work)

- HOUR 1: deletion mechanics — `git rm -r features/ai-classroom/studyArena`, drop the `ai-classroom` docker profile, confirm CI green, Dependabot alerts auto-close.
- HOUR 2-3: interaction_log wiring — decide PII posture NOW: student free-text answers are minors' data; define retention + exclude from exports until custody items land.
- HOUR 4-5: metric — completed-lesson definition (all gates answered), cost per completed lesson from usage metadata.
- HOUR 6+: doc truth — this file becomes the record; stale "future phases" language removed.

### Decision Audit Trail

| #   | Phase | Decision                                                                   | Classification           | Principle              | Rationale                                                                | Rejected       |
| --- | ----- | -------------------------------------------------------------------------- | ------------------------ | ---------------------- | ------------------------------------------------------------------------ | -------------- |
| 1   | CEO   | Mode = SELECTIVE EXPANSION                                                 | Mechanical               | /autoplan override     | Fixed by pipeline                                                        | —              |
| 2   | CEO   | Landscape check via in-repo research doc (2026-06-27) instead of WebSearch | Mechanical               | P3 pragmatic           | Repo has a current, cited market-research doc; generic search adds noise | live WebSearch |
| 3   | CEO   | Approve expansion: wire interaction_log writes                             | Mechanical               | P2 boil lakes          | In blast radius, <1d, unblocks the moat signal                           | —              |
| 4   | CEO   | Approve expansion: cost-per-lesson metadata                                | Mechanical               | P2                     | In blast radius, hours                                                   | —              |
| 5   | CEO   | Approve expansion: success metric + kill criterion in doc                  | Mechanical               | P1 completeness        | Plan has no measurable outcome today                                     | —              |
| 6   | CEO   | ini_claw deletion                                                          | TASTE                    | P2 vs scope            | Borderline blast radius (separate feature dir, 10 alerts)                | —              |
| 7   | CEO   | Defer teacher-assign/dashboard build to post-trigger                       | Mechanical               | P6 + standing decision | Payment gate is an explicit org rule                                     | build now      |
| 8   | CEO   | Approach recommendation = B (close books + spec moat surface)              | TASTE (surfaced at gate) | P1/P5                  | A vs B are close; C rejected on standing-decision conflict               | C              |

### 11-Section Review (scope = accepted Approach B remaining work)

**S1 Architecture** — Deletion removes a dead island; no coupling changes. Live system:

```
client/pages/study-arena-beta.tsx ──POST /api/study-arena-beta/lesson-script──► routes/study-arena-beta.ts
        │                                                                          ├─ authenticateToken ─ checkAIQuota
        │◄── LessonScript JSON ── generateLessonScript() ── lib/ai/gateway (fast→orchestrator fallback)
        └──POST /interaction──► respondToInteraction() ── tutor prompt ── gateway
   [NEW: + INSERT interaction_log per gated answer]      [NEW: cost metadata on pgIncrementAIUsage]
DEAD (delete): features/ai-classroom/studyArena (75MB island; only ref = docker profile ai-classroom)
```

Rollback posture: deletion = git revert; wiring = flag already exists. 1 issue: two parallel generation pipelines (S5/S10).

**S2 Error & Rescue** — mapped from code:

```
CODEPATH                         FAILURE                    RESCUED?  USER SEES
generateLessonScript             gateway error/timeout      Y (route) 500 "Failed to generate lesson"
                                 malformed JSON             Y (jsonrepair→wrapped error→500)
                                 zod schema mismatch        Y (route catch) 500
                                 zero gated scenes          Y (explicit throw) 500
respondToInteraction             empty answer               Y (proceed:false nudge)
                                 LLM refusal text           N ← GAP: refusal shown verbatim as "feedback" (P3)
client generation catch (l.92)   any generation failure     PARTIAL ← GAP: console.error only — verify user-visible error (P2)
client interaction               submit failure             Y (error state l.304/369)
```

**S3 Security** — Deletion removes ~95 alerts incl. the critical (biggest single win). New findings: (a) prompt injection via free-text `topic` converts the harness back into a generic chatbot — quota-bounded, self-inflicted; defer hardening (P3, post-trigger); (b) **interaction_log wiring stores minors' free-text answers → define PII classification, retention, and exclusion-from-exports BEFORE the first row is written (P1, part of wiring task)**; (c) beta routes are auth-gated but not role-gated — any authenticated account (incl. parent) can consume ai_tutor quota (P3).

**S4 Data/UX edge cases** — sceneCount clamped 2-8, bullets ≤6, answers ≤4000 chars, double-submit blocked (`disabled={submitting}`), gate blocks progress on empty answers. Unhandled: navigate-away mid-generation orphans the request (acceptable, idempotent); generation retry loop can double-charge quota if user re-clicks after slow success (P3 — button disabled during `generating`, OK; verified handled).

**S5 Code Quality** — 1 finding: `pptx-export.ts`/`html-export.ts`/`job-queue.ts` in services/study-arena were marked "Drop (for now)" by this plan's own table; audit whether the live ai-classroom pipeline uses them — prune whatever is dead in the same cleanup (P2). DRY: two lesson-generation pipelines (generator.ts SceneOutline vs lesson-script.ts LessonScript) — converge post-trigger (TODOS).

**S6 Tests** — Existing: `study_arena_lesson.test.ts`, `study-arena-integration.test.ts`, `study-arena-orchestration.test.ts`. New-work tests required: interaction_log row written per gated answer (unit, with PII fields as designed); metric query returns completed-lesson count (unit); deletion PR = CI green + `npm run check` (the build itself is the test). Verify existing coverage pins the every-scene-ends-in-gated-ask safety net (lesson-script.ts:134).

**S7 Performance** — 1 LLM call per generation + 1 per interaction, quota-capped; interaction_log INSERT is trivial; deletion cuts repo 75MB and kills Dependabot/CodeQL noise over the dead tree. No issues.

**S8 Observability** — failures logged with context; usage metered via pgIncrementAIUsage (wired). Gap closed by approved expansions: completed-lesson metric + cost-per-lesson metadata become queryable. At pilot scale no new alerts (consistent with 5xx-alert posture). No further issues.

**S9 Deployment** — No migration needed (interaction_log table already in schema; AUTO_MIGRATE applies on boot). Deletion PR order: git rm tree → drop `ai-classroom` docker profile → CI green → merge (alerts auto-close). Flag remains dark in prod (`STUDY_ARENA_BETA` unset). Rollback: git revert. No issues beyond order.

**S10 Trajectory** — Reversibility: deletion 4/5 (git history), wiring 5/5. Debt: dual pipelines (deferred convergence), AGPL/MIT discrepancy mooted by deletion. Doc-truth rewrite prevents the next planning cycle from "continuing" a finished migration. 1-year question: passes only after the rewrite.

**S11 Design & UX** — Beta page has loading/disabled/error states for interaction; generation failure path is the one silent state (S2 gap). Interaction state map: GENERATE {loading ✓, error ✗ silent, success ✓} / GATE {empty-answer ✓, awaiting-feedback ✓ disabled, feedback ✓}. Full design pass runs in /autoplan Phase 2.

### Required Outputs

**NOT in scope** (deferred with rationale):

- Phase 2 build (multi-agent roundtable, whiteboard actions, gradingService wiring) — payment-gate standing decision
- Phase 3 build (PBL, doc ingestion, dashboard signals UI) — same gate; spec-only now
- Prompt-injection hardening on topic input — P3, self-inflicted + quota-bounded
- Pipeline convergence (generator.ts vs lesson-script.ts) — post-trigger refactor
- Teacher-assign flow — the moat surface; specced at trigger, not built now

**What already exists:** gated-script schema+generation (lesson-script.ts), quota (checkAIQuota), usage metering (pgIncrementAIUsage), interaction_log table (unwired), gradingService/TTS/ASR (unwired, Phase 2), tests (3 files), beta flag + dark prod.

**Dream state delta:** After this scope: dead tree gone (-95 alerts incl. critical), doc tells the truth, usage instrumented with a kill criterion — the decision input for the payment-gated Phase 2/3. Distance to 12-month ideal: teacher-assign + learning-record layer, both correctly parked behind the trigger.

**Failure Modes Registry:**

```
CODEPATH                  FAILURE MODE            RESCUED? TEST? USER SEES?        LOGGED?
generateLessonScript      gateway/parse/zod fail  Y        Y     500 message       Y
client generate catch     any failure             PARTIAL  N     ← silent (P2 fix) console only
respondToInteraction      refusal-as-feedback     N        N     odd feedback      N      ← P3
interaction_log wiring    INSERT fails            (design) new   must not block student flow — log & continue
```

No CRITICAL GAP rows (silent+untested+unrescued) after the P2 client fix lands.

### Implementation Tasks

- [ ] **T1 (P1, human: ~2h / CC: ~20min)** — repo — Delete `features/ai-classroom/studyArena` + drop `ai-classroom` docker profile _(pending final-gate confirmation — one-way-ish)_
  - Surfaced by: 0A premise 4 + S3 — ~95 Dependabot alerts incl. critical babel-traverse; zero imports
  - Files: features/ai-classroom/studyArena/, docker/docker-compose.yml
  - Verify: CI green, `npm run check`, alerts auto-close
- [ ] **T2 (P1, human: ~3h / CC: ~30min)** — server — Wire interaction_log INSERT per gated answer, with PII posture (retention, export-exclusion) decided in the PR description
  - Surfaced by: S3(b) + 0D approved expansion — the moat's data source is unwired
  - Files: server/routes/study-arena-beta.ts, server/lib/pg-queries.ts, server/tests/study_arena_lesson.test.ts
  - Verify: unit test asserts row per interaction; INSERT failure never blocks the student
- [ ] **T3 (P1, human: ~1h / CC: ~10min)** — docs+scripts — Success metric + kill criterion into this doc and metrics-weekly: "≥5 pilot students complete ≥1 full gated lesson unassisted within 30 days of enabling, at <₹2/completed lesson — else mothball behind flag"
  - Surfaced by: 0A premise 1 (subagent finding #4)
  - Files: docs/study-arena-inspired-by-openmaic.md, scripts/metrics-weekly.ts
  - Verify: metric queryable from interaction_log + ai usage rows
- [ ] **T4 (P2, human: ~1h / CC: ~10min)** — client — Surface generation failure to the user (study-arena-beta.tsx:92 console.error → error state)
  - Surfaced by: S2 client GAP
  - Files: client/src/pages/study-arena-beta.tsx
  - Verify: kill the API in dev → visible error, not blank
- [ ] **T5 (P2, human: ~2h / CC: ~20min)** — server — Audit pptx-export/html-export/job-queue usage by live routes; prune dead ones per the plan's own Drop verdicts
  - Surfaced by: S5 (subagent finding #5)
  - Files: server/services/study-arena/
  - Verify: `npm run check` + tests green after prune
- [ ] **T6 (P1, human: ~1h / CC: ~15min)** — docs — Rewrite this doc's phase table to reflect shipped state (done in this review's appendix; fold into body on approval)
  - Surfaced by: 0A + subagent finding #6d
- [ ] **T7 (P3, human: ~1h / CC: ~10min)** — server — Length-cap + sanitize refusal-style feedback in respondToInteraction
  - Surfaced by: S2 refusal GAP

_No new tasks from S4, S7, S8._

### /autoplan Phase 2 — Design Review (7 passes, APP UI rules)

Voices: Codex unavailable → `[subagent-only]`. Claude design subagent: 18 findings (3 critical). Consensus: 7/7 dimensions aligned, no DISAGREEs.

| Pass                    | Score | Verdict                                                                                                                             |
| ----------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1 Info architecture     | 4/10  | Plan specifies zero hierarchy; shipped code is decent but lacks a child-parseable progress indicator ("2 of 5 questions")           |
| 2 Interaction states    | 5/10  | Loading/disabled solid; **wrong-answer nudge renders in the same rose error slot as network failures** — pedagogy styled as a crash |
| 3 Journey/emotional arc | 3/10  | **Stuck-student dead end**: no hint ladder, no "I don't know", no Coach intervention — curiosity→wrong→red→shame→quit               |
| 4 AI slop risk          | 8/10  | Shipped surface is restrained and token-based (no slop patterns); the plan itself is UI-vague — implementer luck, not plan quality  |
| 5 Design system         | 6/10  | Mostly tokens; hardcoded amber/sky/emerald + `bg-white` break dark mode; 10px uppercase labels below legibility floor               |
| 6 Responsive/a11y       | 3/10  | `100vh` vs mobile keyboard on the primary input; Enter submits mid-thought on touch; no language policy for a Hindi-medium audience |
| 7 Unresolved decisions  | —     | Effort-gate vs correctness-gate; hint ladder; resume; language; `verdict` field — all now decided below                             |

**Decisions written into the plan (auto-decided, logged):**

- **Gate policy = EFFORT GATE** (attempt-first pedagogy): a genuine attempt proceeds; feedback structured "what you got right / what to adjust". Add `verdict: "correct"|"partial"|"revealed"` to the interaction contract so the UI can be honest.
- **Language policy**: feedback prompt accepts and answers in the student's language; UI chrome follows existing i18n.
- **Fair-test preconditions** (must land before the flag flips for the T3 pilot metric — else the metric measures broken UX, not the pedagogy): D1, D2, D3, D5, D6 below.

**Design tasks:**

- [ ] **D1 (P1, CC ~30min)** — client — Separate the pedagogy-nudge channel from the error channel (`proceed:false` → agent bubble in the amber card; rose = transport errors only) — study-arena-beta.tsx:316-320
- [ ] **D2 (P1, CC ~15min)** — client — Zero-gate script guard: `flat.length===0` or no ask actions → generation-failure state, never "Lesson complete 🎉" (violates demo-data-honesty invariant) — study-arena-beta.tsx:111,199
- [ ] **D3 (P1, CC ~30min)** — client — Honest generation-error taxonomy: 401→re-login, 429/quota→"you've used today's AI time", 5xx→"our fault, try again" (today every failure says "try a different topic") — study-arena-beta.tsx:53,94 (extends T4)
- [ ] **D4 (P2, CC ~45min)** — client — localStorage resume `{script,cursor,responses}` keyed per session; "Continue where you left off?" on mount — low-end Android tab-discard wipes 15-minute lessons
- [ ] **D5 (P2, CC ~45min)** — client — Mobile input hardening: `100dvh`, `scrollIntoView` on textarea focus, Enter=newline on touch (submit is button-only), exhaustive action-type switch with skip+log fallback
- [ ] **D6 (P2, CC ~20min)** — client+server — MCQ anti-brute-force minimum: attempts-per-gate count into interaction_log (rides T2); dim eliminated choices on wrong pick
- [ ] **D7 (P2, TASTE — final gate)** — server+client — Stuck-student hint ladder: attempt 1 wrong → reframe; attempt 2 → Coach scaffolded hint; attempt 3 → reveal-then-explain-back (changes respondToInteraction contract; ~1 day CC)
- [ ] **D8 (P3, defer to TODOS)** — beta polish batch: scroll-guard + "↓ new" affordance, tap-to-advance pacing (pre-TTS), completion recap of gates+answers, topic chips + kid-voiced setup copy, mid-lesson exit affordance, dark-mode token routing, 11px label floor

**NOT in scope (design):** full Student Experience Spec build-out beyond the above (post-trigger); TTS pacing model; roundtable visual richness (Phase 2 build, frozen).
**What already exists:** design tokens (`bg-card`/`text-foreground`), amber gate-card interruption pattern (the right call — keep), i18n plumbing (`client/src/lib/i18n.tsx`).

### /autoplan Phase 3 — Eng Review

Voices: `[subagent-only]`. Eng subagent: 12 findings — **4 of which corrected this appendix's own Phase-1 outputs** (accepted after spot-verification):

```
ENG DUAL VOICES — CONSENSUS TABLE
  Dimension                      Claude(pipeline)  Subagent   Consensus
  1. Architecture sound?         mostly            corrections DISAGREE→RESOLVED (T2/T5 rescoped)
  2. Test coverage sufficient?   partial           unit-only   CONFIRMED (client untested; route untested)
  3. Performance risks?          none              none        CONFIRMED
  4. Security threats covered?   partial           deeper      CONFIRMED+ (GDPR export gap, quota fail-open)
  5. Error paths handled?        1 gap             T4 stale    DISAGREE→RESOLVED (genError IS surfaced; folded into D3)
  6. Deployment risk?            low               low+notes   CONFIRMED (flag needs restart; -75MB is working-tree only)
```

**Corrections accepted (verified at file:line):**

- interaction_log is NOT unwired repo-wide: `learner-model.ts:270` INSERTs via `commitLearnerUpdate` — "the ONLY writer" (learner-model.ts:7). T2 must write through it, not add a second writer.
- `/interaction` is stateless (no lessonId/gate key; scripts never persisted) → T3's completed-lesson metric and D6's attempts-per-gate are uncomputable without a contract change. T2 rescoped.
- T5's premise inverted: pptx/html-export + orchestrator are imported by live `routes/ai-classroom.ts:8-13` (sidebar route /ai-classroom). Prune yield ≈ 0.
- T4 stale: generation failure IS user-visible (`genError`, study-arena-beta.tsx:94,162). Folded into D3 (error taxonomy is the real gap).
- S10's "AGPL mooted by deletion" is WRONG: ~2,900 LOC in `server/services/study-arena/` carries "Ported from features/ai-classroom/studyArena/..." provenance; MIT notice must survive T1.

**Amended/new tasks (supersede same-numbered items above):**

- [ ] **T1′ (P1, CC ~45min)** — Delete vendored tree + docker service/profile **with licensing collateral**: move MIT/OpenMAIC notice to `docs/` (or repo root), rewrite 12+ "Ported from features/…" comments to upstream GitHub paths, fix `lesson-script.ts:5` NOTICE reference, document the AGPL-declaration resolution, sweep dangling refs (AGENTS.md:56, TODOS.md, QUICKSTART/MICROSERVICES docs, compose header, code-wiki). Note honestly: git history keeps the blobs (-75MB is working-tree only). _(one-way confirm at gate)_
- [ ] **T2′ (P1, CC ~half-day)** — Persist script at generation (id), add `lessonId`+`actionKey` to interaction contract, log gate answers **via commitLearnerUpdate** (`kind: study_arena_gate_answer`), role-filter or role-gate, INSERT failure never blocks the student. Includes: add interaction_log rows to the GDPR export (today export = profile.json only — compliance gap once minors' answers land) and a documented retention stance (no purge infra exists; honest-manual until post-trigger).
- [ ] **E1 (P1, CC ~20min)** — `choices:[]` dead-end: zod superRefine (≥2 choices when expects="choice") + client `action.choices?.length` guard — hard-locks the gate today (lesson-script.ts:39, study-arena-beta.tsx:335)
- [ ] **E2 (P2, CC ~20min)** — Clamp generated topic/prompt lengths in post-processing (or echo request topic) — LLM-expanded topic >300 chars 400s every interaction forever (route caps vs unbounded generation schema)
- [ ] **E3 (P2, CC ~30min)** — Metric integrity: log pgIncrementAIUsage failures loudly (pg-queries:2153 swallows), document quota fail-open + check-then-increment race, add attempt-quality floor note ("asdf" passes the effort gate) beside the T3 metric definition
- [ ] **E4 (P2, CC ~1h)** — Route-level tests: flag-off 404, zod 400s, 500 mapping, T2′ write path incl. INSERT-failure-not-blocking; client guards (E1) tested
- [ ] **T5′ (P3, CC ~15min)** — Document the keep decision for export/orchestrator files (used by live ai-classroom); plan's Drop verdicts overtaken by events
- **D4 amended:** localStorage resume persists `{script, cursor}` only — never minors' answer texts on shared devices (answers live server-side once T2′ lands)
- **D3 absorbs T4.**

**Test coverage diagram (current state):**

```
CODE PATHS                                                USER FLOWS
[+] services/study-arena/lesson-script.ts                 [+] Gated lesson (beta page)
  ├── [★★★] parse/fence/repair/zod     lesson.test.ts       ├── [GAP][→E2E] generate→answer→complete happy path
  ├── [★★★] gateless-scene filter + zero-gate throw         ├── [GAP]      choices:[] dead-end (E1)
  ├── [★★★] empty answer → no proceed, no LLM call          ├── [GAP]      quota-exhausted UX (D3)
  └── [★★ ] happy interaction                               └── [GAP]      resume after tab discard (D4)
[+] routes/study-arena-beta.ts
  ├── [GAP] flag-off 404 / zod 400 / 500 mapping (E4)
  └── [GAP] T2′ write path + failure isolation (E4)
[+] client/pages/study-arena-beta.tsx — ZERO tests; D1–D6 currently land blind
COVERAGE: 4/11 paths (36%) | QUALITY ★★★:3 ★★:1 | GAPS: 7 (1 →E2E)
```

**Cross-phase themes** (flagged independently in 2+ phases — high-confidence):

1. **Metric integrity** — CEO T3 + design fair-test preconditions + eng #8: the pilot kill-criterion is only as good as role-filtering, quota honesty, and an attempt-quality floor.
2. **Minors' PII posture** — CEO S3(b) + design D4 + eng #9: decide export/retention/local-storage stance in T2′, before the first row.
3. **Doc truth** — CEO 0A + design Pass 4 + eng #7/#10: the plan doc misdescribes shipped reality in both directions.

### Decision Audit Trail (continuation)

| #   | Phase  | Decision                                          | Classification | Principle  | Rationale                                                                     |
| --- | ------ | ------------------------------------------------- | -------------- | ---------- | ----------------------------------------------------------------------------- |
| 9   | Design | Skip mockup generation                            | Mechanical     | P3         | UI build frozen behind payment trigger; mockups would design a frozen surface |
| 10  | Design | Gate policy = effort gate + `verdict` field       | Mechanical     | P1/P5      | Attempt-first pedagogy; honest UI state                                       |
| 11  | Design | Fair-test preconditions D1-D3 into scope          | Mechanical     | P2         | Blast radius, <1d each; T3 metric invalid without them                        |
| 12  | Design | D4/D5/D6 into scope                               | Mechanical     | P2         | In blast radius, small                                                        |
| 13  | Design | D7 hint ladder                                    | TASTE → gate   | P1 vs P6   | ~1 day; changes interaction contract                                          |
| 14  | Design | D8 polish → TODOS                                 | Mechanical     | P3         | Post-trigger                                                                  |
| 15  | Eng    | Accept 4 subagent corrections (T1′/T2′/T4→D3/T5′) | Mechanical     | P5         | Verified at file:line                                                         |
| 16  | Eng    | E1 into scope (P1), E2/E3/E4 (P2)                 | Mechanical     | P1/P2      | Live dead-end bug + metric integrity                                          |
| 17  | Eng    | D4 stores script+cursor only, never answer texts  | Mechanical     | P1         | Minors' PII on shared devices                                                 |
| 18  | 3.5    | DX phase skipped                                  | Mechanical     | scope rule | No developer-facing surface                                                   |

## GSTACK REVIEW REPORT

| Review        | Trigger               | Why                             | Runs | Status                      | Findings                                                                                     |
| ------------- | --------------------- | ------------------------------- | ---- | --------------------------- | -------------------------------------------------------------------------------------------- |
| CEO Review    | `/plan-ceo-review`    | Scope & strategy                | 1    | issues_open (via /autoplan) | 5 proposals, 3 accepted, 1 deferred; premises rewritten (accepted); mode SELECTIVE_EXPANSION |
| Codex Review  | `/codex review`       | Independent 2nd opinion         | 0    | unavailable (auth)          | subagent voices ran instead on all phases                                                    |
| Eng Review    | `/plan-eng-review`    | Architecture & tests (required) | 1    | issues_open (via /autoplan) | 12 issues, 2 critical gaps (licensing collateral, contract change)                           |
| Design Review | `/plan-design-review` | UI/UX gaps                      | 1    | issues_open (via /autoplan) | score 4/10 → 7/10, 10 decisions                                                              |
| DX Review     | `/plan-devex-review`  | Developer experience gaps       | 0    | skipped                     | no developer-facing scope                                                                    |

**VERDICT:** CEO + DESIGN + ENG reviewed via /autoplan `[subagent-only]` — plan approved-pending-final-gate; eng review re-run not required (this run is current at a6c0ab9).

**UNRESOLVED DECISIONS:**

- Final-gate confirm: execute T1′ deletion of `features/ai-classroom/studyArena` (one-way-ish; recoverable via git history)
- Taste: delete or keep `features/ai-classroom/ini_claw` (10 Dependabot alerts; documented as local dev gateway)
- Taste: approach A (close books only) vs B (recommended: + spec moat surface at trigger)
- Taste: D7 stuck-student hint ladder — build with the fair-test set or defer
