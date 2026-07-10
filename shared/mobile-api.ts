// ── Mobile API response contract (W-R) ──────────────────────────────────────
// Response schemas for every endpoint the mobile app consumes. The mobile
// repo syncs this file (npm run sync-shared) and parses every response with
// these schemas, so a server shape change fails loudly at the client edge
// instead of rendering garbage.
//
// Server payloads are snake_case in places (authMePayload's `school_code`);
// the schemas keep the wire shape and expose explicit mappers so the app
// never touches the raw field names. A silent undefined here would fail
// closed (null schoolCode blocks every screen), so the mapping is tested.
import { z } from "zod";

import { USER_ROLES } from "./authz";

export const attendanceStatusValues = ["present", "absent", "late", "excused"] as const;
export const attendanceStatusSchema = z.enum(attendanceStatusValues);
export type AttendanceStatus = z.infer<typeof attendanceStatusSchema>;

// GET /api/auth/me and login responses embed this user payload (wire shape).
export const authUserWireSchema = z
  .object({
    id: z.number().int(),
    email: z.string(),
    displayName: z.string().nullish(),
    name: z.string().nullish(),
    status: z.string(),
    emailVerified: z.boolean().nullish(),
    role: z.enum(USER_ROLES),
    school_code: z.string().nullish(),
    class: z.string().nullish(),
    onboardingComplete: z.boolean().nullish(),
  })
  .passthrough();

export const authMeResponseSchema = z
  .object({
    user: authUserWireSchema,
    onboardingComplete: z.boolean().nullish(),
  })
  .passthrough();
export type AuthMeResponse = z.infer<typeof authMeResponseSchema>;

// POST /api/auth/login and /api/auth/refresh for X-Client: mobile (W-1):
// tokens travel in the body, never in cookies.
export const mobileLoginResponseSchema = authMeResponseSchema.extend({
  token: z.string().min(1),
  refreshToken: z.string().min(1),
});
export type MobileLoginResponse = z.infer<typeof mobileLoginResponseSchema>;

export const mobileRefreshResponseSchema = z
  .object({
    token: z.string().min(1),
    refreshToken: z.string().min(1),
  })
  .passthrough();
export type MobileRefreshResponse = z.infer<typeof mobileRefreshResponseSchema>;

/** The app's session identity. schoolCode is camelCase HERE and only here. */
export type SessionUser = {
  id: number;
  email: string;
  displayName: string;
  role: (typeof USER_ROLES)[number];
  /** null = no tenant scope; every school-scoped screen must fail closed. */
  schoolCode: string | null;
  emailVerified: boolean;
  status: string;
};

/**
 * The one place `school_code` (wire) becomes `schoolCode` (app). Never read
 * the wire field anywhere else — a typo'd mapping silently fail-closes the
 * whole app, so this mapper is unit-tested in the mobile repo.
 */
export function toSessionUser(payload: AuthMeResponse): SessionUser {
  const u = payload.user;
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName || u.name || u.email,
    role: u.role,
    schoolCode: u.school_code ?? null,
    emailVerified: u.emailVerified ?? false,
    status: u.status,
  };
}

// GET /api/attendance/roster?className= → students the teacher can mark.
// parentPhone is intentionally absent from the mobile contract (W-6: guardian
// PII must not reach the device cache).
export const rosterStudentSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    class: z.string().nullish(),
  })
  .passthrough();

export const rosterResponseSchema = z.array(rosterStudentSchema);
export type RosterStudent = z.infer<typeof rosterStudentSchema>;

// GET /api/attendance/classes
export const classListResponseSchema = z.array(z.string());

// POST /api/attendance response (W-2 adds `alerts`; optional until it ships).
export const markAttendanceResponseSchema = z
  .object({
    success: z.boolean(),
    written: z.number().int(),
    notified: z.number().int().optional(),
    alerts: z
      .object({
        channel: z.string(),
        enabled: z.boolean(),
        attempted: z.number().int(),
      })
      .optional(),
  })
  .passthrough();
export type MarkAttendanceResponse = z.infer<typeof markAttendanceResponseSchema>;

// GET /api/attendance?className=&date= → rows for a class on a date.
export const attendanceRowSchema = z
  .object({
    studentId: z.number().int(),
    status: attendanceStatusSchema,
    note: z.string().nullish(),
    date: z.string().nullish(),
  })
  .passthrough();
export const attendanceListResponseSchema = z.array(attendanceRowSchema);
export type AttendanceRow = z.infer<typeof attendanceRowSchema>;

// GET /api/attendance/school-summary?date= — principal/school-admin live view.
export const schoolAttendanceClassSummarySchema = z
  .object({
    className: z.string(),
    totalStudents: z.number().int().nonnegative(),
    markedStudents: z.number().int().nonnegative(),
    present: z.number().int().nonnegative(),
    absent: z.number().int().nonnegative(),
    late: z.number().int().nonnegative(),
    excused: z.number().int().nonnegative(),
    unmarked: z.number().int().nonnegative(),
  })
  .passthrough();

export const schoolAttendanceSummaryResponseSchema = z
  .object({
    date: z.string(),
    totals: schoolAttendanceClassSummarySchema.omit({ className: true }),
    classes: z.array(schoolAttendanceClassSummarySchema),
    unmarkedClasses: z.array(z.string()),
  })
  .passthrough();
export type SchoolAttendanceClassSummary = z.infer<typeof schoolAttendanceClassSummarySchema>;
export type SchoolAttendanceSummaryResponse = z.infer<typeof schoolAttendanceSummaryResponseSchema>;

// POST /api/attendance request body (mirror of the server's MarkSchema).
export const markAttendanceRequestSchema = z.object({
  className: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  markedAt: z.string().datetime().optional(),
  marks: z
    .array(
      z.object({
        studentId: z.number().int().positive(),
        status: attendanceStatusSchema,
        note: z.string().optional(),
      })
    )
    .min(1),
});
export type MarkAttendanceRequest = z.infer<typeof markAttendanceRequestSchema>;

// GET /api/parent/children?date= — parent-owned children with today's status.
export const parentChildSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    className: z.string().nullish(),
    today: z.object({
      date: z.string(),
      status: attendanceStatusSchema.nullish(),
      markedAt: z.string().nullish(),
    }),
  })
  .passthrough();

export const parentChildrenResponseSchema = z
  .object({
    date: z.string(),
    children: z.array(parentChildSchema),
  })
  .passthrough();
export type ParentChildrenResponse = z.infer<typeof parentChildrenResponseSchema>;
export type ParentChild = z.infer<typeof parentChildSchema>;

// POST /api/parent/claim — parent links a child using a school-issued code
// plus the phone number already stored on the student record.
export const parentClaimResponseSchema = z
  .object({
    success: z.boolean(),
    studentId: z.number().int(),
  })
  .passthrough();
export type ParentClaimResponse = z.infer<typeof parentClaimResponseSchema>;

export const parentAttendanceHistoryRowSchema = z
  .object({
    date: z.string(),
    status: attendanceStatusSchema,
    note: z.string().nullish(),
    className: z.string().nullish(),
  })
  .passthrough();

export const parentChildAttendanceHistoryResponseSchema = z
  .object({
    studentId: z.number().int(),
    attendance: z.array(parentAttendanceHistoryRowSchema),
  })
  .passthrough();
export type ParentAttendanceHistoryRow = z.infer<typeof parentAttendanceHistoryRowSchema>;
export type ParentChildAttendanceHistoryResponse = z.infer<
  typeof parentChildAttendanceHistoryResponseSchema
>;

export const parentFeeSchema = z
  .object({
    id: z.number().int(),
    description: z.string(),
    amountCents: z.number().int(),
    currency: z.string(),
    status: z.string(),
    dueDate: z.string().nullish(),
    paidAt: z.string().nullish(),
  })
  .passthrough();

export const parentChildFeeSummarySchema = z
  .object({
    studentId: z.number().int(),
    pendingCents: z.number().int(),
    paidCents: z.number().int(),
    pendingCount: z.number().int(),
    paidCount: z.number().int(),
    fees: z.array(parentFeeSchema),
  })
  .passthrough();
export type ParentChildFeeSummary = z.infer<typeof parentChildFeeSummarySchema>;

// GET /api/fees, GET /api/fees/summary, POST /api/fees for staff fee workflows.
export const feeStatusSchema = z.enum(["pending", "paid", "waived"]);

export const staffFeeSchema = z
  .object({
    id: z.number().int(),
    studentId: z.number().int(),
    studentName: z.string(),
    parentPhone: z.string().nullish(),
    description: z.string(),
    amountCents: z.number().int(),
    currency: z.string(),
    status: feeStatusSchema,
    dueDate: z.string().nullish(),
    paidAt: z.string().nullish(),
  })
  .passthrough();

export const staffFeesResponseSchema = z.array(staffFeeSchema);
export const staffFeeSummarySchema = z
  .object({
    pendingCents: z.number().int(),
    paidCents: z.number().int(),
    pendingCount: z.number().int(),
    paidCount: z.number().int(),
  })
  .passthrough();
export const createFeeResponseSchema = z
  .object({
    id: z.number().int(),
    status: feeStatusSchema,
  })
  .passthrough();
export const actionSuccessResponseSchema = z
  .object({
    success: z.boolean(),
    simulated: z.boolean().optional(),
  })
  .passthrough();

export type StaffFee = z.infer<typeof staffFeeSchema>;
export type StaffFeeSummary = z.infer<typeof staffFeeSummarySchema>;
export type FeeStatus = z.infer<typeof feeStatusSchema>;
