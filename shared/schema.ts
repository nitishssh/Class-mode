import { z } from "zod";
import { USER_ROLES, USER_STATUSES } from "./authz";

// Zod schemas for validation
export const insertUserSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(USER_ROLES).default("student"),
  status: z.enum(USER_STATUSES).default("active"),
  avatar: z.string().optional().nullable(),
  emailVerified: z.boolean().optional(),
  class: z.string().optional().nullable(),
  subject: z.string().optional().nullable(),
  school_code: z.string().optional().nullable(),
  grade: z.string().optional().nullable(),
  board: z.string().optional().nullable(),
  subjects: z.array(z.string()).optional().nullable(),
  district: z.string().optional().nullable(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  displayName: z.string().optional().nullable(),
  avatar: z.string().optional().nullable(),
  status: z.enum(USER_STATUSES).optional(),
  class: z.string().optional().nullable(),
  subject: z.string().optional().nullable(),
  grade: z.string().optional().nullable(),
  subjects: z.array(z.string()).optional().nullable(),
});

export const insertSchoolClassSchema = z.object({
  name: z.string().min(1, "Class name is required"),
  grade: z.string().min(1, "Grade is required"),
  teacherFirebaseUid: z.string().optional().nullable(),
});

export const updateSchoolClassSchema = z.object({
  name: z.string().min(1).optional(),
  grade: z.string().min(1).optional(),
  teacherFirebaseUid: z.string().optional().nullable(),
});

export const updateSchoolSchema = z.object({
  name: z.string().min(1, "School name is required"),
  city: z.string().optional().nullable(),
  board: z.string().optional().nullable(),
});

export const insertTestSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  subject: z.string().min(1),
  class: z.string().min(1),
  teacherId: z.number(),
  totalMarks: z.number().default(100),
  duration: z.number().default(60),
  testDate: z.string().or(z.date()),
  questionTypes: z.array(z.string()),
  status: z.enum(["draft", "published", "completed"]).default("draft"),
});

export const insertQuestionSchema = z.object({
  testId: z.number(),
  type: z.enum(["mcq", "short", "long", "numerical"]),
  text: z.string().min(1),
  options: z.any().optional().nullable(),
  correctAnswer: z.string().optional().nullable(),
  marks: z.number().default(1),
  order: z.number(),
  aiRubric: z.string().optional().nullable(),
});

export const insertTestAttemptSchema = z.object({
  testId: z.number(),
  studentId: z.number(),
  startTime: z.string().or(z.date()).optional(),
  endTime: z.string().or(z.date()).optional().nullable(),
  score: z.number().optional().nullable(),
  status: z.enum(["in_progress", "completed", "evaluated"]).default("in_progress"),
});

export const insertAnswerSchema = z.object({
  attemptId: z.number(),
  questionId: z.number(),
  text: z.string().optional().nullable(),
  selectedOption: z.number().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  ocrText: z.string().optional().nullable(),
  score: z.number().optional().nullable(),
  aiConfidence: z.number().optional().nullable(),
  aiFeedback: z.string().optional().nullable(),
  isCorrect: z.boolean().optional().nullable(),
});

export const insertAnalyticsSchema = z.object({
  userId: z.number(),
  testId: z.number(),
  weakTopics: z.array(z.string()),
  strongTopics: z.array(z.string()),
  recommendedResources: z.array(z.string()),
  insightDate: z.string().or(z.date()).optional(),
});

// Types inferred from Zod schemas
export type User = z.infer<typeof insertUserSchema> & {
  id: number;
  createdAt?: Date;
  lastLoginAt?: Date;
};
export type InsertUser = z.infer<typeof insertUserSchema>;

// ─── Authentication Schemas ──────────────────────────────────────────────────
export const insertSessionSchema = z.object({
  userId: z.number(),
  refreshTokenHash: z.string(),
  deviceInfo: z.string().optional().nullable(),
  ipAddress: z.string().optional().nullable(),
  expiresAt: z.date(),
});

export type Session = z.infer<typeof insertSessionSchema> & { id: number; createdAt: Date };
export type InsertSession = z.infer<typeof insertSessionSchema>;

export const insertOtpSchema = z.object({
  userId: z.number(),
  otpHash: z.string(),
  type: z.enum(["registration", "password_reset", "2fa"]),
  expiresAt: z.date(),
  used: z.boolean().default(false),
});

export type Otp = z.infer<typeof insertOtpSchema> & { id: number };
export type InsertOtp = z.infer<typeof insertOtpSchema>;

export type Test = z.infer<typeof insertTestSchema> & { id: number; createdAt: Date };
export type InsertTest = z.infer<typeof insertTestSchema>;

export type Question = z.infer<typeof insertQuestionSchema> & { id: number };
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;

export type TestAttempt = z.infer<typeof insertTestAttemptSchema> & { id: number };
export type InsertTestAttempt = z.infer<typeof insertTestAttemptSchema>;

export type Answer = z.infer<typeof insertAnswerSchema> & { id: number };
export type InsertAnswer = z.infer<typeof insertAnswerSchema>;

export type Analytics = z.infer<typeof insertAnalyticsSchema> & { id: number };
export type InsertAnalytics = z.infer<typeof insertAnalyticsSchema>;

// ─── Test Assignment Schemas ────────────────────────────────────────────────

export const insertTestAssignmentSchema = z.object({
  testId: z.number(),
  studentId: z.number(),
  assignedBy: z.number(),
  assignedDate: z.string().or(z.date()).optional(),
  dueDate: z.string().or(z.date()),
  status: z.enum(["pending", "started", "completed", "overdue"]).default("pending"),
  notificationSent: z.boolean().default(false),
});

export type TestAssignment = z.infer<typeof insertTestAssignmentSchema> & { id: number };
export type InsertTestAssignment = z.infer<typeof insertTestAssignmentSchema>;

// ─── Chat Feature Schemas ───────────────────────────────────────────────────

export const insertWorkspaceSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional().nullable(),
  type: z.enum(["business", "school", "personal"]).optional(),
  description: z.string().optional().nullable(),
  ownerId: z.number(),
  members: z.array(z.number()).default([]),
});

export const insertChannelSchema = z.object({
  workspaceId: z.number().optional().nullable(),
  name: z.string().min(1),
  type: z.enum(["text", "announcement", "dm"]).default("text"),
  class: z.string().optional().nullable(),
  subject: z.string().optional().nullable(),
});

export const insertMessageSchema = z.object({
  channelId: z.number(),
  authorId: z.number(),
  content: z.string().min(1),
  type: z.enum(["text", "file", "image"]).default("text"),
  fileUrl: z.string().optional().nullable(),
  isHomework: z.boolean().default(false),
  gradingStatus: z.enum(["pending", "graded"]).optional().nullable(),
  readBy: z.array(z.number()).default([]),
});

export type Workspace = z.infer<typeof insertWorkspaceSchema> & { id: number; createdAt: Date };
export type InsertWorkspace = z.infer<typeof insertWorkspaceSchema>;

export type Channel = z.infer<typeof insertChannelSchema> & {
  id: number;
  pinnedMessages: number[];
  createdAt: Date;
};
export type InsertChannel = z.infer<typeof insertChannelSchema>;

export type Message = z.infer<typeof insertMessageSchema> & {
  id: number;
  isPinned: boolean;
  createdAt: Date;
};
export type InsertMessage = z.infer<typeof insertMessageSchema>;

// ─── Live Classes Schemas ───────────────────────────────────────────────────

export const insertLiveClassSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  teacherId: z.number(),
  class: z.string().min(1),
  scheduledTime: z.string().or(z.date()),
  durationMinutes: z.number().default(60),
  status: z.enum(["scheduled", "live", "completed", "cancelled"]).default("scheduled"),
  dailyRoomName: z.string().optional().nullable(),
  dailyRoomUrl: z.string().optional().nullable(),
  startedAt: z.string().or(z.date()).optional().nullable(),
  endedAt: z.string().or(z.date()).optional().nullable(),
  recordingUrl: z.string().optional().nullable(),
});

export type LiveClass = z.infer<typeof insertLiveClassSchema> & { id: number; createdAt: Date };
export type InsertLiveClass = z.infer<typeof insertLiveClassSchema>;

export const insertLiveSessionAttendanceSchema = z.object({
  sessionId: z.number(),
  studentId: z.number(),
  joinedAt: z.string().or(z.date()).optional(),
  leftAt: z.string().or(z.date()).optional().nullable(),
  durationMinutes: z.number().default(0),
});

export type LiveSessionAttendance = z.infer<typeof insertLiveSessionAttendanceSchema> & {
  id: number;
};
export type InsertLiveSessionAttendance = z.infer<typeof insertLiveSessionAttendanceSchema>;

export const insertFcmTokenSchema = z.object({
  userId: z.number(),
  token: z.string(),
  deviceType: z.string().optional().nullable(),
});

export type FcmToken = z.infer<typeof insertFcmTokenSchema> & { id: number; updatedAt: Date };
export type InsertFcmToken = z.infer<typeof insertFcmTokenSchema>;

// ─── Task Schemas ────────────────────────────────────────────────────────────

export const insertTaskSchema = z.object({
  userId: z.number(),
  title: z.string().min(1),
  status: z.enum(["backlog", "todo", "in-progress", "review", "done"]).default("todo"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  tags: z.array(z.string()).default([]),
  dueDate: z.string().optional().nullable(),
  comments: z.number().default(0),
  attachments: z.number().default(0),
});
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = InsertTask & { id: number; createdAt: Date };

// ─── Notification Schemas ─────────────────────────────────────────────────────

export const insertNotificationSchema = z.object({
  userId: z.number(),
  type: z.enum(["test", "result", "announcement", "message", "achievement", "reminder"]),
  title: z.string().min(1),
  body: z.string().min(1),
  isRead: z.boolean().default(false),
  meta: z.string().optional().nullable(),
});
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = InsertNotification & { id: number; createdAt: Date };

// ─── Focus Session Schemas ────────────────────────────────────────────────────

export const insertFocusSessionSchema = z.object({
  userId: z.number(),
  subject: z.string().min(1),
  mode: z.enum(["work", "short", "long"]),
  durationSeconds: z.number().int().positive(),
  completedAt: z.string().or(z.date()).optional(),
});
export type InsertFocusSession = z.infer<typeof insertFocusSessionSchema>;
export type FocusSession = InsertFocusSession & { id: number };

// ─── AI Classroom Schemas ───────────────────────────────────────────────────

export const insertAIClassroomSchema = z.object({
  teacherId: z.number(),
  topic: z.string().min(1),
  studyArenaJobId: z.string().min(1),
  classroomId: z.string().optional().nullable(),
  status: z.enum(["pending", "generating", "ready", "error"]).default("pending"),
  url: z.string().optional().nullable(),
});
export type InsertAIClassroom = z.infer<typeof insertAIClassroomSchema>;
export type AIClassroom = InsertAIClassroom & { id: number; createdAt: Date };

// ─── No-Code SIS (Airtable/Clay) Schemas ─────────────────────────────────────

export const dynamicFieldTypeSchema = z.enum([
  "text",
  "number",
  "date",
  "select",
  "multiselect",
  "checkbox",
  "relation",
  "formula",
  "ai_enrichment",
  "whatsapp_action",
  "api_fetch",
]);

export const insertDynamicBaseSchema = z.object({
  workspaceId: z.number(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
});

export const insertDynamicTableSchema = z.object({
  baseId: z.number(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  ord: z.number().default(0),
});

export const insertDynamicFieldSchema = z.object({
  tableId: z.number(),
  name: z.string().min(1),
  type: dynamicFieldTypeSchema,
  config: z.record(z.any()).default({}),
  ord: z.number().default(0),
  isPrimary: z.boolean().default(false),
  isHidden: z.boolean().default(false),
});

export const insertDynamicRecordSchema = z.object({
  tableId: z.number(),
  data: z.record(z.any()).default({}),
});

export const insertDynamicViewSchema = z.object({
  tableId: z.number(),
  name: z.string().min(1),
  type: z.enum(["grid", "kanban", "calendar", "gallery"]).default("grid"),
  config: z.record(z.any()).default({}),
  filter: z.record(z.any()).default({}),
  sort: z.array(z.any()).default([]),
  ord: z.number().default(0),
});

export type DynamicBase = z.infer<typeof insertDynamicBaseSchema> & {
  id: number;
  createdAt: Date;
  updatedAt: Date;
};
export type InsertDynamicBase = z.infer<typeof insertDynamicBaseSchema>;

export type DynamicTable = z.infer<typeof insertDynamicTableSchema> & {
  id: number;
  createdAt: Date;
  updatedAt: Date;
};
export type InsertDynamicTable = z.infer<typeof insertDynamicTableSchema>;

export type DynamicField = z.infer<typeof insertDynamicFieldSchema> & {
  id: number;
  createdAt: Date;
  updatedAt: Date;
};
export type InsertDynamicField = z.infer<typeof insertDynamicFieldSchema>;

export type DynamicRecord = z.infer<typeof insertDynamicRecordSchema> & {
  id: string; // UUID
  createdAt: Date;
  updatedAt: Date;
};
export type InsertDynamicRecord = z.infer<typeof insertDynamicRecordSchema>;

export type DynamicView = z.infer<typeof insertDynamicViewSchema> & {
  id: number;
  createdAt: Date;
};
export type InsertDynamicView = z.infer<typeof insertDynamicViewSchema>;

// ─── Student Lifecycle Schemas ──────────────────────────────────────────────

export const insertCompetencySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
});

export const insertDoubtSchema = z.object({
  id: z.string().uuid().optional(),
  studentId: z.number(),
  classroomId: z.number().optional().nullable(),
  testId: z.number().optional().nullable(),
  question: z.string().min(1),
  answer: z.string().optional().nullable(),
  status: z.enum(["pending", "resolved"]).default("pending"),
  resolvedAt: z.string().or(z.date()).optional().nullable(),
});

export const insertMilestoneSchema = z.object({
  id: z.string().uuid().optional(),
  studentId: z.number(),
  competencyId: z.number(),
  phase: z.enum(["decide", "plan", "compete", "sorted"]),
  reflection: z.string().optional().nullable(),
  score: z.number().min(0).max(100).default(0),
});

export const insertCompetitionSchema = z.object({
  name: z.string().min(1),
  organizer: z.string().optional().nullable(),
  level: z.enum(["school", "district", "state", "national", "international"]).default("school"),
  category: z.string().optional().nullable(),
  competitionDate: z.string().or(z.date()).optional().nullable(),
});

export const insertStudentAchievementSchema = z.object({
  id: z.string().uuid().optional(),
  studentId: z.number(),
  competitionId: z.number(),
  awardType: z.string().min(1), // winner, runner_up, participation, etc.
  score: z.number().optional().nullable(),
  rank: z.number().optional().nullable(),
  certificateUrl: z.string().optional().nullable(),
  verified: z.boolean().default(false),
  verifiedBy: z.number().optional().nullable(),
  verificationMetadata: z.record(z.any()).default({}),
});

export type Competency = z.infer<typeof insertCompetencySchema> & { id: number; createdAt: Date };
export type InsertCompetency = z.infer<typeof insertCompetencySchema>;

export type Doubt = z.infer<typeof insertDoubtSchema> & { id: string; createdAt: Date };
export type InsertDoubt = z.infer<typeof insertDoubtSchema>;

export type Milestone = z.infer<typeof insertMilestoneSchema> & { id: string; createdAt: Date };
export type InsertMilestone = z.infer<typeof insertMilestoneSchema>;

export type Competition = z.infer<typeof insertCompetitionSchema> & { id: number; createdAt: Date };
export type InsertCompetition = z.infer<typeof insertCompetitionSchema>;

export type StudentAchievement = z.infer<typeof insertStudentAchievementSchema> & {
  id: string;
  createdAt: Date;
};
export type InsertStudentAchievement = z.infer<typeof insertStudentAchievementSchema>;

// ─── Subscription Schemas ────────────────────────────────────────────────────

export const insertSubscriptionSchema = z.object({
  userId: z.number(),
  workspaceId: z.number().optional().nullable(),
  tier: z.enum(["free", "pro", "educator", "institution"]).default("free"),
  stripeCustomerId: z.string().optional().nullable(),
  stripeSubscriptionId: z.string().optional().nullable(),
  status: z.enum(["active", "canceled", "past_due", "trialing"]).default("active"),
  currentPeriodStart: z.string().or(z.date()).optional().nullable(),
  currentPeriodEnd: z.string().or(z.date()).optional().nullable(),
  cancelAtPeriodEnd: z.boolean().default(false),
});

export type Subscription = z.infer<typeof insertSubscriptionSchema> & {
  id: number;
  createdAt: Date;
  updatedAt: Date;
};
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;

// ─── Usage Logging Schemas (for AI Quotas) ───────────────────────────────────

export const insertUsageLogSchema = z.object({
  userId: z.number(),
  workspaceId: z.number().optional().nullable(),
  feature: z.enum(["ai_classroom", "ai_tutor", "ocr"]),
  tokensUsed: z.number().optional().nullable(),
  metadata: z.record(z.any()).default({}),
});

export type UsageLog = z.infer<typeof insertUsageLogSchema> & {
  id: number;
  createdAt: Date;
};
export type InsertUsageLog = z.infer<typeof insertUsageLogSchema>;

// ─── Timetable Schemas ──────────────────────────────────────────────────────

export const insertTimetableSlotSchema = z.object({
  workspaceId: z.number(),
  teacherId: z.number(),
  className: z.string().min(1),
  subject: z.string().min(1),
  dayOfWeek: z.number().min(0).max(6), // 0 = Sunday, 1 = Monday, etc.
  periodNumber: z.number().min(1).max(12),
  startTime: z.string(), // "08:00"
  endTime: z.string(), // "08:45"
  room: z.string().optional().nullable(),
});

export type TimetableSlot = z.infer<typeof insertTimetableSlotSchema> & {
  id: number;
  createdAt: Date;
};
export type InsertTimetableSlot = z.infer<typeof insertTimetableSlotSchema>;
