import { Queue, Worker, Job } from "bullmq";
import Redis from "ioredis";
import { generateFullClassroom } from "./generator";
import {
  pgCreateAIClassroom,
  pgFindAIClassroomByJobId,
  pgUpdateAIClassroom,
  pgIncrementAIUsage,
} from "../../lib/pg-queries";
import { logger } from "../../lib/logger";
import type { ClassroomGenerationProgress } from "./types";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

export const classroomQueue = new Queue("classroom-generation", {
  connection: connection as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export const classroomWorker = new Worker(
  "classroom-generation",
  async (job: Job) => {
    const { requirement, teacherId, workspaceId } = job.data;
    const jobId = job.id!;

    logger.info(`[StudyArena] Starting persistent job ${jobId} for teacher ${teacherId}`);

    try {
      const classroomData = await generateFullClassroom(
        requirement,
        async (progress: ClassroomGenerationProgress) => {
          await job.updateProgress(progress);
        }
      );

      // Persist to PostgreSQL
      const classroom = await pgCreateAIClassroom({
        teacherId,
        topic: requirement,
        studyArenaJobId: jobId,
        status: "pending",
      });
      await pgUpdateAIClassroom(classroom.id, { status: "ready", data: classroomData });

      // Increment Usage
      await pgIncrementAIUsage({
        userId: teacherId,
        workspaceId,
        feature: "ai_classroom",
        metadata: { classroomId: classroom.id, topic: requirement },
      });

      logger.info(
        `[StudyArena] Job ${jobId} completed. ClassroomId: ${classroom.id}`
      );

      return { classroomId: classroom.id };
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      logger.error(`[StudyArena] Job ${jobId} failed: ${errorMsg}`);

      try {
        const rec = await pgFindAIClassroomByJobId(jobId);
        if (rec) await pgUpdateAIClassroom(rec.id, { status: "error" });
      } catch {
        /* ignore */
      }
      throw error;
    }
  },
  { connection: connection as any, concurrency: 5 }
);

classroomWorker.on("completed", (job) => {
  logger.info(`[StudyArena] Job ${job.id} has completed!`);
});

classroomWorker.on("failed", (job, err) => {
  logger.error(`[StudyArena] Job ${job?.id} has failed with ${err.message}`);
});
