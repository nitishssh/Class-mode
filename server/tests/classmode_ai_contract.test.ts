import { describe, expect, it } from "vitest";
import {
  classModeAIErrorEnvelopeSchema,
  classModeAIGenerationRequestSchema,
  classModeAIJobEnvelopeSchema,
} from "../../shared/classmode-ai";

describe("ClassMode AI contract", () => {
  it("rejects empty generation requests", () => {
    expect(classModeAIGenerationRequestSchema.safeParse({ requirement: " " }).success).toBe(false);
  });

  it("accepts a versioned workspace job response", () => {
    const parsed = classModeAIJobEnvelopeSchema.parse({
      ok: true,
      apiVersion: "v1",
      requestId: "req-1",
      job: { id: "job-1", status: "queued", progress: 0 },
    });
    expect(parsed.job.id).toBe("job-1");
  });

  it("preserves structured retry information", () => {
    const parsed = classModeAIErrorEnvelopeSchema.parse({
      ok: false,
      apiVersion: "v1",
      requestId: "req-2",
      error: {
        code: "UPSTREAM_ERROR",
        message: "Provider unavailable",
        retryable: true,
        retryAfterMs: 5000,
      },
    });
    expect(parsed.error.retryAfterMs).toBe(5000);
  });

  it("accepts a cancelled job as a terminal result", () => {
    const parsed = classModeAIJobEnvelopeSchema.parse({
      ok: true,
      apiVersion: "v1",
      requestId: "req-3",
      job: { id: "job-3", status: "cancelled", progress: 40, done: true },
    });
    expect(parsed.job.status).toBe("cancelled");
    expect(parsed.job.done).toBe(true);
  });
});
