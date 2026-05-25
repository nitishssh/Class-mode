import express, { type Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import authRouter from "./routes/auth";
import { storage } from "./storage";
import {
  insertTestSchema,
  insertQuestionSchema,
  insertTestAttemptSchema,
  insertAnswerSchema,
  insertWorkspaceSchema,
  insertChannelSchema,
  insertMessageSchema,
  insertTaskSchema,
  insertFocusSessionSchema,
  type Channel,
} from "@shared/schema";
import { z } from "zod";
import { processOCRImage } from "./lib/tesseract";
import { evaluateSubjectiveAnswer, aiChat } from "./lib/openai";
import { upload, diskPathToUrl } from "./lib/upload";
import { setCustomUserClaims } from "./lib/firebase-admin";
import { logger } from "./lib/logger";
import { recordAuditEvent, AUDIT_EVENTS } from "./lib/audit";
import {
  pgFindFirstWorkspaceMembership,
  pgCreateWorkspaceInvite,
  pgFindWorkspaceById,
  pgFindWorkspaceMembership,
  pgFindUserById,
  pgFindUsers,
  pgUpdateUser,
  pgCountUsers,
} from "./lib/pg-queries";
import { ACCESS_COOKIE, authMePayload, randomToken, tokenHash } from "./lib/auth-workspace";
import { sendWorkspaceInvite } from "./lib/mailer";
import { getPgPool, isPgReady } from "./db-pg";
import messageRoutes from "./message/routes";
import { liveRouter } from "./routes/live";
import aiClassroomRoutes from "./routes/ai-classroom";
import healthRoutes from "./routes/health";
import gradingRoutes from "./routes/grading";
import educatorRoutes from "./routes/educator";
import parentRoutes from "./routes/parent";
import billingRoutes from "./routes/billing";
import gdprRoutes from "./routes/gdpr";
import lmsRoutes from "./routes/lms";
import onboardingRouter from "./routes/onboarding";

import jwt from "jsonwebtoken";
import "express-session";

declare module "express-session" {
  interface SessionData {
    userId: number;
    role: string;
    firebaseUid?: string;
    email: string;
    oauthState?: string;
    lmsOauthUserId?: number;
  }
}

interface CustomJwtPayload extends jwt.JwtPayload {
  userId?: number;
  sessionId?: number;
  role?: string;
  email?: string;
}

if (!process.env.JWT_SECRET) {
  throw new Error(
    "JWT_SECRET environment variable is required. Set it in your .env file (see .env.example)."
  );
}
const JWT_SECRET: string = process.env.JWT_SECRET;

// Auth Middleware
// Verifies the server-issued JWT only — never calls Firebase Admin on hot path.
// Firebase ID tokens are exchanged for server JWTs once at /api/auth/firebase.
export async function authenticateToken(req: Request, res: Response, next: express.NextFunction) {
  const token = req.cookies?.[ACCESS_COOKIE] || req.headers.authorization?.split(" ")[1];

  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as CustomJwtPayload;
      if (payload?.userId) {
        const user = await pgFindUserById(payload.userId);
        if (!user || ["suspended", "rejected"].includes(user.status)) {
          return res.status(401).json({ message: "Authentication required" });
        }
        const workspaceContext = await pgFindFirstWorkspaceMembership(user.id);
        req.session!.userId = user.id;
        req.session!.role = user.role;
        req.session!.firebaseUid = user.firebaseUid || user.authSubject;
        (req as any).user = {
          id: user.id,
          role: user.role,
          email: user.email,
          status: user.status,
          emailVerified: user.emailVerified,
        };
        (req as any).workspace = workspaceContext?.workspace ?? null;
        (req as any).workspaceRole = workspaceContext?.membership.role ?? null;
        (req as any).permissions = authMePayload({
          user,
          workspace: workspaceContext?.workspace ?? null,
          membership: workspaceContext?.membership ?? null,
        }).permissions;
        return next();
      }
    } catch {
      // JWT invalid — try session fallback below
    }
  }

  // Session fallback: WebSocket-established sessions or legacy cookie-only flows
  if (req.session?.userId) {
    try {
      const user = await pgFindUserById(req.session.userId);
      if (user && !["suspended", "rejected"].includes(user.status)) {
        const workspaceContext = await pgFindFirstWorkspaceMembership(user.id);
        req.session!.firebaseUid = user.firebaseUid || user.authSubject;
        (req as any).user = {
          id: user.id,
          role: user.role,
          email: user.email,
          status: user.status,
          emailVerified: user.emailVerified,
        };
        (req as any).workspace = workspaceContext?.workspace ?? null;
        (req as any).workspaceRole = workspaceContext?.membership.role ?? null;
        (req as any).permissions = authMePayload({
          user,
          workspace: workspaceContext?.workspace ?? null,
          membership: workspaceContext?.membership ?? null,
        }).permissions;
        return next();
      }
    } catch {
      // DB error — fall through to 401
    }
  }

  return res.status(401).json({ message: "Authentication required" });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Mount MessagePal REST API routes
  app.use("/api/messagepal", messageRoutes);

  // Mount New Daily.co Live Classes API routes
  app.use("/api/live", authenticateToken, liveRouter);

  // Mount AI Classroom routes (Study Arena integration)
  app.use("/api/ai-classroom", aiClassroomRoutes);

  // Mount Grading API routes (AI-powered submission grading)
  app.use("/api/grading", gradingRoutes);

  // Mount Educator routes
  app.use("/api/educator", educatorRoutes);

  // Mount Parent routes
  app.use("/api/parent", parentRoutes);

  // Mount Billing routes (Stripe subscriptions)
  app.use("/api/billing", billingRoutes);

  // Mount LMS routes (Google Classroom, Canvas)
  app.use("/api/lms", lmsRoutes);

  // Mount GDPR routes (export, delete)
  app.use("/api/gdpr", gdprRoutes);

  // Mount Health check routes
  app.use("/api/health", healthRoutes);

  // Authentication routes (mostly handled by Firebase Client now)
  app.use("/api/auth", authRouter);
  // Public invite routes live outside /auth for email links and compatibility.
  app.use("/api", authRouter);
  // Onboarding stage routes
  app.use("/api", onboardingRouter);

  const workspaceInviteSchema = z.object({
    email: z.string().email(),
    name: z.string().optional(),
    role: z.enum(["admin", "member"]),
    kind: z.enum(["business_member", "student"]),
    studentMeta: z.record(z.string(), z.unknown()).optional(),
  });

  app.post(
    "/api/workspaces/:id/invites",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const workspaceId = parseInt(req.params.id, 10);
        const user = (req as any).user;
        if (!user?.id || Number.isNaN(workspaceId)) {
          return res.status(401).json({ message: "Authentication required" });
        }

        const membership = await pgFindWorkspaceMembership(workspaceId, user.id);
        if (!membership || !["owner", "admin"].includes(membership.role)) {
          return res
            .status(403)
            .json({ message: "Only workspace owners and admins can invite members" });
        }

        const parsed = workspaceInviteSchema.safeParse(req.body);
        if (!parsed.success)
          return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

        const workspace = await pgFindWorkspaceById(workspaceId);
        if (!workspace) return res.status(404).json({ message: "Workspace not found" });

        const rawToken = randomToken();
        const invite = await pgCreateWorkspaceInvite({
          workspaceId,
          email: parsed.data.email,
          name: parsed.data.name ?? null,
          role: parsed.data.kind === "student" ? "member" : parsed.data.role,
          kind: parsed.data.kind,
          tokenHash: tokenHash(rawToken),
          invitedBy: user.id,
          studentMeta: parsed.data.studentMeta ?? {},
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        sendWorkspaceInvite(
          parsed.data.email,
          parsed.data.name ?? "",
          workspace.name,
          rawToken,
          parsed.data.kind
        ).catch((e) =>
          logger.warn("[workspace/invites] Failed to send invite", { error: String(e) })
        );

        recordAuditEvent({
          actorUserId: user.id,
          eventType: AUDIT_EVENTS.INVITE_SENT,
          payload: {
            workspaceId,
            email: parsed.data.email,
            kind: parsed.data.kind,
            role: invite.role,
          },
        });

        return res.status(201).json({ id: invite.id, status: invite.status });
      } catch (error) {
        logger.error("[workspace/invites] Error", { error: String(error) });
        return res.status(500).json({ message: "Failed to create invite" });
      }
    }
  );

  // ─── Dashboard Data Routes ───────────────────────────────────────────────────

  /**
   * Student Dashboard Data Aggregation
   */
  app.get("/api/dashboards/student", authenticateToken, async (req: Request, res: Response) => {
    const studentId = req.session.userId;
    if (!studentId) return res.status(401).json({ message: "Unauthorized" });

    try {
      const user = await pgFindUserById(studentId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const subjects = user.subjects || [];
      const pool = isPgReady() ? getPgPool() : null;

      const [upcomingAssignments, recentResults, tasks] = await Promise.all([
        pool
          ? pool
              .query(
                `
          SELECT ta.*, t.title as "testTitle", t.subject, t.description as topic
          FROM test_assignments ta
          JOIN tests t ON t.id = ta.test_id
          WHERE ta.student_id = $1 AND ta.status IN ('pending','started')
          ORDER BY ta.due_date ASC LIMIT 5`,
                [studentId]
              )
              .then((r) => r.rows)
          : [],
        pool
          ? pool
              .query(
                `
          SELECT * FROM test_attempts WHERE student_id = $1 AND status = 'evaluated'
          ORDER BY end_time DESC LIMIT 5`,
                [studentId]
              )
              .then((r) => r.rows)
          : [],
        storage.getTasksByUser(studentId),
      ]);

      res.json({
        profile: {
          name: user.name,
          displayName: user.displayName,
          grade: user.grade,
          xp: 450,
          level: 12,
          streak: 6,
        },
        subjects,
        upcomingTests: upcomingAssignments,
        recentResults,
        tasks,
      });
    } catch (error) {
      logger.error("Error fetching student dashboard data:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  /**
   * Teacher Dashboard Data Aggregation
   */
  app.get("/api/dashboards/teacher", authenticateToken, async (req: Request, res: Response) => {
    const teacherId = req.session.userId;
    if (!teacherId) return res.status(401).json({ message: "Unauthorized" });

    try {
      const user = await pgFindUserById(teacherId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const pool = isPgReady() ? getPgPool() : null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [myTests, pendingSubmissions, liveClasses] = await Promise.all([
        pool
          ? pool
              .query(
                `SELECT * FROM tests WHERE teacher_id = $1 ORDER BY created_at DESC LIMIT 10`,
                [teacherId]
              )
              .then((r) => r.rows)
          : [],
        pool
          ? pool
              .query(
                `
          SELECT ta.* FROM test_attempts ta
          JOIN tests t ON t.id = ta.test_id
          WHERE t.teacher_id = $1 AND ta.status = 'completed'
          ORDER BY ta.end_time DESC LIMIT 5`,
                [teacherId]
              )
              .then((r) => r.rows)
          : [],
        pool
          ? pool
              .query(
                `SELECT * FROM live_classes WHERE teacher_id = $1 AND scheduled_time >= $2 AND scheduled_time < $3`,
                [teacherId, today, tomorrow]
              )
              .then((r) => r.rows)
          : [],
      ]);

      res.json({
        stats: {
          activeTests: myTests.length,
          totalStudents: 0,
          avgScore: 0,
          classesCount: liveClasses.length,
        },
        tests: myTests,
        pendingSubmissions,
        liveClasses,
      });
    } catch (error) {
      logger.error("Error fetching teacher dashboard data:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/users/me", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Don't return the password
      const userWithoutPassword = { ...user };
      delete (userWithoutPassword as { password?: string }).password;

      res.status(200).json(userWithoutPassword);
    } catch {
      res.status(500).json({ message: "Failed to get user data" });
    }
  });

  // Test routes
  app.post("/api/tests", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId || (req.session.role || "") !== "teacher") {
        return res.status(401).json({ message: "Unauthorized: Only teachers can create tests" });
      }

      const testData = insertTestSchema.parse(req.body);

      // Ensure the teacher is creating their own test
      if (testData.teacherId !== req.session.userId) {
        return res.status(403).json({ message: "Forbidden: Can only create tests for yourself" });
      }

      const test = await storage.createTest(testData);

      res.status(201).json(test);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create test" });
    }
  });

  app.get("/api/tests", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { teacherId, status } = req.query;

      // Convert teacherId to number if it exists
      const teacherIdNum = teacherId ? parseInt(teacherId as string) : undefined;

      // For teachers: get their own tests or all tests if admin
      // For students: get tests for their class
      let tests;
      if (req.session.role === "teacher") {
        tests = await storage.getTests(
          teacherIdNum || req.session.userId,
          status as string | undefined
        );
      } else {
        // Get user to find their class
        const user = await storage.getUser(req.session.userId);
        if (!user || !user.class) {
          return res.status(400).json({ message: "User class not found" });
        }

        // Get tests for the student's class
        tests = await storage.getTestsByClass(user.class);

        // Filter by status if provided
        if (status) {
          tests = tests.filter((test) => test.status === status);
        }
      }

      res.status(200).json(tests);
    } catch {
      res.status(500).json({ message: "Failed to get tests" });
    }
  });

  app.get("/api/tests/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const testId = parseInt(req.params.id);

      if (isNaN(testId)) {
        return res.status(400).json({ message: "Invalid test ID" });
      }

      const test = await storage.getTest(testId);

      if (!test) {
        return res.status(404).json({ message: "Test not found" });
      }

      // Check if user has access to this test
      if (req.session.role === "teacher" && test.teacherId !== req.session.userId) {
        return res.status(403).json({ message: "Forbidden: Not your test" });
      } else if (req.session.role === "student") {
        // Get user to check their class
        const user = await storage.getUser(req.session.userId);

        if (!user || user.class !== test.class) {
          return res.status(403).json({ message: "Forbidden: Not your class's test" });
        }
      }

      res.status(200).json(test);
    } catch {
      res.status(500).json({ message: "Failed to get test" });
    }
  });

  app.patch("/api/tests/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId || (req.session.role || "") !== "teacher") {
        return res.status(401).json({ message: "Unauthorized: Only teachers can update tests" });
      }

      const testId = parseInt(req.params.id);

      if (isNaN(testId)) {
        return res.status(400).json({ message: "Invalid test ID" });
      }

      const test = await storage.getTest(testId);

      if (!test) {
        return res.status(404).json({ message: "Test not found" });
      }

      // Check if user owns this test
      if (test.teacherId !== req.session.userId) {
        return res.status(403).json({ message: "Forbidden: Not your test" });
      }

      // Validate the update data
      const updateData = insertTestSchema.partial().parse(req.body);

      // Update test
      const updatedTest = await storage.updateTest(testId, updateData);

      res.status(200).json(updatedTest);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update test" });
    }
  });

  // Question routes
  app.post("/api/questions", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId || (req.session.role || "") !== "teacher") {
        return res
          .status(401)
          .json({ message: "Unauthorized: Only teachers can create questions" });
      }

      const questionData = insertQuestionSchema.parse(req.body);

      // Check if teacher owns the test
      const test = await storage.getTest(questionData.testId);

      if (!test) {
        return res.status(404).json({ message: "Test not found" });
      }

      if (test.teacherId !== req.session.userId) {
        return res.status(403).json({ message: "Forbidden: Not your test" });
      }

      const question = await storage.createQuestion(questionData);

      res.status(201).json(question);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create question" });
    }
  });

  app.get(
    "/api/tests/:testId/questions",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        if (!req.session?.userId) {
          return res.status(401).json({ message: "Not authenticated" });
        }

        const testId = parseInt(req.params.testId);

        if (isNaN(testId)) {
          return res.status(400).json({ message: "Invalid test ID" });
        }

        const test = await storage.getTest(testId);

        if (!test) {
          return res.status(404).json({ message: "Test not found" });
        }

        // Check if user has access to this test
        if (req.session.role === "teacher" && test.teacherId !== req.session.userId) {
          return res.status(403).json({ message: "Forbidden: Not your test" });
        } else if (req.session.role === "student") {
          // Get user to check their class
          const user = await storage.getUser(req.session.userId);

          if (!user || user.class !== test.class) {
            return res.status(403).json({ message: "Forbidden: Not your class's test" });
          }
        }

        const questions = await storage.getQuestionsByTest(testId);

        res.status(200).json(questions);
      } catch {
        res.status(500).json({ message: "Failed to get questions" });
      }
    }
  );

  // Test Attempt routes
  app.post("/api/test-attempts", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId || (req.session.role || "") !== "student") {
        return res.status(401).json({ message: "Unauthorized: Only students can attempt tests" });
      }

      const attemptData = insertTestAttemptSchema.parse(req.body);

      // Ensure the student is creating their own attempt
      if (attemptData.studentId !== req.session.userId) {
        return res
          .status(403)
          .json({ message: "Forbidden: Can only create attempts for yourself" });
      }

      // Check if test exists and is available for this student
      const test = await storage.getTest(attemptData.testId);

      if (!test) {
        return res.status(404).json({ message: "Test not found" });
      }

      if (test.status !== "published") {
        return res.status(400).json({ message: "Test is not published yet" });
      }

      // Check if student's class matches test class
      const student = await storage.getUser(req.session.userId);

      if (!student || student.class !== test.class) {
        return res.status(403).json({ message: "Forbidden: Test not available for your class" });
      }

      // Check if student already has an attempt for this test
      const existingAttempts = await storage.getTestAttemptsByStudent(req.session.userId);
      const hasAttempt = existingAttempts.some(
        (attempt) => attempt.testId === attemptData.testId && attempt.status !== "completed"
      );

      if (hasAttempt) {
        return res
          .status(400)
          .json({ message: "You already have an in-progress attempt for this test" });
      }

      try {
        const attempt = await storage.createTestAttempt(attemptData);
        res.status(201).json(attempt);
      } catch (dbErr: any) {
        if (dbErr?.code === 11000) {
          return res
            .status(400)
            .json({ message: "You already have an in-progress attempt for this test" });
        }
        throw dbErr;
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create test attempt" });
    }
  });

  app.patch("/api/test-attempts/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const attemptId = parseInt(req.params.id);

      if (isNaN(attemptId)) {
        return res.status(400).json({ message: "Invalid attempt ID" });
      }

      const attempt = await storage.getTestAttempt(attemptId);

      if (!attempt) {
        return res.status(404).json({ message: "Test attempt not found" });
      }

      // Check if user owns this attempt or is the teacher for this test
      if (req.session.role === "student") {
        if (attempt.studentId !== req.session.userId) {
          return res.status(403).json({ message: "Forbidden: Not your attempt" });
        }
      } else if (req.session.role === "teacher") {
        const test = await storage.getTest(attempt.testId);

        if (!test || test.teacherId !== req.session.userId) {
          return res.status(403).json({ message: "Forbidden: Not your test" });
        }
      } else {
        return res.status(403).json({ message: "Forbidden: Insufficient permissions" });
      }

      // Validate the update data
      const updateData = insertTestAttemptSchema.partial().parse(req.body);

      // Update attempt
      const updatedAttempt = await storage.updateTestAttempt(attemptId, updateData);

      res.status(200).json(updatedAttempt);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update test attempt" });
    }
  });

  // Answer routes
  app.post("/api/answers", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId || (req.session.role || "") !== "student") {
        return res.status(401).json({ message: "Unauthorized: Only students can submit answers" });
      }

      const answerData = insertAnswerSchema.parse(req.body);

      // Check if attempt exists and belongs to student
      const attempt = await storage.getTestAttempt(answerData.attemptId);

      if (!attempt) {
        return res.status(404).json({ message: "Test attempt not found" });
      }

      if (attempt.studentId !== req.session.userId) {
        return res.status(403).json({ message: "Forbidden: Not your test attempt" });
      }

      if (attempt.status === "completed") {
        return res.status(400).json({ message: "Test attempt is already completed" });
      }

      // Get question to check type
      const question = await storage.getQuestion(answerData.questionId);

      if (!question) {
        return res.status(404).json({ message: "Question not found" });
      }

      // For MCQ questions, automatically evaluate answer
      if (question.type === "mcq" && answerData.selectedOption != null) {
        const isCorrect = answerData.selectedOption.toString() === question.correctAnswer;
        answerData.isCorrect = isCorrect;
        answerData.score = isCorrect ? question.marks : 0;
      }

      const answer = await storage.createAnswer(answerData);

      res.status(201).json(answer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to submit answer" });
    }
  });

  // OCR routes
  app.post("/api/ocr", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { imageData } = req.body;

      if (!imageData) {
        return res.status(400).json({ message: "Image data is required" });
      }

      // Process image with OCR
      const result = await processOCRImage(imageData);

      res.status(200).json(result);
    } catch {
      res.status(500).json({ message: "Failed to process OCR" });
    }
  });

  // AI evaluation routes
  app.post("/api/evaluate", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId || (req.session.role || "") !== "teacher") {
        return res
          .status(401)
          .json({ message: "Unauthorized: Only teachers can evaluate answers" });
      }

      const { answerId } = req.body;

      if (!answerId) {
        return res.status(400).json({ message: "Answer ID is required" });
      }

      // Get answer
      const answer = await storage.getAnswer(answerId);

      if (!answer) {
        return res.status(404).json({ message: "Answer not found" });
      }

      // Get question for rubric
      const question = await storage.getQuestion(answer.questionId);

      if (!question) {
        return res.status(404).json({ message: "Question not found" });
      }

      // Get attempt to check test
      const attempt = await storage.getTestAttempt(answer.attemptId);

      if (!attempt) {
        return res.status(404).json({ message: "Test attempt not found" });
      }

      // Get test to check teacher
      const test = await storage.getTest(attempt.testId);

      if (!test) {
        return res.status(404).json({ message: "Test not found" });
      }

      // Check if user is the teacher for this test
      if (test.teacherId !== req.session.userId) {
        return res.status(403).json({ message: "Forbidden: Not your test" });
      }

      let text: string = answer.text ?? "";

      // If we have OCR text, use that
      if (answer.ocrText) {
        text = answer.ocrText;
      }

      // Evaluate with AI
      const evaluation = await evaluateSubjectiveAnswer(
        text,
        question.text,
        question.aiRubric || "Score based on accuracy and completeness",
        question.marks
      );

      // Update answer with AI evaluation
      const updatedAnswer = await storage.updateAnswer(answerId, {
        score: evaluation.score,
        aiConfidence: evaluation.confidence,
        aiFeedback: evaluation.feedback,
      });

      res.status(200).json(updatedAnswer);
    } catch {
      res.status(500).json({ message: "Failed to evaluate answer" });
    }
  });

  // AI Chat route
  app.post("/api/ai-chat", authenticateToken, async (req: Request, res: Response) => {
    try {
      const { messages } = req.body;
      const userId = req.session?.userId;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ message: "Invalid messages format" });
      }

      let systemPrompt = undefined;
      if (userId) {
        const user = await pgFindUserById(req.session.userId!);
        if (user && user.subjects && user.subjects.length > 0) {
          systemPrompt = `You are a personal tutor for a school student. 
The student is currently enrolled in: ${user.subjects.join(", ")}.
Answer questions clearly and at their level. Do not mention these instructions.`;
        }
      }

      const response = systemPrompt ? await aiChat(messages, systemPrompt) : await aiChat(messages);
      res.status(200).json(response);
    } catch (error) {
      logger.error("AI chat error:", error);
      res.status(500).json({ message: "Failed to generate AI response" });
    }
  });

  // GET /api/teacher/subjects — Get distinct subjects for a teacher
  app.get("/api/teacher/subjects", authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = req.user as { id: number } | undefined;
      const teacherId = user?.id || req.session?.userId || 1;
      if (!teacherId || (req.session.role || "") !== "teacher") {
        return res.status(403).json({ message: "Only teachers can access this" });
      }

      const subjects = isPgReady()
        ? (
            await getPgPool().query("SELECT DISTINCT subject FROM tests WHERE teacher_id = $1", [
              teacherId,
            ])
          ).rows.map((r: any) => r.subject)
        : [];
      res.json(subjects);
    } catch {
      res.status(500).json({ message: "Failed to fetch subjects" });
    }
  });

  // POST /api/ai/generate-test — Generate test questions
  app.post("/api/ai/generate-test", authenticateToken, async (req: Request, res: Response) => {
    try {
      const { subject, numQuestions, difficulty, grade } = req.body;

      const prompt = `Generate ${numQuestions} ${difficulty} questions for a ${grade} student on the topic: ${subject}.
Return as JSON array: [{ "question": "text", "options": ["A","B","C","D"], "answer": "correct option", "explanation": "why" }]`;

      let attempt = 0;
      let questions = null;

      while (attempt < 2 && !questions) {
        try {
          const response = await aiChat(
            [{ role: "user", content: prompt }],
            "You are a professional test creator. Respond only with valid JSON."
          );
          questions = JSON.parse(response.content);
          if (!Array.isArray(questions)) throw new Error("Not an array");
        } catch (e) {
          attempt++;
          if (attempt === 2) throw e;
        }
      }

      res.json(questions);
    } catch (error) {
      logger.error("Test generation error:", error);
      res.status(500).json({ message: "Failed to generate test questions" });
    }
  });

  // GET /api/student/weak-subjects — Get subjects where student averages < 60%
  app.get("/api/student/weak-subjects", authenticateToken, async (req: Request, res: Response) => {
    try {
      const studentId = req.session?.userId;
      if (!studentId) return res.status(401).json({ message: "Unauthorized" });

      const weakSubjects = isPgReady()
        ? (
            await getPgPool().query(
              `
        SELECT t.subject,
          ROUND(AVG(ta.score::numeric / t.total_marks * 100), 2) AS "avgScore"
        FROM test_attempts ta
        JOIN tests t ON t.id = ta.test_id
        WHERE ta.student_id = $1 AND ta.status = 'evaluated'
        GROUP BY t.subject
        HAVING AVG(ta.score::numeric / t.total_marks * 100) < 60
        ORDER BY "avgScore" ASC`,
              [studentId]
            )
          ).rows
        : [];
      res.json(weakSubjects);
    } catch {
      res.status(500).json({ message: "Failed to fetch weak subjects" });
    }
  });

  // POST /api/ai/study-plan — Generate personalized study plan
  app.post("/api/ai/study-plan", authenticateToken, async (req: Request, res: Response) => {
    try {
      const { weakSubjects } = req.body;

      let context = "";
      if (weakSubjects && weakSubjects.length > 0) {
        context = `This student's weak subjects based on recent test performance are:\n${weakSubjects.map((s: { subject: string; avgScore: number }) => `${s.subject}: ${Math.round(s.avgScore)}%`).join("\n")}\nCreate a focused 7-day study plan that prioritises these weak areas. Be specific: include what to study each day, for how long, and in what order. Do not include subjects they are already performing well in unless as brief revision.`;
      } else {
        context =
          "The student is doing well across all subjects (all scores above 60%). Create a maintenance plan. Pass top subjects as light revision targets.";
      }

      const prompt = `You are a study coach. ${context}\nReturn the plan as a JSON object with a "days" array, where each element is { "day": number, "title": "Day Title", "tasks": [{ "task": "string", "duration": "string" }] }`;

      const response = await aiChat(
        [{ role: "user", content: prompt }],
        "You are an expert study coach. Respond only with valid JSON."
      );
      const plan = JSON.parse(response.content);
      res.json(plan);
    } catch (error) {
      logger.error("Study plan generation error:", error);
      res.status(500).json({ message: "Failed to generate study plan" });
    }
  });

  // POST /api/ai/performance-analysis — Analyze student performance
  app.post(
    "/api/ai/performance-analysis",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        const studentId = req.session?.userId;
        if (!studentId) return res.status(401).json({ message: "Unauthorized" });

        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const results = isPgReady()
          ? (
              await getPgPool().query(
                `
          SELECT ta.*, t.subject, t.total_marks, ta.end_time as "endTime", ta.score
          FROM test_attempts ta JOIN tests t ON t.id = ta.test_id
          WHERE ta.student_id = $1 AND ta.status = 'evaluated' AND ta.end_time >= $2
          ORDER BY ta.end_time ASC`,
                [studentId, ninetyDaysAgo]
              )
            ).rows
          : [];

        if (results.length < 3) {
          return res.json({
            error: "Not enough data yet. Performance insights will appear after a few tests.",
          });
        }

        const resultSummary = results
          .map(
            (r) =>
              `${r.test.subject} | Score: ${r.score}/${r.test.totalMarks} | Date: ${r.endTime.toLocaleDateString()} | Retake: ${r.isRetake ? "yes" : "no"}`
          )
          .join("\n");

        const prompt = `You are a learning analyst. Here is a student's test performance over the last 90 days:\n${resultSummary}\nIdentify:\n1. Subjects showing consistent improvement\n2. Subjects showing decline or stagnation\n3. One specific actionable recommendation\n4. Overall trend in 1 sentence\nBe direct. No filler phrases. Return as JSON: { "improving": ["subject"], "declining": ["subject"], "recommendation": "string", "summary": "string" }`;

        const response = await aiChat(
          [{ role: "user", content: prompt }],
          "You are a learning analyst. Respond only with valid JSON."
        );
        const analysis = JSON.parse(response.content);
        res.json(analysis);
      } catch (error) {
        logger.error("Performance analysis error:", error);
        res.status(500).json({ message: "Failed to analyze performance" });
      }
    }
  );

  // ─── Chat: Workspace routes ───────────────────────────────────────────────────

  // POST /api/workspaces — Create a new workspace
  app.post("/api/workspaces", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const body = insertWorkspaceSchema.parse({
        ...req.body,
        ownerId: req.session.userId,
        members: [],
      });

      const workspace = await storage.createWorkspace(body);
      return res.status(201).json(workspace);
    } catch (error) {
      if (error instanceof z.ZodError)
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      return res.status(500).json({ message: "Failed to create workspace" });
    }
  });

  // GET /api/workspaces — List workspaces the current user belongs to
  app.get("/api/workspaces", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
      const workspaces = await storage.getWorkspaces(req.session.userId);
      return res.status(200).json(workspaces);
    } catch {
      return res.status(500).json({ message: "Failed to fetch workspaces" });
    }
  });

  // GET /api/workspaces/:id — Get a single workspace
  app.get("/api/workspaces/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
      const workspace = await storage.getWorkspace(parseInt(req.params.id));
      if (!workspace) return res.status(404).json({ message: "Workspace not found" });
      if (!workspace.members.includes(req.session.userId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      return res.status(200).json(workspace);
    } catch {
      return res.status(500).json({ message: "Failed to fetch workspace" });
    }
  });

  // POST /api/workspaces/:id/members — Add a member (teacher or owner only)
  app.post(
    "/api/workspaces/:id/members",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
        const workspaceId = parseInt(req.params.id);
        const workspace = await storage.getWorkspace(workspaceId);
        if (!workspace) return res.status(404).json({ message: "Workspace not found" });

        // Only owner or teacher can add members
        if (workspace.ownerId !== req.session.userId && (req.session.role || "") !== "teacher") {
          return res
            .status(403)
            .json({ message: "Only the workspace owner or teachers can add members" });
        }

        const { userId } = req.body;
        if (!userId || typeof userId !== "number") {
          return res.status(400).json({ message: "userId (number) is required" });
        }

        const updated = await storage.addMemberToWorkspace(workspaceId, userId);
        return res.status(200).json(updated);
      } catch {
        return res.status(500).json({ message: "Failed to add member" });
      }
    }
  );

  // DELETE /api/workspaces/:id/members/:userId — Remove a member (teacher or owner)
  app.delete(
    "/api/workspaces/:id/members/:userId",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
        const workspaceId = parseInt(req.params.id);
        const targetUserId = parseInt(req.params.userId);

        const workspace = await storage.getWorkspace(workspaceId);
        if (!workspace) return res.status(404).json({ message: "Workspace not found" });

        if (workspace.ownerId !== req.session.userId && (req.session.role || "") !== "teacher") {
          return res
            .status(403)
            .json({ message: "Only the workspace owner or teachers can remove members" });
        }

        const updated = await storage.removeMemberFromWorkspace(workspaceId, targetUserId);
        return res.status(200).json(updated);
      } catch {
        return res.status(500).json({ message: "Failed to remove member" });
      }
    }
  );

  // ─── Chat: Channel routes ───────────────────────────────────────────────────

  // POST /api/workspaces/:id/channels — Create a channel (teachers only)
  app.post(
    "/api/workspaces/:id/channels",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
        if ((req.session.role || "") !== "teacher") {
          return res.status(403).json({ message: "Only teachers can create channels" });
        }

        const workspaceId = parseInt(req.params.id);
        const workspace = await storage.getWorkspace(workspaceId);
        if (!workspace) return res.status(404).json({ message: "Workspace not found" });
        if (!workspace.members.includes(req.session.userId)) {
          return res.status(403).json({ message: "Access denied" });
        }

        const body = insertChannelSchema.parse({ ...req.body, workspaceId });
        const channel = await storage.createChannel(body);
        return res.status(201).json(channel);
      } catch (error) {
        if (error instanceof z.ZodError)
          return res.status(400).json({ message: "Invalid input", errors: error.errors });
        return res.status(500).json({ message: "Failed to create channel" });
      }
    }
  );

  // GET /api/workspaces/:id/channels — List channels in a workspace
  app.get(
    "/api/workspaces/:id/channels",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
        const workspaceId = parseInt(req.params.id);
        const workspace = await storage.getWorkspace(workspaceId);
        if (!workspace) return res.status(404).json({ message: "Workspace not found" });
        if (!workspace.members.includes(req.session.userId)) {
          return res.status(403).json({ message: "Access denied" });
        }
        const channels = await storage.getChannelsByWorkspace(workspaceId);
        return res.status(200).json(channels);
      } catch {
        return res.status(500).json({ message: "Failed to fetch channels" });
      }
    }
  );

  // ─── Chat: Message routes ───────────────────────────────────────────────────

  // GET /api/channels/:id/messages — Paginated message history
  app.get("/api/channels/:id/messages", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });

      const channelId = parseInt(req.params.id);
      const channel = await storage.getChannel(channelId);
      if (!channel) return res.status(404).json({ message: "Channel not found" });

      if (channel.workspaceId === null || channel.workspaceId === undefined)
        return res.status(403).json({ message: "Access denied" });
      const workspace = await storage.getWorkspace(channel.workspaceId);
      if (!workspace || !workspace.members.includes(req.session.userId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const before = req.query.before ? parseInt(req.query.before as string) : undefined;

      const messages = await storage.getMessagesByChannel(channelId, limit, before);
      return res.status(200).json(messages);
    } catch {
      return res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // GET /api/messages/:channelId — Alias for channel messages used by frontend
  app.get("/api/messages/:channelId", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });

      const channelId = parseInt(req.params.channelId);
      const channel = await storage.getChannel(channelId);
      if (!channel) return res.status(404).json({ message: "Channel not found" });

      if (channel.type !== "dm") {
        if (!channel.workspaceId) return res.status(403).json({ message: "Access denied" });
        const workspace = await storage.getWorkspace(channel.workspaceId);
        if (!workspace || !workspace.members.includes(req.session.userId)) {
          return res.status(403).json({ message: "Access denied" });
        }
      } else {
        // DM check: name is dm_ID1_ID2
        if (!channel.name.includes(req.session.userId.toString())) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const before = req.query.before ? parseInt(req.query.before as string) : undefined;

      const messages = await storage.getMessagesByChannel(channelId, limit, before);
      return res.status(200).json(messages);
    } catch {
      return res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // POST /api/messages — Send message via HTTP
  app.post("/api/messages", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });

      const body = insertMessageSchema.parse({
        ...req.body,
        authorId: req.session.userId,
      });

      const message = await storage.createMessage(body);

      // We should also broadcast this via WebSocket if the server is available
      // For now, it's saved in DB and client-side optimistic UI handles it.
      // But we need the WS server to broadcast to OTHER users.
      // Since ws setup is in chat-ws.ts, we might need a way to trigger broadcast.
      // For simplicity, let's assume the client will also send via WS or poll.
      // However, the frontend code calls BOTH (apiRequest and ws.send if available).
      // Actually frontend calls apiRequest ONLY when sending.

      return res.status(201).json(message);
    } catch (error) {
      if (error instanceof z.ZodError)
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      return res.status(500).json({ message: "Failed to create message" });
    }
  });

  // POST /api/channels/dm — Create or get a DM channel
  app.post("/api/channels/dm", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });

      const { userIds } = req.body;
      if (!Array.isArray(userIds) || userIds.length < 2) {
        return res.status(400).json({ message: "At least two userIds are required" });
      }

      const id1 = parseInt(userIds[0]);
      const id2 = parseInt(userIds[1]);

      if (isNaN(id1) || isNaN(id2)) {
        return res.status(400).json({ message: "Invalid user IDs" });
      }

      const channel = await storage.getOrCreateDMChannel(id1, id2);
      return res.status(200).json(channel);
    } catch {
      return res.status(500).json({ message: "Failed to create/fetch DM channel" });
    }
  });

  // GET /api/users/me/dms — Get all DMs for the current user, enriched with partner info
  app.get("/api/users/me/dms", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });

      const currentUserId = req.session.userId;
      const dms = await storage.getDMsByUser(currentUserId);

      const enrichedDms = await Promise.all(
        dms.map(async (dm) => {
          // dm.name is 'dm_ID1_ID2'
          const parts = dm.name.split("_");
          if (parts.length === 3) {
            const id1 = parseInt(parts[1]);
            const id2 = parseInt(parts[2]);
            const partnerId = id1 === currentUserId ? id2 : id1;

            const partner = await storage.getUser(partnerId);
            if (partner) {
              return {
                ...dm,
                partner: {
                  id: partner.id,
                  username: partner.username,
                  avatar: partner.avatar,
                  role: partner.role,
                },
              };
            }
          }
          return dm;
        })
      );

      return res.status(200).json(enrichedDms);
    } catch {
      return res.status(500).json({ message: "Failed to fetch DMs" });
    }
  });

  // DELETE /api/messages/:id — Delete a message (author or teacher)
  app.delete("/api/messages/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });

      const messageId = parseInt(req.params.id);
      if (isNaN(messageId)) return res.status(400).json({ message: "Invalid message ID" });

      if (!isPgReady()) return res.status(503).json({ message: "Database unavailable" });
      const msgRow = (
        await getPgPool().query("SELECT author_id, channel_id FROM messages WHERE id = $1", [
          messageId,
        ])
      ).rows[0];
      if (!msgRow) return res.status(404).json({ message: "Message not found" });
      const msg = { authorId: parseInt(msgRow.author_id), channelId: parseInt(msgRow.channel_id) };
      if (!msg) return res.status(404).json({ message: "Message not found" });

      const isAuthor = msg.authorId === req.session.userId;
      const isTeacher = req.session.role === "teacher";

      if (!isAuthor && !isTeacher) {
        return res.status(403).json({ message: "You can only delete your own messages" });
      }

      // Pass channelId so Cassandra delete uses the correct partition key
      await storage.deleteMessage(messageId, msg.channelId);
      return res.status(200).json({ message: "Message deleted" });
    } catch {
      return res.status(500).json({ message: "Failed to delete message" });
    }
  });

  // POST /api/channels/:id/pin/:messageId — Pin a message (teachers only)
  app.post(
    "/api/channels/:id/pin/:messageId",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
        if ((req.session.role || "") !== "teacher") {
          return res.status(403).json({ message: "Only teachers can pin messages" });
        }

        const channelId = parseInt(req.params.id);
        const messageId = parseInt(req.params.messageId);

        const channel = await storage.pinMessage(channelId, messageId);
        if (!channel) return res.status(404).json({ message: "Channel or message not found" });

        return res.status(200).json(channel);
      } catch {
        return res.status(500).json({ message: "Failed to pin message" });
      }
    }
  );

  // DELETE /api/channels/:id/pin/:messageId — Unpin a message (teachers only)
  app.delete(
    "/api/channels/:id/pin/:messageId",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
        if ((req.session.role || "") !== "teacher") {
          return res.status(403).json({ message: "Only teachers can unpin messages" });
        }

        const channelId = parseInt(req.params.id);
        const messageId = parseInt(req.params.messageId);

        const channel = await storage.unpinMessage(channelId, messageId);
        if (!channel) return res.status(404).json({ message: "Channel or message not found" });

        return res.status(200).json(channel);
      } catch {
        return res.status(500).json({ message: "Failed to unpin message" });
      }
    }
  );

  // GET /api/channels/:id/pinned — Get pinned messages
  app.get("/api/channels/:id/pinned", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });

      const channelId = parseInt(req.params.id);
      const channel = await storage.getChannel(channelId);
      if (!channel) return res.status(404).json({ message: "Channel not found" });

      if (channel.workspaceId === null || channel.workspaceId === undefined)
        return res.status(403).json({ message: "Access denied" });
      const workspace = await storage.getWorkspace(channel.workspaceId);
      if (!workspace || !workspace.members.includes(req.session.userId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const pinned = await storage.getPinnedMessages(channelId);
      return res.status(200).json(pinned);
    } catch {
      return res.status(500).json({ message: "Failed to fetch pinned messages" });
    }
  });

  // GET /api/channels/query/:classOrUser — Filtered channels
  app.get(
    "/api/channels/query/:classOrUser",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
        const { classOrUser } = req.params;

        const allWorkspaces = await storage.getWorkspaces(req.session.userId);
        const workspaceIds = allWorkspaces.map((ws) => ws.id);
        const allChannels = await storage.getChannelsByWorkspaces(workspaceIds);

        const filtered = allChannels.filter(
          (c) =>
            !classOrUser ||
            c.class === classOrUser ||
            c.name.toLowerCase().includes(classOrUser.toLowerCase()) ||
            (c.subject && c.subject.toLowerCase().includes(classOrUser.toLowerCase()))
        );

        return res.status(200).json(filtered);
      } catch {
        return res.status(500).json({ message: "Failed to fetch channels" });
      }
    }
  );

  // GET /api/channels/:id/unread — Get unread count for a channel
  app.get("/api/channels/:id/unread", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
      const channelId = parseInt(req.params.id);

      const channel = await storage.getChannel(channelId);
      if (!channel) return res.status(404).json({ message: "Channel not found" });

      // Count unread in last 50 messages
      const messages = await storage.getMessagesByChannel(channelId, 50);
      const unreadCount = messages.filter((m) => !m.readBy?.includes(req.session!.userId!)).length;

      return res.status(200).json({ unreadCount });
    } catch {
      return res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  // POST /api/messages/:id/grade — Grade homework (teachers only)
  app.post("/api/messages/:id/grade", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId || (req.session.role || "") !== "teacher") {
        return res.status(401).json({ message: "Only teachers can grade homework" });
      }

      const messageId = parseInt(req.params.id);
      if (isNaN(messageId)) return res.status(400).json({ message: "Invalid message ID" });

      const { status, channelId } = req.body;

      if (!["pending", "graded"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      // Pass channelId so Cassandra uses the correct partition key
      const updated = await storage.gradeMessage(
        messageId,
        status,
        channelId ? parseInt(channelId) : undefined
      );
      if (!updated) return res.status(404).json({ message: "Message not found" });

      return res.status(200).json(updated);
    } catch {
      return res.status(500).json({ message: "Failed to grade message" });
    }
  });

  // POST /api/channels — Create a new channel
  app.post("/api/channels", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });

      const channelData = insertChannelSchema.parse(req.body);

      // Check if user is member of the workspace
      if (!channelData.workspaceId)
        return res.status(400).json({ message: "Workspace ID is required" });
      const workspace = await storage.getWorkspace(channelData.workspaceId);
      if (!workspace || !workspace.members.includes(req.session.userId)) {
        return res.status(403).json({ message: "You are not a member of this workspace" });
      }

      const channel = await storage.createChannel(channelData);
      return res.status(201).json(channel);
    } catch (error) {
      if (error instanceof z.ZodError)
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      return res.status(500).json({ message: "Failed to create channel" });
    }
  });

  // POST /api/messages/:id/read — Mark message as read
  app.post("/api/messages/:id/read", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
      const messageId = parseInt(req.params.id);
      if (isNaN(messageId)) return res.status(400).json({ message: "Invalid message ID" });
      const { channelId } = req.body;
      // Pass channelId so Cassandra uses the correct partition key
      const updated = await storage.markMessageAsRead(
        messageId,
        req.session.userId,
        channelId ? parseInt(channelId) : undefined
      );
      if (!updated) return res.status(404).json({ message: "Message not found" });
      return res.status(200).json(updated);
    } catch {
      return res.status(500).json({ message: "Failed to mark message as read" });
    }
  });

  // POST /api/upload — Real multipart file upload (multer disk storage)
  app.post(
    "/api/upload",
    (req: Request, res: Response, next) => {
      // Auth guard before multer processes the body
      if (!req.session?.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      next();
    },
    upload.single("file"),
    (req: Request, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            message: "No file provided. Send a multipart/form-data request with field name 'file'.",
          });
        }

        const url = diskPathToUrl(req.file.path);
        logger.info(`[upload] file uploaded`, { userId: req.session!.userId });

        return res.status(200).json({
          url,
          name: req.file.originalname,
          size: req.file.size,
          mimeType: req.file.mimetype,
        });
      } catch {
        return res.status(500).json({ message: "Upload failed" });
      }
    }
  );

  // /api/auth/firebase is handled by authRouter (server/routes/auth.ts)

  // ─── Phase 2: Chat Conversations API ────────────────────────────────────────
  //
  // GET /api/chat/conversations — Returns all channels accessible to the user.
  // Seeds a default School workspace on first login if the user has none.

  app.get("/api/chat/conversations", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const userId = req.session.userId;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const role = user.role ?? "student";

      // Seed default workspace on first access
      let workspaces = await storage.getWorkspaces(userId);
      if (workspaces.length === 0) {
        const newWs = await storage.createWorkspace({
          name: "School",
          description: "Default school workspace",
          ownerId: userId,
          members: [userId],
        });

        const defaultChannels = [
          { name: "school-announcements", type: "announcement" as const },
          { name: "class-10a-mathematics", type: "text" as const, subject: "Mathematics" },
          { name: "class-10a-science", type: "text" as const, subject: "Science" },
          { name: "class-10a-english", type: "text" as const, subject: "English" },
        ];

        for (const ch of defaultChannels) {
          await storage.createChannel({
            workspaceId: newWs.id,
            name: ch.name,
            type: ch.type,
            subject: (ch as any).subject ?? null,
          });
        }

        workspaces = await storage.getWorkspaces(userId);
        logger.info(`[chat/conversations] Seeded workspace`, { userId });
      }

      type ExtendedChannel = Channel & { category?: string; isReadOnly?: boolean };
      // Gather all channels across workspaces
      const workspaceIds = workspaces.map((ws) => ws.id);
      const allChannels = (await storage.getChannelsByWorkspaces(
        workspaceIds
      )) as ExtendedChannel[];

      // Role-based filtering
      const accessible = allChannels.filter((ch: ExtendedChannel) => {
        const category = ch.category ?? "class";
        if (category === "announcement") return true;
        if (category === "class" && (role === "student" || role === "teacher")) return true;
        if (category === "teacher" && role === "student") return true;
        if (category === "parent" && role === "teacher") return true;
        if (category === "friend" && role === "student") return true;
        return false;
      });

      // Shape into frontend Conversation format
      const conversations = accessible.map((ch: ExtendedChannel) => ({
        id: String(ch.id),
        name: ch.name,
        category: ch.category ?? "class",
        isGroup: ch.type !== "dm",
        isReadOnly: ch.isReadOnly ?? false,
        participants: [],
        lastMessage: undefined,
        unreadCount: 0,
        subject: ch.subject ?? undefined,
      }));

      return res.status(200).json(conversations);
    } catch (err) {
      console.error("[chat/conversations] Error:", err);
      return res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  // POST /api/chat/conversations/:id/read — mark all messages in a conversation as read
  app.post(
    "/api/chat/conversations/:id/read",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });

        const channelId = parseInt(req.params.id);
        if (isNaN(channelId)) return res.status(400).json({ message: "Invalid conversation ID" });

        const messages = await storage.getMessagesByChannel(channelId, 100);
        await Promise.all(
          messages
            .filter((m: { readBy?: number[] }) => !m.readBy?.includes(req.session!.userId!))
            .map((m: { id: number }) => storage.markMessageAsRead(m.id, req.session!.userId!))
        );

        if (isPgReady()) {
          getPgPool()
            .query("UPDATE channels SET unread_counts = unread_counts - $1 WHERE id = $2", [
              String(req.session.userId),
              channelId,
            ])
            .catch(() => null);
        }

        return res.status(200).json({ message: "Marked as read" });
      } catch {
        return res.status(500).json({ message: "Failed to mark conversation as read" });
      }
    }
  );

  // ─── Analytics & Progress API ────────────────────────────────────────────

  // GET /api/analytics/student/:studentId — Real test scores by subject
  app.get(
    "/api/analytics/student/:studentId",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        if (!req.session?.userId) {
          return res.status(401).json({ message: "Not authenticated" });
        }

        const studentId = parseInt(req.params.studentId);
        if (isNaN(studentId)) {
          return res.status(400).json({ message: "Invalid student ID" });
        }

        // Authorization: students can only view their own, teachers/admins can view any
        if (req.session.role === "student" && req.session.userId !== studentId) {
          return res.status(403).json({ message: "Forbidden: Can only view your own analytics" });
        }

        if (!isPgReady()) return res.status(503).json({ message: "Database unavailable" });
        const attempts = (
          await getPgPool().query(
            `
          SELECT ta.score, t.subject, t.total_marks
          FROM test_attempts ta JOIN tests t ON t.id = ta.test_id
          WHERE ta.student_id = $1 AND ta.status IN ('completed','evaluated') AND ta.score IS NOT NULL`,
            [studentId]
          )
        ).rows;

        if (attempts.length === 0) return res.status(200).json([]);

        const subjectScores = new Map<string, { total: number; count: number }>();

        for (const attempt of attempts) {
          const subject: string = attempt.subject;
          const score: number | null = attempt.score != null ? parseFloat(attempt.score) : null;
          if (subject && score != null) {
            const current = subjectScores.get(subject) || { total: 0, count: 0 };
            current.total += score;
            current.count += 1;
            subjectScores.set(subject, current);
          }
        }

        // Format response
        const result = Array.from(subjectScores.entries()).map(([subject, data]) => ({
          subject,
          avgScore: Math.round((data.total / data.count) * 100) / 100,
        }));

        res.status(200).json(result);
      } catch (error) {
        console.error("[api/analytics/student] Error:", error);
        res.status(500).json({ message: "Failed to fetch analytics" });
      }
    }
  );

  // GET /api/progress/student/:studentId — Month-by-month progress
  app.get(
    "/api/progress/student/:studentId",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        if (!req.session?.userId) {
          return res.status(401).json({ message: "Not authenticated" });
        }

        const studentId = parseInt(req.params.studentId);
        if (isNaN(studentId)) {
          return res.status(400).json({ message: "Invalid student ID" });
        }

        // Authorization
        if (req.session.role === "student" && req.session.userId !== studentId) {
          return res.status(403).json({ message: "Forbidden: Can only view your own progress" });
        }

        if (!isPgReady()) return res.status(503).json({ message: "Database unavailable" });
        const pgRows = (
          await getPgPool().query(
            `
          SELECT TO_CHAR(end_time, 'YYYY-MM') as month, ROUND(AVG(score::numeric), 2) as "avgScore"
          FROM test_attempts
          WHERE student_id = $1 AND status IN ('completed','evaluated') AND score IS NOT NULL AND end_time IS NOT NULL
          GROUP BY month ORDER BY month ASC`,
            [studentId]
          )
        ).rows;

        const formatted = pgRows.map((r: any) => ({
          month: r.month,
          avgScore: parseFloat(r.avgScore),
        }));

        res.status(200).json(formatted);
      } catch (error) {
        console.error("[api/progress/student] Error:", error);
        res.status(500).json({ message: "Failed to fetch progress" });
      }
    }
  );

  // GET /api/admin/stats — Real school-wide statistics
  app.get("/api/admin/stats", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Only admin/principal/school_admin can access
      if (!["admin", "principal", "school_admin"].includes(req.session.role || "")) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
      }

      if (!isPgReady()) return res.status(503).json({ message: "Database unavailable" });
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const pool2 = getPgPool();

      const [studentCount, teacherCount, testsThisMonth, submissionsThisMonth] = await Promise.all([
        pgCountUsers({ role: "student" }),
        pgCountUsers({ role: "teacher" }),
        pool2
          .query("SELECT COUNT(*) FROM tests WHERE created_at >= $1", [startOfMonth])
          .then((r) => parseInt(r.rows[0].count)),
        pool2
          .query(
            "SELECT COUNT(*) FROM test_attempts WHERE status IN ('completed','evaluated') AND end_time >= $1",
            [startOfMonth]
          )
          .then((r) => parseInt(r.rows[0].count)),
      ]);

      res.status(200).json({
        totalStudents: studentCount,
        totalTeachers: teacherCount,
        testsThisMonth,
        submissionsThisMonth,
      });
    } catch (error) {
      console.error("[api/admin/stats] Error:", error);
      res.status(500).json({ message: "Failed to fetch admin stats" });
    }
  });

  // ─── School Admin API ─────────────────────────────────────────────────────

  app.get("/api/school/teachers", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (
        !req.session?.userId ||
        ((req.session.role || "") !== "school_admin" && (req.session.role || "") !== "admin")
      ) {
        return res
          .status(403)
          .json({ message: "Forbidden: Access restricted to school administrators" });
      }

      const admin = await storage.getUser(req.session.userId);
      if (!admin || !admin.school_code) {
        return res.status(400).json({ message: "Admin school code not found" });
      }

      const teachers = await pgFindUsers({
        role: "teacher",
        schoolCode: admin.school_code ?? undefined,
      });
      res.status(200).json(teachers);
    } catch (error) {
      console.error("[api/school/teachers] Error:", error);
      res.status(500).json({ message: "Failed to fetch teachers" });
    }
  });

  app.post(
    "/api/school/teachers/:id/approve",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        if (
          !req.session?.userId ||
          ((req.session.role || "") !== "school_admin" && (req.session.role || "") !== "admin")
        ) {
          return res
            .status(403)
            .json({ message: "Forbidden: Access restricted to school administrators" });
        }

        const admin = await storage.getUser(req.session.userId);
        if (!admin || !admin.school_code) {
          return res.status(400).json({ message: "Admin school code not found" });
        }

        const teacherId = parseInt(req.params.id);
        const teacher = await pgFindUserById(teacherId);

        if (!teacher || teacher.role !== "teacher") {
          return res.status(404).json({ message: "Teacher not found" });
        }

        if (teacher.schoolCode !== admin.school_code) {
          return res
            .status(403)
            .json({ message: "Forbidden: Teacher belongs to a different school" });
        }

        await pgUpdateUser(teacherId, { status: "active" });
        if (teacher.firebaseUid) {
          setCustomUserClaims(teacher.firebaseUid, { role: teacher.role, status: "active" }).catch(
            (e) => logger.warn("[approve] Failed to update custom claims", { error: String(e) })
          );
        }
        if (isPgReady()) {
          getPgPool()
            .query("UPDATE memberships SET status = 'active' WHERE user_id = $1", [teacherId])
            .catch(() => null);
        }

        recordAuditEvent({
          actorUserId: admin.id,
          targetUserId: teacher.id,
          schoolCode: admin.school_code,
          eventType: AUDIT_EVENTS.TEACHER_APPROVED,
          payload: { previousStatus: "pending" },
        });

        res.status(200).json({ message: "Teacher approved", teacher });
      } catch (error) {
        console.error("[api/school/teachers/approve] Error:", error);
        res.status(500).json({ message: "Failed to approve teacher" });
      }
    }
  );

  // ─── Task routes ─────────────────────────────────────────────────────────

  app.post("/api/tasks", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const parseResult = insertTaskSchema.safeParse({ ...req.body, userId: req.session.userId });
      if (!parseResult.success) {
        return res
          .status(400)
          .json({ message: "Invalid input data", errors: parseResult.error.errors });
      }
      const task = await storage.createTask(parseResult.data);
      return res.status(201).json(task);
    } catch {
      res.status(500).json({ message: "Failed to create task" });
    }
  });

  app.get("/api/tasks", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const tasks = await storage.getTasksByUser(req.session.userId);
      return res.status(200).json(tasks);
    } catch {
      res.status(500).json({ message: "Failed to get tasks" });
    }
  });

  app.patch("/api/tasks/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const taskId = parseInt(req.params.id);
      if (isNaN(taskId)) {
        return res.status(400).json({ message: "Invalid task ID" });
      }
      const parseResult = insertTaskSchema.partial().safeParse(req.body);
      if (!parseResult.success) {
        return res
          .status(400)
          .json({ message: "Invalid input data", errors: parseResult.error.errors });
      }
      // Fetch task to distinguish 404 vs 403
      const allUserTasks = await storage.getTasksByUser(req.session.userId);
      const ownedTask = allUserTasks.find((t) => t.id === taskId);
      if (!ownedTask) {
        // Task not found for this user — could be non-existent or owned by someone else
        // Either way, return 404 (don't leak existence of other users' tasks)
        return res.status(404).json({ message: "Task not found" });
      }
      const updated = await storage.updateTask(taskId, parseResult.data, req.session.userId);
      if (updated === undefined) {
        return res.status(403).json({ message: "Forbidden: Not your task" });
      }
      return res.status(200).json(updated);
    } catch {
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  app.delete("/api/tasks/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const taskId = parseInt(req.params.id);
      if (isNaN(taskId)) {
        return res.status(400).json({ message: "Invalid task ID" });
      }
      // Fetch task to distinguish 404 vs 403
      const allUserTasks = await storage.getTasksByUser(req.session.userId);
      const ownedTask = allUserTasks.find((t) => t.id === taskId);
      if (!ownedTask) {
        return res.status(404).json({ message: "Task not found" });
      }
      const deleted = await storage.deleteTask(taskId, req.session.userId);
      if (!deleted) {
        return res.status(403).json({ message: "Forbidden: Not your task" });
      }
      return res.status(204).send();
    } catch {
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  // ─── Notification routes ──────────────────────────────────────────────────

  // GET /api/notifications — list notifications for current user, sorted desc
  app.get("/api/notifications", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const notifications = await storage.getNotificationsByUser(req.session.userId);
      return res.status(200).json(notifications);
    } catch {
      return res.status(500).json({ message: "Failed to get notifications" });
    }
  });

  // PATCH /api/notifications/read-all — mark all read (MUST be before /:id route)
  app.patch(
    "/api/notifications/read-all",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        if (!req.session?.userId) {
          return res.status(401).json({ message: "Not authenticated" });
        }
        await storage.markAllNotificationsRead(req.session.userId);
        return res.status(200).json({ message: "All notifications marked as read" });
      } catch {
        return res.status(500).json({ message: "Failed to mark all notifications as read" });
      }
    }
  );

  // PATCH /api/notifications/:id/read — mark one notification read
  app.patch(
    "/api/notifications/:id/read",
    authenticateToken,
    async (req: Request, res: Response) => {
      try {
        if (!req.session?.userId) {
          return res.status(401).json({ message: "Not authenticated" });
        }
        const notifId = parseInt(req.params.id);
        if (isNaN(notifId)) {
          return res.status(400).json({ message: "Invalid notification ID" });
        }
        const updated = await storage.markNotificationRead(notifId, req.session.userId);
        if (updated === undefined) {
          // Could be not found or not owned — check existence
          const all = await storage.getNotificationsByUser(req.session.userId);
          const owned = all.find((n) => n.id === notifId);
          if (!owned) {
            return res.status(404).json({ message: "Notification not found" });
          }
          return res.status(403).json({ message: "Forbidden: Not your notification" });
        }
        return res.status(200).json(updated);
      } catch {
        return res.status(500).json({ message: "Failed to mark notification as read" });
      }
    }
  );

  // DELETE /api/notifications/:id — dismiss/delete notification
  app.delete("/api/notifications/:id", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const notifId = parseInt(req.params.id);
      if (isNaN(notifId)) {
        return res.status(400).json({ message: "Invalid notification ID" });
      }
      // Check existence first to distinguish 404 vs 403
      const allNotifs = await storage.getNotificationsByUser(req.session.userId);
      const owned = allNotifs.find((n) => n.id === notifId);
      if (!owned) {
        // Could be non-existent or owned by someone else — check globally
        // dismissNotification returns false for both; we need to distinguish
        // We'll attempt dismiss and treat false as 404 (don't leak other users' data)
        return res.status(404).json({ message: "Notification not found" });
      }
      const deleted = await storage.dismissNotification(notifId, req.session.userId);
      if (!deleted) {
        return res.status(403).json({ message: "Forbidden: Not your notification" });
      }
      return res.status(204).send();
    } catch {
      return res.status(500).json({ message: "Failed to delete notification" });
    }
  });

  // ─── Push Token routes ────────────────────────────────────────────────────

  // POST /api/push-tokens — register or update push token for mobile notifications
  app.post("/api/push-tokens", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { token, deviceType } = req.body;
      if (!token || typeof token !== "string") {
        return res.status(400).json({ message: "Token is required" });
      }
      await storage.savePushToken(req.session.userId, token, deviceType || null);
      return res.status(200).json({ message: "Push token registered successfully" });
    } catch (error) {
      console.error("Failed to save push token:", error);
      return res.status(500).json({ message: "Failed to register push token" });
    }
  });

  // DELETE /api/push-tokens — remove push token (on logout)
  app.delete("/api/push-tokens", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { token } = req.body;
      if (!token || typeof token !== "string") {
        return res.status(400).json({ message: "Token is required" });
      }
      await storage.deletePushToken(req.session.userId, token);
      return res.status(200).json({ message: "Push token removed successfully" });
    } catch (error) {
      console.error("Failed to delete push token:", error);
      return res.status(500).json({ message: "Failed to remove push token" });
    }
  });

  // ─── OCR routes ───────────────────────────────────────────────────────────

  // POST /api/ocr/extract — extract text from image using OCR
  app.post("/api/ocr/extract", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { image } = req.body;
      if (!image || typeof image !== "string") {
        return res.status(400).json({ message: "Image data is required" });
      }

      // TODO: Implement actual OCR processing
      // Options:
      // 1. Use Tesseract.js for client-side OCR
      // 2. Use Google Cloud Vision API
      // 3. Use AWS Textract
      // 4. Use Azure Computer Vision

      // For now, return a mock response
      const mockText =
        "Sample extracted text from image.\n\nThis is a placeholder response. In production, this would contain the actual OCR-extracted text from the image.";

      return res.status(200).json({
        text: mockText,
        confidence: 0.95,
        language: "en",
      });
    } catch (error) {
      console.error("OCR processing error:", error);
      return res.status(500).json({ message: "Failed to process image" });
    }
  });

  // ─── Focus Session routes ─────────────────────────────────────────────────

  app.post("/api/focus-sessions", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const parseResult = insertFocusSessionSchema.safeParse({
        ...req.body,
        userId: req.session.userId,
      });
      if (!parseResult.success) {
        return res
          .status(400)
          .json({ message: "Invalid input data", errors: parseResult.error.errors });
      }
      const session = await storage.createFocusSession(parseResult.data);
      return res.status(201).json(session);
    } catch {
      return res.status(500).json({ message: "Failed to create focus session" });
    }
  });

  app.get("/api/focus-sessions", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const sessions = await storage.getFocusSessionsByUser(req.session.userId);
      return res.status(200).json(sessions);
    } catch {
      return res.status(500).json({ message: "Failed to get focus sessions" });
    }
  });

  // GET /api/analytics/students — per-student analytics aggregation
  // GET /api/analytics/students — per-student analytics aggregation
  app.get("/api/analytics/students", authenticateToken, async (req: Request, res: Response) => {
    try {
      if (
        !req.session?.userId ||
        !["teacher", "admin", "principal"].includes(req.session.role || "")
      ) {
        return res.status(403).json({ message: "Forbidden: Insufficient permissions" });
      }
      // Get all students
      const students = await storage.getUsers("student");
      if (!students || students.length === 0) {
        return res.status(200).json([]);
      }

      // For each student, aggregate their test attempts
      const summaries = await Promise.all(
        students.map(async (student) => {
          const attempts = await storage.getTestAttemptsByStudent(student.id);
          const completedAttempts = attempts.filter(
            (a) => a.status === "completed" && a.score !== null
          );

          const averageScore =
            completedAttempts.length > 0
              ? completedAttempts.reduce((sum, a) => sum + (a.score || 0), 0) /
                completedAttempts.length
              : 0;

          const completionRate =
            attempts.length > 0 ? completedAttempts.length / attempts.length : 0;

          // Get subject breakdown from tests
          const subjectScores: Record<string, { total: number; count: number }> = {};
          for (const attempt of completedAttempts) {
            const test = await storage.getTest(attempt.testId);
            if (test) {
              if (!subjectScores[test.subject]) {
                subjectScores[test.subject] = { total: 0, count: 0 };
              }
              subjectScores[test.subject].total += attempt.score || 0;
              subjectScores[test.subject].count += 1;
            }
          }

          const subjectBreakdown = Object.entries(subjectScores).map(([subject, data]) => ({
            subject,
            averageScore: data.total / data.count,
          }));

          const recentAttempts = completedAttempts.slice(0, 5).map((a) => ({
            testId: a.testId,
            score: a.score || 0,
            completedAt: a.endTime || new Date(),
          }));

          return {
            studentId: student.id,
            name: student.name,
            avatar: student.avatar,
            averageScore: Math.round(averageScore * 10) / 10,
            completionRate: Math.round(completionRate * 100) / 100,
            subjectBreakdown,
            recentAttempts,
          };
        })
      );

      return res.status(200).json(summaries);
    } catch (error) {
      console.error("[api/analytics/students] Error:", error);
      return res.status(500).json({ message: "Failed to get student analytics" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
