import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  currentUser: null as any,
  mockCreate: vi.fn(),
  mockGetFees: vi.fn(),
  mockGetFeeById: vi.fn(),
  mockMarkPaid: vi.fn(),
  mockSummary: vi.fn(),
  mockTrack: vi.fn(),
  mockSend: vi.fn(),
  mockFindUserById: vi.fn(),
}));

vi.mock("../middleware", () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = h.currentUser;
    next();
  },
  requireRole:
    (...roles: string[]) =>
    (req: any, res: any, next: any) => {
      if (!req.user || !roles.includes(req.user.role))
        return res.status(403).json({ message: "forbidden" });
      next();
    },
}));

vi.mock("../lib/db/pg-queries", () => ({
  pgCreateFee: h.mockCreate,
  pgGetFees: h.mockGetFees,
  pgGetFeeById: h.mockGetFeeById,
  pgMarkFeePaid: h.mockMarkPaid,
  pgGetFeeSummary: h.mockSummary,
  pgTrackFeatureUsage: h.mockTrack,
  pgFindUserById: h.mockFindUserById,
}));

vi.mock("../services/whatsapp", () => ({
  whatsappService: { sendMessage: h.mockSend },
}));

import feesRoutes from "../routes/fees";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/fees", feesRoutes);
  return app;
}

describe("Fees API", () => {
  let app: express.Express;
  beforeEach(() => {
    vi.clearAllMocks();
    app = makeApp();
    h.currentUser = { id: 5, role: "school_admin", school_code: "SCHOOL123" };
    // Default: the target student belongs to the admin's school (W-6 check).
    h.mockFindUserById.mockResolvedValue({ id: 9, role: "student", schoolCode: "SCHOOL123" });
  });

  it("blocks creating a fee for another school's student (403, no create)", async () => {
    h.mockFindUserById.mockResolvedValue({ id: 9, role: "student", schoolCode: "OTHER" });
    const res = await request(app)
      .post("/api/fees")
      .send({ studentId: 9, description: "Term 1", amountCents: 500000 });
    expect(res.status).toBe(403);
    expect(h.mockCreate).not.toHaveBeenCalled();
  });

  it("404s when the fee target is not a student", async () => {
    h.mockFindUserById.mockResolvedValue({ id: 9, role: "teacher", schoolCode: "SCHOOL123" });
    const res = await request(app)
      .post("/api/fees")
      .send({ studentId: 9, description: "Term 1", amountCents: 500000 });
    expect(res.status).toBe(404);
    expect(h.mockCreate).not.toHaveBeenCalled();
  });

  it("creates a fee scoped to the admin's school", async () => {
    h.mockCreate.mockResolvedValue(77);
    const res = await request(app)
      .post("/api/fees")
      .send({ studentId: 9, description: "Term 1", amountCents: 500000 });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: 77, status: "pending" });
    expect(h.mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: 9,
        schoolCode: "SCHOOL123",
        amountCents: 500000,
        createdBy: 5,
      })
    );
    expect(h.mockTrack).toHaveBeenCalledWith(
      expect.objectContaining({ feature: "fees", schoolCode: "SCHOOL123" })
    );
  });

  it("fails closed for an admin with no school (403, no create)", async () => {
    h.currentUser = { id: 6, role: "school_admin", school_code: null };
    const res = await request(app)
      .post("/api/fees")
      .send({ studentId: 9, description: "Term 1", amountCents: 500000 });
    expect(res.status).toBe(403);
    expect(h.mockCreate).not.toHaveBeenCalled();
  });

  it("validates the create payload", async () => {
    const res = await request(app).post("/api/fees").send({ studentId: 9, amountCents: -1 });
    expect(res.status).toBe(400);
    expect(h.mockCreate).not.toHaveBeenCalled();
  });

  it("rejects a non-admin role", async () => {
    h.currentUser = { id: 7, role: "teacher", school_code: "SCHOOL123" };
    const res = await request(app)
      .post("/api/fees")
      .send({ studentId: 9, description: "x", amountCents: 100 });
    expect(res.status).toBe(403);
  });

  it("lists fees scoped to school", async () => {
    h.mockGetFees.mockResolvedValue([{ id: 1, studentName: "Asha", status: "pending" }]);
    const res = await request(app).get("/api/fees?status=pending");
    expect(res.status).toBe(200);
    expect(h.mockGetFees).toHaveBeenCalledWith(
      expect.objectContaining({ schoolCode: "SCHOOL123", status: "pending" })
    );
  });

  it("returns the fee summary", async () => {
    h.mockSummary.mockResolvedValue({
      pendingCents: 500000,
      paidCents: 0,
      pendingCount: 1,
      paidCount: 0,
    });
    const res = await request(app).get("/api/fees/summary");
    expect(res.status).toBe(200);
    expect(res.body.pendingCents).toBe(500000);
  });

  it("marks a fee paid", async () => {
    h.mockMarkPaid.mockResolvedValue(true);
    const res = await request(app).post("/api/fees/77/mark-paid");
    expect(res.status).toBe(200);
    expect(h.mockMarkPaid).toHaveBeenCalledWith(77, "SCHOOL123");
  });

  it("returns 404 when marking a non-existent/already-paid fee", async () => {
    h.mockMarkPaid.mockResolvedValue(false);
    const res = await request(app).post("/api/fees/77/mark-paid");
    expect(res.status).toBe(404);
  });

  it("sends a WhatsApp reminder for a fee in the admin's school", async () => {
    h.mockGetFeeById.mockResolvedValue({
      id: 77,
      studentName: "Asha",
      schoolCode: "SCHOOL123",
      description: "Term 1",
      amountCents: 500000,
      currency: "INR",
      dueDate: "2026-07-15",
    });
    h.mockSend.mockResolvedValue({ success: true, simulated: true });
    const res = await request(app).post("/api/fees/77/remind").send({ phone: "+15551234567" });
    expect(res.status).toBe(200);
    expect(h.mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: "+15551234567", body: expect.stringContaining("Asha") })
    );
  });

  it("blocks reminding on a fee from another school", async () => {
    h.mockGetFeeById.mockResolvedValue({
      id: 88,
      schoolCode: "OTHER",
      studentName: "X",
      amountCents: 100,
      currency: "INR",
    });
    const res = await request(app).post("/api/fees/88/remind").send({ phone: "+15551234567" });
    expect(res.status).toBe(403);
    expect(h.mockSend).not.toHaveBeenCalled();
  });

  it("requires a phone for the reminder", async () => {
    const res = await request(app).post("/api/fees/77/remind").send({});
    expect(res.status).toBe(400);
  });
});
