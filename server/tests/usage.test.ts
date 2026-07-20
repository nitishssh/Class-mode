import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

// Hoisted mocks: a mutable current user + the pg-query stub.
const h = vi.hoisted(() => ({
  currentUser: null as any,
  mockTrack: vi.fn(),
}));

vi.mock("../middleware", () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    if (!h.currentUser) return res.status(401).json({ message: "unauthorized" });
    req.user = h.currentUser;
    next();
  },
}));

vi.mock("../lib/pg-queries", () => ({
  pgTrackFeatureUsage: h.mockTrack,
}));

import usageRoutes from "../routes/usage";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/usage", usageRoutes);
  return app;
}

describe("Usage API (POST /api/usage — #337 view events)", () => {
  let app: express.Express;
  beforeEach(() => {
    vi.clearAllMocks();
    app = makeApp();
    h.currentUser = { id: 10, role: "teacher", schoolCode: "SCHOOL123" };
  });

  it("rejects view events from non-staff roles (metric integrity)", async () => {
    h.currentUser = { id: 99, role: "student", schoolCode: "SCHOOL123" };
    const res = await request(app).post("/api/usage").send({ feature: "report_view" });
    expect(res.status).toBe(403);
    expect(h.mockTrack).not.toHaveBeenCalled();
  });

  it("records attendance_view scoped to the user's school", async () => {
    const res = await request(app).post("/api/usage").send({ feature: "attendance_view" });
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ success: true });
    expect(h.mockTrack).toHaveBeenCalledTimes(1);
    expect(h.mockTrack).toHaveBeenCalledWith({
      feature: "attendance_view",
      userId: 10,
      schoolCode: "SCHOOL123",
    });
  });

  it("records report_view scoped to the user's school", async () => {
    const res = await request(app).post("/api/usage").send({ feature: "report_view" });
    expect(res.status).toBe(202);
    expect(h.mockTrack).toHaveBeenCalledWith({
      feature: "report_view",
      userId: 10,
      schoolCode: "SCHOOL123",
    });
  });

  it("rejects feature names outside the *_view allowlist", async () => {
    const res = await request(app).post("/api/usage").send({ feature: "attendance" });
    expect(res.status).toBe(400);
    expect(h.mockTrack).not.toHaveBeenCalled();
  });

  it("rejects a missing/non-string feature", async () => {
    const res = await request(app).post("/api/usage").send({});
    expect(res.status).toBe(400);
    expect(h.mockTrack).not.toHaveBeenCalled();
  });

  it("fails closed for a school-scoped user with no school (never NULL school_code)", async () => {
    h.currentUser = { id: 11, role: "teacher", schoolCode: null };
    const res = await request(app).post("/api/usage").send({ feature: "attendance_view" });
    expect(res.status).toBe(403);
    expect(h.mockTrack).not.toHaveBeenCalled();
  });

  it("ignores a client-supplied schoolCode (tenant scope comes from the session user)", async () => {
    const res = await request(app)
      .post("/api/usage")
      .send({ feature: "attendance_view", schoolCode: "OTHER_SCHOOL" });
    expect(res.status).toBe(202);
    expect(h.mockTrack).toHaveBeenCalledWith(expect.objectContaining({ schoolCode: "SCHOOL123" }));
  });

  it("allows a platform admin without a school (null school_code)", async () => {
    h.currentUser = { id: 1, role: "admin", schoolCode: null };
    const res = await request(app).post("/api/usage").send({ feature: "report_view" });
    expect(res.status).toBe(202);
    expect(h.mockTrack).toHaveBeenCalledWith({
      feature: "report_view",
      userId: 1,
      schoolCode: null,
    });
  });

  it("requires authentication", async () => {
    h.currentUser = null;
    const res = await request(app).post("/api/usage").send({ feature: "attendance_view" });
    expect(res.status).toBe(401);
    expect(h.mockTrack).not.toHaveBeenCalled();
  });
});
