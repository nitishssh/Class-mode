import { Rubric, RubricCriterion, RubricSchema } from "../../shared/grading-schema";

/**
 * Parse and validate a rubric JSON string or object.
 * Returns a strongly-typed Rubric.
 */
export function parseRubric(input: string | object): Rubric {
  const raw = typeof input === "string" ? JSON.parse(input) : input;
  const rubric = RubricSchema.parse(raw);
  validateWeights(rubric.criteria);
  return rubric;
}

/**
 * Validate that criterion weights sum to ~1.0 (within 0.01 tolerance).
 */
export function validateWeights(criteria: RubricCriterion[]): void {
  const sum = criteria.reduce((acc, c) => acc + c.weight, 0 as number);
  if (Math.abs(sum - 1.0) > 0.01) {
    throw new Error(
      `Rubric weights must sum to 1.0, but got ${sum.toFixed(2)}. ` +
        `Please adjust the weights of each criterion.`
    );
  }
}

/**
 * Build a prompt string from a rubric for inclusion in the OpenAI system prompt.
 */
export function rubricToPrompt(rubric: Rubric): string {
  const lines = rubric.criteria.map((c) => {
    const points = c.maxPoints ?? 10;
    return `- ${c.name} (${points} pts, weight ${(c.weight * 100).toFixed(0)}%): ${c.description ?? "No description"}`;
  });
  return `
GRADING RUBRIC: ${rubric.title}
Type: ${rubric.gradingType}
Total Points: ${rubric.totalPoints}

Criteria:
${lines.join("\n")}

IMPORTANT: Your score for each criterion must be between 0 and the criterion's maxPoints.
The final total must not exceed ${rubric.totalPoints}.
`.trim();
}

/**
 * Calculate the weighted total from individual criterion scores.
 */
export function calculateWeightedTotal(
  criterionScores: { name: string; score: number; maxScore: number; weight: number }[]
): number {
  return criterionScores.reduce((acc, cs) => acc + cs.score * cs.weight, 0 as number);
}

/**
 * Normalize a raw score to a 0-100 percentage based on rubric totalPoints.
 */
export function normalizeToPercentage(rawScore: number, totalPoints: number): number {
  if (totalPoints === 0) return 0;
  return Math.round((rawScore / totalPoints) * 100);
}
