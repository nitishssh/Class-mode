import {
  gradeLinearEquationsAssessment,
  type LinearEquationsAssessmentId,
} from "./lesson-script";

export interface AssessmentEvaluation {
  correct: boolean;
  confidence: number;
  misconceptionCode: string | null;
}

export type AssessmentEvaluationTargets =
  | {
      acceptedInferences: string[];
      requiredEvidenceTerms: string[];
    }
  | {
      acceptedCauses: string[];
      acceptedEffects: string[];
    };

function normalize(value: string): string {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function containsOne(answer: string, targets: string[]): boolean {
  return targets.some((target) => answer.includes(normalize(target)));
}

/**
 * Registry of server-owned evaluators. Per-lesson targets are retained in
 * private lesson-version metadata, never in scene JSON or the client bundle.
 */
export function evaluateAssessment(
  assessmentId: string,
  answer: string,
  targets?: AssessmentEvaluationTargets | null
): AssessmentEvaluation {
  if (
    assessmentId === "linear-equations-immediate" ||
    assessmentId === "linear-equations-delayed"
  ) {
    const correct = gradeLinearEquationsAssessment(
      assessmentId as LinearEquationsAssessmentId,
      answer
    );
    return {
      correct,
      confidence: 1,
      misconceptionCode: correct ? null : "inverse-operation",
    };
  }

  if (assessmentId === "photosynthesis-transfer") {
    const normalized = answer.toLowerCase();
    const hasLight = /\b(light|sunlight)\b/.test(normalized);
    const hasCarbonDioxide = /\b(carbon dioxide|co2)\b/.test(normalized);
    const hasGlucose = /\b(glucose|sugar|food)\b/.test(normalized);
    const correct = hasLight && hasCarbonDioxide && hasGlucose;
    return {
      correct,
      confidence: 1,
      misconceptionCode: correct ? null : "photosynthesis-input-output",
    };
  }

  if (assessmentId === "english-reading-inference") {
    if (!targets || !("acceptedInferences" in targets)) {
      throw new Error("English assessment is missing server-owned evaluator targets");
    }
    const normalized = normalize(answer);
    const hasInference = containsOne(normalized, targets.acceptedInferences);
    const hasEvidence = containsOne(normalized, targets.requiredEvidenceTerms);
    const correct = hasInference && hasEvidence;
    return {
      correct,
      confidence: 1,
      misconceptionCode: correct ? null : hasInference ? "missing-textual-evidence" : "unsupported-inference",
    };
  }

  if (assessmentId === "social-studies-causation") {
    if (!targets || !("acceptedCauses" in targets)) {
      throw new Error("Social Studies assessment is missing server-owned evaluator targets");
    }
    const normalized = normalize(answer);
    const hasCause = containsOne(normalized, targets.acceptedCauses);
    const hasEffect = containsOne(normalized, targets.acceptedEffects);
    const correct = hasCause && hasEffect;
    return {
      correct,
      confidence: 1,
      misconceptionCode: correct ? null : hasCause ? "missing-historical-effect" : "missing-historical-cause",
    };
  }

  throw new Error(`No evaluator registered for assessment: ${assessmentId}`);
}
