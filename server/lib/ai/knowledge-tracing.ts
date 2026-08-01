/**
 * Bayesian Knowledge Tracing (BKT) — the engine that turns a chatbot into a
 * tutor with memory. From each graded exchange it infers an updated probability
 * that the student has mastered a concept, modelling guess and slip so that one
 * correct answer does not imply mastery (per docs/second-tutor-research-report.md).
 *
 * Pure core (`bktUpdate`) + a thin recorder (`recordOutcome`) that reads the
 * prior mastery and hands the new estimate to the single writer
 * (`commitLearnerUpdate`). It never writes the learner tables directly.
 */
import { getPgPool, isPgReady } from "../../db-pg";
import { logger } from "../logger";
import { commitLearnerUpdate } from "./learner-model";

export interface BktParams {
  /** P(L0) — prior probability of mastery before any evidence. */
  pInit: number;
  /** P(T) — probability of transitioning to mastered after an opportunity. */
  pLearn: number;
  /** P(S) — probability of slipping (wrong despite mastery). */
  pSlip: number;
  /** P(G) — probability of guessing (right despite non-mastery). */
  pGuess: number;
}

export const DEFAULT_BKT: BktParams = { pInit: 0.25, pLearn: 0.15, pSlip: 0.1, pGuess: 0.2 };

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * One BKT step. Given the prior P(known) and whether the latest attempt was
 * correct, compute the posterior (accounting for guess/slip) and then apply the
 * learning transition. Returns the new P(known) in [0,1]. Pure and synchronous.
 */
export function bktUpdate(
  pKnown: number,
  correct: boolean,
  params: BktParams = DEFAULT_BKT
): number {
  const { pLearn, pSlip, pGuess } = params;
  const prior = clamp01(pKnown);
  const num = correct ? prior * (1 - pSlip) : prior * pSlip;
  const den = correct
    ? prior * (1 - pSlip) + (1 - prior) * pGuess
    : prior * pSlip + (1 - prior) * (1 - pGuess);
  const posterior = den > 0 ? num / den : prior;
  return clamp01(posterior + (1 - posterior) * pLearn);
}

async function readPriorMastery(
  studentId: number,
  concept: string
): Promise<{ pMastery: number; confidence: number } | null> {
  if (!isPgReady()) return null;
  try {
    const { rows } = await getPgPool().query(
      `SELECT p_mastery, confidence FROM learner_mastery WHERE student_id = $1 AND concept = $2`,
      [studentId, concept]
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      pMastery: typeof r.p_mastery === "number" ? r.p_mastery : parseFloat(r.p_mastery),
      confidence: typeof r.confidence === "number" ? r.confidence : parseFloat(r.confidence),
    };
  } catch (err) {
    logger.error("[knowledge-tracing] readPriorMastery failed", { err: String(err), studentId });
    return null;
  }
}

export interface MasteryUpdateResult {
  pMastery: number;
  confidence: number;
}

/**
 * Record a graded outcome for one concept and update the learner model. Reads
 * the prior mastery (or the BKT prior on first sight), applies one BKT step, and
 * commits the new estimate + an interaction-log entry through the single writer.
 * Confidence ratchets up with each observation (more evidence → surer estimate).
 */
export async function recordOutcome(
  studentId: number,
  concept: string,
  subject: string | null,
  correct: boolean,
  params: BktParams = DEFAULT_BKT
): Promise<MasteryUpdateResult> {
  const prior = (await readPriorMastery(studentId, concept)) ?? {
    pMastery: params.pInit,
    confidence: 0,
  };
  const pMastery = bktUpdate(prior.pMastery, correct, params);
  const confidence = Math.min(0.95, prior.confidence + 0.15);

  const committed = await commitLearnerUpdate(studentId, {
    masteryDeltas: [{ concept, subject, pMastery, confidence }],
    interaction: {
      kind: "kt_outcome",
      concept,
      payload: { correct, priorMastery: prior.pMastery, pMastery },
    },
  });
  if (!committed) {
    throw new Error(
      `Failed to persist mastery update for student ${studentId} (concept "${concept}")`
    );
  }

  return { pMastery, confidence };
}
