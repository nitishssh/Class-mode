// GDPR self-service routes: data export (GET /api/gdpr/export → zip) and
// account deletion (DELETE /api/gdpr/delete). These are compliance-critical
// and were previously untested. Both are scoped to the authenticated user's
// own id — a user can only export/delete themselves.

import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  currentUser: null as any,
  mockFindUserById: vi.fn(),
  mockDeleteUser: vi.fn(),
  mockExportInteractionLog: vi.fn(),
}));

vi.mock("../middleware", () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    if (!h.currentUser) return res.status(401).json({ message: "unauthorized" });
    req.user = h.currentUser;
    next();
  },
}));

vi.mock("../lib/db/pg-queries", () => ({
  pgFindUserById: h.mockFindUserById,
  pgDeleteUser: h.mockDeleteUser,
  pgExportInteractionLog: h.mockExportInteractionLog,
}));

vi.mock("../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import gdprRouter from "../routes/gdpr";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/gdpr", gdprRouter);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.currentUser = { id: 42, email: "user@example.com", role: "teacher" };
});

// Note: the zip-streaming happy path is not asserted here. The route loads
// `archiver` via createRequire (required for the esbuild prod bundle), which
// bypasses vitest's module system and yields a non-callable namespace in-env.
// The zip stream has NO coverage yet (an e2e spec is still to be written —
// tracked in TODOS.md); scoping (looks up the caller's own id
// only) is asserted via the not-found path below, which runs before archiver.
describe("GET /api/gdpr/export", () => {
  it("looks up only the authenticated caller's own id", async () => {
    // 404 short-circuits before archiver — deterministic in-env, and proves
    // the export can only ever target req.user.id, never an arbitrary one.
    h.mockFindUserById.mockResolvedValue(null);
    await request(makeApp()).get("/api/gdpr/export");
    expect(h.mockFindUserById).toHaveBeenCalledWith(42);
    expect(h.mockFindUserById).toHaveBeenCalledTimes(1);
  });

  it("401s when unauthenticated", async () => {
    h.currentUser = null;
    const res = await request(makeApp()).get("/api/gdpr/export");
    expect(res.status).toBe(401);
    expect(h.mockFindUserById).not.toHaveBeenCalled();
  });

  it("404s when the user row no longer exists", async () => {
    h.mockFindUserById.mockResolvedValue(null);
    const res = await request(makeApp()).get("/api/gdpr/export");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "User not found" });
  });
});

describe("DELETE /api/gdpr/delete", () => {
  it("deletes the authenticated user's own account", async () => {
    h.mockDeleteUser.mockResolvedValue(undefined);
    const res = await request(makeApp()).delete("/api/gdpr/delete");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: "User data deleted" });
    expect(h.mockDeleteUser).toHaveBeenCalledWith(42);
  });

  it("401s when unauthenticated (no deletion attempted)", async () => {
    h.currentUser = null;
    const res = await request(makeApp()).delete("/api/gdpr/delete");
    expect(res.status).toBe(401);
    expect(h.mockDeleteUser).not.toHaveBeenCalled();
  });

  it("500s (not silently succeeds) when the delete fails", async () => {
    h.mockDeleteUser.mockRejectedValue(new Error("db down"));
    const res = await request(makeApp()).delete("/api/gdpr/delete");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Deletion failed" });
  });
});
