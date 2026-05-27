import { describe, expect, it, vi } from "vitest";
import express from "express";
import rateLimit from "express-rate-limit";
import request from "supertest";

vi.mock("../db-pg", () => ({
  isPgReady: vi.fn(() => false),
}));

describe("database guard and auth rate limiting", () => {
  it("returns database unavailable before auth requests consume rate-limit quota", async () => {
    const { requireDb } = await import("../middleware");
    const app = express();

    app.use("/api", requireDb);
    app.use(
      "/api/auth",
      rateLimit({ windowMs: 60_000, max: 1, message: { error: "Too many auth attempts" } })
    );
    app.post("/api/auth/login", (_req, res) => res.status(200).json({ ok: true }));

    const first = await request(app).post("/api/auth/login").send({});
    const second = await request(app).post("/api/auth/login").send({});

    expect(first.status).toBe(503);
    expect(first.body.error).toBe("Database unavailable");
    expect(second.status).toBe(503);
    expect(second.body.error).toBe("Database unavailable");
  });
});
