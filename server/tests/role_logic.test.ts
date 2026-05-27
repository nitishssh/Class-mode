import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import session from "express-session";
import request from "supertest";
import authRouter from "../routes/auth";
import { verifyFirebaseToken } from "../lib/firebase-admin";
import { pgCreateUser, pgFindUserByAuthSubject, pgFindUserByEmail, pgFindUserById } from "../lib/pg-queries";

// Mock the dependencies
vi.mock("../lib/firebase-admin", () => ({
  verifyFirebaseToken: vi.fn(),
  setCustomUserClaims: vi.fn().mockResolvedValue(true),
  checkFirebaseAdminReadiness: vi.fn(),
}));

vi.mock("../lib/mailer", () => ({
  sendEmailVerification: vi.fn().mockResolvedValue(undefined),
  sendPasswordReset: vi.fn().mockResolvedValue(undefined),
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/audit", () => ({
  AUDIT_EVENTS: {
    USER_REGISTERED: "user_registered",
    USER_LOGIN: "user_login",
    USER_LOGIN_FAILED: "user_login_failed",
  },
  recordAuditEvent: vi.fn(),
}));

vi.mock("../storage", () => ({
  storage: {
    createSession: vi.fn().mockResolvedValue({ id: 99 }),
    createOtp: vi.fn().mockResolvedValue({ id: 101 }),
  },
}));

vi.mock("../lib/pg-queries", () => ({
  pgCreateUser: vi.fn(),
  pgCreateWorkspace: vi.fn(),
  pgFindFirstWorkspaceMembership: vi.fn().mockResolvedValue(null),
  pgFindUserByAuthSubject: vi.fn(),
  pgFindUserByEmail: vi.fn(),
  pgFindUserById: vi.fn(),
  pgFindWorkspaceBySlug: vi.fn(),
  pgSetUserLastLogin: vi.fn(),
  pgUpsertWorkspaceMembership: vi.fn(),
}));

describe("Role Logic - School Admin", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use(
      session({
        secret: "test-secret",
        resave: false,
        saveUninitialized: false,
      })
    );
    app.use("/api/auth", authRouter);
  });

  describe("POST /api/auth/firebase", () => {
    it("should ignore privileged Firebase role self-assignment", async () => {
      const createdUser = {
        id: 7,
        email: "school-admin-request@example.com",
        authProvider: "firebase",
        authSubject: "fire-school-admin-request",
        displayName: "School Admin Request",
        name: "School Admin Request",
        role: "student",
        status: "active",
        emailVerified: true,
      };
      (verifyFirebaseToken as any).mockResolvedValue({
        uid: "fire-school-admin-request",
        email: "school-admin-request@example.com",
        name: "School Admin Request",
        email_verified: true,
      });
      (pgFindUserByAuthSubject as any).mockResolvedValue(null);
      (pgFindUserByEmail as any).mockResolvedValue(null);
      (pgCreateUser as any).mockResolvedValue(createdUser);
      (pgFindUserById as any).mockResolvedValue(createdUser);

      const res = await request(app)
        .post("/api/auth/firebase")
        .send({ idToken: "valid-school-admin-token", role: "school_admin" });

      expect(res.status).toBe(200);
      expect(pgCreateUser).toHaveBeenCalledWith(expect.objectContaining({ role: "student" }));
    });
  });
});
