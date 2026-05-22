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
    withPgClient: async <T>(fn: (client: unknown) => Promise<T>): Promise<T> => fn(await mockPool.connect()),
  };
});

// Mock all PostgreSQL query helpers globally for all tests
vi.mock("../lib/pg-queries", () => {
  const mocks: Record<string | symbol, Mock> = {};
  return new Proxy(mocks, {
    get: (target, prop) => {
      if (!(prop in target)) {
        target[prop] = vi.fn();
      }
      return target[prop];
    },
  });
});
