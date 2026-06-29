/**
 * Unit tests for the Study Arena multi-agent orchestration (Phase 3).
 *
 * Covers the two pure, high-risk pieces of the director loop:
 *  - `parseStructuredChunk` — the streaming partial-JSON parser that turns an
 *    LLM's `[{type:"text"|"action", ...}]` stream into ordered text/action
 *    events. Tricky because it must emit text deltas incrementally without
 *    double-emitting across chunk boundaries.
 *  - `parseDirectorDecision` — the turn-taking decision parser that decides
 *    which agent (or USER, or END) speaks next.
 *
 * These are deterministic and need no network/LLM, so they guard the Phase 3
 * contract directly.
 */

import { describe, it, expect } from "vitest";
import { createParserState, parseStructuredChunk } from "../services/study-arena/orchestrator";
import {
  parseDirectorDecision,
  buildDirectorPrompt,
} from "../services/study-arena/director-prompt";
import type { AgentInfo } from "@shared/study-arena";

describe("parseStructuredChunk", () => {
  it("parses a complete single-chunk text + action array", () => {
    const state = createParserState();
    const result = parseStructuredChunk(
      '[{"type":"text","content":"Hello class"},{"type":"action","name":"wb_open","params":{}}]',
      state
    );

    expect(result.textChunks).toEqual(["Hello class"]);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].actionName).toBe("wb_open");
    expect(result.isDone).toBe(true);
  });

  it("reconstructs streamed text across chunk boundaries without duplication", () => {
    const state = createParserState();
    const chunks = ['[{"type":"text","content":"Hel', 'lo"}]'];

    let text = "";
    let done = false;
    for (const chunk of chunks) {
      const result = parseStructuredChunk(chunk, state);
      text += result.textChunks.join("");
      done = result.isDone;
    }

    expect(text).toBe("Hello");
    expect(done).toBe(true);
  });

  it("extracts action name and params", () => {
    const state = createParserState();
    const result = parseStructuredChunk(
      '[{"type":"action","name":"wb_draw_text","params":{"text":"E=mc^2"}}]',
      state
    );

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].actionName).toBe("wb_draw_text");
    expect(result.actions[0].params).toEqual({ text: "E=mc^2" });
    expect(result.actions[0].actionId).toBeTruthy();
  });

  it("preserves text-then-action ordering", () => {
    const state = createParserState();
    const result = parseStructuredChunk(
      '[{"type":"text","content":"Look here"},{"type":"action","name":"spotlight","params":{}}]',
      state
    );

    expect(result.ordered.map((o) => o.type)).toEqual(["text", "action"]);
  });

  it("ignores any preamble before the opening bracket", () => {
    const state = createParserState();

    const first = parseStructuredChunk("Sure, let me think... ", state);
    expect(first.textChunks).toEqual([]);
    expect(first.isDone).toBe(false);

    const second = parseStructuredChunk('[{"type":"text","content":"ok"}]', state);
    expect(second.textChunks).toEqual(["ok"]);
    expect(second.isDone).toBe(true);
  });

  it("stops cleanly when the buffer exceeds the size guard", () => {
    const state = createParserState();
    const huge = "[" + '{"type":"text","content":"' + "x".repeat(600 * 1024);
    const result = parseStructuredChunk(huge, state);
    expect(result.isDone).toBe(true);
  });

  it("is a no-op once the stream is marked done", () => {
    const state = createParserState();
    parseStructuredChunk('[{"type":"text","content":"done"}]', state);
    const after = parseStructuredChunk('[{"type":"text","content":"more"}]', state);
    expect(after.textChunks).toEqual([]);
    expect(after.actions).toEqual([]);
  });
});

describe("parseDirectorDecision", () => {
  it("returns the chosen agent id", () => {
    expect(parseDirectorDecision('{"next_agent":"teacher-1"}')).toEqual({
      nextAgentId: "teacher-1",
      shouldEnd: false,
    });
  });

  it("passes USER through as a cue (not an end)", () => {
    expect(parseDirectorDecision('{"next_agent":"USER"}')).toEqual({
      nextAgentId: "USER",
      shouldEnd: false,
    });
  });

  it("ends the round on END", () => {
    expect(parseDirectorDecision('{"next_agent":"END"}')).toEqual({
      nextAgentId: null,
      shouldEnd: true,
    });
  });

  it("extracts the decision when wrapped in prose", () => {
    expect(parseDirectorDecision('Sure! {"next_agent":"student-2"} that seems best.')).toEqual({
      nextAgentId: "student-2",
      shouldEnd: false,
    });
  });

  it("ends safely on unparseable / empty output", () => {
    expect(parseDirectorDecision("I think the teacher should go")).toEqual({
      nextAgentId: null,
      shouldEnd: true,
    });
    expect(parseDirectorDecision("")).toEqual({
      nextAgentId: null,
      shouldEnd: true,
    });
    expect(parseDirectorDecision('{"next_agent": }')).toEqual({
      nextAgentId: null,
      shouldEnd: true,
    });
  });
});

describe("buildDirectorPrompt", () => {
  const agents: AgentInfo[] = [
    { id: "t1", name: "Ms. Ada", role: "teacher", persona: "warm", priority: 10 },
    { id: "s1", name: "Sam", role: "student", persona: "curious", priority: 1 },
  ];

  it("lists every available agent and the END instruction", () => {
    const prompt = buildDirectorPrompt(agents, "User asked about gravity.", [], 0);
    expect(prompt).toContain("Ms. Ada");
    expect(prompt).toContain("Sam");
    expect(prompt).toContain('{"next_agent":"END"}');
  });

  it("switches to discussion framing when a discussion context is given", () => {
    const prompt = buildDirectorPrompt(
      agents,
      "summary",
      [],
      0,
      { topic: "Is Pluto a planet?" },
      "s1"
    );
    expect(prompt).toContain("Discussion Mode");
    expect(prompt).toContain("Is Pluto a planet?");
  });
});
