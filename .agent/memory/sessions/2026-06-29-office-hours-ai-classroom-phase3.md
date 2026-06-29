# Office Hours — AI Classroom Phase 3: Multi-Agent Orchestration

**Date:** 2026-06-29
**Format:** Facilitated brainstorm, grounded in the code (continuation of an
Antigravity-CLI office-hours session that couldn't be recovered locally).
**Topic:** Pick up the open thread the roadmap listed as "Phase 3 — 25%".

## Opening reframe: the roadmap was stale

`STATUS.md` / `tasks.md` listed Phase 3 at **25% (1/4)** with 3.1–3.3 (port the
director graph, prompt builder, director prompt) unchecked. The code told a
different story:

| Roadmap claim | Reality |
|---|---|
| `director-graph.ts` not ported | ✅ Full LangGraph `StateGraph` present |
| `@langchain/langgraph` missing | ✅ `@langchain/langgraph@^1.3.2` + `@langchain/core` installed |
| `prompt-builder.ts` not ported | ✅ Present, used by the graph |
| `director-prompt.ts` not ported | ✅ Present (`buildDirectorPrompt`, `parseDirectorDecision`) |
| Orchestrator not wired | ✅ `orchestrateChat` → SSE `POST /api/ai-classroom/chat`, client calls it from `use-orchestrator.ts` |

So Phase 3 was ~90% **built** but ~0% **verified / cleaned up**. The real work
was the stuff never written down.

## The three issues nobody recorded

1. **Duplicate, drifting wire types.** `StatelessChatRequest` / `StatelessEvent`
   were defined in BOTH `shared/study-arena.ts` and
   `server/services/study-arena/types.ts`, and had already diverged
   (`storeState` shape, `config.sessionType`, `text_delta.messageId`
   optionality). The orchestrator read the shared copy; the route read the local
   copy. A live drift bug TypeScript could not catch across the boundary.
2. **The loop is client-pumped, not autonomous.** `maxTurns = turnCount + 1`
   means one agent turn per HTTP request; the client re-calls with
   `directorState` to continue. Almost certainly an unstated decision.
3. **Zero tests** on the trickiest pure code: the streaming partial-JSON parser
   (`parseStructuredChunk`) and the director turn-taking (`parseDirectorDecision`).

## Decisions

- Close Phase 3 out **honestly**: verify + reconcile rather than build more.
- Keep the client-pumped model for now (timeout-safe, cancellable, stateless
  server) — recorded as ADR 0001.

## Actions taken this session

- **Unified the wire contract** on `@shared/study-arena`; `services/study-arena/types.ts`
  now re-exports those types and keeps only generation-pipeline types local.
  Route imports the shared contract directly. `npm run check` clean (only the
  pre-existing `baseUrl` tsconfig deprecation remains).
- **Added unit tests** — `server/tests/study-arena-orchestration.test.ts`
  (14 tests: streaming parser across chunk boundaries, action extraction,
  ordering, buffer guard; director decisions for agent / USER / END / prose-wrapped
  / garbage; director-prompt sanity). All green.
- **Corrected the roadmap** (`tasks.md`, `STATUS.md`) to Phase 3 = 100% (6/6).
- **Wrote ADR 0001** documenting the client-pumped one-turn-per-request design.

## Still open (candidate Sprint 5 scope)

- **Phase 4.1 — TTS** (Azure Cognitive Services / `AgentVoice`) — last polish item.
- **Decide autonomous vs client-pumped** orchestration if per-turn latency hurts UX.
- **End-to-end smoke test** of the live SSE turn-pump against a real/mocked LLM
  (current tests cover the pure functions, not the full graph stream).
