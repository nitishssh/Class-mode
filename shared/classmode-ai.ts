import { z } from "zod";

export const CLASSMODE_AI_API_VERSION = "v1" as const;

export const classModeAIErrorEnvelopeSchema = z.object({
  ok: z.literal(false),
  apiVersion: z.literal(CLASSMODE_AI_API_VERSION),
  requestId: z.string().min(1),
  error: z.object({
    code: z.enum(["UNAUTHENTICATED", "WORKSPACE_REQUIRED", "INVALID_REQUEST", "NOT_FOUND", "CONFLICT", "RATE_LIMITED", "UPSTREAM_ERROR", "INTERNAL_ERROR"]),
    message: z.string(),
    retryable: z.boolean(),
    retryAfterMs: z.number().int().nonnegative().optional(),
  }),
});

export const classModeAIGenerationRequestSchema = z.object({
  requirement: z.string().trim().min(1).max(20_000),
  sourceText: z.string().max(2_000_000).optional(),
});
export type ClassModeAIGenerationRequest = z.infer<typeof classModeAIGenerationRequestSchema>;

export const classModeAIJobSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"]),
  step: z.string().optional(),
  progress: z.number().min(0).max(100),
  message: z.string().optional(),
  scenesGenerated: z.number().int().nonnegative().optional(),
  totalScenes: z.number().int().nonnegative().optional(),
  result: z.object({ classroomId: z.string(), url: z.string(), scenesCount: z.number().int().nonnegative() }).optional(),
  error: z.string().optional(),
  done: z.boolean().optional(),
});
export type ClassModeAIJob = z.infer<typeof classModeAIJobSchema>;

export const classModeAILessonDraftSchema = z.object({
  classroomId: z.string().min(1),
  scenes: z.array(z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    kind: z.enum(["slide", "quiz", "interactive", "pbl"]),
    textBlocks: z.array(z.string()),
    questions: z.array(z.object({
      prompt: z.string().min(1),
      choices: z.array(z.string().min(1)).optional(),
      answerKey: z.string().min(1).optional(),
    })),
  })).min(1),
});
export type ClassModeAILessonDraft = z.infer<typeof classModeAILessonDraftSchema>;

export const classModeAILessonDraftEnvelopeSchema = z.object({
  ok: z.literal(true),
  apiVersion: z.literal(CLASSMODE_AI_API_VERSION),
  requestId: z.string().min(1),
  lessonDraft: classModeAILessonDraftSchema,
});

export const classModeAIJobEnvelopeSchema = z.object({
  ok: z.literal(true),
  apiVersion: z.literal(CLASSMODE_AI_API_VERSION),
  requestId: z.string().min(1),
  job: classModeAIJobSchema,
});
