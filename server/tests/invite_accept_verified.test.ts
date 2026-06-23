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

import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import bcrypt from "bcryptjs";
import onboardingRouter from "../routes/onboarding";
import {
  pgFindInviteByToken,
  pgFindUserByEmail,
  pgCreateUser,
  pgAcceptInvite,
} from "../lib/pg-queries";

describe("Onboarding invite accept creates a local-password account", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
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
    // No pre-existing account → the create branch runs.
    (pgFindUserByEmail as any).mockResolvedValue(null);
    (pgCreateUser as any).mockResolvedValue({
      id: 77,
      email: "student@example.com",
      authSubject: "student@example.com",
      role: "student",
    });
    (pgAcceptInvite as any).mockResolvedValue(undefined);
  });

  it("creates a local PG user with a bcrypt password and emailVerified: true", async () => {
    const res = await request(app).post("/api/onboarding/invite/accept").send({
      token: "11111111-1111-1111-1111-111111111111",
      email: "student@example.com",
      displayName: "Riya",
      password: "supersecret123",
    });

    expect(res.status).toBe(201);
    expect(pgCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        authProvider: "local",
        emailVerified: true,
        role: "student",
        status: "active",
      })
    );

    // The stored password must be a bcrypt hash of the submitted password —
    // not the literal "firebase_managed", which made local login impossible.
    const createArgs = (pgCreateUser as any).mock.calls[0][0];
    expect(createArgs.passwordHash).not.toBe("firebase_managed");
    expect(await bcrypt.compare("supersecret123", createArgs.passwordHash)).toBe(true);
  });
});
