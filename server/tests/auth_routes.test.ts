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
} from "../lib/db/pg-queries";
import { tokenHash } from "../lib/auth/auth-workspace";
import { storage } from "../storage";

vi.mock("../lib/integrations/mailer", () => ({
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

vi.mock("../services/whatsapp", () => ({
  whatsappService: { isConfigured: vi.fn(() => false) },
}));

vi.mock("../storage", () => ({
  storage: {
    createSession: vi.fn(),
    getSessionByRefreshToken: vi.fn(),
    consumeSessionByRefreshToken: vi.fn(),
    deleteSession: vi.fn(),
    deleteAllUserSessions: vi.fn(),
    createOtp: vi.fn(),
    markOtpUsed: vi.fn(),
  },
}));

vi.mock("../lib/db/pg-queries", () => ({
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
    expect(res.body.alerts).toEqual({ channel: "whatsapp", enabled: false });
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

describe("W-1 mobile client auth contract (X-Client: mobile)", () => {
  let app: express.Express;

  const teacher = {
    id: 2,
    email: "member@example.com",
    password: "",
    name: "Member",
    displayName: "Member",
    role: "teacher",
    status: "active",
    emailVerified: true,
    subjects: [],
  };

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
    (storage.createSession as any).mockResolvedValue({ id: 99 });
    (pgFindFirstWorkspaceMembership as any).mockResolvedValue(null);
    teacher.password = await bcrypt.hash("secret123", 4);
    (pgFindUserByEmail as any).mockResolvedValue(teacher);
    (pgFindUserById as any).mockResolvedValue(teacher);
  });

  it("mobile login returns refreshToken in the body and sets NO cookies", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("X-Client", "mobile")
      .send({ email: "member@example.com", password: "secret123" });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
    expect(typeof res.body.refreshToken).toBe("string");
    expect(res.body.refreshToken.length).toBeGreaterThan(20);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("web login keeps the cookie contract: no refreshToken in body, cookies set", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "member@example.com", password: "secret123" });

    expect(res.status).toBe(200);
    expect(res.body.refreshToken).toBeUndefined();
    const cookies = (res.headers["set-cookie"] ?? []) as unknown as string[];
    expect(cookies.join(";")).toContain("access_token=");
    expect(cookies.join(";")).toContain("refresh_token=");
  });

  it("mobile refresh accepts the token from the body and rotates it", async () => {
    (storage.consumeSessionByRefreshToken as any).mockResolvedValue({
      id: 99,
      userId: 2,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const res = await request(app)
      .post("/api/auth/refresh")
      .set("X-Client", "mobile")
      .send({ refreshToken: "stored-refresh-token" });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
    expect(typeof res.body.refreshToken).toBe("string");
    expect(res.body.refreshToken).not.toBe("stored-refresh-token");
    expect(res.headers["set-cookie"]).toBeUndefined();
    expect(storage.consumeSessionByRefreshToken).toHaveBeenCalledTimes(1);
  });

  it("mobile refresh without a body token is 401 (no cookie fallback confusion)", async () => {
    const res = await request(app)
      .post("/api/auth/refresh")
      .set("X-Client", "mobile")
      .set("Cookie", ["refresh_token=ambient-cookie-token"])
      .send({});
    expect(res.status).toBe(401);
    expect(res.headers["set-cookie"]).toBeUndefined();
    expect(storage.consumeSessionByRefreshToken).not.toHaveBeenCalled();
  });

  it("mobile refresh body token takes precedence over any ambient cookie", async () => {
    (storage.consumeSessionByRefreshToken as any).mockResolvedValue({
      id: 99,
      userId: 2,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const res = await request(app)
      .post("/api/auth/refresh")
      .set("X-Client", "mobile")
      .set("Cookie", ["refresh_token=ambient-cookie-token"])
      .send({ refreshToken: "stored-refresh-token" });

    expect(res.status).toBe(200);
    expect(typeof res.body.refreshToken).toBe("string");
    expect(res.headers["set-cookie"]).toBeUndefined();
    expect(storage.consumeSessionByRefreshToken).toHaveBeenCalledTimes(1);
    expect(storage.consumeSessionByRefreshToken).toHaveBeenCalledWith(
      tokenHash("stored-refresh-token")
    );
  });

  it("mobile refresh rotation allows only one winner and emits no cookies for winner or loser", async () => {
    (storage.consumeSessionByRefreshToken as any)
      .mockResolvedValueOnce({
        id: 99,
        userId: 2,
        expiresAt: new Date(Date.now() + 60_000),
      })
      .mockResolvedValueOnce(null);

    const responses = await Promise.all([
      request(app)
        .post("/api/auth/refresh")
        .set("X-Client", "mobile")
        .send({ refreshToken: "stored-refresh-token" }),
      request(app)
        .post("/api/auth/refresh")
        .set("X-Client", "mobile")
        .send({ refreshToken: "stored-refresh-token" }),
    ]);

    expect(responses.map((res) => res.status).sort()).toEqual([200, 401]);
    for (const res of responses) {
      expect(res.headers["set-cookie"]).toBeUndefined();
    }
    expect(storage.consumeSessionByRefreshToken).toHaveBeenCalledTimes(2);
  });

  it("mobile logout deletes the session identified by the body refreshToken", async () => {
    (storage.getSessionByRefreshToken as any).mockResolvedValue({ id: 99, userId: 2 });

    const res = await request(app)
      .post("/api/auth/logout")
      .set("X-Client", "mobile")
      .send({ refreshToken: "stored-refresh-token" });

    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"]).toBeUndefined();
    expect(storage.deleteSession).toHaveBeenCalledWith(99);
  });
});
