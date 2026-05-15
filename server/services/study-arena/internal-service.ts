/**
 * Study Arena Internal Service — Job Queue + Persistence
 *
 * Ported from features/ai-classroom/studyArena/lib/server/ job-runner + job-store.
 * Adapted to use MongoDB (MongoAIClassroom) instead of filesystem JSON storage.
 *
 * Job lifecycle:
 *   createClassroom() → in-memory job (pending) → runGenerationJob() (async) → MongoDB
 */

import { nanoid } from "nanoid";
import { EventEmitter } from "events";
import { generateFullClassroom } from "./generator";
import {
  pgCreateAIClassroom, pgFindAIClassroomByJobId, pgFindAIClassroomById,
  pgUpdateAIClassroom, pgDeleteAIClassroom, pgFindAIClassroomsByTeacher, pgCountAIClassrooms,
} from "../../lib/pg-queries";
import type { ClassroomData, ClassroomGenerationProgress } from "./types";
import { logger } from "../../lib/logger";

// ── Job Types ────────────────────────────────────────────────────────────────

export interface JobStatus {
  jobId: string;
  status: "pending" | "running" | "succeeded" | "failed";
  step: string;
  progress: number;
  message: string;
  done: boolean;
  scenesGenerated?: number;
  totalScenes?: number;
  result?: {
    classroomId: number;
  };
  error?: string;
}

// ── In-Memory Job Store ──────────────────────────────────────────────────────
// Phase 1: simple Map-based store. Phase 2 could move to Redis.

const jobs = new Map<string, JobStatus & { updatedAt: number }>();
const jobAbortControllers = new Map<string, AbortController>();

const STALE_JOB_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_COMPLETED_JOBS = 500;

function markStaleIfNeeded(job: JobStatus & { updatedAt: number }): JobStatus {
  if (job.status === "running" && Date.now() - job.updatedAt > STALE_JOB_TIMEOUT_MS) {
    return { ...job, status: "failed", done: true, error: "Job timed out" };
  }
  return job;
}

function evictCompletedJobs() {
  if (jobs.size <= MAX_COMPLETED_JOBS) return;
  const completed: Array<[string, JobStatus & { updatedAt: number }]> = [];
  jobs.forEach((v, k) => {
    if (v.done) completed.push([k, v]);
  });
  completed.sort((a, b) => a[1].updatedAt - b[1].updatedAt);
  const removeCount = completed.length - MAX_COMPLETED_JOBS;
  for (let i = 0; i < removeCount && i < completed.length; i++) {
    jobs.delete(completed[i][0]);
  }
}

// ── Service Class ────────────────────────────────────────────────────────────

export class StudyArenaService extends EventEmitter {
  /**
   * Submit a new classroom generation job (async, returns immediately).
   * The frontend should poll /job/:jobId for status.
   */
  async createClassroom(requirement: string, teacherId: number): Promise<{ jobId: string }> {
    const jobId = nanoid(10);

    jobs.set(jobId, {
      jobId,
      status: "pending",
      step: "queued",
      progress: 0,
      message: "Classroom generation queued...",
      done: false,
      updatedAt: Date.now(),
    });

    const abortController = new AbortController();
    jobAbortControllers.set(jobId, abortController);

    this.runGenerationJob(jobId, requirement, teacherId, abortController.signal).catch((err) => {
      logger.error(`[StudyArena] Job ${jobId} uncaught error:`, err);
    });

    return { jobId };
  }

  /**
   * Internal worker — runs the full generation pipeline asynchronously.
   * Ported from features/ai-classroom/studyArena/lib/server/classroom-job-runner.ts
   */
  private async runGenerationJob(
    jobId: string,
    requirement: string,
    teacherId: number,
    signal: AbortSignal
  ): Promise<void> {
    const updateJob = (updates: Partial<JobStatus>) => {
      const current = jobs.get(jobId);
      if (current) {
        const updated = { ...current, ...updates, updatedAt: Date.now() };
        jobs.set(jobId, updated);
        this.emit(`job:${jobId}`, updated);
      }
    };

    try {
      updateJob({ status: "running" });

      // Run the full generation pipeline with progress reporting
      const classroomData = await generateFullClassroom(
        requirement,
        (progress: ClassroomGenerationProgress) => {
          updateJob({
            step: progress.step,
            progress: progress.progress,
            message: progress.message,
            scenesGenerated: progress.scenesGenerated,
            totalScenes: progress.totalScenes,
          });
        },
        signal
      );

      // Persist to PostgreSQL
      const classroom = await pgCreateAIClassroom({
        teacherId,
        topic: requirement,
        studyArenaJobId: jobId,
        status: "pending",
      });
      await pgUpdateAIClassroom(classroom.id, { status: "ready", data: classroomData });

      logger.info(
        `[StudyArena] Job ${jobId} completed. ClassroomId: ${classroom.id}, ${classroomData.scenes.length} scenes`
      );

      updateJob({
        status: "succeeded",
        step: "completed",
        progress: 100,
        message: `Classroom generated with ${classroomData.scenes.length} scenes`,
        done: true,
        scenesGenerated: classroomData.scenes.length,
        totalScenes: classroomData.scenes.length,
        result: { classroomId: classroom.id },
      });

      jobAbortControllers.delete(jobId);
      evictCompletedJobs();
    } catch (error: any) {
      jobAbortControllers.delete(jobId);
      const errorMsg = error?.message || String(error);
      logger.error(`[StudyArena] Job ${jobId} failed: ${errorMsg}`);

      updateJob({
        status: "failed",
        step: "error",
        done: true,
        error: errorMsg,
        message: `Generation failed: ${errorMsg}`,
      });

      try {
        const rec = await pgFindAIClassroomByJobId(jobId);
        if (rec) await pgUpdateAIClassroom(rec.id, { status: "error" });
      } catch { /* ignore — record might not exist yet */ }
    }
  }

  /**
   * Poll job status.
   * Ported from features/ai-classroom/studyArena/lib/server/classroom-job-store.ts
   */
  async pollJob(jobId: string): Promise<JobStatus> {
    const job = jobs.get(jobId);
    if (!job) {
      const dbClassroom = await pgFindAIClassroomByJobId(jobId);
      if (dbClassroom) {
        return {
          jobId,
          status: dbClassroom.status === "ready" ? "succeeded" : "failed",
          step: dbClassroom.status === "ready" ? "completed" : "error",
          progress: 100,
          message: dbClassroom.status === "ready" ? "Classroom ready" : "Generation failed",
          done: true,
          result: dbClassroom.status === "ready" ? { classroomId: dbClassroom.id } : undefined,
        };
      }
      throw new Error(`Job ${jobId} not found`);
    }
    return markStaleIfNeeded(job);
  }

  /**
   * Get classroom data by ID.
   */
  async getClassroom(id: number): Promise<ClassroomData | null> {
    const classroom = await pgFindAIClassroomById(id);
    return (classroom?.data as ClassroomData) || null;
  }

  cancelJob(jobId: string): boolean {
    const controller = jobAbortControllers.get(jobId);
    if (!controller) return false;
    controller.abort();
    jobAbortControllers.delete(jobId);
    return true;
  }

  async deleteClassroom(id: number, teacherId: number): Promise<boolean> {
    const rec = await pgFindAIClassroomById(id);
    if (!rec || rec.teacherId !== teacherId) return false;
    return pgDeleteAIClassroom(id);
  }

  async listClassrooms(
    teacherId: number,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ classrooms: any[]; total: number }> {
    const [classrooms, total] = await Promise.all([
      pgFindAIClassroomsByTeacher(teacherId, offset, limit),
      pgCountAIClassrooms(teacherId),
    ]);
    return {
      classrooms: classrooms.map((c) => ({
        id: c.id,
        topic: c.topic,
        status: c.status,
        createdAt: c.createdAt,
      })),
      total,
    };
  }
}

// Singleton
export const studyArenaInternalService = new StudyArenaService();
