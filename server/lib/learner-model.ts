/**
 * Single-writer learner model for the AI tutor.
 *
 * This is the KEYSTONE data layer: the persistent student/learner model that
 * knowledge tracing, spaced repetition, adaptive difficulty, and memory all
 * depend on. The design (see docs/second-tutor-research-report.md) is a
 * single-writer model in Postgres — `commitLearnerUpdate` is the ONLY writer
 * and applies every change for a turn inside ONE transaction. Every other
 * component is a pure function that reads a snapshot (`getLearnerSnapshot`)
 * and proposes typed deltas, which are then handed to the single writer.
 */
import type { PoolClient } from "pg";
import { getPgPool, isPgReady } from "../db-pg";
import { logger } from "./logger";

// ─── Snapshot shapes (read side) ──────────────────────────────────────────────

export interface LearnerMasteryRow {
  concept: string;
  subject: string | null;
  pMastery: number;
  confidence: number;
  updatedAt: Date;
}

export interface LearnerDueReview {
  concept: string;
  sm2Ef: number;
  intervalDays: number;
  repetitions: number;
  dueAt: Date;
  lastReviewedAt: Date | null;
}

export interface LearnerMemoryNote {
  note: string;
  createdAt: Date;
}

export interface LearnerSnapshot {
  /** Per-concept mastery vector (BKT-style p_mastery in [0,1]). */
  mastery: LearnerMasteryRow[];
  /** Concepts whose review is due now (due_at <= now). */
  dueReviews: LearnerDueReview[];
  /** Most recent durable memory notes, newest first. */
  recentMemory: LearnerMemoryNote[];
}

// ─── Update shapes (write side) ───────────────────────────────────────────────

export interface MasteryDelta {
  concept: string;
  subject?: string | null;
  pMastery: number;
  confidence: number;
}

export interface ReviewUpdate {
  concept: string;
  sm2Ef: number;
  intervalDays: number;
  repetitions: number;
  dueAt: Date;
}

export interface InteractionRecord {
  kind: string;
  concept?: string | null;
  payload?: Record<string, any>;
}

export interface LearnerUpdate {
  /** Upserts into learner_mastery (ON CONFLICT (student_id, concept)). */
  masteryDeltas?: MasteryDelta[];
  /** Upserts into review_schedule (ON CONFLICT (student_id, concept)). */
  reviewUpdates?: ReviewUpdate[];
  /** Appends a durable memory note. */
  memoryNote?: string;
  /** Appends an entry to the append-only interaction log. */
  interaction?: InteractionRecord;
}

// ─── Row mappers ──────────────────────────────────────────────────────────────

function mapMastery(r: any): LearnerMasteryRow {
  return {
    concept: r.concept,
    subject: r.subject ?? null,
    pMastery: typeof r.p_mastery === "number" ? r.p_mastery : parseFloat(r.p_mastery),
    confidence: typeof r.confidence === "number" ? r.confidence : parseFloat(r.confidence),
    updatedAt: r.updated_at,
  };
}

function mapDueReview(r: any): LearnerDueReview {
  return {
    concept: r.concept,
    sm2Ef: typeof r.sm2_ef === "number" ? r.sm2_ef : parseFloat(r.sm2_ef),
    intervalDays:
      typeof r.interval_days === "number" ? r.interval_days : parseInt(r.interval_days, 10),
    repetitions: typeof r.repetitions === "number" ? r.repetitions : parseInt(r.repetitions, 10),
    dueAt: r.due_at,
    lastReviewedAt: r.last_reviewed_at ?? null,
  };
}

function mapMemoryNote(r: any): LearnerMemoryNote {
  return {
    note: r.note,
    createdAt: r.created_at,
  };
}

// ─── Snapshot reader ──────────────────────────────────────────────────────────

const EMPTY_SNAPSHOT: LearnerSnapshot = { mastery: [], dueReviews: [], recentMemory: [] };

/**
 * Read a consistent snapshot of the learner model for a student: the full
 * mastery vector, the reviews that are currently due, and the most recent
 * durable memory notes. Pure read — callers derive proposed deltas from this
 * and hand them to `commitLearnerUpdate`.
 */
export async function getLearnerSnapshot(studentId: number): Promise<LearnerSnapshot> {
  if (!isPgReady()) return { mastery: [], dueReviews: [], recentMemory: [] };
  try {
    const pool = getPgPool();
    const [masteryRes, dueRes, memoryRes] = await Promise.all([
      pool.query(
        `SELECT concept, subject, p_mastery, confidence, updated_at
         FROM learner_mastery
         WHERE student_id = $1
         ORDER BY concept`,
        [studentId]
      ),
      pool.query(
        `SELECT concept, sm2_ef, interval_days, repetitions, due_at, last_reviewed_at
         FROM review_schedule
         WHERE student_id = $1 AND due_at <= now()
         ORDER BY due_at`,
        [studentId]
      ),
      pool.query(
        `SELECT note, created_at
         FROM memory_notes
         WHERE student_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [studentId]
      ),
    ]);
    return {
      mastery: masteryRes.rows.map(mapMastery),
      dueReviews: dueRes.rows.map(mapDueReview),
      recentMemory: memoryRes.rows.map(mapMemoryNote),
    };
  } catch (err) {
    logger.error("[learner-model] getLearnerSnapshot failed", { err: String(err), studentId });
    return { mastery: [], dueReviews: [], recentMemory: [] };
  }
}

// ─── Single-writer commit ─────────────────────────────────────────────────────

/**
 * The single writer. Applies ALL proposed updates for one tutor turn inside a
 * single transaction (BEGIN/COMMIT/ROLLBACK on one pooled client): mastery
 * upserts, review-schedule upserts, a memory note, and an interaction-log
 * entry. This is the single-writer invariant — no other code path mutates the
 * learner model tables. Returns true on commit, false if Postgres is
 * unavailable or the transaction rolled back.
 */
export async function commitLearnerUpdate(
  studentId: number,
  update: LearnerUpdate
): Promise<boolean> {
  if (!isPgReady()) return false;
  let client: PoolClient | undefined;
  try {
    client = await getPgPool().connect();
    await client.query("BEGIN");

    for (const d of update.masteryDeltas ?? []) {
      await client.query(
        `INSERT INTO learner_mastery (student_id, concept, subject, p_mastery, confidence, updated_at)
         VALUES ($1, $2, $3, $4, $5, now())
         ON CONFLICT (student_id, concept) DO UPDATE
           SET subject    = EXCLUDED.subject,
               p_mastery  = EXCLUDED.p_mastery,
               confidence = EXCLUDED.confidence,
               updated_at = now()`,
        [studentId, d.concept, d.subject ?? null, d.pMastery, d.confidence]
      );
    }

    for (const r of update.reviewUpdates ?? []) {
      await client.query(
        `INSERT INTO review_schedule
           (student_id, concept, sm2_ef, interval_days, repetitions, due_at, last_reviewed_at)
         VALUES ($1, $2, $3, $4, $5, $6, now())
         ON CONFLICT (student_id, concept) DO UPDATE
           SET sm2_ef           = EXCLUDED.sm2_ef,
               interval_days    = EXCLUDED.interval_days,
               repetitions      = EXCLUDED.repetitions,
               due_at           = EXCLUDED.due_at,
               last_reviewed_at = now()`,
        [studentId, r.concept, r.sm2Ef, r.intervalDays, r.repetitions, r.dueAt]
      );
    }

    if (update.memoryNote != null && update.memoryNote.trim().length > 0) {
      await client.query(`INSERT INTO memory_notes (student_id, note) VALUES ($1, $2)`, [
        studentId,
        update.memoryNote,
      ]);
    }

    if (update.interaction) {
      await client.query(
        `INSERT INTO interaction_log (student_id, kind, concept, payload)
         VALUES ($1, $2, $3, $4)`,
        [
          studentId,
          update.interaction.kind,
          update.interaction.concept ?? null,
          JSON.stringify(update.interaction.payload ?? {}),
        ]
      );
    }

    await client.query("COMMIT");
    return true;
  } catch (err) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackErr) {
        logger.error("[learner-model] commitLearnerUpdate rollback failed", {
          err: String(rollbackErr),
          studentId,
        });
      }
    }
    logger.error("[learner-model] commitLearnerUpdate failed", { err: String(err), studentId });
    return false;
  } finally {
    if (client) client.release();
  }
}
