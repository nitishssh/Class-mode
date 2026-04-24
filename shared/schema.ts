import { z } from "zod";

// Zod schemas for validation
export const insertUserSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  role: z
    .enum(["student", "teacher", "parent", "principal", "school_admin", "admin"])
    .default("student"),
  status: z.enum(["active", "pending", "suspended", "rejected"]).default("active"),
  avatar: z.string().optional().nullable(),
  class: z.string().optional().nullable(),
  subject: z.string().optional().nullable(),
  school_code: z.string().optional().nullable(),
  grade: z.string().optional().nullable(),
  board: z.string().optional().nullable(),
  subjects: z.array(z.string()).optional().nullable(),
  district: z.string().optional().nullable(),
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
