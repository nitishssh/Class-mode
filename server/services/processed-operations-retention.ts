/**
 * Retention for the attendance idempotency table.
 *
 * `processed_operations` grows one row per attendance save per teacher, forever.
 * The schema has carried an index on `created_at` since it was written — as
 * though a purge was intended — but none existed.
 *
 * The window is not a free choice. `pgClaimOperation` fails OPEN: a missing
 * op_id means "never seen", so deleting a key a client could still replay makes
 * that replay look like a fresh save, re-messaging a parent and re-counting a
 * marking day. The floor is therefore however long a save can survive on a
 * device, which is bounded by the server's own backfill window
 * (MAX_BACKFILL_DAYS): older saves are rejected 4xx and the client marks them
 * permanently failed, so they stop replaying.
 *
 * 30 days is that floor with a wide margin — an app upgrade, a holiday, or a
 * phone left in a drawer all fit inside it, and the table is small enough that
 * keeping a month costs nothing.
 */
import {
  pgPurgeProcessedOperations,
  pgPurgeNotificationFailures,
} from "../lib/db/pg-queries";
import { MAX_BACKFILL_DAYS } from "../routes/attendance";
import { logger } from "../lib/logger";

export const PROCESSED_OPS_RETENTION_DAYS = 30;

/**
 * Invariant, asserted by a test: the retention window must comfortably outlive
 * the window in which a client's replay can still be accepted. If someone
 * shortens this, or lengthens MAX_BACKFILL_DAYS past it, that test fails.
 */
export const RETENTION_SAFETY_MARGIN_DAYS = PROCESSED_OPS_RETENTION_DAYS - MAX_BACKFILL_DAYS;

const HOUR_MS = 60 * 60 * 1000;

export async function purgeExpiredOperations(): Promise<number> {
  try {
    const deleted = await pgPurgeProcessedOperations({
      retentionDays: PROCESSED_OPS_RETENTION_DAYS,
    });
    if (deleted > 0) {
      logger.info("[retention] purged processed_operations", {
        deleted,
        retentionDays: PROCESSED_OPS_RETENTION_DAYS,
      });
    }
    // Autoplan T5: notification_failures is a pointer table with the same
    // "old rows help nobody" property, so it expires on the same schedule.
    const failuresDeleted = await pgPurgeNotificationFailures(PROCESSED_OPS_RETENTION_DAYS);
    if (failuresDeleted > 0) {
      logger.info("[retention] purged notification_failures", {
        deleted: failuresDeleted,
        retentionDays: PROCESSED_OPS_RETENTION_DAYS,
      });
    }
    return deleted;
  } catch (err) {
    // Never throw from a background timer: a failed purge is a growing table,
    // not a broken register. Loud log, try again next tick.
    logger.error("[retention] processed_operations purge failed", { err: String(err) });
    return 0;
  }
}

/** Starts the daily purge. Returns the timer so tests and shutdown can clear it. */
export function startProcessedOperationsRetention(): NodeJS.Timeout {
  void purgeExpiredOperations();
  const timer = setInterval(() => void purgeExpiredOperations(), 24 * HOUR_MS);
  // Do not hold the process open for a retention timer.
  timer.unref?.();
  return timer;
}
