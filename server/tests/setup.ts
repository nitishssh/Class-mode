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

// Mock Redis globally
vi.mock("../lib/redis", () => ({
  redisClient: {
    on: vi.fn(),
    status: "end",
    connect: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue("PONG"),
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
  },
  connectRedis: vi.fn().mockResolvedValue(true),
  isRedisReady: vi.fn().mockReturnValue(true),
  isRedisConfigured: vi.fn().mockReturnValue(true),
  onRedisReady: vi.fn((callback: () => void) => {
    callback();
    return vi.fn();
  }),
  createBullMQConnection: vi.fn(() => ({
    on: vi.fn(),
    quit: vi.fn(),
  })),
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
      disconnect = vi.fn();
      connect = vi.fn().mockResolvedValue(undefined);
      ping = vi.fn().mockResolvedValue("PONG");
      status = "ready";
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
