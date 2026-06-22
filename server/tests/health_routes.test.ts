import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const redisState = vi.hoisted(() => ({ connected: true, configured: true }));
const pgState = vi.hoisted(() => ({ connected: true }));

vi.mock("../lib/redis", () => ({
  isRedisReady: vi.fn(() => redisState.connected),
  isRedisConfigured: vi.fn(() => redisState.configured),
}));

vi.mock("../db-pg", () => ({
  isPgReady: vi.fn(() => pgState.connected),
  getPgPool: vi.fn(() => ({ query: vi.fn().mockResolvedValue({ rows: [{ "?column?": 1 }] }) })),
}));

vi.mock("../lib/cassandra", () => ({
  isCassandraConnected: vi.fn(() => false),
}));

vi.mock("../lib/firebase-admin", () => ({
  getFirebaseAdminStatus: vi.fn(() => ({
    hasApp: true,
    hasServiceAccount: false,
    projectId: "test-project",
  })),
}));

vi.mock("../middleware", () => ({
  authenticateToken: vi.fn((_req, _res, next) => next()),
}));

describe("health routes", () => {
  beforeEach(() => {
    redisState.connected = true;
    redisState.configured = true;
    pgState.connected = true;
  });

  it("reports PostgreSQL and Redis as healthy", async () => {
    const { default: healthRoutes } = await import("../routes/health");
    const app = express().use("/api/health", healthRoutes);

    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("healthy");
    expect(response.body.databases.postgresql.connected).toBe(true);
    expect(response.body.services.redis).toEqual({ configured: true, connected: true });
  });

  it("reports Redis degradation without failing liveness", async () => {
    redisState.connected = false;
    const { default: healthRoutes } = await import("../routes/health");
    const app = express().use("/api/health", healthRoutes);

    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.services.redis).toEqual({ configured: true, connected: false });
  });
});
