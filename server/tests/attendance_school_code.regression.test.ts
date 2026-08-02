// Regression: #336 (sprint B2, P1) — admin attendance writes persisted rows
// with NULL school_code.
//
// A platform admin (role=admin) has no school of its own, and the route
// stamped writes with the MARKER's school_code (`user.school_code ?? null`).
// Every admin-initiated mark therefore inserted attendance rows with
// school_code=NULL — orphaned from any tenant and invisible to every
// school-scoped read (class view, summaries, principal dashboard).
//
// Tenant-isolation invariant: attendance rows must always carry the
// school_code of the school they belong to. The fix derives school_code from
// the TARGET students being marked, and fails closed (400, no write) when it
// cannot be resolved to exactly one school.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  currentUser: null as any,
  mockMark: vi.fn(),
  mockFindUsers: vi.fn(),
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

vi.mock("../lib/db/pg-queries", () => ({
  pgMarkAttendance: h.mockMark,
  pgGetAttendanceByClassDate: vi.fn(),
  pgGetStudentAttendanceSummary: vi.fn(),
  pgGetSchoolAttendanceSummary: vi.fn(),
  pgGetAbsenteesByDate: vi.fn(),
  pgGetClassNames: vi.fn(),
  pgFindUsers: h.mockFindUsers,
  pgFindUserById: vi.fn(),
  pgUpdateUser: vi.fn(),
  pgTrackFeatureUsage: vi.fn(),
}));

vi.mock("../services/whatsapp", () => ({
  whatsappService: { sendMessage: vi.fn(), isConfigured: vi.fn().mockReturnValue(false) },
}));

import attendanceRoutes from "../routes/attendance";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/attendance", attendanceRoutes);
  return app;
}

describe("Regression #336: admin attendance writes must resolve school_code (never NULL)", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-16T10:00:00Z"));
    app = makeApp();
    // Platform admin: role=admin, no school of its own — the pre-fix code
    // stamped writes with this account's (null) school_code.
    h.currentUser = { id: 1, role: "admin", school_code: null };
    h.mockMark.mockResolvedValue(1);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("persists the TARGET school's school_code on an admin write (not NULL)", async () => {
    h.mockFindUsers.mockResolvedValue([
      { id: 1, name: "Asha", schoolCode: "SCHOOL123", parentPhone: null },
      { id: 2, name: "Ravi", schoolCode: "SCHOOL123", parentPhone: null },
    ]);

    const res = await request(app)
      .post("/api/attendance")
      .send({
        className: "Grade 10",
        date: "2026-07-15",
        marks: [
          { studentId: 1, status: "present" },
          { studentId: 2, status: "absent" },
        ],
      });

    expect(res.status).toBe(200);
    expect(h.mockMark).toHaveBeenCalledTimes(1);
    // The write is stamped with the students' school — never the admin's null.
    expect(h.mockMark).toHaveBeenCalledWith(
      expect.objectContaining({ schoolCode: "SCHOOL123", className: "Grade 10" })
    );
    expect(h.mockMark.mock.calls[0][0].schoolCode).not.toBeNull();
  });

  it("rejects (400, no write) when the students have no school_code", async () => {
    h.mockFindUsers.mockResolvedValue([
      { id: 1, name: "Orphan", schoolCode: null, parentPhone: null },
    ]);

    const res = await request(app)
      .post("/api/attendance")
      .send({
        className: "Grade 10",
        date: "2026-07-15",
        marks: [{ studentId: 1, status: "present" }],
      });

    // Fail closed: 400, not a silent NULL insert.
    expect(res.status).toBe(400);
    expect(h.mockMark).not.toHaveBeenCalled();
  });

  it("rejects (400, no write) when the marked students span multiple schools", async () => {
    // Admin roster lookup is cross-school by className — the same class name
    // can exist in two schools. One write must never mix tenants.
    h.mockFindUsers.mockResolvedValue([
      { id: 1, name: "Asha", schoolCode: "SCHOOL123", parentPhone: null },
      { id: 3, name: "Meera", schoolCode: "SCHOOL456", parentPhone: null },
    ]);

    const res = await request(app)
      .post("/api/attendance")
      .send({
        className: "Grade 10",
        date: "2026-07-15",
        marks: [
          { studentId: 1, status: "present" },
          { studentId: 3, status: "present" },
        ],
      });

    expect(res.status).toBe(400);
    expect(h.mockMark).not.toHaveBeenCalled();
  });

  it("keeps school-bound roles stamped with their own validated school_code", async () => {
    h.currentUser = { id: 10, role: "teacher", school_code: "SCHOOL123" };
    h.mockFindUsers.mockResolvedValue([
      { id: 1, name: "Asha", schoolCode: "SCHOOL123", parentPhone: null },
    ]);

    const res = await request(app)
      .post("/api/attendance")
      .send({
        className: "Grade 10",
        date: "2026-07-15",
        marks: [{ studentId: 1, status: "present" }],
      });

    expect(res.status).toBe(200);
    expect(h.mockMark).toHaveBeenCalledWith(expect.objectContaining({ schoolCode: "SCHOOL123" }));
    // And the roster check stays tenant-scoped for non-admin roles.
    expect(h.mockFindUsers).toHaveBeenCalledWith({
      role: "student",
      classname: "Grade 10",
      schoolCode: "SCHOOL123",
    });
  });
});
