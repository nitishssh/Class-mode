import { z } from "zod";

// ─── Rubric Schemas ──────────────────────────────────────────────────────────

export const RubricCriterionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  maxPoints: z.number().min(0).default(10),
  weight: z.number().min(0).max(1).default(1), // 0-1 weight, all weights should sum to 1
});

export const RubricSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  criteria: z.array(RubricCriterionSchema).min(1),
  totalPoints: z.number().min(1).default(100),
  gradingType: z.enum(["essay", "code", "math", "mixed"]).default("essay"),
});

// ─── Grading Request Schemas ─────────────────────────────────────────────────

export const GradingRequestSchema = z.object({
  submissionId: z.string().min(1),
  studentId: z.number(),
  content: z.string().min(1), // text, code, or extracted PDF text
  contentType: z.enum(["text", "code_python", "code_javascript", "code_typescript", "pdf"]).default("text"),
  rubric: RubricSchema,
  attachments: z.array(z.string()).optional(), // Firebase Storage URLs
  language: z.string().optional(), // for code grading: "python", "javascript", etc.
});

// ─── Score Breakdown Schemas ────────────────────────────────────────────────

export const CriterionScoreSchema = z.object({
  criterionName: z.string().min(1),
  score: z.number().min(0),
  maxScore: z.number().min(0),
  feedback: z.string().optional(),
});

export const ScoreBreakdownSchema = z.object({
  criteria: z.array(CriterionScoreSchema),
  totalScore: z.number().min(0),
  maxScore: z.number().min(0),
  percentage: z.number().min(0).max(100),
});

// ─── Grading Response Schemas ───────────────────────────────────────────────

export const GradingResponseSchema = z.object({
  submissionId: z.string().min(1),
  studentId: z.number(),
  status: z.enum(["pending", "completed", "failed"]),
  scoreBreakdown: ScoreBreakdownSchema.optional(),
  overallFeedback: z.string().optional(),
  strengths: z.array(z.string()).optional(),
  areasForImprovement: z.array(z.string()).optional(),
  processingTimeMs: z.number().optional(),
  modelUsed: z.string().optional(), // e.g., "gpt-4o"
  createdAt: z.string().or(z.date()),
});

// ─── Grading History Schemas ────────────────────────────────────────────────

export const GradingHistoryRequestSchema = z.object({
  studentId: z.number(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

// ─── Type Exports ───────────────────────────────────────────────────────────

export type RubricCriterion = z.infer<typeof RubricCriterionSchema>;
export type Rubric = z.infer<typeof RubricSchema>;
export type GradingRequest = z.infer<typeof GradingRequestSchema>;
export type CriterionScore = z.infer<typeof CriterionScoreSchema>;
export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;
export type GradingResponse = z.infer<typeof GradingResponseSchema>;
export type GradingHistoryRequest = z.infer<typeof GradingHistoryRequestSchema>;
