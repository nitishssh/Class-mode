# Study Arena Integration Tasks - ✅ PHASES 1-2 COMPLETE

**Status: Phases 1-2 Complete, Phase 3 Partial, Phase 4 Mostly Complete**

## Phase 1: Backend — Extract Generation Pipeline ✅

- [x] **1.1** Copy prompt templates from `features/ai-classroom/studyArena/` → `server/lib/prompts/study-arena/`
- [x] **1.2** Copy prompt snippets from `features/` → `server/lib/prompts/snippets/`
- [x] **1.3** Create prompt loader (`server/lib/prompt-loader.ts`) adapted for Express server path
- [x] **1.4** Define Study Arena types (`server/services/study-arena/types.ts`)
- [x] **1.5** Port generation pipeline (`server/services/study-arena/generator.ts`) from `classroom-generation.ts`
  - Adapted to use OpenAI SDK instead of Vercel AI SDK `callLLM()`
  - Includes: outline generation, slide/quiz content, scene actions, agent profiles
  - **Added**: Interactive/Simulation HTML generation with KaTeX support
  - **Added**: Simplified PBL project generation
- [x] **1.6** Port job runner + store (`server/services/study-arena/internal-service.ts`)
  - Uses in-memory Map for job state (instead of filesystem JSON)
  - Persists to MongoDB on completion
- [x] **1.7** Update `server/routes/ai-classroom.ts` to use internal service (no more proxy)
- [x] **1.8** Update `shared/mongo-schema.ts` AIClassroomSchema (add `data` field, remove `url`/`classroomId`)
- [x] **1.9** Install `nanoid` dependency
- [x] **1.10** Clean up temporary files from initial integration

## Phase 2: Frontend — Native Player ✅

- [x] **2.1** Rewrite `client/src/pages/ai-classroom.tsx`:
  - Replace iframe with native `ClassroomPlayer` component
  - Add `SlideRenderer` for PPTist-style slide elements
  - Add `QuizRenderer` with interactive answer checking
  - Add `SimulationRenderer` (Interactive HTML/LaTeX)
  - Add `PBLRenderer` (Project issue board/Team view)
  - Add `AgentInfo` display (avatars, roles)
  - Scene sidebar navigation with progress tracking
  - Framer Motion transitions between scenes
  - Gradient theming (violet/indigo)
- [x] **2.2** Remove dependency on `server/services/study-arena-client.ts` (old bridge client)
- [x] **2.3** Remove legacy auth bridge (dead code)

## Phase 3: Multi-Agent Orchestration ✅

> **Status corrected 2026-06-29:** the port was already complete in code; the
> checkboxes below were stale. `@langchain/langgraph@^1.3.2` + `@langchain/core`
> are installed, the director graph is wired into the SSE endpoint
> `POST /api/ai-classroom/chat`, and the client drives it from
> `client/src/hooks/use-orchestrator.ts`. Remaining work was verification +
> de-duplicating the wire-contract types, now done.

- [x] **3.1** Port `director-graph.ts` (LangGraph `StateGraph`: director → agent_generate loop)
- [x] **3.2** Port `prompt-builder.ts` for agent-specific system prompts
- [x] **3.3** Port `director-prompt.ts` for turn-taking decisions
- [x] **3.4** Simplified Action Loop: Added logic to generate multi-agent actions for each scene
- [x] **3.5** Unify the `StatelessChatRequest`/`StatelessEvent` wire contract on
      `@shared/study-arena` (was duplicated + drifting in `services/study-arena/types.ts`)
- [x] **3.6** Unit tests for the streaming parser (`parseStructuredChunk`) and
      director turn-taking (`parseDirectorDecision`) —
      `server/tests/study-arena-orchestration.test.ts`

**Design note:** orchestration is *client-pumped* — `buildInitialState` sets
`maxTurns = turnCount + 1`, so each HTTP request advances exactly one agent turn
and returns `directorState`; the client re-calls to continue the roundtable. See
ADR `0001-client-pumped-orchestration.md`.

## Phase 4: Polish & Advanced Features

- [ ] **4.1** TTS integration (Azure Cognitive Services)
- [x] **4.2** Whiteboard component port
- [x] **4.3** Interactive scene renderer (Integrated via `SimulationRenderer`)
- [x] **4.4** PBL scene renderer (Integrated via `PBLRenderer`)
- [x] **4.5** Framer Motion micro-animations (Integrated in `ClassroomPlayer`)

## Progress Summary

| Phase                 | Status             | Completion   |
| --------------------- | ------------------ | ------------ |
| Phase 1 (Backend)     | ✅ Complete        | 100% (10/10) |
| Phase 2 (Frontend)    | ✅ Complete        | 100% (3/3)   |
| Phase 3 (Multi-Agent) | ✅ Complete        | 100% (6/6)   |
| Phase 4 (Polish)      | 🔄 Mostly Complete | 80% (4/5)    |
