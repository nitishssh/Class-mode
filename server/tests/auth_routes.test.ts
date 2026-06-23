import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import session from "express-session";
import bcrypt from "bcryptjs";
import authRouter from "../routes/auth";
import {
  pgCreateUser,
  pgCreateWorkspace,
  pgFindFirstWorkspaceMembership,
  pgFindUserByEmail,
  pgFindUserById,
  pgFindWorkspaceBySlug,
  pgSetUserLastLogin,
  pgUpsertWorkspaceMembership,
} from "../lib/pg-queries";
import { storage } from "../storage";

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
    INVITE_ACCEPTED: "invite_accepted",
  },
  recordAuditEvent: vi.fn(),
}));

vi.mock("../storage", () => ({
  storage: {
    createSession: vi.fn(),
    getSessionByRefreshToken: vi.fn(),
    deleteSession: vi.fn(),
    deleteAllUserSessions: vi.fn(),
    createOtp: vi.fn(),
    markOtpUsed: vi.fn(),
  },
}));

vi.mock("../lib/pg-queries", () => ({
  pgAcceptWorkspaceInvite: vi.fn(),
  pgCreateUser: vi.fn(),
  pgCreateWorkspace: vi.fn(),
  pgFindFirstWorkspaceMembership: vi.fn(),
  pgFindUserByAuthSubject: vi.fn(),
  pgFindUserByEmail: vi.fn(),
  pgFindUserById: vi.fn(),
  pgFindWorkspaceBySlug: vi.fn(),
  pgFindWorkspaceInviteByTokenHash: vi.fn(),
  pgSetUserLastLogin: vi.fn(),
  pgUpdateUser: vi.fn(),
  pgUpsertWorkspaceMembership: vi.fn(),
}));

describe("custom auth routes", () => {
  let app: express.Express;

  beforeEach(() => {
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
    (storage.createSession as any).mockResolvedValue({ id: 99 });
    (storage.createOtp as any).mockResolvedValue({ id: 101 });
    (pgFindFirstWorkspaceMembership as any).mockResolvedValue({
      workspace: { id: 10, name: "Acme", slug: "acme", type: "business" },
      membership: { id: 5, workspaceId: 10, userId: 1, role: "owner", status: "active" },
    });
  });

  it("creates a business owner and workspace on signup", async () => {
    const user = {
      id: 1,
      email: "owner@example.com",
      name: "Owner",
      displayName: "Owner",
      role: "school_admin",
      status: "active",
      emailVerified: false,
      subjects: [],
    };
    (pgFindUserByEmail as any).mockResolvedValue(null);
    (pgFindWorkspaceBySlug as any).mockResolvedValue(null);
    (pgCreateUser as any).mockResolvedValue(user);
    (pgCreateWorkspace as any).mockResolvedValue({
      id: 10,
      name: "Acme",
      slug: "acme",
      type: "business",
    });
    (pgUpsertWorkspaceMembership as any).mockResolvedValue({ id: 5 });
    (pgFindUserById as any).mockResolvedValue(user);

    const res = await request(app).post("/api/auth/signup").send({
      name: "Owner",
      email: "owner@example.com",
      password: "secret123",
      workspaceName: "Acme",
    });

    expect(res.status).toBe(201);
    expect(pgCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({ authProvider: "local", role: "school_admin" })
    );
    expect(pgCreateWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Acme", ownerId: 1 })
    );
    expect(pgUpsertWorkspaceMembership).toHaveBeenCalledWith({
      workspaceId: 10,
      userId: 1,
      role: "owner",
    });
    expect(res.body.workspaceRole).toBe("owner");
    expect(typeof res.body.token).toBe("string");
  });

  it("rejects public student registration", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Student",
      email: "student@example.com",
      password: "secret123",
      role: "student",
    });
    expect(res.status).toBe(403);
  });

  it("logs in with local credentials", async () => {
    const hash = await bcrypt.hash("secret123", 4);
    const user = {
      id: 2,
      email: "member@example.com",
      password: hash,
      name: "Member",
      displayName: "Member",
      role: "teacher",
      status: "active",
      emailVerified: true,
      subjects: [],
    };
    (pgFindUserByEmail as any).mockResolvedValue(user);
    (pgFindUserById as any).mockResolvedValue(user);

    const res = await request(app).post("/api/auth/login").send({
      email: "member@example.com",
      password: "secret123",
    });

    expect(res.status).toBe(200);
    expect(pgSetUserLastLogin).toHaveBeenCalledWith(2);
    expect(res.body.user.email).toBe("member@example.com");
    expect(typeof res.body.token).toBe("string");
  });

  it("rejects bad local credentials", async () => {
    (pgFindUserByEmail as any).mockResolvedValue(null);
    const res = await request(app).post("/api/auth/login").send({
      email: "missing@example.com",
      password: "secret123",
    });
    expect(res.status).toBe(401);
  });

  it("exposes auth capability flags via /config", async () => {
    const res = await request(app).get("/api/auth/config");
    expect(res.status).toBe(200);
    // In test env NODE_ENV != "production", so local password is enabled by default.
    expect(res.body.localPasswordAuthEnabled).toBe(true);
  });

  it("hides /dev/last-otp outside dev-without-db mode", async () => {
    const res = await request(app).get("/api/auth/dev/last-otp?email=anyone@example.com");
    expect(res.status).toBe(404);
  });

  it("returns emailVerified=false from prod signup so user is gated", async () => {
    const user = {
      id: 7,
      email: "gated@example.com",
      name: "Gated",
      displayName: "Gated",
      role: "admin",
      status: "active",
      emailVerified: false,
      subjects: [],
    };
    (pgFindUserByEmail as any).mockResolvedValue(null);
    (pgFindWorkspaceBySlug as any).mockResolvedValue(null);
    (pgCreateUser as any).mockResolvedValue(user);
    (pgCreateWorkspace as any).mockResolvedValue({
      id: 11,
      name: "G",
      slug: "g",
      type: "business",
    });
    (pgUpsertWorkspaceMembership as any).mockResolvedValue({ id: 6 });
    (pgFindUserById as any).mockResolvedValue(user);
    (pgFindFirstWorkspaceMembership as any).mockResolvedValue({
      workspace: { id: 11, name: "G", slug: "g", type: "business" },
      membership: { id: 6, workspaceId: 11, userId: 7, role: "owner", status: "active" },
    });

    const res = await request(app).post("/api/auth/signup").send({
      name: "Gated",
      email: "gated@example.com",
      password: "secret123",
      workspaceName: "Gated Co",
    });

    expect(res.status).toBe(201);
    expect(res.body.user.emailVerified).toBe(false);
  });

});
