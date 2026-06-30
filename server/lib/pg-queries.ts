/**
 * Direct PostgreSQL query helpers for entities not covered by IStorage.
 * Replaces all direct MongoModel.* calls in routes and services.
 */
import { getPgPool, isPgReady } from "../db-pg";
import { logger } from "./logger";

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
  const code =
    data.uid
      .slice(0, 20)
      .replace(/[^a-z0-9]/gi, "")
      .toUpperCase() || "SCH";
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
      `SELECT COUNT(*) FROM usage_logs 
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
}): Promise<void> {
  if (!isPgReady()) return;
  try {
    await getPgPool().query(
      `INSERT INTO usage_logs (user_id, workspace_id, feature, tokens_used, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        data.userId,
        data.workspaceId ?? null,
        data.feature,
        data.tokensUsed ?? null,
        JSON.stringify(data.metadata || {}),
      ]
    );
  } catch (err) {
    logger.error("[pg] pgIncrementAIUsage failed", { err: String(err) });
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
