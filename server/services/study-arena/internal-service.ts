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
import { generateFullClassroom } from "./generator";
import { MongoAIClassroom, getNextSequenceValue } from "../../../shared/mongo-schema";
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

const jobs = new Map<string, JobStatus>();

/** Stale job timeout (30 minutes) */
const STALE_JOB_TIMEOUT_MS = 30 * 60 * 1000;

function markStaleIfNeeded(job: JobStatus): JobStatus {
  if (job.status !== "running") return job;
  // We don't track timestamps per-job in the Map, so just return as-is for now
  return job;
}

// ── Service Class ────────────────────────────────────────────────────────────

export class StudyArenaService {
  /**
   * Submit a new classroom generation job (async, returns immediately).
   * The frontend should poll /job/:jobId for status.
   */
  async createClassroom(requirement: string, teacherId: number): Promise<{ jobId: string }> {
    const jobId = nanoid(10);

    // Initialize the job
    jobs.set(jobId, {
      jobId,
      status: "pending",
      step: "queued",
      progress: 0,
      message: "Classroom generation queued...",
      done: false,
    });

    // Fire-and-forget: start async generation
    this.runGenerationJob(jobId, requirement, teacherId).catch((err) => {
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
  ): Promise<void> {
    const updateJob = (updates: Partial<JobStatus>) => {
      const current = jobs.get(jobId);
      if (current) {
        jobs.set(jobId, { ...current, ...updates });
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
      );

      // Persist to MongoDB
      const id = await getNextSequenceValue("classroomId");
      const classroom = new MongoAIClassroom({
        id,
        teacherId,
        topic: requirement,
        studyArenaJobId: jobId,
        data: classroomData,
        status: "ready",
      });
      await classroom.save();

      logger.info(`[StudyArena] Job ${jobId} completed. ClassroomId: ${id}, ${classroomData.scenes.length} scenes`);

      updateJob({
        status: "succeeded",
        step: "completed",
        progress: 100,
        message: `Classroom generated with ${classroomData.scenes.length} scenes`,
        done: true,
        scenesGenerated: classroomData.scenes.length,
        totalScenes: classroomData.scenes.length,
        result: { classroomId: id },
      });
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      logger.error(`[StudyArena] Job ${jobId} failed: ${errorMsg}`);

      updateJob({
        status: "failed",
        step: "error",
        done: true,
        error: errorMsg,
        message: `Generation failed: ${errorMsg}`,
      });

      // Try to update DB record if one was created
      try {
        await MongoAIClassroom.findOneAndUpdate(
          { studyArenaJobId: jobId },
          { status: "error" },
        );
      } catch {
        // Ignore — record might not exist yet
      }
    }
  }

  /**
   * Poll job status.
   * Ported from features/ai-classroom/studyArena/lib/server/classroom-job-store.ts
   */
  async pollJob(jobId: string): Promise<JobStatus> {
    const job = jobs.get(jobId);
    if (!job) {
      // Check MongoDB — job might have completed in a previous server lifecycle
      const dbClassroom = await MongoAIClassroom.findOne({ studyArenaJobId: jobId });
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
    const classroom = await MongoAIClassroom.findOne({ id });
    return (classroom?.data as ClassroomData) || null;
  }

  /**
   * List recent classrooms for a teacher.
   */
  async listClassrooms(teacherId: number, limit: number = 20): Promise<any[]> {
    const classrooms = await MongoAIClassroom.find({ teacherId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return classrooms.map((c) => ({
      id: c.id,
      topic: c.topic,
      status: c.status,
      createdAt: c.createdAt,
    }));
  }
}

// Singleton
export const studyArenaInternalService = new StudyArenaService();
