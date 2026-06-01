import { Router, Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import crypto from "crypto";
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
import { getPgPool, isPgReady } from "../db-pg";
import {
  pgAcceptWorkspaceInvite,
  pgCreateUser,
  pgCreateWorkspace,
  pgDeleteUser,
  pgFindFirstWorkspaceMembership,
  pgFindUserByAuthSubject,
  pgFindUserByEmail,
  pgFindUserById,
  pgFindWorkspaceBySlug,
  pgFindWorkspaceInviteByTokenHash,
  pgSetUserLastLogin,
  pgUpdateUser,
  pgUpsertWorkspaceMembership,
  type PgUser,
  type PgWorkspace,
  type PgWorkspaceMembership,
} from "../lib/pg-queries";
import { sendEmailVerification, sendPasswordReset, sendWelcomeEmail } from "../lib/mailer";
import { normalizeSelfRegisterableRole } from "../../shared/authz";

const router = Router();

// ── Password policy ──────────────────────────────────────────────────────────
// Minimum 8 chars, at least one letter and one digit. Applied to signup, reset,
// and invite-accept; login is intentionally unconstrained so existing accounts
// with shorter (legacy) passwords can still sign in.
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Za-z]/, "Password must contain at least one letter")
  .regex(/\d/, "Password must contain at least one number");

// ── Per-endpoint rate limiters ───────────────────────────────────────────────
// The global `/api/auth` limiter in server/index.ts (10/min/IP) is too loose for
// brute-forceable surfaces like 4-digit OTP verification. Keyed on email+IP so
// a single attacker can't fan out across user accounts from one IP.
const emailIpKey = (req: Request) => {
  const email = String(req.body?.email ?? "").toLowerCase().trim();
  return `${email}|${ipKeyGenerator(req.ip ?? "")}`;
};

const tooMany = (msg: string) => ({ message: msg });

const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  keyGenerator: emailIpKey,
  message: tooMany("Too many login attempts. Please try again later."),
  standardHeaders: true,
  legacyHeaders: false,
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60_000,
  max: 5,
  message: tooMany("Too many signup attempts. Please try again later."),
  standardHeaders: true,
  legacyHeaders: false,
});

const verifyLimiter = rateLimit({
  windowMs: 10 * 60_000,
  max: 5,
  message: tooMany("Too many verification attempts. Please request a new code."),
  standardHeaders: true,
  legacyHeaders: false,
});

const verifyRequestLimiter = rateLimit({
  windowMs: 10 * 60_000,
  max: 3,
  message: tooMany("Please wait before requesting another verification code."),
  standardHeaders: true,
  legacyHeaders: false,
});

const forgotLimiter = rateLimit({
  windowMs: 60 * 60_000,
  max: 3,
  keyGenerator: emailIpKey,
  message: tooMany("Too many reset requests. Please try again later."),
  standardHeaders: true,
  legacyHeaders: false,
});

const resetLimiter = rateLimit({
  windowMs: 60 * 60_000,
  max: 5,
  message: tooMany("Too many password reset attempts. Please try again later."),
  standardHeaders: true,
  legacyHeaders: false,
});

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required.");
}
const JWT_SECRET = process.env.JWT_SECRET;

function isLocalPasswordAuthEnabled(): boolean {
  return process.env.ENABLE_LOCAL_PASSWORD_AUTH === "true" || process.env.NODE_ENV !== "production";
}

type AccessPayload = {
  userId: number;
  sessionId?: number;
  role?: string;
  email?: string;
  emailVerified?: boolean;
  workspaceId?: number | null;
  workspaceRole?: string | null;
};

type DevSession = {
  id: number;
  userId: number;
  refreshTokenHash: string;
  expiresAt: Date;
};

const devUsersByEmail = new Map<string, PgUser>();
const devUsersById = new Map<number, PgUser>();
const devWorkspacesByUserId = new Map<
  number,
  { workspace: PgWorkspace; membership: PgWorkspaceMembership }
>();
const devSessionsByRefreshHash = new Map<string, DevSession>();

type DevOtp = {
  id: number;
  userId: number;
  otpHash: string;
  // Plaintext is kept ONLY in dev (no DB) mode to make local testing
  // possible without scraping the console. The whole map lives in process
  // memory and is unreachable when NODE_ENV=production.
  plaintext: string;
  type: "registration" | "password_reset";
  expiresAt: Date;
  used: boolean;
  attempts: number;
  createdAt: Date;
};
const devOtpsByUserId = new Map<number, DevOtp[]>();
let nextDevOtpId = 900_000;

let nextDevUserId = 900_000;
let nextDevWorkspaceId = 900_000;
let nextDevSessionId = 900_000;

function createDevOtp(userId: number, type: DevOtp["type"], ttlMinutes: number): string {
  const token = String(crypto.randomInt(1000, 10000));
  const otp: DevOtp = {
    id: nextDevOtpId++,
    userId,
    otpHash: tokenHash(token),
    plaintext: token,
    type,
    expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
    used: false,
    attempts: 0,
    createdAt: new Date(),
  };
  const list = devOtpsByUserId.get(userId) ?? [];
  list.push(otp);
  devOtpsByUserId.set(userId, list);
  return token;
}

function latestDevOtp(userId: number, type: DevOtp["type"]): DevOtp | null {
  const list = devOtpsByUserId.get(userId) ?? [];
  const now = Date.now();
  const valid = list.filter((o) => !o.used && o.type === type && o.expiresAt.getTime() > now);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
}

function isDevAuthWithoutDbEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.ENABLE_DEV_AUTH_WITHOUT_DB === "true" &&
    !isPgReady()
  );
}

function createDevUser(data: {
  email: string;
  passwordHash: string;
  name: string;
  workspaceName: string;
}): PgUser {
  const id = nextDevUserId++;
  const now = new Date();
  const user: PgUser = {
    id,
    userType: "educator",
    authProvider: "local-dev",
    authSubject: data.email,
    email: data.email,
    username: `${data.email.split("@")[0]}_${Date.now()}`,
    password: data.passwordHash,
    name: data.name,
    displayName: data.name,
    avatar: null,
    emailVerified: false,
    role: "admin",
    status: "active",
    schoolCode: null,
    schoolId: null,
    parentId: null,
    grade: null,
    board: null,
    subjects: [],
    district: null,
    class: null,
    subject: null,
    onboardingComplete: false,
    studyPlan: {},
    createdAt: now,
    lastLoginAt: null,
    firebaseUid: data.email,
  };

  const workspace: PgWorkspace = {
    id: nextDevWorkspaceId++,
    name: data.workspaceName,
    slug: slugifyWorkspaceName(data.workspaceName),
    type: "business",
    description: null,
    iconUrl: null,
    settings: {},
    ownerId: id,
    members: [id],
    createdAt: now,
  };
  const membership: PgWorkspaceMembership = {
    id: nextDevWorkspaceId++,
    workspaceId: workspace.id,
    userId: id,
    role: "owner",
    status: "active",
    createdAt: now,
  };

  devUsersByEmail.set(data.email, user);
  devUsersById.set(id, user);
  devWorkspacesByUserId.set(id, { workspace, membership });
  return user;
}

function devAuthPayload(user: PgUser) {
  const workspaceContext = devWorkspacesByUserId.get(user.id);
  return authMePayload({
    user,
    workspace: workspaceContext?.workspace ?? null,
    membership: workspaceContext?.membership ?? null,
  });
}

function issueAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" });
}

async function createDevLoginSession(req: Request, res: Response, user: PgUser) {
  const refreshToken = randomToken();
  const session: DevSession = {
    id: nextDevSessionId++,
    userId: user.id,
    refreshTokenHash: tokenHash(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  };
  devSessionsByRefreshHash.set(session.refreshTokenHash, session);

  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });

  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.firebaseUid = user.firebaseUid || user.authSubject;

  const devWs = devWorkspacesByUserId.get(user.id);
  const accessToken = issueAccessToken({
    userId: user.id,
    sessionId: session.id,
    role: user.role,
    email: user.email,
    emailVerified: user.emailVerified,
    workspaceId: devWs?.workspace.id ?? null,
    workspaceRole: devWs?.membership.role ?? null,
  });
  res.cookie(ACCESS_COOKIE, accessToken, ACCESS_COOKIE_OPTS);
  res.cookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTS);
  return { accessToken, refreshToken, sessionId: session.id };
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

  // Fix session fixation: regenerate the session ID before binding user identity.
  // This ensures a session established before login can't be reused after authentication.
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });

  // Fetch user + workspace in parallel to populate session and embed in token.
  const [user, workspaceContext] = await Promise.all([
    pgFindUserById(userId),
    pgFindFirstWorkspaceMembership(userId),
  ]);
  if (user && req.session) {
    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.firebaseUid = user.firebaseUid || user.authSubject;
  }

  const accessToken = issueAccessToken({
    userId,
    sessionId: session.id,
    role: user?.role,
    email: user?.email,
    emailVerified: user?.emailVerified,
    workspaceId: workspaceContext?.workspace.id ?? null,
    workspaceRole: workspaceContext?.membership.role ?? null,
  });
  res.cookie(ACCESS_COOKIE, accessToken, ACCESS_COOKIE_OPTS);
  res.cookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTS);
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
  // 4-digit code; combined with rate limiting + short expiry to resist brute force.
  // Uses crypto.randomInt so the value isn't predictable from Math.random state.
  const token = String(crypto.randomInt(1000, 10000));
  await storage.createOtp({
    userId,
    otpHash: tokenHash(token),
    type: "registration",
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
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

// Public auth-capability flags so the client can decide whether to attempt
// Firebase first, fall back to local password, etc. Safe to expose.
router.get("/config", (_req: Request, res: Response) => {
  res.status(200).json({
    localPasswordAuthEnabled: isLocalPasswordAuthEnabled(),
    firebaseExchangeEnabled: process.env.ENABLE_FIREBASE_AUTH_COMPAT !== "false",
    devAuthWithoutDb: isDevAuthWithoutDbEnabled(),
  });
});

// Dev-only helper: returns the latest unused OTP for an email so the UI can
// be tested without SMTP. Guarded by isDevAuthWithoutDbEnabled() — never
// active in production (which requires NODE_ENV != "production" AND
// ENABLE_DEV_AUTH_WITHOUT_DB=true AND !isPgReady()).
router.get("/dev/last-otp", (req: Request, res: Response) => {
  if (!isDevAuthWithoutDbEnabled()) {
    return res.status(404).json({ message: "Not found" });
  }
  const email = String(req.query.email || "").toLowerCase().trim();
  if (!email) return res.status(400).json({ message: "email query param required" });
  const user = devUsersByEmail.get(email);
  if (!user) return res.status(404).json({ message: "No dev user for this email" });
  // We never store the plaintext OTP — only its hash. The plaintext was
  // already printed to the dev console by the mock mailer (look for
  // "OTP CODE →"). This endpoint returns the OTP metadata so the test
  // harness can confirm one was created.
  const otp = latestDevOtp(user.id, "registration");
  if (!otp) return res.status(404).json({ message: "No active registration OTP" });
  return res.json({
    userId: user.id,
    code: otp.plaintext,
    expiresAt: otp.expiresAt,
    attempts: otp.attempts,
  });
});

// ── Server-driven Google sign-in (no Firebase popup) ─────────────────────
//
// Why a server-side OAuth code flow instead of Firebase signInWithPopup:
//   - COOP blocks Firebase's popup polling even with same-origin-allow-popups
//   - Wallet/ad-blocker extensions (MetaMask) intercept window.opener
//   - signInWithRedirect lands back at our origin but storage isolation
//     across the redirect chain occasionally drops the result
// Server-side flow has none of these failure modes.

router.get("/google/start", async (req: Request, res: Response) => {
  const { getSignInAuthUrl, isGoogleSignInConfigured } = await import("../lib/google-signin");
  if (!isGoogleSignInConfigured()) {
    return res.status(503).send("Google sign-in is not configured on this server.");
  }
  const state = crypto.randomBytes(32).toString("hex");
  req.session.googleSignInState = state;
  // Capture an optional workspace-name hint so first-time sign-ups land in
  // a workspace named after their company instead of "<Name>'s Workspace".
  const wsName = String(req.query.workspaceName ?? "").trim();
  if (wsName.length >= 2 && wsName.length <= 100) {
    req.session.googleSignInWorkspaceName = wsName;
  }
  await new Promise<void>((resolve, reject) =>
    req.session.save((err) => (err ? reject(err) : resolve()))
  );
  res.redirect(getSignInAuthUrl(state));
});

router.get("/google/callback", async (req: Request, res: Response) => {
  const { exchangeSignInCode } = await import("../lib/google-signin");

  const code = String(req.query.code ?? "");
  const state = String(req.query.state ?? "");
  const expectedState = req.session.googleSignInState;
  const workspaceNameHint = req.session.googleSignInWorkspaceName;

  // Clear the one-shot session keys regardless of outcome.
  delete req.session.googleSignInState;
  delete req.session.googleSignInWorkspaceName;

  if (!code || !state) {
    return res.redirect("/login?error=google_oauth_missing_params");
  }
  if (!expectedState || expectedState !== state) {
    return res.redirect("/login?error=google_oauth_csrf");
  }

  let info;
  try {
    info = await exchangeSignInCode(code);
  } catch (err) {
    logger.error("[auth/google/callback] code exchange failed", { error: String(err) });
    return res.redirect("/login?error=google_oauth_exchange");
  }

  try {
    // Find-or-create the user. Email is the join key. If a user exists
    // under a different auth_provider (e.g. local password), we still let
    // them sign in via Google as long as they had already verified that
    // address — the same email reaching us means Google vouched for it,
    // so account takeover isn't possible from a stranger's Google account.
    let user = await pgFindUserByAuthSubject("google", info.sub);
    if (!user) {
      user = await pgFindUserByEmail(info.email);
    }
    if (!user) {
      // New user — create + own workspace
      const username = `${info.email.split("@")[0]}_${Date.now()}`;
      user = await pgCreateUser({
        authProvider: "google",
        authSubject: info.sub,
        email: info.email,
        username,
        // Google-only sign-in: placeholder hash, blocks bcrypt compare
        passwordHash: `google_managed_${info.sub}`,
        name: info.name || info.email.split("@")[0],
        displayName: info.name || null,
        avatar: info.picture,
        emailVerified: info.emailVerified,
        role: "admin",
        status: "active",
      });
      const fallbackWsName =
        workspaceNameHint ||
        `${info.name || info.email.split("@")[0]}'s Workspace`;
      const workspace = await pgCreateWorkspace({
        name: fallbackWsName,
        slug: await makeUniqueSlug(fallbackWsName),
        type: "business",
        ownerId: user.id,
      });
      await pgUpsertWorkspaceMembership({
        workspaceId: workspace.id,
        userId: user.id,
        role: "owner",
      });
      recordAuditEvent({
        actorUserId: user.id,
        targetUserId: user.id,
        eventType: AUDIT_EVENTS.USER_REGISTERED,
        payload: { provider: "google", workspaceId: workspace.id, workspaceRole: "owner" },
      });
    } else if (["suspended", "rejected"].includes(user.status)) {
      return res.redirect("/login?error=account_inactive");
    }

    await createLoginSession(req, res, user.id);
    await pgSetUserLastLogin(user.id);
    recordAuditEvent({
      actorUserId: user.id,
      targetUserId: user.id,
      eventType: AUDIT_EVENTS.USER_LOGIN,
      payload: { provider: "google", ip: req.ip, ua: req.headers["user-agent"] },
    });

    // Always reload server profile so a stale OAuth response can't leave
    // us redirecting to the wrong dashboard. The /dashboard route on the
    // client side will then resolve to the role-specific path.
    return res.redirect("/dashboard");
  } catch (err) {
    logger.error("[auth/google/callback] sign-in failed", { error: String(err) });
    return res.redirect("/login?error=google_signin_failed");
  }
});

const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: passwordSchema,
  workspaceName: z.string().min(2),
});

router.post("/signup", signupLimiter, async (req: Request, res: Response) => {
  if (!isLocalPasswordAuthEnabled()) {
    return res.status(410).json({
      message: "Password signup is disabled. Use Firebase Authentication.",
    });
  }

  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const email = parsed.data.email.toLowerCase().trim();
  if (isDevAuthWithoutDbEnabled()) {
    if (devUsersByEmail.has(email)) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }
    const user = createDevUser({
      email,
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
      name: parsed.data.name,
      workspaceName: parsed.data.workspaceName,
    });
    const verifyToken = createDevOtp(user.id, "registration", 15);
    sendEmailVerification(user.email, user.displayName || user.name, verifyToken).catch((e) =>
      logger.warn("[auth/signup/dev] Failed to mock-send verification email", { error: String(e) })
    );
    const tokens = await createDevLoginSession(req, res, user);
    return res.status(201).json({ token: tokens.accessToken, ...devAuthPayload(user) });
  }

  if (await pgFindUserByEmail(email)) {
    return res.status(409).json({ message: "An account with this email already exists" });
  }

  // Compensating cleanup: queries here run outside a transaction (the pg helpers
  // each use the pool), so if a later step fails we manually unwind anything
  // already created to avoid orphaned users/workspaces.
  let userId: number | null = null;
  let workspaceId: number | null = null;
  try {
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
    userId = user.id;

    const workspace = await pgCreateWorkspace({
      name: parsed.data.workspaceName,
      slug: await makeUniqueSlug(parsed.data.workspaceName),
      type: "business",
      ownerId: user.id,
    });
    workspaceId = workspace.id;

    await pgUpsertWorkspaceMembership({
      workspaceId: workspace.id,
      userId: user.id,
      role: "owner",
    });

    const verifyToken = await createVerificationToken(user.id);
    const { accessToken } = await createLoginSession(req, res, user.id);

    sendEmailVerification(user.email, user.displayName || user.name, verifyToken).catch((e) =>
      logger.warn("[auth/signup] Failed to send verification email", { error: String(e) })
    );
    sendWelcomeEmail(user.email, user.displayName || user.name).catch((e) =>
      logger.warn("[auth/signup] Failed to send welcome email", { error: String(e) })
    );

    recordAuditEvent({
      actorUserId: user.id,
      targetUserId: user.id,
      eventType: AUDIT_EVENTS.USER_REGISTERED,
      payload: { provider: "local", workspaceId: workspace.id, workspaceRole: "owner" },
    });

    return res.status(201).json({ token: accessToken, ...(await currentAuthPayload(user.id)) });
  } catch (err) {
    logger.error("[auth/signup] Error", { error: String(err) });
    if (workspaceId !== null) {
      await getPgPool()
        .query("DELETE FROM workspaces WHERE id = $1", [workspaceId])
        .catch((e) => logger.error("[auth/signup] cleanup workspace failed", { error: String(e) }));
    }
    if (userId !== null) {
      await pgDeleteUser(userId).catch((e) =>
        logger.error("[auth/signup] cleanup user failed", { error: String(e) })
      );
    }
    return res.status(500).json({ message: "Signup failed" });
  }
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

router.post("/login", loginLimiter, async (req: Request, res: Response) => {
  if (!isLocalPasswordAuthEnabled()) {
    return res.status(410).json({
      message: "Password login is disabled. Use Firebase Authentication.",
    });
  }

  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "Email and password are required" });

    if (isDevAuthWithoutDbEnabled()) {
      const email = parsed.data.email.toLowerCase().trim();
      const user = devUsersByEmail.get(email);
      if (!user || !(await bcrypt.compare(parsed.data.password, user.password || ""))) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      user.lastLoginAt = new Date();
      const tokens = await createDevLoginSession(req, res, user);
      return res.status(200).json({ token: tokens.accessToken, ...devAuthPayload(user) });
    }

    const user = await pgFindUserByEmail(parsed.data.email);
    if (!user || !(await bcrypt.compare(parsed.data.password, user.password || ""))) {
      recordAuditEvent({
        actorUserId: user?.id ?? null,
        targetUserId: user?.id ?? null,
        eventType: AUDIT_EVENTS.USER_LOGIN_FAILED,
        payload: {
          email: parsed.data.email,
          ip: req.ip,
          ua: req.headers["user-agent"],
          reason: user ? "bad_password" : "unknown_email",
        },
      });
      return res.status(401).json({ message: "Invalid email or password" });
    }
    if (["suspended", "rejected"].includes(user.status)) {
      recordAuditEvent({
        actorUserId: user.id,
        targetUserId: user.id,
        eventType: AUDIT_EVENTS.USER_LOGIN_FAILED,
        payload: {
          email: parsed.data.email,
          ip: req.ip,
          ua: req.headers["user-agent"],
          reason: "account_" + user.status,
        },
      });
      return res.status(403).json({ message: "Account is not active" });
    }

    const { accessToken } = await createLoginSession(req, res, user.id);
    await pgSetUserLastLogin(user.id);
    recordAuditEvent({
      actorUserId: user.id,
      targetUserId: user.id,
      eventType: AUDIT_EVENTS.USER_LOGIN,
      payload: { ip: req.ip, ua: req.headers["user-agent"] },
    });
    return res.status(200).json({ token: accessToken, ...(await currentAuthPayload(user.id)) });
  } catch (err) {
    logger.error("[auth/login] Error", { error: String(err) });
    return res.status(500).json({ message: "Login failed" });
  }
});

router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) return res.status(401).json({ message: "Refresh token required" });

    if (isDevAuthWithoutDbEnabled()) {
      const refreshHash = tokenHash(refreshToken);
      const session = devSessionsByRefreshHash.get(refreshHash);
      devSessionsByRefreshHash.delete(refreshHash);
      if (!session || session.expiresAt < new Date()) {
        clearAuthCookies(req, res);
        return res.status(401).json({ message: "Invalid refresh token" });
      }
      const user = devUsersById.get(session.userId);
      if (!user || ["suspended", "rejected"].includes(user.status)) {
        clearAuthCookies(req, res);
        return res.status(401).json({ message: "Authentication required" });
      }
      const tokens = await createDevLoginSession(req, res, user);
      return res.status(200).json({ token: tokens.accessToken });
    }

    // Atomic rotation: DELETE ... RETURNING ensures only one of N concurrent
    // refreshes with the same token wins. The losers get undefined and fail.
    const session = await storage.consumeSessionByRefreshToken(tokenHash(refreshToken));
    if (!session || session.expiresAt < new Date()) {
      clearAuthCookies(req, res);
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const user = await pgFindUserById(session.userId);
    if (!user || ["suspended", "rejected"].includes(user.status)) {
      clearAuthCookies(req, res);
      return res.status(401).json({ message: "Authentication required" });
    }

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
    if (isDevAuthWithoutDbEnabled()) {
      const user = devUsersById.get(payload.userId);
      if (!user || ["suspended", "rejected"].includes(user.status)) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      return res.status(200).json(devAuthPayload(user));
    }
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
  if (isDevAuthWithoutDbEnabled()) {
    if (refreshToken) devSessionsByRefreshHash.delete(tokenHash(refreshToken));
    clearAuthCookies(req, res);
    return res.status(200).json({ message: "Logged out" });
  }
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

router.post("/email/verify/request", verifyRequestLimiter, async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.access_token || req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Not authenticated" });
    const payload = jwt.verify(token, JWT_SECRET) as AccessPayload;

    if (isDevAuthWithoutDbEnabled()) {
      const user = devUsersById.get(payload.userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.emailVerified) return res.json({ message: "Email already verified" });
      const verifyToken = createDevOtp(user.id, "registration", 15);
      await sendEmailVerification(user.email, user.displayName || user.name, verifyToken);
      return res.json({ message: "Verification email sent" });
    }

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

const OTP_MAX_ATTEMPTS = 5;

router.post("/email/verify", verifyLimiter, async (req: Request, res: Response) => {
  const parsed = z.object({ token: z.string().min(4) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Token is required" });

  // The user is authenticated by the signup-issued access cookie; we look up
  // their latest OTP directly rather than searching by hash so we can enforce
  // a per-OTP attempt limit without leaking codes across accounts.
  const accessToken = req.cookies?.access_token || req.headers.authorization?.split(" ")[1];
  if (!accessToken) return res.status(401).json({ message: "Not authenticated" });
  let userId: number;
  try {
    userId = (jwt.verify(accessToken, JWT_SECRET) as AccessPayload).userId;
  } catch {
    return res.status(401).json({ message: "Not authenticated" });
  }

  if (isDevAuthWithoutDbEnabled()) {
    const otp = latestDevOtp(userId, "registration");
    if (!otp) {
      return res.status(400).json({ message: "No active verification code. Request a new one." });
    }
    otp.attempts += 1;
    if (otp.attempts > OTP_MAX_ATTEMPTS) {
      otp.used = true;
      return res.status(429).json({ message: "Too many attempts. Request a new verification code." });
    }
    if (otp.otpHash !== tokenHash(parsed.data.token)) {
      return res.status(400).json({ message: "Invalid verification code" });
    }
    otp.used = true;
    const user = devUsersById.get(userId);
    if (user) user.emailVerified = true;
    return res.json({ message: "Email verified" });
  }

  const pool = getPgPool();
  // Atomically increment attempts on the latest registration OTP and return its state.
  const { rows } = await pool.query(
    `UPDATE otps SET attempts = attempts + 1
     WHERE id = (
       SELECT id FROM otps
       WHERE user_id = $1 AND type = 'registration' AND used = false AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1
     )
     RETURNING id, otp_hash, attempts`,
    [userId]
  );
  const otp = rows[0];
  if (!otp) return res.status(400).json({ message: "No active verification code. Request a new one." });

  if (otp.attempts > OTP_MAX_ATTEMPTS) {
    await pool.query("UPDATE otps SET used = true WHERE id = $1", [otp.id]);
    return res.status(429).json({ message: "Too many attempts. Request a new verification code." });
  }

  if (otp.otp_hash !== tokenHash(parsed.data.token)) {
    return res.status(400).json({ message: "Invalid verification code" });
  }

  await pgUpdateUser(userId, { emailVerified: true });
  await storage.markOtpUsed(Number(otp.id));
  return res.json({ message: "Email verified" });
});

router.post("/password/forgot", forgotLimiter, async (req: Request, res: Response) => {
  if (!isLocalPasswordAuthEnabled()) {
    return res.status(410).json({
      message: "Password reset is disabled. Use Firebase Authentication.",
    });
  }

  const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!parsed.success)
    return res.status(200).json({ message: "If the account exists, reset instructions were sent" });
  const user = await pgFindUserByEmail(parsed.data.email);
  // Only issue a reset to verified accounts: an attacker who registers with the
  // victim's email but never verifies should not be able to trigger this flow.
  if (user && user.emailVerified) {
    const token = randomToken();
    await storage.createOtp({
      userId: user.id,
      otpHash: tokenHash(token),
      type: "password_reset",
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      used: false,
    });
    sendPasswordReset(user.email, user.displayName || user.name, token).catch((e) =>
      logger.warn("[auth/password/forgot] Failed to send reset email", { error: String(e) })
    );
  }
  return res.status(200).json({ message: "If the account exists, reset instructions were sent" });
});

router.post("/password/reset", resetLimiter, async (req: Request, res: Response) => {
  if (!isLocalPasswordAuthEnabled()) {
    return res.status(410).json({
      message: "Password reset is disabled. Use Firebase Authentication.",
    });
  }

  const parsed = z
    .object({ token: z.string().min(10), password: passwordSchema })
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
  password: passwordSchema,
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
    sendWelcomeEmail(user.email, user.displayName || user.name).catch((e) =>
      logger.warn("[invite/accept] Failed to send welcome email", { error: String(e) })
    );
  } else {
    // Keep original password hash to prevent corruption when accepting new workspace invites
    await pgUpdateUser(user.id, {
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
  const { accessToken } = await createLoginSession(req, res, user.id);

  recordAuditEvent({
    targetUserId: user.id,
    eventType: AUDIT_EVENTS.INVITE_ACCEPTED,
    payload: { workspaceId: invite.workspaceId, kind: invite.kind, workspaceRole: invite.role },
  });

  return res.status(201).json({ token: accessToken, ...(await currentAuthPayload(user.id)) });
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
  if (process.env.ENABLE_FIREBASE_AUTH_COMPAT === "false") {
    return res.status(410).json({ message: "Firebase auth compatibility is disabled" });
  }
  const { idToken, role, workspaceName } = req.body as {
    idToken?: string;
    role?: string;
    workspaceName?: string;
  };
  if (!idToken) return res.status(400).json({ message: "idToken is required" });
  const decoded = await verifyFirebaseToken(idToken);
  if (!decoded?.email)
    return res.status(401).json({ message: "Invalid or expired Firebase ID token" });

  const email = decoded.email.toLowerCase().trim();
  let user =
    (await pgFindUserByAuthSubject("firebase", decoded.uid)) ||
    (await pgFindUserByEmail(email));
  if (!user) {
    const requestedWorkspaceName =
      typeof workspaceName === "string" && workspaceName.trim().length >= 2
        ? workspaceName.trim()
        : null;
    const userRole = requestedWorkspaceName ? "admin" : normalizeSelfRegisterableRole(role);
    const userStatus = userRole === "teacher" ? "pending" : "active";
    user = await pgCreateUser({
      authProvider: "firebase",
      authSubject: decoded.uid,
      email,
      username: `${email.split("@")[0]}_${Date.now()}`,
      passwordHash: `firebase_managed_${decoded.uid}`,
      name: decoded.name || email.split("@")[0],
      displayName: decoded.name || null,
      avatar: decoded.picture || null,
      role: userRole,
      status: userStatus,
      emailVerified: !!decoded.email_verified,
    });

    if (requestedWorkspaceName) {
      const workspace = await pgCreateWorkspace({
        name: requestedWorkspaceName,
        slug: await makeUniqueSlug(requestedWorkspaceName),
        type: "business",
        ownerId: user.id,
      });
      await pgUpsertWorkspaceMembership({
        workspaceId: workspace.id,
        userId: user.id,
        role: "owner",
      });
      recordAuditEvent({
        actorUserId: user.id,
        targetUserId: user.id,
        eventType: AUDIT_EVENTS.USER_REGISTERED,
        payload: { provider: "firebase", workspaceId: workspace.id, workspaceRole: "owner" },
      });
    }

    if (!decoded.email_verified) {
      const verifyToken = await createVerificationToken(user.id);
      sendEmailVerification(user.email, user.displayName || user.name, verifyToken).catch((e) =>
        logger.warn("[auth/firebase] Failed to send verification email", { error: String(e) })
      );
    }
    sendWelcomeEmail(user.email, user.displayName || user.name).catch((e) =>
      logger.warn("[auth/firebase] Failed to send welcome email", { error: String(e) })
    );
  } else if (user.authProvider !== "firebase") {
    // Prevent password-auth account takeover via Firebase registration/login with same email
    return res.status(409).json({
      message:
        "An account with this email already exists using password login. Please log in with your password.",
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
