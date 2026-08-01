import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { gradeTutorTurn } from "../lib/ai/grader-service";
import { generate } from "../lib/ai/gateway";
import { commitTurnOutcome } from "../lib/ai/orchestrator";

// Mock AI Gateway and Orchestrator
vi.mock("../lib/ai/gateway", () => ({
  generate: vi.fn(),
}));

vi.mock("../lib/ai/orchestrator", () => ({
  commitTurnOutcome: vi.fn(),
  runTutorTurn: vi.fn(),
}));

describe("Grader Service Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should successfully grade a student response and commit outcome", async () => {
    (generate as Mock).mockResolvedValue(
      JSON.stringify({
        correct: true,
        reviewQuality: 4,
        rationale: "Student explained gravity equation correctly.",
      })
    );

    await gradeTutorTurn({
      studentId: 42,
      concept: "gravity",
      subject: "physics",
      history: [
        { role: "user", content: "What is gravity?" },
        { role: "assistant", content: "It attracts masses." },
      ],
      latestMessage: "F = G * m1 * m2 / r^2",
    });

    expect(generate).toHaveBeenCalledOnce();
    const genArgs = (generate as Mock).mock.calls[0][0];
    expect(genArgs.model).toBe("grader");
    expect(genArgs.jsonMode).toBe(true);
    expect(genArgs.messages).toHaveLength(3);
    expect(genArgs.messages[2]).toEqual({ role: "user", content: "F = G * m1 * m2 / r^2" });

    expect(commitTurnOutcome).toHaveBeenCalledOnce();
    expect(commitTurnOutcome).toHaveBeenCalledWith({
      studentId: 42,
      concept: "gravity",
      subject: "physics",
      correct: true,
      reviewQuality: 4,
    });
  });

  it("should handle grader API errors gracefully without throwing", async () => {
    (generate as Mock).mockRejectedValue(new Error("Rate limit exceeded"));

    await expect(
      gradeTutorTurn({
        studentId: 42,
        concept: "gravity",
        subject: "physics",
        history: [],
        latestMessage: "F = G",
      })
    ).resolves.not.toThrow();

    expect(commitTurnOutcome).not.toHaveBeenCalled();
  });

  it("should handle timeout abort signal gracefully without throwing", async () => {
    (generate as Mock).mockImplementation(() => {
      // Simulate timeout abort
      const err = new Error("The user aborted a request.");
      err.name = "AbortError";
      throw err;
    });

    await expect(
      gradeTutorTurn({
        studentId: 42,
        concept: "gravity",
        subject: "physics",
        history: [],
        latestMessage: "F = G",
      })
    ).resolves.not.toThrow();

    expect(commitTurnOutcome).not.toHaveBeenCalled();
  });

  it("should enforce bounds of 0-5 for SM-2 reviewQuality", async () => {
    (generate as Mock).mockResolvedValue(
      JSON.stringify({
        correct: true,
        reviewQuality: 10, // out of bounds
        rationale: "Too high",
      })
    );

    await gradeTutorTurn({
      studentId: 42,
      concept: "gravity",
      subject: "physics",
      history: [],
      latestMessage: "F = G",
    });

    expect(commitTurnOutcome).toHaveBeenCalledWith({
      studentId: 42,
      concept: "gravity",
      subject: "physics",
      correct: true,
      reviewQuality: 5, // capped at 5
    });
  });
});
