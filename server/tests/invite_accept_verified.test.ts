import { vi } from "vitest";

// Mock mailer (avoid SMTP) — top-level for hoist safety.
vi.mock("../lib/mailer", () => ({
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

vi.mock("../lib/firebase-admin", () => ({
  setCustomUserClaims: vi.fn().mockResolvedValue(true),
}));

const createUser = vi.fn().mockResolvedValue({ uid: "fb_uid_123" });
vi.mock("firebase-admin", () => ({
  default: { auth: () => ({ createUser }) },
}));

import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import onboardingRouter from "../routes/onboarding";
import { pgFindInviteByToken, pgCreateUser, pgAcceptInvite } from "../lib/pg-queries";

describe("Onboarding invite accept marks the account email-verified", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    createUser.mockResolvedValue({ uid: "fb_uid_123" });
    app = express();
    app.use(express.json());
    app.use("/api/onboarding", onboardingRouter);

    (pgFindInviteByToken as any).mockResolvedValue({
      id: 1,
      email: "student@example.com",
      name: "Riya",
      role: "student",
      schoolId: null,
      status: "pending",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    (pgCreateUser as any).mockResolvedValue({
      id: 77,
      email: "student@example.com",
      role: "student",
    });
    (pgAcceptInvite as any).mockResolvedValue(undefined);
  });

  it("creates the Firebase and PG user with emailVerified: true", async () => {
    const res = await request(app).post("/api/onboarding/invite/accept").send({
      token: "11111111-1111-1111-1111-111111111111",
      email: "student@example.com",
      displayName: "Riya",
      password: "supersecret123",
    });

    expect(res.status).toBe(201);
    expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ emailVerified: true }));
    expect(pgCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({ emailVerified: true, role: "student", status: "active" })
    );
  });
});
