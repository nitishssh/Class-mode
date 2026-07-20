import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// Mock the AI gateway so the logic is exercised without a real provider.
const { mockGenerate } = vi.hoisted(() => ({ mockGenerate: vi.fn() }));

vi.mock("../lib/ai/gateway", () => ({
  generate: mockGenerate,
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
    (mockGenerate as Mock).mockResolvedValue(JSON.stringify(goodScript));
    const script = await generateLessonScript("Pythagoras' theorem");
    expect(script.scenes).toHaveLength(2);
    expect(script.topic).toMatch(/Pythagoras/);
  });

  it("strips markdown code fences before parsing", async () => {
    (mockGenerate as Mock).mockResolvedValue("```json\n" + JSON.stringify(goodScript) + "\n```");
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
    (mockGenerate as Mock).mockResolvedValue(JSON.stringify(mixed));
    const script = await generateLessonScript("x");
    expect(script.scenes).toHaveLength(1);
    expect(script.scenes[0].id).toBe("s1");
  });

  it("throws when no interactive checkpoints remain", async () => {
    const allLectures = {
      ...goodScript,
      scenes: [{ id: "l", actions: [{ type: "speak", agent: "teacher", text: "lecture" }] }],
    };
    (mockGenerate as Mock).mockResolvedValue(JSON.stringify(allLectures));
    await expect(generateLessonScript("x")).rejects.toThrow();
  });

  it("throws on unparseable model output", async () => {
    (mockGenerate as Mock).mockResolvedValue("not json at all <<<");
    await expect(generateLessonScript("x")).rejects.toThrow();
  });

  it("degrades a choice ask with <2 choices to free text (never an unpassable gate)", async () => {
    const oneChoice = {
      ...goodScript,
      scenes: [
        {
          id: "s1",
          actions: [
            {
              type: "ask",
              agent: "teacher",
              prompt: "Pick one",
              expects: "choice",
              choices: ["only-option"],
              gate: true,
            },
          ],
        },
      ],
    };
    (mockGenerate as Mock).mockResolvedValue(JSON.stringify(oneChoice));
    const script = await generateLessonScript("x");
    const ask = script.scenes[0].actions[0];
    expect(ask.type).toBe("ask");
    if (ask.type === "ask") {
      expect(ask.expects).toBe("freeText");
      expect(ask.choices).toBeUndefined();
    }
  });

  it("keeps a valid 2+ choice ask as a choice gate", async () => {
    const twoChoice = {
      ...goodScript,
      scenes: [
        {
          id: "s1",
          actions: [
            {
              type: "ask",
              agent: "teacher",
              prompt: "Pick one",
              expects: "choice",
              choices: ["a", "b"],
              gate: true,
            },
          ],
        },
      ],
    };
    (mockGenerate as Mock).mockResolvedValue(JSON.stringify(twoChoice));
    const script = await generateLessonScript("x");
    const ask = script.scenes[0].actions[0];
    if (ask.type === "ask") {
      expect(ask.expects).toBe("choice");
      expect(ask.choices).toEqual(["a", "b"]);
    }
  });

  it("clamps an over-long topic to the /interaction route cap (300)", async () => {
    const longTopic = { ...goodScript, topic: "x".repeat(500) };
    (mockGenerate as Mock).mockResolvedValue(JSON.stringify(longTopic));
    const script = await generateLessonScript("x");
    expect(script.topic.length).toBe(300);
  });
});

describe("respondToInteraction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does NOT proceed on an empty answer and never calls the LLM", async () => {
    const res = await respondToInteraction({ topic: "x", question: "q", answer: "   " });
    expect(res.proceed).toBe(false);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("proceeds with Socratic feedback after a genuine attempt", async () => {
    (mockGenerate as Mock).mockResolvedValue("Good start — keep going!");
    const res = await respondToInteraction({
      topic: "Pythagoras",
      question: "Predict c",
      answer: "5",
    });
    expect(res.proceed).toBe(true);
    expect(res.feedback).toMatch(/keep going/i);
    expect(mockGenerate).toHaveBeenCalledOnce();
  });
});
