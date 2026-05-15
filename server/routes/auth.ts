import { Router, Request, Response } from "express";
import { normalizeSelfRegisterableRole, SCHOOL_STAFF_ROLES, isTenantAdminRole } from "../../shared/authz";
import { setCustomUserClaims, verifyFirebaseToken } from "../lib/firebase-admin";
import { logger } from "../lib/logger";
import { recordAuditEvent, AUDIT_EVENTS } from "../lib/audit";
import {
  pgFindUserByAuthSubject, pgFindUserByEmail, pgFindUserById,
  pgCreateUser, pgUpdateUser, pgSetUserLastLogin, pgUpsertMembership,
} from "../lib/pg-queries";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = Router();

if (!process.env.JWT_SECRET) {
  throw new Error(
    "JWT_SECRET environment variable is required. Set it in your .env file (see .env.example)."
  );
}
const JWT_SECRET: string = process.env.JWT_SECRET;

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

type JwtPayload = { userId: number; role: string; email: string };

function issueJwt(userId: number, role: string, email: string): string {
  return jwt.sign({ userId, role, email } satisfies JwtPayload, JWT_SECRET, { expiresIn: "7d" });
}

// ── POST /api/auth/firebase ──────────────────────────────────────────────────
// Exchange a Firebase ID token for a server-issued JWT.
// This is the ONLY place Firebase Admin token verification happens.
// All subsequent API requests use the server JWT — never the Firebase ID token.
router.post("/firebase", async (req: Request, res: Response) => {
  try {
    const { idToken, role: rawRole } = req.body as { idToken?: string; role?: string };
    
    const safeRole = normalizeSelfRegisterableRole(rawRole);

    if (!idToken || typeof idToken !== "string") {
      return res.status(400).json({ message: "idToken is required" });
    }

    const decoded = await verifyFirebaseToken(idToken);
    if (!decoded) {
      return res.status(401).json({ message: "Invalid or expired Firebase ID token" });
    }

    const { uid, email, name, picture } = decoded;
    if (!email) {
      return res.status(400).json({ message: "Firebase account must have an email address" });
    }

    // Look up existing user — PostgreSQL is the sole source of truth
    let user = await pgFindUserByAuthSubject("firebase", uid);
    if (!user) user = await pgFindUserByEmail(email.toLowerCase());

    if (!user) {
      // First Firebase login — create PG record
      const baseUsername = email.split("@")[0];
      user = await pgCreateUser({
        authProvider: "firebase",
        authSubject: uid,
        email: email.toLowerCase(),
        username: `${baseUsername}_${Date.now()}`,
        passwordHash: `firebase_managed_${uid}`,
        name: name || baseUsername,
        displayName: name || null,
        avatar: picture || null,
        role: safeRole,
        status: safeRole === "teacher" ? "pending" : "active",
      });
      logger.info("[auth/firebase] Created new PG user", { id: user.id, role: user.role });
      recordAuditEvent({
        targetUserId: user.id,
        eventType: AUDIT_EVENTS.USER_REGISTERED,
        payload: { role: user.role, provider: "firebase", uid },
      });
      if (user.schoolCode) {
        pgUpsertMembership({ userId: user.id, schoolCode: user.schoolCode, status: (user.status as any) || "active", roleKey: user.role });
      }
    } else {
      // Patch missing fields and update last login
      const updates: Record<string, any> = {};
      if (!user.firebaseUid) updates.authSubject = uid;
      if (picture && !user.avatar) updates.avatar = picture;
      if (Object.keys(updates).length) await pgUpdateUser(user.id, updates);
      pgSetUserLastLogin(user.id);
    }

    // Keep Firebase custom claims in sync (fire-and-forget)
    setCustomUserClaims(uid, { role: user.role, status: user.status }).catch((e) =>
      logger.warn("[auth/firebase] Failed to set custom claims", { uid, error: String(e) })
    );

    const token = issueJwt(user.id, user.role, user.email);

    if (req.session) {
      req.session.userId = user.id;
      req.session.role = user.role;
      req.session.firebaseUid = uid;
      req.session.email = email;
    }

    res.cookie("access_token", token, COOKIE_OPTS);

    return res.status(200).json({
      token,
      userId: user.id,
      displayName: user.displayName || user.name,
      role: user.role,
      email: user.email,
      avatar: user.avatar ?? null,
    });
  } catch (error) {
    logger.error("[auth/firebase] Error", { error: String(error) });
    return res.status(500).json({ message: "Authentication failed. Please try again." });
  }
});

// ── POST /api/auth/refresh ────────────────────────────────────────────────────
// Called by the client when Firebase silently refreshes its ID token.
// Exchanges a fresh Firebase ID token for a new server JWT without re-logging in.
router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const idToken =
      (req.body as { idToken?: string }).idToken || req.headers.authorization?.split(" ")[1];

    if (!idToken) {
      return res.status(400).json({ message: "idToken is required" });
    }

    const decoded = await verifyFirebaseToken(idToken);
    if (!decoded) {
      return res.status(401).json({ message: "Invalid or expired Firebase ID token" });
    }

    const user =
      (await pgFindUserByAuthSubject("firebase", decoded.uid)) ||
      (decoded.email ? await pgFindUserByEmail(decoded.email.toLowerCase()) : null);

    if (!user) {
      return res.status(404).json({ message: "User not found. Please log in again." });
    }

    const token = issueJwt(user.id, user.role, user.email);
    res.cookie("access_token", token, COOKIE_OPTS);

    return res.status(200).json({ token });
  } catch (error) {
    logger.error("[auth/refresh] Error", { error: String(error) });
    return res.status(500).json({ message: "Token refresh failed" });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
// Email/password login for seeded/test accounts that bypass Firebase.
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await pgFindUserByEmail(email.toLowerCase().trim());
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = issueJwt(user.id, user.role, user.email);

    if (req.session) {
      req.session.userId = user.id;
      req.session.role = user.role;
    }

    res.cookie("access_token", token, COOKIE_OPTS);
    recordAuditEvent({
      actorUserId: user.id,
      targetUserId: user.id,
      eventType: AUDIT_EVENTS.USER_LOGIN,
      payload: { ip: req.ip, ua: req.headers["user-agent"] },
    });

    pgSetUserLastLogin(user.id);
    return res.status(200).json({
      token,
      userId: user.id,
      displayName: user.displayName || user.name,
      role: user.role,
      email: user.email,
      avatar: user.avatar ?? null,
    });
  } catch (err) {
    logger.error("[auth/login] Error", { error: String(err) });
    return res.status(500).json({ message: "Login failed" });
  }
});

// ── POST /api/auth/register ───────────────────────────────────────────────────
// Backend-only registration for environments where Firebase email/password is disabled.
router.post("/register", async (req: Request, res: Response) => {
  try {
    const {
      name,
      email,
      password,
      role,
      class: className,
      school_code,
    } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      role?: string;
      class?: string;
      school_code?: string;
    };

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Invalid email address" });
    }

    // Explicitly block tenant-admin roles from self-registration
    if (isTenantAdminRole(role)) {
      recordAuditEvent({
        eventType: AUDIT_EVENTS.ROLE_CLAIM_REJECTED,
        payload: { attempted_role: role, path: "register" },
      });
      return res.status(400).json({ message: "This role requires an invitation. Contact your administrator." });
    }

    const safeRole = normalizeSelfRegisterableRole(role);

    // Server-side role-specific validation
    if (SCHOOL_STAFF_ROLES.includes(safeRole as any) && !school_code) {
      return res.status(400).json({ message: "school_code is required for teachers and school staff" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (await pgFindUserByEmail(normalizedEmail)) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    const baseUsername = normalizedEmail.split("@")[0];
    const newUser = await pgCreateUser({
      authProvider: "local",
      authSubject: normalizedEmail,
      email: normalizedEmail,
      username: `${baseUsername}_${Date.now()}`,
      passwordHash: await bcrypt.hash(password, 12),
      name,
      displayName: name,
      role: safeRole,
      status: safeRole === "teacher" ? "pending" : "active",
      className: className || null,
      schoolCode: school_code || null,
    });

    const token = issueJwt(newUser.id, newUser.role, normalizedEmail);

    if (req.session) {
      req.session.userId = newUser.id;
      req.session.role = newUser.role;
    }

    res.cookie("access_token", token, COOKIE_OPTS);
    logger.info("[auth/register] Created new PG user", { id: newUser.id, role: newUser.role });
    recordAuditEvent({
      targetUserId: newUser.id,
      eventType: AUDIT_EVENTS.USER_REGISTERED,
      payload: { role: newUser.role, provider: "local" },
    });
    if (school_code) {
      pgUpsertMembership({ userId: newUser.id, schoolCode: school_code, status: (newUser.status as any) || "active", roleKey: safeRole });
    }

    return res.status(201).json({
      token,
      userId: newUser.id,
      displayName: newUser.displayName || newUser.name,
      role: newUser.role,
      email: newUser.email,
    });
  } catch (err) {
    logger.error("[auth/register] Error", { error: String(err) });
    return res.status(500).json({ message: "Registration failed" });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
// Returns the current user based on server JWT. Fast — no Firebase Admin call.
router.get("/me", async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.access_token || req.headers.authorization?.split(" ")[1];

    if (!token) return res.status(401).json({ message: "Not authenticated" });

    let userId: number | null = null;
    try {
      const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
      userId = payload?.userId ?? null;
    } catch {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const user = await pgFindUserById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { password: _pw, ...safeUser } = user as any;
    void _pw;
    return res.status(200).json(safeUser);
  } catch {
    return res.status(500).json({ message: "Failed to get current user" });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post("/logout", (req: Request, res: Response) => {
  res.clearCookie("access_token");
  if (req.session) {
    req.session.destroy(() => {
      res.status(200).json({ message: "Logged out" });
    });
  } else {
    res.status(200).json({ message: "Logged out" });
  }
});

// ── POST /api/auth/sync-profile ───────────────────────────────────────────────
// Called after registration to update profile fields in MongoDB.
// Requires a valid server JWT (set by /firebase or /register).
router.post("/sync-profile", async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.access_token || req.headers.authorization?.split(" ")[1];

    let firebaseUid: string | undefined;
    let sessionUserId: number | undefined;

    if (token) {
      try {
        const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
        sessionUserId = payload.userId;
      } catch {
        // fall through to session
      }
    }

    if (!sessionUserId && req.session?.userId) {
      sessionUserId = req.session.userId;
    }

    firebaseUid = req.session?.firebaseUid;

    const {
      displayName,
      class: className,
      subject,
      role: _requestedRole,
      school_code,
      grade,
      board,
      subjects,
      district,
      status: _requestedStatus,
    } = req.body as Record<string, unknown>;

    let user = sessionUserId
      ? await pgFindUserById(sessionUserId)
      : firebaseUid
        ? await pgFindUserByAuthSubject("firebase", firebaseUid)
        : null;

    if (!user) return res.status(401).json({ message: "Unauthorized" });

    if (_requestedRole !== undefined || _requestedStatus !== undefined) {
      logger.warn("[auth/sync-profile] Ignored client-controlled role/status update", { userId: user.id });
      recordAuditEvent({
        actorUserId: user.id,
        targetUserId: user.id,
        eventType: AUDIT_EVENTS.ROLE_CLAIM_REJECTED,
        payload: { attempted_role: _requestedRole, attempted_status: _requestedStatus },
      });
    }

    const updates: Record<string, any> = {};
    if (displayName !== undefined) updates.displayName = displayName;
    if (className !== undefined) updates.className = className;
    if (subject !== undefined) updates.subject = subject;
    if (school_code !== undefined) updates.schoolCode = school_code;
    if (grade !== undefined) updates.grade = grade;
    if (board !== undefined) updates.board = board;
    if (subjects !== undefined) updates.subjects = subjects;
    if (district !== undefined) updates.district = district;

    if (Object.keys(updates).length) {
      user = (await pgUpdateUser(user.id, updates)) ?? user;
    }

    if (user.firebaseUid) {
      setCustomUserClaims(user.firebaseUid, { role: user.role, status: user.status }).catch((e) =>
        logger.warn("[auth/sync-profile] Failed to set custom claims", { error: String(e) })
      );
    }

    return res.json({ message: "Profile synced", user });
  } catch {
    return res.status(500).json({ message: "Failed to sync profile" });
  }
});

export default router;
