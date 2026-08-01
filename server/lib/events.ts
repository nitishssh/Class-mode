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

          const entries = [...pending, ...(fresh?.[0]?.[1] ?? [])];
          for (const [id, fields] of entries) {
            const raw = fields[fields.indexOf("event") + 1];
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
