import Redis from "ioredis";
import { logger } from "./logger";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const readyCallbacks = new Set<() => void | Promise<void>>();

let connected = false;
let connecting: Promise<boolean> | null = null;
let probeTimer: ReturnType<typeof setTimeout> | null = null;
let warnedUnavailable = false;

export const redisClient = new Redis(redisUrl, {
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  retryStrategy: () => null,
});

redisClient.on("ready", () => {
  connected = true;
  warnedUnavailable = false;
});

redisClient.on("close", () => {
  connected = false;
});

redisClient.on("error", () => {
  connected = false;
});

function scheduleReconnectProbe(): void {
  if (probeTimer) return;
  probeTimer = setTimeout(async () => {
    probeTimer = null;
    const recovered = await connectRedis();
    if (!recovered) scheduleReconnectProbe();
  }, 30_000);
  probeTimer.unref?.();
}

async function notifyReady(): Promise<void> {
  for (const callback of readyCallbacks) {
    try {
      await callback();
    } catch (error) {
      logger.error("[redis] Ready callback failed", { error: String(error) });
    }
  }
}

export function isRedisReady(): boolean {
  return connected && redisClient.status === "ready";
}

export function isRedisConfigured(): boolean {
  return Boolean(redisUrl);
}

export async function connectRedis(): Promise<boolean> {
  if (isRedisReady()) return true;
  if (connecting) return connecting;

  connecting = (async () => {
    try {
      await redisClient.connect();
      await redisClient.ping();
      connected = true;
      logger.info("[redis] Redis connected");
      await notifyReady();
      return true;
    } catch (error) {
      connected = false;
      if (!warnedUnavailable) {
        warnedUnavailable = true;
        logger.warn("[redis] Redis unavailable; cache and queue workers are disabled", {
          error: String(error),
        });
      }
      scheduleReconnectProbe();
      return false;
    } finally {
      connecting = null;
    }
  })();

  return connecting;
}

export function onRedisReady(callback: () => void | Promise<void>): () => void {
  readyCallbacks.add(callback);
  if (isRedisReady()) void callback();
  return () => readyCallbacks.delete(callback);
}

export function createBullMQConnection(): Redis {
  const connection = new Redis(redisUrl, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: null,
    retryStrategy: (times) => Math.min(times * 500, 5_000),
  });
  connection.on("error", () => {
    connected = false;
  });
  connection.on("ready", () => {
    connected = true;
  });
  return connection;
}

export async function getCachedJSON<T>(key: string): Promise<T | null> {
  if (!isRedisReady()) return null;
  try {
    const data = await redisClient.get(key);
    return data ? (JSON.parse(data) as T) : null;
  } catch (error) {
    logger.warn("[redis] Cache read failed", { key, error: String(error) });
    return null;
  }
}

export async function setCachedJSON(
  key: string,
  value: unknown,
  ttlSeconds: number = 3600
): Promise<void> {
  if (!isRedisReady()) return;
  try {
    await redisClient.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    logger.warn("[redis] Cache write failed", { key, error: String(error) });
  }
}
