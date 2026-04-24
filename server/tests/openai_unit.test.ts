/**
 * Unit tests for server/lib/openai.ts
 *
 * Strategy: mock the `openai` npm package at module level so no real HTTP
 * calls are made. Each test controls exactly what `openai.chat.completions.create`
 * returns (or throws), then asserts on the utility function's output.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock the openai SDK ────────────────────────────────────────────────────

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
    },
  };
});

// Import AFTER setting up the mock (so the module gets the mocked constructor)
import {
  aiChat,
  evaluateSubjectiveAnswer,
  generateStudyPlan,
  analyzeTestPerformance,
} from "../lib/openai";

// ── Helpers ─────────────────────────────────────────────────────────────────

function fakeCompletion(content: string) {
  return {
    choices: [{ message: { content } }],
  };
}

// ════════════════════════════════════════════════════════════════════════════
// aiChat
// ════════════════════════════════════════════════════════════════════════════

describe("aiChat()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return the AI response content as a string", async () => {
    mockCreate.mockResolvedValue(fakeCompletion("Gravity is 9.8 m/s²."));

    const result = await aiChat([{ role: "user", content: "What is gravity?" }]);

    expect(result).toEqual({ content: "Gravity is 9.8 m/s²." });
  });

  it("should auto-inject a system message when none is provided", async () => {
    mockCreate.mockResolvedValue(fakeCompletion("Sure!"));

    const messages = [{ role: "user" as const, content: "Help me." }];
    await aiChat(messages);

    const calledMessages = mockCreate.mock.calls[0][0].messages;
    expect(calledMessages[0].role).toBe("system");
    expect(calledMessages.length).toBe(2);
  });

  it("should NOT inject a second system message when one is already present", async () => {
    mockCreate.mockResolvedValue(fakeCompletion("Ok."));

    const messages = [
      { role: "system" as const, content: "You are a custom tutor." },
      { role: "user" as const, content: "Help." },
    ];
    await aiChat(messages);

    const calledMessages = mockCreate.mock.calls[0][0].messages;
    const systemMessages = calledMessages.filter((m: any) => m.role === "system");
    expect(systemMessages.length).toBe(1);
  });

  it("should throw when the OpenAI API call fails", async () => {
    mockCreate.mockRejectedValue(new Error("Network Error"));

    await expect(aiChat([{ role: "user", content: "Test" }])).rejects.toThrow(
      "AI is unavailable right now"
    );
  });

  it("should return fallback content when API returns an empty choice", async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: null } }] });

    const result = await aiChat([{ role: "user", content: "Test" }]);

    expect(result.content).toBe("I don't have a response for that.");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// evaluateSubjectiveAnswer
// ════════════════════════════════════════════════════════════════════════════

describe("evaluateSubjectiveAnswer()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should parse and return score, confidence, and feedback from a valid AI response", async () => {
    const aiResponse = JSON.stringify({ score: 8, confidence: 90, feedback: "Good answer." });
    mockCreate.mockResolvedValue(fakeCompletion(aiResponse));

    const result = await evaluateSubjectiveAnswer(
      "Photosynthesis converts sunlight to glucose.",
      "What is photosynthesis?",
      "Award marks for: light, glucose, chlorophyll.",
      10
    );

    expect(result.score).toBe(8);
    expect(result.confidence).toBe(90);
    expect(result.feedback).toBe("Good answer.");
  });

  it("should clamp score to 0 when AI returns a negative value", async () => {
    mockCreate.mockResolvedValue(
      fakeCompletion(JSON.stringify({ score: -3, confidence: 50, feedback: "Off topic." }))
    );

    const result = await evaluateSubjectiveAnswer("bad answer", "q", "rubric", 10);

    expect(result.score).toBe(0);
  });

  it("should clamp score to maxMarks when AI overshoots", async () => {
    mockCreate.mockResolvedValue(
      fakeCompletion(JSON.stringify({ score: 99, confidence: 80, feedback: "Great." }))
    );

    const result = await evaluateSubjectiveAnswer("perfect answer", "q", "rubric", 10);

    expect(result.score).toBe(10); // clamped to maxMarks
  });

  it("should clamp confidence to 100 when AI returns more than 100", async () => {
    mockCreate.mockResolvedValue(
      fakeCompletion(JSON.stringify({ score: 5, confidence: 150, feedback: "Fine." }))
    );

    const result = await evaluateSubjectiveAnswer("ok answer", "q", "rubric", 10);

    expect(result.confidence).toBe(100);
  });

  it("should return a fallback object when the API throws", async () => {
    mockCreate.mockRejectedValue(new Error("Rate limit exceeded"));

    const result = await evaluateSubjectiveAnswer("any", "q", "rubric", 10);

    expect(result.score).toBe(0);
    expect(result.confidence).toBe(0);
    expect(result.feedback).toMatch(/currently unavailable/i);
  });

  it("should return a fallback object when AI returns invalid JSON", async () => {
    mockCreate.mockResolvedValue(fakeCompletion("not json at all"));

    const result = await evaluateSubjectiveAnswer("any", "q", "rubric", 10);

    expect(result.score).toBe(0);
    expect(result.confidence).toBe(0);
    expect(result.feedback).toMatch(/error processing evaluation/i);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// generateStudyPlan
// ════════════════════════════════════════════════════════════════════════════

describe("generateStudyPlan()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return a structured plan and resources on success", async () => {
    const payload = {
      plan: "1. Review Newton's Laws. 2. Practice problems.",
      resources: [
        { title: "Khan Academy Physics", type: "video", url: "https://khanacademy.org/physics" },
        { title: "Physics Textbook Ch. 3", type: "article" },
      ],
    };
    mockCreate.mockResolvedValue(fakeCompletion(JSON.stringify(payload)));

    const result = await generateStudyPlan(["Newton's Laws", "Kinematics"], ["Optics"], "Physics");

    expect(result.plan).toContain("Newton's Laws");
    expect(result.resources).toHaveLength(2);
    expect(result.resources[0].type).toBe("video");
  });

  it("should return a fallback plan when the AI service throws", async () => {
    mockCreate.mockRejectedValue(new Error("Timeout"));

    const result = await generateStudyPlan(["Algebra"], ["Geometry"], "Math");

    expect(result.plan).toMatch(/failed|focus on reviewing/i);
    expect(result.resources).toBeInstanceOf(Array);
    expect(result.resources.length).toBeGreaterThan(0); // at least the fallback resource
  });

  it("should return a fallback plan when AI response is not valid JSON", async () => {
    mockCreate.mockResolvedValue(fakeCompletion("Here is your plan: review everything."));

    const result = await generateStudyPlan(["Topic1"], ["Topic2"], "Science");

    expect(result.plan).toMatch(/error generating/i);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// analyzeTestPerformance
// ════════════════════════════════════════════════════════════════════════════

describe("analyzeTestPerformance()", () => {
  beforeEach(() => vi.clearAllMocks());

  const sampleResults = [
    {
      studentId: 1,
      score: 80,
      answers: [
        { questionId: 1, score: 8, question: "Q1" },
        { questionId: 2, score: 2, question: "Q2" },
      ],
    },
    {
      studentId: 2,
      score: 60,
      answers: [
        { questionId: 1, score: 6, question: "Q1" },
        { questionId: 2, score: 4, question: "Q2" },
      ],
    },
  ];

  it("should return averageScore, hardestQuestions, and recommendations on success", async () => {
    const payload = {
      averageScore: 70,
      hardestQuestions: [{ questionId: 2, question: "Q2", avgScore: 3 }],
      recommendations: "Focus more on Q2 type problems.",
    };
    mockCreate.mockResolvedValue(fakeCompletion(JSON.stringify(payload)));

    const result = await analyzeTestPerformance(sampleResults);

    expect(result.averageScore).toBe(70);
    expect(result.hardestQuestions).toHaveLength(1);
    expect(result.recommendations).toMatch(/Q2/);
  });

  it("should compute averageScore locally as fallback when API throws", async () => {
    mockCreate.mockRejectedValue(new Error("Service unavailable"));

    const result = await analyzeTestPerformance(sampleResults);

    // Average of 80 and 60 = 70
    expect(result.averageScore).toBe(70);
    expect(result.hardestQuestions).toEqual([]);
    expect(result.recommendations).toMatch(/failed|review individual/i);
  });

  it("should compute averageScore locally when AI returns invalid JSON", async () => {
    mockCreate.mockResolvedValue(fakeCompletion("Looks like students did okay overall."));

    const result = await analyzeTestPerformance(sampleResults);

    expect(result.averageScore).toBe(70);
  });
});
