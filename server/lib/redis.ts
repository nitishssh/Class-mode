import Redis from "ioredis";
import { logger } from "./logger";

/**
 * Single shared Redis connection for the whole app (cache, BullMQ, event bus).
 *
 * Design rules, mirroring db-pg.ts:
 * - Gated on REDIS_URL being set — absent means "Redis intentionally off":
 *   every helper degrades to a no-op instead of spamming ECONNREFUSED.
 * - Lazy: nothing connects at import time. Call connectRedis() from server
 *   startup, or let the first getRedis() caller trigger it.
 * - One client library (ioredis — required by BullMQ) instead of the previous
 *   split between `redis` and `ioredis`.
 */

let client: Redis | null = null;
let isConnected = false;

export function isRedisConfigured(): boolean {
  return !!process.env.REDIS_URL;
}

export function isRedisReady(): boolean {
  return isConnected;
}

/**
 * The shared connection, or null when Redis is not configured.
 * Reuse this for cache reads/writes and event-bus publishing. BullMQ and
 * blocking stream consumers must NOT share it — use newRedisConnection().
 */
export function getRedis(): Redis | null {
  if (!isRedisConfigured()) return null;
  if (!client) {
    client = createClient("shared");
  }
  return client;
}

/**
 * A dedicated connection for blocking consumers (BullMQ workers, XREADGROUP
 * loops) — blocking commands would starve the shared client.
 * Returns null when Redis is not configured.
 */
export function newRedisConnection(label: string): Redis | null {
  if (!isRedisConfigured()) return null;
  return createClient(label);
}

function createClient(label: string): Redis {
  const c = new Redis(process.env.REDIS_URL as string, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    retryStrategy: (times) => Math.min(times * 500, 15_000),
  });
  c.on("ready", () => {
    if (label === "shared") isConnected = true;
    logger.info(`[redis] ${label} connection ready`);
  });
  c.on("error", (err) => {
    if (label === "shared") isConnected = false;
    logger.warn(`[redis] ${label} connection error`, { err: String(err) });
  });
  c.on("close", () => {
    if (label === "shared") isConnected = false;
  });
  return c;
}

/** Connect the shared client at startup (no-op when Redis is not configured). */
export async function connectRedis(): Promise<void> {
  const c = getRedis();
  if (!c) {
    logger.info("[redis] REDIS_URL not set — cache, job queue and event bus disabled");
    return;
  }
  try {
    await c.connect();
  } catch (err) {
    // retryStrategy keeps trying in the background; startup continues.
    logger.warn("[redis] initial connect failed — will keep retrying", { err: String(err) });
  }
}

// ── JSON cache helpers (API preserved for existing callers) ──────────────────

export async function getCachedJSON<T>(key: string): Promise<T | null> {
  const c = getRedis();
  if (!c || !isConnected) return null;
  try {
    const data = await c.get(key);
    if (data) return JSON.parse(data) as T;
  } catch (err) {
    logger.warn(`[redis] GET failed for ${key}`, { err: String(err) });
  }
  return null;
}

export async function setCachedJSON(key: string, value: any, ttlSeconds = 3600): Promise<void> {
  const c = getRedis();
  if (!c || !isConnected) return;
  try {
    await c.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (err) {
    logger.warn(`[redis] SET failed for ${key}`, { err: String(err) });
  }
}
