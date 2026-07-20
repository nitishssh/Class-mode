// Edge-case coverage for GET /api/export/*.csv (server/routes/export.ts)
// that server/tests/absentees_export.test.ts does not exercise:
//   - malformed from/to date validation (400, no query)
//   - `to` bound forwarding to pgExportAttendanceRows
//   - platform admin exporting an explicit school via ?schoolCode=
//   - fees.csv query failure is a 500, never a silently empty file (E5)
//   - fees.csv role gate rejects teachers

import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  currentUser: null as any,
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
  pgExportAttendanceRows: h.mockExportAttendance,
  pgExportFeeRows: h.mockExportFees,
}));

import exportRoutes from "../routes/export";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/export", exportRoutes);
  return app;
}

const PRINCIPAL = { id: 1, role: "principal", schoolCode: "SCHOOL123" };
const PLATFORM_ADMIN = { id: 2, role: "admin", schoolCode: null };
const TEACHER = { id: 3, role: "teacher", schoolCode: "SCHOOL123" };

describe("GET /api/export/*.csv — edge cases", () => {
  let app: express.Express;
  beforeEach(() => {
    vi.clearAllMocks();
    app = makeApp();
    h.currentUser = PRINCIPAL;
  });

  it("rejects malformed from/to dates (400, no query)", async () => {
    const badFrom = await request(app).get("/api/export/attendance.csv?from=01-07-2026");
    expect(badFrom.status).toBe(400);
    const badTo = await request(app).get("/api/export/attendance.csv?to=2026/07/31");
    expect(badTo.status).toBe(400);
    expect(h.mockExportAttendance).not.toHaveBeenCalled();
  });

  it("rejects an inverted date range (from > to) with 400, no query", async () => {
    const res = await request(app).get("/api/export/attendance.csv?from=2026-07-31&to=2026-07-01");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/from must not be after to/);
    expect(h.mockExportAttendance).not.toHaveBeenCalled();
  });

  it("forwards both from and to bounds to the query", async () => {
    h.mockExportAttendance.mockResolvedValue([]);
    const res = await request(app).get("/api/export/attendance.csv?from=2026-07-01&to=2026-07-31");
    expect(res.status).toBe(200);
    expect(h.mockExportAttendance).toHaveBeenCalledWith({
      schoolCode: "SCHOOL123",
      from: "2026-07-01",
      to: "2026-07-31",
    });
  });

  it("lets a platform admin export an explicit school via ?schoolCode=", async () => {
    h.currentUser = PLATFORM_ADMIN;
    h.mockExportFees.mockResolvedValue([]);
    const res = await request(app).get("/api/export/fees.csv?schoolCode=OTHER1");
    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toContain("fees-OTHER1.csv");
    expect(h.mockExportFees).toHaveBeenCalledWith({ schoolCode: "OTHER1" });
  });

  it("returns 500 on fees query failure — never a silently empty file (E5)", async () => {
    h.mockExportFees.mockRejectedValue(new Error("pg down"));
    const res = await request(app).get("/api/export/fees.csv");
    expect(res.status).toBe(500);
  });

  it("rejects teachers on fees.csv", async () => {
    h.currentUser = TEACHER;
    const res = await request(app).get("/api/export/fees.csv");
    expect(res.status).toBe(403);
    expect(h.mockExportFees).not.toHaveBeenCalled();
  });

  it("ignores a client-supplied schoolCode for school-bound roles", async () => {
    h.mockExportFees.mockResolvedValue([]);
    const res = await request(app).get("/api/export/fees.csv?schoolCode=OTHER1");
    expect(res.status).toBe(200);
    expect(h.mockExportFees).toHaveBeenCalledWith({ schoolCode: "SCHOOL123" });
  });

  it("rejects impossible-but-well-formed dates (2026-02-31)", async () => {
    const res = await request(app).get("/api/export/attendance.csv?from=2026-02-31");
    expect(res.status).toBe(400);
    expect(h.mockExportAttendance).not.toHaveBeenCalled();
  });

  it("rejects a malformed schoolCode from a platform admin (header injection guard)", async () => {
    h.currentUser = PLATFORM_ADMIN;
    const res = await request(app).get(
      `/api/export/fees.csv?schoolCode=${encodeURIComponent('EVIL"; x="y')}`
    );
    expect(res.status).toBe(400);
    expect(h.mockExportFees).not.toHaveBeenCalled();
  });

  it("neutralizes formula-injection payloads in exported CSV (CWE-1236)", async () => {
    h.mockExportAttendance.mockResolvedValue([
      {
        date: "2026-07-17",
        className: "5A",
        studentName: '=HYPERLINK("http://evil","x")',
        status: "absent",
        note: "+1|cmd",
        markedBy: "@a",
      },
    ]);
    const res = await request(app).get("/api/export/attendance.csv");
    expect(res.status).toBe(200);
    expect(res.text).not.toMatch(/(^|,|\r\n)=HYPERLINK/);
    expect(res.text).toContain("'=HYPERLINK");
    expect(res.text).toContain(",'+1|cmd,");
    expect(res.text).toContain(",'@a");
  });
});
