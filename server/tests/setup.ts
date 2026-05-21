import { config } from "dotenv";
import { resolve } from "path";
import { vi } from "vitest";

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
    withPgClient: async (fn: any) => fn(mockPool.connect()),
  };
});

// Mock all PostgreSQL query helpers globally for all tests
vi.mock("../lib/pg-queries", () => {
  return {
    pgFindUserByAuthSubject: vi.fn(),
    pgFindUserByEmail: vi.fn(),
    pgFindUserById: vi.fn(),
    pgCreateUser: vi.fn(),
    pgUpdateUser: vi.fn(),
    pgSetUserLastLogin: vi.fn(),
    pgUpsertMembership: vi.fn(),
    pgFindUsers: vi.fn(),
    pgCountUsers: vi.fn(),
  };
});

