import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../lib/mailer", () => ({
  sendTeacherInvite: vi.fn().mockResolvedValue(undefined),
  sendStudentInvite: vi.fn().mockResolvedValue(undefined),
  sendPrincipalInvite: vi.fn().mockResolvedValue(undefined),
  sendSchoolAdminInvite: vi.fn().mockResolvedValue(undefined),
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/audit", () => ({
  AUDIT_EVENTS: { INVITE_SENT: "invite_sent" },
  recordAuditEvent: vi.fn(),
}));

import express from "express";
import session from "express-session";
import request from "supertest";
import onboardingRouter from "../routes/onboarding";
import { issueAccessToken } from "../lib/auth-workspace";
import {
  pgFindUserById,
  pgFindSchoolByCreatedByUid,
  pgFindSchoolById,
  pgFindSchoolByCode,
  pgFindFirstWorkspaceMembership,
  pgCreateInvite,
  pgFindInvitesBySchool,
} from "../lib/pg-queries";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: "test-secret", resave: false, saveUninitialized: false }));
  app.use("/api/onboarding", onboardingRouter);
  return app;
}

// Regression: a principal (or school_admin) who joined an existing school via
// /invite/staff — rather than being the school's original creator — must
// still be able to send and list teacher invites. Previously both handlers
// resolved "the admin's school" solely via `schools.created_by_uid`, so a
// non-creator staff member always hit 404 "Complete school setup first",
// even though their user row is linked to the school (via school_code, set
// when their staff invite was accepted).
describe("Teacher invites for a non-creator principal/school_admin", () => {
  const JOINED_SCHOOL = {
    id: 7,
    code: "SCH7",
    name: "Riverside Public School",
    createdByUid: "original-creator@example.com",
  };

  // The account this admin actually has: no created school, linked to the
  // joined school only through school_code (the field invite/accept populates).
  const NON_CREATOR_USER = {
    id: 42,
    authSubject: "principal@example.com",
    email: "principal@example.com",
    role: "principal",
    status: "active",
    emailVerified: true,
    onboardingComplete: true,
    schoolId: null,
    schoolCode: "SCH7",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (pgFindUserById as any).mockResolvedValue(NON_CREATOR_USER);
    // This user did NOT create the school — the legacy created_by_uid lookup
    // must come back empty for the regression to be meaningful.
    (pgFindSchoolByCreatedByUid as any).mockResolvedValue(null);
    (pgFindSchoolById as any).mockResolvedValue(JOINED_SCHOOL);
    (pgFindSchoolByCode as any).mockResolvedValue(JOINED_SCHOOL);
    (pgFindFirstWorkspaceMembership as any)?.mockResolvedValue?.(null);
  });

  it("sends a teacher invite by falling back to the user's linked schoolCode", async () => {
    (pgCreateInvite as any).mockResolvedValue({ id: 100, status: "pending" });
    const token = issueAccessToken({ userId: NON_CREATOR_USER.id });

    const res = await request(makeApp())
      .post("/api/onboarding/invite/teacher")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "teacher@example.com", name: "Asha", grades: ["6"] });

    expect(res.status).toBe(201);
    expect(pgFindSchoolByCode).toHaveBeenCalledWith(NON_CREATOR_USER.schoolCode);
    expect(pgCreateInvite).toHaveBeenCalledWith(
      expect.objectContaining({ schoolId: JOINED_SCHOOL.id, role: "teacher" })
    );
  });

  it("lists teacher invites by falling back to the user's linked schoolCode", async () => {
    (pgFindInvitesBySchool as any).mockResolvedValue([{ id: 1, email: "teacher@example.com" }]);
    const token = issueAccessToken({ userId: NON_CREATOR_USER.id });

    const res = await request(makeApp())
      .get("/api/onboarding/invite/teacher/list")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(pgFindInvitesBySchool).toHaveBeenCalledWith(JOINED_SCHOOL.id, "teacher");
    expect(res.body).toEqual([{ id: 1, email: "teacher@example.com", classId: null }]);
  });

  it("also resolves a non-creator admin linked by schoolId", async () => {
    (pgFindUserById as any).mockResolvedValue({
      ...NON_CREATOR_USER,
      schoolId: 7,
      schoolCode: null,
    });
    (pgCreateInvite as any).mockResolvedValue({ id: 101, status: "pending" });
    const token = issueAccessToken({ userId: NON_CREATOR_USER.id });

    const res = await request(makeApp())
      .post("/api/onboarding/invite/teacher")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "teacher@example.com", name: "Asha", grades: ["6"] });

    expect(res.status).toBe(201);
    expect(pgFindSchoolById).toHaveBeenCalledWith(7);
  });

  it("still 404s a user with no created school and no linked school", async () => {
    (pgFindUserById as any).mockResolvedValue({
      ...NON_CREATOR_USER,
      schoolId: null,
      schoolCode: null,
    });
    const token = issueAccessToken({ userId: NON_CREATOR_USER.id });

    const res = await request(makeApp())
      .post("/api/onboarding/invite/teacher")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "teacher@example.com", name: "Asha", grades: ["6"] });

    expect(res.status).toBe(404);
  });

  it("still resolves the school for its creator regardless of role", async () => {
    // The legacy path: created_by_uid matches, so even a creator whose row
    // carries a non-admin role keeps the ability they always had.
    (pgFindUserById as any).mockResolvedValue({ ...NON_CREATOR_USER, role: "teacher" });
    (pgFindSchoolByCreatedByUid as any).mockResolvedValue(JOINED_SCHOOL);
    (pgCreateInvite as any).mockResolvedValue({ id: 102, status: "pending" });
    const token = issueAccessToken({ userId: NON_CREATOR_USER.id });

    const res = await request(makeApp())
      .post("/api/onboarding/invite/teacher")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "teacher@example.com", name: "Asha", grades: ["6"] });

    expect(res.status).toBe(201);
    // The fallback lookups must not even run for a creator.
    expect(pgFindSchoolByCode).not.toHaveBeenCalled();
    expect(pgFindSchoolById).not.toHaveBeenCalled();
  });
});

// Security enforcement: /invite/accept links teachers AND students to a
// school via users.school_code, and the invite routes carry no requireRole
// middleware. The schoolId/schoolCode fallback must therefore refuse
// non-admin roles, or any school-linked user could mint teacher invites
// into their school and read pending invites.
describe("Teacher-invite fallback refuses non-admin school-linked users", () => {
  const SCHOOL = { id: 7, code: "SCH7", name: "Riverside Public School" };

  beforeEach(() => {
    vi.clearAllMocks();
    (pgFindSchoolByCreatedByUid as any).mockResolvedValue(null);
    (pgFindSchoolById as any).mockResolvedValue(SCHOOL);
    (pgFindSchoolByCode as any).mockResolvedValue(SCHOOL);
    (pgFindFirstWorkspaceMembership as any)?.mockResolvedValue?.(null);
  });

  for (const role of ["teacher", "student"]) {
    it(`404s a school-linked ${role} on POST /invite/teacher without creating an invite`, async () => {
      (pgFindUserById as any).mockResolvedValue({
        id: 99,
        email: `${role}@example.com`,
        role,
        schoolId: null,
        schoolCode: "SCH7",
      });
      const token = issueAccessToken({ userId: 99 });

      const res = await request(makeApp())
        .post("/api/onboarding/invite/teacher")
        .set("Authorization", `Bearer ${token}`)
        .send({ email: "evil-alt@example.com", name: "Alt", grades: ["6"] });

      expect(res.status).toBe(404);
      expect(pgCreateInvite).not.toHaveBeenCalled();
      // The school must never even be resolved for a non-admin role.
      expect(pgFindSchoolByCode).not.toHaveBeenCalled();
    });

    it(`404s a school-linked ${role} on GET /invite/teacher/list`, async () => {
      (pgFindUserById as any).mockResolvedValue({
        id: 99,
        email: `${role}@example.com`,
        role,
        schoolId: null,
        schoolCode: "SCH7",
      });
      const token = issueAccessToken({ userId: 99 });

      const res = await request(makeApp())
        .get("/api/onboarding/invite/teacher/list")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(pgFindInvitesBySchool).not.toHaveBeenCalled();
    });
  }
});

// The invite token is directly redeemable at /invite/accept — the list
// response must never include it (or other internal fields).
describe("Teacher-invite list response strips the redeemable token", () => {
  it("returns only presentation fields", async () => {
    vi.clearAllMocks();
    (pgFindSchoolByCreatedByUid as any).mockResolvedValue({ id: 7, code: "SCH7" });
    (pgFindUserById as any).mockResolvedValue({
      id: 1,
      email: "creator@example.com",
      role: "principal",
      status: "active",
      schoolId: null,
      schoolCode: null,
    });
    (pgFindInvitesBySchool as any).mockResolvedValue([
      {
        id: 1,
        email: "teacher@example.com",
        name: "Asha",
        role: "teacher",
        schoolId: 7,
        classId: null,
        grades: ["6"],
        token: "super-secret-redeemable-token",
        status: "pending",
        invitedBy: "creator@example.com",
        expiresAt: new Date("2026-08-01"),
        createdAt: new Date("2026-07-18"),
      },
    ]);
    const token = issueAccessToken({ userId: 1 });

    const res = await request(makeApp())
      .get("/api/onboarding/invite/teacher/list")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].email).toBe("teacher@example.com");
    expect(res.body[0].token).toBeUndefined();
    expect(res.body[0].invitedBy).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("super-secret-redeemable-token");
  });
});

// Accepting an invite overwrites the target account's password and role.
// An invite addressed at a privileged account's email (typo or malice —
// e.g. a teacher pointing a student invite at the principal's email) must
// never be able to reset and demote that account.
describe("Invite accept refuses to clobber a privileged existing account", () => {
  it("409s a student invite whose email belongs to a principal", async () => {
    const { pgFindInviteByToken, pgFindUserByEmail, pgUpdateUser, pgFindSchoolById } =
      await import("../lib/pg-queries");
    vi.clearAllMocks();
    (pgFindInviteByToken as any).mockResolvedValue({
      id: 5,
      email: "principal@example.com",
      name: "Principal",
      role: "student",
      schoolId: 7,
      classId: null,
      grades: [],
      status: "pending",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    (pgFindSchoolById as any).mockResolvedValue({ id: 7, code: "SCH7", name: "Riverside" });
    (pgFindUserByEmail as any).mockResolvedValue({
      id: 1,
      email: "principal@example.com",
      role: "principal",
      status: "active",
    });

    const res = await request(makeApp()).post("/api/onboarding/invite/accept").send({
      token: "8b7df1f2-3c4d-4e5f-8a9b-0c1d2e3f4a5b",
      email: "principal@example.com",
      displayName: "Attacker Chosen",
      password: "attacker-pw",
    });

    expect(res.status).toBe(409);
    expect(pgUpdateUser).not.toHaveBeenCalled();
  });
});
