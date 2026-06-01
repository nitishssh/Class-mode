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
import { classroomQueue } from "./job-queue";
import {
  pgFindAIClassroomByJobId, pgFindAIClassroomById,
  pgDeleteAIClassroom, pgFindAIClassroomsByTeacher, pgCountAIClassrooms,
} from "../../lib/pg-queries";
import type { ClassroomData } from "./types";
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

// ── Service Class ────────────────────────────────────────────────────────────

export class StudyArenaService extends EventEmitter {
  /**
   * Submit a new classroom generation job (async, returns immediately).
   * The frontend should poll /job/:jobId for status.
   */
  async createClassroom(requirement: string, teacherId: number, workspaceId?: number | null): Promise<{ jobId: string }> {
    const jobId = nanoid(10);

    await classroomQueue.add(
      "generate",
      { requirement, teacherId, workspaceId },
      { jobId }
    );

    logger.info(`[StudyArena] Persistent job ${jobId} added to queue for teacher ${teacherId}`);

    return { jobId };
  }

  /**
   * Poll job status from BullMQ.
   */
  async pollJob(jobId: string): Promise<JobStatus> {
    const job = await classroomQueue.getJob(jobId);

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

    const state = await job.getState();
    const progress = job.progress as any;

    return {
      jobId,
      status: state === "completed" ? "succeeded" : (state === "failed" ? "failed" : (state === "active" ? "running" : "pending")),
      step: progress?.step || (state === "completed" ? "completed" : (state === "failed" ? "error" : "queued")),
      progress: typeof progress === "number" ? progress : (progress?.progress || 0),
      message: progress?.message || (state === "completed" ? "Completed" : (state === "failed" ? "Failed" : "In Queue")),
      done: state === "completed" || state === "failed",
      scenesGenerated: progress?.scenesGenerated,
      totalScenes: progress?.totalScenes,
      result: job.returnvalue,
      error: job.failedReason,
    };
  }

  /**
   * Get classroom data by ID.
   */
  async getClassroom(id: number): Promise<ClassroomData | null> {
    const classroom = await pgFindAIClassroomById(id);
    return (classroom?.data as ClassroomData) || null;
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const job = await classroomQueue.getJob(jobId);
    if (!job) return false;
    await job.remove();
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
