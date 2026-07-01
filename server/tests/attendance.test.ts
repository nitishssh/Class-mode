import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

// Hoisted mocks: a mutable current user + the pg-query stubs.
const h = vi.hoisted(() => ({
  currentUser: null as any,
  mockMark: vi.fn(),
  mockGetByClass: vi.fn(),
  mockSummary: vi.fn(),
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
  pgMarkAttendance: h.mockMark,
  pgGetAttendanceByClassDate: h.mockGetByClass,
  pgGetStudentAttendanceSummary: h.mockSummary,
}));

import attendanceRoutes from "../routes/attendance";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/attendance", attendanceRoutes);
  return app;
}

describe("Attendance API", () => {
  let app: express.Express;
  beforeEach(() => {
    vi.clearAllMocks();
    app = makeApp();
    h.currentUser = { id: 10, role: "teacher", school_code: "SCHOOL123" };
  });

  it("marks attendance scoped to the teacher's school", async () => {
    h.mockMark.mockResolvedValue(2);
    const res = await request(app)
      .post("/api/attendance")
      .send({
        className: "Grade 10",
        date: "2026-07-01",
        marks: [
          { studentId: 1, status: "present" },
          { studentId: 2, status: "absent", note: "sick" },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, written: 2 });
    expect(h.mockMark).toHaveBeenCalledWith(
      expect.objectContaining({ schoolCode: "SCHOOL123", className: "Grade 10", markedBy: 10 })
    );
  });

  it("fails closed for a teacher with no school (403, no write)", async () => {
    h.currentUser = { id: 11, role: "teacher", school_code: null };
    const res = await request(app)
      .post("/api/attendance")
      .send({ className: "Grade 10", date: "2026-07-01", marks: [{ studentId: 1, status: "present" }] });
    expect(res.status).toBe(403);
    expect(h.mockMark).not.toHaveBeenCalled();
  });

  it("validates the payload (bad date, empty marks)", async () => {
    const res = await request(app)
      .post("/api/attendance")
      .send({ className: "Grade 10", date: "07/01/2026", marks: [] });
    expect(res.status).toBe(400);
    expect(h.mockMark).not.toHaveBeenCalled();
  });

  it("rejects an unauthorized role", async () => {
    h.currentUser = { id: 12, role: "student", school_code: "SCHOOL123" };
    const res = await request(app)
      .post("/api/attendance")
      .send({ className: "Grade 10", date: "2026-07-01", marks: [{ studentId: 1, status: "present" }] });
    expect(res.status).toBe(403);
  });

  it("gets class attendance scoped to school", async () => {
    h.mockGetByClass.mockResolvedValue([{ studentId: 1, studentName: "Asha", status: "present" }]);
    const res = await request(app)
      .get("/api/attendance")
      .query({ className: "Grade 10", date: "2026-07-01" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(h.mockGetByClass).toHaveBeenCalledWith(
      expect.objectContaining({ schoolCode: "SCHOOL123", className: "Grade 10", date: "2026-07-01" })
    );
  });

  it("requires className and a valid date on GET", async () => {
    const res = await request(app).get("/api/attendance").query({ className: "Grade 10" });
    expect(res.status).toBe(400);
  });

  it("returns a student attendance summary scoped to school", async () => {
    h.mockSummary.mockResolvedValue({ present: 8, absent: 1, late: 0, excused: 0, total: 9 });
    const res = await request(app).get("/api/attendance/summary/1");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(9);
    expect(h.mockSummary).toHaveBeenCalledWith({ studentId: 1, schoolCode: "SCHOOL123" });
  });
});
