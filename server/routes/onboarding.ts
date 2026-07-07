import { Router, Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { authenticateToken } from "../middleware";
import { upload, diskPathToUrl } from "../lib/upload";
import { logger } from "../lib/logger";
import {
  sendTeacherInvite,
  sendStudentInvite,
  sendPrincipalInvite,
  sendSchoolAdminInvite,
  sendWelcomeEmail,
} from "../lib/mailer";
import { requireRole } from "../middleware";
import { recordAuditEvent, AUDIT_EVENTS } from "../lib/audit";
import {
  pgFindSchoolByCreatedByUid,
  pgUpsertSchool,
  pgFindSchoolById,
  pgCreateInvite,
  pgFindInviteByToken,
  pgAcceptInvite,
  pgResendInvite,
  pgFindInviteById,
  pgFindInvitesBySchool,
  pgFindInvitesByInvitedBy,
  pgCreateSchoolClass,
  pgFindSchoolClassesByTeacher,
  pgFindSchoolClassById,
  pgFindUserById,
  pgFindUserByEmail,
  pgCreateUser,
  pgUpdateUser,
  pgUpsertMembership,
  pgUpdateUserOnboardingComplete,
  pgSaveOnboardingResponse,
  pgUpdateUserSubjects,
} from "../lib/pg-queries";
import { getPgPool } from "../db-pg";

const router = Router();

// ─── helpers ──────────────────────────────────────────────────────────────────

// Legacy stable identity key used to key schools/classes (created_by_uid,
// teacher_firebase_uid). The auth middleware populates session.firebaseUid
// with `user.firebaseUid || user.authSubject`, so for local-password users
// this resolves to their authSubject (email) — keeping schools/classes keyed
// consistently per user regardless of auth provider.
function firebaseUid(req: Request): string {
  const sessionUid = req.session ? (req.session as any).firebaseUid : null;
  const userUid = (req as any).user?.firebaseUid || (req as any).user?.authSubject;
  return (sessionUid || userUid) as string;
}

// The authenticated numeric user id, populated by authenticateToken. This is
// the provider-agnostic way to resolve the current user (works for local,
// Google, and legacy Firebase accounts alike).
function currentUserId(req: Request): number | undefined {
  return (req as any).user?.id;
}

function sevenDaysFromNow() {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

// ─── STAGE 1: School setup ────────────────────────────────────────────────────

const schoolSetupSchema = z.object({
  name: z.string().min(2),
  city: z.string().min(2),
  board: z.enum(["CBSE", "ICSE", "State", "IB", "Other"]),
  gradesOffered: z.array(z.string()).min(1, "Select at least one grade"),
});

// POST /api/school/setup
router.post("/school/setup", authenticateToken, async (req: Request, res: Response) => {
  const uid = firebaseUid(req);
  const parsed = schoolSetupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const existing = await pgFindSchoolByCreatedByUid(uid);
  if (existing && existing.onboardingComplete) {
    return res.status(409).json({ message: "School already set up" });
  }

  const school = await pgUpsertSchool({
    uid,
    name: parsed.data.name,
    city: parsed.data.city,
    board: parsed.data.board,
    gradesOffered: parsed.data.gradesOffered,
    onboardingComplete: true,
  });

  // Link school to user
  const pgUser = await pgFindUserById(currentUserId(req) ?? 0);
  if (pgUser) await pgUpdateUser(pgUser.id, { schoolId: school.id });

  return res.status(200).json(school);
});

// POST /api/school/logo  (multipart)
router.post(
  "/school/logo",
  authenticateToken,
  upload.single("logo"),
  async (req: Request, res: Response) => {
    const uid = firebaseUid(req);
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const url = diskPathToUrl(req.file.path);
    await pgUpsertSchool({ uid, name: "", logo: url });
    return res.json({ url });
  }
);

// GET /api/school/me
router.get("/school/me", authenticateToken, async (req: Request, res: Response) => {
  const uid = firebaseUid(req);
  const school = await pgFindSchoolByCreatedByUid(uid);
  if (!school) return res.status(404).json({ message: "School not found" });
  return res.json(school);
});

// ─── STAGE 1b: Full Onboarding Completion (V2) ───────────────────────────────

const onboardingCompleteSchema = z.object({
  role: z.enum(["principal", "teacher", "school_admin"]),
  userType: z.string().optional(),
  school: z.object({
    name: z.string().min(2),
    city: z.string().min(2),
    board: z.enum(["CBSE", "ICSE", "State", "IB", "Other"]),
    gradesOffered: z.array(z.string()).min(1),
    approximateStudents: z.enum(["1-50", "50-200", "200-500", "500+"]),
  }),
  user: z.object({
    subjects: z.array(z.string()).min(1),
  }),
  businessIntel: z
    .object({
      currentTools: z.array(z.string()).optional(),
      discoverySource: z.string().optional(),
    })
    .optional(),
});

// POST /api/onboarding/complete
router.post("/complete", authenticateToken, async (req: Request, res: Response) => {
  try {
    const uid = firebaseUid(req);
    const parsed = onboardingCompleteSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

    const { role, userType, school, user, businessIntel } = parsed.data;

    // 1. Resolve PG User
    const pgUser = await pgFindUserById(currentUserId(req) ?? 0);
    if (!pgUser) return res.status(404).json({ message: "User not found" });

    if (pgUser.onboardingComplete) {
      return res.status(409).json({ message: "Onboarding already complete" });
    }

    // 2. Validate role constraints strictly.
    // We've already returned above if onboarding is complete, so this is the
    // user's FIRST onboarding. Allow them to pick their role only if they're
    // starting from a "default" role: self-signup workspace creators land as
    // school_admin (legacy accounts may be admin). Students are NOT in this set —
    // an invited student must never be able to self-select a staff role
    // (principal/teacher/school_admin) during onboarding. This also blocks an
    // already-assigned/invited teacher from escalating.
    const CHANGEABLE_DEFAULT_ROLES = new Set(["school_admin", "admin"]);
    if (pgUser.role !== role && !CHANGEABLE_DEFAULT_ROLES.has(pgUser.role)) {
      return res.status(403).json({ message: "Cannot change role during onboarding" });
    }

    // Update user role and type
    await pgUpdateUser(pgUser.id, { role, userType: userType ?? role });

    // 3. Update or Create School
    const pgSchool = await pgUpsertSchool({
      uid,
      name: school.name,
      city: school.city,
      board: school.board,
      gradesOffered: school.gradesOffered,
      approximateStudents: school.approximateStudents,
      onboardingComplete: true,
    });

    // Link school to user. schoolCode is what resolveTenantScope authorizes on —
    // linking by schoolId alone leaves the account locked out of every
    // tenant-scoped route (attendance, fees, students).
    await pgUpdateUser(pgUser.id, { schoolId: pgSchool.id, schoolCode: pgSchool.code });

    // 4. Update user subjects
    await pgUpdateUserSubjects(pgUser.id, user.subjects);

    // 5. Store Business Intel
    if (businessIntel?.currentTools) {
      await pgSaveOnboardingResponse(pgUser.id, "current_tools", businessIntel.currentTools);
    }
    if (businessIntel?.discoverySource) {
      await pgSaveOnboardingResponse(pgUser.id, "discovery_source", businessIntel.discoverySource);
    }

    // 6. Complete onboarding flag
    await pgUpdateUserOnboardingComplete(pgUser.id);

    // 7. Create workspace
    const workspaceName = pgSchool.name;
    let workspaceId: number | null = null;
    const pool = getPgPool();

    try {
      const wsRes = await pool.query(
        `INSERT INTO workspaces (name, type, owner_id) VALUES ($1, 'school', $2) RETURNING id`,
        [workspaceName, pgUser.id]
      );
      workspaceId = parseInt(wsRes.rows[0].id, 10);

      // Add owner membership
      await pool.query(
        `INSERT INTO workspace_memberships (workspace_id, user_id, role, status) VALUES ($1, $2, 'owner', 'active')`,
        [workspaceId, pgUser.id]
      );

      // Update user's last active workspace
      await pgUpdateUser(pgUser.id, { lastActiveWorkspaceId: workspaceId });
    } catch (err) {
      logger.error("[onboarding] Failed to create workspace", { error: String(err) });
    }

    return res.status(200).json({ success: true, workspaceId, schoolId: pgSchool.id });
  } catch (err) {
    // Without this, an async throw (e.g. schema drift in pgUpsertSchool) becomes
    // an unhandledRejection and the request hangs forever on "Completing setup…".
    logger.error("[onboarding] /complete failed", { error: String(err) });
    return res
      .status(500)
      .json({ message: "Onboarding could not be completed. Please try again." });
  }
});

// ─── STAGE 2: Admin invites teachers ─────────────────────────────────────────

const teacherInviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  grades: z.array(z.string()).min(1),
});

// POST /api/onboarding/invite/teacher
router.post("/invite/teacher", authenticateToken, async (req: Request, res: Response) => {
  const uid = firebaseUid(req);
  const parsed = teacherInviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const school = await pgFindSchoolByCreatedByUid(uid);
  if (!school) return res.status(404).json({ message: "Complete school setup first" });

  const token = crypto.randomUUID();
  const invite = await pgCreateInvite({
    email: parsed.data.email,
    name: parsed.data.name,
    role: "teacher",
    schoolId: school.id,
    grades: parsed.data.grades,
    token,
    invitedBy: uid,
    expiresAt: sevenDaysFromNow(),
  });

  await sendTeacherInvite(parsed.data.email, parsed.data.name, school.name, token);
  recordAuditEvent({
    eventType: AUDIT_EVENTS.INVITE_SENT,
    payload: { email: parsed.data.email, role: "teacher", schoolId: school.id },
  });
  return res.status(201).json({ id: invite.id, status: invite.status });
});

// GET /api/onboarding/invite/teacher/list
router.get("/invite/teacher/list", authenticateToken, async (req: Request, res: Response) => {
  const uid = firebaseUid(req);
  const school = await pgFindSchoolByCreatedByUid(uid);
  if (!school) return res.status(404).json({ message: "School not found" });

  const invites = await pgFindInvitesBySchool(school.id, "teacher");
  return res.json(invites);
});

// ─── STAGE 3: Accept teacher invite ──────────────────────────────────────────

const acceptInviteSchema = z.object({
  token: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().min(1),
  password: z.string().min(6),
});

// POST /api/onboarding/invite/accept
router.post("/invite/accept", async (req: Request, res: Response) => {
  const parsed = acceptInviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const invite = await pgFindInviteByToken(parsed.data.token);
  if (!invite) return res.status(404).json({ message: "Invalid invite link" });
  if (invite.status !== "pending") return res.status(409).json({ message: "Invite already used" });
  if (invite.expiresAt < new Date())
    return res
      .status(410)
      .json({ message: "This invite has expired. Ask your admin to resend it." });

  if (parsed.data.email.toLowerCase().trim() !== invite.email.toLowerCase().trim()) {
    return res.status(403).json({ message: "This invite was sent to a different email address." });
  }

  // Resolve the school (and, for student invites, the class) up front so the
  // new/updated account is scoped from the moment it exists — previously only
  // pgUpsertMembership below recorded this link, leaving users.school_code and
  // users.class_name null forever. A null school_code makes resolveTenantScope
  // fail closed on every tenant-scoped route (attendance, fees, student
  // directory), and a null class_name hides the student from their class's
  // attendance roster (pgGetClassNames / GET /roster both filter on it).
  const school = invite.schoolId ? await pgFindSchoolById(invite.schoolId) : null;
  const cls = invite.classId ? await pgFindSchoolClassById(parseInt(invite.classId, 10)) : null;

  // Create (or update) a local-password account. The password is hashed and
  // stored in Postgres so the user can sign in via the standard local login —
  // previously this minted a Firebase user with the PG passwordHash set to the
  // literal "firebase_managed", which made local login impossible. Email
  // ownership is already proven by clicking the invite link, so mark verified.
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  let pgUser = await pgFindUserByEmail(invite.email);
  if (pgUser) {
    await pgUpdateUser(pgUser.id, {
      passwordHash,
      displayName: parsed.data.displayName,
      role: invite.role,
      status: "active",
      emailVerified: true,
      schoolCode: school?.code ?? null,
      className: cls?.name ?? null,
    });
    pgUser = (await pgFindUserById(pgUser.id)) ?? pgUser;
  } else {
    pgUser = await pgCreateUser({
      authProvider: "local",
      authSubject: invite.email,
      email: invite.email,
      username: `${invite.email.split("@")[0]}_${Date.now()}`,
      passwordHash,
      name: parsed.data.displayName,
      displayName: parsed.data.displayName,
      role: invite.role,
      status: "active",
      emailVerified: true,
      schoolCode: school?.code ?? null,
      className: cls?.name ?? null,
    });
  }

  sendWelcomeEmail(pgUser.email, pgUser.displayName || pgUser.name).catch((e) =>
    logger.warn("[invite/accept] Failed to send welcome email", { error: String(e) })
  );

  // Link membership
  if (school) {
    await pgUpsertMembership({
      userId: pgUser.id,
      schoolCode: school.code,
      status: "active",
      roleKey: invite.role,
    });
  }

  await pgAcceptInvite(parsed.data.token);

  const onboardingComplete = invite.role === "student";
  if (onboardingComplete) await pgUpdateUserOnboardingComplete(pgUser.id);

  recordAuditEvent({
    targetUserId: pgUser.id,
    eventType: AUDIT_EVENTS.INVITE_ACCEPTED,
    payload: { role: invite.role, schoolId: invite.schoolId },
  });

  return res.status(201).json({
    uid: pgUser.authSubject,
    userId: pgUser.id,
    role: invite.role,
    onboardingComplete,
  });
});

// ─── STAGE 3b: Teacher creates classes ───────────────────────────────────────

const classSchema = z.object({
  name: z.string().min(1),
  grade: z.string().min(1),
});

// POST /api/classes
router.post("/classes", authenticateToken, async (req: Request, res: Response) => {
  const uid = firebaseUid(req);
  const parsed = classSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const user = await pgFindUserById(currentUserId(req) ?? 0);
  if (!user?.schoolId) return res.status(400).json({ message: "Not linked to a school" });

  const cls = await pgCreateSchoolClass({
    name: parsed.data.name,
    grade: parsed.data.grade,
    teacherFirebaseUid: uid,
    schoolId: user.schoolId,
  });

  if (!user.onboardingComplete) await pgUpdateUserOnboardingComplete(user.id);

  return res.status(201).json(cls);
});

// GET /api/classes/mine
router.get("/classes/mine", authenticateToken, async (req: Request, res: Response) => {
  const uid = firebaseUid(req);
  const classes = await pgFindSchoolClassesByTeacher(uid);
  return res.json(classes);
});

// ─── STAGE 4: Teacher invites students ───────────────────────────────────────

const studentInviteSchema = z.object({
  studentName: z.string().min(1),
  parentEmail: z.string().email(),
  grade: z.string().min(1),
  classId: z.string().min(1),
});

// POST /api/onboarding/invite/student
router.post("/invite/student", authenticateToken, async (req: Request, res: Response) => {
  const uid = firebaseUid(req);
  const parsed = studentInviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const cls = await pgFindSchoolClassById(parseInt(parsed.data.classId, 10));
  if (!cls || cls.teacherFirebaseUid !== uid) {
    return res.status(403).json({ message: "Class not found or not yours" });
  }

  const token = crypto.randomUUID();
  const invite = await pgCreateInvite({
    email: parsed.data.parentEmail,
    name: parsed.data.studentName,
    role: "student",
    schoolId: cls.schoolId,
    classId: String(cls.id),
    grades: [parsed.data.grade],
    token,
    invitedBy: uid,
    expiresAt: sevenDaysFromNow(),
  });

  const school = cls.schoolId ? await pgFindSchoolById(cls.schoolId) : null;
  await sendStudentInvite(
    parsed.data.parentEmail,
    parsed.data.studentName,
    school?.name ?? "your school",
    cls.name,
    token
  );

  recordAuditEvent({
    eventType: AUDIT_EVENTS.INVITE_SENT,
    payload: { email: parsed.data.parentEmail, role: "student", classId: parsed.data.classId },
  });
  return res.status(201).json({ id: invite.id, status: invite.status });
});

// GET /api/onboarding/invite/student/list?classId=
router.get("/invite/student/list", authenticateToken, async (req: Request, res: Response) => {
  const uid = firebaseUid(req);
  const { classId } = req.query;
  const invites = await pgFindInvitesByInvitedBy(uid, {
    role: "student",
    classId: classId as string | undefined,
  });
  return res.json(invites);
});

// ─── Resend invite ────────────────────────────────────────────────────────────

// POST /api/onboarding/invite/resend/:inviteId
router.post("/invite/resend/:inviteId", authenticateToken, async (req: Request, res: Response) => {
  const uid = firebaseUid(req);
  const invite = await pgFindInviteById(parseInt(req.params.inviteId, 10));
  if (!invite) return res.status(404).json({ message: "Invite not found" });
  if (invite.invitedBy !== uid) return res.status(403).json({ message: "Forbidden" });
  if (invite.status === "accepted") return res.status(409).json({ message: "Already accepted" });

  const newToken = crypto.randomUUID();
  const newExpiry = sevenDaysFromNow();
  await pgResendInvite(invite.id, newToken, newExpiry);

  const school = invite.schoolId ? await pgFindSchoolById(invite.schoolId) : null;
  if (invite.role === "teacher") {
    await sendTeacherInvite(invite.email, invite.name ?? "", school?.name ?? "", newToken);
  } else {
    const cls = invite.classId ? await pgFindSchoolClassById(parseInt(invite.classId, 10)) : null;
    await sendStudentInvite(
      invite.email,
      invite.name ?? "",
      school?.name ?? "",
      cls?.name ?? "",
      newToken
    );
  }

  recordAuditEvent({
    eventType: AUDIT_EVENTS.INVITE_RESENT,
    payload: { inviteId: invite.id, role: invite.role },
  });
  return res.json({ message: "Invite resent" });
});

// GET /api/onboarding/invite/validate/:token  (used by accept-invite page to pre-fill info)
router.get("/invite/validate/:token", async (req: Request, res: Response) => {
  const invite = await pgFindInviteByToken(req.params.token);
  if (!invite) return res.status(404).json({ message: "Invalid invite link" });
  if (invite.status !== "pending") return res.status(409).json({ message: "Invite already used" });
  if (invite.expiresAt < new Date())
    return res
      .status(410)
      .json({ message: "This invite has expired. Ask your admin to resend it." });
  return res.json({
    name: invite.name,
    email: invite.email,
    role: invite.role,
    grades: invite.grades,
  });
});

// ─── Staff invite (principal / school_admin) ──────────────────────────────────
// school_admin can invite teacher or principal; admin can invite any staff role.

const staffInviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["teacher", "principal", "school_admin"]),
  grades: z.array(z.string()).optional(),
});

// POST /api/onboarding/invite/staff
router.post(
  "/invite/staff",
  authenticateToken,
  requireRole("school_admin", "admin"),
  async (req: Request, res: Response) => {
    const uid = firebaseUid(req);
    const actorRole = ((req as any).user?.role || (req.session as any)?.role) as string;
    const parsed = staffInviteSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

    // school_admin cannot invite another school_admin — only platform admin can
    if (actorRole === "school_admin" && parsed.data.role === "school_admin") {
      return res
        .status(403)
        .json({ message: "Only a platform admin can invite school administrators." });
    }

    const school = await pgFindSchoolByCreatedByUid(uid);
    if (!school) return res.status(404).json({ message: "Complete school setup first" });

    const token = crypto.randomUUID();
    const invite = await pgCreateInvite({
      email: parsed.data.email,
      name: parsed.data.name,
      role: parsed.data.role,
      schoolId: school.id,
      grades: parsed.data.grades ?? [],
      token,
      invitedBy: uid,
      expiresAt: sevenDaysFromNow(),
    });

    if (parsed.data.role === "principal") {
      await sendPrincipalInvite(parsed.data.email, parsed.data.name, school.name, token);
    } else if (parsed.data.role === "school_admin") {
      await sendSchoolAdminInvite(parsed.data.email, parsed.data.name, school.name, token);
    } else {
      await sendTeacherInvite(parsed.data.email, parsed.data.name, school.name, token);
    }

    recordAuditEvent({
      eventType: AUDIT_EVENTS.INVITE_SENT,
      payload: { email: parsed.data.email, role: parsed.data.role, schoolId: school.id },
    });

    return res.status(201).json({ id: invite.id, status: invite.status });
  }
);

// ─── Platform admin invite ────────────────────────────────────────────────────
// Only platform admin can create another admin account.

const platformAdminInviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

// POST /api/onboarding/invite/platform-admin
router.post(
  "/invite/platform-admin",
  authenticateToken,
  requireRole("admin"),
  async (req: Request, res: Response) => {
    const uid = firebaseUid(req);
    const parsed = platformAdminInviteSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

    const token = crypto.randomUUID();
    const invite = await pgCreateInvite({
      email: parsed.data.email,
      name: parsed.data.name,
      role: "admin",
      schoolId: null,
      grades: [],
      token,
      invitedBy: uid,
      expiresAt: sevenDaysFromNow(),
    });

    await sendSchoolAdminInvite(parsed.data.email, parsed.data.name, "Class Mode Platform", token);

    recordAuditEvent({
      eventType: AUDIT_EVENTS.INVITE_SENT,
      payload: { email: parsed.data.email, role: "admin" },
    });

    return res.status(201).json({ id: invite.id, status: invite.status });
  }
);

export default router;
