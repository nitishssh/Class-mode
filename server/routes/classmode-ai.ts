import { Router } from "express";
import { z } from "zod";
import { classModeAIGenerationRequestSchema } from "@shared/classmode-ai";
import { ClassModeAIClient, ClassModeAIServiceError } from "../services/study-arena-client";

const router = Router();
const jobIdSchema = z.string().regex(/^[A-Za-z0-9_-]+$/);

function client() {
  const baseUrl = process.env.CLASSMODE_AI_BASE_URL?.trim();
  if (!baseUrl) throw new Error("CLASSMODE_AI_BASE_URL is not configured");
  return new ClassModeAIClient({
    baseUrl,
    serviceSecret: process.env.CLASSMODE_AI_SERVICE_SECRET?.trim(),
    timeoutMs: Number(process.env.CLASSMODE_AI_TIMEOUT_MS || 15_000),
  });
}

function workspaceId(req: unknown): string | null {
  const value = (req as { workspace?: { id?: number | string } }).workspace?.id;
  return value == null ? null : String(value);
}

function sendError(res: any, error: unknown) {
  if (error instanceof ClassModeAIServiceError) {
    return res.status(error.status && error.status < 500 ? error.status : 502).json({
      message: error.message,
      code: error.code,
      requestId: error.requestId,
      retryable: error.retryable,
    });
  }
  return res.status(503).json({ message: "ClassMode AI is not configured", code: "SERVICE_UNAVAILABLE", retryable: true });
}

router.get("/health", async (_req, res) => {
  try {
    res.json({ service: "classmode-ai", available: await client().healthCheck() });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post("/generation-jobs", async (req, res) => {
  const scope = workspaceId(req);
  if (!scope) return res.status(409).json({ message: "No active workspace" });
  const parsed = classModeAIGenerationRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid generation request", issues: parsed.error.issues });
  try {
    const job = await client().createGenerationJob(scope, parsed.data);
    return res.status(202).json({ job });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get("/generation-jobs/:jobId", async (req, res) => {
  const scope = workspaceId(req);
  if (!scope) return res.status(409).json({ message: "No active workspace" });
  const parsed = jobIdSchema.safeParse(req.params.jobId);
  if (!parsed.success) return res.status(400).json({ message: "Invalid generation job id" });
  try {
    return res.json({ job: await client().getGenerationJob(scope, parsed.data) });
  } catch (error) {
    return sendError(res, error);
  }
});

router.delete("/generation-jobs/:jobId", async (req, res) => {
  const scope = workspaceId(req);
  if (!scope) return res.status(409).json({ message: "No active workspace" });
  const parsed = jobIdSchema.safeParse(req.params.jobId);
  if (!parsed.success) return res.status(400).json({ message: "Invalid generation job id" });
  try {
    return res.json({ job: await client().cancelGenerationJob(scope, parsed.data) });
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;
