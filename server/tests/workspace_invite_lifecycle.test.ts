import { vi } from "vitest";

// Mailer + audit + storage are mocked at the top for hoist safety. The auth
// router imports several mailer fns at module load, so all must be provided.
vi.mock("../lib/integrations/mailer", () => ({
  sendWorkspaceInvite: vi.fn().mockResolvedValue(undefined),
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
  sendEmailVerification: vi.fn().mockResolvedValue(undefined),
  sendPasswordReset: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/audit", () => ({
  AUDIT_EVENTS: {
    INVITE_ACCEPTED: "invite_accepted",
    USER_REGISTERED: "user_registered",
    USER_LOGIN: "user_login",
    USER_LOGIN_FAILED: "user_login_failed",
  },
  recordAuditEvent: vi.fn(),
}));

vi.mock("../storage", () => ({
  storage: {
    createSession: vi.fn().mockResolvedValue({ id: 1 }),
    getSessionByRefreshToken: vi.fn(),
    deleteSession: vi.fn(),
    createOtp: vi.fn(),
  },
}));

import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import session from "express-session";
import request from "supertest";
import bcrypt from "bcryptjs";

import workspaceRouter from "../routes/workspace";
import authRouter from "../routes/auth";
import { issueAccessToken } from "../lib/auth/auth-workspace";
import { sendWorkspaceInvite } from "../lib/integrations/mailer";
import {
  pgFindWorkspaceInviteByTokenHash,
  pgFindWorkspaceById,
  pgFindUserByEmail,
  pgFindWorkspaceMembership,
  pgFindPendingWorkspaceInviteByEmail,
  pgResendWorkspaceInvite,
  pgCreateWorkspaceInvite,
  pgCreateUser,
  pgUpsertWorkspaceMembership,
  pgAcceptWorkspaceInvite,
  pgFindUserById,
  pgFindFirstWorkspaceMembership,
  pgSetUserLastLogin,
} from "../lib/db/pg-queries";

// vi.clearAllMocks() only clears call history, not implementations, and the
// global pg-queries mock is a shared proxy — so an implementation set in one
// test leaks into the next. We neutralize the one that matters for auth
// (pgFindUserById) in beforeEach so the middleware always falls through to the
// token-based test path with the right user id.

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: "test-secret",
      resave: false,
      saveUninitialized: false,
    })
  );
  app.use("/api/auth", authRouter);
  app.use("/api", workspaceRouter);
  return app;
}

// An owner can do anything; used to satisfy requirePermission on protected routes.
function asOwner() {
  (pgFindWorkspaceMembership as any).mockResolvedValue({ role: "owner", status: "active" });
  return issueAccessToken({ userId: 1, role: "school_admin" });
}

const futureDate = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const pastDate = () => new Date(Date.now() - 60 * 1000);

describe("Workspace invite lifecycle", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: the authenticated user is resolved via the token-based test
    // fallback, not a leaked pgFindUserById implementation. Tests that need a
    // specific user (e.g. the signup flow's currentAuthPayload) override this.
    (pgFindUserById as any).mockResolvedValue(null);
    app = buildApp();
  });

  describe("GET /api/workspaces/join/:token (public preview)", () => {
    it("is reachable without authentication and reports accountExists", async () => {
      (pgFindWorkspaceInviteByTokenHash as any).mockResolvedValue({
        id: 10,
        workspaceId: 5,
        email: "newbie@example.com",
        name: "Newbie",
        role: "member",
        kind: "business_member",
        invitedBy: 2,
        status: "pending",
        expiresAt: futureDate(),
      });
      (pgFindWorkspaceById as any).mockResolvedValue({
        id: 5,
        name: "Acme",
        type: "business",
        description: null,
        iconUrl: null,
      });
      (pgFindUserById as any).mockResolvedValue({ id: 2, name: "Owner", displayName: "Owner" });
      // No existing account for the invited email.
      (pgFindUserByEmail as any).mockResolvedValue(null);

      const res = await request(app).get("/api/workspaces/join/sometoken");

      expect(res.status).toBe(200);
      expect(res.body.workspace.name).toBe("Acme");
      expect(res.body.email).toBe("newbie@example.com");
      expect(res.body.accountExists).toBe(false);
      expect(res.body.status).toBe("pending");
    });

    it("marks an expired invite as expired", async () => {
      (pgFindWorkspaceInviteByTokenHash as any).mockResolvedValue({
        id: 11,
        workspaceId: 5,
        email: "late@example.com",
        role: "member",
        kind: "business_member",
        invitedBy: null,
        status: "pending",
        expiresAt: pastDate(),
      });
      (pgFindWorkspaceById as any).mockResolvedValue({ id: 5, name: "Acme" });
      (pgFindUserByEmail as any).mockResolvedValue({ id: 9 });

      const res = await request(app).get("/api/workspaces/join/sometoken");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("expired");
      expect(res.body.accountExists).toBe(true);
    });
  });

  describe("POST /api/workspaces/:id/invites (create with guards)", () => {
    it("rejects inviting someone who is already an active member", async () => {
      const token = asOwner();
      (pgFindWorkspaceById as any).mockResolvedValue({ id: 5, name: "Acme" });
      (pgFindUserByEmail as any).mockResolvedValue({ id: 42 });
      // requirePermission and the member check both use pgFindWorkspaceMembership:
      // owner for the actor (id 1) and an active membership for the invitee (id 42).
      (pgFindWorkspaceMembership as any).mockImplementation((_wsId: number, uid: number) =>
        uid === 1
          ? Promise.resolve({ role: "owner", status: "active" })
          : Promise.resolve({ role: "member", status: "active" })
      );

      const res = await request(app)
        .post("/api/workspaces/5/invites")
        .set("Authorization", `Bearer ${token}`)
        .send({ email: "member@example.com", role: "member" });

      expect(res.status).toBe(409);
      expect(pgCreateWorkspaceInvite).not.toHaveBeenCalled();
    });

    it("re-arms an existing pending invite instead of creating a duplicate", async () => {
      const token = asOwner();
      (pgFindWorkspaceById as any).mockResolvedValue({ id: 5, name: "Acme" });
      (pgFindUserByEmail as any).mockResolvedValue(null);
      (pgFindPendingWorkspaceInviteByEmail as any).mockResolvedValue({
        id: 77,
        name: "Dup",
        kind: "business_member",
      });
      (pgResendWorkspaceInvite as any).mockResolvedValue({ id: 77, status: "pending" });

      const res = await request(app)
        .post("/api/workspaces/5/invites")
        .set("Authorization", `Bearer ${token}`)
        .send({ email: "dup@example.com", role: "member" });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(77);
      expect(res.body.token).toBeTruthy();
      expect(pgCreateWorkspaceInvite).not.toHaveBeenCalled();
      expect(pgResendWorkspaceInvite).toHaveBeenCalled();
      expect(sendWorkspaceInvite).toHaveBeenCalled();
    });

    it("creates a fresh invite when none exists", async () => {
      const token = asOwner();
      (pgFindWorkspaceById as any).mockResolvedValue({ id: 5, name: "Acme" });
      (pgFindUserByEmail as any).mockResolvedValue(null);
      (pgFindPendingWorkspaceInviteByEmail as any).mockResolvedValue(null);
      (pgCreateWorkspaceInvite as any).mockResolvedValue({ id: 88, status: "pending" });

      const res = await request(app)
        .post("/api/workspaces/5/invites")
        .set("Authorization", `Bearer ${token}`)
        .send({ email: "fresh@example.com", role: "member" });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe(88);
      expect(res.body.token).toBeTruthy();
      expect(pgCreateWorkspaceInvite).toHaveBeenCalled();
    });
  });

  describe("POST /api/workspaces/:id/invites/:iid/resend", () => {
    it("mints a fresh token and re-sends the email", async () => {
      const token = asOwner();
      (pgResendWorkspaceInvite as any).mockResolvedValue({
        id: 77,
        email: "x@example.com",
        name: "X",
        kind: "business_member",
        status: "pending",
      });
      (pgFindWorkspaceById as any).mockResolvedValue({ id: 5, name: "Acme" });

      const res = await request(app)
        .post("/api/workspaces/5/invites/77/resend")
        .set("Authorization", `Bearer ${token}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.token).toBeTruthy();
      expect(res.body.status).toBe("pending");
      expect(sendWorkspaceInvite).toHaveBeenCalled();
    });

    it("404s when the invite does not exist", async () => {
      const token = asOwner();
      (pgResendWorkspaceInvite as any).mockResolvedValue(null);

      const res = await request(app)
        .post("/api/workspaces/5/invites/999/resend")
        .set("Authorization", `Bearer ${token}`)
        .send();

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/auth/workspace-invite/signup (new-user accept)", () => {
    const validInvite = () => ({
      id: 10,
      workspaceId: 5,
      email: "newbie@example.com",
      name: "Newbie",
      role: "member",
      kind: "business_member" as const,
      status: "pending",
      expiresAt: futureDate(),
    });

    it("creates a verified account, joins the workspace, and logs in", async () => {
      (pgFindWorkspaceInviteByTokenHash as any).mockResolvedValue(validInvite());
      (pgFindUserByEmail as any).mockResolvedValue(null);
      (pgCreateUser as any).mockResolvedValue({
        id: 50,
        email: "newbie@example.com",
        name: "Newbie",
        displayName: "Newbie",
        role: "teacher",
      });
      (pgFindUserById as any).mockResolvedValue({
        id: 50,
        email: "newbie@example.com",
        name: "Newbie",
        displayName: "Newbie",
        role: "teacher",
        status: "active",
        emailVerified: true,
      });
      (pgFindFirstWorkspaceMembership as any).mockResolvedValue(null);
      (pgFindWorkspaceById as any).mockResolvedValue({ id: 5, name: "Acme", slug: "acme" });
      (pgSetUserLastLogin as any).mockResolvedValue(undefined);

      const res = await request(app).post("/api/auth/workspace-invite/signup").send({
        token: "rawtoken",
        displayName: "Newbie",
        password: "supersecret1",
      });

      expect(res.status).toBe(201);
      expect(res.body.token).toBeTruthy();
      expect(res.body.workspace.id).toBe(5);
      expect(res.body.role).toBe("member");

      // Account created already-verified with a real bcrypt hash.
      const createArgs = (pgCreateUser as any).mock.calls[0][0];
      expect(createArgs.emailVerified).toBe(true);
      expect(createArgs.role).toBe("teacher");
      expect(await bcrypt.compare("supersecret1", createArgs.passwordHash)).toBe(true);

      expect(pgUpsertWorkspaceMembership).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: 5, userId: 50, role: "member", status: "active" })
      );
      expect(pgAcceptWorkspaceInvite).toHaveBeenCalledWith(10);
    });

    it("tells an existing account to sign in instead (409 accountExists)", async () => {
      (pgFindWorkspaceInviteByTokenHash as any).mockResolvedValue(validInvite());
      (pgFindUserByEmail as any).mockResolvedValue({ id: 99 });

      const res = await request(app).post("/api/auth/workspace-invite/signup").send({
        token: "rawtoken",
        displayName: "Newbie",
        password: "supersecret1",
      });

      expect(res.status).toBe(409);
      expect(res.body.accountExists).toBe(true);
      expect(pgCreateUser).not.toHaveBeenCalled();
    });

    it("rejects an expired invite with 410", async () => {
      (pgFindWorkspaceInviteByTokenHash as any).mockResolvedValue({
        ...validInvite(),
        expiresAt: pastDate(),
      });

      const res = await request(app).post("/api/auth/workspace-invite/signup").send({
        token: "rawtoken",
        displayName: "Newbie",
        password: "supersecret1",
      });

      expect(res.status).toBe(410);
      expect(pgCreateUser).not.toHaveBeenCalled();
    });

    it("rejects a token that resolves to no invite with 404", async () => {
      (pgFindWorkspaceInviteByTokenHash as any).mockResolvedValue(null);

      const res = await request(app).post("/api/auth/workspace-invite/signup").send({
        token: "badtoken",
        displayName: "Newbie",
        password: "supersecret1",
      });

      expect(res.status).toBe(404);
    });
  });
});
