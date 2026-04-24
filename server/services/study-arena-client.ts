/**
 * Study Arena Client Service
 * Integrates PersonalLearningPro with the Study Arena multi-agent classroom engine.
 *
 * API surface matches the actual StudyArena Next.js endpoints:
 *   POST /api/generate-classroom          → submit async generation job
 *   GET  /api/generate-classroom/{jobId}  → poll job status
 *   GET  /api/classroom?id={id}           → load a saved classroom
 *   GET  /api/health                      → service health check
 */

import axios, { type AxiosInstance } from "axios";

// ── Types ────────────────────────────────────────────────────────────────────

export interface StudyArenaConfig {
  baseUrl: string;
  bridgeSecret?: string;
  timeout?: number;
}

/** Payload accepted by POST /api/generate-classroom */
export interface GenerateClassroomRequest {
  requirement: string;
  language?: string;
  enableTTS?: boolean;
  enableWebSearch?: boolean;
  enableImageGeneration?: boolean;
  enableVideoGeneration?: boolean;
  agentMode?: string;
  pdfContent?: string;
}

/** 202 response from POST /api/generate-classroom */
export interface GenerateClassroomResponse {
  jobId: string;
  status: string;
  step: string;
  message: string;
  pollUrl: string;
  pollIntervalMs: number;
}

/** Response from GET /api/generate-classroom/{jobId} */
export interface JobStatusResponse {
  jobId: string;
  status: "pending" | "running" | "succeeded" | "failed";
  step: string;
  progress?: number;
  message?: string;
  pollUrl: string;
  pollIntervalMs: number;
  scenesGenerated?: number;
  totalScenes?: number;
  result?: {
    classroomId?: string;
    url?: string;
    [key: string]: unknown;
  };
  error?: string;
  done: boolean;
}

/** Callback invoked on each poll tick so callers can report progress */
export type ProgressCallback = (status: JobStatusResponse) => void;

// ── Client ───────────────────────────────────────────────────────────────────

export class StudyArenaClient {
  private client: AxiosInstance;
  private config: StudyArenaConfig;

  constructor(config: StudyArenaConfig) {
    this.config = {
      timeout: 30000,
      ...config,
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        "Content-Type": "application/json",
        ...(this.config.bridgeSecret && {
          "X-Bridge-Secret": this.config.bridgeSecret,
        }),
      },
    });
  }

  /**
   * Submit a new classroom generation job (async).
   * Returns immediately with a jobId — poll with `pollJob()` for status.
   */
  async createClassroom(request: GenerateClassroomRequest): Promise<GenerateClassroomResponse> {
    try {
      const response = await this.client.post("/api/generate-classroom", request);
      return response.data;
    } catch (error: unknown) {
      throw new Error(`Failed to create classroom: ${(error as Error).message}`);
    }
  }

  /**
   * Poll the status of a classroom generation job.
   */
  async pollJob(jobId: string): Promise<JobStatusResponse> {
    try {
      const response = await this.client.get(`/api/generate-classroom/${jobId}`);
      return response.data;
    } catch (error: unknown) {
      throw new Error(`Failed to poll job ${jobId}: ${(error as Error).message}`);
    }
  }

  /**
   * Convenience: poll every `intervalMs` until `done === true` or timeout.
   * The optional `onProgress` callback fires on each tick.
   *
   * @param jobId        The job ID returned by `createClassroom()`
   * @param onProgress   Optional callback for intermediate status updates
   * @param timeoutMs    Maximum wait time (default: 5 minutes)
   * @param intervalMs   Polling interval (default: 5 seconds)
   */
  async pollUntilDone(
    jobId: string,
    onProgress?: ProgressCallback,
    timeoutMs: number = 300_000,
    intervalMs: number = 5_000,
  ): Promise<JobStatusResponse> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const status = await this.pollJob(jobId);
      onProgress?.(status);

      if (status.done) {
        return status;
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error(`Classroom generation timed out after ${timeoutMs / 1000}s (job: ${jobId})`);
  }

  /**
   * Load a previously saved classroom by its ID.
   * StudyArena uses a query parameter: GET /api/classroom?id=...
   */
  async getClassroom(classroomId: string): Promise<unknown> {
    try {
      const response = await this.client.get("/api/classroom", {
        params: { id: classroomId },
      });
      return response.data;
    } catch (error: unknown) {
      throw new Error(`Failed to get classroom: ${(error as Error).message}`);
    }
  }

  /**
   * Health check — GET /api/health
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get("/api/health");
      return response.status === 200;
    } catch {
      return false;
    }
  }
}

// ── Singleton ────────────────────────────────────────────────────────────────

let studyArenaClient: StudyArenaClient | null = null;

export function getStudyArenaClient(): StudyArenaClient | null {
  const baseUrl = process.env.STUDY_ARENA_URL || process.env.OPENMAIC_INTERNAL_URL;

  if (!baseUrl) {
    console.warn("Study Arena integration disabled: STUDY_ARENA_URL not configured");
    return null;
  }

  if (!studyArenaClient) {
    studyArenaClient = new StudyArenaClient({
      baseUrl,
      bridgeSecret: process.env.BRIDGE_SECRET,
    });
  }

  return studyArenaClient;
}
