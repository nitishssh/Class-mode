/** Trusted backend client for the versioned ClassMode AI service. */
import axios, { AxiosError } from "axios";
import { randomUUID } from "crypto";
import {
  classModeAIErrorEnvelopeSchema,
  classModeAIJobEnvelopeSchema,
  classModeAILessonDraftEnvelopeSchema,
  classModeAIGenerationRequestSchema,
  type ClassModeAIGenerationRequest,
  type ClassModeAIJob,
  type ClassModeAILessonDraft,
} from "@shared/classmode-ai";

interface ClassModeAIClientConfig {
  baseUrl: string;
  serviceSecret?: string;
  timeoutMs?: number;
}

export class ClassModeAIServiceError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly requestId: string,
    readonly retryable: boolean,
    readonly status?: number
  ) {
    super(message);
    this.name = "ClassModeAIServiceError";
  }
}

export class ClassModeAIClient {
  private readonly baseUrl: string;
  private readonly serviceSecret?: string;
  private readonly timeoutMs: number;

  constructor({ baseUrl, serviceSecret, timeoutMs = 15_000 }: ClassModeAIClientConfig) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.serviceSecret = serviceSecret;
    this.timeoutMs = timeoutMs;
  }

  private headers(workspaceId: string, requestId = randomUUID()) {
    return {
      "x-request-id": requestId,
      "x-classmode-workspace-id": workspaceId,
      ...(this.serviceSecret ? { Authorization: `Bearer ${this.serviceSecret}` } : {}),
    };
  }

  private toError(error: unknown): never {
    if (error instanceof AxiosError) {
      const parsed = classModeAIErrorEnvelopeSchema.safeParse(error.response?.data);
      if (parsed.success) {
        throw new ClassModeAIServiceError(parsed.data.error.message, parsed.data.error.code, parsed.data.requestId, parsed.data.error.retryable, error.response?.status);
      }
    }
    throw new ClassModeAIServiceError("ClassMode AI is unavailable", "UPSTREAM_ERROR", randomUUID(), true);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/health`, { timeout: 5_000 });
      return response.status === 200 && response.data?.service === "classmode-ai";
    } catch {
      return false;
    }
  }

  async createGenerationJob(workspaceId: string, input: ClassModeAIGenerationRequest): Promise<ClassModeAIJob> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/v1/generation/jobs`, classModeAIGenerationRequestSchema.parse(input), {
        headers: this.headers(workspaceId),
        timeout: this.timeoutMs,
      });
      return classModeAIJobEnvelopeSchema.parse(response.data).job;
    } catch (error) {
      this.toError(error);
    }
  }

  async getGenerationJob(workspaceId: string, jobId: string): Promise<ClassModeAIJob> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/generation/jobs/${encodeURIComponent(jobId)}`, {
        headers: this.headers(workspaceId),
        timeout: this.timeoutMs,
      });
      return classModeAIJobEnvelopeSchema.parse(response.data).job;
    } catch (error) {
      this.toError(error);
    }
  }

  async cancelGenerationJob(workspaceId: string, jobId: string): Promise<ClassModeAIJob> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/v1/generation/jobs/${encodeURIComponent(jobId)}/cancel`,
        {},
        { headers: this.headers(workspaceId), timeout: this.timeoutMs },
      );
      return classModeAIJobEnvelopeSchema.parse(response.data).job;
    } catch (error) {
      this.toError(error);
    }
  }

  async getLessonDraft(workspaceId: string, jobId: string): Promise<ClassModeAILessonDraft> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/generation/jobs/${encodeURIComponent(jobId)}/lesson-draft`, {
        headers: this.headers(workspaceId),
        timeout: this.timeoutMs,
      });
      return classModeAILessonDraftEnvelopeSchema.parse(response.data).lessonDraft;
    } catch (error) {
      this.toError(error);
    }
  }

  /** @deprecated Use createGenerationJob with an explicit workspace id. */
  async createClassroom(data: { requirement: string }): Promise<{ jobId: string; status: string }> {
    const job = await this.createGenerationJob("legacy", data);
    return { jobId: job.id, status: job.status };
  }

  /** @deprecated Use getGenerationJob with an explicit workspace id. */
  async pollJob(jobId: string): Promise<ClassModeAIJob & { jobId: string }> {
    const job = await this.getGenerationJob("legacy", jobId);
    return { ...job, jobId: job.id };
  }
}

/** @deprecated Compatibility alias for existing integration tests. */
export class StudyArenaClient extends ClassModeAIClient {
  constructor({ baseUrl, bridgeSecret }: { baseUrl: string; bridgeSecret?: string }) {
    super({ baseUrl, serviceSecret: bridgeSecret });
  }
}

export type JobStatus = ClassModeAIJob & { jobId?: string };
