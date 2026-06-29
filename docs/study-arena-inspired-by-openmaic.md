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
   </content>
   </invoke>
