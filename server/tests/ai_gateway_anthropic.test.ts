import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The Anthropic SDK is mocked at the module boundary so these tests exercise
// the gateway's adapter logic (param shaping, refusal handling, block joining)
// without a network call or an API key.
const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: createMock };
  },
}));

import { generate, streamGenerate, MODEL_REGISTRY } from "../lib/ai/gateway";

const originalOrchestrator = { ...MODEL_REGISTRY.orchestrator };

/** Point the "orchestrator" role at an Anthropic model for the duration of a test. */
function useAnthropicModel(model: string) {
  MODEL_REGISTRY.orchestrator = { provider: "anthropic", model };
}

function textResponse(text: string) {
  return { content: [{ type: "text", text }], stop_reason: "end_turn", stop_details: null };
}

/** Build an async-iterable stream of raw Anthropic SSE events. */
async function* eventStream(events: unknown[]) {
  for (const event of events) yield event;
}

function textDelta(text: string) {
  return { type: "content_block_delta", delta: { type: "text_delta", text } };
}

describe("AI gateway — Anthropic adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    MODEL_REGISTRY.orchestrator = { ...originalOrchestrator };
  });

  it("sends the system prompt top-level, not as a message", async () => {
    useAnthropicModel("claude-opus-5");
    createMock.mockResolvedValue(textResponse("hi"));

    await generate({
      model: "orchestrator",
      system: "You are a grader.",
      messages: [{ role: "user", content: "Grade this." }],
    });

    const [body] = createMock.mock.calls[0];
    expect(body.system).toBe("You are a grader.");
    expect(body.messages).toEqual([{ role: "user", content: "Grade this." }]);
    // A "system" role must never leak into the messages array.
    expect(body.messages.some((m: { role: string }) => m.role === "system")).toBe(false);
  });

  it("drops temperature on models that reject sampling params", async () => {
    useAnthropicModel("claude-opus-5");
    createMock.mockResolvedValue(textResponse("hi"));

    await generate({
      model: "orchestrator",
      temperature: 0.7,
      messages: [{ role: "user", content: "Hello" }],
    });

    // Opus 5 returns a 400 if temperature is present — it must be omitted.
    expect(createMock.mock.calls[0][0]).not.toHaveProperty("temperature");
  });

  it("keeps temperature on older models that still accept it", async () => {
    useAnthropicModel("claude-haiku-4-5");
    createMock.mockResolvedValue(textResponse("hi"));

    await generate({
      model: "orchestrator",
      temperature: 0.7,
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(createMock.mock.calls[0][0].temperature).toBe(0.7);
  });

  it("expresses jsonMode as a system instruction (no native JSON switch)", async () => {
    useAnthropicModel("claude-opus-5");
    createMock.mockResolvedValue(textResponse("{}"));

    await generate({
      model: "orchestrator",
      system: "Base prompt.",
      jsonMode: true,
      messages: [{ role: "user", content: "Give me JSON" }],
    });

    const [body] = createMock.mock.calls[0];
    expect(body.system).toContain("Base prompt.");
    expect(body.system).toContain("single valid JSON object");
    expect(body).not.toHaveProperty("response_format");
  });

  it("joins multiple text blocks in order", async () => {
    useAnthropicModel("claude-opus-5");
    createMock.mockResolvedValue({
      content: [
        { type: "thinking", thinking: "ignored" },
        { type: "text", text: "part one " },
        { type: "text", text: "part two" },
      ],
      stop_reason: "end_turn",
      stop_details: null,
    });

    const out = await generate({
      model: "orchestrator",
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(out).toBe("part one part two");
  });

  it("throws on a refusal stop_reason", async () => {
    useAnthropicModel("claude-opus-5");
    createMock.mockResolvedValue({
      content: [],
      stop_reason: "refusal",
      stop_details: { type: "refusal", category: "cyber", explanation: "declined" },
    });

    await expect(
      generate({ model: "orchestrator", messages: [{ role: "user", content: "Hello" }] })
    ).rejects.toThrow(/refused request: declined/);
  });

  it("rejects a message list that does not open on a user turn", async () => {
    useAnthropicModel("claude-opus-5");

    await expect(
      generate({
        model: "orchestrator",
        messages: [{ role: "assistant", content: "I go first" }],
      })
    ).rejects.toThrow(/first message to have role "user"/);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("rejects an empty message list", async () => {
    useAnthropicModel("claude-opus-5");

    await expect(generate({ model: "orchestrator", messages: [] })).rejects.toThrow(
      /at least one user\/assistant message/
    );
    expect(createMock).not.toHaveBeenCalled();
  });

  it("falls back to another role when the Anthropic call fails", async () => {
    useAnthropicModel("claude-opus-5");
    createMock.mockRejectedValue(new Error("anthropic down"));

    // "fast" still resolves to Gemini, which is itself unconfigured in tests —
    // the point is that the fallback path is attempted, not that it succeeds.
    await expect(
      generate({
        model: "orchestrator",
        fallback: "fast",
        messages: [{ role: "user", content: "Hello" }],
      })
    ).rejects.not.toThrow(/anthropic down/);
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("streams text deltas", async () => {
    useAnthropicModel("claude-opus-5");
    createMock.mockResolvedValue(
      eventStream([
        { type: "message_start" },
        textDelta("Hello"),
        textDelta(" world"),
        { type: "message_stop" },
      ])
    );

    const chunks: string[] = [];
    for await (const chunk of streamGenerate({
      model: "orchestrator",
      messages: [{ role: "user", content: "Hi" }],
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(["Hello", " world"]);
    expect(createMock.mock.calls[0][0].stream).toBe(true);
  });

  it("throws on a mid-stream refusal", async () => {
    useAnthropicModel("claude-opus-5");
    createMock.mockResolvedValue(
      eventStream([
        textDelta("starting"),
        { type: "message_delta", delta: { stop_reason: "refusal" } },
      ])
    );

    const consume = async () => {
      for await (const _ of streamGenerate({
        model: "orchestrator",
        messages: [{ role: "user", content: "Hi" }],
      })) {
        // drain
      }
    };

    await expect(consume()).rejects.toThrow(/refused request during streaming/);
  });
});
