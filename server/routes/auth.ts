import { Router, Request, Response } from "express";
import { MongoUser } from "../../shared/mongo-schema";
import { getNextSequenceValue } from "../../shared/mongo-schema";
import { setCustomUserClaims, verifyFirebaseToken } from "../lib/firebase-admin";
import { authenticateToken } from "../routes";
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

type CustomJwtPayload = {
  userId: number;
  role: string;
  email: string;
};

// We keep a small route for the client to tell the backend "I just registered in Firebase, create my Mongo document"
router.post("/sync-profile", authenticateToken, async (req: Request, res: Response) => {
  try {
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
    } = req.body;
    const firebaseUid = req.session!.firebaseUid;

    if (!firebaseUid) return res.status(401).json({ message: "Unauthorized" });

    let user = await MongoUser.findOne({ firebaseUid });

    if (user) {
      // Update existing
      if (displayName !== undefined) user.displayName = displayName;
      if (className !== undefined) user.class = className;
      if (subject !== undefined) user.subject = subject;
      if (role !== undefined)
        user.role = role as
          | "student"
          | "teacher"
          | "parent"
          | "principal"
          | "school_admin"
          | "admin";
      if (school_code !== undefined) user.school_code = school_code;
      if (grade !== undefined) user.grade = grade;
      if (board !== undefined) user.board = board;
      if (subjects !== undefined) user.subjects = subjects;
      if (district !== undefined) user.district = district;
      if (status !== undefined)
        user.status = status as "active" | "pending" | "suspended" | "rejected";
      await user.save();
    } else {
      // Create a new mongo user bridge
      const numericId = await getNextSequenceValue("userId");
      user = new MongoUser({
        id: numericId,
        firebaseUid: firebaseUid,
        email: req.session!.email,
        username: `user_${Math.random().toString(36).substring(7)}`,
        name: displayName || req.session!.email?.split("@")[0] || "User",
        displayName: displayName || null,
        class: className || null,
        subject: subject || null,
        role: role || "student",
        school_code: school_code || null,
        grade: grade || null,
        board: board || null,
        subjects: subjects || [],
        district: district || null,
        status: status || (role === "student" ? "active" : "pending"),
        password: "firebase_managed",
      });
      await user.save();
    }

    // Set custom claims in Firebase
    try {
      await setCustomUserClaims(firebaseUid, {
        role: user.role,
        status: user.status,
      });
      logger.info(`[auth/sync-profile] Set custom claims`, {
        role: user.role,
        status: user.status,
      });
    } catch (claimErr) {
      console.error("[auth/sync-profile] Failed to set custom claims:", claimErr);
    }

    res.json({ message: "Profile synced", user });
  } catch {
    return res.status(500).json({ message: "Failed to sync profile" });
  }
});

// Email/Password Login (for seeded test accounts — bypasses Firebase)
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await MongoUser.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Issue JWT
    const accessToken = jwt.sign(
      { userId: user.id, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Set session
    if (req.session) {
      req.session.userId = user.id;
      req.session.role = user.role;
    }

    // Set cookie
    res.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      token: accessToken,
      userId: user.id,
      displayName: user.displayName || user.name,
      role: user.role,
      email: user.email,
      avatar: user.avatar,
    });
  } catch (err) {
    console.error("[auth/login] Error:", err);
    return res.status(500).json({ message: "Login failed" });
  }
});

// GET /me - Get current user from JWT (for test users)
router.get("/me", async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.access_token || req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Not authenticated" });

    let userId: number | null = null;

    // Try JWT first
    try {
      const payload = jwt.verify(token, JWT_SECRET) as CustomJwtPayload;
      userId = payload?.userId ?? null;
    } catch {
      // Try Firebase
      const decoded = await verifyFirebaseToken(token);
      if (decoded) {
        const user = await MongoUser.findOne({ firebaseUid: decoded.uid });
        userId = user?.id ?? null;
      }
    }

    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const user = await MongoUser.findOne({ id: userId });
    if (!user) return res.status(404).json({ message: "User not found" });

    const safeUser = user.toObject();
    delete (safeUser as { password?: string }).password;
    return res.status(200).json(safeUser);
  } catch {
    return res.status(500).json({ message: "Failed to get current user" });
  }
});

// POST /register - Backend-only registration (when Firebase email/password is disabled)
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { name, email, password, role, class: className } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Invalid email address" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await MongoUser.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const numericId = await getNextSequenceValue("userId");

    const newUser = new MongoUser({
      id: numericId,
      username: `${normalizedEmail.split("@")[0]}_${numericId}`,
      password: passwordHash,
      name,
      email: normalizedEmail,
      role: role || "student",
      displayName: name,
      class: className || null,
      status: role === "teacher" ? "pending" : "active",
    });
    await newUser.save();

    const accessToken = jwt.sign(
      { userId: numericId, role: newUser.role, email: normalizedEmail },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    if (req.session) {
      req.session.userId = numericId;
      req.session.role = newUser.role;
    }

    res.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    logger.info(`[auth/register] Created new user`, { id: numericId, role: newUser.role });

    return res.status(201).json({
      token: accessToken,
      userId: numericId,
      displayName: newUser.displayName || newUser.name,
      role: newUser.role,
      email: newUser.email,
    });
  } catch (err) {
    console.error("[auth/register] Error:", err);
    return res.status(500).json({ message: "Registration failed" });
  }
});

// POST /firebase
// Client sends { idToken } after Firebase login. We verify with firebase-admin,
// then find-or-create a MongoDB user and establish an Express session.
router.post("/firebase", async (req: Request, res: Response) => {
  try {
    const { idToken, role } = req.body;
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

    // Find by firebaseUid or email
    type MongoUserType = {
      id: number;
      role: string;
      avatar: string | null;
      displayName: string | null;
      name: string;
      firebaseUid?: string;
      save: () => Promise<void>;
    };
    type MongoUserModelType = {
      findOne: (query: Record<string, unknown>) => Promise<MongoUserType | null>;
      new (data: Record<string, unknown>): MongoUserType;
    };
    let mongoUser: MongoUserType | null = await (
      MongoUser as unknown as MongoUserModelType
    ).findOne({ firebaseUid: uid });
    if (!mongoUser)
      mongoUser = await (MongoUser as unknown as MongoUserModelType).findOne({ email });

    if (!mongoUser) {
      const id = await getNextSequenceValue("user_id");
      mongoUser = new (MongoUser as unknown as MongoUserModelType)({
        id,
        username: email.split("@")[0] + "_" + id,
        password: "firebase-" + uid,
        name: name || email.split("@")[0],
        email,
        role: role || "student",
        avatar: picture || null,
        firebaseUid: uid,
        displayName: name || null,
        status: role === "teacher" ? "pending" : "active",
      });
      await mongoUser.save();
      logger.info(`[auth/firebase] Created new user`, { id, role: mongoUser.role });
    } else if (!mongoUser.firebaseUid) {
      mongoUser.firebaseUid = uid;
      if (picture && !mongoUser.avatar) mongoUser.avatar = picture;
      await mongoUser.save();
    }

    if (req.session) {
      req.session.userId = mongoUser.id;
      req.session.role = mongoUser.role;
    }

    return res.status(200).json({
      userId: mongoUser.id,
      displayName: mongoUser.displayName || mongoUser.name,
      role: mongoUser.role,
      avatar: mongoUser.avatar,
    });
  } catch (error) {
    console.error("[auth/firebase] Error:", error);
    return res.status(500).json({ message: "Failed to authenticate with Firebase" });
  }
});

export default router;
