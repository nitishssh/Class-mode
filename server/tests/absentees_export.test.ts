// Absentee call list (GET /api/attendance/absentees) and school data export
// (GET /api/export/*.csv) — the two offer commitments: "the app produces the
// day's absentee list" and "your data is exported to you (Excel) at no cost".
//
// Spec E5: report/export queries are school-scoped with a REQUIRED
// schoolCode and fail loudly (500), never silently empty.

import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  currentUser: null as any,
  mockAbsentees: vi.fn(),
  mockExportAttendance: vi.fn(),
  mockExportFees: vi.fn(),
}));

vi.mock("../middleware", () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    if (!h.currentUser) return res.status(401).json({ message: "unauthorized" });
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
  pgMarkAttendance: vi.fn(),
  pgGetAttendanceByClassDate: vi.fn(),
  pgGetStudentAttendanceSummary: vi.fn(),
  pgGetSchoolAttendanceSummary: vi.fn(),
  pgGetAbsenteesByDate: h.mockAbsentees,
  pgExportAttendanceRows: h.mockExportAttendance,
  pgExportFeeRows: h.mockExportFees,
  pgGetClassNames: vi.fn(),
  pgFindUsers: vi.fn(),
  pgFindUserById: vi.fn(),
  pgUpdateUser: vi.fn(),
  pgTrackFeatureUsage: vi.fn(),
}));

vi.mock("../services/whatsapp", () => ({
  whatsappService: { sendMessage: vi.fn(), isConfigured: vi.fn().mockReturnValue(false) },
}));

import attendanceRoutes from "../routes/attendance";
import exportRoutes from "../routes/export";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/attendance", attendanceRoutes);
  app.use("/api/export", exportRoutes);
  return app;
}

const PRINCIPAL = { id: 1, role: "principal", schoolCode: "SCHOOL123" };
const PLATFORM_ADMIN = { id: 2, role: "admin", schoolCode: null };
const TEACHER = { id: 3, role: "teacher", schoolCode: "SCHOOL123" };

describe("GET /api/attendance/absentees", () => {
  let app: express.Express;
  beforeEach(() => {
    vi.clearAllMocks();
    app = makeApp();
    h.currentUser = PRINCIPAL;
  });

  it("returns the day's absentees scoped to the principal's school", async () => {
    h.mockAbsentees.mockResolvedValue([
      { studentId: 5, studentName: "Asha", className: "5A", parentPhone: "+911234", note: null },
    ]);
    const res = await request(app).get("/api/attendance/absentees?date=2026-07-17");
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.absentees[0].studentName).toBe("Asha");
    expect(h.mockAbsentees).toHaveBeenCalledWith({ schoolCode: "SCHOOL123", date: "2026-07-17" });
  });

  it("rejects teachers (office/principal artifact, not the wedge screen)", async () => {
    h.currentUser = TEACHER;
    const res = await request(app).get("/api/attendance/absentees?date=2026-07-17");
    expect(res.status).toBe(403);
  });

  it("rejects a malformed date", async () => {
    const res = await request(app).get("/api/attendance/absentees?date=17-07-2026");
    expect(res.status).toBe(400);
    expect(h.mockAbsentees).not.toHaveBeenCalled();
  });

  it("fails closed when a platform admin names no school", async () => {
    h.currentUser = PLATFORM_ADMIN;
    const res = await request(app).get("/api/attendance/absentees?date=2026-07-17");
    expect(res.status).toBe(400);
    expect(h.mockAbsentees).not.toHaveBeenCalled();
  });

  it("lets a platform admin query an explicit school", async () => {
    h.currentUser = PLATFORM_ADMIN;
    h.mockAbsentees.mockResolvedValue([]);
    const res = await request(app).get(
      "/api/attendance/absentees?date=2026-07-17&schoolCode=OTHER1"
    );
    expect(res.status).toBe(200);
    expect(h.mockAbsentees).toHaveBeenCalledWith({ schoolCode: "OTHER1", date: "2026-07-17" });
  });

  it("returns 500 on query failure — never a silently empty list (E5)", async () => {
    h.mockAbsentees.mockRejectedValue(new Error("pg down"));
    const res = await request(app).get("/api/attendance/absentees?date=2026-07-17");
    expect(res.status).toBe(500);
  });
});

describe("GET /api/export/*.csv", () => {
  let app: express.Express;
  beforeEach(() => {
    vi.clearAllMocks();
    app = makeApp();
    h.currentUser = PRINCIPAL;
  });

  it("exports attendance as UTF-8-BOM CSV scoped to the school", async () => {
    h.mockExportAttendance.mockResolvedValue([
      {
        date: "2026-07-17",
        className: "5A",
        studentName: 'Ravi "RJ"',
        status: "absent",
        note: null,
        markedBy: "Meena",
      },
    ]);
    const res = await request(app).get("/api/export/attendance.csv?from=2026-07-01");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toContain("attendance-SCHOOL123.csv");
    expect(res.text.charCodeAt(0)).toBe(0xfeff); // BOM so Excel opens vernacular names
    expect(res.text).toContain("Date,Class,Student,Status,Note,Marked by");
    expect(res.text).toContain('"Ravi ""RJ"""'); // quote escaping
    expect(h.mockExportAttendance).toHaveBeenCalledWith({
      schoolCode: "SCHOOL123",
      from: "2026-07-01",
      to: undefined,
    });
  });

  it("exports fees with amounts in currency units, not cents", async () => {
    h.mockExportFees.mockResolvedValue([
      {
        studentName: "Asha",
        className: "5A",
        description: "Term 1 fee",
        amountCents: 40000,
        currency: "INR",
        status: "pending",
        dueDate: "2026-08-01",
        paidAt: null,
        createdAt: "2026-07-17",
      },
    ]);
    const res = await request(app).get("/api/export/fees.csv");
    expect(res.status).toBe(200);
    expect(res.text).toContain("400.00");
    expect(h.mockExportFees).toHaveBeenCalledWith({ schoolCode: "SCHOOL123" });
  });

  it("rejects teachers", async () => {
    h.currentUser = TEACHER;
    const res = await request(app).get("/api/export/attendance.csv");
    expect(res.status).toBe(403);
  });

  it("fails closed for a platform admin without an explicit school", async () => {
    h.currentUser = PLATFORM_ADMIN;
    const res = await request(app).get("/api/export/fees.csv");
    expect(res.status).toBe(400);
    expect(h.mockExportFees).not.toHaveBeenCalled();
  });

  it("returns 500 on query failure — never a silently empty file (E5)", async () => {
    h.mockExportAttendance.mockRejectedValue(new Error("pg down"));
    const res = await request(app).get("/api/export/attendance.csv");
    expect(res.status).toBe(500);
  });
});
