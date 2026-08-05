export type AdaptiveRecommendation = "continue" | "supported_retry" | "prerequisite_refresh" | "schedule_recall";

export function getRecommendedNextAction(input: {
  correct: boolean;
  pMastery: number;
  prerequisiteMastery: number | null;
  helpDepth: number;
}): AdaptiveRecommendation {
  if (input.correct && input.pMastery >= 0.7) return "schedule_recall";
  if (!input.correct && input.prerequisiteMastery !== null && input.prerequisiteMastery < 0.4) {
    return "prerequisite_refresh";
  }
  if (!input.correct || input.helpDepth >= 3) return "supported_retry";
  return "continue";
}
