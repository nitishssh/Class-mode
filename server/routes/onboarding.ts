import { Router, Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import admin from "firebase-admin";
import { setCustomUserClaims } from "../lib/firebase-admin";
import { authenticateToken } from "../routes";
import { upload, diskPathToUrl } from "../lib/upload";
import {
  sendTeacherInvite,
  sendStudentInvite,
  sendPrincipalInvite,
  sendSchoolAdminInvite,
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
  pgFindUserByAuthSubject,
  pgCreateUser,
  pgUpdateUser,
  pgUpsertMembership,
  pgUpdateUserOnboardingComplete,
} from "../lib/pg-queries";

const router = Router();

// ─── helpers ──────────────────────────────────────────────────────────────────

function firebaseUid(req: Request): string {
  return (req.session as any).firebaseUid as string;
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
  const pgUser = await pgFindUserByAuthSubject("firebase", uid);
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

// ─── STAGE 2: Admin invites teachers ─────────────────────────────────────────

const teacherInviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  grades: z.array(z.string()).min(1),
});

// POST /api/invite/teacher
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

// GET /api/invite/teacher/list
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

// POST /api/invite/accept
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

  // Create Firebase Auth user
  const fbUser = await admin.auth().createUser({
    email: invite.email,
    password: parsed.data.password,
    displayName: parsed.data.displayName,
  });

  await setCustomUserClaims(fbUser.uid, { role: invite.role, status: "active" });

  // Create PG user
  const pgUser = await pgCreateUser({
    authProvider: "firebase",
    authSubject: fbUser.uid,
    email: invite.email,
    username: `${invite.email.split("@")[0]}_${Date.now()}`,
    passwordHash: "firebase_managed",
    name: parsed.data.displayName,
    displayName: parsed.data.displayName,
    role: invite.role,
    status: "active",
    schoolCode: null,
  });

  // Link membership
  if (invite.schoolId) {
    const school = await pgFindSchoolById(invite.schoolId);
    if (school) {
      await pgUpsertMembership({
        userId: pgUser.id,
        schoolCode: school.code,
        status: "active",
        roleKey: invite.role,
      });
    }
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
    uid: fbUser.uid,
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

  const user = await pgFindUserByAuthSubject("firebase", uid);
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

// POST /api/invite/student
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

// GET /api/invite/student/list?classId=
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

// POST /api/invite/resend/:inviteId
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

// GET /api/invite/validate/:token  (used by accept-invite page to pre-fill info)
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

// POST /api/invite/staff
router.post(
  "/invite/staff",
  authenticateToken,
  requireRole("school_admin", "admin"),
  async (req: Request, res: Response) => {
    const uid = firebaseUid(req);
    const actorRole = (req.session as any).role as string;
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

// POST /api/invite/platform-admin
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
