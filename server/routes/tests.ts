import { Router, Request, Response } from "express";
import { authenticateToken } from "../middleware";
import { storage } from "../storage";
import { z } from "zod";
import {
  insertTestSchema,
  insertQuestionSchema,
  insertTestAttemptSchema,
  insertAnswerSchema,
} from "@shared/schema";
import { evaluateSubjectiveAnswer, aiChat } from "../lib/openai";
import { logger } from "../lib/logger";
import { checkAIQuota } from "../middleware/aiQuota";
import {
  pgIncrementAIUsage,
  pgFindFirstWorkspaceMembership,
  pgFindUserById,
} from "../lib/pg-queries";
import { upload } from "../lib/upload";
import { generateContentFromPdf } from "../lib/gemini";
import fs from "fs";
import jwt from "jsonwebtoken";
import { ACCESS_COOKIE } from "../lib/auth-workspace";

const router = Router();

// POST /api/tests
router.post("/tests", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId || (req.session.role || "") !== "teacher") {
      return res.status(401).json({ message: "Unauthorized: Only teachers can create tests" });
    }

    const testData = insertTestSchema.parse({
      ...req.body,
      teacherId: req.session.userId, // always derive from session, never trust client
    });

    const test = await storage.createTest(testData);
    res.status(201).json(test);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input data", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to create test" });
  }
});

// GET /api/tests
router.get("/tests", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { teacherId, status } = req.query;
    const teacherIdNum = teacherId ? parseInt(teacherId as string) : undefined;

    let tests;
    if (req.session.role === "teacher") {
      tests = await storage.getTests(
        teacherIdNum || req.session.userId,
        status as string | undefined
      );
    } else {
      const user = await storage.getUser(req.session.userId);
      if (!user || !user.class) {
        return res.status(400).json({ message: "User class not found" });
      }
      tests = await storage.getTestsByClass(user.class);
      if (status) {
        tests = tests.filter((test) => test.status === status);
      }
    }
    res.status(200).json(tests);
  } catch {
    res.status(500).json({ message: "Failed to get tests" });
  }
});

// GET /api/tests/:id
router.get("/tests/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const testId = parseInt(req.params.id);
    if (isNaN(testId)) return res.status(400).json({ message: "Invalid test ID" });

    const test = await storage.getTest(testId);
    if (!test) return res.status(404).json({ message: "Test not found" });

    if (req.session.role === "teacher" && test.teacherId !== req.session.userId) {
      return res.status(403).json({ message: "Forbidden: Not your test" });
    } else if (req.session.role === "student") {
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

// PATCH /api/tests/:id
router.patch("/tests/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId || (req.session.role || "") !== "teacher") {
      return res.status(401).json({ message: "Unauthorized: Only teachers can update tests" });
    }

    const testId = parseInt(req.params.id);
    if (isNaN(testId)) return res.status(400).json({ message: "Invalid test ID" });

    const test = await storage.getTest(testId);
    if (!test) return res.status(404).json({ message: "Test not found" });

    if (test.teacherId !== req.session.userId) {
      return res.status(403).json({ message: "Forbidden: Not your test" });
    }

    // Strip teacherId from body — ownership is established by the session, not the client
    const { teacherId: _ignored, ...bodyWithoutTeacherId } = req.body;
    const updateData = insertTestSchema.partial().parse(bodyWithoutTeacherId);
    const updatedTest = await storage.updateTest(testId, updateData);
    res.status(200).json(updatedTest);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input data", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to update test" });
  }
});

// POST /api/questions
router.post("/questions", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId || (req.session.role || "") !== "teacher") {
      return res.status(401).json({ message: "Unauthorized: Only teachers can create questions" });
    }

    const questionData = insertQuestionSchema.parse(req.body);
    const test = await storage.getTest(questionData.testId);

    if (!test) return res.status(404).json({ message: "Test not found" });
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

// GET /api/questions/:testId
router.get("/questions/:testId", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });

    const testId = parseInt(req.params.testId);
    if (isNaN(testId)) return res.status(400).json({ message: "Invalid test ID" });

    const test = await storage.getTest(testId);
    if (!test) return res.status(404).json({ message: "Test not found" });

    if (req.session.role === "teacher" && test.teacherId !== req.session.userId) {
      return res.status(403).json({ message: "Forbidden: Not your test" });
    } else if (req.session.role === "student") {
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
});

// POST /api/test-attempts
router.post("/test-attempts", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId || (req.session.role || "") !== "student") {
      return res.status(401).json({ message: "Unauthorized: Only students can attempt tests" });
    }

    const attemptData = insertTestAttemptSchema.parse(req.body);

    if (attemptData.studentId !== req.session.userId) {
      return res.status(403).json({ message: "Forbidden: Can only create attempts for yourself" });
    }

    const test = await storage.getTest(attemptData.testId);
    if (!test) return res.status(404).json({ message: "Test not found" });
    if (test.status !== "published")
      return res.status(400).json({ message: "Test is not published yet" });

    const student = await storage.getUser(req.session.userId);
    if (!student || student.class !== test.class) {
      return res.status(403).json({ message: "Forbidden: Test not available for your class" });
    }

    const existingAttempts = await storage.getTestAttemptsByStudent(req.session.userId);
    const hasAttempt = existingAttempts.some(
      (attempt) => attempt.testId === attemptData.testId && attempt.status !== "completed"
    );

    if (hasAttempt) {
      return res
        .status(400)
        .json({ message: "You already have an in-progress attempt for this test" });
    }

    const attempt = await storage.createTestAttempt(attemptData);
    res.status(201).json(attempt);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input data", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to create test attempt" });
  }
});

// PATCH /api/test-attempts/:id
router.patch("/test-attempts/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });

    const attemptId = parseInt(req.params.id);
    if (isNaN(attemptId)) return res.status(400).json({ message: "Invalid attempt ID" });

    const attempt = await storage.getTestAttempt(attemptId);
    if (!attempt) return res.status(404).json({ message: "Test attempt not found" });

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

    const updateData = insertTestAttemptSchema.partial().parse(req.body);
    const updatedAttempt = await storage.updateTestAttempt(attemptId, updateData);
    res.status(200).json(updatedAttempt);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input data", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to update test attempt" });
  }
});

// POST /api/answers
router.post("/answers", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId || (req.session.role || "") !== "student") {
      return res.status(401).json({ message: "Unauthorized: Only students can submit answers" });
    }

    const answerData = insertAnswerSchema.parse(req.body);
    const attempt = await storage.getTestAttempt(answerData.attemptId);

    if (!attempt) return res.status(404).json({ message: "Test attempt not found" });
    if (attempt.studentId !== req.session.userId)
      return res.status(403).json({ message: "Forbidden: Not your test attempt" });
    if (attempt.status === "completed")
      return res.status(400).json({ message: "Test attempt is already completed" });

    const question = await storage.getQuestion(answerData.questionId);
    if (!question) return res.status(404).json({ message: "Question not found" });

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

// POST /api/evaluate
router.post(
  "/evaluate",
  authenticateToken,
  await checkAIQuota("ai_tutor"),
  async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId || (req.session.role || "") !== "teacher") {
        return res
          .status(401)
          .json({ message: "Unauthorized: Only teachers can evaluate answers" });
      }
      const userId = req.session.userId;
      const workspace = (req as any).workspace;

      const { answerId } = req.body;
      if (!answerId) return res.status(400).json({ message: "Answer ID is required" });

      const answer = await storage.getAnswer(answerId);
      if (!answer) return res.status(404).json({ message: "Answer not found" });

      const question = await storage.getQuestion(answer.questionId);
      if (!question) return res.status(404).json({ message: "Question not found" });

      const attempt = await storage.getTestAttempt(answer.attemptId);
      if (!attempt) return res.status(404).json({ message: "Test attempt not found" });

      const test = await storage.getTest(attempt.testId);
      if (!test) return res.status(404).json({ message: "Test not found" });

      if (test.teacherId !== req.session.userId) {
        return res.status(403).json({ message: "Forbidden: Not your test" });
      }

      let text: string = answer.text ?? "";
      if (answer.ocrText) {
        text = answer.ocrText;
      }

      const evaluation = await evaluateSubjectiveAnswer(
        text,
        question.text,
        question.aiRubric || "Score based on accuracy and completeness",
        question.marks
      );

      const updatedAnswer = await storage.updateAnswer(answerId, {
        score: evaluation.score,
        aiConfidence: evaluation.confidence,
        aiFeedback: evaluation.feedback,
      });

      await pgIncrementAIUsage({
        userId,
        workspaceId: workspace?.id,
        feature: "ai_tutor",
        metadata: { type: "answer_evaluation", answerId },
      });

      res.status(200).json(updatedAnswer);
    } catch {
      res.status(500).json({ message: "Failed to evaluate answer" });
    }
  }
);

// POST /api/ai/generate-test
router.post(
  "/ai/generate-test",
  authenticateToken,
  await checkAIQuota("ai_tutor"),
  async (req: Request, res: Response) => {
    try {
      const { subject, numQuestions, difficulty, grade } = req.body;
      const userId = req.user!.id;
      const workspace = (req as any).workspace;

      const prompt = `Generate ${numQuestions} ${difficulty} questions for a ${grade} student on the topic: ${subject}.
Return as JSON array: [{ "question": "text", "options": ["A","B","C","D"], "answer": "correct option", "explanation": "why" }]`;

      let attempt = 0;
      let questions = null;

      while (attempt < 2 && !questions) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30-second timeout

        try {
          const apiPromise = aiChat(
            [{ role: "user", content: prompt }],
            "You are a professional test creator. Respond only with valid JSON.",
            { signal: controller.signal }
          );

          const timeoutPromise = new Promise<never>((_, reject) => {
            controller.signal.addEventListener("abort", () =>
              reject(new Error("Request timed out"))
            );
          });

          const response = await Promise.race([apiPromise, timeoutPromise]);
          clearTimeout(timeoutId);

          questions = JSON.parse(response.content);
          if (!Array.isArray(questions)) throw new Error("Not an array");
        } catch (e: any) {
          clearTimeout(timeoutId);
          controller.abort();
          if (e.message === "Request timed out" || e.name === "AbortError") {
            logger.warn(`Test generation attempt ${attempt + 1} timed out.`);
          }
          attempt++;
          if (attempt === 2) throw e;
        }
      }

      await pgIncrementAIUsage({
        userId,
        workspaceId: workspace?.id,
        feature: "ai_tutor",
        metadata: { type: "test_generation", subject },
      });

      res.json(questions);
    } catch (error: any) {
      logger.error("Test generation error:", error);
      if (error.message === "Request timed out" || error.name === "AbortError") {
        return res.status(504).json({ message: "Test generation timed out" });
      }
      res.status(500).json({ message: "Failed to generate test questions" });
    }
  }
);

// Helper for optional authentication, so widgets can embed anonymously
const optionalAuthenticate = async (req: Request, res: Response, next: any) => {
  try {
    let token = req.cookies?.[ACCESS_COOKIE];
    if (!token) {
      const authHeader = req.headers?.authorization || req.headers?.Authorization;
      if (typeof authHeader === "string") {
        const parts = authHeader.split(" ");
        token = parts.length === 2 ? parts[1] : parts[0];
      }
    }

    if (token) {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
      if (payload?.userId) {
        const user = await pgFindUserById(payload.userId);
        if (user && !["suspended", "rejected"].includes(user.status)) {
          (req as any).user = {
            id: user.id,
            role: user.role,
            email: user.email,
            status: user.status,
            emailVerified: user.emailVerified,
          };
          const workspaceContext = await pgFindFirstWorkspaceMembership(user.id);
          (req as any).workspace = workspaceContext?.workspace ?? null;
          return next();
        }
      }
    }

    if (req.session?.userId) {
      const user = await pgFindUserById(req.session.userId);
      if (user && !["suspended", "rejected"].includes(user.status)) {
        (req as any).user = {
          id: user.id,
          role: user.role,
          email: user.email,
          status: user.status,
          emailVerified: user.emailVerified,
        };
        const workspaceContext = await pgFindFirstWorkspaceMembership(user.id);
        (req as any).workspace = workspaceContext?.workspace ?? null;
        return next();
      }
    }
  } catch (err: any) {
    // Only swallow JWT-specific errors; let DB/network errors surface
    if (err?.name !== "JsonWebTokenError" && err?.name !== "TokenExpiredError") {
      logger.warn("[optionalAuthenticate] Unexpected error during auth:", err);
    }
  }
  next();
};

// OPTIONS preflight for CORS on PDF generation
router.options("/ai/generate-from-pdf", (req: Request, res: Response) => {
  const origin = req.headers.origin;
  res.header("Access-Control-Allow-Origin", origin || "*");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.sendStatus(200);
});

// POST /api/ai/generate-from-pdf
router.post(
  "/ai/generate-from-pdf",
  (req: Request, res: Response, next) => {
    const origin = req.headers.origin;
    res.header("Access-Control-Allow-Origin", origin || "*");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization"
    );
    next();
  },
  optionalAuthenticate,
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      let pdfBuffer: Buffer | null = null;

      if (req.file) {
        pdfBuffer = await fs.promises.readFile(req.file.path);
        try {
          await fs.promises.unlink(req.file.path);
        } catch (unlinkError) {
          logger.error("Failed to delete temp file:", unlinkError);
        }
      } else if (req.body.pdfData) {
        const base64Data = req.body.pdfData.includes("base64,")
          ? req.body.pdfData.split("base64,")[1]
          : req.body.pdfData;
        pdfBuffer = Buffer.from(base64Data, "base64");
      }

      if (!pdfBuffer) {
        return res.status(400).json({ message: "No PDF file or pdfData provided." });
      }

      const numQuestions = req.body.numQuestions ? parseInt(req.body.numQuestions) : 5;
      const difficulty = req.body.difficulty || "medium";
      const grade = req.body.grade || "high school";

      const prompt = `Generate ${numQuestions} ${difficulty} MCQ questions for a ${grade} student based on the attached PDF.
Return as JSON array: [{ "question": "text", "options": ["A","B","C","D"], "answer": "correct option", "explanation": "why" }]`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30-second timeout

      try {
        const apiPromise = generateContentFromPdf(pdfBuffer, prompt, "gemini-2.0-flash", {
          signal: controller.signal,
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
          controller.signal.addEventListener("abort", () => reject(new Error("Request timed out")));
        });

        const responseText = await Promise.race([apiPromise, timeoutPromise]);
        clearTimeout(timeoutId);

        // Parse JSON from response
        const jsonMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
        const jsonString = jsonMatch ? jsonMatch[0] : responseText;
        const questions = JSON.parse(jsonString);

        if (!Array.isArray(questions)) {
          throw new Error("Generated content is not a valid questions array");
        }

        // Increment quota usage if authenticated
        const userId = req.user?.id || req.session?.userId;
        const workspace = (req as any).workspace;
        if (userId) {
          await pgIncrementAIUsage({
            userId,
            workspaceId: workspace?.id,
            feature: "ai_tutor",
            metadata: { type: "test_generation_from_pdf" },
          });
        }

        res.json(questions);
      } catch (e: any) {
        clearTimeout(timeoutId);
        controller.abort();
        throw e;
      }
    } catch (error: any) {
      logger.error("PDF test generation error:", error);
      if (error.message === "Request timed out" || error.name === "AbortError") {
        return res.status(504).json({ message: "PDF test generation timed out" });
      }
      res.status(500).json({ message: "Failed to generate test questions from PDF" });
    }
  }
);

// GET /api/teacher/subjects
router.get("/teacher/subjects", authenticateToken, async (req: Request, res: Response) => {
  try {
    const teacherId = req.user!.id;
    if (!teacherId || (req.user?.role || "") !== "teacher") {
      return res.status(403).json({ message: "Only teachers can access this" });
    }

    const result: any[] = [];
    res.json(result);
  } catch {
    res.status(500).json({ message: "Failed to fetch subjects" });
  }
});

export default router;
