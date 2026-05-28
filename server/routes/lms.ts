import { Router, Request, Response } from "express";
import crypto from "crypto";
import {
  pgCreateLmsConnection,
  pgFindLmsConnection,
  pgCreateUser,
  pgFindUserByEmail,
  pgFindFirstWorkspaceMembership,
  pgUpsertWorkspaceMembership,
} from "../lib/pg-queries";
import { authenticateToken } from "../routes";
import {
  getAuthUrl,
  exchangeCode,
  listCourses,
  listStudents,
  isGoogleClassroomConfigured,
  GoogleClassroomNotConnectedError,
  GoogleClassroomReauthRequiredError,
} from "../lib/lms/googleClassroom";
import { logger } from "../lib/logger";

const router = Router();

// ─── Connection status ─────────────────────────────────────────────────────
router.get("/google/status", authenticateToken, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const conn = await pgFindLmsConnection(user.id, "google_classroom");
  res.json({
    configured: isGoogleClassroomConfigured(),
    connected: !!conn,
    connectedAt: conn?.createdAt ?? null,
  });
});

// ─── OAuth: start ──────────────────────────────────────────────────────────
router.get("/google/auth", authenticateToken, async (req: Request, res: Response) => {
  if (!isGoogleClassroomConfigured()) {
    return res.status(503).json({
      message: "Google Classroom OAuth is not configured on this server.",
    });
  }
  const user = (req as any).user;
  const state = crypto.randomBytes(32).toString("hex");
  req.session.oauthState = state;
  req.session.lmsOauthUserId = user.id;
  await new Promise<void>((resolve, reject) =>
    req.session.save((err) => (err ? reject(err) : resolve()))
  );
  const url = getAuthUrl(state);
  res.redirect(url);
});

// ─── OAuth: callback ───────────────────────────────────────────────────────
router.get("/google/callback", async (req: Request, res: Response) => {
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;

  if (!code || !state) return res.status(400).send("Missing code or state");
  if (!req.session.oauthState || req.session.oauthState !== state) {
    return res.status(403).send("Invalid OAuth state — possible CSRF attack");
  }
  const userId = req.session.lmsOauthUserId;
  if (!userId) return res.status(403).send("No authenticated user in session");

  delete req.session.oauthState;
  delete req.session.lmsOauthUserId;

  try {
    const tokens = await exchangeCode(code);
    if (!tokens.accessToken) {
      return res.status(500).send("Google did not return an access token");
    }
    await pgCreateLmsConnection({
      userId,
      provider: "google_classroom",
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? null,
      tokenExpiry: tokens.expiryDate ? new Date(tokens.expiryDate) : null,
    });
    // Redirect to the integrations page on the client side
    res.redirect("/integrations/google-classroom?connected=true");
  } catch (err) {
    logger.error("[lms/google/callback] OAuth exchange failed", { error: String(err) });
    res.redirect("/integrations/google-classroom?error=oauth_failed");
  }
});

// ─── List the connected user's Classroom courses ───────────────────────────
router.get("/google/courses", authenticateToken, async (req: Request, res: Response) => {
  const user = (req as any).user;
  try {
    const courses = await listCourses(user.id);
    res.json({ courses });
  } catch (err) {
    return handleClassroomError(err, res);
  }
});

// ─── Preview a course roster (no writes) ───────────────────────────────────
router.get("/google/courses/:courseId/students", authenticateToken, async (req: Request, res: Response) => {
  const user = (req as any).user;
  try {
    const students = await listStudents(user.id, req.params.courseId);
    res.json({ students });
  } catch (err) {
    return handleClassroomError(err, res);
  }
});

// ─── Import a course's roster into the caller's active workspace ───────────
// Killer feature: pull every student from a Classroom course → create User +
// WorkspaceMembership rows so they show up in Class Mode immediately.
router.post("/google/courses/:courseId/import", authenticateToken, async (req: Request, res: Response) => {
  const user = (req as any).user;

  // The importing user must already belong to a workspace (their own, as the
  // owner of the workspace created at signup, in the common case).
  const wsContext = await pgFindFirstWorkspaceMembership(user.id);
  if (!wsContext) {
    return res.status(409).json({ message: "No active workspace for this user." });
  }
  const workspaceId = wsContext.workspace.id;

  let students;
  try {
    students = await listStudents(user.id, req.params.courseId);
  } catch (err) {
    return handleClassroomError(err, res);
  }

  let created = 0;
  let existing = 0;
  let skipped = 0;
  const failures: Array<{ email: string | null; reason: string }> = [];

  for (const s of students) {
    if (!s.email) {
      skipped++;
      failures.push({ email: null, reason: "no_email" });
      continue;
    }
    try {
      let pgUser = await pgFindUserByEmail(s.email);
      if (!pgUser) {
        pgUser = await pgCreateUser({
          authProvider: "google_classroom",
          authSubject: s.userId,
          email: s.email,
          username: `${s.email.split("@")[0]}_${Date.now()}`,
          // Imported users sign in via Google. Placeholder hash blocks
          // local password login until they reset their password.
          passwordHash: `gclassroom_imported_${s.userId}`,
          name: s.fullName,
          displayName: s.fullName,
          avatar: s.photoUrl ?? null,
          emailVerified: true, // Google vouched for the email
          role: "student",
          status: "active",
        });
        created++;
      } else {
        existing++;
      }
      await pgUpsertWorkspaceMembership({
        workspaceId,
        userId: pgUser.id,
        role: "member",
      });
    } catch (err) {
      failures.push({ email: s.email, reason: String(err) });
    }
  }

  res.json({
    courseId: req.params.courseId,
    workspaceId,
    totalStudents: students.length,
    created,
    existing,
    skipped,
    failures,
  });
});

// ─── Helpers ───────────────────────────────────────────────────────────────
function handleClassroomError(err: unknown, res: Response) {
  if (err instanceof GoogleClassroomNotConnectedError) {
    return res.status(409).json({ message: err.message, code: "not_connected" });
  }
  if (err instanceof GoogleClassroomReauthRequiredError) {
    return res.status(401).json({ message: err.message, code: "reauth_required" });
  }
  logger.error("[lms/google] API call failed", { error: String(err) });
  return res.status(502).json({ message: "Google Classroom API call failed" });
}

export default router;
