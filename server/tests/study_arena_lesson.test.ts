import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// Mock the LLM layer so the logic is exercised without a real provider.
const { mockAiChat } = vi.hoisted(() => ({ mockAiChat: vi.fn() }));

vi.mock("../lib/openai", () => ({
  aiChat: mockAiChat,
}));

import { generateLessonScript, respondToInteraction } from "../services/study-arena/lesson-script";

// A well-formed script where every scene ends in a gated ask.
const goodScript = {
  topic: "Pythagoras' theorem",
  conceptIds: ["right-triangle", "hypotenuse"],
  scenes: [
    {
      id: "s1",
      actions: [
        { type: "showSlide", title: "Right triangles", bullets: ["a² + b² = c²"] },
        { type: "speak", agent: "teacher", text: "c is the hypotenuse." },
        {
          type: "ask",
          agent: "teacher",
          prompt: "Which side is c?",
          expects: "freeText",
          gate: true,
        },
      ],
    },
    {
      id: "s2",
      actions: [
        { type: "speak", agent: "classmate", text: "Wait, why squared?" },
        {
          type: "ask",
          agent: "teacher",
          prompt: "Predict c if a=3, b=4.",
          expects: "freeText",
          gate: true,
        },
      ],
    },
  ],
};

describe("generateLessonScript", () => {
  beforeEach(() => vi.clearAllMocks());

  it("parses and validates a well-formed script", async () => {
    (mockAiChat as Mock).mockResolvedValue({ content: JSON.stringify(goodScript) });
    const script = await generateLessonScript("Pythagoras' theorem");
    expect(script.scenes).toHaveLength(2);
    expect(script.topic).toMatch(/Pythagoras/);
  });

  it("strips markdown code fences before parsing", async () => {
    (mockAiChat as Mock).mockResolvedValue({
      content: "```json\n" + JSON.stringify(goodScript) + "\n```",
    });
    const script = await generateLessonScript("Pythagoras' theorem");
    expect(script.scenes).toHaveLength(2);
  });

  it("enforces the inverted loop: drops scenes with no gated ask", async () => {
    const mixed = {
      ...goodScript,
      scenes: [
        // lecture-only scene (no ask) — must be dropped
        { id: "lecture", actions: [{ type: "speak", agent: "teacher", text: "Just listen." }] },
        goodScript.scenes[0],
      ],
    };
    (mockAiChat as Mock).mockResolvedValue({ content: JSON.stringify(mixed) });
    const script = await generateLessonScript("x");
    expect(script.scenes).toHaveLength(1);
    expect(script.scenes[0].id).toBe("s1");
  });

  it("throws when no interactive checkpoints remain", async () => {
    const allLectures = {
      ...goodScript,
      scenes: [{ id: "l", actions: [{ type: "speak", agent: "teacher", text: "lecture" }] }],
    };
    (mockAiChat as Mock).mockResolvedValue({ content: JSON.stringify(allLectures) });
    await expect(generateLessonScript("x")).rejects.toThrow();
  });

  it("throws on unparseable model output", async () => {
    (mockAiChat as Mock).mockResolvedValue({ content: "not json at all <<<" });
    await expect(generateLessonScript("x")).rejects.toThrow();
  });
});

describe("respondToInteraction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does NOT proceed on an empty answer and never calls the LLM", async () => {
    const res = await respondToInteraction({ topic: "x", question: "q", answer: "   " });
    expect(res.proceed).toBe(false);
    expect(mockAiChat).not.toHaveBeenCalled();
  });

  it("proceeds with Socratic feedback after a genuine attempt", async () => {
    (mockAiChat as Mock).mockResolvedValue({ content: "Good start — keep going!" });
    const res = await respondToInteraction({
      topic: "Pythagoras",
      question: "Predict c",
      answer: "5",
    });
    expect(res.proceed).toBe(true);
    expect(res.feedback).toMatch(/keep going/i);
    expect(mockAiChat).toHaveBeenCalledOnce();
  });
});
