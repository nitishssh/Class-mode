import { vi } from "vitest";

// Mock mailer (avoid SMTP) — top-level for hoist safety.
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

import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import bcrypt from "bcryptjs";
import onboardingRouter from "../routes/onboarding";
import {
  pgFindInviteByToken,
  pgFindUserByEmail,
  pgCreateUser,
  pgUpdateUser,
  pgAcceptInvite,
} from "../lib/db/pg-queries";

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

describe("Onboarding invite accept never mutates an account that already exists", () => {
  let app: express.Express;

  const existingAccount = {
    id: 77,
    email: "parent@example.com",
    authProvider: "local",
    authSubject: "parent@example.com",
    passwordHash: "$2a$12$originalhashfortheexistingaccount",
    displayName: "Aarav",
    name: "Aarav",
    role: "student",
    status: "active",
    className: "6A",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use("/api/onboarding", onboardingRouter);
  });

  // Student invites are addressed to the PARENT's email but carry role
  // "student" (see POST /invite/student). Accepting used to overwrite the
  // account found at that email — so a second child invited to the same parent
  // email overwrote the first child's displayName and className, while their
  // attendance rows (unique per student_id+date) stayed attached to the row.
  it("refuses a second sibling invited to the same parent email, leaving the first child's row intact", async () => {
    (pgFindInviteByToken as any).mockResolvedValue({
      id: 2,
      email: "parent@example.com",
      name: "Diya",
      role: "student",
      schoolId: null,
      classId: null,
      status: "pending",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    (pgFindUserByEmail as any).mockResolvedValue(existingAccount);

    const res = await request(app).post("/api/onboarding/invite/accept").send({
      token: "22222222-2222-2222-2222-222222222222",
      email: "parent@example.com",
      displayName: "Diya",
      password: "a-new-password",
    });

    expect(res.status).toBe(409);
    expect(res.body.accountExists).toBe(true);
    // The first child's record is untouched and the invite stays pending.
    expect(pgUpdateUser).not.toHaveBeenCalled();
    expect(pgCreateUser).not.toHaveBeenCalled();
    expect(pgAcceptInvite).not.toHaveBeenCalled();
  });

  // Credential injection: whoever controls an invite for an address that
  // already has an account could previously reset that account's password and
  // rebind its role/school.
  it("does not reset the password or role of an existing non-privileged account", async () => {
    (pgFindInviteByToken as any).mockResolvedValue({
      id: 3,
      email: "parent@example.com",
      name: "Whoever",
      role: "teacher",
      schoolId: null,
      classId: null,
      status: "pending",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    (pgFindUserByEmail as any).mockResolvedValue(existingAccount);

    const res = await request(app).post("/api/onboarding/invite/accept").send({
      token: "33333333-3333-3333-3333-333333333333",
      email: "parent@example.com",
      displayName: "Attacker Chosen",
      password: "attacker-chosen-password",
    });

    expect(res.status).toBe(409);
    expect(pgUpdateUser).not.toHaveBeenCalled();
    expect(pgAcceptInvite).not.toHaveBeenCalled();
  });
});
