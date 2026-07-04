import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const { mockQuery, mockSendLeadNotification } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockSendLeadNotification: vi.fn(),
}));

vi.mock("../db-pg", () => ({
  getPgPool: () => ({ query: mockQuery }),
}));

vi.mock("../lib/mailer", () => ({
  sendLeadNotification: mockSendLeadNotification,
}));

import leadsRouter from "../routes/leads";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/leads", leadsRouter);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockQuery.mockResolvedValue({ rows: [{ id: 42 }] });
  mockSendLeadNotification.mockResolvedValue(undefined);
});

describe("POST /api/leads — landing-page contact form", () => {
  it("rejects a submission without a name", async () => {
    const res = await request(makeApp())
      .post("/api/leads")
      .send({ email: "principal@school.example" });

    expect(res.status).toBe(400);
    expect(res.body.errors.name).toBeDefined();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("rejects a submission with neither phone nor email", async () => {
    const res = await request(makeApp())
      .post("/api/leads")
      .send({ name: "Asha", message: "Interested in a pilot" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/phone number or email/i);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("rejects a malformed email", async () => {
    const res = await request(makeApp())
      .post("/api/leads")
      .send({ name: "Asha", email: "not-an-email" });

    expect(res.status).toBe(400);
    expect(res.body.errors.email).toBeDefined();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("persists a valid lead and notifies the team", async () => {
    const res = await request(makeApp()).post("/api/leads").send({
      name: "Asha Verma",
      school: "Sunrise Public School",
      email: "asha@school.example",
      phone: "",
      role: "School / Institution",
      message: "We'd like to run a pilot.",
    });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(42);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO leads"), [
      "Asha Verma",
      "Sunrise Public School",
      "asha@school.example",
      null,
      "School / Institution",
      "We'd like to run a pilot.",
    ]);
    await vi.waitFor(() =>
      expect(mockSendLeadNotification).toHaveBeenCalledWith(
        expect.objectContaining({ id: 42, name: "Asha Verma" })
      )
    );
  });

  it("accepts a phone-only submission (no email)", async () => {
    const res = await request(makeApp())
      .post("/api/leads")
      .send({ name: "Ravi", phone: "+91 98765 43210" });

    expect(res.status).toBe(201);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO leads"), [
      "Ravi",
      null,
      null,
      "+91 98765 43210",
      null,
      null,
    ]);
  });

  it("returns 500 and skips notification when the insert fails", async () => {
    mockQuery.mockRejectedValueOnce(new Error("connection refused"));

    const res = await request(makeApp())
      .post("/api/leads")
      .send({ name: "Asha", email: "asha@school.example" });

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/try again/i);
    expect(mockSendLeadNotification).not.toHaveBeenCalled();
  });

  it("still returns 201 when the notification email fails", async () => {
    mockSendLeadNotification.mockRejectedValueOnce(new Error("smtp down"));

    const res = await request(makeApp())
      .post("/api/leads")
      .send({ name: "Asha", email: "asha@school.example" });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(42);
  });
});
