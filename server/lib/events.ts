import { getRedis, newRedisConnection, isRedisConfigured } from "./db/redis";
import { logger } from "./logger";

/**
 * Domain event bus — Redis Streams backend, Kafka-shaped interface.
 *
 * Why Streams and not Kafka: this app is a single Cloud Run service serving a
 * pilot; Kafka would add a cluster (or managed spend) for zero current
 * consumers. Streams give the same model — append-only topics, consumer
 * groups, explicit acks, replayable history — on infrastructure we already
 * run. The interface below is deliberately narrow (publish / subscribe with
 * group + handler) so a future Kafka migration is a driver swap here, not a
 * rearchitecture at call sites. Same playbook as server/lib/ai/gateway.ts.
 *
 * Degradation: with REDIS_URL unset, publishEvent() is a no-op (callers keep
 * their inline fallbacks) and subscribers simply don't start.
 */

export type EventTopic = "attendance.marked" | "fee.created" | "fee.paid";

export interface DomainEvent<T = Record<string, unknown>> {
  topic: EventTopic;
  /** ISO timestamp set at publish time. */
  at: string;
  /** Tenant the event belongs to (null for platform-level events). */
  schoolCode: string | null;
  /** Actor user id, when applicable. */
  userId?: number;
  payload: T;
}

const STREAM_PREFIX = "events:";
/** Cap per-topic history; ~ is approximate trimming (cheap). */
const MAX_STREAM_LENGTH = 10_000;

/** Dead-letter stream for entries that exhausted their delivery budget. */
const DEAD_PREFIX = "events:dead:";

/**
 * Autoplan T13: how many times one entry may be delivered before it is parked.
 *
 * A handler that throws leaves its entry pending, and XAUTOCLAIM reclaims it
 * every ~60s — forever, with no cap. For a consumer that does I/O that is a
 * poison pill: a single bad payload, or a DB blip mid-handler, re-runs the
 * handler once a minute indefinitely. For notifications-consumer specifically
 * that means every parent whose message ALREADY sent gets it again, once a
 * minute, for a product whose written promise is that it does not message
 * parents at all.
 *
 * Five attempts is generous for transient faults (five minutes of retries) and
 * short enough that a genuine poison pill stops hurting quickly.
 */
export const MAX_DELIVERY_ATTEMPTS = 5;

/**
 * Should this reclaimed entry be parked instead of retried? Pure so the policy
 * is testable without Redis.
 *
 * `deliveryCount` is Redis's own counter (from XPENDING), so it survives
 * process restarts — an in-memory tally would reset on every deploy and let a
 * poison pill live forever across restarts.
 */
export function shouldDeadLetter(deliveryCount: number, max = MAX_DELIVERY_ATTEMPTS): boolean {
  return deliveryCount >= max;
}

/** The record parked in the dead-letter stream. Shaped for a human reading it later. */
export function deadLetterFields(params: {
  topic: string;
  id: string;
  raw: string;
  deliveries: number;
  reason: string;
}): string[] {
  return [
    "event",
    params.raw,
    "topic",
    params.topic,
    "originalId",
    params.id,
    "deliveries",
    String(params.deliveries),
    "reason",
    params.reason,
    "deadLetteredAt",
    new Date().toISOString(),
  ];
}

/**
 * Append an event to its topic stream. Fire-and-forget by design — callers
 * must not fail their request path on event-bus errors.
 */
export function publishEvent<T>(
  topic: EventTopic,
  event: Omit<DomainEvent<T>, "topic" | "at">
): void {
  const c = getRedis();
  if (!c) return; // Redis off — silently skip; callers keep inline fallbacks.
  const full: DomainEvent<T> = { topic, at: new Date().toISOString(), ...event };
  c.xadd(
    STREAM_PREFIX + topic,
    "MAXLEN",
    "~",
    String(MAX_STREAM_LENGTH),
    "*",
    "event",
    JSON.stringify(full)
  ).catch((err) => logger.warn(`[events] publish failed for ${topic}`, { err: String(err) }));
}

/**
 * Redis's delivery counter for one pending entry, or null when it cannot be
 * read. Null means "do not park" — a probe failure must never discard an event,
 * so the entry is retried as before.
 */
async function deliveryCountOf(
  conn: NonNullable<ReturnType<typeof newRedisConnection>>,
  stream: string,
  group: string,
  id: string
): Promise<number | null> {
  try {
    const rows = (await conn.xpending(stream, group, id, id, 1)) as
      [string, string, number, number][] | null;
    const count = rows?.[0]?.[3];
    return typeof count === "number" ? count : null;
  } catch {
    return null;
  }
}

export interface SubscribeOptions<T> {
  topic: EventTopic;
  /** Consumer group (one delivery per group, Kafka-style). */
  group: string;
  /** Consumer name within the group (defaults to pid-based). */
  consumer?: string;
  handler: (event: DomainEvent<T>) => Promise<void>;
}

const runningLoops: AbortController[] = [];

/**
 * Start a consumer-group loop for a topic. Each event is delivered once per
 * group and acked only after the handler resolves; a handler failure leaves
 * the entry pending for redelivery (XAUTOCLAIM by a future consumer / retry
 * on restart). No-op (returns false) when Redis is not configured.
 */
export function subscribe<T>(opts: SubscribeOptions<T>): boolean {
  if (!isRedisConfigured()) return false;
  const stream = STREAM_PREFIX + opts.topic;
  const consumer = opts.consumer ?? `c-${process.pid}`;
  const conn = newRedisConnection(`events:${opts.group}`);
  if (!conn) return false;

  const abort = new AbortController();
  runningLoops.push(abort);

  void (async () => {
    try {
      await conn.connect();
      await conn.xgroup("CREATE", stream, opts.group, "0", "MKSTREAM").catch((err: unknown) => {
        // BUSYGROUP = group already exists; anything else is real.
        if (!String(err).includes("BUSYGROUP")) throw err;
      });
      logger.info(`[events] consumer ${opts.group}/${consumer} listening on ${opts.topic}`);

      while (!abort.signal.aborted) {
        try {
          // 1. Reclaim entries a dead consumer left pending (>60s), then 2. read new.
          const claimed = (await conn.xautoclaim(
            stream,
            opts.group,
            consumer,
            60_000,
            "0-0",
            "COUNT",
            10
          )) as [string, [string, string[]][]];
          const pending = claimed?.[1] ?? [];

          const fresh = (await conn.xreadgroup(
            "GROUP",
            opts.group,
            consumer,
            "COUNT",
            10,
            "BLOCK",
            5_000,
            "STREAMS",
            stream,
            ">"
          )) as [string, [string, string[]][]][] | null;

          // Reclaimed entries have failed at least once. Check Redis's own
          // delivery counter BEFORE running the handler again: past the cap the
          // entry is parked, not retried (T13).
          const pendingIds = new Set(pending.map(([id]) => id));
          const entries = [...pending, ...(fresh?.[0]?.[1] ?? [])];
          for (const [id, fields] of entries) {
            const raw = fields[fields.indexOf("event") + 1];

            if (pendingIds.has(id)) {
              const deliveries = await deliveryCountOf(conn, stream, opts.group, id);
              if (deliveries !== null && shouldDeadLetter(deliveries)) {
                try {
                  await conn.xadd(
                    DEAD_PREFIX + opts.topic,
                    "MAXLEN",
                    "~",
                    String(MAX_STREAM_LENGTH),
                    "*",
                    ...deadLetterFields({
                      topic: opts.topic,
                      id,
                      raw,
                      deliveries,
                      reason: "delivery budget exhausted",
                    })
                  );
                  await conn.xack(stream, opts.group, id);
                  logger.error(
                    `[events] ${opts.topic}#${id} dead-lettered after ${deliveries} deliveries`,
                    { stream: DEAD_PREFIX + opts.topic }
                  );
                } catch (err) {
                  // Parking failed — leave it pending rather than dropping it.
                  logger.error(`[events] dead-letter failed for ${opts.topic}#${id}`, {
                    err: String(err),
                  });
                }
                continue;
              }
            }

            try {
              await opts.handler(JSON.parse(raw) as DomainEvent<T>);
              await conn.xack(stream, opts.group, id);
            } catch (err) {
              logger.error(`[events] handler failed for ${opts.topic}#${id} — left pending`, {
                err: String(err),
              });
            }
          }
        } catch (err) {
          if (abort.signal.aborted) break;
          logger.warn(`[events] consumer loop error on ${opts.topic}`, { err: String(err) });
          await new Promise((r) => setTimeout(r, 5_000));
        }
      }
    } catch (err) {
      logger.error(`[events] consumer ${opts.group} failed to start on ${opts.topic}`, {
        err: String(err),
      });
    } finally {
      conn.disconnect();
    }
  })();

  return true;
}

/** Stop all consumer loops (graceful shutdown / tests). */
export function stopAllConsumers(): void {
  for (const a of runningLoops) a.abort();
  runningLoops.length = 0;
}
