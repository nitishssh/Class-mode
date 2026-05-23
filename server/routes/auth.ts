import { Router, Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  ACCESS_COOKIE,
  ACCESS_COOKIE_OPTS,
  REFRESH_COOKIE,
  REFRESH_COOKIE_OPTS,
  REFRESH_TOKEN_TTL_MS,
  authMePayload,
  randomToken,
  slugifyWorkspaceName,
  tokenHash,
} from "../lib/auth-workspace";
import { verifyFirebaseToken, setCustomUserClaims } from "../lib/firebase-admin";
import { logger } from "../lib/logger";
import { recordAuditEvent, AUDIT_EVENTS } from "../lib/audit";
import { storage } from "../storage";
import { getPgPool } from "../db-pg";
import {
  pgAcceptWorkspaceInvite,
  pgCreateUser,
  pgCreateWorkspace,
  pgFindFirstWorkspaceMembership,
  pgFindUserByAuthSubject,
  pgFindUserByEmail,
  pgFindUserById,
  pgFindWorkspaceBySlug,
  pgFindWorkspaceInviteByTokenHash,
  pgSetUserLastLogin,
  pgUpdateUser,
  pgUpsertWorkspaceMembership,
} from "../lib/pg-queries";
import { sendEmailVerification, sendPasswordReset } from "../lib/mailer";

const router = Router();

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required.");
}
const JWT_SECRET = process.env.JWT_SECRET;

type AccessPayload = { userId: number; sessionId?: number };

function issueAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" });
}

async function createLoginSession(req: Request, res: Response, userId: number) {
  const refreshToken = randomToken();
  const session = await storage.createSession({
    userId,
    refreshTokenHash: tokenHash(refreshToken),
    deviceInfo: req.headers["user-agent"] ?? null,
    ipAddress: req.ip,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });
  const accessToken = issueAccessToken({ userId, sessionId: session.id });
  res.cookie(ACCESS_COOKIE, accessToken, ACCESS_COOKIE_OPTS);
  res.cookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTS);
  if (req.session) req.session.userId = userId;
  return { accessToken, refreshToken, sessionId: session.id };
}

function clearAuthCookies(req: Request, res: Response) {
  res.clearCookie(ACCESS_COOKIE, ACCESS_COOKIE_OPTS);
  res.clearCookie(REFRESH_COOKIE, REFRESH_COOKIE_OPTS);
  req.session?.destroy(() => undefined);
}

async function currentAuthPayload(userId: number) {
  const user = await pgFindUserById(userId);
  if (!user) return null;
  const workspaceContext = await pgFindFirstWorkspaceMembership(user.id);
  return authMePayload({
    user,
    workspace: workspaceContext?.workspace ?? null,
    membership: workspaceContext?.membership ?? null,
  });
}

async function makeUniqueSlug(workspaceName: string) {
  const base = slugifyWorkspaceName(workspaceName);
  for (let i = 0; i < 20; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    if (!(await pgFindWorkspaceBySlug(slug))) return slug;
  }
  return `${base}-${Date.now()}`;
}

async function createVerificationToken(userId: number) {
  const token = randomToken();
  await storage.createOtp({
    userId,
    otpHash: tokenHash(token),
    type: "registration",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    used: false,
  });
  return token;
}

async function findOtpByTokenHash(hash: string, type: "registration" | "password_reset") {
  const { rows } = await getPgPool().query(
    `SELECT * FROM otps
     WHERE otp_hash = $1 AND type = $2 AND used = false AND expires_at > now()
     ORDER BY created_at DESC LIMIT 1`,
    [hash, type]
  );
  return rows[0] ?? null;
}

const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  workspaceName: z.string().min(2),
});

router.post("/signup", async (req: Request, res: Response) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

    const email = parsed.data.email.toLowerCase().trim();
    if (await pgFindUserByEmail(email)) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    const user = await pgCreateUser({
      authProvider: "local",
      authSubject: email,
      email,
      username: `${email.split("@")[0]}_${Date.now()}`,
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
      name: parsed.data.name,
      displayName: parsed.data.name,
      role: "admin",
      status: "active",
      emailVerified: false,
    });

    const workspace = await pgCreateWorkspace({
      name: parsed.data.workspaceName,
      slug: await makeUniqueSlug(parsed.data.workspaceName),
      type: "business",
      ownerId: user.id,
    });
    await pgUpsertWorkspaceMembership({
      workspaceId: workspace.id,
      userId: user.id,
      role: "owner",
    });

    const verifyToken = await createVerificationToken(user.id);
    sendEmailVerification(user.email, user.displayName || user.name, verifyToken).catch((e) =>
      logger.warn("[auth/signup] Failed to send verification email", { error: String(e) })
    );

    await createLoginSession(req, res, user.id);
    recordAuditEvent({
      actorUserId: user.id,
      targetUserId: user.id,
      eventType: AUDIT_EVENTS.USER_REGISTERED,
      payload: { provider: "local", workspaceId: workspace.id, workspaceRole: "owner" },
    });

    return res.status(201).json(await currentAuthPayload(user.id));
  } catch (err) {
    logger.error("[auth/signup] Error", { error: String(err) });
    return res.status(500).json({ message: "Signup failed" });
  }
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

router.post("/login", async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "Email and password are required" });

    const user = await pgFindUserByEmail(parsed.data.email);
    if (!user || !(await bcrypt.compare(parsed.data.password, user.password || ""))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    if (["suspended", "rejected"].includes(user.status)) {
      return res.status(403).json({ message: "Account is not active" });
    }

    await createLoginSession(req, res, user.id);
    await pgSetUserLastLogin(user.id);
    recordAuditEvent({
      actorUserId: user.id,
      targetUserId: user.id,
      eventType: AUDIT_EVENTS.USER_LOGIN,
      payload: { ip: req.ip, ua: req.headers["user-agent"] },
    });
    return res.status(200).json(await currentAuthPayload(user.id));
  } catch (err) {
    logger.error("[auth/login] Error", { error: String(err) });
    return res.status(500).json({ message: "Login failed" });
  }
});

router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) return res.status(401).json({ message: "Refresh token required" });

    const session = await storage.getSessionByRefreshToken(tokenHash(refreshToken));
    if (!session || session.expiresAt < new Date()) {
      clearAuthCookies(req, res);
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const user = await pgFindUserById(session.userId);
    if (!user || ["suspended", "rejected"].includes(user.status)) {
      await storage.deleteSession(session.id);
      clearAuthCookies(req, res);
      return res.status(401).json({ message: "Authentication required" });
    }

    await storage.deleteSession(session.id);
    const tokens = await createLoginSession(req, res, user.id);
    return res.status(200).json({ token: tokens.accessToken });
  } catch (err) {
    logger.error("[auth/refresh] Error", { error: String(err) });
    return res.status(500).json({ message: "Token refresh failed" });
  }
});

router.get("/me", async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.access_token || req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Not authenticated" });
    const payload = jwt.verify(token, JWT_SECRET) as AccessPayload;
    const me = await currentAuthPayload(payload.userId);
    if (!me || ["suspended", "rejected"].includes(me.user.status)) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    return res.status(200).json(me);
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
});

router.post("/logout", async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refresh_token;
  if (refreshToken) {
    const session = await storage.getSessionByRefreshToken(tokenHash(refreshToken));
    if (session) await storage.deleteSession(session.id);
  }
  clearAuthCookies(req, res);
  return res.status(200).json({ message: "Logged out" });
});

router.post("/logout-all", async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.access_token || req.headers.authorization?.split(" ")[1];
    if (token) {
      const payload = jwt.verify(token, JWT_SECRET) as AccessPayload;
      await storage.deleteAllUserSessions(payload.userId);
    }
  } catch {
    // Ignore invalid access token; logout should still clear cookies.
  }
  clearAuthCookies(req, res);
  return res.status(200).json({ message: "Logged out" });
});

router.post("/email/verify/request", async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.access_token || req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Not authenticated" });
    const payload = jwt.verify(token, JWT_SECRET) as AccessPayload;
    const user = await pgFindUserById(payload.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.emailVerified) return res.json({ message: "Email already verified" });
    const verifyToken = await createVerificationToken(user.id);
    await sendEmailVerification(user.email, user.displayName || user.name, verifyToken);
    return res.json({ message: "Verification email sent" });
  } catch {
    return res.status(401).json({ message: "Not authenticated" });
  }
});

router.post("/email/verify", async (req: Request, res: Response) => {
  const parsed = z.object({ token: z.string().min(10) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Token is required" });
  const otp = await findOtpByTokenHash(tokenHash(parsed.data.token), "registration");
  if (!otp) return res.status(400).json({ message: "Invalid or expired verification token" });
  await pgUpdateUser(Number(otp.user_id), { emailVerified: true });
  await storage.markOtpUsed(Number(otp.id));
  return res.json({ message: "Email verified" });
});

router.post("/password/forgot", async (req: Request, res: Response) => {
  const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!parsed.success)
    return res.status(200).json({ message: "If the account exists, reset instructions were sent" });
  const user = await pgFindUserByEmail(parsed.data.email);
  if (user) {
    const token = randomToken();
    await storage.createOtp({
      userId: user.id,
      otpHash: tokenHash(token),
      type: "password_reset",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      used: false,
    });
    sendPasswordReset(user.email, user.displayName || user.name, token).catch((e) =>
      logger.warn("[auth/password/forgot] Failed to send reset email", { error: String(e) })
    );
  }
  return res.status(200).json({ message: "If the account exists, reset instructions were sent" });
});

router.post("/password/reset", async (req: Request, res: Response) => {
  const parsed = z
    .object({ token: z.string().min(10), password: z.string().min(6) })
    .safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ message: "Valid token and password are required" });
  const otp = await findOtpByTokenHash(tokenHash(parsed.data.token), "password_reset");
  if (!otp) return res.status(400).json({ message: "Invalid or expired reset token" });
  const userId = Number(otp.user_id);
  await pgUpdateUser(userId, { passwordHash: await bcrypt.hash(parsed.data.password, 12) });
  await storage.markOtpUsed(Number(otp.id));
  await storage.deleteAllUserSessions(userId);
  return res.json({ message: "Password reset" });
});

router.get("/invite/validate/:token", async (req: Request, res: Response) => {
  const invite = await pgFindWorkspaceInviteByTokenHash(tokenHash(req.params.token));
  if (!invite) return res.status(404).json({ message: "Invalid invite link" });
  if (invite.status !== "pending") return res.status(409).json({ message: "Invite already used" });
  if (invite.expiresAt < new Date())
    return res.status(410).json({ message: "This invite has expired" });
  return res.json({
    name: invite.name,
    email: invite.email,
    role: invite.role,
    kind: invite.kind,
    workspaceId: invite.workspaceId,
    studentMeta: invite.studentMeta,
  });
});

const acceptInviteSchema = z.object({
  token: z.string().min(10),
  name: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
  password: z.string().min(6),
});

async function acceptWorkspaceInvite(req: Request, res: Response) {
  const parsed = acceptInviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
  const invite = await pgFindWorkspaceInviteByTokenHash(tokenHash(parsed.data.token));
  if (!invite) return res.status(404).json({ message: "Invalid invite link" });
  if (invite.status !== "pending") return res.status(409).json({ message: "Invite already used" });
  if (invite.expiresAt < new Date())
    return res.status(410).json({ message: "This invite has expired" });

  const displayName =
    parsed.data.name || parsed.data.displayName || invite.name || invite.email.split("@")[0];
  let user = await pgFindUserByEmail(invite.email);
  if (!user) {
    user = await pgCreateUser({
      authProvider: "local",
      authSubject: invite.email,
      email: invite.email,
      username: `${invite.email.split("@")[0]}_${Date.now()}`,
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
      name: displayName,
      displayName,
      role: invite.kind === "student" ? "student" : invite.role === "admin" ? "admin" : "teacher",
      status: "active",
      emailVerified: true,
      grade: invite.studentMeta?.grade ?? null,
      className: invite.studentMeta?.className ?? null,
    });
  } else {
    await pgUpdateUser(user.id, {
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
      displayName,
      emailVerified: true,
    });
  }

  await pgUpsertWorkspaceMembership({
    workspaceId: invite.workspaceId,
    userId: user.id,
    role: invite.role,
  });
  await pgAcceptWorkspaceInvite(invite.id);
  await createLoginSession(req, res, user.id);

  recordAuditEvent({
    targetUserId: user.id,
    eventType: AUDIT_EVENTS.INVITE_ACCEPTED,
    payload: { workspaceId: invite.workspaceId, kind: invite.kind, workspaceRole: invite.role },
  });

  return res.status(201).json(await currentAuthPayload(user.id));
}

router.post("/invites/:token/accept", (req, res) => {
  req.body = { ...req.body, token: req.params.token };
  return acceptWorkspaceInvite(req, res);
});
router.post("/invite/accept", acceptWorkspaceInvite);

router.post("/register", (_req: Request, res: Response) => {
  return res.status(403).json({
    message: "Public student registration is disabled. Use workspace signup or an invite link.",
  });
});

router.post("/firebase", async (req: Request, res: Response) => {
  if (process.env.ENABLE_FIREBASE_AUTH_COMPAT !== "true") {
    return res.status(410).json({ message: "Firebase auth compatibility is disabled" });
  }
  const { idToken, role } = req.body as { idToken?: string; role?: string };
  if (!idToken) return res.status(400).json({ message: "idToken is required" });
  const decoded = await verifyFirebaseToken(idToken);
  if (!decoded?.email)
    return res.status(401).json({ message: "Invalid or expired Firebase ID token" });
  let user =
    (await pgFindUserByAuthSubject("firebase", decoded.uid)) ||
    (await pgFindUserByEmail(decoded.email.toLowerCase()));
  if (!user) {
    const userRole = role === "teacher" ? "teacher" : "student";
    user = await pgCreateUser({
      authProvider: "firebase",
      authSubject: decoded.uid,
      email: decoded.email.toLowerCase(),
      username: `${decoded.email.split("@")[0]}_${Date.now()}`,
      passwordHash: `firebase_managed_${decoded.uid}`,
      name: decoded.name || decoded.email.split("@")[0],
      displayName: decoded.name || null,
      avatar: decoded.picture || null,
      role: userRole,
      status: userRole === "teacher" ? "pending" : "active",
      emailVerified: !!decoded.email_verified,
    });
  }
  setCustomUserClaims(decoded.uid, { role: user.role, status: user.status }).catch(() => undefined);
  const tokens = await createLoginSession(req, res, user.id);
  return res.json({ token: tokens.accessToken, ...(await currentAuthPayload(user.id)) });
});

router.post("/sync-profile", async (req: Request, res: Response) => {
  const token = req.cookies?.access_token || req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AccessPayload;
    const updates: Record<string, unknown> = {};
    const body = req.body as Record<string, unknown>;
    if (body.displayName !== undefined) updates.displayName = body.displayName;
    if (body.grade !== undefined) updates.grade = body.grade;
    if (body.board !== undefined) updates.board = body.board;
    if (body.subjects !== undefined) updates.subjects = body.subjects;
    if (Object.keys(updates).length) await pgUpdateUser(payload.userId, updates);
    return res.json({ message: "Profile synced", ...(await currentAuthPayload(payload.userId)) });
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
});

export default router;
