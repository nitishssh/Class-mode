import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";

// Hoisted mocks: a mutable current user + the pg-query stubs.
const h = vi.hoisted(() => ({
  currentUser: null as any,
  mockMark: vi.fn(),
  mockGetByClass: vi.fn(),
  mockSummary: vi.fn(),
  mockSchoolSummary: vi.fn(),
  mockFindUsers: vi.fn(),
  mockFindUserById: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockSend: vi.fn(),
  mockWhatsappConfigured: vi.fn(),
  mockTrack: vi.fn(),
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
  pgGetAbsenteesByDate: vi.fn(),
  pgGetSchoolAttendanceSummary: h.mockSchoolSummary,
  pgGetClassNames: vi.fn(),
  pgFindUsers: h.mockFindUsers,
  pgFindUserById: h.mockFindUserById,
  pgUpdateUser: h.mockUpdateUser,
  pgTrackFeatureUsage: h.mockTrack,
}));

vi.mock("../services/whatsapp", () => ({
  whatsappService: { sendMessage: h.mockSend, isConfigured: h.mockWhatsappConfigured },
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
    // Pin the clock (Date only — real timers stay live for supertest) so the
    // W-6 marking window [today-3, today] is deterministic.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-02T10:00:00Z"));
    app = makeApp();
    h.currentUser = { id: 10, role: "teacher", school_code: "SCHOOL123" };
    h.mockWhatsappConfigured.mockReturnValue(true);
    // #335 follow-up: dispatch requires BOTH configured creds AND the explicit
    // opt-in flag — configuring creds alone must never enable sends.
    process.env.WHATSAPP_ALERTS_ENABLED = "true";
    // Default roster: the students the tests mark. W-6 fails closed on any
    // mark whose studentId is missing from this list.
    h.mockFindUsers.mockResolvedValue([
      { id: 1, name: "Asha", parentPhone: "+919876543210" },
      { id: 2, name: "Ravi", parentPhone: null },
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.WHATSAPP_ALERTS_ENABLED;
  });

  it("keeps alerts disabled when creds exist but WHATSAPP_ALERTS_ENABLED is unset", async () => {
    delete process.env.WHATSAPP_ALERTS_ENABLED;
    h.mockMark.mockResolvedValue(1);
    const res = await request(app)
      .post("/api/attendance")
      .send({
        className: "Grade 10",
        date: "2026-07-02",
        marks: [{ studentId: 1, status: "absent" }],
      });
    expect(res.status).toBe(200);
    expect(res.body.alerts).toEqual({ channel: "whatsapp", enabled: false, attempted: 0 });
    expect(h.mockSend).not.toHaveBeenCalled();
  });

  it("marks attendance scoped to the teacher's school", async () => {
    h.mockMark.mockResolvedValue(2);
    const res = await request(app)
      .post("/api/attendance")
      .send({
        className: "Grade 10",
        date: "2026-07-01",
        markedAt: "2026-07-01T04:30:00.000Z",
        marks: [
          { studentId: 1, status: "present" },
          { studentId: 2, status: "absent", note: "sick" },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      written: 2,
      notified: 0,
      alerts: { channel: "whatsapp", enabled: true, attempted: 0 },
    });
    expect(h.mockMark).toHaveBeenCalledWith(
      expect.objectContaining({
        schoolCode: "SCHOOL123",
        className: "Grade 10",
        markedAt: "2026-07-01T04:30:00.000Z",
        markedBy: 10,
      })
    );
    // Roster membership was checked against the teacher's own school.
    expect(h.mockFindUsers).toHaveBeenCalledWith({
      role: "student",
      classname: "Grade 10",
      schoolCode: "SCHOOL123",
    });
  });

  it("returns 500 (not success:true) when the attendance write fails (W-2a)", async () => {
    h.mockMark.mockRejectedValue(new Error("db connection lost"));
    const res = await request(app)
      .post("/api/attendance")
      .send({
        className: "Grade 10",
        date: "2026-07-01",
        marks: [{ studentId: 1, status: "present" }],
      });
    expect(res.status).toBe(500);
    expect(res.body.success).toBeUndefined();
    expect(res.body.message).toMatch(/retry/i);
    // No absence alert may fire for a save that never happened.
    expect(h.mockSend).not.toHaveBeenCalled();
  });

  it("rejects marks for a student outside the teacher's class/school (403, no write)", async () => {
    const res = await request(app)
      .post("/api/attendance")
      .send({
        className: "Grade 10",
        date: "2026-07-01",
        marks: [
          { studentId: 1, status: "present" },
          { studentId: 999, status: "absent" }, // another school's student
        ],
      });
    expect(res.status).toBe(403);
    expect(h.mockMark).not.toHaveBeenCalled();
    expect(h.mockSend).not.toHaveBeenCalled();
  });

  it("rejects a future-dated mark (400, no write)", async () => {
    const res = await request(app)
      .post("/api/attendance")
      .send({
        className: "Grade 10",
        date: "2026-07-04",
        marks: [{ studentId: 1, status: "present" }],
      });
    expect(res.status).toBe(400);
    expect(h.mockMark).not.toHaveBeenCalled();
  });

  it("rejects a mark older than the 3-day backfill window (400, no write)", async () => {
    const res = await request(app)
      .post("/api/attendance")
      .send({
        className: "Grade 10",
        date: "2026-06-27",
        marks: [{ studentId: 1, status: "present" }],
      });
    expect(res.status).toBe(400);
    expect(h.mockMark).not.toHaveBeenCalled();
  });

  it("lets a platform admin backfill outside the window", async () => {
    h.currentUser = { id: 1, role: "admin", school_code: null };
    // #336: admin writes derive school_code from the marked students.
    h.mockFindUsers.mockResolvedValue([
      { id: 1, name: "Asha", parentPhone: "+919876543210", schoolCode: "SCHOOL123" },
      { id: 2, name: "Ravi", parentPhone: null, schoolCode: "SCHOOL123" },
    ]);
    h.mockMark.mockResolvedValue(1);
    const res = await request(app)
      .post("/api/attendance")
      .send({
        className: "Grade 10",
        date: "2026-06-01",
        marks: [{ studentId: 1, status: "excused" }],
      });
    expect(res.status).toBe(200);
    expect(h.mockMark).toHaveBeenCalledWith(expect.objectContaining({ schoolCode: "SCHOOL123" }));
  });

  it("fails closed for a teacher with no school (403, no write)", async () => {
    h.currentUser = { id: 11, role: "teacher", school_code: null };
    const res = await request(app)
      .post("/api/attendance")
      .send({
        className: "Grade 10",
        date: "2026-07-01",
        marks: [{ studentId: 1, status: "present" }],
      });
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
      .send({
        className: "Grade 10",
        date: "2026-07-01",
        marks: [{ studentId: 1, status: "present" }],
      });
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
      expect.objectContaining({
        schoolCode: "SCHOOL123",
        className: "Grade 10",
        date: "2026-07-01",
      })
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

  it("returns a principal school summary scoped to the principal's school", async () => {
    h.currentUser = { id: 22, role: "principal", school_code: "SCHOOL123" };
    h.mockSchoolSummary.mockResolvedValue({
      date: "2026-07-02",
      totals: {
        totalStudents: 4,
        markedStudents: 3,
        present: 2,
        absent: 1,
        late: 0,
        excused: 0,
        unmarked: 1,
      },
      classes: [
        {
          className: "Grade 10",
          totalStudents: 4,
          markedStudents: 3,
          present: 2,
          absent: 1,
          late: 0,
          excused: 0,
          unmarked: 1,
        },
      ],
      unmarkedClasses: ["Grade 10"],
    });

    const res = await request(app)
      .get("/api/attendance/school-summary")
      .query({ date: "2026-07-02" });

    expect(res.status).toBe(200);
    expect(res.body.unmarkedClasses).toEqual(["Grade 10"]);
    expect(h.mockSchoolSummary).toHaveBeenCalledWith({
      schoolCode: "SCHOOL123",
      date: "2026-07-02",
    });
  });

  it("fails closed for a principal school summary with no school", async () => {
    h.currentUser = { id: 22, role: "principal", school_code: null };
    const res = await request(app)
      .get("/api/attendance/school-summary")
      .query({ date: "2026-07-02" });
    expect(res.status).toBe(403);
    expect(h.mockSchoolSummary).not.toHaveBeenCalled();
  });

  it("rejects school summary access for teachers", async () => {
    const res = await request(app)
      .get("/api/attendance/school-summary")
      .query({ date: "2026-07-02" });
    expect(res.status).toBe(403);
    expect(h.mockSchoolSummary).not.toHaveBeenCalled();
  });

  it("notifies the parent of an absent student on WhatsApp", async () => {
    h.mockMark.mockResolvedValue(2);
    h.mockFindUsers.mockResolvedValue([
      { id: 1, name: "Asha", parentPhone: "+919876543210" },
      { id: 2, name: "Ravi", parentPhone: null },
    ]);
    h.mockSend.mockResolvedValue({ success: true });

    const res = await request(app)
      .post("/api/attendance")
      .send({
        className: "Grade 10",
        date: "2026-07-02",
        marks: [
          { studentId: 1, status: "absent" },
          { studentId: 2, status: "absent" },
        ],
      });

    expect(res.status).toBe(200);
    // Only Asha has a parent phone — exactly one message, to that number.
    expect(res.body.notified).toBe(1);
    expect(res.body.alerts).toEqual({ channel: "whatsapp", enabled: true, attempted: 1 });
    expect(h.mockSend).toHaveBeenCalledTimes(1);
    expect(h.mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: "+919876543210", body: expect.stringContaining("Asha") })
    );
  });

  it("does not notify anyone when no student is absent", async () => {
    h.mockMark.mockResolvedValue(1);
    const res = await request(app)
      .post("/api/attendance")
      .send({
        className: "Grade 10",
        date: "2026-07-02",
        marks: [{ studentId: 1, status: "present" }],
      });
    expect(res.status).toBe(200);
    expect(res.body.notified).toBe(0);
    expect(res.body.alerts).toEqual({ channel: "whatsapp", enabled: true, attempted: 0 });
    expect(h.mockSend).not.toHaveBeenCalled();
  });

  it("reports alerts disabled and skips dispatch when WhatsApp is not configured", async () => {
    h.mockWhatsappConfigured.mockReturnValue(false);
    h.mockMark.mockResolvedValue(1);

    const res = await request(app)
      .post("/api/attendance")
      .send({
        className: "Grade 10",
        date: "2026-07-02",
        marks: [{ studentId: 1, status: "absent" }],
      });

    expect(res.status).toBe(200);
    expect(res.body.notified).toBe(0);
    expect(res.body.alerts).toEqual({ channel: "whatsapp", enabled: false, attempted: 0 });
    expect(h.mockSend).not.toHaveBeenCalled();
  });

  it("tags mobile attendance saves separately for the demand gate", async () => {
    h.mockMark.mockResolvedValue(1);

    const res = await request(app)
      .post("/api/attendance")
      .set("X-Client", "mobile")
      .send({
        className: "Grade 10",
        date: "2026-07-02",
        marks: [{ studentId: 1, status: "present" }],
      });

    expect(res.status).toBe(200);
    expect(h.mockTrack).toHaveBeenCalledWith(
      expect.objectContaining({ feature: "attendance", schoolCode: "SCHOOL123" })
    );
    expect(h.mockTrack).toHaveBeenCalledWith(
      expect.objectContaining({ feature: "attendance_mobile", schoolCode: "SCHOOL123" })
    );
  });

  describe("GET /roster", () => {
    it("includes parentPhone for web clients", async () => {
      const res = await request(app).get("/api/attendance/roster").query({ className: "Grade 10" });
      expect(res.status).toBe(200);
      expect(res.body[0]).toEqual({ id: 1, name: "Asha", parentPhone: "+919876543210" });
    });

    it("strips parentPhone for mobile clients (W-6: no guardian PII in device cache)", async () => {
      const res = await request(app)
        .get("/api/attendance/roster")
        .set("X-Client", "mobile")
        .query({ className: "Grade 10" });
      expect(res.status).toBe(200);
      expect(res.body).toEqual([
        { id: 1, name: "Asha" },
        { id: 2, name: "Ravi" },
      ]);
      for (const row of res.body) expect(row).not.toHaveProperty("parentPhone");
    });
  });

  describe("PATCH /roster/:studentId/parent-phone", () => {
    it("sets the parent phone for a student in the teacher's school", async () => {
      h.mockFindUserById.mockResolvedValue({
        id: 1,
        role: "student",
        schoolCode: "SCHOOL123",
      });
      h.mockUpdateUser.mockResolvedValue({ id: 1, parentPhone: "+919876543210" });

      const res = await request(app)
        .patch("/api/attendance/roster/1/parent-phone")
        .send({ phone: "+91 98765 43210" });

      expect(res.status).toBe(200);
      expect(h.mockUpdateUser).toHaveBeenCalledWith(1, { parentPhone: "+91 98765 43210" });
    });

    it("blocks setting a phone on another school's student", async () => {
      h.mockFindUserById.mockResolvedValue({ id: 2, role: "student", schoolCode: "OTHER" });
      const res = await request(app)
        .patch("/api/attendance/roster/2/parent-phone")
        .send({ phone: "+919876543210" });
      expect(res.status).toBe(403);
      expect(h.mockUpdateUser).not.toHaveBeenCalled();
    });

    it("rejects an invalid phone", async () => {
      const res = await request(app)
        .patch("/api/attendance/roster/1/parent-phone")
        .send({ phone: "not-a-phone!!" });
      expect(res.status).toBe(400);
      expect(h.mockUpdateUser).not.toHaveBeenCalled();
    });
  });
});
