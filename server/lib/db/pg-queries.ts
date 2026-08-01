/**
 * Direct PostgreSQL query helpers for entities not covered by IStorage.
 * Replaces all direct MongoModel.* calls in routes and services.
 */
import { getPgPool, isPgReady } from "../../db-pg";
import { logger } from "../logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PgUser {
  id: number;
  authProvider: string;
  authSubject: string;
  email: string;
  username: string;
  password: string;
  name: string;
  displayName: string | null;
  avatar: string | null;
  emailVerified: boolean;
  role: string;
  status: string;
  userType: string | null;
  schoolCode: string | null;
  schoolId: number | null;
  parentId: number | null;
  parentPhone: string | null;
  grade: string | null;
  board: string | null;
  subjects: string[];
  district: string | null;
  class: string | null;
  subject: string | null;
  onboardingComplete: boolean;
  studyPlan: Record<string, number>;
  createdAt: Date;
  lastLoginAt: Date | null;
  // Convenience alias used by auth routes
  firebaseUid: string | null;
}

export interface PgSchool {
  id: number;
  code: string;
  name: string;
  city: string | null;
  district: string | null;
  board: string | null;
  logo: string | null;
  gradesOffered: string[];
  approximateStudents: string | null;
  createdByUid: string | null;
  onboardingComplete: boolean;
  createdAt: Date;
}

export interface PgInvite {
  id: number;
  email: string;
  name: string | null;
  role: string;
  schoolId: number | null;
  classId: string | null;
  grades: string[];
  token: string;
  status: string;
  invitedBy: string | null;
  expiresAt: Date;
  createdAt: Date;
}

export interface PgOnboardingResponse {
  id: number;
  userId: number;
  questionKey: string;
  response: any;
  createdAt: Date;
}

export interface PgGradingResult {
  id: number;
  submissionId: string;
  studentId: number;
  teacherId: number;
  rubric: any;
  scoreBreakdown: any | null;
  overallFeedback: string | null;
  strengths: string[];
  areasForImprovement: string[];
  status: string;
  modelUsed: string | null;
  processingTimeMs: number | null;
  attachments: string[];
  contentType: string;
  createdAt: Date;
  completedAt: Date | null;
}

export interface PgSubscription {
  id: number;
  userId: number;
  workspaceId: number | null;
  tier: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  status: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PgWorkspace {
  id: number;
  name: string;
  slug: string | null;
  type: string;
  description: string | null;
  iconUrl: string | null;
  settings: Record<string, any>;
  ownerId: number;
  members: number[];
  createdAt: Date;
}

export interface PgWorkspaceMembership {
  id: number;
  workspaceId: number;
  userId: number;
  role: "owner" | "admin" | "co-teacher" | "teaching-assistant" | "member" | "auditor";
  status: string;
  createdAt: Date;
}

export interface PgWorkspaceInvite {
  id: number;
  workspaceId: number;
  email: string;
  name: string | null;
  role: "admin" | "co-teacher" | "teaching-assistant" | "member" | "auditor";
  kind: "business_member" | "student";
  tokenHash: string;
  status: string;
  invitedBy: number | null;
  studentMeta: Record<string, any>;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
}

export interface PgAIClassroom {
  id: number;
  teacherId: number;
  topic: string;
  studyArenaJobId: string;
  data: any | null;
  status: string;
  createdAt: Date;
}

export interface PgLmsConnection {
  id: number;
  userId: number;
  provider: string;
  accessToken: string;
  refreshToken: string | null;
  instanceUrl: string | null;
  tokenExpiry: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Row mappers ──────────────────────────────────────────────────────────────

function n(v: any): number | null {
  if (v == null) return null;
  const x = parseInt(v, 10);
  return isNaN(x) ? null : x;
}

function mapUser(r: any): PgUser {
  return {
    id: n(r.id)!,
    authProvider: r.auth_provider,
    authSubject: r.auth_subject,
    email: r.email,
    username: r.username ?? "",
    password: r.password_hash ?? "",
    name: r.name ?? "",
    displayName: r.display_name ?? null,
    avatar: r.avatar ?? null,
    emailVerified: r.email_verified ?? false,
    role: r.role,
    status: r.status,
    schoolCode: r.school_code ?? null,
    schoolId: n(r.school_id),
    parentId: n(r.parent_id),
    parentPhone: r.parent_phone ?? null,
    grade: r.grade ?? null,
    board: r.board ?? null,
    subjects: r.subjects ?? [],
    district: r.district ?? null,
    class: r.class_name ?? null,
    subject: r.subject ?? null,
    userType: r.user_type ?? null,
    onboardingComplete: r.onboarding_complete ?? false,
    studyPlan: r.study_plan ?? {},
    createdAt: r.created_at,
    lastLoginAt: r.last_login_at ?? null,
    firebaseUid: r.auth_provider === "firebase" ? r.auth_subject : null,
  };
}

function mapSchool(r: any): PgSchool {
  return {
    id: n(r.id)!,
    code: r.code,
    name: r.name,
    city: r.city ?? null,
    district: r.district ?? null,
    board: r.board ?? null,
    logo: r.logo ?? null,
    gradesOffered: r.grades_offered ?? [],
    approximateStudents: r.approximate_students ?? null,
    createdByUid: r.created_by_uid ?? null,
    onboardingComplete: r.onboarding_complete ?? false,
    createdAt: r.created_at,
  };
}

function mapOnboardingResponse(r: any): PgOnboardingResponse {
  return {
    id: n(r.id)!,
    userId: n(r.user_id)!,
    questionKey: r.question_key,
    response: r.response,
    createdAt: r.created_at,
  };
}

function mapInvite(r: any): PgInvite {
  return {
    id: n(r.id)!,
    email: r.email,
    name: r.name ?? null,
    role: r.role,
    schoolId: n(r.school_id),
    classId: r.class_id ?? null,
    grades: r.grades ?? [],
    token: r.token,
    status: r.status,
    invitedBy: r.invited_by ?? null,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
  };
}

function mapGradingResult(r: any): PgGradingResult {
  return {
    id: n(r.id)!,
    submissionId: r.submission_id,
    studentId: n(r.student_id)!,
    teacherId: n(r.teacher_id)!,
    rubric: r.rubric,
    scoreBreakdown: r.score_breakdown ?? null,
    overallFeedback: r.overall_feedback ?? null,
    strengths: r.strengths ?? [],
    areasForImprovement: r.areas_for_improvement ?? [],
    status: r.status,
    modelUsed: r.model_used ?? null,
    processingTimeMs: n(r.processing_time_ms),
    attachments: r.attachments ?? [],
    contentType: r.content_type ?? "text",
    createdAt: r.created_at,
    completedAt: r.completed_at ?? null,
  };
}

function mapSubscription(r: any): PgSubscription {
  return {
    id: n(r.id)!,
    userId: n(r.user_id)!,
    workspaceId: n(r.workspace_id),
    tier: r.tier,
    stripeCustomerId: r.stripe_customer_id ?? null,
    stripeSubscriptionId: r.stripe_subscription_id ?? null,
    status: r.status,
    currentPeriodStart: r.current_period_start ?? null,
    currentPeriodEnd: r.current_period_end ?? null,
    cancelAtPeriodEnd: r.cancel_at_period_end ?? false,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapWorkspace(r: any): PgWorkspace {
  return {
    id: n(r.id)!,
    name: r.name,
    slug: r.slug ?? null,
    type: r.type ?? "business",
    description: r.description ?? null,
    iconUrl: r.icon_url ?? null,
    settings: r.settings ?? {},
    ownerId: n(r.owner_id)!,
    members: (r.members ?? []).map(Number),
    createdAt: r.created_at,
  };
}

function mapWorkspaceMembership(r: any): PgWorkspaceMembership {
  return {
    id: n(r.id)!,
    workspaceId: n(r.workspace_id)!,
    userId: n(r.user_id)!,
    role: r.role,
    status: r.status,
    createdAt: r.created_at,
  };
}

function mapWorkspaceInvite(r: any): PgWorkspaceInvite {
  return {
    id: n(r.id)!,
    workspaceId: n(r.workspace_id)!,
    email: r.email,
    name: r.name ?? null,
    role: r.role,
    kind: r.kind,
    tokenHash: r.token_hash,
    status: r.status,
    invitedBy: n(r.invited_by),
    studentMeta: r.student_meta ?? {},
    expiresAt: r.expires_at,
    acceptedAt: r.accepted_at ?? null,
    createdAt: r.created_at,
  };
}

function mapAIClassroom(r: any): PgAIClassroom {
  return {
    id: n(r.id)!,
    teacherId: n(r.teacher_id)!,
    topic: r.topic,
    studyArenaJobId: r.study_arena_job_id,
    data: r.data ?? null,
    status: r.status,
    createdAt: r.created_at,
  };
}

function mapLmsConnection(r: any): PgLmsConnection {
  return {
    id: n(r.id)!,
    userId: n(r.user_id)!,
    provider: r.provider,
    accessToken: r.access_token,
    refreshToken: r.refresh_token ?? null,
    instanceUrl: r.instance_url ?? null,
    tokenExpiry: r.token_expiry ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ─── User queries ─────────────────────────────────────────────────────────────

export async function pgFindUserById(id: number): Promise<PgUser | null> {
  if (!isPgReady()) return null;
  try {
    const { rows } = await getPgPool().query("SELECT * FROM users WHERE id = $1", [id]);
    return rows[0] ? mapUser(rows[0]) : null;
  } catch (err) {
    logger.error("[pg] pgFindUserById failed", { err: String(err) });
    return null;
  }
}

/**
 * All learning-interaction rows for one student, for the GDPR right-of-access
 * export. Study Arena gate-answer rows carry the student's free-text attempt
 * in the same row's payload. Newest first.
 */
export async function pgExportInteractionLog(
  studentId: number
): Promise<Array<{ kind: string; concept: string | null; payload: unknown; created_at: string }>> {
  if (!isPgReady()) return [];
  try {
    const { rows } = await getPgPool().query(
      `SELECT kind, concept, payload, created_at
         FROM interaction_log
        WHERE student_id = $1
        ORDER BY created_at DESC`,
      [studentId]
    );
    return rows;
  } catch (err) {
    logger.error("[pg] pgExportInteractionLog failed", { err: String(err) });
    return [];
  }
}

export async function pgFindUserByEmail(email: string): Promise<PgUser | null> {
  if (!isPgReady()) return null;
  try {
    const { rows } = await getPgPool().query("SELECT * FROM users WHERE email = $1", [
      email.toLowerCase().trim(),
    ]);
    return rows[0] ? mapUser(rows[0]) : null;
  } catch (err) {
    logger.error("[pg] pgFindUserByEmail failed", { err: String(err) });
    return null;
  }
}

export async function pgFindUserByAuthSubject(
  provider: string,
  subject: string
): Promise<PgUser | null> {
  if (!isPgReady()) return null;
  try {
    const { rows } = await getPgPool().query(
      "SELECT * FROM users WHERE auth_provider = $1 AND auth_subject = $2",
      [provider, subject]
    );
    return rows[0] ? mapUser(rows[0]) : null;
  } catch (err) {
    logger.error("[pg] pgFindUserByAuthSubject failed", { err: String(err) });
    return null;
  }
}

export async function pgFindUserByUsername(username: string): Promise<PgUser | null> {
  if (!isPgReady()) return null;
  try {
    const { rows } = await getPgPool().query("SELECT * FROM users WHERE username = $1", [username]);
    return rows[0] ? mapUser(rows[0]) : null;
  } catch (err) {
    logger.error("[pg] pgFindUserByUsername failed", { err: String(err) });
    return null;
  }
}

export async function pgFindUsers(filters: {
  role?: string;
  status?: string;
  schoolCode?: string;
  parentId?: number;
  classname?: string;
}): Promise<PgUser[]> {
  if (!isPgReady()) return [];
  try {
    const conditions: string[] = [];
    const params: any[] = [];
    let i = 1;
    if (filters.role) {
      conditions.push(`role = $${i++}`);
      params.push(filters.role);
    }
    if (filters.status) {
      conditions.push(`status = $${i++}`);
      params.push(filters.status);
    }
    if (filters.schoolCode) {
      conditions.push(`school_code = $${i++}`);
      params.push(filters.schoolCode);
    }
    if (filters.parentId != null) {
      conditions.push(`parent_id = $${i++}`);
      params.push(filters.parentId);
    }
    if (filters.classname) {
      conditions.push(`class_name = $${i++}`);
      params.push(filters.classname);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await getPgPool().query(`SELECT * FROM users ${where}`, params);
    return rows.map(mapUser);
  } catch (err) {
    logger.error("[pg] pgFindUsers failed", { err: String(err) });
    return [];
  }
}

export async function pgCountUsers(filters: {
  role?: string;
  schoolCode?: string;
}): Promise<number> {
  if (!isPgReady()) return 0;
  try {
    const conditions: string[] = [];
    const params: any[] = [];
    let i = 1;
    if (filters.role) {
      conditions.push(`role = $${i++}`);
      params.push(filters.role);
    }
    if (filters.schoolCode) {
      conditions.push(`school_code = $${i++}`);
      params.push(filters.schoolCode);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await getPgPool().query(`SELECT COUNT(*) FROM users ${where}`, params);
    return parseInt(rows[0].count, 10);
  } catch (err) {
    logger.error("[pg] pgCountUsers failed", { err: String(err) });
    return 0;
  }
}

export async function pgCreateUser(data: {
  authProvider: string;
  authSubject: string;
  email: string;
  username: string;
  passwordHash: string;
  name: string;
  displayName?: string | null;
  avatar?: string | null;
  emailVerified?: boolean;
  role: string;
  status: string;
  schoolCode?: string | null;
  grade?: string | null;
  board?: string | null;
  subjects?: string[];
  district?: string | null;
  className?: string | null;
  subject?: string | null;
}): Promise<PgUser> {
  const pool = getPgPool();
  const { rows } = await pool.query(
    `INSERT INTO users
       (auth_provider, auth_subject, email, username, password_hash, name, display_name,
        avatar, email_verified, role, status, school_code, grade, board, subjects, district, class_name, subject)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     RETURNING *`,
    [
      data.authProvider,
      data.authSubject,
      data.email.toLowerCase().trim(),
      data.username,
      data.passwordHash,
      data.name,
      data.displayName ?? null,
      data.avatar ?? null,
      data.emailVerified ?? false,
      data.role,
      data.status,
      data.schoolCode ?? null,
      data.grade ?? null,
      data.board ?? null,
      data.subjects ?? [],
      data.district ?? null,
      data.className ?? null,
      data.subject ?? null,
    ]
  );
  return mapUser(rows[0]);
}

export async function pgUpdateUser(id: number, data: Record<string, any>): Promise<PgUser | null> {
  if (!isPgReady()) return null;
  try {
    const columnMap: Record<string, string> = {
      role: "role",
      status: "status",
      schoolCode: "school_code",
      schoolId: "school_id",
      parentId: "parent_id",
      parentPhone: "parent_phone",
      grade: "grade",
      board: "board",
      subjects: "subjects",
      district: "district",
      className: "class_name",
      subject: "subject",
      onboardingComplete: "onboarding_complete",
      studyPlan: "study_plan",
      displayName: "display_name",
      avatar: "avatar",
      emailVerified: "email_verified",
      lastLoginAt: "last_login_at",
      passwordHash: "password_hash",
      name: "name",
      username: "username",
      lastActiveWorkspaceId: "last_active_workspace_id",
    };
    const sets: string[] = [];
    const params: any[] = [];
    let i = 1;
    for (const [k, col] of Object.entries(columnMap)) {
      if (k in data) {
        sets.push(`${col} = $${i++}`);
        params.push(Reflect.get(data, k));
      }
    }
    if (!sets.length) return pgFindUserById(id);
    params.push(id);
    const { rows } = await getPgPool().query(
      `UPDATE users SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
      params
    );
    return rows[0] ? mapUser(rows[0]) : null;
  } catch (err) {
    logger.error("[pg] pgUpdateUser failed", { err: String(err) });
    return null;
  }
}

export async function pgDeleteUser(id: number): Promise<boolean> {
  if (!isPgReady()) return false;
  try {
    const { rowCount } = await getPgPool().query("DELETE FROM users WHERE id = $1", [id]);
    return (rowCount ?? 0) > 0;
  } catch (err) {
    logger.error("[pg] pgDeleteUser failed", { err: String(err) });
    return false;
  }
}

export async function pgSetUserLastLogin(userId: number): Promise<void> {
  if (!isPgReady()) return;
  try {
    await getPgPool().query("UPDATE users SET last_login_at = now() WHERE id = $1", [userId]);
  } catch (err) {
    logger.error("[pg] pgSetUserLastLogin failed", { err: String(err) });
  }
}

export async function pgUpsertMembership(params: {
  userId: number;
  schoolCode: string | null;
  status: "active" | "pending" | "suspended" | "rejected";
  roleKey: string;
}): Promise<void> {
  if (!isPgReady()) return;
  try {
    const pool = getPgPool();
    let schoolId: number | null = null;
    if (params.schoolCode) {
      const res = await pool.query<{ id: string }>("SELECT id FROM schools WHERE code = $1", [
        params.schoolCode,
      ]);
      schoolId = res.rows[0] ? parseInt(res.rows[0].id, 10) : null;
    }
    const mr = await pool.query<{ id: string }>(
      `INSERT INTO memberships (user_id, school_id, status)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, school_id) DO UPDATE SET status = EXCLUDED.status
       RETURNING id`,
      [params.userId, schoolId, params.status]
    );
    const membershipId = mr.rows[0] ? parseInt(mr.rows[0].id, 10) : null;
    if (!membershipId) return;
    const rr = await pool.query<{ id: string }>("SELECT id FROM roles WHERE key = $1", [
      params.roleKey,
    ]);
    const roleId = rr.rows[0] ? parseInt(rr.rows[0].id, 10) : null;
    if (!roleId) return;
    await pool.query(
      "INSERT INTO membership_roles (membership_id, role_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
      [membershipId, roleId]
    );
  } catch (err) {
    logger.error("[pg] pgUpsertMembership failed", { err: String(err), params });
  }
}

export async function pgUpdateUserSubjects(
  userId: number,
  subjects: string[]
): Promise<PgUser | null> {
  return pgUpdateUser(userId, { subjects });
}

export async function pgSaveOnboardingResponse(
  userId: number,
  questionKey: string,
  response: any
): Promise<PgOnboardingResponse | null> {
  if (!isPgReady()) return null;
  try {
    const { rows } = await getPgPool().query(
      `INSERT INTO onboarding_responses (user_id, question_key, response)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, questionKey, JSON.stringify(response)]
    );
    return rows[0] ? mapOnboardingResponse(rows[0]) : null;
  } catch (err) {
    logger.error("[pg] pgSaveOnboardingResponse failed", { err: String(err) });
    return null;
  }
}

// ─── School queries ───────────────────────────────────────────────────────────

export async function pgFindSchoolByCreatedByUid(uid: string): Promise<PgSchool | null> {
  if (!isPgReady()) return null;
  try {
    const { rows } = await getPgPool().query(
      "SELECT * FROM schools WHERE created_by_uid = $1 LIMIT 1",
      [uid]
    );
    return rows[0] ? mapSchool(rows[0]) : null;
  } catch (err) {
    logger.error("[pg] pgFindSchoolByCreatedByUid failed", { err: String(err) });
    return null;
  }
}

export async function pgFindSchoolByCode(code: string): Promise<PgSchool | null> {
  if (!isPgReady()) return null;
  try {
    const { rows } = await getPgPool().query("SELECT * FROM schools WHERE code = $1", [code]);
    return rows[0] ? mapSchool(rows[0]) : null;
  } catch (err) {
    logger.error("[pg] pgFindSchoolByCode failed", { err: String(err) });
    return null;
  }
}

export async function pgFindSchoolById(id: number): Promise<PgSchool | null> {
  if (!isPgReady()) return null;
  try {
    const { rows } = await getPgPool().query("SELECT * FROM schools WHERE id = $1", [id]);
    return rows[0] ? mapSchool(rows[0]) : null;
  } catch (err) {
    logger.error("[pg] pgFindSchoolById failed", { err: String(err) });
    return null;
  }
}

// Derives a school code from a signup uid (email for local-password
// accounts), then disambiguates against real collisions. Stripping
// non-alphanumeric characters BEFORE slicing (not after) matters: emails
// sharing a long human-readable prefix followed by a short disambiguating
// suffix (e.g. `attendance-teacher-<epoch-ms>-<rand>@...`) previously all
// truncated to the same raw 20-char slice, producing identical codes for
// unrelated schools — and since the INSERT below does
// `ON CONFLICT (code) DO UPDATE SET name = ...`, a collision silently
// merged two schools' data under one row/id. The retry loop below closes
// the remaining gap for uids whose first 20 stripped characters still
// collide, mirroring makeUniqueSlug's pattern in server/routes/auth.ts.
async function makeUniqueSchoolCode(uid: string): Promise<string> {
  const base =
    uid
      .replace(/[^a-z0-9]/gi, "")
      .toUpperCase()
      .slice(0, 20) || "SCH";
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}${i + 1}`;
    if (!(await pgFindSchoolByCode(candidate))) return candidate;
  }
  return `${base}${Date.now()}`;
}

export async function pgUpsertSchool(data: {
  uid: string;
  name: string;
  city?: string;
  board?: string;
  gradesOffered?: string[];
  logo?: string | null;
  approximateStudents?: string | null;
  onboardingComplete?: boolean;
}): Promise<PgSchool> {
  const pool = getPgPool();
  const existing = await pgFindSchoolByCreatedByUid(data.uid);
  if (existing) {
    const { rows } = await pool.query(
      `UPDATE schools SET name=$1, city=$2, board=$3, grades_offered=$4, logo=$5, approximate_students=$6, onboarding_complete=$7
       WHERE id=$8 RETURNING *`,
      [
        data.name,
        data.city ?? null,
        data.board ?? null,
        data.gradesOffered ?? [],
        data.logo ?? null,
        data.approximateStudents ?? null,
        data.onboardingComplete ?? false,
        existing.id,
      ]
    );
    return mapSchool(rows[0]);
  }
  const code = await makeUniqueSchoolCode(data.uid);
  const { rows } = await pool.query(
    `INSERT INTO schools (code, name, city, board, grades_offered, logo, approximate_students, created_by_uid, onboarding_complete)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
     RETURNING *`,
    [
      code,
      data.name,
      data.city ?? null,
      data.board ?? null,
      data.gradesOffered ?? [],
      data.logo ?? null,
      data.approximateStudents ?? null,
      data.uid,
      data.onboardingComplete ?? false,
    ]
  );
  return mapSchool(rows[0]);
}

export async function pgUpdateSchoolSize(
  schoolId: number,
  gradesOffered: string[],
  approximateStudents: string
): Promise<PgSchool | null> {
  if (!isPgReady()) return null;
  try {
    const { rows } = await getPgPool().query(
      `UPDATE schools SET grades_offered=$1, approximate_students=$2 WHERE id=$3 RETURNING *`,
      [gradesOffered, approximateStudents, schoolId]
    );
    return rows[0] ? mapSchool(rows[0]) : null;
  } catch (err) {
    logger.error("[pg] pgUpdateSchoolSize failed", { err: String(err) });
    return null;
  }
}

// ─── Invite queries ───────────────────────────────────────────────────────────

export async function pgCreateInvite(data: {
  email: string;
  name?: string | null;
  role: string;
  schoolId?: number | null;
  classId?: string | null;
  grades?: string[];
  token: string;
  invitedBy?: string | null;
  expiresAt: Date;
}): Promise<PgInvite> {
  const pool = getPgPool();
  const { rows } = await pool.query(
    `INSERT INTO invites (email, name, role, school_id, class_id, grades, token, invited_by, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      data.email.toLowerCase(),
      data.name ?? null,
      data.role,
      data.schoolId ?? null,
      data.classId ?? null,
      data.grades ?? [],
      data.token,
      data.invitedBy ?? null,
      data.expiresAt,
    ]
  );
  return mapInvite(rows[0]);
}

export async function pgFindInviteByToken(token: string): Promise<PgInvite | null> {
  if (!isPgReady()) return null;
  try {
    const { rows } = await getPgPool().query("SELECT * FROM invites WHERE token = $1", [token]);
    return rows[0] ? mapInvite(rows[0]) : null;
  } catch (err) {
    logger.error("[pg] pgFindInviteByToken failed", { err: String(err) });
    return null;
  }
}

export async function pgAcceptInvite(token: string): Promise<boolean> {
  if (!isPgReady()) return false;
  try {
    const { rowCount } = await getPgPool().query(
      "UPDATE invites SET status = 'accepted' WHERE token = $1 AND status = 'pending'",
      [token]
    );
    return (rowCount ?? 0) > 0;
  } catch (err) {
    logger.error("[pg] pgAcceptInvite failed", { err: String(err) });
    return false;
  }
}

export async function pgResendInvite(
  inviteId: number,
  newToken: string,
  newExpiry: Date
): Promise<boolean> {
  if (!isPgReady()) return false;
  try {
    const { rowCount } = await getPgPool().query(
      "UPDATE invites SET token=$1, expires_at=$2, status='pending' WHERE id=$3",
      [newToken, newExpiry, inviteId]
    );
    return (rowCount ?? 0) > 0;
  } catch (err) {
    logger.error("[pg] pgResendInvite failed", { err: String(err) });
    return false;
  }
}

// ─── Additional invite / school_class queries ─────────────────────────────────

export interface PgSchoolClass {
  id: number;
  name: string;
  grade: string | null;
  teacherFirebaseUid: string | null;
  schoolId: number | null;
  students: string[];
  createdAt: Date;
}

function mapSchoolClass(r: any): PgSchoolClass {
  return {
    id: n(r.id)!,
    name: r.name,
    grade: r.grade ?? null,
    teacherFirebaseUid: r.teacher_firebase_uid ?? null,
    schoolId: n(r.school_id),
    students: r.students ?? [],
    createdAt: r.created_at,
  };
}

export async function pgFindInviteById(id: number): Promise<PgInvite | null> {
  if (!isPgReady()) return null;
  try {
    const { rows } = await getPgPool().query("SELECT * FROM invites WHERE id = $1", [id]);
    return rows[0] ? mapInvite(rows[0]) : null;
  } catch (err) {
    logger.error("[pg] pgFindInviteById failed", { err: String(err) });
    return null;
  }
}

export async function pgFindInvitesBySchool(schoolId: number, role?: string): Promise<PgInvite[]> {
  if (!isPgReady()) return [];
  try {
    const params: any[] = [schoolId];
    const roleClause = role ? ` AND role = $2` : "";
    if (role) params.push(role);
    const { rows } = await getPgPool().query(
      `SELECT * FROM invites WHERE school_id = $1${roleClause}`,
      params
    );
    return rows.map(mapInvite);
  } catch (err) {
    logger.error("[pg] pgFindInvitesBySchool failed", { err: String(err) });
    return [];
  }
}

export async function pgFindInvitesByInvitedBy(
  invitedBy: string,
  filters?: { role?: string; classId?: string }
): Promise<PgInvite[]> {
  if (!isPgReady()) return [];
  try {
    const conditions = ["invited_by = $1"];
    const params: any[] = [invitedBy];
    let i = 2;
    if (filters?.role) {
      conditions.push(`role = $${i++}`);
      params.push(filters.role);
    }
    if (filters?.classId) {
      conditions.push(`class_id = $${i++}`);
      params.push(filters.classId);
    }
    const { rows } = await getPgPool().query(
      `SELECT * FROM invites WHERE ${conditions.join(" AND ")}`,
      params
    );
    return rows.map(mapInvite);
  } catch (err) {
    logger.error("[pg] pgFindInvitesByInvitedBy failed", { err: String(err) });
    return [];
  }
}

export async function pgCreateSchoolClass(data: {
  name: string;
  grade?: string | null;
  teacherFirebaseUid: string;
  schoolId?: number | null;
}): Promise<PgSchoolClass> {
  const pool = getPgPool();
  const { rows } = await pool.query(
    `INSERT INTO school_classes (name, grade, teacher_firebase_uid, school_id)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [data.name, data.grade ?? null, data.teacherFirebaseUid, data.schoolId ?? null]
  );
  return mapSchoolClass(rows[0]);
}

export async function pgFindSchoolClassesByTeacher(uid: string): Promise<PgSchoolClass[]> {
  if (!isPgReady()) return [];
  try {
    const { rows } = await getPgPool().query(
      "SELECT * FROM school_classes WHERE teacher_firebase_uid = $1",
      [uid]
    );
    return rows.map(mapSchoolClass);
  } catch (err) {
    logger.error("[pg] pgFindSchoolClassesByTeacher failed", { err: String(err) });
    return [];
  }
}

export async function pgFindSchoolClassesBySchoolId(schoolId: number): Promise<PgSchoolClass[]> {
  if (!isPgReady()) return [];
  try {
    const { rows } = await getPgPool().query(
      "SELECT * FROM school_classes WHERE school_id = $1 ORDER BY created_at DESC",
      [schoolId]
    );
    return rows.map(mapSchoolClass);
  } catch (err) {
    logger.error("[pg] pgFindSchoolClassesBySchoolId failed", { err: String(err) });
    return [];
  }
}

export async function pgDeleteSchoolClass(id: number): Promise<boolean> {
  if (!isPgReady()) return false;
  try {
    const { rowCount } = await getPgPool().query("DELETE FROM school_classes WHERE id = $1", [id]);
    return (rowCount ?? 0) > 0;
  } catch (err) {
    logger.error("[pg] pgDeleteSchoolClass failed", { err: String(err) });
    return false;
  }
}

export async function pgUpdateSchoolClass(
  id: number,
  data: { name?: string; grade?: string }
): Promise<PgSchoolClass | null> {
  if (!isPgReady()) return null;
  try {
    const updates = [];
    const params: any[] = [id];
    let idx = 2;
    if (data.name) {
      updates.push(`name = $${idx++}`);
      params.push(data.name);
    }
    if (data.grade) {
      updates.push(`grade = $${idx++}`);
      params.push(data.grade);
    }
    if (updates.length === 0) return pgFindSchoolClassById(id);

    const { rows } = await getPgPool().query(
      `UPDATE school_classes SET ${updates.join(", ")} WHERE id = $1 RETURNING *`,
      params
    );
    return rows.length ? mapSchoolClass(rows[0]) : null;
  } catch (err) {
    logger.error("[pg] pgUpdateSchoolClass failed", { err: String(err) });
    return null;
  }
}
export async function pgFindSchoolClassById(id: number): Promise<PgSchoolClass | null> {
  if (!isPgReady()) return null;
  try {
    const { rows } = await getPgPool().query("SELECT * FROM school_classes WHERE id = $1", [id]);
    return rows[0] ? mapSchoolClass(rows[0]) : null;
  } catch (err) {
    logger.error("[pg] pgFindSchoolClassById failed", { err: String(err) });
    return null;
  }
}

export async function pgUpdateUserOnboardingComplete(userId: number): Promise<void> {
  if (!isPgReady()) return;
  try {
    await getPgPool().query("UPDATE users SET onboarding_complete = true WHERE id = $1", [userId]);
  } catch (err) {
    logger.error("[pg] pgUpdateUserOnboardingComplete failed", { err: String(err) });
  }
}

// ─── Workspace tenancy queries ───────────────────────────────────────────────

export async function pgCreateWorkspace(data: {
  name: string;
  slug?: string | null;
  type?: "business" | "school" | "personal";
  description?: string | null;
  ownerId: number;
  members?: number[];
}): Promise<PgWorkspace> {
  const members = Array.from(new Set([data.ownerId, ...(data.members ?? [])]));
  const { rows } = await getPgPool().query(
    `INSERT INTO workspaces (name, slug, type, description, owner_id, members)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [
      data.name,
      data.slug ?? null,
      data.type ?? "business",
      data.description ?? null,
      data.ownerId,
      members,
    ]
  );
  return mapWorkspace(rows[0]);
}

export async function pgFindWorkspaceById(id: number): Promise<PgWorkspace | null> {
  if (!isPgReady()) return null;
  try {
    const { rows } = await getPgPool().query("SELECT * FROM workspaces WHERE id = $1", [id]);
    return rows[0] ? mapWorkspace(rows[0]) : null;
  } catch (err) {
    logger.error("[pg] pgFindWorkspaceById failed", { err: String(err) });
    return null;
  }
}

export async function pgFindWorkspaceBySlug(slug: string): Promise<PgWorkspace | null> {
  if (!isPgReady()) return null;
  try {
    const { rows } = await getPgPool().query("SELECT * FROM workspaces WHERE slug = $1", [slug]);
    return rows[0] ? mapWorkspace(rows[0]) : null;
  } catch (err) {
    logger.error("[pg] pgFindWorkspaceBySlug failed", { err: String(err) });
    return null;
  }
}

export async function pgUpsertWorkspaceMembership(data: {
  workspaceId: number;
  userId: number;
  role: "owner" | "admin" | "co-teacher" | "teaching-assistant" | "member" | "auditor";
  status?: string;
}): Promise<PgWorkspaceMembership> {
  const { rows } = await getPgPool().query(
    `INSERT INTO workspace_memberships (workspace_id, user_id, role, status)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (workspace_id, user_id)
       DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status
     RETURNING *`,
    [data.workspaceId, data.userId, data.role, data.status ?? "active"]
  );
  await getPgPool().query(
    `UPDATE workspaces SET members = (
       SELECT ARRAY(SELECT DISTINCT unnest(array_append(members, $1::bigint)))
     ) WHERE id = $2`,
    [data.userId, data.workspaceId]
  );
  return mapWorkspaceMembership(rows[0]);
}

export async function pgFindWorkspaceMembership(
  workspaceId: number,
  userId: number
): Promise<PgWorkspaceMembership | null> {
  if (!isPgReady()) return null;
  try {
    const { rows } = await getPgPool().query(
      "SELECT * FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2",
      [workspaceId, userId]
    );
    return rows[0] ? mapWorkspaceMembership(rows[0]) : null;
  } catch (err) {
    logger.error("[pg] pgFindWorkspaceMembership failed", { err: String(err) });
    return null;
  }
}

export async function pgFindFirstWorkspaceMembership(userId: number): Promise<{
  workspace: PgWorkspace;
  membership: PgWorkspaceMembership;
} | null> {
  if (!isPgReady()) return null;
  try {
    const { rows } = await getPgPool().query(
      `SELECT w.*, wm.id AS membership_id, wm.role AS membership_role,
              wm.status AS membership_status, wm.created_at AS membership_created_at
       FROM workspace_memberships wm
       JOIN workspaces w ON w.id = wm.workspace_id
       WHERE wm.user_id = $1 AND wm.status = 'active'
       ORDER BY CASE wm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, wm.created_at
       LIMIT 1`,
      [userId]
    );
    if (!rows[0]) return null;
    return {
      workspace: mapWorkspace(rows[0]),
      membership: mapWorkspaceMembership({
        id: rows[0].membership_id,
        workspace_id: rows[0].id,
        user_id: userId,
        role: rows[0].membership_role,
        status: rows[0].membership_status,
        created_at: rows[0].membership_created_at,
      }),
    };
  } catch (err) {
    logger.error("[pg] pgFindFirstWorkspaceMembership failed", { err: String(err) });
    return null;
  }
}

export async function pgCreateWorkspaceInvite(data: {
  workspaceId: number;
  email: string;
  name?: string | null;
  role: "admin" | "co-teacher" | "teaching-assistant" | "member" | "auditor";
  kind: "business_member" | "student";
  tokenHash: string;
  invitedBy?: number | null;
  studentMeta?: Record<string, any>;
  expiresAt: Date;
}): Promise<PgWorkspaceInvite> {
  const { rows } = await getPgPool().query(
    `INSERT INTO workspace_invites
       (workspace_id, email, name, role, kind, token_hash, invited_by, student_meta, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      data.workspaceId,
      data.email.toLowerCase().trim(),
      data.name ?? null,
      data.role,
      data.kind,
      data.tokenHash,
      data.invitedBy ?? null,
      JSON.stringify(data.studentMeta ?? {}),
      data.expiresAt,
    ]
  );
  return mapWorkspaceInvite(rows[0]);
}

export async function pgFindWorkspaceInviteByTokenHash(
  tokenHash: string
): Promise<PgWorkspaceInvite | null> {
  if (!isPgReady()) return null;
  try {
    const { rows } = await getPgPool().query(
      "SELECT * FROM workspace_invites WHERE token_hash = $1",
      [tokenHash]
    );
    return rows[0] ? mapWorkspaceInvite(rows[0]) : null;
  } catch (err) {
    logger.error("[pg] pgFindWorkspaceInviteByTokenHash failed", { err: String(err) });
    return null;
  }
}

export async function pgAcceptWorkspaceInvite(id: number): Promise<void> {
  await getPgPool().query(
    "UPDATE workspace_invites SET status = 'accepted', accepted_at = now() WHERE id = $1",
    [id]
  );
}

// ─── Workspace v2 queries ─────────────────────────────────────────────────────

export async function pgListUserWorkspaces(userId: number): Promise<
  Array<{
    workspace: PgWorkspace;
    membership: PgWorkspaceMembership;
  }>
> {
  if (!isPgReady()) return [];
  try {
    const { rows } = await getPgPool().query(
      `SELECT w.*, wm.id AS membership_id, wm.role AS membership_role,
              wm.status AS membership_status, wm.created_at AS membership_created_at
       FROM workspace_memberships wm
       JOIN workspaces w ON w.id = wm.workspace_id
       WHERE wm.user_id = $1 AND wm.status = 'active'
       ORDER BY wm.created_at`,
      [userId]
    );
    return rows.map((r) => ({
      workspace: mapWorkspace(r),
      membership: mapWorkspaceMembership({
        id: r.membership_id,
        workspace_id: r.id,
        user_id: userId,
        role: r.membership_role,
        status: r.membership_status,
        created_at: r.membership_created_at,
      }),
    }));
  } catch (err) {
    logger.error("[pg] pgListUserWorkspaces failed", { err: String(err) });
    return [];
  }
}

export async function pgListWorkspaceMembers(workspaceId: number): Promise<
  Array<{
    user: Pick<PgUser, "id" | "email" | "displayName" | "name" | "avatar" | "role">;
    membership: PgWorkspaceMembership;
  }>
> {
  if (!isPgReady()) return [];
  try {
    const { rows } = await getPgPool().query(
      `SELECT u.id, u.email, u.display_name, u.name, u.avatar, u.role AS user_role,
              wm.id AS membership_id, wm.workspace_id, wm.user_id, wm.role AS membership_role,
              wm.status, wm.created_at
       FROM workspace_memberships wm
       JOIN users u ON u.id = wm.user_id
       WHERE wm.workspace_id = $1
       ORDER BY CASE wm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, wm.created_at`,
      [workspaceId]
    );
    return rows.map((r) => ({
      user: {
        id: n(r.id)!,
        email: r.email,
        displayName: r.display_name ?? null,
        name: r.name ?? "",
        avatar: r.avatar ?? null,
        role: r.user_role,
      },
      membership: mapWorkspaceMembership({
        id: r.membership_id,
        workspace_id: r.workspace_id,
        user_id: r.user_id,
        role: r.membership_role,
        status: r.status,
        created_at: r.created_at,
      }),
    }));
  } catch (err) {
    logger.error("[pg] pgListWorkspaceMembers failed", { err: String(err) });
    return [];
  }
}

export async function pgListWorkspaceInvites(workspaceId: number): Promise<any[]> {
  if (!isPgReady()) return [];
  try {
    const { rows } = await getPgPool().query(
      `SELECT wi.*, u.email AS inviter_email, u.name AS inviter_name
       FROM workspace_invites wi
       LEFT JOIN users u ON u.id = wi.invited_by
       WHERE wi.workspace_id = $1
       ORDER BY wi.created_at DESC`,
      [workspaceId]
    );
    return rows.map((r) => ({
      id: n(r.id)!,
      workspaceId: n(r.workspace_id)!,
      email: r.email,
      name: r.name ?? null,
      role: r.role,
      kind: r.kind,
      status: r.status,
      invitedBy: r.invited_by
        ? { id: n(r.invited_by), email: r.inviter_email, name: r.inviter_name }
        : null,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
    }));
  } catch (err) {
    logger.error("[pg] pgListWorkspaceInvites failed", { err: String(err) });
    return [];
  }
}

export async function pgRevokeWorkspaceInvite(
  inviteId: number,
  workspaceId: number
): Promise<void> {
  if (!isPgReady()) return;
  try {
    await getPgPool().query(
      "UPDATE workspace_invites SET status = 'revoked' WHERE id = $1 AND workspace_id = $2",
      [inviteId, workspaceId]
    );
  } catch (err) {
    logger.error("[pg] pgRevokeWorkspaceInvite failed", { err: String(err) });
  }
}

/**
 * Re-arm an invite: mint a fresh token hash, push the expiry out, and reset the
 * row back to `pending` (so an expired/revoked invite can be re-sent). Returns
 * the updated row so the caller can re-send the email with the right
 * email/name/kind without a second round-trip.
 */
export async function pgResendWorkspaceInvite(
  inviteId: number,
  workspaceId: number,
  newTokenHash: string,
  expiresAt: Date
): Promise<PgWorkspaceInvite | null> {
  if (!isPgReady()) return null;
  try {
    const { rows } = await getPgPool().query(
      `UPDATE workspace_invites
         SET token_hash = $1, expires_at = $2, status = 'pending', accepted_at = NULL
       WHERE id = $3 AND workspace_id = $4
       RETURNING *`,
      [newTokenHash, expiresAt, inviteId, workspaceId]
    );
    return rows[0] ? mapWorkspaceInvite(rows[0]) : null;
  } catch (err) {
    logger.error("[pg] pgResendWorkspaceInvite failed", { err: String(err) });
    return null;
  }
}

/** Find a still-pending invite for an email in a workspace (used to dedupe). */
export async function pgFindPendingWorkspaceInviteByEmail(
  workspaceId: number,
  email: string
): Promise<PgWorkspaceInvite | null> {
  if (!isPgReady()) return null;
  try {
    const { rows } = await getPgPool().query(
      `SELECT * FROM workspace_invites
       WHERE workspace_id = $1 AND lower(email) = lower($2) AND status = 'pending'
       ORDER BY created_at DESC LIMIT 1`,
      [workspaceId, email.trim()]
    );
    return rows[0] ? mapWorkspaceInvite(rows[0]) : null;
  } catch (err) {
    logger.error("[pg] pgFindPendingWorkspaceInviteByEmail failed", { err: String(err) });
    return null;
  }
}

export async function pgDeleteWorkspace(id: number): Promise<void> {
  if (!isPgReady()) return;
  try {
    await getPgPool().query("DELETE FROM workspaces WHERE id = $1", [id]);
  } catch (err) {
    logger.error("[pg] pgDeleteWorkspace failed", { err: String(err) });
    throw err;
  }
}

export async function pgUpdateWorkspace(
  id: number,
  data: { name?: string; description?: string; iconUrl?: string; settings?: Record<string, any> }
): Promise<PgWorkspace | null> {
  if (!isPgReady()) return null;
  try {
    const columnMap: Record<string, string> = {
      name: "name",
      description: "description",
      iconUrl: "icon_url",
      settings: "settings",
    };
    const sets: string[] = [];
    const params: any[] = [];
    let i = 1;
    for (const [k, col] of Object.entries(columnMap)) {
      if (k in data) {
        sets.push(`${col} = $${i++}`);
        const val = (data as any)[k];
        params.push(k === "settings" ? JSON.stringify(val) : val);
      }
    }
    if (!sets.length) return pgFindWorkspaceById(id);
    params.push(id);
    const { rows } = await getPgPool().query(
      `UPDATE workspaces SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
      params
    );
    return rows[0] ? mapWorkspace(rows[0]) : null;
  } catch (err) {
    logger.error("[pg] pgUpdateWorkspace failed", { err: String(err) });
    return null;
  }
}

export async function pgGetWorkspaceOnboardingProgress(workspaceId: number): Promise<{
  hasMembers: boolean;
  hasChannels: boolean;
  hasClasses: boolean;
}> {
  if (!isPgReady()) return { hasMembers: false, hasChannels: false, hasClasses: false };
  try {
    const pool = getPgPool();
    const [membersRes, channelsRes, classesRes] = await Promise.all([
      pool.query(
        "SELECT COUNT(*) FROM workspace_memberships WHERE workspace_id = $1 AND status = 'active'",
        [workspaceId]
      ),
      pool.query("SELECT COUNT(*) FROM channels WHERE workspace_id = $1", [workspaceId]),
      pool.query("SELECT COUNT(*) FROM live_classes WHERE workspace_id = $1", [workspaceId]),
    ]);
    const memberCount = parseInt(membersRes.rows[0].count, 10);
    const channelCount = parseInt(channelsRes.rows[0].count, 10);
    const classCount = parseInt(classesRes.rows[0].count, 10);
    return {
      hasMembers: memberCount > 1,
      hasChannels: channelCount > 0,
      hasClasses: classCount > 0,
    };
  } catch (err) {
    logger.error("[pg] pgGetWorkspaceOnboardingProgress failed", { err: String(err) });
    return { hasMembers: false, hasChannels: false, hasClasses: false };
  }
}

// ─── GradingResult queries ────────────────────────────────────────────────────

export async function pgCreateGradingResult(data: {
  submissionId: string;
  studentId: number;
  teacherId: number;
  rubric: any;
  status?: string;
  modelUsed?: string | null;
  processingTimeMs?: number | null;
  scoreBreakdown?: any | null;
  overallFeedback?: string | null;
  strengths?: string[];
  areasForImprovement?: string[];
  attachments?: string[];
  contentType?: string;
  completedAt?: Date | null;
}): Promise<PgGradingResult> {
  const pool = getPgPool();
  const { rows } = await pool.query(
    `INSERT INTO grading_results
       (submission_id, student_id, teacher_id, rubric, status, model_used, processing_time_ms,
        score_breakdown, overall_feedback, strengths, areas_for_improvement, attachments,
        content_type, completed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING *`,
    [
      data.submissionId,
      data.studentId,
      data.teacherId,
      JSON.stringify(data.rubric),
      data.status ?? "pending",
      data.modelUsed ?? null,
      data.processingTimeMs ?? null,
      data.scoreBreakdown ? JSON.stringify(data.scoreBreakdown) : null,
      data.overallFeedback ?? null,
      data.strengths ?? [],
      data.areasForImprovement ?? [],
      data.attachments ?? [],
      data.contentType ?? "text",
      data.completedAt ?? null,
    ]
  );
  return mapGradingResult(rows[0]);
}

export async function pgFindGradingResultBySubmissionId(
  submissionId: string
): Promise<PgGradingResult | null> {
  if (!isPgReady()) return null;
  try {
    const { rows } = await getPgPool().query(
      "SELECT * FROM grading_results WHERE submission_id = $1",
      [submissionId]
    );
    return rows[0] ? mapGradingResult(rows[0]) : null;
  } catch (err) {
    logger.error("[pg] pgFindGradingResultBySubmissionId failed", { err: String(err) });
    return null;
  }
}

export async function pgFindGradingResults(filters: {
  teacherId?: number;
  studentId?: number;
  status?: string;
  skip?: number;
  limit?: number;
}): Promise<PgGradingResult[]> {
  if (!isPgReady()) return [];
  try {
    const conditions: string[] = [];
    const params: any[] = [];
    let i = 1;
    if (filters.teacherId != null) {
      conditions.push(`teacher_id = $${i++}`);
      params.push(filters.teacherId);
    }
    if (filters.studentId != null) {
      conditions.push(`student_id = $${i++}`);
      params.push(filters.studentId);
    }
    if (filters.status) {
      conditions.push(`status = $${i++}`);
      params.push(filters.status);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = filters.limit ?? 50;
    const skip = filters.skip ?? 0;
    params.push(limit, skip);
    const { rows } = await getPgPool().query(
      `SELECT * FROM grading_results ${where} ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i++}`,
      params
    );
    return rows.map(mapGradingResult);
  } catch (err) {
    logger.error("[pg] pgFindGradingResults failed", { err: String(err) });
    return [];
  }
}

export async function pgCountGradingResults(filters: {
  teacherId?: number;
  studentId?: number;
  status?: string;
}): Promise<number> {
  if (!isPgReady()) return 0;
  try {
    const conditions: string[] = [];
    const params: any[] = [];
    let i = 1;
    if (filters.teacherId != null) {
      conditions.push(`teacher_id = $${i++}`);
      params.push(filters.teacherId);
    }
    if (filters.studentId != null) {
      conditions.push(`student_id = $${i++}`);
      params.push(filters.studentId);
    }
    if (filters.status) {
      conditions.push(`status = $${i++}`);
      params.push(filters.status);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await getPgPool().query(
      `SELECT COUNT(*) FROM grading_results ${where}`,
      params
    );
    return parseInt(rows[0].count, 10);
  } catch (err) {
    logger.error("[pg] pgCountGradingResults failed", { err: String(err) });
    return 0;
  }
}

export async function pgUpdateGradingResult(
  submissionId: string,
  data: {
    status?: string;
    scoreBreakdown?: any;
    overallFeedback?: string | null;
    strengths?: string[];
    areasForImprovement?: string[];
    processingTimeMs?: number | null;
    modelUsed?: string | null;
    completedAt?: Date | null;
  }
): Promise<PgGradingResult | null> {
  if (!isPgReady()) return null;
  try {
    const sets: string[] = [];
    const params: any[] = [];
    let i = 1;
    if (data.status !== undefined) {
      sets.push(`status = $${i++}`);
      params.push(data.status);
    }
    if (data.scoreBreakdown !== undefined) {
      sets.push(`score_breakdown = $${i++}`);
      params.push(JSON.stringify(data.scoreBreakdown));
    }
    if (data.overallFeedback !== undefined) {
      sets.push(`overall_feedback = $${i++}`);
      params.push(data.overallFeedback);
    }
    if (data.strengths !== undefined) {
      sets.push(`strengths = $${i++}`);
      params.push(data.strengths);
    }
    if (data.areasForImprovement !== undefined) {
      sets.push(`areas_for_improvement = $${i++}`);
      params.push(data.areasForImprovement);
    }
    if (data.processingTimeMs !== undefined) {
      sets.push(`processing_time_ms = $${i++}`);
      params.push(data.processingTimeMs);
    }
    if (data.modelUsed !== undefined) {
      sets.push(`model_used = $${i++}`);
      params.push(data.modelUsed);
    }
    if (data.completedAt !== undefined) {
      sets.push(`completed_at = $${i++}`);
      params.push(data.completedAt);
    }
    if (!sets.length) return pgFindGradingResultBySubmissionId(submissionId);
    params.push(submissionId);
    const { rows } = await getPgPool().query(
      `UPDATE grading_results SET ${sets.join(", ")} WHERE submission_id = $${i} RETURNING *`,
      params
    );
    return rows[0] ? mapGradingResult(rows[0]) : null;
  } catch (err) {
    logger.error("[pg] pgUpdateGradingResult failed", { err: String(err) });
    return null;
  }
}

export async function pgDeleteGradingResult(submissionId: string): Promise<boolean> {
  if (!isPgReady()) return false;
  try {
    const { rowCount } = await getPgPool().query(
      "DELETE FROM grading_results WHERE submission_id = $1",
      [submissionId]
    );
    return (rowCount ?? 0) > 0;
  } catch (err) {
    logger.error("[pg] pgDeleteGradingResult failed", { err: String(err) });
    return false;
  }
}

export async function pgUpdateGradingResultById(
  id: number,
  data: {
    score?: number;
    feedback?: string;
    status?: string;
  }
): Promise<PgGradingResult | null> {
  if (!isPgReady()) return null;
  try {
    const sets: string[] = [];
    const params: any[] = [];
    let i = 1;
    if (data.score !== undefined) {
      sets.push(`score_breakdown = score_breakdown || $${i++}::jsonb`);
      params.push(JSON.stringify({ overriddenScore: data.score }));
    }
    if (data.feedback !== undefined) {
      sets.push(`overall_feedback = $${i++}`);
      params.push(data.feedback);
    }
    if (data.status !== undefined) {
      sets.push(`status = $${i++}`);
      params.push(data.status);
    }
    if (!sets.length) return null;
    params.push(id);
    const { rows } = await getPgPool().query(
      `UPDATE grading_results SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
      params
    );
    return rows[0] ? mapGradingResult(rows[0]) : null;
  } catch (err) {
    logger.error("[pg] pgUpdateGradingResultById failed", { err: String(err) });
    return null;
  }
}

// ─── Subscription queries ─────────────────────────────────────────────────────

export async function pgFindSubscriptionByUser(userId: number): Promise<PgSubscription | null> {
  if (!isPgReady()) return null;
  try {
    const { rows } = await getPgPool().query(
      "SELECT * FROM subscriptions WHERE user_id = $1 AND status = 'active' LIMIT 1",
      [userId]
    );
    return rows[0] ? mapSubscription(rows[0]) : null;
  } catch (err) {
    logger.error("[pg] pgFindSubscriptionByUser failed", { err: String(err) });
    return null;
  }
}

export async function pgFindSubscriptionByStripeCustomer(
  stripeCustomerId: string
): Promise<PgSubscription | null> {
  if (!isPgReady()) return null;
  try {
    const { rows } = await getPgPool().query(
      "SELECT * FROM subscriptions WHERE stripe_customer_id = $1 LIMIT 1",
      [stripeCustomerId]
    );
    return rows[0] ? mapSubscription(rows[0]) : null;
  } catch (err) {
    logger.error("[pg] pgFindSubscriptionByStripeCustomer failed", { err: String(err) });
    return null;
  }
}

export async function pgUpsertSubscription(
  userId: number,
  data: {
    tier?: string;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    status?: string;
    currentPeriodStart?: Date | null;
    currentPeriodEnd?: Date | null;
    cancelAtPeriodEnd?: boolean;
  }
): Promise<PgSubscription> {
  const pool = getPgPool();
  const { rows } = await pool.query(
    `INSERT INTO subscriptions (user_id, tier, stripe_customer_id, stripe_subscription_id,
       status, current_period_start, current_period_end, cancel_at_period_end)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (user_id)
       DO UPDATE SET
         tier = EXCLUDED.tier,
         stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, subscriptions.stripe_customer_id),
         status = EXCLUDED.status,
         current_period_start = EXCLUDED.current_period_start,
         current_period_end = EXCLUDED.current_period_end,
         cancel_at_period_end = EXCLUDED.cancel_at_period_end,
         updated_at = now()
     RETURNING *`,
    [
      userId,
      data.tier ?? "free",
      data.stripeCustomerId ?? null,
      data.stripeSubscriptionId ?? null,
      data.status ?? "active",
      data.currentPeriodStart ?? null,
      data.currentPeriodEnd ?? null,
      data.cancelAtPeriodEnd ?? false,
    ]
  );
  return mapSubscription(rows[0]);
}

export async function pgUpdateSubscriptionByStripeCustomer(
  stripeCustomerId: string,
  data: {
    status?: string;
    tier?: string;
    currentPeriodStart?: Date | null;
    currentPeriodEnd?: Date | null;
    cancelAtPeriodEnd?: boolean;
    stripeSubscriptionId?: string | null;
  }
): Promise<void> {
  if (!isPgReady()) return;
  try {
    const sets: string[] = ["updated_at = now()"];
    const params: any[] = [];
    let i = 1;
    if (data.status !== undefined) {
      sets.push(`status = $${i++}`);
      params.push(data.status);
    }
    if (data.tier !== undefined) {
      sets.push(`tier = $${i++}`);
      params.push(data.tier);
    }
    if (data.currentPeriodStart !== undefined) {
      sets.push(`current_period_start = $${i++}`);
      params.push(data.currentPeriodStart);
    }
    if (data.currentPeriodEnd !== undefined) {
      sets.push(`current_period_end = $${i++}`);
      params.push(data.currentPeriodEnd);
    }
    if (data.cancelAtPeriodEnd !== undefined) {
      sets.push(`cancel_at_period_end = $${i++}`);
      params.push(data.cancelAtPeriodEnd);
    }
    if (data.stripeSubscriptionId !== undefined) {
      sets.push(`stripe_subscription_id = $${i++}`);
      params.push(data.stripeSubscriptionId);
    }
    params.push(stripeCustomerId);
    await getPgPool().query(
      `UPDATE subscriptions SET ${sets.join(", ")} WHERE stripe_customer_id = $${i}`,
      params
    );
  } catch (err) {
    logger.error("[pg] pgUpdateSubscriptionByStripeCustomer failed", { err: String(err) });
  }
}

// ─── AIClassroom queries ──────────────────────────────────────────────────────

export async function pgCreateAIClassroom(data: {
  teacherId: number;
  topic: string;
  studyArenaJobId: string;
  status?: string;
}): Promise<PgAIClassroom> {
  const pool = getPgPool();
  const { rows } = await pool.query(
    `INSERT INTO ai_classrooms (teacher_id, topic, study_arena_job_id, status)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [data.teacherId, data.topic, data.studyArenaJobId, data.status ?? "pending"]
  );
  return mapAIClassroom(rows[0]);
}

export async function pgFindAIClassroomById(id: number): Promise<PgAIClassroom | null> {
  if (!isPgReady()) return null;
  try {
    const { rows } = await getPgPool().query("SELECT * FROM ai_classrooms WHERE id = $1", [id]);
    return rows[0] ? mapAIClassroom(rows[0]) : null;
  } catch (err) {
    logger.error("[pg] pgFindAIClassroomById failed", { err: String(err) });
    return null;
  }
}

export async function pgFindAIClassroomByJobId(jobId: string): Promise<PgAIClassroom | null> {
  if (!isPgReady()) return null;
  try {
    const { rows } = await getPgPool().query(
      "SELECT * FROM ai_classrooms WHERE study_arena_job_id = $1",
      [jobId]
    );
    return rows[0] ? mapAIClassroom(rows[0]) : null;
  } catch (err) {
    logger.error("[pg] pgFindAIClassroomByJobId failed", { err: String(err) });
    return null;
  }
}

export async function pgUpdateAIClassroom(
  id: number,
  data: {
    status?: string;
    data?: any;
  }
): Promise<PgAIClassroom | null> {
  if (!isPgReady()) return null;
  try {
    const sets: string[] = [];
    const params: any[] = [];
    let i = 1;
    if (data.status !== undefined) {
      sets.push(`status = $${i++}`);
      params.push(data.status);
    }
    if (data.data !== undefined) {
      sets.push(`data = $${i++}`);
      params.push(JSON.stringify(data.data));
    }
    if (!sets.length) return pgFindAIClassroomById(id);
    params.push(id);
    const { rows } = await getPgPool().query(
      `UPDATE ai_classrooms SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
      params
    );
    return rows[0] ? mapAIClassroom(rows[0]) : null;
  } catch (err) {
    logger.error("[pg] pgUpdateAIClassroom failed", { err: String(err) });
    return null;
  }
}

export async function pgDeleteAIClassroom(id: number): Promise<boolean> {
  if (!isPgReady()) return false;
  try {
    const { rowCount } = await getPgPool().query("DELETE FROM ai_classrooms WHERE id = $1", [id]);
    return (rowCount ?? 0) > 0;
  } catch (err) {
    logger.error("[pg] pgDeleteAIClassroom failed", { err: String(err) });
    return false;
  }
}

export async function pgFindAIClassroomsByTeacher(
  teacherId: number,
  skip = 0,
  limit = 20
): Promise<PgAIClassroom[]> {
  if (!isPgReady()) return [];
  try {
    const { rows } = await getPgPool().query(
      "SELECT * FROM ai_classrooms WHERE teacher_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
      [teacherId, limit, skip]
    );
    return rows.map(mapAIClassroom);
  } catch (err) {
    logger.error("[pg] pgFindAIClassroomsByTeacher failed", { err: String(err) });
    return [];
  }
}

export async function pgCountAIClassrooms(teacherId: number): Promise<number> {
  if (!isPgReady()) return 0;
  try {
    const { rows } = await getPgPool().query(
      "SELECT COUNT(*) FROM ai_classrooms WHERE teacher_id = $1",
      [teacherId]
    );
    return parseInt(rows[0].count, 10);
  } catch (err) {
    logger.error("[pg] pgCountAIClassrooms failed", { err: String(err) });
    return 0;
  }
}

// ─── LmsConnection queries ────────────────────────────────────────────────────

export async function pgCreateLmsConnection(data: {
  userId: number;
  provider: string;
  accessToken: string;
  refreshToken?: string | null;
  instanceUrl?: string | null;
  tokenExpiry?: Date | null;
}): Promise<PgLmsConnection> {
  const pool = getPgPool();
  const { rows } = await pool.query(
    `INSERT INTO lms_connections (user_id, provider, access_token, refresh_token, instance_url, token_expiry)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (user_id, provider) DO UPDATE SET
       access_token = EXCLUDED.access_token,
       refresh_token = COALESCE(EXCLUDED.refresh_token, lms_connections.refresh_token),
       token_expiry = EXCLUDED.token_expiry,
       updated_at = now()
     RETURNING *`,
    [
      data.userId,
      data.provider,
      data.accessToken,
      data.refreshToken ?? null,
      data.instanceUrl ?? null,
      data.tokenExpiry ?? null,
    ]
  );
  return mapLmsConnection(rows[0]);
}

export async function pgFindLmsConnection(
  userId: number,
  provider: string
): Promise<PgLmsConnection | null> {
  if (!isPgReady()) return null;
  try {
    const { rows } = await getPgPool().query(
      "SELECT * FROM lms_connections WHERE user_id = $1 AND provider = $2",
      [userId, provider]
    );
    return rows[0] ? mapLmsConnection(rows[0]) : null;
  } catch (err) {
    logger.error("[pg] pgFindLmsConnection failed", { err: String(err) });
    return null;
  }
}

// ─── Test count (educator dashboard) ─────────────────────────────────────────

export async function pgCountTests(teacherId: number): Promise<number> {
  if (!isPgReady()) return 0;
  try {
    const { rows } = await getPgPool().query("SELECT COUNT(*) FROM tests WHERE teacher_id = $1", [
      teacherId,
    ]);
    return parseInt(rows[0].count, 10);
  } catch (err) {
    logger.error("[pg] pgCountTests failed", { err: String(err) });
    return 0;
  }
}

// ─── Timetable queries ────────────────────────────────────────────────────────

export async function pgGetTimetableByWorkspace(workspaceId: number): Promise<any[]> {
  if (!isPgReady()) return [];
  try {
    const { rows } = await getPgPool().query(
      "SELECT * FROM timetable_slots WHERE workspace_id = $1 ORDER BY day_of_week, period_number",
      [workspaceId]
    );
    return rows;
  } catch (err) {
    logger.error("[pg] pgGetTimetableByWorkspace failed", { err: String(err) });
    return [];
  }
}

export async function pgGetTimetableByClass(
  workspaceId: number,
  className: string
): Promise<any[]> {
  if (!isPgReady()) return [];
  try {
    const { rows } = await getPgPool().query(
      "SELECT * FROM timetable_slots WHERE workspace_id = $1 AND class_name = $2 ORDER BY day_of_week, period_number",
      [workspaceId, className]
    );
    return rows;
  } catch (err) {
    logger.error("[pg] pgGetTimetableByClass failed", { err: String(err) });
    return [];
  }
}

export async function pgCreateTimetableSlot(data: any): Promise<any> {
  const pool = getPgPool();
  const { rows } = await pool.query(
    `INSERT INTO timetable_slots (workspace_id, teacher_id, class_name, subject, day_of_week, period_number, start_time, end_time, room)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      data.workspaceId,
      data.teacherId,
      data.className,
      data.subject,
      data.dayOfWeek,
      data.periodNumber,
      data.startTime,
      data.endTime,
      data.room || null,
    ]
  );
  return rows[0];
}

export async function pgDeleteTimetableSlot(id: number, workspaceId: number): Promise<boolean> {
  if (!isPgReady()) return false;
  try {
    const { rowCount } = await getPgPool().query(
      "DELETE FROM timetable_slots WHERE id = $1 AND workspace_id = $2",
      [id, workspaceId]
    );
    return (rowCount ?? 0) > 0;
  } catch (err) {
    logger.error("[pg] pgDeleteTimetableSlot failed", { err: String(err) });
    return false;
  }
}

// ─── AI Usage queries ─────────────────────────────────────────────────────────

export async function pgGetAIUsage(
  userId: number,
  feature: "ai_classroom" | "ai_tutor" | "ocr"
): Promise<number> {
  if (!isPgReady()) return 0;
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { rows } = await getPgPool().query(
      `SELECT COUNT(*) FROM ai_usage_logs
       WHERE user_id = $1 AND feature = $2 AND created_at >= $3`,
      [userId, feature, startOfMonth]
    );
    return parseInt(rows[0].count, 10);
  } catch (err) {
    logger.error("[pg] pgGetAIUsage failed", { err: String(err) });
    return 0;
  }
}

export async function pgIncrementAIUsage(data: {
  userId: number;
  workspaceId?: number | null;
  feature: "ai_classroom" | "ai_tutor" | "ocr";
  tokensUsed?: number | null;
  metadata?: any;
}): Promise<boolean> {
  if (!isPgReady()) {
    logger.error("[pg] pgIncrementAIUsage skipped: Postgres is not ready", {
      userId: data.userId,
      feature: data.feature,
    });
    return false;
  }
  try {
    await getPgPool().query(
      `INSERT INTO ai_usage_logs (user_id, workspace_id, feature, tokens_used, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        data.userId,
        data.workspaceId ?? null,
        data.feature,
        data.tokensUsed ?? null,
        JSON.stringify(data.metadata || {}),
      ]
    );
    return true;
  } catch (err) {
    logger.error("[pg] pgIncrementAIUsage failed", {
      err: String(err),
      userId: data.userId,
      feature: data.feature,
      usageType: data.metadata?.type,
      lessonId: data.metadata?.lessonId,
    });
    return false;
  }
}

// ─── Learning Resources (Learn hub → Read tab) ───────────────────────────────

export interface PgResource {
  id: number;
  title: string;
  description: string | null;
  type: string;
  subject: string | null;
  topic: string | null;
  url: string | null;
  created_at: string;
}

/**
 * Lists learning resources, optionally filtered by topic / subject / type.
 * `topic` matches case-insensitively against either the topic or the title so a
 * student's free-text topic ("electromagnetism") finds loosely-tagged content.
 */
export async function pgGetResources(filters: {
  topic?: string;
  subject?: string;
  type?: string;
}): Promise<PgResource[]> {
  if (!isPgReady()) return [];
  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (filters.topic) {
    conditions.push(`(lower(topic) LIKE $${i} OR lower(title) LIKE $${i})`);
    params.push(`%${filters.topic.toLowerCase()}%`);
    i++;
  }
  if (filters.subject) {
    conditions.push(`lower(subject) = $${i++}`);
    params.push(filters.subject.toLowerCase());
  }
  if (filters.type) {
    conditions.push(`type = $${i}`);
    params.push(filters.type);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  try {
    const { rows } = await getPgPool().query(
      `SELECT * FROM resources ${where} ORDER BY created_at DESC LIMIT 60`,
      params
    );
    return rows as PgResource[];
  } catch (err) {
    logger.error("[pg] pgGetResources failed", { err: String(err) });
    return [];
  }
}

// ─── Fees (revenue side of the operational moat) ─────────────────────────────

export type FeeStatus = "pending" | "paid" | "waived";

/** Create a fee for a student. Returns the new row's id, or null on failure. */
export async function pgCreateFee(params: {
  studentId: number;
  schoolCode: string | null;
  description: string;
  amountCents: number;
  currency?: string;
  dueDate?: string | null;
  createdBy: number;
}): Promise<number | null> {
  if (!isPgReady()) return null;
  try {
    const { rows } = await getPgPool().query(
      `INSERT INTO fees (student_id, school_code, description, amount_cents, currency, due_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        params.studentId,
        params.schoolCode,
        params.description,
        params.amountCents,
        params.currency ?? "INR",
        params.dueDate ?? null,
        params.createdBy,
      ]
    );
    return rows[0]?.id ?? null;
  } catch (err) {
    logger.error("[pg] pgCreateFee failed", { err: String(err) });
    return null;
  }
}

/** List fees, filtered/scoped by school, student, and/or status. */
export async function pgGetFees(params: {
  schoolCode?: string;
  studentId?: number;
  status?: FeeStatus;
}): Promise<any[]> {
  if (!isPgReady()) return [];
  try {
    const conditions: string[] = [];
    const values: any[] = [];
    if (params.schoolCode) {
      conditions.push(`f.school_code = $${values.length + 1}`);
      values.push(params.schoolCode);
    }
    if (params.studentId != null) {
      conditions.push(`f.student_id = $${values.length + 1}`);
      values.push(params.studentId);
    }
    if (params.status) {
      conditions.push(`f.status = $${values.length + 1}`);
      values.push(params.status);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await getPgPool().query(
      `SELECT f.id, f.student_id AS "studentId", u.name AS "studentName", u.parent_phone AS "parentPhone", f.description,
              f.amount_cents AS "amountCents", f.currency, f.status,
              f.due_date AS "dueDate", f.paid_at AS "paidAt"
         FROM fees f JOIN users u ON u.id = f.student_id
         ${where}
        ORDER BY f.created_at DESC`,
      values
    );
    return rows;
  } catch (err) {
    logger.error("[pg] pgGetFees failed", { err: String(err) });
    return [];
  }
}

/** Fetch a single fee by id (with student name), or null. */
export async function pgGetFeeById(id: number): Promise<any | null> {
  if (!isPgReady()) return null;
  try {
    const { rows } = await getPgPool().query(
      `SELECT f.id, f.student_id AS "studentId", u.name AS "studentName", u.parent_phone AS "parentPhone", f.school_code AS "schoolCode",
              f.description, f.amount_cents AS "amountCents", f.currency, f.status,
              f.due_date AS "dueDate", f.paid_at AS "paidAt"
         FROM fees f JOIN users u ON u.id = f.student_id
        WHERE f.id = $1`,
      [id]
    );
    return rows[0] ?? null;
  } catch (err) {
    logger.error("[pg] pgGetFeeById failed", { err: String(err) });
    return null;
  }
}

/**
 * Mark a fee paid. When `schoolCode` is provided the update is scoped to that
 * school (a school admin can't settle another school's fee). Returns true if a
 * row was updated.
 */
export async function pgMarkFeePaid(id: number, schoolCode?: string): Promise<boolean> {
  if (!isPgReady()) return false;
  try {
    const values: any[] = [id];
    let scope = "";
    if (schoolCode) {
      scope = " AND school_code = $2";
      values.push(schoolCode);
    }
    const { rowCount } = await getPgPool().query(
      `UPDATE fees SET status = 'paid', paid_at = now(), updated_at = now()
        WHERE id = $1${scope} AND status <> 'paid'`,
      values
    );
    return (rowCount ?? 0) > 0;
  } catch (err) {
    logger.error("[pg] pgMarkFeePaid failed", { err: String(err) });
    return false;
  }
}

/** Aggregate pending vs paid totals (in minor units), scoped to a school. */
export async function pgGetFeeSummary(params: {
  schoolCode?: string;
}): Promise<{ pendingCents: number; paidCents: number; pendingCount: number; paidCount: number }> {
  const empty = { pendingCents: 0, paidCents: 0, pendingCount: 0, paidCount: 0 };
  if (!isPgReady()) return empty;
  try {
    const values: any[] = [];
    const where = params.schoolCode ? `WHERE school_code = $1` : "";
    if (params.schoolCode) values.push(params.schoolCode);
    const { rows } = await getPgPool().query(
      `SELECT status,
              COALESCE(SUM(amount_cents), 0)::bigint AS cents,
              COUNT(*)::int AS n
         FROM fees ${where}
        GROUP BY status`,
      values
    );
    const out = { ...empty };
    for (const r of rows) {
      const cents = parseInt(r.cents, 10) || 0;
      if (r.status === "pending") {
        out.pendingCents = cents;
        out.pendingCount = r.n;
      } else if (r.status === "paid") {
        out.paidCents = cents;
        out.paidCount = r.n;
      }
    }
    return out;
  } catch (err) {
    logger.error("[pg] pgGetFeeSummary failed", { err: String(err) });
    return empty;
  }
}

export interface ParentChildStatus {
  id: number;
  name: string;
  className: string | null;
  schoolCode: string | null;
  today: {
    date: string;
    status: AttendanceStatus | null;
    markedAt: string | null;
  };
}

export interface ParentChildAttendanceRow {
  date: string;
  status: AttendanceStatus;
  note: string | null;
  className: string | null;
}

export interface ParentChildFeeSummary {
  pendingCents: number;
  paidCents: number;
  pendingCount: number;
  paidCount: number;
  fees: any[];
}

/** Children linked to a parent, including one date's attendance status. */
export async function pgGetParentChildrenWithStatus(params: {
  parentId: number;
  date: string;
}): Promise<ParentChildStatus[]> {
  if (!isPgReady()) return [];
  try {
    const { rows } = await getPgPool().query(
      `SELECT u.id, u.name, u.class_name AS "className", u.school_code AS "schoolCode",
              a.status, a.updated_at AS "markedAt"
         FROM users u
         LEFT JOIN attendance a ON a.student_id = u.id AND a.date = $2
        WHERE u.parent_id = $1 AND u.role = 'student'
        ORDER BY u.name ASC`,
      [params.parentId, params.date]
    );
    return rows.map((r) => ({
      id: n(r.id)!,
      name: r.name ?? "",
      className: r.className ?? null,
      schoolCode: r.schoolCode ?? null,
      today: {
        date: params.date,
        status: (r.status as AttendanceStatus | null) ?? null,
        markedAt: r.markedAt ? new Date(r.markedAt).toISOString() : null,
      },
    }));
  } catch (err) {
    logger.error("[pg] pgGetParentChildrenWithStatus failed", { err: String(err) });
    return [];
  }
}

/** Attendance history for one child, guarded by parent_id to prevent IDOR. */
export async function pgGetParentChildAttendanceHistory(params: {
  parentId: number;
  studentId: number;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<ParentChildAttendanceRow[] | null> {
  if (!isPgReady()) return [];
  try {
    const ownership = await getPgPool().query(
      `SELECT 1 FROM users WHERE id = $1 AND parent_id = $2 AND role = 'student'`,
      [params.studentId, params.parentId]
    );
    if (!ownership.rowCount) return null;

    const conditions = ["student_id = $1"];
    const values: any[] = [params.studentId];
    if (params.from) {
      conditions.push(`date >= $${values.length + 1}`);
      values.push(params.from);
    }
    if (params.to) {
      conditions.push(`date <= $${values.length + 1}`);
      values.push(params.to);
    }
    const limit = Math.min(Math.max(params.limit ?? 60, 1), 180);
    values.push(limit);
    const { rows } = await getPgPool().query(
      `SELECT date, status, note, class_name AS "className"
         FROM attendance
        WHERE ${conditions.join(" AND ")}
        ORDER BY date DESC
        LIMIT $${values.length}`,
      values
    );
    return rows.map((r) => ({
      date: String(r.date).slice(0, 10),
      status: r.status as AttendanceStatus,
      note: r.note ?? null,
      className: r.className ?? null,
    }));
  } catch (err) {
    logger.error("[pg] pgGetParentChildAttendanceHistory failed", { err: String(err) });
    return [];
  }
}

/** Fee totals/details for one child, guarded by parent_id to prevent IDOR. */
export async function pgGetParentChildFeeSummary(params: {
  parentId: number;
  studentId: number;
}): Promise<ParentChildFeeSummary | null> {
  const empty: ParentChildFeeSummary = {
    pendingCents: 0,
    paidCents: 0,
    pendingCount: 0,
    paidCount: 0,
    fees: [],
  };
  if (!isPgReady()) return empty;
  try {
    const ownership = await getPgPool().query(
      `SELECT 1 FROM users WHERE id = $1 AND parent_id = $2 AND role = 'student'`,
      [params.studentId, params.parentId]
    );
    if (!ownership.rowCount) return null;

    const { rows } = await getPgPool().query(
      `SELECT id, description, amount_cents AS "amountCents", currency, status,
              due_date AS "dueDate", paid_at AS "paidAt"
         FROM fees
        WHERE student_id = $1
        ORDER BY created_at DESC`,
      [params.studentId]
    );
    const out = { ...empty, fees: rows };
    for (const fee of rows) {
      const cents = Number(fee.amountCents) || 0;
      if (fee.status === "pending") {
        out.pendingCents += cents;
        out.pendingCount += 1;
      } else if (fee.status === "paid") {
        out.paidCents += cents;
        out.paidCount += 1;
      }
    }
    return out;
  } catch (err) {
    logger.error("[pg] pgGetParentChildFeeSummary failed", { err: String(err) });
    return empty;
  }
}

// ─── Feature usage (distribution instrumentation) ────────────────────────────

/**
 * Record a single feature use. Fire-and-forget: never throws and never blocks
 * the caller's response — call without awaiting.
 */
export function pgTrackFeatureUsage(params: {
  feature: string;
  userId?: number | null;
  schoolCode?: string | null;
}): void {
  if (!isPgReady()) return;
  getPgPool()
    .query(`INSERT INTO feature_usage (feature, user_id, school_code) VALUES ($1, $2, $3)`, [
      params.feature,
      params.userId ?? null,
      params.schoolCode ?? null,
    ])
    .catch((err) => logger.error("[pg] pgTrackFeatureUsage failed", { err: String(err) }));
}

/**
 * Per-feature usage counts over the last `sinceDays` days, scoped to a school
 * (omit schoolCode for a platform-wide roll-up). Ordered by most-used first.
 */
export async function pgGetFeatureUsageSummary(params: {
  schoolCode?: string;
  sinceDays: number;
}): Promise<{ feature: string; count: number; lastUsed: string | null }[]> {
  if (!isPgReady()) return [];
  try {
    const conditions = ["created_at >= now() - ($1 || ' days')::interval"];
    const values: any[] = [String(params.sinceDays)];
    if (params.schoolCode) {
      conditions.push(`school_code = $${values.length + 1}`);
      values.push(params.schoolCode);
    }
    const { rows } = await getPgPool().query(
      `SELECT feature, COUNT(*)::int AS count, MAX(created_at) AS "lastUsed"
         FROM feature_usage
        WHERE ${conditions.join(" AND ")}
        GROUP BY feature
        ORDER BY count DESC`,
      values
    );
    return rows;
  } catch (err) {
    logger.error("[pg] pgGetFeatureUsageSummary failed", { err: String(err) });
    return [];
  }
}

/** Distinct class names among a school's students (for roster pickers). */
export async function pgGetClassNames(schoolCode?: string): Promise<string[]> {
  if (!isPgReady()) return [];
  try {
    const values: any[] = [];
    const scope = schoolCode ? "AND school_code = $1" : "";
    if (schoolCode) values.push(schoolCode);
    const { rows } = await getPgPool().query(
      `SELECT DISTINCT class_name FROM users
        WHERE role = 'student' AND class_name IS NOT NULL AND class_name <> '' ${scope}
        ORDER BY class_name ASC`,
      values
    );
    return rows.map((r) => r.class_name);
  } catch (err) {
    logger.error("[pg] pgGetClassNames failed", { err: String(err) });
    return [];
  }
}

// ─── Attendance (operational lock-in loop) ───────────────────────────────────

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface AttendanceMark {
  studentId: number;
  status: AttendanceStatus;
  note?: string | null;
}

export interface SchoolAttendanceClassSummary {
  className: string;
  totalStudents: number;
  markedStudents: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  unmarked: number;
}

export interface SchoolAttendanceSummary {
  date: string;
  totals: Omit<SchoolAttendanceClassSummary, "className">;
  classes: SchoolAttendanceClassSummary[];
  unmarkedClasses: string[];
}

/**
 * Upsert attendance for a set of students on a given date (one row per
 * student/day). Scoped by schoolCode so a class's marks stay tenant-isolated.
 * Returns the number of rows written.
 */
export async function pgMarkAttendance(params: {
  schoolCode: string | null;
  className: string | null;
  date: string; // YYYY-MM-DD
  markedAt?: string;
  markedBy: number;
  marks: AttendanceMark[];
}): Promise<number> {
  if (!isPgReady() || params.marks.length === 0) return 0;

  // W-2a: one batched statement in one transaction, and failures PROPAGATE.
  // The old per-row loop swallowed errors and returned 0 while the route
  // replied success:true — the mobile offline queue would dequeue a lost
  // day of marking on that "success". All-or-nothing keeps `written` honest.
  //
  // Dedupe by studentId (last mark wins): a multi-row ON CONFLICT DO UPDATE
  // errors if the same (student_id, date) appears twice in one statement.
  const deduped = [...new Map(params.marks.map((m) => [m.studentId, m])).values()];

  const markedAt = params.markedAt ?? new Date().toISOString();
  const values: unknown[] = [];
  const rows = deduped.map((m, i) => {
    const o = i * 8;
    values.push(
      m.studentId,
      params.schoolCode,
      params.className,
      params.date,
      m.status,
      params.markedBy,
      m.note ?? null,
      markedAt
    );
    return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6}, $${o + 7}, $${o + 8})`;
  });

  const client = await getPgPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      // note: COALESCE, not EXCLUDED.note. The web marking page sends status
      // only (no note field), so a routine re-save of a class would otherwise
      // write NULL over a note entered elsewhere (e.g. the mobile app) —
      // silent data loss the Absentees call list would then hide. A save that
      // carries a note still updates it; a note-less save preserves the
      // existing one. Clearing a note is not a supported web action today.
      `INSERT INTO attendance (student_id, school_code, class_name, date, status, marked_by, note, updated_at)
       VALUES ${rows.join(", ")}
       ON CONFLICT (student_id, date)
       DO UPDATE SET status = EXCLUDED.status,
                     note = COALESCE(EXCLUDED.note, attendance.note),
                     marked_by = EXCLUDED.marked_by, updated_at = EXCLUDED.updated_at
       WHERE attendance.updated_at <= EXCLUDED.updated_at`,
      values
    );
    await client.query("COMMIT");
    // A skipped stale replay is still safely handled: it did not clobber a
    // newer web/mobile correction, and the mobile queue may dequeue it.
    return deduped.length;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    logger.error("[pg] pgMarkAttendance failed", { err: String(err) });
    throw err;
  } finally {
    client.release();
  }
}

/** List attendance rows for a class on a date, scoped to a school. */
export async function pgGetAttendanceByClassDate(params: {
  schoolCode?: string;
  className: string;
  date: string;
}): Promise<any[]> {
  if (!isPgReady()) return [];
  try {
    const conditions = ["a.class_name = $1", "a.date = $2"];
    const values: any[] = [params.className, params.date];
    if (params.schoolCode) {
      conditions.push(`a.school_code = $${values.length + 1}`);
      values.push(params.schoolCode);
    }
    const { rows } = await getPgPool().query(
      `SELECT a.student_id AS "studentId", u.name AS "studentName", a.status,
              a.note, a.date, a.class_name AS "className"
         FROM attendance a
         JOIN users u ON u.id = a.student_id
        WHERE ${conditions.join(" AND ")}
        ORDER BY u.name ASC`,
      values
    );
    return rows;
  } catch (err) {
    logger.error("[pg] pgGetAttendanceByClassDate failed", { err: String(err) });
    return [];
  }
}

/** Principal/school-admin live dashboard: one row per class for one date. */
export async function pgGetSchoolAttendanceSummary(params: {
  schoolCode?: string;
  date: string;
}): Promise<SchoolAttendanceSummary> {
  const emptyTotals = {
    totalStudents: 0,
    markedStudents: 0,
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    unmarked: 0,
  };
  const empty = {
    date: params.date,
    totals: { ...emptyTotals },
    classes: [],
    unmarkedClasses: [],
  };
  if (!isPgReady()) return empty;
  try {
    const conditions = ["u.role = 'student'", "u.class_name IS NOT NULL", "u.class_name <> ''"];
    const values: any[] = [params.date];
    if (params.schoolCode) {
      conditions.push(`u.school_code = $${values.length + 1}`);
      values.push(params.schoolCode);
    }

    const { rows } = await getPgPool().query(
      `SELECT u.class_name AS "className",
              COUNT(u.id)::int AS "totalStudents",
              COUNT(a.student_id)::int AS "markedStudents",
              COUNT(*) FILTER (WHERE a.status = 'present')::int AS present,
              COUNT(*) FILTER (WHERE a.status = 'absent')::int AS absent,
              COUNT(*) FILTER (WHERE a.status = 'late')::int AS late,
              COUNT(*) FILTER (WHERE a.status = 'excused')::int AS excused
         FROM users u
         LEFT JOIN attendance a ON a.student_id = u.id AND a.date = $1
        WHERE ${conditions.join(" AND ")}
        GROUP BY u.class_name
        ORDER BY u.class_name ASC`,
      values
    );

    const classes = rows.map((r): SchoolAttendanceClassSummary => {
      const totalStudents = Number(r.totalStudents) || 0;
      const markedStudents = Number(r.markedStudents) || 0;
      return {
        className: r.className,
        totalStudents,
        markedStudents,
        present: Number(r.present) || 0,
        absent: Number(r.absent) || 0,
        late: Number(r.late) || 0,
        excused: Number(r.excused) || 0,
        unmarked: Math.max(totalStudents - markedStudents, 0),
      };
    });

    const totals = classes.reduce(
      (acc, row) => ({
        totalStudents: acc.totalStudents + row.totalStudents,
        markedStudents: acc.markedStudents + row.markedStudents,
        present: acc.present + row.present,
        absent: acc.absent + row.absent,
        late: acc.late + row.late,
        excused: acc.excused + row.excused,
        unmarked: acc.unmarked + row.unmarked,
      }),
      { ...emptyTotals }
    );

    return {
      date: params.date,
      totals,
      classes,
      unmarkedClasses: classes.filter((row) => row.unmarked > 0).map((row) => row.className),
    };
  } catch (err) {
    logger.error("[pg] pgGetSchoolAttendanceSummary failed", { err: String(err) });
    return empty;
  }
}

/** Per-status attendance counts for a student, scoped to a school. */
export async function pgGetStudentAttendanceSummary(params: {
  studentId: number;
  schoolCode?: string;
}): Promise<{ present: number; absent: number; late: number; excused: number; total: number }> {
  const empty = { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
  if (!isPgReady()) return empty;
  try {
    const conditions = ["student_id = $1"];
    const values: any[] = [params.studentId];
    if (params.schoolCode) {
      conditions.push(`school_code = $${values.length + 1}`);
      values.push(params.schoolCode);
    }
    const { rows } = await getPgPool().query(
      `SELECT status, COUNT(*)::int AS c
         FROM attendance
        WHERE ${conditions.join(" AND ")}
        GROUP BY status`,
      values
    );
    const out = { ...empty };
    for (const r of rows) {
      const status = r.status as AttendanceStatus;
      if (status in out) (out as any)[status] = r.c;
      out.total += r.c;
    }
    return out;
  } catch (err) {
    logger.error("[pg] pgGetStudentAttendanceSummary failed", { err: String(err) });
    return empty;
  }
}

// ─── Day's absentee list + data export (offer commitments; spec E5) ─────────
// E5: these report helpers take a REQUIRED schoolCode and THROW on failure —
// never []-on-error, so an outage reads as an error, not an empty school.

export interface AbsenteeRow {
  studentId: number;
  studentName: string;
  className: string | null;
  parentPhone: string | null;
  note: string | null;
}

/** All students marked absent on one date, with parent phone for follow-up calls. */
export async function pgGetAbsenteesByDate(params: {
  schoolCode: string;
  date: string;
}): Promise<AbsenteeRow[]> {
  const { rows } = await getPgPool().query(
    `SELECT a.student_id AS "studentId", u.name AS "studentName",
            a.class_name AS "className", u.parent_phone AS "parentPhone", a.note
       FROM attendance a
       JOIN users u ON u.id = a.student_id
      WHERE a.school_code = $1 AND a.date = $2 AND a.status = 'absent'
        -- The user row carries the student's CURRENT school and guardian
        -- phone. A transferred student's historical attendance rows keep the
        -- old school_code, so without this check the former school could
        -- read the family's current phone number off any past date.
        AND u.school_code = a.school_code
      ORDER BY a.class_name ASC NULLS LAST, u.name ASC`,
    [params.schoolCode, params.date]
  );
  return rows;
}

/** Raw attendance rows for CSV export, optionally bounded by [from, to]. */
export async function pgExportAttendanceRows(params: {
  schoolCode: string;
  from?: string;
  to?: string;
}): Promise<any[]> {
  const conditions = ["a.school_code = $1"];
  const values: any[] = [params.schoolCode];
  if (params.from) {
    conditions.push(`a.date >= $${values.length + 1}`);
    values.push(params.from);
  }
  if (params.to) {
    conditions.push(`a.date <= $${values.length + 1}`);
    values.push(params.to);
  }
  const { rows } = await getPgPool().query(
    `SELECT a.date::text AS date, a.class_name AS "className", u.name AS "studentName",
            a.status, a.note, m.name AS "markedBy"
       FROM attendance a
       JOIN users u ON u.id = a.student_id
       LEFT JOIN users m ON m.id = a.marked_by
      WHERE ${conditions.join(" AND ")}
      ORDER BY a.date ASC, a.class_name ASC NULLS LAST, u.name ASC`,
    values
  );
  return rows;
}

/** Raw fee rows for CSV export (E4: record fields only — no invented receipt data). */
export async function pgExportFeeRows(params: { schoolCode: string }): Promise<any[]> {
  const { rows } = await getPgPool().query(
    `SELECT u.name AS "studentName", u.class_name AS "className", f.description,
            f.amount_cents AS "amountCents", f.currency, f.status,
            f.due_date::text AS "dueDate", f.paid_at::text AS "paidAt",
            f.created_at::text AS "createdAt"
       FROM fees f
       JOIN users u ON u.id = f.student_id
      WHERE f.school_code = $1
      ORDER BY f.created_at ASC`,
    [params.schoolCode]
  );
  return rows;
}
