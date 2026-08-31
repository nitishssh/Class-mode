/**
 * Autoplan T12: publishes committed events from `event_outbox` to the stream.
 *
 * The attendance route used to claim its idempotency key and then fire-and-forget
 * `publishEvent`. A lost publish left the key claimed, so every retry of that
 * save read as a replay and the parent alert was suppressed permanently — the
 * failure mode was silent and unrecoverable. The write, the claim and the event
 * now commit together; this loop moves them onto the bus afterwards.
 *
 * At-least-once by design: a row is stamped only after a successful publish, so
 * a crash between publish and stamp re-publishes it. That is the weaker and
 * safer of the two errors — the consumer already tolerates duplicates, and a
 * duplicate absence alert is recoverable where a missing one is not.
 */
import { publishEvent } from "../lib/events";
import type { EventTopic } from "../lib/events";
import { isRedisConfigured } from "../lib/db/redis";
import {
  pgFetchUndispatchedOutbox,
  pgMarkOutboxDispatched,
} from "../lib/db/pg-queries";
import { logger } from "../lib/logger";

const TICK_MS = 5_000;
const BATCH = 100;

/** One pass. Returns how many rows were published. Never throws. */
export async function dispatchOutboxOnce(): Promise<number> {
  if (!isRedisConfigured()) return 0;
  try {
    const rows = await pgFetchUndispatchedOutbox(BATCH);
    if (rows.length === 0) return 0;

    const dispatched: string[] = [];
    for (const row of rows) {
      try {
        publishEvent(row.topic as EventTopic, {
          schoolCode: row.schoolCode ?? undefined,
          userId: row.userId ?? undefined,
          payload: row.payload,
        } as Parameters<typeof publishEvent>[1]);
        dispatched.push(row.id);
      } catch (err) {
        // Leave it unstamped; the next tick retries it.
        logger.warn("[outbox] publish failed, will retry", {
          id: row.id,
          topic: row.topic,
          err: String(err),
        });
      }
    }

    if (dispatched.length > 0) {
      await pgMarkOutboxDispatched(dispatched);
      logger.info("[outbox] dispatched events", { count: dispatched.length });
    }
    return dispatched.length;
  } catch (err) {
    logger.error("[outbox] dispatch pass failed", { err: String(err) });
    return 0;
  }
}

/** Starts the dispatcher loop. Returns the timer, or null when Redis is off. */
export function startOutboxDispatcher(): NodeJS.Timeout | null {
  if (!isRedisConfigured()) return null;
  const timer = setInterval(() => void dispatchOutboxOnce(), TICK_MS);
  timer.unref?.();
  return timer;
}
