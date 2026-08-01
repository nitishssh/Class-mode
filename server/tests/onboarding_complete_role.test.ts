import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../lib/integrations/mailer", () => ({
  sendTeacherInvite: vi.fn().mockResolvedValue(undefined),
  sendStudentInvite: vi.fn().mockResolvedValue(undefined),
  sendPrincipalInvite: vi.fn().mockResolvedValue(undefined),
  sendSchoolAdminInvite: vi.fn().mockResolvedValue(undefined),
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/audit", () => ({
  AUDIT_EVENTS: { INVITE_ACCEPTED: "invite_accepted" },
  recordAuditEvent: vi.fn(),
}));

import express from "express";
import session from "express-session";
import request from "supertest";
import onboardingRouter from "../routes/onboarding";
import { issueAccessToken } from "../lib/auth/auth-workspace";
import {
  pgFindUserById,
  pgUpsertSchool,
  pgFindFirstWorkspaceMembership,
} from "../lib/db/pg-queries";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: "test-secret", resave: false, saveUninitialized: false }));
  app.use("/api/onboarding", onboardingRouter);
  return app;
}

const validBody = (role: string) => ({
  role,
  school: {
    name: "Springfield High",
    city: "Springfield",
    board: "CBSE",
    gradesOffered: ["6", "7"],
    approximateStudents: "50-200",
  },
  user: { subjects: ["Math"] },
});

describe("POST /api/onboarding/complete role guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (pgUpsertSchool as any).mockResolvedValue({ id: 1, name: "Springfield High" });
    (pgFindFirstWorkspaceMembership as any).mockResolvedValue(null);
  });

  it("lets a fresh self-signup school_admin choose principal during first onboarding", async () => {
    // authenticateToken and the handler both resolve via pgFindUserById.
    (pgFindUserById as any).mockResolvedValue({
      id: 10,
      authSubject: "creator@example.com",
      email: "creator@example.com",
      role: "school_admin",
      status: "active",
      emailVerified: true,
      onboardingComplete: false,
    });
    const token = issueAccessToken({ userId: 10 });
    const res = await request(makeApp())
      .post("/api/onboarding/complete")
      .set("Authorization", `Bearer ${token}`)
      .send(validBody("principal"));
    expect(res.status).not.toBe(403);
  });

  it("blocks an invited teacher from escalating to school_admin", async () => {
    (pgFindUserById as any).mockResolvedValue({
      id: 11,
      authSubject: "teacher@example.com",
      email: "teacher@example.com",
      role: "teacher",
      status: "active",
      emailVerified: true,
      onboardingComplete: false,
    });
    const token = issueAccessToken({ userId: 11 });
    const res = await request(makeApp())
      .post("/api/onboarding/complete")
      .set("Authorization", `Bearer ${token}`)
      .send(validBody("school_admin"));
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/cannot change role/i);
  });

  it("blocks an invited student from escalating to a staff role (M1)", async () => {
    // Regression: `student` was previously in CHANGEABLE_DEFAULT_ROLES, which let
    // an invited student self-select principal/teacher/school_admin during their
    // first onboarding. Students must never be able to change to a staff role.
    (pgFindUserById as any).mockResolvedValue({
      id: 12,
      authSubject: "student@example.com",
      email: "student@example.com",
      role: "student",
      status: "active",
      emailVerified: true,
      onboardingComplete: false,
    });
    const token = issueAccessToken({ userId: 12 });
    const res = await request(makeApp())
      .post("/api/onboarding/complete")
      .set("Authorization", `Bearer ${token}`)
      .send(validBody("teacher"));
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/cannot change role/i);
  });
});
