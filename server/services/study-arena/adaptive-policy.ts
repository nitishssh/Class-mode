export type AdaptiveRecommendation = "continue" | "supported_retry" | "prerequisite_refresh" | "schedule_recall";

/**
 * Thresholds the player routes on. Exported so the teacher-facing reliance view
 * groups students by the same numbers the lesson already acted on — a student
 * the player sent to prerequisite_refresh should be the student the dashboard
 * calls a prerequisite gap, not a near miss on a second set of constants.
 */
export const MASTERED_THRESHOLD = 0.7;
export const WEAK_PREREQUISITE_THRESHOLD = 0.4;
export const HIGH_HELP_DEPTH = 3;

export function getRecommendedNextAction(input: {
  correct: boolean;
  pMastery: number;
  prerequisiteMastery: number | null;
  helpDepth: number;
}): AdaptiveRecommendation {
  if (input.correct && input.pMastery >= MASTERED_THRESHOLD) return "schedule_recall";
  if (
    !input.correct &&
    input.prerequisiteMastery !== null &&
    input.prerequisiteMastery < WEAK_PREREQUISITE_THRESHOLD
  ) {
    return "prerequisite_refresh";
  }
  if (!input.correct || input.helpDepth >= HIGH_HELP_DEPTH) return "supported_retry";
  return "continue";
}
