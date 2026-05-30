import { createClient } from "redis";
import { log } from "../vite"; // Assuming there's a log utility, let's just use console for now if it doesn't exist

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redisClient = createClient({
  url: redisUrl,
});

redisClient.on("error", (err) => {
  console.warn("Redis client error:", err);
});

redisClient.on("connect", () => {
  console.log("Connected to Redis at", redisUrl);
});

export async function connectRedis() {
  if (!redisClient.isOpen) {
    try {
      await redisClient.connect();
    } catch (err) {
      console.warn("Failed to connect to Redis. Caching will be disabled.");
    }
  }
}

// Connect automatically in background
connectRedis();

export async function getCachedJSON<T>(key: string): Promise<T | null> {
  if (!redisClient.isOpen) return null;
  try {
    const data = await redisClient.get(key);
    if (data) return JSON.parse(data) as T;
  } catch (err) {
    console.warn(`Redis GET error for ${key}:`, err);
  }
  return null;
}

export async function setCachedJSON(key: string, value: any, ttlSeconds: number = 3600) {
  if (!redisClient.isOpen) return;
  try {
    await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch (err) {
    console.warn(`Redis SET error for ${key}:`, err);
  }
}
