import { vi } from "vitest";

// Mock mailer at the very top to prevent Vitest import hoisting issues
vi.mock("../lib/integrations/mailer", () => ({
  EmailDeliveryError: class EmailDeliveryError extends Error {
    kind = "email_delivery_failed" as const;
  },
  sendEmailVerification: vi.fn().mockResolvedValue(undefined),
  sendPasswordReset: vi.fn().mockResolvedValue(undefined),
  sendWorkspaceInvite: vi.fn().mockResolvedValue(undefined),
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
  sendTeacherInvite: vi.fn().mockResolvedValue(undefined),
  sendStudentInvite: vi.fn().mockResolvedValue(undefined),
}));

// Mock audit
vi.mock("../lib/audit", () => ({
  AUDIT_EVENTS: {
    USER_REGISTERED: "user_registered",
    USER_LOGIN: "user_login",
    INVITE_ACCEPTED: "invite_accepted",
  },
  recordAuditEvent: vi.fn(),
}));

// Mock Storage
vi.mock("../storage", () => ({
  storage: {
    createSession: vi.fn().mockResolvedValue({ id: 99 }),
    getSessionByRefreshToken: vi.fn(),
    deleteSession: vi.fn(),
    deleteAllUserSessions: vi.fn(),
    getUser: vi.fn(),
    createOtp: vi.fn().mockResolvedValue({ id: 101 }),
    markOtpUsed: vi.fn(),
  },
}));

import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import session from "express-session";
import authRouter from "../routes/auth";
import onboardingRouter from "../routes/onboarding";
import { authenticateToken } from "../middleware";
import {
  pgFindUserByEmail,
  pgFindUserById,
  pgCreateUser,
  pgUpdateUser,
  pgFindWorkspaceInviteByTokenHash,
  pgAcceptWorkspaceInvite,
  pgFindInviteByToken,
  pgAcceptInvite,
  pgUpsertWorkspaceMembership,
  pgFindFirstWorkspaceMembership,
  pgFindWorkspaceBySlug,
  pgCreateWorkspace,
} from "../lib/db/pg-queries";
import { sendWelcomeEmail, sendEmailVerification } from "../lib/integrations/mailer";
import jwt from "jsonwebtoken";

describe("Authentication Security and Hardening", () => {
  let app: express.Express;
  const JWT_SECRET = process.env.JWT_SECRET || "test-secret-key";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;

    app = express();
    app.use(express.json());
    app.use(
      session({
        secret: "test-session-secret",
        resave: false,
        saveUninitialized: false,
      })
    );
    app.use("/api/auth", authRouter);
    app.use("/api", authRouter);
    app.use("/api", onboardingRouter);
    app.use("/api/onboarding", onboardingRouter);
  });

  describe("Invite acceptance cannot authenticate as an existing account", () => {
    // Regression for the unauthenticated invite-accept bypass.
    //
    // POST /invite/accept and POST /invites/:token/accept used to be mounted on
    // the auth router WITHOUT authenticateToken. When the invited email already
    // had an account the handler looked that user up by email, never verified
    // the submitted password, and called createLoginSession — so possession of
    // an invite link alone granted a full session as that account. Both routes
    // and their handler are gone; the safe path is /workspace-invite/signup.
    it.each([["/api/auth/invite/accept"], ["/api/auth/invites/some_invite_token/accept"]])(
      "%s is no longer mounted on the auth router",
      async (path) => {
        const res = await request(app).post(path).send({
          token: "some_invite_token",
          password: "attacker-chosen-password",
          displayName: "Attacker",
        });

        expect(res.status).toBe(404);
        // The bypass was not just "wrong status" — nothing may be written or
        // granted on these paths.
        expect(pgUpdateUser).not.toHaveBeenCalled();
        expect(pgCreateUser).not.toHaveBeenCalled();
        expect(pgUpsertWorkspaceMembership).not.toHaveBeenCalled();
        expect(pgAcceptWorkspaceInvite).not.toHaveBeenCalled();
      }
    );

    // server/routes/index.ts mounts authRouter at BOTH /api/auth and /api, so the
    // removed routes have a second production path. The shared `app` above also
    // mounts onboardingRouter at /api, which would answer /api/invite/accept and
    // mask the check — this app replicates production mounting exactly.
    it.each([["/api/invite/accept"], ["/api/invites/some_invite_token/accept"]])(
      "%s is gone under production route mounting too",
      async (path) => {
        const prodApp = express();
        prodApp.use(express.json());
        prodApp.use("/api/auth", authRouter);
        prodApp.use("/api", authRouter);
        prodApp.use("/api/onboarding", onboardingRouter);

        const res = await request(prodApp).post(path).send({
          token: "some_invite_token",
          password: "attacker-chosen-password1",
          displayName: "Attacker",
        });

        expect(res.status).toBe(404);
        expect(pgUpdateUser).not.toHaveBeenCalled();
        expect(pgUpsertWorkspaceMembership).not.toHaveBeenCalled();
      }
    );

    it("workspace-invite/signup refuses an email that already has an account and issues no session", async () => {
      (pgFindWorkspaceInviteByTokenHash as any).mockResolvedValue({
        id: 100,
        workspaceId: 10,
        email: "existing_member@example.com",
        name: "Invite Name",
        role: "member",
        kind: "business_member",
        status: "pending",
        expiresAt: new Date(Date.now() + 100000),
      });
      (pgFindUserByEmail as any).mockResolvedValue({
        id: 42,
        email: "existing_member@example.com",
        passwordHash: "$2a$12$securepasswordhashhere",
        displayName: "Original Name",
        role: "teacher",
        status: "active",
      });

      const res = await request(app).post("/api/auth/workspace-invite/signup").send({
        token: "valid_invite_token_here",
        displayName: "Attacker Chosen Name",
        password: "attacker-chosen-password1",
      });

      expect(res.status).toBe(409);
      expect(res.body.accountExists).toBe(true);
      expect(res.body.token).toBeUndefined();
      // The existing account is untouched: no password reset, no profile edit,
      // no membership granted, and the invite stays pending.
      expect(pgUpdateUser).not.toHaveBeenCalled();
      expect(pgCreateUser).not.toHaveBeenCalled();
      expect(pgUpsertWorkspaceMembership).not.toHaveBeenCalled();
      expect(pgAcceptWorkspaceInvite).not.toHaveBeenCalled();
    });

    it("workspace-invite/signup creates the account when the email is new", async () => {
      (pgFindWorkspaceInviteByTokenHash as any).mockResolvedValue({
        id: 101,
        workspaceId: 11,
        email: "brand_new_user@example.com",
        name: "Brand New",
        role: "member",
        kind: "student",
        status: "pending",
        studentMeta: { grade: "10th", className: "A" },
        expiresAt: new Date(Date.now() + 100000),
      });
      (pgFindUserByEmail as any).mockResolvedValue(null);
      const createdUser = {
        id: 43,
        email: "brand_new_user@example.com",
        displayName: "Brand New",
        name: "Brand New",
        role: "student",
        status: "active",
      };
      (pgCreateUser as any).mockResolvedValue(createdUser);
      (pgFindUserById as any).mockResolvedValue(createdUser);
      (pgFindFirstWorkspaceMembership as any).mockResolvedValue(null);

      const res = await request(app).post("/api/auth/workspace-invite/signup").send({
        token: "valid_invite_token_here",
        displayName: "Brand New",
        password: "supersecurepassword123",
      });

      expect(res.status).toBe(201);
      expect(pgCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "brand_new_user@example.com",
          authProvider: "local",
          role: "student",
          passwordHash: expect.any(String),
        })
      );
      expect(pgUpdateUser).not.toHaveBeenCalled();
      expect(pgAcceptWorkspaceInvite).toHaveBeenCalledWith(101);
    });
  });

  describe("firebaseUid Session Key Population", () => {
    it("should populate firebaseUid on authenticateToken middleware execution", async () => {
      const mockUser = {
        id: 50,
        email: "session_user@example.com",
        authProvider: "firebase",
        authSubject: "firebase_user_uid_123",
        firebaseUid: "firebase_user_uid_123",
        role: "student",
        status: "active",
        emailVerified: true,
      };

      (pgFindUserById as any).mockResolvedValue(mockUser);
      (pgFindFirstWorkspaceMembership as any).mockResolvedValue(null);

      const token = jwt.sign({ userId: 50 }, JWT_SECRET);

      const reqMock: any = {
        cookies: { access_token: token },
        headers: {},
        session: {},
      };
      const resMock: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };
      const nextMock = vi.fn();

      await authenticateToken(reqMock, resMock, nextMock);

      expect(nextMock).toHaveBeenCalled();
      expect(reqMock.session.firebaseUid).toBe("firebase_user_uid_123");
    });

    it("should fall back to authSubject when user.firebaseUid is not set", async () => {
      const mockUser = {
        id: 51,
        email: "local_user@example.com",
        authProvider: "local",
        authSubject: "local_user@example.com",
        role: "admin",
        status: "active",
        emailVerified: true,
      };

      (pgFindUserById as any).mockResolvedValue(mockUser);
      (pgFindFirstWorkspaceMembership as any).mockResolvedValue(null);

      const token = jwt.sign({ userId: 51 }, JWT_SECRET);

      const reqMock: any = {
        cookies: { access_token: token },
        headers: {},
        session: {},
      };
      const resMock: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };
      const nextMock = vi.fn();

      await authenticateToken(reqMock, resMock, nextMock);

      expect(nextMock).toHaveBeenCalled();
      expect(reqMock.session.firebaseUid).toBe("local_user@example.com");
    });
  });

  describe("Transactional Welcome Emails", () => {
    it("should trigger sendWelcomeEmail on successful local signup", async () => {
      const newUser = {
        id: 60,
        email: "welcome_local@example.com",
        authProvider: "local",
        authSubject: "welcome_local@example.com",
        displayName: "Welcome Local",
        name: "Welcome Local",
        role: "admin",
        status: "active",
        emailVerified: false,
      };

      (pgFindUserByEmail as any).mockResolvedValue(null);
      (pgFindWorkspaceBySlug as any).mockResolvedValue(null);
      (pgCreateUser as any).mockResolvedValue(newUser);
      (pgFindUserById as any).mockResolvedValue(newUser);
      (pgCreateWorkspace as any).mockResolvedValue({ id: 10, name: "Workspace" });
      (pgUpsertWorkspaceMembership as any).mockResolvedValue({ id: 5 });

      const res = await request(app).post("/api/auth/signup").send({
        name: "Welcome Local",
        email: "welcome_local@example.com",
        password: "password123",
        workspaceName: "My Workspace",
      });

      expect(res.status).toBe(201);
      expect(sendEmailVerification).toHaveBeenCalledWith(
        "welcome_local@example.com",
        "Welcome Local",
        expect.any(String)
      );
      expect(sendWelcomeEmail).toHaveBeenCalledWith("welcome_local@example.com", "Welcome Local");
    });

    it("should trigger sendWelcomeEmail on onboarding invitation acceptance", async () => {
      // This test previously POSTed to /api/invite/accept while mocking the
      // WORKSPACE invite lookup. That path resolved to the auth router's
      // now-removed bypass handler, so the test never exercised onboarding at
      // all despite its name. It now hits the onboarding route explicitly and
      // mocks the school-invite query the handler actually calls.
      (pgFindInviteByToken as any).mockResolvedValue({
        id: 70,
        email: "onboarded_teacher@example.com",
        name: "Onboarded Teacher",
        role: "teacher",
        schoolId: null,
        classId: null,
        status: "pending",
        expiresAt: new Date(Date.now() + 100000),
      });

      const newUser = {
        id: 62,
        email: "onboarded_teacher@example.com",
        authProvider: "local",
        authSubject: "onboarded_teacher@example.com",
        displayName: "Onboarded Teacher",
        name: "Onboarded Teacher",
        role: "teacher",
        status: "active",
      };

      (pgFindUserByEmail as any).mockResolvedValue(null);
      (pgCreateUser as any).mockResolvedValue(newUser);
      (pgFindUserById as any).mockResolvedValue(newUser);
      (pgAcceptInvite as any).mockResolvedValue(true);

      const res = await request(app).post("/api/onboarding/invite/accept").send({
        token: "6f1c8b3a-0f4e-4c2a-9c1b-2d3e4f5a6b7c",
        email: "onboarded_teacher@example.com",
        displayName: "Onboarded Teacher",
        password: "securepassword456",
      });

      expect(res.status).toBe(201);
      expect(sendWelcomeEmail).toHaveBeenCalledWith(
        "onboarded_teacher@example.com",
        "Onboarded Teacher"
      );
    });
  });
});
