import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// Mock the AI gateway so the logic is exercised without a real provider.
const { mockGenerate } = vi.hoisted(() => ({ mockGenerate: vi.fn() }));

vi.mock("../lib/ai/gateway", () => ({
  generate: mockGenerate,
}));

import {
  createLinearEquationsDelayedCheck,
  createLinearEquationsSprint,
  gradeLinearEquationsAssessment,
  generateLessonScript,
  lessonScriptSchema,
  respondToInteraction,
  sanitizeTutorFeedback,
} from "../services/study-arena/lesson-script";

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

describe("lesson scene graph contract", () => {
  it("keeps existing linear scripts valid without a declared graph", () => {
    expect(lessonScriptSchema.safeParse(goodScript).success).toBe(true);
  });

  it("accepts a declared branch graph that reaches an independent assessment", () => {
    const result = lessonScriptSchema.safeParse({
      topic: "Linear equations",
      scenes: [
        { id: "intro", actions: [{ type: "ask", agent: "teacher", prompt: "Try it", expects: "freeText", gate: true }] },
        { id: "support", actions: [{ type: "ask", agent: "coach", prompt: "Try again", expects: "freeText", gate: true }] },
        { id: "transfer", actions: [{ type: "assessment", agent: "teacher", assessmentId: "linear-equations-immediate", prompt: "Solve it", gate: true }] },
      ],
      sceneGraph: {
        version: "v1",
        entrySceneId: "intro",
        transitions: [
          { fromSceneId: "intro", toSceneId: "transfer", when: { kind: "assessment_result", correct: true } },
          { fromSceneId: "intro", toSceneId: "support", when: { kind: "assessment_result", correct: false } },
          { fromSceneId: "support", toSceneId: "transfer" },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects dangling targets, unreachable scenes, and paths without an ending", () => {
    const result = lessonScriptSchema.safeParse({
      topic: "Graph errors",
      scenes: [
        { id: "entry", actions: [{ type: "ask", agent: "teacher", prompt: "Try it", expects: "freeText", gate: true }] },
        { id: "orphan", actions: [{ type: "ask", agent: "teacher", prompt: "Try it", expects: "freeText", gate: true }] },
      ],
      sceneGraph: {
        version: "v1",
        entrySceneId: "entry",
        transitions: [{ fromSceneId: "entry", toSceneId: "missing" }],
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message).join(" ")).toMatch(
        /does not exist|not reachable|cannot reach/
      );
    }
  });

  it("requires an explicit traversal limit for retry cycles", () => {
    const script = {
      topic: "Bounded retry",
      scenes: [
        { id: "practice", actions: [{ type: "ask", agent: "teacher", prompt: "Try it", expects: "freeText", gate: true }] },
        { id: "review", actions: [{ type: "ask", agent: "coach", prompt: "Try again", expects: "freeText", gate: true }] },
      ],
      sceneGraph: {
        version: "v1" as const,
        entrySceneId: "practice",
        transitions: [
          { fromSceneId: "practice", toSceneId: "review" },
          { fromSceneId: "review", toSceneId: "practice" },
          { fromSceneId: "review", terminal: true },
        ],
      },
    };
    expect(lessonScriptSchema.safeParse(script).success).toBe(false);
    const bounded = {
      ...script,
      sceneGraph: {
        ...script.sceneGraph,
        transitions: script.sceneGraph.transitions.map((transition, index) =>
          index < 2 ? { ...transition, maxTraversals: 2 } : transition
        ),
      },
    };
    expect(lessonScriptSchema.safeParse(bounded).success).toBe(true);
  });
});

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

describe("linear equations mastery sprint", () => {
  it("has a fixed attempt-first sequence ending in an independent transfer check", () => {
    const script = createLinearEquationsSprint();
    expect(script.topic).toBe("Linear equations");
    const finalAction = script.scenes.at(-1)?.actions.at(-1);
    expect(finalAction).toMatchObject({
      type: "assessment",
      assessmentId: "linear-equations-immediate",
      gate: true,
    });
  });

  it("grades accepted numeric answer forms without an LLM", () => {
    expect(gradeLinearEquationsAssessment("linear-equations-immediate", "x = 5")).toBe(true);
    expect(gradeLinearEquationsAssessment("linear-equations-immediate", "4")).toBe(false);
    expect(gradeLinearEquationsAssessment("linear-equations-delayed", "7")).toBe(true);
  });

  it("uses a different no-AI problem for delayed recall", () => {
    const finalAction = createLinearEquationsDelayedCheck().scenes[0].actions[0];
    expect(finalAction).toMatchObject({
      type: "assessment",
      assessmentId: "linear-equations-delayed",
      gate: true,
    });
  });
});

describe("respondToInteraction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does NOT proceed on an empty answer and never calls the LLM", async () => {
    const res = await respondToInteraction({ topic: "x", question: "q", answer: "   " });
    expect(res.proceed).toBe(false);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("proceeds with Socratic feedback after a genuine attempt (effort gate)", async () => {
    (mockGenerate as Mock).mockResolvedValue("Good start — keep going!");
    const res = await respondToInteraction({
      topic: "Pythagoras",
      question: "Predict c",
      answer: "5",
    });
    expect(res.proceed).toBe(true);
    expect(res.feedback).toMatch(/keep going/i);
    expect(res.attempt).toBe(1);
    expect(mockGenerate).toHaveBeenCalledOnce();
  });

  it("escalates the support ladder on later attempts (still proceeds — never traps)", async () => {
    (mockGenerate as Mock).mockResolvedValue("Here's a concrete hint.");
    const a1 = (mockGenerate as Mock).mock;
    const r2 = await respondToInteraction({
      topic: "Pythagoras",
      question: "Predict c",
      answer: "hmm",
      attempt: 2,
    });
    // attempt 2 asks for a concrete scaffolded hint
    const promptA2 = (mockGenerate as Mock).mock.calls[0][0].messages[0].content as string;
    expect(promptA2).toMatch(/scaffolded hint|next step/i);
    expect(r2.proceed).toBe(true);
    expect(r2.attempt).toBe(2);

    (mockGenerate as Mock).mockClear();
    void a1;
    const r3 = await respondToInteraction({
      topic: "Pythagoras",
      question: "Predict c",
      answer: "still stuck",
      attempt: 5,
    });
    // attempt 3+ reveals the key idea and asks the student to explain it back
    const promptA3 = (mockGenerate as Mock).mock.calls[0][0].messages[0].content as string;
    expect(promptA3).toMatch(/explain it back|reveal/i);
    expect(r3.proceed).toBe(true);
    expect(r3.attempt).toBe(5);
  });

  it("clamps a non-positive attempt to 1", async () => {
    (mockGenerate as Mock).mockResolvedValue("ok");
    const res = await respondToInteraction({
      topic: "x",
      question: "q",
      answer: "a",
      attempt: 0,
    });
    expect(res.attempt).toBe(1);
  });

  it("replaces refusal-style provider text with useful student-safe feedback", async () => {
    (mockGenerate as Mock).mockResolvedValue(
      "As an AI language model, I cannot assist with that request due to policy."
    );
    const res = await respondToInteraction({ topic: "x", question: "q", answer: "a" });
    expect(res.feedback).not.toMatch(/language model|policy/i);
    expect(res.feedback).toMatch(/useful hint/i);
  });

  it("caps and normalizes feedback before it reaches the client", () => {
    const feedback = sanitizeTutorFeedback(`  ${"helpful ".repeat(200)}  `);
    expect(feedback.length).toBeLessThanOrEqual(800);
    expect(feedback).not.toContain("  ");
  });
});
