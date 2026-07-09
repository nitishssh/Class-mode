import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  currentUser: null as any,
  mockFindUsers: vi.fn(),
  mockFindGradingResults: vi.fn(),
  mockChildren: vi.fn(),
  mockAttendanceHistory: vi.fn(),
  mockFeeSummary: vi.fn(),
  mockGetTasksByUser: vi.fn(),
}));

vi.mock("../middleware", () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = h.currentUser;
    next();
  },
  requireRole:
    (...roles: string[]) =>
    (req: any, res: any, next: any) => {
      if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ message: "forbidden" });
      }
      next();
    },
}));

vi.mock("../lib/pg-queries", () => ({
  pgFindUsers: h.mockFindUsers,
  pgFindGradingResults: h.mockFindGradingResults,
  pgGetParentChildrenWithStatus: h.mockChildren,
  pgGetParentChildAttendanceHistory: h.mockAttendanceHistory,
  pgGetParentChildFeeSummary: h.mockFeeSummary,
}));

vi.mock("../storage", () => ({
  storage: { getTasksByUser: h.mockGetTasksByUser },
}));

import parentRoutes from "../routes/parent";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/parent", parentRoutes);
  return app;
}

describe("Parent mobile endpoints", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = makeApp();
    h.currentUser = { id: 42, role: "parent", school_code: null };
  });

  it("returns linked children with attendance status for a requested date", async () => {
    h.mockChildren.mockResolvedValue([
      {
        id: 7,
        name: "Asha",
        className: "Grade 4",
        schoolCode: "SCHOOL123",
        today: {
          date: "2026-07-10",
          status: "present",
          markedAt: "2026-07-10T04:30:00.000Z",
        },
      },
    ]);

    const res = await request(app).get("/api/parent/children").query({ date: "2026-07-10" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      date: "2026-07-10",
      children: [
        {
          id: 7,
          name: "Asha",
          className: "Grade 4",
          schoolCode: "SCHOOL123",
          today: {
            date: "2026-07-10",
            status: "present",
            markedAt: "2026-07-10T04:30:00.000Z",
          },
        },
      ],
    });
    expect(h.mockChildren).toHaveBeenCalledWith({ parentId: 42, date: "2026-07-10" });
  });

  it("rejects an invalid children date", async () => {
    const res = await request(app).get("/api/parent/children").query({ date: "10-07-2026" });

    expect(res.status).toBe(400);
    expect(h.mockChildren).not.toHaveBeenCalled();
  });

  it("returns attendance history only through the parent-owned helper", async () => {
    h.mockAttendanceHistory.mockResolvedValue([
      { date: "2026-07-10", status: "absent", note: "sick", className: "Grade 4" },
    ]);

    const res = await request(app)
      .get("/api/parent/children/7/attendance")
      .query({ from: "2026-07-01", to: "2026-07-31", limit: "30" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      studentId: 7,
      attendance: [{ date: "2026-07-10", status: "absent", note: "sick", className: "Grade 4" }],
    });
    expect(h.mockAttendanceHistory).toHaveBeenCalledWith({
      parentId: 42,
      studentId: 7,
      from: "2026-07-01",
      to: "2026-07-31",
      limit: 30,
    });
  });

  it("404s attendance history when the child is not linked to the parent", async () => {
    h.mockAttendanceHistory.mockResolvedValue(null);

    const res = await request(app).get("/api/parent/children/999/attendance");

    expect(res.status).toBe(404);
  });

  it("returns a fee summary only through the parent-owned helper", async () => {
    h.mockFeeSummary.mockResolvedValue({
      pendingCents: 500000,
      paidCents: 120000,
      pendingCount: 1,
      paidCount: 1,
      fees: [
        {
          id: 1,
          description: "Term 1",
          amountCents: 500000,
          currency: "INR",
          status: "pending",
          dueDate: "2026-07-31",
          paidAt: null,
        },
      ],
    });

    const res = await request(app).get("/api/parent/children/7/fees");

    expect(res.status).toBe(200);
    expect(res.body.pendingCents).toBe(500000);
    expect(res.body.studentId).toBe(7);
    expect(h.mockFeeSummary).toHaveBeenCalledWith({ parentId: 42, studentId: 7 });
  });

  it("404s fee summary when the child is not linked to the parent", async () => {
    h.mockFeeSummary.mockResolvedValue(null);

    const res = await request(app).get("/api/parent/children/999/fees");

    expect(res.status).toBe(404);
  });

  it("rejects non-parent roles", async () => {
    h.currentUser = { id: 5, role: "teacher", school_code: "SCHOOL123" };

    const res = await request(app).get("/api/parent/children");

    expect(res.status).toBe(403);
    expect(h.mockChildren).not.toHaveBeenCalled();
  });
});
