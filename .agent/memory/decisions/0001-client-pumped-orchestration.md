# ADR 0001 — Client-pumped multi-agent orchestration (one turn per request)

**Status:** Accepted (documenting existing behavior)
**Date:** 2026-06-29
**Context:** AI Classroom / Study Arena, Phase 3 (Multi-Agent Orchestration)

## Context

The Study Arena multi-agent "classroom" is driven by a LangGraph `StateGraph`
in `server/services/study-arena/director-graph.ts`:

```
START → director → (agent_generate → director)* → END
```

The director node decides which agent speaks next (or cues the USER, or ends).
The agent node streams that agent's text + whiteboard/teaching actions.

A natural expectation is that one HTTP call runs the *whole* roundtable until
the director decides to end. That is **not** what happens. In
`buildInitialState`:

```ts
maxTurns: turnCount + 1,
```

and the director ends as soon as `turnCount >= maxTurns`. So each call to
`POST /api/ai-classroom/chat` advances **exactly one agent turn**, then emits a
`done` event carrying the updated `directorState`. The client
(`client/src/hooks/use-orchestrator.ts`) re-invokes the endpoint with that
`directorState` to advance the next turn. The roundtable is therefore
**client-pumped**, not autonomous within a single request.

## Decision

Keep the one-turn-per-request, client-pumped model for now.

## Rationale

- **Timeout-safe.** Each request is short and bounded — it survives serverless
  / proxy request timeouts that a long-lived multi-turn stream could exceed.
- **Cancellable.** `req.on("close")` aborts cleanly between turns; the client
  controls pacing and can stop the roundtable at any boundary.
- **Stateless server.** All loop state rides in `directorState` on the wire, so
  no server-side session store is needed and horizontal scaling is trivial.

## Consequences / trade-offs

- More round-trips and per-turn latency than a single streamed roundtable.
- Orchestration "intelligence" is split between the server graph and the client
  pump loop — a reader must look at both to understand turn flow.
- The `maxTurns = turnCount + 1` line is load-bearing and non-obvious; changing
  it silently converts the system to multi-turn-per-request.

## Alternatives considered

- **Autonomous multi-turn SSE stream:** raise `maxTurns` and let the graph run
  the full roundtable, streaming all agents in one response. Smoother UX, but
  long-lived connections, harder cancellation, and timeout exposure. Revisit if
  per-turn latency becomes a UX problem (tracked as a Sprint 5 option).

## Notes

The wire contract for this loop (`StatelessChatRequest` / `StatelessEvent` /
`DirectorState`) lives in `shared/study-arena.ts` as the single source of truth.
It was previously duplicated in `server/services/study-arena/types.ts` and had
already drifted; that duplicate was removed and now re-exports from `@shared`.
