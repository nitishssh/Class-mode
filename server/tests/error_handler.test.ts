import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { ApiError } from "../lib/http-errors";

// Mirrors the centralized error-handling middleware registered last in
// server/index.ts. It's re-declared here (rather than importing the app,
// which boots DB/Redis/etc.) so we can exercise it in isolation the same
// way server/tests/db_guard_rate_limit.test.ts does for requireDb.
function buildApp() {
  const app = express();

  app.get("/ok", (_req, res) => res.json({ ok: true }));
  app.get("/boom-unknown", () => {
    throw new Error("kaboom");
  });
  app.get("/boom-api-error", () => {
    throw ApiError.forbidden("You cannot do that", "NOT_ALLOWED");
  });
  app.get("/boom-legacy-status", (_req, _res, next) => {
    next(Object.assign(new Error("legacy shape"), { status: 400 }));
  });
  app.get("/boom-headers-sent", (_req, res, next) => {
    res.status(200).json({ partial: true });
    next(new Error("too late"));
  });

  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      return next(err);
    }

    const asHttpError = err as {
      status?: number;
      statusCode?: number;
      message?: string;
      code?: string;
    };
    const status =
      err instanceof ApiError
        ? err.statusCode
        : asHttpError?.status || asHttpError?.statusCode || 500;
    const isServerError = status >= 500;
    const code = err instanceof ApiError ? err.code : asHttpError?.code;

    const message =
      isServerError && process.env.NODE_ENV === "production"
        ? "Something went wrong"
        : asHttpError?.message || "Internal Server Error";

    res.status(status).json({
      error: {
        message,
        ...(code ? { code } : {}),
      },
    });
  });

  return app;
}

describe("centralized error handler", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.stubEnv("NODE_ENV", originalEnv ?? "test");
  });

  it("returns a consistent { error: { message } } shape for unknown thrown errors", async () => {
    const app = buildApp();
    const res = await request(app).get("/boom-unknown");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { message: "kaboom" } });
  });

  it("masks the message for unexpected 500s in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const app = buildApp();
    const res = await request(app).get("/boom-unknown");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { message: "Something went wrong" } });
  });

  it("passes through ApiError status, message, and code", async () => {
    const app = buildApp();
    const res = await request(app).get("/boom-api-error");

    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      error: { message: "You cannot do that", code: "NOT_ALLOWED" },
    });
  });

  it("keeps client-safe messages for ApiError even in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const app = buildApp();
    const res = await request(app).get("/boom-api-error");

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe("You cannot do that");
  });

  it("respects a legacy err.status shape (non-ApiError)", async () => {
    const app = buildApp();
    const res = await request(app).get("/boom-legacy-status");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { message: "legacy shape" } });
  });

  it("never sends a second response once headers are already sent", async () => {
    const app = buildApp();
    const res = await request(app).get("/boom-headers-sent");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ partial: true });
  });
});
