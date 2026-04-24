import { Router, Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import admin from "firebase-admin";
import { School, Invite, SchoolClass } from "@shared/onboarding-schema";
import { MongoUser } from "@shared/mongo-schema";
import { authenticateToken } from "../routes";
import { upload, diskPathToUrl } from "../lib/upload";
import { sendTeacherInvite, sendStudentInvite } from "../lib/mailer";

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

  const existing = await School.findOne({ createdBy: uid });
  if (existing && existing.onboardingComplete) {
    return res.status(409).json({ message: "School already set up" });
  }

  const school = existing
    ? Object.assign(existing, parsed.data)
    : new School({ ...parsed.data, createdBy: uid });

  school.onboardingComplete = true;
  await school.save();

  // Persist schoolId on the admin's MongoUser
  await MongoUser.findOneAndUpdate({ firebaseUid: uid }, { schoolId: school._id });

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
    await School.findOneAndUpdate({ createdBy: uid }, { logo: url });
    return res.json({ url });
  }
);

// GET /api/school/me
router.get("/school/me", authenticateToken, async (req: Request, res: Response) => {
  const uid = firebaseUid(req);
  const school = await School.findOne({ createdBy: uid });
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

  const school = await School.findOne({ createdBy: uid });
  if (!school) return res.status(404).json({ message: "Complete school setup first" });

  const token = crypto.randomUUID();
  const invite = await Invite.create({
    email: parsed.data.email,
    name: parsed.data.name,
    role: "teacher",
    schoolId: school._id,
    grades: parsed.data.grades,
    token,
    invitedBy: uid,
    expiresAt: sevenDaysFromNow(),
  });

  await sendTeacherInvite(parsed.data.email, parsed.data.name, school.name, token);
  return res.status(201).json({ id: invite._id, status: invite.status });
});

// GET /api/invite/teacher/list
router.get("/invite/teacher/list", authenticateToken, async (req: Request, res: Response) => {
  const uid = firebaseUid(req);
  const school = await School.findOne({ createdBy: uid });
  if (!school) return res.status(404).json({ message: "School not found" });

  const invites = await Invite.find({ schoolId: school._id, role: "teacher" }).select("-token");
  return res.json(invites);
});

// ─── STAGE 3: Accept teacher invite ──────────────────────────────────────────

const acceptInviteSchema = z.object({
  token: z.string().uuid(),
  displayName: z.string().min(1),
  password: z.string().min(6),
});

// POST /api/invite/accept
router.post("/invite/accept", async (req: Request, res: Response) => {
  const parsed = acceptInviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  const invite = await Invite.findOne({ token: parsed.data.token });
  if (!invite) return res.status(404).json({ message: "Invalid invite link" });
  if (invite.status !== "pending") return res.status(409).json({ message: "Invite already used" });
  if (invite.expiresAt < new Date())
    return res
      .status(410)
      .json({ message: "This invite has expired. Ask your admin to resend it." });

  // Create Firebase Auth user
  const fbUser = await admin.auth().createUser({
    email: invite.email,
    password: parsed.data.password,
    displayName: parsed.data.displayName,
  });

  // Set custom claim for role
  await admin.auth().setCustomUserClaims(fbUser.uid, { role: invite.role });

  // Create MongoDB user
  const mongoUser = await MongoUser.create({
    firebaseUid: fbUser.uid,
    email: invite.email,
    username: invite.email.split("@")[0],
    name: parsed.data.displayName,
    displayName: parsed.data.displayName,
    password: "firebase_managed",
    role: invite.role,
    status: "active",
    schoolId: invite.schoolId,
    onboardingComplete: invite.role === "student", // students are done immediately
  });

  // Mark invite accepted
  invite.status = "accepted";
  await invite.save();

  return res.status(201).json({
    uid: fbUser.uid,
    role: invite.role,
    onboardingComplete: mongoUser.onboardingComplete,
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

  const user = await MongoUser.findOne({ firebaseUid: uid });
  if (!user?.schoolId) return res.status(400).json({ message: "Not linked to a school" });

  const cls = await SchoolClass.create({
    name: parsed.data.name,
    grade: parsed.data.grade,
    teacherFirebaseUid: uid,
    schoolId: user.schoolId,
  });

  // Mark teacher onboarding complete once first class is created
  if (!user.onboardingComplete) {
    user.onboardingComplete = true;
    await user.save();
  }

  return res.status(201).json(cls);
});

// GET /api/classes/mine
router.get("/classes/mine", authenticateToken, async (req: Request, res: Response) => {
  const uid = firebaseUid(req);
  const classes = await SchoolClass.find({ teacherFirebaseUid: uid });
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

  const cls = await SchoolClass.findById(parsed.data.classId);
  if (!cls || cls.teacherFirebaseUid !== uid) {
    return res.status(403).json({ message: "Class not found or not yours" });
  }

  const token = crypto.randomUUID();
  const invite = await Invite.create({
    email: parsed.data.parentEmail,
    name: parsed.data.studentName,
    role: "student",
    schoolId: cls.schoolId,
    classId: cls._id,
    grades: [parsed.data.grade],
    token,
    invitedBy: uid,
    expiresAt: sevenDaysFromNow(),
  });

  const school = await School.findById(cls.schoolId);
  await sendStudentInvite(
    parsed.data.parentEmail,
    parsed.data.studentName,
    school?.name ?? "your school",
    cls.name,
    token
  );

  return res.status(201).json({ id: invite._id, status: invite.status });
});

// GET /api/invite/student/list?classId=
router.get("/invite/student/list", authenticateToken, async (req: Request, res: Response) => {
  const uid = firebaseUid(req);
  const { classId } = req.query;
  const filter: any = { role: "student", invitedBy: uid };
  if (classId) filter.classId = classId;
  const invites = await Invite.find(filter).select("-token");
  return res.json(invites);
});

// ─── Resend invite ────────────────────────────────────────────────────────────

// POST /api/invite/resend/:inviteId
router.post("/invite/resend/:inviteId", authenticateToken, async (req: Request, res: Response) => {
  const uid = firebaseUid(req);
  const invite = await Invite.findById(req.params.inviteId);
  if (!invite) return res.status(404).json({ message: "Invite not found" });
  if (invite.invitedBy !== uid) return res.status(403).json({ message: "Forbidden" });
  if (invite.status === "accepted") return res.status(409).json({ message: "Already accepted" });

  invite.token = crypto.randomUUID();
  invite.status = "pending";
  invite.expiresAt = sevenDaysFromNow();
  await invite.save();

  const school = await School.findById(invite.schoolId);
  if (invite.role === "teacher") {
    await sendTeacherInvite(invite.email, invite.name, school?.name ?? "", invite.token);
  } else {
    const cls = invite.classId ? await SchoolClass.findById(invite.classId) : null;
    await sendStudentInvite(
      invite.email,
      invite.name,
      school?.name ?? "",
      cls?.name ?? "",
      invite.token
    );
  }

  return res.json({ message: "Invite resent" });
});

// GET /api/invite/validate/:token  (used by accept-invite page to pre-fill info)
router.get("/invite/validate/:token", async (req: Request, res: Response) => {
  const invite = await Invite.findOne({ token: req.params.token }).select("-token");
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

export default router;
