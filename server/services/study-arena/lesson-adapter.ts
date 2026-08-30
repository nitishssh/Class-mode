import type { LessonScene } from "./lesson-script";

/**
 * Strips AI-generated answer keys from the learner-facing JSON payload.
 * Provides secure '[REDACTED]' masking so the client never receives the correct answer.
 */
export function redactAnswersFromLearnerScene(scene: LessonScene): LessonScene {
  return {
    ...scene,
    actions: scene.actions.map((action: any) => {
      if (action.type === "ask" && action.answerKey) {
        return { ...action, answerKey: "[REDACTED]" };
      }
      return action;
    }),
  };
}

/**
 * Validates a submitted answer to ensure it does not attempt to supply a redacted or leaked answer key.
 * Reject attempts that try to supply an un-redacted answer key.
 */
export function validateLearnerAttempt(answer: string): boolean {
  if (answer.trim() === "[REDACTED]" || answer.includes("[REDACTED]")) {
    return false;
  }
  return true;
}
