/**
 * SM-2 spaced-repetition scheduler. Retrieval practice spaced over expanding
 * intervals is among the most robust findings in learning science (the testing
 * effect) and is exactly what a stateless chatbot cannot do — it requires the
 * persistent learner model (see docs/second-tutor-research-report.md).
 *
 * Pure core (`sm2Next`) + a recorder (`recordReview`) that reads the concept's
 * current schedule, computes the next interval, and hands it to the single
 * writer (`commitLearnerUpdate`). `getDueReviews` surfaces the day's queue.
 */
import { getPgPool, isPgReady } from "../db-pg";
import { logger } from "./logger";
import { commitLearnerUpdate, getLearnerSnapshot, type LearnerDueReview } from "./learner-model";

export interface Sm2State {
  /** Easiness factor (SM-2), floored at 1.3. */
  sm2Ef: number;
  /** Current inter-repetition interval in days. */
  intervalDays: number;
  /** Number of successful repetitions in a row. */
  repetitions: number;
}

export const DEFAULT_SM2: Sm2State = { sm2Ef: 2.5, intervalDays: 0, repetitions: 0 };

const MS_PER_DAY = 86_400_000;

/**
 * One SM-2 step. `quality` is the recall grade in [0,5] (0 = blackout, 5 =
 * perfect). On a lapse (quality < 3) repetitions reset and the item is seen
 * again tomorrow; otherwise the interval expands by the easiness factor. The
 * easiness factor is adjusted by recall quality and floored at 1.3. Pure.
 */
export function sm2Next(prev: Sm2State, quality: number): Sm2State {
  const q = Math.max(0, Math.min(5, Math.round(quality)));
  let { sm2Ef, intervalDays, repetitions } = prev;

  if (q < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    if (repetitions === 0) intervalDays = 1;
    else if (repetitions === 1) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * sm2Ef);
    repetitions += 1;
  }

  sm2Ef = sm2Ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (sm2Ef < 1.3) sm2Ef = 1.3;

  return { sm2Ef, intervalDays, repetitions };
}

async function readSchedule(studentId: number, concept: string): Promise<Sm2State | null> {
  if (!isPgReady()) return null;
  try {
    const { rows } = await getPgPool().query(
      `SELECT sm2_ef, interval_days, repetitions
       FROM review_schedule WHERE student_id = $1 AND concept = $2`,
      [studentId, concept]
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      sm2Ef: typeof r.sm2_ef === "number" ? r.sm2_ef : parseFloat(r.sm2_ef),
      intervalDays:
        typeof r.interval_days === "number" ? r.interval_days : parseInt(r.interval_days, 10),
      repetitions:
        typeof r.repetitions === "number" ? r.repetitions : parseInt(r.repetitions, 10),
    };
  } catch (err) {
    logger.error("[spaced-repetition] readSchedule failed", { err: String(err), studentId });
    return null;
  }
}

export interface ReviewResult extends Sm2State {
  dueAt: Date;
}

/**
 * Record a review of `concept` at recall `quality` (0-5) and reschedule it.
 * Reads the current schedule (or starts fresh), applies one SM-2 step, computes
 * the next due date, and commits the new schedule + an interaction-log entry
 * through the single writer.
 */
export async function recordReview(
  studentId: number,
  concept: string,
  quality: number
): Promise<ReviewResult> {
  const prev = (await readSchedule(studentId, concept)) ?? DEFAULT_SM2;
  const next = sm2Next(prev, quality);
  const dueAt = new Date(Date.now() + next.intervalDays * MS_PER_DAY);

  await commitLearnerUpdate(studentId, {
    reviewUpdates: [
      {
        concept,
        sm2Ef: next.sm2Ef,
        intervalDays: next.intervalDays,
        repetitions: next.repetitions,
        dueAt,
      },
    ],
    interaction: {
      kind: "review",
      concept,
      payload: { quality, intervalDays: next.intervalDays, dueAt: dueAt.toISOString() },
    },
  });

  return { ...next, dueAt };
}

/** The student's "due today" review queue (concepts whose due_at has passed). */
export async function getDueReviews(studentId: number): Promise<LearnerDueReview[]> {
  const snapshot = await getLearnerSnapshot(studentId);
  return snapshot.dueReviews;
}
