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
} from "@shared/schema";
import { getPgPool } from "./db-pg";
import { getCassandraClient } from "./lib/cassandra";
import {
  cassandraCreateMessage,
  cassandraGetMessagesByChannel,
  cassandraDeleteMessage,
  cassandraPinMessage,
  cassandraGradeMessage,
  cassandraMarkMessageAsRead,
  cassandraGetPinnedMessages,
} from "./lib/cassandra-message-store";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";

export interface IStorage {
  sessionStore: session.Store;
  getUser(id: number | string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(role?: string): Promise<User[]>;
  getUsersByClass(className: string): Promise<User[]>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
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
  markNotificationRead(id: number, userId: number): Promise<AppNotification | undefined>;
  dismissNotification(id: number, userId: number): Promise<boolean>;
  markAllNotificationsRead(userId: number): Promise<boolean>;
  createFocusSession(session: InsertFocusSession): Promise<FocusSession>;
  getFocusSessionsByUser(userId: number): Promise<FocusSession[]>;
}

// ─── Row mappers ──────────────────────────────────────────────────────────────

function n(v: any): number | null {
  if (v == null) return null;
  const x = parseInt(v, 10);
  return isNaN(x) ? null : x;
}

function mapUser(r: any): User {
  return {
    id: n(r.id)!,
    username: r.username ?? "",
    password: r.password_hash ?? "",
    name: r.name ?? "",
    email: r.email,
    emailVerified: r.email_verified ?? false,
    role: r.role as any,
    status: r.status as any,
    avatar: r.avatar ?? null,
    class: r.class_name ?? null,
    subject: r.subject ?? null,
    school_code: r.school_code ?? null,
    grade: r.grade ?? null,
    board: r.board ?? null,
    subjects: r.subjects ?? [],
    district: r.district ?? null,
    createdAt: r.created_at,
    lastLoginAt: r.last_login_at ?? null,
  };
}

function mapSession(r: any): Session {
  return {
    id: n(r.id)!,
    userId: n(r.user_id)!,
    refreshTokenHash: r.refresh_token_hash,
    deviceInfo: r.device_info ?? null,
    ipAddress: r.ip_address ?? null,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
  };
}

function mapOtp(r: any): Otp {
  return {
    id: n(r.id)!,
    userId: n(r.user_id)!,
    otpHash: r.otp_hash,
    type: r.type as any,
    expiresAt: r.expires_at,
    used: r.used ?? false,
  };
}

function mapTest(r: any): Test {
  return {
    id: n(r.id)!,
    title: r.title,
    description: r.description ?? null,
    subject: r.subject,
    class: r.class_name,
    teacherId: n(r.teacher_id)!,
    totalMarks: n(r.total_marks) ?? 100,
    duration: n(r.duration) ?? 60,
    testDate: r.test_date,
    questionTypes: r.question_types ?? [],
    status: r.status as any,
    createdAt: r.created_at,
  };
}

function mapQuestion(r: any): Question {
  return {
    id: n(r.id)!,
    testId: n(r.test_id)!,
    type: r.type as any,
    text: r.text,
    options: r.options ?? null,
    correctAnswer: r.correct_answer ?? null,
    marks: n(r.marks) ?? 1,
    order: n(r.ord) ?? 0,
    aiRubric: r.ai_rubric ?? null,
  };
}

function mapAttempt(r: any): TestAttempt {
  return {
    id: n(r.id)!,
    testId: n(r.test_id)!,
    studentId: n(r.student_id)!,
    startTime: r.start_time,
    endTime: r.end_time ?? null,
    score: r.score != null ? parseFloat(r.score) : null,
    status: r.status as any,
  };
}

function mapAnswer(r: any): Answer {
  return {
    id: n(r.id)!,
    attemptId: n(r.attempt_id)!,
    questionId: n(r.question_id)!,
    text: r.text ?? null,
    selectedOption: n(r.selected_option),
    imageUrl: r.image_url ?? null,
    ocrText: r.ocr_text ?? null,
    score: r.score != null ? parseFloat(r.score) : null,
    aiConfidence: r.ai_confidence != null ? parseFloat(r.ai_confidence) : null,
    aiFeedback: r.ai_feedback ?? null,
    isCorrect: r.is_correct ?? null,
  };
}

function mapAnalytics(r: any): Analytics {
  return {
    id: n(r.id)!,
    userId: n(r.user_id)!,
    testId: n(r.test_id)!,
    weakTopics: r.weak_topics ?? [],
    strongTopics: r.strong_topics ?? [],
    recommendedResources: r.recommended_resources ?? [],
    insightDate: r.insight_date,
  };
}

function mapAssignment(r: any): TestAssignment {
  return {
    id: n(r.id)!,
    testId: n(r.test_id)!,
    studentId: n(r.student_id)!,
    assignedBy: n(r.assigned_by)!,
    assignedDate: r.assigned_date,
    dueDate: r.due_date,
    status: r.status as any,
    notificationSent: r.notification_sent ?? false,
  };
}

function mapWorkspace(r: any): Workspace {
  return {
    id: n(r.id)!,
    name: r.name,
    slug: r.slug ?? null,
    type: r.type ?? "business",
    description: r.description ?? null,
    ownerId: n(r.owner_id)!,
    members: (r.members ?? []).map(Number),
    createdAt: r.created_at,
  };
}

function mapChannel(r: any): Channel {
  return {
    id: n(r.id)!,
    workspaceId: n(r.workspace_id),
    name: r.name,
    type: r.type as any,
    class: r.class_name ?? null,
    subject: r.subject ?? null,
    pinnedMessages: (r.pinned_messages ?? []).map(Number),
    createdAt: r.created_at,
  };
}

function mapMessage(r: any): Message {
  return {
    id: n(r.id)!,
    channelId: n(r.channel_id)!,
    authorId: n(r.author_id)!,
    content: r.content,
    type: r.type as any,
    fileUrl: r.file_url ?? null,
    isPinned: r.is_pinned ?? false,
    isHomework: r.is_homework ?? false,
    gradingStatus: r.grading_status ?? null,
    readBy: (r.read_by ?? []).map(Number),
    createdAt: r.created_at,
  };
}

function mapLiveClass(r: any): LiveClass {
  return {
    id: n(r.id)!,
    title: r.title,
    description: r.description ?? null,
    teacherId: n(r.teacher_id)!,
    class: r.class_name,
    scheduledTime: r.scheduled_time,
    durationMinutes: n(r.duration_minutes) ?? 60,
    status: r.status as any,
    dailyRoomName: r.daily_room_name ?? null,
    dailyRoomUrl: r.daily_room_url ?? null,
    startedAt: r.started_at ?? null,
    endedAt: r.ended_at ?? null,
    recordingUrl: r.recording_url ?? null,
    createdAt: r.created_at,
  };
}

function mapAttendance(r: any): LiveSessionAttendance {
  return {
    id: n(r.id)!,
    sessionId: n(r.session_id)!,
    studentId: n(r.student_id)!,
    joinedAt: r.joined_at,
    leftAt: r.left_at ?? null,
    durationMinutes: n(r.duration_minutes) ?? 0,
  };
}

function mapFcmToken(r: any): FcmToken {
  return {
    id: n(r.id)!,
    userId: n(r.user_id)!,
    token: r.token,
    deviceType: r.device_type ?? null,
    updatedAt: r.updated_at,
  };
}

function mapTask(r: any): Task {
  return {
    id: n(r.id)!,
    userId: n(r.user_id)!,
    title: r.title,
    status: r.status as any,
    priority: r.priority as any,
    tags: r.tags ?? [],
    dueDate: r.due_date ?? null,
    comments: n(r.comments) ?? 0,
    attachments: n(r.attachments) ?? 0,
    createdAt: r.created_at,
  };
}

function mapNotification(r: any): AppNotification {
  return {
    id: n(r.id)!,
    userId: n(r.user_id)!,
    type: r.type as any,
    title: r.title,
    body: r.body,
    isRead: r.is_read ?? false,
    meta: r.meta ?? null,
    createdAt: r.created_at,
  };
}

function mapFocusSession(r: any): FocusSession {
  return {
    id: n(r.id)!,
    userId: n(r.user_id)!,
    subject: r.subject,
    mode: r.mode as any,
    durationSeconds: n(r.duration_seconds)!,
    completedAt: r.completed_at,
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
    const params: any[] = [];
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
    const params: any[] = [];
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
    const params: any[] = [];
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
    const params: any[] = [];
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
    const params: any[] = [];
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
    const params: any[] = [];
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
    const params: any[] = [];
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
    const params: any[] = [];
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
    const params: any[] = [channelId, limit];
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
    const params: any[] = [];
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
    const params: any[] = [];
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
    const params: any[] = [];
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
}

export const storage = new PgStorage();
