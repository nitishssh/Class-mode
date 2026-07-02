import { config } from "dotenv";
import { resolve } from "path";
import { vi, type Mock } from "vitest";

config({ path: resolve(process.cwd(), ".env.test") });

// Mock PostgreSQL connection/pool globally for all tests
vi.mock("../db-pg", () => {
  const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
  const mockPool = {
    query: mockQuery,
    connect: vi.fn().mockResolvedValue({
      query: mockQuery,
      release: vi.fn(),
    }),
    on: vi.fn(),
    end: vi.fn().mockResolvedValue(undefined),
  };
  return {
    getPgPool: () => mockPool,
    isPgReady: () => true,
    connectPostgres: vi.fn().mockResolvedValue(undefined),
    withPgClient: async <T>(fn: (client: unknown) => Promise<T>): Promise<T> =>
      fn(await mockPool.connect()),
  };
});

// Mock Redis globally — mirrors the "Redis not configured" surface of
// server/lib/redis.ts so tests exercise the graceful-degradation paths.
vi.mock("../lib/redis", () => ({
  isRedisConfigured: vi.fn().mockReturnValue(false),
  isRedisReady: vi.fn().mockReturnValue(false),
  getRedis: vi.fn().mockReturnValue(null),
  newRedisConnection: vi.fn().mockReturnValue(null),
  connectRedis: vi.fn().mockResolvedValue(undefined),
  getCachedJSON: vi.fn().mockResolvedValue(null),
  setCachedJSON: vi.fn().mockResolvedValue(undefined),
}));

// Mock ioredis globally
vi.mock("ioredis", () => {
  return {
    default: class Redis {
      on = vi.fn();
      get = vi.fn().mockResolvedValue(null);
      set = vi.fn().mockResolvedValue("OK");
      del = vi.fn().mockResolvedValue(1);
      quit = vi.fn().mockResolvedValue("OK");
      defineCommand = vi.fn();
    },
  };
});

// Mock all PostgreSQL query helpers globally for all tests
vi.mock("../lib/pg-queries", () => {
  const mocks: Record<string | symbol, Mock> = {};
  return new Proxy(mocks, {
    get: (target, prop) => {
      if (
        typeof prop === "string" &&
        prop !== "__proto__" &&
        prop !== "constructor" &&
        prop !== "then" &&
        prop !== "toJSON"
      ) {
        if (!(prop in target)) {
          target[prop] = vi.fn();
        }
        return target[prop];
      }
      return undefined;
    },
  });
});
