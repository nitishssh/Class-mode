/**
 * End-to-end smoke test for the Study Arena multi-agent orchestration graph.
 *
 * The sibling `study-arena-orchestration.test.ts` covers the pure helper
 * functions. This suite exercises the *whole* loop —
 * `orchestrateChat` → LangGraph director/agent nodes → streamed
 * `StatelessEvent`s — with the LLM layer mocked, so the graph wiring, the
 * per-turn `maxTurns = turnCount + 1` gating, and the structured-stream parsing
 * are all verified together without a network/LLM call.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the OpenAI lib the AI-SDK adapter streams through. `streamAIChat` yields
// a structured `[{type:"text"},{type:"action"}]` payload in two chunks so the
// cross-boundary parsing is exercised end-to-end.
vi.mock("../lib/openai", () => ({
  streamAIChat: async function* () {
    yield '[{"type":"text","content":"Hello, ';
    yield 'class!"},{"type":"action","name":"wb_open","params":{}}]';
  },
  aiChat: async () => ({ content: '{"next_agent":"END"}' }),
}));

import { orchestrateChat } from "../services/study-arena/orchestrator";
import type { StatelessChatRequest, StatelessEvent } from "@shared/study-arena";

async function collect(req: StatelessChatRequest): Promise<StatelessEvent[]> {
  const events: StatelessEvent[] = [];
  for await (const event of orchestrateChat(req)) events.push(event);
  return events;
}

function baseRequest(overrides: Partial<StatelessChatRequest["config"]>): StatelessChatRequest {
  return {
    messages: [{ role: "user", content: "Explain gravity" }],
    storeState: { whiteboardOpen: false, currentSceneId: null },
    config: {
      agentIds: [],
      agentConfigs: [],
      ...overrides,
    },
  };
}

describe("orchestrateChat (graph E2E smoke test)", () => {
  beforeEach(() => {
    // Force the OpenAI-backed adapter (the one we mocked) rather than Gemini.
    delete process.env.GOOGLE_API_KEY;
  });

  it("streams a full single-agent turn: start → text → action → end", async () => {
    const events = await collect(
      baseRequest({
        agentIds: ["teacher-1"],
        agentConfigs: [{ id: "teacher-1", name: "Ms. Ada", role: "teacher", persona: "warm" }],
      })
    );

    const types = events.map((e) => e.type);
    expect(types).toContain("agent_start");
    expect(types).toContain("text_delta");
    expect(types).toContain("action");
    expect(types).toContain("agent_end");

    // The turn is attributed to the right agent.
    const start = events.find((e) => e.type === "agent_start") as Extract<
      StatelessEvent,
      { type: "agent_start" }
    >;
    expect(start.data.agentName).toBe("Ms. Ada");

    // Text is reconstructed across chunk boundaries without loss or duplication.
    const text = events
      .filter((e): e is Extract<StatelessEvent, { type: "text_delta" }> => e.type === "text_delta")
      .map((e) => e.data.content)
      .join("");
    expect(text).toBe("Hello, class!");

    // The whiteboard action is surfaced.
    const action = events.find((e) => e.type === "action") as Extract<
      StatelessEvent,
      { type: "action" }
    >;
    expect(action.data.actionName).toBe("wb_open");
    expect(action.data.agentId).toBe("teacher-1");

    // Ordering: the agent starts before it ends, and the action lands in between.
    expect(types.indexOf("agent_start")).toBeLessThan(types.indexOf("agent_end"));
    expect(types.indexOf("action")).toBeLessThan(types.indexOf("agent_end"));
  });

  it("routes the first turn to the trigger agent in a multi-agent session", async () => {
    const events = await collect(
      baseRequest({
        agentIds: ["teacher-1", "student-1"],
        triggerAgentId: "student-1",
        agentConfigs: [
          { id: "teacher-1", name: "Ms. Ada", role: "teacher", persona: "warm" },
          { id: "student-1", name: "Sammy", role: "student", persona: "curious" },
        ],
      })
    );

    const start = events.find((e) => e.type === "agent_start") as Extract<
      StatelessEvent,
      { type: "agent_start" }
    >;
    expect(start).toBeDefined();
    // The director must hand turn 0 to the explicit trigger agent, not the teacher.
    expect(start.data.agentId).toBe("student-1");
    expect(start.data.agentName).toBe("Sammy");
  });

  it("never yields an error event on a well-formed request", async () => {
    const events = await collect(
      baseRequest({
        agentIds: ["teacher-1"],
        agentConfigs: [{ id: "teacher-1", name: "Ms. Ada", role: "teacher", persona: "warm" }],
      })
    );
    expect(events.find((e) => e.type === "error")).toBeUndefined();
  });
});
