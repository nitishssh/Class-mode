import { Queue, Worker, Job } from "bullmq";
import { newRedisConnection, isRedisConfigured, BULLMQ_PREFIX } from "../../lib/redis";
import { generateFullClassroom } from "./generator";
import {
  pgCreateAIClassroom,
  pgFindAIClassroomByJobId,
  pgUpdateAIClassroom,
  pgIncrementAIUsage,
} from "../../lib/pg-queries";
import { logger } from "../../lib/logger";
import type { ClassroomGenerationProgress } from "./types";

// Gated on REDIS_URL via the shared lib: with Redis off, queue and worker are
// null and callers surface a clear error instead of the previous behavior
// (an unconditional localhost:6379 connection spamming ECONNREFUSED at boot).
const connection = newRedisConnection("bullmq");

export const classroomQueue: Queue | null = connection
  ? new Queue("classroom-generation", {
      connection: connection as any,
      prefix: BULLMQ_PREFIX,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    })
  : null;

async function processJob(job: Job) {
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

    logger.info(`[StudyArena] Job ${jobId} completed. ClassroomId: ${classroom.id}`);

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
}

export const classroomWorker: Worker | null = connection
  ? new Worker("classroom-generation", processJob, {
      connection: connection as any,
      prefix: BULLMQ_PREFIX,
      concurrency: 5,
    })
  : null;

if (classroomWorker) {
  classroomWorker.on("completed", (job) => {
    logger.info(`[StudyArena] Job ${job.id} has completed!`);
  });
  classroomWorker.on("failed", (job, err) => {
    logger.error(`[StudyArena] Job ${job?.id} has failed with ${err.message}`);
  });
} else if (!isRedisConfigured()) {
  logger.info("[StudyArena] REDIS_URL not set — persistent job queue disabled");
}
