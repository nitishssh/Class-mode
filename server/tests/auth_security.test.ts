import { vi } from "vitest";

// Mock mailer at the very top to prevent Vitest import hoisting issues
vi.mock("../lib/integrations/mailer", () => ({
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
  });

  describe("Password corruption on workspace invite acceptance", () => {
    it("should preserve original password and NOT update passwordHash when pre-existing user accepts invite", async () => {
      const existingUser = {
        id: 42,
        email: "existing_member@example.com",
        authProvider: "local",
        authSubject: "existing_member@example.com",
        passwordHash: "$2a$12$securepasswordhashhere",
        displayName: "Original Name",
        name: "Original Name",
        role: "teacher",
        status: "active",
        emailVerified: true,
      };

      const invite = {
        id: 100,
        workspaceId: 10,
        email: "existing_member@example.com",
        name: "Invite Name",
        role: "member",
        kind: "business_member",
        status: "pending",
        expiresAt: new Date(Date.now() + 100000),
      };

      (pgFindWorkspaceInviteByTokenHash as any).mockResolvedValue(invite);
      (pgFindUserByEmail as any).mockResolvedValue(existingUser);
      (pgFindUserById as any).mockResolvedValue(existingUser);
      (pgFindFirstWorkspaceMembership as any).mockResolvedValue(null);

      const res = await request(app).post("/api/invites/some_invite_token/accept").send({
        password: "newpassword123",
        displayName: "New Profile Name",
      });

      expect(res.status).toBe(201);
      expect(pgUpdateUser).toHaveBeenCalledWith(
        42,
        expect.not.objectContaining({ passwordHash: expect.any(String) })
      );
      expect(pgUpdateUser).toHaveBeenCalledWith(
        42,
        expect.objectContaining({ displayName: "New Profile Name", emailVerified: true })
      );
      expect(pgCreateUser).not.toHaveBeenCalled();
      expect(pgAcceptWorkspaceInvite).toHaveBeenCalledWith(100);
    });

    it("should hash the password and create a new user when non-existing user accepts invite", async () => {
      const invite = {
        id: 101,
        workspaceId: 11,
        email: "brand_new_user@example.com",
        name: "Brand New",
        role: "member",
        kind: "student",
        status: "pending",
        studentMeta: { grade: "10th", className: "A" },
        expiresAt: new Date(Date.now() + 100000),
      };

      (pgFindWorkspaceInviteByTokenHash as any).mockResolvedValue(invite);
      (pgFindUserByEmail as any).mockResolvedValue(null);

      const createdUser = {
        id: 43,
        email: "brand_new_user@example.com",
        authProvider: "local",
        authSubject: "brand_new_user@example.com",
        displayName: "Brand New",
        name: "Brand New",
        role: "student",
        status: "active",
        emailVerified: true,
      };

      (pgCreateUser as any).mockResolvedValue(createdUser);
      (pgFindUserById as any).mockResolvedValue(createdUser);
      (pgFindFirstWorkspaceMembership as any).mockResolvedValue(null);

      const res = await request(app).post("/api/invite/accept").send({
        token: "valid_invite_token_here",
        password: "supersecurepassword123",
        displayName: "Brand New",
      });

      expect(res.status).toBe(201);
      expect(pgCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "brand_new_user@example.com",
          authProvider: "local",
          role: "student",
          passwordHash: expect.any(String),
          grade: "10th",
          className: "A",
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
      const invite = {
        id: 70,
        email: "onboarded_teacher@example.com",
        name: "Onboarded Teacher",
        role: "teacher",
        workspaceId: 12,
        kind: "business_member",
        status: "pending",
        expiresAt: new Date(Date.now() + 100000),
      };

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

      (pgFindWorkspaceInviteByTokenHash as any).mockResolvedValue(invite);
      (pgFindUserByEmail as any).mockResolvedValue(null);
      (pgCreateUser as any).mockResolvedValue(newUser);
      (pgFindUserById as any).mockResolvedValue(newUser);
      (pgFindFirstWorkspaceMembership as any).mockResolvedValue(null);
      (pgAcceptWorkspaceInvite as any).mockResolvedValue(undefined);
      (pgUpsertWorkspaceMembership as any).mockResolvedValue({ id: 5 });

      const res = await request(app).post("/api/invite/accept").send({
        token: "invite-token-uuid-123",
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
