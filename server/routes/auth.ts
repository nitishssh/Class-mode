import { Router, Request, Response } from "express";
import { MongoUser, getNextSequenceValue } from "../../shared/mongo-schema";
import { setCustomUserClaims, verifyFirebaseToken } from "../lib/firebase-admin";
import { logger } from "../lib/logger";
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

const SELF_REGISTERABLE_ROLES = ["student", "teacher", "principal", "school_admin", "parent"];

// ── POST /api/auth/firebase ──────────────────────────────────────────────────
// Exchange a Firebase ID token for a server-issued JWT.
// This is the ONLY place Firebase Admin token verification happens.
// All subsequent API requests use the server JWT — never the Firebase ID token.
router.post("/firebase", async (req: Request, res: Response) => {
  try {
    const { idToken, role: rawRole } = req.body as { idToken?: string; role?: string };
    
    // FIX BUG-15: Restrict self-assignable roles to prevent privilege escalation
    const safeRole = SELF_REGISTERABLE_ROLES.includes(rawRole || "") ? rawRole : "student";

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

    // Find existing user by Firebase UID, fall back to email match
    let user = await MongoUser.findOne({ firebaseUid: uid });
    if (!user) {
      user = await MongoUser.findOne({ email: email.toLowerCase() });
    }

    if (!user) {
      // First Firebase login — create MongoDB record
      const id = await getNextSequenceValue("userId");
      user = new MongoUser({
        id,
        username: `${email.split("@")[0]}_${id}`,
        password: `firebase_managed_${uid}`,
        name: name || email.split("@")[0],
        email: email.toLowerCase(),
        role: safeRole || "student",
        avatar: picture || null,
        firebaseUid: uid,
        displayName: name || null,
        status: safeRole === "teacher" ? "pending" : "active",
      });
      await user.save();
      logger.info("[auth/firebase] Created new MongoDB user", { id, role: user.role });
    } else {
      // Patch missing fields on returning users
      let dirty = false;
      if (!user.firebaseUid) {
        user.firebaseUid = uid;
        dirty = true;
      }
      if (picture && !user.avatar) {
        user.avatar = picture;
        dirty = true;
      }
      if (dirty) await user.save();
    }

    // Keep Firebase custom claims in sync (fire-and-forget, never block login)
    setCustomUserClaims(uid, { role: user.role, status: user.status }).catch((e) =>
      logger.warn("[auth/firebase] Failed to set custom claims", { uid, error: String(e) })
    );

    // Issue a server JWT so subsequent requests never need to call Firebase Admin
    const token = issueJwt(user.id, user.role, user.email);

    // FIX BUG-07: Set firebaseUid and email on session so /sync-profile can read them
    // Persist session for WebSocket auth compatibility
    if (req.session) {
      req.session.userId = user.id;
      req.session.role = user.role;
      req.session.firebaseUid = uid;
      req.session.email = email;
    }

    // Set httpOnly cookie — client can also store in memory for Authorization header
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
      (await MongoUser.findOne({ firebaseUid: decoded.uid })) ||
      (decoded.email ? await MongoUser.findOne({ email: decoded.email.toLowerCase() }) : null);

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

    const user = await MongoUser.findOne({ email: email.toLowerCase().trim() });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = issueJwt(user.id, user.role, user.email);

    if (req.session) {
      req.session.userId = user.id;
      req.session.role = user.role;
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

    // FIX BUG-16: Server-side role-specific validation
    if (["teacher", "principal", "school_admin"].includes(role || "") && !school_code) {
      return res.status(400).json({ message: "school_code is required for teachers and school staff" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (await MongoUser.findOne({ email: normalizedEmail })) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    const id = await getNextSequenceValue("userId");
    const newUser = new MongoUser({
      id,
      username: `${normalizedEmail.split("@")[0]}_${id}`,
      password: await bcrypt.hash(password, 12),
      name,
      email: normalizedEmail,
      role: role || "student",
      displayName: name,
      class: className || null,
      school_code: school_code || null,
      status: role === "teacher" ? "pending" : "active",
    });
    await newUser.save();

    const token = issueJwt(id, newUser.role, normalizedEmail);

    if (req.session) {
      req.session.userId = id;
      req.session.role = newUser.role;
    }

    res.cookie("access_token", token, COOKIE_OPTS);
    logger.info("[auth/register] Created new user", { id, role: newUser.role });

    return res.status(201).json({
      token,
      userId: id,
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

    const user = await MongoUser.findOne({ id: userId }).lean();
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
      role,
      school_code,
      grade,
      board,
      subjects,
      district,
      status,
    } = req.body as Record<string, unknown>;

    let user = sessionUserId
      ? await MongoUser.findOne({ id: sessionUserId })
      : firebaseUid
        ? await MongoUser.findOne({ firebaseUid })
        : null;

    if (!user) return res.status(401).json({ message: "Unauthorized" });

    type ValidRole = "student" | "teacher" | "parent" | "principal" | "school_admin" | "admin";
    type ValidStatus = "active" | "pending" | "suspended" | "rejected";

    if (displayName !== undefined) user.displayName = displayName as string;
    if (className !== undefined) user.class = className as string;
    if (subject !== undefined) user.subject = subject as string;
    if (role !== undefined) user.role = role as ValidRole;
    if (school_code !== undefined) user.school_code = school_code as string;
    if (grade !== undefined) user.grade = grade as string;
    if (board !== undefined) user.board = board as string;
    if (subjects !== undefined) user.subjects = subjects as string[];
    if (district !== undefined) user.district = district as string;
    if (status !== undefined) user.status = status as ValidStatus;
    await user.save();

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
