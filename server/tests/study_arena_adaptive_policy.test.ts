import { describe, it, expect } from "vitest";
import { getRecommendedNextAction } from "../services/study-arena/adaptive-policy";

describe("getRecommendedNextAction", () => {
  it("returns schedule_recall when correct and mastery is at or above 0.7", () => {
    expect(
      getRecommendedNextAction({
        correct: true,
        pMastery: 0.7,
        prerequisiteMastery: null,
        helpDepth: 0,
      })
    ).toBe("schedule_recall");
    expect(
      getRecommendedNextAction({
        correct: true,
        pMastery: 0.85,
        prerequisiteMastery: null,
        helpDepth: 0,
      })
    ).toBe("schedule_recall");
  });

  it("returns prerequisite_refresh when incorrect and prerequisite mastery is below 0.4", () => {
    expect(
      getRecommendedNextAction({
        correct: false,
        pMastery: 0.5,
        prerequisiteMastery: 0.39,
        helpDepth: 0,
      })
    ).toBe("prerequisite_refresh");
    expect(
      getRecommendedNextAction({
        correct: false,
        pMastery: 0.2,
        prerequisiteMastery: 0,
        helpDepth: 2,
      })
    ).toBe("prerequisite_refresh");
  });

  it("returns supported_retry when incorrect without a prerequisite gap", () => {
    expect(
      getRecommendedNextAction({
        correct: false,
        pMastery: 0.5,
        prerequisiteMastery: null,
        helpDepth: 0,
      })
    ).toBe("supported_retry");
    expect(
      getRecommendedNextAction({
        correct: false,
        pMastery: 0.5,
        prerequisiteMastery: 0.4,
        helpDepth: 1,
      })
    ).toBe("supported_retry");
  });

  it("returns supported_retry when helpDepth reaches 3 even if the answer was correct", () => {
    expect(
      getRecommendedNextAction({
        correct: true,
        pMastery: 0.5,
        prerequisiteMastery: null,
        helpDepth: 3,
      })
    ).toBe("supported_retry");
    expect(
      getRecommendedNextAction({
        correct: true,
        pMastery: 0.69,
        prerequisiteMastery: null,
        helpDepth: 4,
      })
    ).toBe("supported_retry");
  });

  it("returns continue when correct, mastery below 0.7, and helpDepth under 3", () => {
    expect(
      getRecommendedNextAction({
        correct: true,
        pMastery: 0.69,
        prerequisiteMastery: null,
        helpDepth: 2,
      })
    ).toBe("continue");
    expect(
      getRecommendedNextAction({
        correct: true,
        pMastery: 0,
        prerequisiteMastery: null,
        helpDepth: 0,
      })
    ).toBe("continue");
  });

  it("treats 0.4 prerequisite mastery as sufficient (no refresh)", () => {
    expect(
      getRecommendedNextAction({
        correct: false,
        pMastery: 0.3,
        prerequisiteMastery: 0.4,
        helpDepth: 0,
      })
    ).toBe("supported_retry");
  });
});
