import { vi } from "vitest";

// Mock mailer (avoid SMTP) — top-level for hoist safety.
vi.mock("../lib/integrations/mailer", () => ({
  sendTeacherInvite: vi.fn().mockResolvedValue(undefined),
  sendStudentInvite: vi.fn().mockResolvedValue(undefined),
  sendPrincipalInvite: vi.fn().mockResolvedValue(undefined),
  sendSchoolAdminInvite: vi.fn().mockResolvedValue(undefined),
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/audit", () => ({
  AUDIT_EVENTS: { INVITE_ACCEPTED: "invite_accepted" },
  recordAuditEvent: vi.fn(),
}));

import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import onboardingRouter from "../routes/onboarding";
import {
  pgFindInviteByToken,
  pgFindUserByEmail,
  pgFindUserById,
  pgCreateUser,
  pgUpdateUser,
  pgFindSchoolById,
  pgFindSchoolClassById,
  pgUpsertMembership,
  pgAcceptInvite,
  pgUpdateUserOnboardingComplete,
} from "../lib/db/pg-queries";

// Regression coverage for: POST /invite/accept created (or updated) the user
// account without ever setting users.school_code / users.class_name. Only
// pgUpsertMembership recorded the school link, in a separate `memberships`
// table — so an invited student's own account stayed school_code = NULL
// (resolveTenantScope in server/lib/auth/tenant.ts fails closed on every
// tenant-scoped route for a null school_code) and class_name = NULL/''
// (invisible in pgGetClassNames / GET /roster, both of which filter on it).
describe("POST /invite/accept sets schoolCode and className on the user record", () => {
  let app: express.Express;
  const SCHOOL = { id: 42, code: "TESTSCHOOL", name: "Test School" };
  const CLASS = {
    id: 7,
    schoolId: 42,
    name: "Grade 5 - Falcons",
    grade: "5",
    teacherFirebaseUid: "t1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use("/api/onboarding", onboardingRouter);

    (pgFindSchoolById as any).mockResolvedValue(SCHOOL);
    (pgFindSchoolClassById as any).mockResolvedValue(CLASS);
    (pgUpsertMembership as any).mockResolvedValue(undefined);
    (pgAcceptInvite as any).mockResolvedValue(undefined);
    (pgUpdateUserOnboardingComplete as any).mockResolvedValue(undefined);
  });

  it("creates a new student account with schoolCode and className populated from the invite's school/class", async () => {
    (pgFindInviteByToken as any).mockResolvedValue({
      id: 1,
      email: "student@example.com",
      name: "Riya",
      role: "student",
      schoolId: SCHOOL.id,
      classId: String(CLASS.id),
      status: "pending",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    (pgFindUserByEmail as any).mockResolvedValue(null); // create branch
    (pgCreateUser as any).mockResolvedValue({
      id: 77,
      email: "student@example.com",
      authSubject: "student@example.com",
      role: "student",
      schoolCode: SCHOOL.code,
      className: CLASS.name,
    });

    const res = await request(app).post("/api/onboarding/invite/accept").send({
      token: "11111111-1111-1111-1111-111111111111",
      email: "student@example.com",
      displayName: "Riya",
      password: "supersecret123",
    });

    expect(res.status).toBe(201);
    expect(pgFindSchoolClassById).toHaveBeenCalledWith(CLASS.id);
    expect(pgCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        schoolCode: SCHOOL.code,
        className: CLASS.name,
      })
    );
  });

  it("sets schoolCode and className when accepting re-triggers the update branch (pre-existing user row)", async () => {
    (pgFindInviteByToken as any).mockResolvedValue({
      id: 2,
      email: "student2@example.com",
      name: "Aman",
      role: "student",
      schoolId: SCHOOL.id,
      classId: String(CLASS.id),
      status: "pending",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    (pgFindUserByEmail as any).mockResolvedValue({ id: 88, email: "student2@example.com" });
    (pgFindUserById as any).mockResolvedValue({
      id: 88,
      email: "student2@example.com",
      authSubject: "student2@example.com",
      role: "student",
      schoolCode: SCHOOL.code,
      className: CLASS.name,
    });

    const res = await request(app).post("/api/onboarding/invite/accept").send({
      token: "22222222-2222-2222-2222-222222222222",
      email: "student2@example.com",
      displayName: "Aman",
      password: "supersecret123",
    });

    expect(res.status).toBe(201);
    expect(pgUpdateUser).toHaveBeenCalledWith(
      88,
      expect.objectContaining({
        schoolCode: SCHOOL.code,
        className: CLASS.name,
      })
    );
  });

  it("sets schoolCode but leaves className null for a teacher invite (no classId)", async () => {
    (pgFindInviteByToken as any).mockResolvedValue({
      id: 3,
      email: "teacher@example.com",
      name: "Ms. Verma",
      role: "teacher",
      schoolId: SCHOOL.id,
      classId: null,
      status: "pending",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    (pgFindUserByEmail as any).mockResolvedValue(null);
    (pgCreateUser as any).mockResolvedValue({
      id: 99,
      email: "teacher@example.com",
      authSubject: "teacher@example.com",
      role: "teacher",
      schoolCode: SCHOOL.code,
    });

    const res = await request(app).post("/api/onboarding/invite/accept").send({
      token: "33333333-3333-3333-3333-333333333333",
      email: "teacher@example.com",
      displayName: "Ms. Verma",
      password: "supersecret123",
    });

    expect(res.status).toBe(201);
    expect(pgFindSchoolClassById).not.toHaveBeenCalled();
    expect(pgCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        schoolCode: SCHOOL.code,
        className: null,
      })
    );
  });
});
