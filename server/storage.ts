import {
  type User,
  type InsertUser,
  type Session,
  type InsertSession,
  type Otp,
  type InsertOtp,
  type Test,
  type InsertTest,
  type Question,
  type InsertQuestion,
  type TestAttempt,
  type InsertTestAttempt,
  type Answer,
  type InsertAnswer,
  type Analytics,
  type InsertAnalytics,
  type TestAssignment,
  type InsertTestAssignment,
  type Workspace,
  type InsertWorkspace,
  type Channel,
  type InsertChannel,
  type Message,
  type InsertMessage,
  type LiveClass,
  type InsertLiveClass,
  type LiveSessionAttendance,
  type InsertLiveSessionAttendance,
  type FcmToken,
  type InsertFcmToken,
  type Task,
  type InsertTask,
  type Notification as AppNotification,
  type InsertNotification,
  type FocusSession,
  type InsertFocusSession,
  type Competency,
  type InsertCompetency,
  type Doubt,
  type InsertDoubt,
  type Milestone,
  type InsertMilestone,
  type Competition,
  type InsertCompetition,
  type StudentAchievement,
  type InsertStudentAchievement,
} from "@shared/schema";
import { type UserRole, type UserStatus } from "@shared/authz";
import { getPgPool } from "./db-pg";
import { getCassandraClient } from "./lib/db/cassandra";
import {
  cassandraCreateMessage,
  cassandraGetMessagesByChannel,
  cassandraDeleteMessage,
  cassandraPinMessage,
  cassandraGradeMessage,
  cassandraMarkMessageAsRead,
  cassandraGetPinnedMessages,
} from "./lib/db/cassandra-message-store";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";

export type StorageRow = Record<string, unknown>;
export type QueryParam =
  | string
  | number
  | boolean
  | null
  | undefined
  | Date
  | object
  | (string | number | boolean | null | undefined | Date | object)[];

export interface IUserStorage {
  getUser(id: number | string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(role?: string): Promise<User[]>;
  getUsersByClass(className: string): Promise<User[]>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
}

export interface IAuthStorage {
  sessionStore: session.Store;
  createSession(session: InsertSession): Promise<Session>;
  getSession(id: number): Promise<Session | undefined>;
  getSessionByRefreshToken(tokenHash: string): Promise<Session | undefined>;
  consumeSessionByRefreshToken(tokenHash: string): Promise<Session | undefined>;
  deleteSession(id: number): Promise<boolean>;
  deleteAllUserSessions(userId: number): Promise<boolean>;
  createOtp(otp: InsertOtp): Promise<Otp>;
  getOtp(id: number): Promise<Otp | undefined>;
  getValidOtp(userId: number, type: string): Promise<Otp | undefined>;
  markOtpUsed(id: number): Promise<boolean>;
}

export interface IEducationStorage {
  createTest(test: InsertTest): Promise<Test>;
  getTest(id: number): Promise<Test | undefined>;
  getTests(teacherId?: number, status?: string): Promise<Test[]>;
  getTestsByClass(className: string): Promise<Test[]>;
  updateTest(id: number, test: Partial<InsertTest>): Promise<Test | undefined>;
  createQuestion(question: InsertQuestion): Promise<Question>;
  getQuestion(id: number): Promise<Question | undefined>;
  getQuestionsByTest(testId: number): Promise<Question[]>;
  updateQuestion(id: number, question: Partial<InsertQuestion>): Promise<Question | undefined>;
  createTestAttempt(attempt: InsertTestAttempt): Promise<TestAttempt>;
  getTestAttempt(id: number): Promise<TestAttempt | undefined>;
  getTestAttemptsByStudent(studentId: number): Promise<TestAttempt[]>;
  getTestAttemptsByTest(testId: number): Promise<TestAttempt[]>;
  updateTestAttempt(
    id: number,
    attempt: Partial<InsertTestAttempt>
  ): Promise<TestAttempt | undefined>;
  createAnswer(answer: InsertAnswer): Promise<Answer>;
  getAnswer(id: number): Promise<Answer | undefined>;
  getAnswersByAttempt(attemptId: number): Promise<Answer[]>;
  updateAnswer(id: number, answer: Partial<InsertAnswer>): Promise<Answer | undefined>;
  createAnalytics(analytics: InsertAnalytics): Promise<Analytics>;
  getAnalyticsByUser(userId: number): Promise<Analytics[]>;
  getAnalyticsByTest(testId: number): Promise<Analytics[]>;
  createTestAssignment(assignment: InsertTestAssignment): Promise<TestAssignment>;
  getTestAssignment(id: number): Promise<TestAssignment | undefined>;
  getTestAssignments(filters: {
    studentId?: number;
    testId?: number;
    status?: string;
  }): Promise<TestAssignment[]>;
  updateTestAssignment(
    id: number,
    update: Partial<InsertTestAssignment>
  ): Promise<TestAssignment | undefined>;
  getTestAssignmentsByTest(testId: number): Promise<TestAssignment[]>;
  getTestAssignmentByStudentAndTest(
    studentId: number,
    testId: number
  ): Promise<TestAssignment | undefined>;
  createLiveClass(liveClass: InsertLiveClass): Promise<LiveClass>;
  getLiveClass(id: number): Promise<LiveClass | undefined>;
  getLiveClassesBySchoolAndClass(schoolCode: string, className: string): Promise<LiveClass[]>;
  updateLiveClass(id: number, update: Partial<InsertLiveClass>): Promise<LiveClass | undefined>;
  createLiveSessionAttendance(
    attendance: InsertLiveSessionAttendance
  ): Promise<LiveSessionAttendance>;
  getAttendanceBySession(sessionId: number): Promise<LiveSessionAttendance[]>;
  updateLiveSessionAttendance(
    id: number,
    update: Partial<InsertLiveSessionAttendance>
  ): Promise<LiveSessionAttendance | undefined>;
}

export interface IChatStorage {
  createWorkspace(workspace: InsertWorkspace): Promise<Workspace>;
  getWorkspace(id: number): Promise<Workspace | undefined>;
  getWorkspaces(userId: number): Promise<Workspace[]>;
  addMemberToWorkspace(workspaceId: number, userId: number): Promise<Workspace | undefined>;
  removeMemberFromWorkspace(workspaceId: number, userId: number): Promise<Workspace | undefined>;
  createChannel(channel: InsertChannel): Promise<Channel>;
  getChannel(id: number): Promise<Channel | undefined>;
  getChannelsByWorkspace(workspaceId: number): Promise<Channel[]>;
  getChannelsByWorkspaces(workspaceIds: number[]): Promise<Channel[]>;
  getOrCreateDMChannel(userId1: number, userId2: number): Promise<Channel>;
  getDMsByUser(userId: number): Promise<Channel[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  getMessagesByChannel(channelId: number, limit?: number, before?: number): Promise<Message[]>;
  deleteMessage(id: number, channelId?: number): Promise<boolean>;
  pinMessage(channelId: number, messageId: number): Promise<Channel | undefined>;
  unpinMessage(channelId: number, messageId: number): Promise<Channel | undefined>;
  getPinnedMessages(channelId: number): Promise<Message[]>;
  gradeMessage(
    messageId: number,
    status: "pending" | "graded",
    channelId?: number
  ): Promise<Message | undefined>;
  markMessageAsRead(
    messageId: number,
    userId: number,
    channelId?: number
  ): Promise<Message | undefined>;
}

export interface IProductivityStorage {
  upsertFcmToken(token: InsertFcmToken): Promise<FcmToken>;
  getFcmTokensByUser(userId: number): Promise<FcmToken[]>;
  removeFcmToken(token: string): Promise<boolean>;
  savePushToken(userId: number, token: string, deviceType: string | null): Promise<FcmToken>;
  deletePushToken(userId: number, token: string): Promise<boolean>;
  createTask(task: InsertTask): Promise<Task>;
  getTasksByUser(userId: number): Promise<Task[]>;
  updateTask(id: number, update: Partial<InsertTask>, userId: number): Promise<Task | undefined>;
  deleteTask(id: number, userId: number): Promise<boolean>;
  createNotification(n: InsertNotification): Promise<AppNotification>;
  getNotificationsByUser(userId: number): Promise<AppNotification[]>;
  getPendingPushNotifications(limit?: number): Promise<AppNotification[]>;
  markNotificationPushAttempt(
    id: number,
    status: "sent" | "failed",
    details?: Record<string, unknown>
  ): Promise<AppNotification | undefined>;
  markNotificationRead(id: number, userId: number): Promise<AppNotification | undefined>;
  dismissNotification(id: number, userId: number): Promise<boolean>;
  markAllNotificationsRead(userId: number): Promise<boolean>;
  createFocusSession(session: InsertFocusSession): Promise<FocusSession>;
  getFocusSessionsByUser(userId: number): Promise<FocusSession[]>;
}

export interface ICareerStorage {
  createCompetency(c: InsertCompetency): Promise<Competency>;
  getCompetencies(): Promise<Competency[]>;
  createDoubt(d: InsertDoubt): Promise<Doubt>;
  getDoubtsByStudent(studentId: number): Promise<Doubt[]>;
  resolveDoubt(id: string, answer: string): Promise<Doubt | undefined>;
  createMilestone(m: InsertMilestone): Promise<Milestone>;
  getMilestonesByStudent(studentId: number): Promise<Milestone[]>;
  createCompetition(c: InsertCompetition): Promise<Competition>;
  getCompetitions(): Promise<Competition[]>;
  createAchievement(a: InsertStudentAchievement): Promise<StudentAchievement>;
  getAchievementsByStudent(studentId: number): Promise<StudentAchievement[]>;
}

export interface IStorage
  extends
    IUserStorage,
    IAuthStorage,
    IEducationStorage,
    IChatStorage,
    IProductivityStorage,
    ICareerStorage {}

// ─── Row mappers ──────────────────────────────────────────────────────────────

function n(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  const x = parseInt(String(v), 10);
  return isNaN(x) ? null : x;
}

function mapUser(r: StorageRow): User {
  return {
    id: n(r.id)!,
    username: (r.username as string) ?? "",
    password: (r.password_hash as string) ?? "",
    name: (r.name as string) ?? "",
    email: r.email as string,
    emailVerified: (r.email_verified as boolean) ?? false,
    role: r.role as UserRole,
    status: r.status as UserStatus,
    avatar: (r.avatar as string) ?? null,
    class: (r.class_name as string) ?? null,
    subject: (r.subject as string) ?? null,
    school_code: (r.school_code as string) ?? null,
    grade: (r.grade as string) ?? null,
    board: (r.board as string) ?? null,
    subjects: (r.subjects as string[]) ?? [],
    district: (r.district as string) ?? null,
    createdAt: r.created_at as Date,
    lastLoginAt: (r.last_login_at as Date) ?? null,
  };
}

function mapSession(r: StorageRow): Session {
  return {
    id: n(r.id)!,
    userId: n(r.user_id)!,
    refreshTokenHash: r.refresh_token_hash as string,
    deviceInfo: (r.device_info as string) ?? null,
    ipAddress: (r.ip_address as string) ?? null,
    expiresAt: r.expires_at as Date,
    createdAt: r.created_at as Date,
  };
}

function mapOtp(r: StorageRow): Otp {
  return {
    id: n(r.id)!,
    userId: n(r.user_id)!,
    otpHash: r.otp_hash as string,
    type: r.type as InsertOtp["type"],
    expiresAt: r.expires_at as Date,
    used: (r.used as boolean) ?? false,
  };
}

function mapTest(r: StorageRow): Test {
  return {
    id: n(r.id)!,
    title: r.title as string,
    description: (r.description as string) ?? null,
    subject: r.subject as string,
    class: r.class_name as string,
    teacherId: n(r.teacher_id)!,
    totalMarks: n(r.total_marks) ?? 100,
    duration: n(r.duration) ?? 60,
    testDate: r.test_date as Date,
    questionTypes: (r.question_types as string[]) ?? [],
    status: r.status as InsertTest["status"],
    createdAt: r.created_at as Date,
  };
}

function mapQuestion(r: StorageRow): Question {
  return {
    id: n(r.id)!,
    testId: n(r.test_id)!,
    type: r.type as InsertQuestion["type"],
    text: r.text as string,
    options: r.options ?? null,
    correctAnswer: (r.correct_answer as string) ?? null,
    marks: n(r.marks) ?? 1,
    order: n(r.ord) ?? 0,
    aiRubric: (r.ai_rubric as string) ?? null,
  };
}

function mapAttempt(r: StorageRow): TestAttempt {
  return {
    id: n(r.id)!,
    testId: n(r.test_id)!,
    studentId: n(r.student_id)!,
    startTime: r.start_time as Date,
    endTime: (r.end_time as Date) ?? null,
    score: r.score != null ? parseFloat(String(r.score)) : null,
    status: r.status as InsertTestAttempt["status"],
  };
}

function mapAnswer(r: StorageRow): Answer {
  return {
    id: n(r.id)!,
    attemptId: n(r.attempt_id)!,
    questionId: n(r.question_id)!,
    text: (r.text as string) ?? null,
    selectedOption: n(r.selected_option),
    imageUrl: (r.image_url as string) ?? null,
    ocrText: (r.ocr_text as string) ?? null,
    score: r.score != null ? parseFloat(String(r.score)) : null,
    aiConfidence: r.ai_confidence != null ? parseFloat(String(r.ai_confidence)) : null,
    aiFeedback: (r.ai_feedback as string) ?? null,
    isCorrect: (r.is_correct as boolean) ?? null,
  };
}

function mapAnalytics(r: StorageRow): Analytics {
  return {
    id: n(r.id)!,
    userId: n(r.user_id)!,
    testId: n(r.test_id)!,
    weakTopics: (r.weak_topics as string[]) ?? [],
    strongTopics: (r.strong_topics as string[]) ?? [],
    recommendedResources: (r.recommended_resources as string[]) ?? [],
    insightDate: r.insight_date as Date,
  };
}

function mapAssignment(r: StorageRow): TestAssignment {
  return {
    id: n(r.id)!,
    testId: n(r.test_id)!,
    studentId: n(r.student_id)!,
    assignedBy: n(r.assigned_by)!,
    assignedDate: r.assigned_date as Date,
    dueDate: r.due_date as Date,
    status: r.status as InsertTestAssignment["status"],
    notificationSent: (r.notification_sent as boolean) ?? false,
  };
}

function mapWorkspace(r: StorageRow): Workspace {
  return {
    id: n(r.id)!,
    name: r.name as string,
    slug: (r.slug as string) ?? null,
    type: (r.type as InsertWorkspace["type"]) ?? "business",
    description: (r.description as string) ?? null,
    ownerId: n(r.owner_id)!,
    members: ((r.members as unknown[]) ?? []).map(Number),
    createdAt: r.created_at as Date,
  };
}

function mapChannel(r: StorageRow): Channel {
  return {
    id: n(r.id)!,
    workspaceId: n(r.workspace_id),
    name: r.name as string,
    type: r.type as InsertChannel["type"],
    class: (r.class_name as string) ?? null,
    subject: (r.subject as string) ?? null,
    pinnedMessages: ((r.pinned_messages as unknown[]) ?? []).map(Number),
    createdAt: r.created_at as Date,
  };
}

function mapMessage(r: StorageRow): Message {
  return {
    id: n(r.id)!,
    channelId: n(r.channel_id)!,
    authorId: n(r.author_id)!,
    content: r.content as string,
    type: r.type as InsertMessage["type"],
    fileUrl: (r.file_url as string) ?? null,
    isPinned: (r.is_pinned as boolean) ?? false,
    isHomework: (r.is_homework as boolean) ?? false,
    gradingStatus: (r.grading_status as InsertMessage["gradingStatus"]) ?? null,
    readBy: ((r.read_by as unknown[]) ?? []).map(Number),
    createdAt: r.created_at as Date,
  };
}

function mapLiveClass(r: StorageRow): LiveClass {
  return {
    id: n(r.id)!,
    title: r.title as string,
    description: (r.description as string) ?? null,
    teacherId: n(r.teacher_id)!,
    class: r.class_name as string,
    scheduledTime: r.scheduled_time as Date,
    durationMinutes: n(r.duration_minutes) ?? 60,
    status: r.status as InsertLiveClass["status"],
    dailyRoomName: (r.daily_room_name as string) ?? null,
    dailyRoomUrl: (r.daily_room_url as string) ?? null,
    startedAt: (r.started_at as Date) ?? null,
    endedAt: (r.ended_at as Date) ?? null,
    recordingUrl: (r.recording_url as string) ?? null,
    createdAt: r.created_at as Date,
  };
}

function mapAttendance(r: StorageRow): LiveSessionAttendance {
  return {
    id: n(r.id)!,
    sessionId: n(r.session_id)!,
    studentId: n(r.student_id)!,
    joinedAt: r.joined_at as Date,
    leftAt: (r.left_at as Date) ?? null,
    durationMinutes: n(r.duration_minutes) ?? 0,
  };
}

function mapFcmToken(r: StorageRow): FcmToken {
  return {
    id: n(r.id)!,
    userId: n(r.user_id)!,
    token: r.token as string,
    deviceType: (r.device_type as string) ?? null,
    updatedAt: r.updated_at as Date,
  };
}

function mapTask(r: StorageRow): Task {
  return {
    id: n(r.id)!,
    userId: n(r.user_id)!,
    title: r.title as string,
    status: r.status as InsertTask["status"],
    priority: r.priority as InsertTask["priority"],
    tags: (r.tags as string[]) ?? [],
    dueDate: (r.due_date as string) ?? null,
    comments: n(r.comments) ?? 0,
    attachments: n(r.attachments) ?? 0,
    createdAt: r.created_at as Date,
  };
}

function mapNotification(r: StorageRow): AppNotification {
  return {
    id: n(r.id)!,
    userId: n(r.user_id)!,
    type: r.type as InsertNotification["type"],
    title: r.title as string,
    body: r.body as string,
    isRead: (r.is_read as boolean) ?? false,
    meta: (r.meta as string) ?? null,
    createdAt: r.created_at as Date,
  };
}

function mapFocusSession(r: StorageRow): FocusSession {
  return {
    id: n(r.id)!,
    userId: n(r.user_id)!,
    subject: r.subject as string,
    mode: r.mode as InsertFocusSession["mode"],
    durationSeconds: n(r.duration_seconds)!,
    completedAt: r.completed_at as Date,
  };
}

function mapCompetency(r: StorageRow): Competency {
  return {
    id: n(r.id)!,
    name: r.name as string,
    description: (r.description as string) ?? null,
    createdAt: r.created_at as Date,
  };
}

function mapDoubt(r: StorageRow): Doubt {
  return {
    id: r.id as string, // uuid
    studentId: n(r.student_id)!,
    classroomId: n(r.classroom_id),
    testId: n(r.test_id),
    question: r.question as string,
    answer: (r.answer as string) ?? null,
    status: r.status as InsertDoubt["status"],
    createdAt: r.created_at as Date,
    resolvedAt: (r.resolved_at as Date) ?? null,
  };
}

function mapMilestone(r: StorageRow): Milestone {
  return {
    id: r.id as string, // uuid
    studentId: n(r.student_id)!,
    competencyId: n(r.competency_id)!,
    phase: r.phase as InsertMilestone["phase"],
    reflection: (r.reflection as string) ?? null,
    score: n(r.score) ?? 0,
    createdAt: r.created_at as Date,
  };
}

function mapCompetition(r: StorageRow): Competition {
  return {
    id: n(r.id)!,
    name: r.name as string,
    organizer: (r.organizer as string) ?? null,
    level: r.level as InsertCompetition["level"],
    category: (r.category as string) ?? null,
    competitionDate: r.competition_date as Date,
    createdAt: r.created_at as Date,
  };
}

function mapAchievement(r: StorageRow): StudentAchievement {
  return {
    id: r.id as string, // uuid
    studentId: n(r.student_id)!,
    competitionId: n(r.competition_id)!,
    awardType: r.award_type as string,
    score: r.score != null ? parseFloat(String(r.score)) : null,
    rank: n(r.rank),
    certificateUrl: (r.certificate_url as string) ?? null,
    verified: (r.verified as boolean) ?? false,
    verifiedBy: n(r.verified_by),
    verificationMetadata: (r.verification_metadata as Record<string, unknown>) ?? {},
    createdAt: r.created_at as Date,
  };
}

// ─── PgStorage ────────────────────────────────────────────────────────────────

export class PgStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    const PgStore = connectPgSimple(session);
    // Uses a dedicated "express_sessions" table (separate from the "sessions"
    // refresh-token table). connect-pg-simple creates it on first boot via
    // createTableIfMissing, so no manual migration is required.
    //
    // We intentionally use conString (not pool:getPgPool()) because this
    // constructor runs at module-import time, before connectPostgres() has
    // initialized the shared pool. conString defers pool creation to the
    // first actual session query, avoiding the boot-ordering crash.
    this.sessionStore = new PgStore({
      conString: process.env.POSTGRESQL_URL,
      tableName: "express_sessions",
      createTableIfMissing: true,
      // Prune expired sessions every hour; disabled in test to avoid open handles.
      pruneSessionInterval: process.env.NODE_ENV === "test" ? false : 60 * 60,
    });
  }

  private get pool() {
    return getPgPool();
  }

  // ── Users ──────────────────────────────────────────────────────────────────

  async getUser(id: number | string): Promise<User | undefined> {
    const { rows } = await this.pool.query("SELECT * FROM users WHERE id = $1", [id]);
    return rows[0] ? mapUser(rows[0]) : undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const { rows } = await this.pool.query("SELECT * FROM users WHERE username = $1", [username]);
    return rows[0] ? mapUser(rows[0]) : undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const { rows } = await this.pool.query("SELECT * FROM users WHERE email = $1", [
      email.toLowerCase(),
    ]);
    return rows[0] ? mapUser(rows[0]) : undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const { rows } = await this.pool.query(
      `INSERT INTO users
         (auth_provider, auth_subject, email, username, password_hash, name, email_verified,
          role, status, avatar, class_name, subject, school_code, grade, board, subjects, district)
       VALUES ('local', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        user.username,
        user.email.toLowerCase(),
        user.username,
        user.password,
        user.name,
        user.emailVerified ?? false,
        user.role ?? "student",
        user.status ?? "active",
        user.avatar ?? null,
        user.class ?? null,
        user.subject ?? null,
        user.school_code ?? null,
        user.grade ?? null,
        user.board ?? null,
        user.subjects ?? [],
        user.district ?? null,
      ]
    );
    return mapUser(rows[0]);
  }

  async getUsers(role?: string): Promise<User[]> {
    const { rows } = role
      ? await this.pool.query("SELECT * FROM users WHERE role = $1", [role])
      : await this.pool.query("SELECT * FROM users");
    return rows.map(mapUser);
  }

  async getUsersByClass(className: string): Promise<User[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM users WHERE role = 'student' AND class_name = $1",
      [className]
    );
    return rows.map(mapUser);
  }

  async updateUser(id: number, userUpdate: Partial<InsertUser>): Promise<User | undefined> {
    const colMap: Record<string, string> = {
      username: "username",
      password: "password_hash",
      name: "name",
      email: "email",
      role: "role",
      status: "status",
      emailVerified: "email_verified",
      avatar: "avatar",
      class: "class_name",
      subject: "subject",
      school_code: "school_code",
      grade: "grade",
      board: "board",
      subjects: "subjects",
      district: "district",
    };
    const sets: string[] = [];
    const params: QueryParam[] = [];
    let i = 1;
    for (const [k, col] of Object.entries(colMap)) {
      if (k in userUpdate) {
        sets.push(`${col} = $${i++}`);
        params.push(Reflect.get(userUpdate, k));
      }
    }
    if (!sets.length) return this.getUser(id);
    params.push(id);
    const { rows } = await this.pool.query(
      `UPDATE users SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
      params
    );
    return rows[0] ? mapUser(rows[0]) : undefined;
  }

  // ── Sessions ───────────────────────────────────────────────────────────────

  async createSession(sessionData: InsertSession): Promise<Session> {
    const { rows } = await this.pool.query(
      `INSERT INTO sessions (user_id, refresh_token_hash, device_info, ip_address, expires_at)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [
        sessionData.userId,
        sessionData.refreshTokenHash,
        sessionData.deviceInfo ?? null,
        sessionData.ipAddress ?? null,
        sessionData.expiresAt,
      ]
    );
    return mapSession(rows[0]);
  }

  async getSession(id: number): Promise<Session | undefined> {
    const { rows } = await this.pool.query("SELECT * FROM sessions WHERE id = $1", [id]);
    return rows[0] ? mapSession(rows[0]) : undefined;
  }

  async getSessionByRefreshToken(refreshTokenHash: string): Promise<Session | undefined> {
    const { rows } = await this.pool.query("SELECT * FROM sessions WHERE refresh_token_hash = $1", [
      refreshTokenHash,
    ]);
    return rows[0] ? mapSession(rows[0]) : undefined;
  }

  async consumeSessionByRefreshToken(refreshTokenHash: string): Promise<Session | undefined> {
    const { rows } = await this.pool.query(
      "DELETE FROM sessions WHERE refresh_token_hash = $1 RETURNING *",
      [refreshTokenHash]
    );
    return rows[0] ? mapSession(rows[0]) : undefined;
  }

  async deleteSession(id: number): Promise<boolean> {
    const { rowCount } = await this.pool.query("DELETE FROM sessions WHERE id = $1", [id]);
    return (rowCount ?? 0) > 0;
  }

  async deleteAllUserSessions(userId: number): Promise<boolean> {
    const { rowCount } = await this.pool.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
    return (rowCount ?? 0) > 0;
  }

  // ── OTPs ───────────────────────────────────────────────────────────────────

  async createOtp(otpData: InsertOtp): Promise<Otp> {
    const { rows } = await this.pool.query(
      `INSERT INTO otps (user_id, otp_hash, type, expires_at, used)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [otpData.userId, otpData.otpHash, otpData.type, otpData.expiresAt, otpData.used ?? false]
    );
    return mapOtp(rows[0]);
  }

  async getOtp(id: number): Promise<Otp | undefined> {
    const { rows } = await this.pool.query("SELECT * FROM otps WHERE id = $1", [id]);
    return rows[0] ? mapOtp(rows[0]) : undefined;
  }

  async getValidOtp(userId: number, type: string): Promise<Otp | undefined> {
    const { rows } = await this.pool.query(
      `SELECT * FROM otps WHERE user_id=$1 AND type=$2 AND used=false AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1`,
      [userId, type]
    );
    return rows[0] ? mapOtp(rows[0]) : undefined;
  }

  async markOtpUsed(id: number): Promise<boolean> {
    const { rowCount } = await this.pool.query("UPDATE otps SET used=true WHERE id=$1", [id]);
    return (rowCount ?? 0) > 0;
  }

  // ── Tests ──────────────────────────────────────────────────────────────────

  async createTest(test: InsertTest): Promise<Test> {
    const { rows } = await this.pool.query(
      `INSERT INTO tests (title, description, subject, class_name, teacher_id, total_marks,
         duration, test_date, question_types, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        test.title,
        test.description ?? null,
        test.subject,
        test.class,
        test.teacherId,
        test.totalMarks ?? 100,
        test.duration ?? 60,
        test.testDate,
        test.questionTypes ?? [],
        test.status ?? "draft",
      ]
    );
    return mapTest(rows[0]);
  }

  async getTest(id: number): Promise<Test | undefined> {
    const { rows } = await this.pool.query("SELECT * FROM tests WHERE id = $1", [id]);
    return rows[0] ? mapTest(rows[0]) : undefined;
  }

  async getTests(teacherId?: number, status?: string): Promise<Test[]> {
    const conditions: string[] = [];
    const params: QueryParam[] = [];
    let i = 1;
    if (teacherId) {
      conditions.push(`teacher_id = $${i++}`);
      params.push(teacherId);
    }
    if (status) {
      conditions.push(`status = $${i}`);
      params.push(status);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await this.pool.query(`SELECT * FROM tests ${where}`, params);
    return rows.map(mapTest);
  }

  async getTestsByClass(className: string): Promise<Test[]> {
    const { rows } = await this.pool.query("SELECT * FROM tests WHERE class_name = $1", [
      className,
    ]);
    return rows.map(mapTest);
  }

  async updateTest(id: number, testUpdate: Partial<InsertTest>): Promise<Test | undefined> {
    const colMap: Record<string, string> = {
      title: "title",
      description: "description",
      subject: "subject",
      class: "class_name",
      teacherId: "teacher_id",
      totalMarks: "total_marks",
      duration: "duration",
      testDate: "test_date",
      questionTypes: "question_types",
      status: "status",
    };
    const sets: string[] = [];
    const params: QueryParam[] = [];
    let i = 1;
    for (const [k, col] of Object.entries(colMap)) {
      if (k in testUpdate) {
        sets.push(`${col} = $${i++}`);
        params.push(Reflect.get(testUpdate, k));
      }
    }
    if (!sets.length) return this.getTest(id);
    params.push(id);
    const { rows } = await this.pool.query(
      `UPDATE tests SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
      params
    );
    return rows[0] ? mapTest(rows[0]) : undefined;
  }

  // ── Questions ──────────────────────────────────────────────────────────────

  async createQuestion(question: InsertQuestion): Promise<Question> {
    const { rows } = await this.pool.query(
      `INSERT INTO questions (test_id, type, text, options, correct_answer, marks, ord, ai_rubric)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        question.testId,
        question.type,
        question.text,
        question.options ? JSON.stringify(question.options) : null,
        question.correctAnswer ?? null,
        question.marks ?? 1,
        question.order,
        question.aiRubric ?? null,
      ]
    );
    return mapQuestion(rows[0]);
  }

  async getQuestion(id: number): Promise<Question | undefined> {
    const { rows } = await this.pool.query("SELECT * FROM questions WHERE id = $1", [id]);
    return rows[0] ? mapQuestion(rows[0]) : undefined;
  }

  async getQuestionsByTest(testId: number): Promise<Question[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM questions WHERE test_id = $1 ORDER BY ord",
      [testId]
    );
    return rows.map(mapQuestion);
  }

  async updateQuestion(
    id: number,
    questionUpdate: Partial<InsertQuestion>
  ): Promise<Question | undefined> {
    const colMap: Record<string, string> = {
      type: "type",
      text: "text",
      options: "options",
      correctAnswer: "correct_answer",
      marks: "marks",
      order: "ord",
      aiRubric: "ai_rubric",
    };
    const sets: string[] = [];
    const params: QueryParam[] = [];
    let i = 1;
    for (const [k, col] of Object.entries(colMap)) {
      if (k in questionUpdate) {
        let v = Reflect.get(questionUpdate, k);
        if (k === "options" && v != null) v = JSON.stringify(v);
        sets.push(`${col} = $${i++}`);
        params.push(v);
      }
    }
    if (!sets.length) return this.getQuestion(id);
    params.push(id);
    const { rows } = await this.pool.query(
      `UPDATE questions SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
      params
    );
    return rows[0] ? mapQuestion(rows[0]) : undefined;
  }

  // ── Test Attempts ──────────────────────────────────────────────────────────

  async createTestAttempt(attempt: InsertTestAttempt): Promise<TestAttempt> {
    const { rows } = await this.pool.query(
      `INSERT INTO test_attempts (test_id, student_id, start_time, end_time, score, status)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        attempt.testId,
        attempt.studentId,
        attempt.startTime ?? new Date(),
        attempt.endTime ?? null,
        attempt.score ?? null,
        attempt.status ?? "in_progress",
      ]
    );
    return mapAttempt(rows[0]);
  }

  async getTestAttempt(id: number): Promise<TestAttempt | undefined> {
    const { rows } = await this.pool.query("SELECT * FROM test_attempts WHERE id = $1", [id]);
    return rows[0] ? mapAttempt(rows[0]) : undefined;
  }

  async getTestAttemptsByStudent(studentId: number): Promise<TestAttempt[]> {
    const { rows } = await this.pool.query("SELECT * FROM test_attempts WHERE student_id = $1", [
      studentId,
    ]);
    return rows.map(mapAttempt);
  }

  async getTestAttemptsByTest(testId: number): Promise<TestAttempt[]> {
    const { rows } = await this.pool.query("SELECT * FROM test_attempts WHERE test_id = $1", [
      testId,
    ]);
    return rows.map(mapAttempt);
  }

  async updateTestAttempt(
    id: number,
    attemptUpdate: Partial<InsertTestAttempt>
  ): Promise<TestAttempt | undefined> {
    const colMap: Record<string, string> = {
      endTime: "end_time",
      score: "score",
      status: "status",
    };
    const sets: string[] = [];
    const params: QueryParam[] = [];
    let i = 1;
    for (const [k, col] of Object.entries(colMap)) {
      if (k in attemptUpdate) {
        sets.push(`${col} = $${i++}`);
        params.push(Reflect.get(attemptUpdate, k));
      }
    }
    if (!sets.length) return this.getTestAttempt(id);
    params.push(id);
    const { rows } = await this.pool.query(
      `UPDATE test_attempts SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
      params
    );
    return rows[0] ? mapAttempt(rows[0]) : undefined;
  }

  // ── Answers ────────────────────────────────────────────────────────────────

  async createAnswer(answer: InsertAnswer): Promise<Answer> {
    const { rows } = await this.pool.query(
      `INSERT INTO answers (attempt_id, question_id, text, selected_option, image_url,
         ocr_text, score, ai_confidence, ai_feedback, is_correct)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        answer.attemptId,
        answer.questionId,
        answer.text ?? null,
        answer.selectedOption ?? null,
        answer.imageUrl ?? null,
        answer.ocrText ?? null,
        answer.score ?? null,
        answer.aiConfidence ?? null,
        answer.aiFeedback ?? null,
        answer.isCorrect ?? null,
      ]
    );
    return mapAnswer(rows[0]);
  }

  async getAnswer(id: number): Promise<Answer | undefined> {
    const { rows } = await this.pool.query("SELECT * FROM answers WHERE id = $1", [id]);
    return rows[0] ? mapAnswer(rows[0]) : undefined;
  }

  async getAnswersByAttempt(attemptId: number): Promise<Answer[]> {
    const { rows } = await this.pool.query("SELECT * FROM answers WHERE attempt_id = $1", [
      attemptId,
    ]);
    return rows.map(mapAnswer);
  }

  async updateAnswer(id: number, answerUpdate: Partial<InsertAnswer>): Promise<Answer | undefined> {
    const colMap: Record<string, string> = {
      text: "text",
      selectedOption: "selected_option",
      imageUrl: "image_url",
      ocrText: "ocr_text",
      score: "score",
      aiConfidence: "ai_confidence",
      aiFeedback: "ai_feedback",
      isCorrect: "is_correct",
    };
    const sets: string[] = [];
    const params: QueryParam[] = [];
    let i = 1;
    for (const [k, col] of Object.entries(colMap)) {
      if (k in answerUpdate) {
        sets.push(`${col} = $${i++}`);
        params.push(Reflect.get(answerUpdate, k));
      }
    }
    if (!sets.length) return this.getAnswer(id);
    params.push(id);
    const { rows } = await this.pool.query(
      `UPDATE answers SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
      params
    );
    return rows[0] ? mapAnswer(rows[0]) : undefined;
  }

  // ── Analytics ──────────────────────────────────────────────────────────────

  async createAnalytics(insertAnalytics: InsertAnalytics): Promise<Analytics> {
    const { rows } = await this.pool.query(
      `INSERT INTO analytics (user_id, test_id, weak_topics, strong_topics, recommended_resources, insight_date)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        insertAnalytics.userId,
        insertAnalytics.testId,
        insertAnalytics.weakTopics,
        insertAnalytics.strongTopics,
        insertAnalytics.recommendedResources,
        insertAnalytics.insightDate ?? new Date(),
      ]
    );
    return mapAnalytics(rows[0]);
  }

  async getAnalyticsByUser(userId: number): Promise<Analytics[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM analytics WHERE user_id = $1 ORDER BY insight_date DESC",
      [userId]
    );
    return rows.map(mapAnalytics);
  }

  async getAnalyticsByTest(testId: number): Promise<Analytics[]> {
    const { rows } = await this.pool.query("SELECT * FROM analytics WHERE test_id = $1", [testId]);
    return rows.map(mapAnalytics);
  }

  // ── Test Assignments ───────────────────────────────────────────────────────

  async createTestAssignment(assignment: InsertTestAssignment): Promise<TestAssignment> {
    const { rows } = await this.pool.query(
      `INSERT INTO test_assignments (test_id, student_id, assigned_by, assigned_date, due_date, status, notification_sent)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        assignment.testId,
        assignment.studentId,
        assignment.assignedBy,
        assignment.assignedDate ?? new Date(),
        assignment.dueDate,
        assignment.status ?? "pending",
        assignment.notificationSent ?? false,
      ]
    );
    return mapAssignment(rows[0]);
  }

  async getTestAssignment(id: number): Promise<TestAssignment | undefined> {
    const { rows } = await this.pool.query("SELECT * FROM test_assignments WHERE id = $1", [id]);
    return rows[0] ? mapAssignment(rows[0]) : undefined;
  }

  async getTestAssignments(filters: {
    studentId?: number;
    testId?: number;
    status?: string;
  }): Promise<TestAssignment[]> {
    const conditions: string[] = [];
    const params: QueryParam[] = [];
    let i = 1;
    if (filters.studentId != null) {
      conditions.push(`student_id = $${i++}`);
      params.push(filters.studentId);
    }
    if (filters.testId != null) {
      conditions.push(`test_id = $${i++}`);
      params.push(filters.testId);
    }
    if (filters.status) {
      conditions.push(`status = $${i}`);
      params.push(filters.status);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await this.pool.query(`SELECT * FROM test_assignments ${where}`, params);
    return rows.map(mapAssignment);
  }

  async updateTestAssignment(
    id: number,
    update: Partial<InsertTestAssignment>
  ): Promise<TestAssignment | undefined> {
    const colMap: Record<string, string> = {
      status: "status",
      dueDate: "due_date",
      notificationSent: "notification_sent",
    };
    const sets: string[] = [];
    const params: QueryParam[] = [];
    let i = 1;
    for (const [k, col] of Object.entries(colMap)) {
      if (k in update) {
        sets.push(`${col} = $${i++}`);
        params.push(Reflect.get(update, k));
      }
    }
    if (!sets.length) return this.getTestAssignment(id);
    params.push(id);
    const { rows } = await this.pool.query(
      `UPDATE test_assignments SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
      params
    );
    return rows[0] ? mapAssignment(rows[0]) : undefined;
  }

  async getTestAssignmentsByTest(testId: number): Promise<TestAssignment[]> {
    const { rows } = await this.pool.query("SELECT * FROM test_assignments WHERE test_id = $1", [
      testId,
    ]);
    return rows.map(mapAssignment);
  }

  async getTestAssignmentByStudentAndTest(
    studentId: number,
    testId: number
  ): Promise<TestAssignment | undefined> {
    const { rows } = await this.pool.query(
      "SELECT * FROM test_assignments WHERE student_id = $1 AND test_id = $2 LIMIT 1",
      [studentId, testId]
    );
    return rows[0] ? mapAssignment(rows[0]) : undefined;
  }

  // ── Workspaces ─────────────────────────────────────────────────────────────

  async createWorkspace(workspace: InsertWorkspace): Promise<Workspace> {
    const members = Array.from(new Set([workspace.ownerId, ...(workspace.members ?? [])]));
    const { rows } = await this.pool.query(
      `INSERT INTO workspaces (name, slug, type, description, owner_id, members)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        workspace.name,
        workspace.slug ?? null,
        workspace.type ?? "business",
        workspace.description ?? null,
        workspace.ownerId,
        members,
      ]
    );
    return mapWorkspace(rows[0]);
  }

  async getWorkspace(id: number): Promise<Workspace | undefined> {
    const { rows } = await this.pool.query("SELECT * FROM workspaces WHERE id = $1", [id]);
    return rows[0] ? mapWorkspace(rows[0]) : undefined;
  }

  async getWorkspaces(userId: number): Promise<Workspace[]> {
    const { rows } = await this.pool.query("SELECT * FROM workspaces WHERE $1 = ANY(members)", [
      userId,
    ]);
    return rows.map(mapWorkspace);
  }

  async addMemberToWorkspace(workspaceId: number, userId: number): Promise<Workspace | undefined> {
    const { rows } = await this.pool.query(
      `UPDATE workspaces SET members = array_append(members, $1::bigint)
       WHERE id = $2 AND NOT ($1::bigint = ANY(members)) RETURNING *`,
      [userId, workspaceId]
    );
    return rows[0] ? mapWorkspace(rows[0]) : this.getWorkspace(workspaceId);
  }

  async removeMemberFromWorkspace(
    workspaceId: number,
    userId: number
  ): Promise<Workspace | undefined> {
    const { rows } = await this.pool.query(
      `UPDATE workspaces SET members = array_remove(members, $1::bigint) WHERE id = $2 RETURNING *`,
      [userId, workspaceId]
    );
    return rows[0] ? mapWorkspace(rows[0]) : undefined;
  }

  // ── Channels ───────────────────────────────────────────────────────────────

  async createChannel(channel: InsertChannel): Promise<Channel> {
    const { rows } = await this.pool.query(
      `INSERT INTO channels (workspace_id, name, type, class_name, subject, pinned_messages)
       VALUES ($1,$2,$3,$4,$5,'{}') RETURNING *`,
      [
        channel.workspaceId ?? null,
        channel.name,
        channel.type ?? "text",
        channel.class ?? null,
        channel.subject ?? null,
      ]
    );
    return mapChannel(rows[0]);
  }

  async getChannel(id: number): Promise<Channel | undefined> {
    const { rows } = await this.pool.query("SELECT * FROM channels WHERE id = $1", [id]);
    return rows[0] ? mapChannel(rows[0]) : undefined;
  }

  async getChannelsByWorkspace(workspaceId: number): Promise<Channel[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM channels WHERE workspace_id = $1 ORDER BY created_at",
      [workspaceId]
    );
    return rows.map(mapChannel);
  }

  async getChannelsByWorkspaces(workspaceIds: number[]): Promise<Channel[]> {
    if (!workspaceIds.length) return [];
    const { rows } = await this.pool.query(
      "SELECT * FROM channels WHERE workspace_id = ANY($1) ORDER BY created_at",
      [workspaceIds]
    );
    return rows.map(mapChannel);
  }

  async getOrCreateDMChannel(userId1: number, userId2: number): Promise<Channel> {
    const minId = Math.min(userId1, userId2);
    const maxId = Math.max(userId1, userId2);
    const dmName = `dm_${minId}_${maxId}`;
    const { rows: existing } = await this.pool.query(
      "SELECT * FROM channels WHERE type = 'dm' AND name = $1",
      [dmName]
    );
    if (existing[0]) return mapChannel(existing[0]);
    const { rows } = await this.pool.query(
      `INSERT INTO channels (name, type, pinned_messages) VALUES ($1,'dm','{}') RETURNING *`,
      [dmName]
    );
    return mapChannel(rows[0]);
  }

  async getDMsByUser(userId: number): Promise<Channel[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM channels WHERE type = 'dm' AND (name LIKE $1 OR name LIKE $2)`,
      [`dm_${userId}_%`, `dm_%_${userId}`]
    );
    return rows.map(mapChannel);
  }

  // ── Messages ───────────────────────────────────────────────────────────────

  async createMessage(message: InsertMessage): Promise<Message> {
    if (getCassandraClient()) return cassandraCreateMessage(message);
    const { rows } = await this.pool.query(
      `INSERT INTO messages (channel_id, author_id, content, type, file_url, is_homework, grading_status, read_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'{}') RETURNING *`,
      [
        message.channelId,
        message.authorId,
        message.content,
        message.type ?? "text",
        message.fileUrl ?? null,
        message.isHomework ?? false,
        message.gradingStatus ?? null,
      ]
    );
    return mapMessage(rows[0]);
  }

  async getMessagesByChannel(channelId: number, limit = 50, before?: number): Promise<Message[]> {
    if (getCassandraClient()) return cassandraGetMessagesByChannel(channelId, limit, before);
    const params: QueryParam[] = [channelId, limit];
    const beforeClause = before != null ? ` AND id < $3` : "";
    if (before != null) params.push(before);
    const { rows } = await this.pool.query(
      `SELECT * FROM messages WHERE channel_id = $1${beforeClause} ORDER BY id DESC LIMIT $2`,
      params
    );
    return rows.reverse().map(mapMessage);
  }

  async deleteMessage(id: number, channelId?: number): Promise<boolean> {
    if (getCassandraClient() && channelId != null) return cassandraDeleteMessage(channelId, id);
    const { rowCount } = await this.pool.query("DELETE FROM messages WHERE id = $1", [id]);
    return (rowCount ?? 0) > 0;
  }

  async pinMessage(channelId: number, messageId: number): Promise<Channel | undefined> {
    if (getCassandraClient()) await cassandraPinMessage(channelId, messageId, true);
    else await this.pool.query("UPDATE messages SET is_pinned=true WHERE id=$1", [messageId]);
    const { rows } = await this.pool.query(
      `UPDATE channels SET pinned_messages = array_append(pinned_messages, $1::bigint)
       WHERE id = $2 AND NOT ($1::bigint = ANY(pinned_messages)) RETURNING *`,
      [messageId, channelId]
    );
    return rows[0] ? mapChannel(rows[0]) : this.getChannel(channelId);
  }

  async unpinMessage(channelId: number, messageId: number): Promise<Channel | undefined> {
    if (getCassandraClient()) await cassandraPinMessage(channelId, messageId, false);
    else await this.pool.query("UPDATE messages SET is_pinned=false WHERE id=$1", [messageId]);
    const { rows } = await this.pool.query(
      `UPDATE channels SET pinned_messages = array_remove(pinned_messages, $1::bigint)
       WHERE id = $2 RETURNING *`,
      [messageId, channelId]
    );
    return rows[0] ? mapChannel(rows[0]) : undefined;
  }

  async getPinnedMessages(channelId: number): Promise<Message[]> {
    if (getCassandraClient()) return cassandraGetPinnedMessages(channelId);
    const { rows } = await this.pool.query(
      "SELECT * FROM messages WHERE channel_id=$1 AND is_pinned=true ORDER BY id",
      [channelId]
    );
    return rows.map(mapMessage);
  }

  async gradeMessage(
    messageId: number,
    status: "pending" | "graded",
    channelId?: number
  ): Promise<Message | undefined> {
    if (getCassandraClient() && channelId != null) {
      await cassandraGradeMessage(channelId, messageId, status);
      return {
        id: messageId,
        channelId: channelId!,
        authorId: 0,
        content: "",
        type: "text",
        fileUrl: null,
        isPinned: false,
        isHomework: false,
        gradingStatus: status,
        readBy: [],
        createdAt: new Date(),
      };
    }
    const { rows } = await this.pool.query(
      "UPDATE messages SET grading_status=$1 WHERE id=$2 RETURNING *",
      [status, messageId]
    );
    return rows[0] ? mapMessage(rows[0]) : undefined;
  }

  async markMessageAsRead(
    messageId: number,
    userId: number,
    channelId?: number
  ): Promise<Message | undefined> {
    if (getCassandraClient() && channelId != null) {
      await cassandraMarkMessageAsRead(channelId, messageId, userId);
      return {
        id: messageId,
        channelId: channelId!,
        authorId: 0,
        content: "",
        type: "text",
        fileUrl: null,
        isPinned: false,
        isHomework: false,
        gradingStatus: null,
        readBy: [userId],
        createdAt: new Date(),
      };
    }
    const { rows } = await this.pool.query(
      `UPDATE messages SET read_by = array_append(read_by, $1::bigint)
       WHERE id=$2 AND NOT ($1::bigint = ANY(read_by)) RETURNING *`,
      [userId, messageId]
    );
    return rows[0] ? mapMessage(rows[0]) : undefined;
  }

  // ── Live Classes ───────────────────────────────────────────────────────────

  async createLiveClass(classData: InsertLiveClass): Promise<LiveClass> {
    const { rows } = await this.pool.query(
      `INSERT INTO live_classes (title, description, teacher_id, class_name, scheduled_time,
         duration_minutes, status, daily_room_name, daily_room_url, started_at, ended_at, recording_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        classData.title,
        classData.description ?? null,
        classData.teacherId,
        classData.class,
        classData.scheduledTime,
        classData.durationMinutes ?? 60,
        classData.status ?? "scheduled",
        classData.dailyRoomName ?? null,
        classData.dailyRoomUrl ?? null,
        classData.startedAt ?? null,
        classData.endedAt ?? null,
        classData.recordingUrl ?? null,
      ]
    );
    return mapLiveClass(rows[0]);
  }

  async getLiveClass(id: number): Promise<LiveClass | undefined> {
    const { rows } = await this.pool.query("SELECT * FROM live_classes WHERE id = $1", [id]);
    return rows[0] ? mapLiveClass(rows[0]) : undefined;
  }

  async getLiveClassesBySchoolAndClass(
    _schoolCode: string,
    className: string
  ): Promise<LiveClass[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM live_classes WHERE class_name = $1 ORDER BY scheduled_time DESC",
      [className]
    );
    return rows.map(mapLiveClass);
  }

  async updateLiveClass(
    id: number,
    update: Partial<InsertLiveClass>
  ): Promise<LiveClass | undefined> {
    const colMap: Record<string, string> = {
      status: "status",
      dailyRoomName: "daily_room_name",
      dailyRoomUrl: "daily_room_url",
      startedAt: "started_at",
      endedAt: "ended_at",
      recordingUrl: "recording_url",
    };
    const sets: string[] = [];
    const params: QueryParam[] = [];
    let i = 1;
    for (const [k, col] of Object.entries(colMap)) {
      if (k in update) {
        sets.push(`${col} = $${i++}`);
        params.push(Reflect.get(update, k));
      }
    }
    if (!sets.length) return this.getLiveClass(id);
    params.push(id);
    const { rows } = await this.pool.query(
      `UPDATE live_classes SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
      params
    );
    return rows[0] ? mapLiveClass(rows[0]) : undefined;
  }

  // ── Live Session Attendance ────────────────────────────────────────────────

  async createLiveSessionAttendance(
    attendanceData: InsertLiveSessionAttendance
  ): Promise<LiveSessionAttendance> {
    const { rows } = await this.pool.query(
      `INSERT INTO live_session_attendance (session_id, student_id, joined_at, left_at, duration_minutes)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [
        attendanceData.sessionId,
        attendanceData.studentId,
        attendanceData.joinedAt ?? new Date(),
        attendanceData.leftAt ?? null,
        attendanceData.durationMinutes ?? 0,
      ]
    );
    return mapAttendance(rows[0]);
  }

  async getAttendanceBySession(sessionId: number): Promise<LiveSessionAttendance[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM live_session_attendance WHERE session_id = $1",
      [sessionId]
    );
    return rows.map(mapAttendance);
  }

  async updateLiveSessionAttendance(
    id: number,
    update: Partial<InsertLiveSessionAttendance>
  ): Promise<LiveSessionAttendance | undefined> {
    const sets: string[] = [];
    const params: QueryParam[] = [];
    let i = 1;
    if ("leftAt" in update) {
      sets.push(`left_at = $${i++}`);
      params.push(update.leftAt);
    }
    if ("durationMinutes" in update) {
      sets.push(`duration_minutes = $${i++}`);
      params.push(update.durationMinutes);
    }
    if (!sets.length) return undefined;
    params.push(id);
    const { rows } = await this.pool.query(
      `UPDATE live_session_attendance SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
      params
    );
    return rows[0] ? mapAttendance(rows[0]) : undefined;
  }

  // ── FCM Tokens ─────────────────────────────────────────────────────────────

  async upsertFcmToken(tokenData: InsertFcmToken): Promise<FcmToken> {
    const { rows } = await this.pool.query(
      `INSERT INTO fcm_tokens (user_id, token, device_type)
       VALUES ($1,$2,$3)
       ON CONFLICT (user_id, token) DO UPDATE SET device_type=EXCLUDED.device_type, updated_at=now()
       RETURNING *`,
      [tokenData.userId, tokenData.token, tokenData.deviceType ?? null]
    );
    return mapFcmToken(rows[0]);
  }

  async getFcmTokensByUser(userId: number): Promise<FcmToken[]> {
    const { rows } = await this.pool.query("SELECT * FROM fcm_tokens WHERE user_id = $1", [userId]);
    return rows.map(mapFcmToken);
  }

  async removeFcmToken(tokenStr: string): Promise<boolean> {
    const { rowCount } = await this.pool.query("DELETE FROM fcm_tokens WHERE token = $1", [
      tokenStr,
    ]);
    return (rowCount ?? 0) > 0;
  }

  async savePushToken(userId: number, token: string, deviceType: string | null): Promise<FcmToken> {
    return this.upsertFcmToken({ userId, token, deviceType });
  }

  async deletePushToken(userId: number, token: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      "DELETE FROM fcm_tokens WHERE user_id=$1 AND token=$2",
      [userId, token]
    );
    return (rowCount ?? 0) > 0;
  }

  // ── Tasks ──────────────────────────────────────────────────────────────────

  async createTask(task: InsertTask): Promise<Task> {
    const { rows } = await this.pool.query(
      `INSERT INTO tasks (user_id, title, status, priority, tags, due_date, comments, attachments)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        task.userId,
        task.title,
        task.status ?? "todo",
        task.priority ?? "medium",
        task.tags ?? [],
        task.dueDate ?? null,
        task.comments ?? 0,
        task.attachments ?? 0,
      ]
    );
    return mapTask(rows[0]);
  }

  async getTasksByUser(userId: number): Promise<Task[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );
    return rows.map(mapTask);
  }

  async updateTask(
    id: number,
    update: Partial<InsertTask>,
    userId: number
  ): Promise<Task | undefined> {
    const { rows: existing } = await this.pool.query("SELECT user_id FROM tasks WHERE id = $1", [
      id,
    ]);
    if (!existing[0] || n(existing[0].user_id) !== userId) return undefined;
    const colMap: Record<string, string> = {
      title: "title",
      status: "status",
      priority: "priority",
      tags: "tags",
      dueDate: "due_date",
      comments: "comments",
      attachments: "attachments",
    };
    const sets: string[] = [];
    const params: QueryParam[] = [];
    let i = 1;
    for (const [k, col] of Object.entries(colMap)) {
      if (k in update) {
        sets.push(`${col} = $${i++}`);
        params.push(Reflect.get(update, k));
      }
    }
    if (!sets.length) return undefined;
    params.push(id);
    const { rows } = await this.pool.query(
      `UPDATE tasks SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
      params
    );
    return rows[0] ? mapTask(rows[0]) : undefined;
  }

  async deleteTask(id: number, userId: number): Promise<boolean> {
    const { rowCount } = await this.pool.query("DELETE FROM tasks WHERE id=$1 AND user_id=$2", [
      id,
      userId,
    ]);
    return (rowCount ?? 0) > 0;
  }

  // ── Notifications ──────────────────────────────────────────────────────────

  async createNotification(n_: InsertNotification): Promise<AppNotification> {
    const { rows } = await this.pool.query(
      `INSERT INTO notifications (user_id, type, title, body, is_read, meta)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [n_.userId, n_.type, n_.title, n_.body, n_.isRead ?? false, n_.meta ?? null]
    );
    return mapNotification(rows[0]);
  }

  async getNotificationsByUser(userId: number): Promise<AppNotification[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC",
      [userId]
    );
    return rows.map(mapNotification);
  }

  async getPendingPushNotifications(limit = 50): Promise<AppNotification[]> {
    const { rows } = await this.pool.query(
      `SELECT *
       FROM notifications
       WHERE is_read=false
         AND (
           meta IS NULL OR
           meta = '' OR
           (
             meta NOT LIKE '%"status":"sent"%'
             AND meta NOT LIKE '%"status": "sent"%'
           )
         )
       ORDER BY created_at ASC
       LIMIT $1`,
      [limit]
    );
    return rows.map(mapNotification);
  }

  async markNotificationPushAttempt(
    id: number,
    status: "sent" | "failed",
    details: Record<string, unknown> = {}
  ): Promise<AppNotification | undefined> {
    const push = {
      status,
      attemptedAt: new Date().toISOString(),
      ...details,
    };
    const { rows } = await this.pool.query(
      `UPDATE notifications
       SET meta =
         jsonb_set(
           CASE
             WHEN meta IS NULL OR meta = '' THEN '{}'::jsonb
             WHEN meta LIKE '{%' THEN meta::jsonb
             ELSE jsonb_build_object('legacyMeta', meta)
           END,
           '{push}',
           $2::jsonb,
           true
         )::text
       WHERE id=$1
       RETURNING *`,
      [id, JSON.stringify(push)]
    );
    return rows[0] ? mapNotification(rows[0]) : undefined;
  }

  async markNotificationRead(id: number, userId: number): Promise<AppNotification | undefined> {
    const { rows } = await this.pool.query(
      "UPDATE notifications SET is_read=true WHERE id=$1 AND user_id=$2 RETURNING *",
      [id, userId]
    );
    return rows[0] ? mapNotification(rows[0]) : undefined;
  }

  async dismissNotification(id: number, userId: number): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      "DELETE FROM notifications WHERE id=$1 AND user_id=$2",
      [id, userId]
    );
    return (rowCount ?? 0) > 0;
  }

  async markAllNotificationsRead(userId: number): Promise<boolean> {
    await this.pool.query(
      "UPDATE notifications SET is_read=true WHERE user_id=$1 AND is_read=false",
      [userId]
    );
    return true;
  }

  // ── Focus Sessions ─────────────────────────────────────────────────────────

  async createFocusSession(sessionData: InsertFocusSession): Promise<FocusSession> {
    const { rows } = await this.pool.query(
      `INSERT INTO focus_sessions (user_id, subject, mode, duration_seconds, completed_at)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [
        sessionData.userId,
        sessionData.subject,
        sessionData.mode,
        sessionData.durationSeconds,
        sessionData.completedAt ?? new Date(),
      ]
    );
    return mapFocusSession(rows[0]);
  }

  async getFocusSessionsByUser(userId: number): Promise<FocusSession[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM focus_sessions WHERE user_id=$1 ORDER BY completed_at DESC",
      [userId]
    );
    return rows.map(mapFocusSession);
  }

  // ─── Student Lifecycle ──────────────────────────────────────────────────

  async createCompetency(c: InsertCompetency): Promise<Competency> {
    const { rows } = await this.pool.query(
      "INSERT INTO competencies (name, description) VALUES ($1, $2) RETURNING *",
      [c.name, c.description ?? null]
    );
    return mapCompetency(rows[0]);
  }

  async getCompetencies(): Promise<Competency[]> {
    const { rows } = await this.pool.query("SELECT * FROM competencies ORDER BY name ASC");
    return rows.map(mapCompetency);
  }

  async createDoubt(d: InsertDoubt): Promise<Doubt> {
    const { rows } = await this.pool.query(
      `INSERT INTO doubts (id, student_id, classroom_id, test_id, question, answer, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        d.id ?? crypto.randomUUID(),
        d.studentId,
        d.classroomId ?? null,
        d.testId ?? null,
        d.question,
        d.answer ?? null,
        d.status,
      ]
    );
    return mapDoubt(rows[0]);
  }

  async getDoubtsByStudent(studentId: number): Promise<Doubt[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM doubts WHERE student_id=$1 ORDER BY created_at DESC",
      [studentId]
    );
    return rows.map(mapDoubt);
  }

  async resolveDoubt(id: string, answer: string): Promise<Doubt | undefined> {
    const { rows } = await this.pool.query(
      "UPDATE doubts SET answer=$1, status='resolved', resolved_at=now() WHERE id=$2 RETURNING *",
      [answer, id]
    );
    return rows[0] ? mapDoubt(rows[0]) : undefined;
  }

  async createMilestone(m: InsertMilestone): Promise<Milestone> {
    const { rows } = await this.pool.query(
      `INSERT INTO milestones (id, student_id, competency_id, phase, reflection, score)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (student_id, competency_id, phase) 
       DO UPDATE SET reflection = EXCLUDED.reflection, score = GREATEST(milestones.score, EXCLUDED.score)
       RETURNING *`,
      [
        m.id ?? crypto.randomUUID(),
        m.studentId,
        m.competencyId,
        m.phase,
        m.reflection ?? null,
        m.score,
      ]
    );
    return mapMilestone(rows[0]);
  }

  async getMilestonesByStudent(studentId: number): Promise<Milestone[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM milestones WHERE student_id=$1 ORDER BY created_at DESC",
      [studentId]
    );
    return rows.map(mapMilestone);
  }

  async createCompetition(c: InsertCompetition): Promise<Competition> {
    const { rows } = await this.pool.query(
      `INSERT INTO competitions (name, organizer, level, category, competition_date)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [c.name, c.organizer ?? null, c.level, c.category ?? null, c.competitionDate ?? null]
    );
    return mapCompetition(rows[0]);
  }

  async getCompetitions(): Promise<Competition[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM competitions ORDER BY competition_date DESC"
    );
    return rows.map(mapCompetition);
  }

  async createAchievement(a: InsertStudentAchievement): Promise<StudentAchievement> {
    const { rows } = await this.pool.query(
      `INSERT INTO student_achievements 
         (id, student_id, competition_id, award_type, score, rank, certificate_url, verified, verified_by, verification_metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        a.id ?? crypto.randomUUID(),
        a.studentId,
        a.competitionId,
        a.awardType,
        a.score ?? null,
        a.rank ?? null,
        a.certificateUrl ?? null,
        a.verified,
        a.verifiedBy ?? null,
        a.verificationMetadata ?? {},
      ]
    );
    return mapAchievement(rows[0]);
  }

  async getAchievementsByStudent(studentId: number): Promise<StudentAchievement[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM student_achievements WHERE student_id=$1 ORDER BY created_at DESC",
      [studentId]
    );
    return rows.map(mapAchievement);
  }
}

export const storage = new PgStorage();
