/**
 * Durable Study Arena lesson-compiler job machine.
 *
 * Fingerprint-dedupes in-flight compiles per workspace, supports cancel/retry,
 * and falls back to an inline sync compile when Redis/BullMQ is unavailable.
 */

import { createHash } from "crypto";
import { Queue, Worker, Job } from "bullmq";
import { newRedisConnection, isRedisConfigured, BULLMQ_PREFIX } from "../../lib/db/redis";
import { getPgPool, isPgReady } from "../../db-pg";
import { logger } from "../../lib/logger";
import { generateLessonScript, ensureScriptA11y, type LessonScript } from "./lesson-script";
import { getStudyArenaConcept } from "./concept-registry";

export type CompilerJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export type CompilerJobRow = {
  id: string;
  workspaceId: number;
  teacherId: number;
  requestFingerprint: string;
  status: CompilerJobStatus;
  progress: Record<string, unknown>;
  sourceText: string;
  objective: string;
  subject: string;
  gradeLevel: string | null;
  lessonVersionId: string | null;
  errorMessage: string | null;
  bullmqJobId: string | null;
  createdAt: Date;
  updatedAt: Date;
  cancelledAt: Date | null;
};

export type EnqueueCompileInput = {
  workspaceId: number;
  teacherId: number;
  sourceText: string;
  objective: string;
  subject: string;
  gradeLevel?: string | null;
};

export type EnqueueCompileResult =
  | { status: "queued" | "running" | "completed"; job: CompilerJobRow; deduped: boolean }
  | { status: "database_unavailable" }
  | { status: "error"; message: string };

const QUEUE_NAME = "study-arena-lesson-compile";

const connection = newRedisConnection("bullmq-lesson-compile");

export const lessonCompileQueue: Queue | null = connection
  ? new Queue(QUEUE_NAME, {
      connection: connection as any,
      prefix: BULLMQ_PREFIX,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    })
  : null;

function mapRow(row: {
  id: string;
  workspace_id: string | number;
  teacher_id: string | number;
  request_fingerprint: string;
  status: CompilerJobStatus;
  progress: unknown;
  source_text: string;
  objective: string;
  subject: string;
  grade_level: string | null;
  lesson_version_id: string | null;
  error_message: string | null;
  bullmq_job_id: string | null;
  created_at: Date;
  updated_at: Date;
  cancelled_at: Date | null;
}): CompilerJobRow {
  return {
    id: row.id,
    workspaceId: Number(row.workspace_id),
    teacherId: Number(row.teacher_id),
    requestFingerprint: row.request_fingerprint,
    status: row.status,
    progress: (row.progress && typeof row.progress === "object" ? row.progress : {}) as Record<
      string,
      unknown
    >,
    sourceText: row.source_text,
    objective: row.objective,
    subject: row.subject,
    gradeLevel: row.grade_level,
    lessonVersionId: row.lesson_version_id,
    errorMessage: row.error_message,
    bullmqJobId: row.bullmq_job_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    cancelledAt: row.cancelled_at,
  };
}

/** Stable SHA-256 fingerprint for in-flight compile dedupe. */
export function fingerprintRequest(input: {
  workspaceId: number;
  sourceText: string;
  objective: string;
  subject: string;
  gradeLevel?: string | null;
}): string {
  const payload = JSON.stringify({
    workspaceId: input.workspaceId,
    sourceText: input.sourceText.trim(),
    objective: input.objective.trim(),
    subject: input.subject.trim().toLowerCase(),
    gradeLevel: (input.gradeLevel ?? "").trim(),
  });
  return createHash("sha256").update(payload).digest("hex");
}

async function fetchJob(id: string): Promise<CompilerJobRow | null> {
  if (!isPgReady()) return null;
  const result = await getPgPool().query(
    `SELECT id, workspace_id, teacher_id, request_fingerprint, status, progress,
            source_text, objective, subject, grade_level, lesson_version_id,
            error_message, bullmq_job_id, created_at, updated_at, cancelled_at
       FROM study_arena_compiler_jobs WHERE id = $1`,
    [id]
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function getCompilerJob(id: string): Promise<CompilerJobRow | null> {
  return fetchJob(id);
}

async function updateJobProgress(
  jobId: string,
  progress: Record<string, unknown>,
  status?: CompilerJobStatus
): Promise<void> {
  await getPgPool().query(
    `UPDATE study_arena_compiler_jobs
        SET progress = $2::jsonb,
            status = COALESCE($3::text, status),
            updated_at = now()
      WHERE id = $1 AND status IN ('queued', 'running')`,
    [jobId, JSON.stringify(progress), status ?? null]
  );
}

async function markJobCancelled(jobId: string): Promise<boolean> {
  const result = await getPgPool().query(
    `UPDATE study_arena_compiler_jobs
        SET status = 'cancelled', cancelled_at = now(), updated_at = now()
      WHERE id = $1 AND status IN ('queued', 'running')
    RETURNING id`,
    [jobId]
  );
  return Boolean(result.rows[0]);
}

async function markJobFailed(jobId: string, message: string): Promise<void> {
  await getPgPool().query(
    `UPDATE study_arena_compiler_jobs
        SET status = 'failed', error_message = $2, updated_at = now()
      WHERE id = $1 AND status IN ('queued', 'running')`,
    [jobId, message.slice(0, 2000)]
  );
}

async function createDraftLessonFromScript(input: {
  workspaceId: number;
  teacherId: number;
  subject: string;
  gradeLevel: string | null;
  objective: string;
  script: LessonScript;
}): Promise<string> {
  const primaryConceptId = input.script.primaryConceptId ?? input.script.conceptIds[0] ?? null;
  const result = await getPgPool().query<{ id: string }>(
    `INSERT INTO study_arena_lesson_versions
       (workspace_id, created_by, status, subject, grade_level, objective, script,
        evaluator_version, primary_concept_id, approvals)
     VALUES ($1, $2, 'draft', $3, $4, $5, $6, 'v1', $7, '{}'::jsonb)
     RETURNING id`,
    [
      input.workspaceId,
      input.teacherId,
      input.subject,
      input.gradeLevel,
      input.objective,
      JSON.stringify(input.script),
      primaryConceptId,
    ]
  );
  return result.rows[0].id;
}

async function runCompile(jobId: string): Promise<void> {
  const job = await fetchJob(jobId);
  if (!job) return;
  if (job.status === "cancelled") return;
  if (job.status !== "queued" && job.status !== "running") return;

  const claimed = await getPgPool().query(
    `UPDATE study_arena_compiler_jobs
        SET status = 'running', progress = $2::jsonb, updated_at = now()
      WHERE id = $1 AND status IN ('queued', 'running')
    RETURNING id`,
    [jobId, JSON.stringify({ stage: "generating", percent: 10 })]
  );
  if (!claimed.rows[0]) return;

  // Cancellation checkpoint before the expensive model call.
  const beforeGenerate = await fetchJob(jobId);
  if (!beforeGenerate || beforeGenerate.status === "cancelled") return;

  const topic = `${job.objective}\n\nSource material:\n${job.sourceText}`.slice(0, 4000);
  try {
    const rawScript = await generateLessonScript(topic, { sceneCount: 3 });
    const script = ensureScriptA11y(rawScript);

    const afterGenerate = await fetchJob(jobId);
    if (!afterGenerate || afterGenerate.status === "cancelled") return;

    await updateJobProgress(jobId, { stage: "persisting", percent: 80 }, "running");

    const primaryConceptId = script.primaryConceptId ?? script.conceptIds[0];
    if (primaryConceptId && !getStudyArenaConcept(primaryConceptId)) {
      // Still allow draft creation — teacher can edit before publish.
      logger.warn("[StudyArena/compiler] generated concept not in registry", {
        jobId,
        primaryConceptId,
      });
    }

    const lessonVersionId = await createDraftLessonFromScript({
      workspaceId: job.workspaceId,
      teacherId: job.teacherId,
      subject: job.subject,
      gradeLevel: job.gradeLevel,
      objective: job.objective,
      script,
    });

    const completed = await getPgPool().query(
      `UPDATE study_arena_compiler_jobs
          SET status = 'completed',
              lesson_version_id = $2,
              progress = $3::jsonb,
              updated_at = now()
        WHERE id = $1 AND status = 'running'
      RETURNING id`,
      [jobId, lessonVersionId, JSON.stringify({ stage: "completed", percent: 100 })]
    );
    // Cancel raced past the post-generate checkpoint: drop the orphan draft so
    // cancelled jobs do not leave published-looking authoring debris.
    if (!completed.rows[0]) {
      await getPgPool().query(
        `DELETE FROM study_arena_lesson_versions WHERE id = $1 AND status = 'draft'`,
        [lessonVersionId]
      );
    }
  } catch (error: any) {
    const message = error?.message || String(error);
    logger.error(`[StudyArena/compiler] job ${jobId} failed: ${message}`);
    await markJobFailed(jobId, message);
    throw error;
  }
}

async function processBullmqJob(job: Job) {
  const { compilerJobId } = job.data as { compilerJobId: string };
  logger.info(`[StudyArena/compiler] Starting BullMQ job ${job.id} → ${compilerJobId}`);
  await job.updateProgress({ stage: "running", percent: 5 });
  await runCompile(compilerJobId);
  return { compilerJobId };
}

export const lessonCompileWorker: Worker | null = connection
  ? new Worker(QUEUE_NAME, processBullmqJob, {
      connection: connection as any,
      prefix: BULLMQ_PREFIX,
      concurrency: 3,
    })
  : null;

if (lessonCompileWorker) {
  lessonCompileWorker.on("completed", (job) => {
    logger.info(`[StudyArena/compiler] BullMQ job ${job.id} completed`);
  });
  lessonCompileWorker.on("failed", (job, err) => {
    logger.error(`[StudyArena/compiler] BullMQ job ${job?.id} failed: ${err.message}`);
  });
} else if (!isRedisConfigured()) {
  logger.info("[StudyArena/compiler] REDIS_URL not set — sync compile fallback enabled");
}

/**
 * Creates a compiler job row and enqueues BullMQ work, or runs inline when Redis
 * is off. Active (queued|running) jobs with the same fingerprint are reused.
 */
export async function enqueueLessonCompile(
  input: EnqueueCompileInput
): Promise<EnqueueCompileResult> {
  if (!isPgReady()) return { status: "database_unavailable" };

  const fingerprint = fingerprintRequest(input);
  const pool = getPgPool();

  // Dedupe: return any in-flight job with the same fingerprint.
  const existing = await pool.query(
    `SELECT id, workspace_id, teacher_id, request_fingerprint, status, progress,
            source_text, objective, subject, grade_level, lesson_version_id,
            error_message, bullmq_job_id, created_at, updated_at, cancelled_at
       FROM study_arena_compiler_jobs
      WHERE workspace_id = $1 AND request_fingerprint = $2
        AND status IN ('queued', 'running')
      LIMIT 1`,
    [input.workspaceId, fingerprint]
  );
  if (existing.rows[0]) {
    return { status: existing.rows[0].status, job: mapRow(existing.rows[0]), deduped: true };
  }

  let inserted;
  try {
    inserted = await pool.query(
      `INSERT INTO study_arena_compiler_jobs
         (workspace_id, teacher_id, request_fingerprint, status, progress,
          source_text, objective, subject, grade_level)
       VALUES ($1, $2, $3, 'queued', '{"stage":"queued","percent":0}'::jsonb,
               $4, $5, $6, $7)
       RETURNING id, workspace_id, teacher_id, request_fingerprint, status, progress,
                 source_text, objective, subject, grade_level, lesson_version_id,
                 error_message, bullmq_job_id, created_at, updated_at, cancelled_at`,
      [
        input.workspaceId,
        input.teacherId,
        fingerprint,
        input.sourceText,
        input.objective,
        input.subject,
        input.gradeLevel ?? null,
      ]
    );
  } catch (error: any) {
    // Unique partial index on active fingerprints: concurrent enqueue lost the
    // SELECT race — return the winner instead of 500ing.
    if (error?.code === "23505") {
      const raced = await pool.query(
        `SELECT id, workspace_id, teacher_id, request_fingerprint, status, progress,
                source_text, objective, subject, grade_level, lesson_version_id,
                error_message, bullmq_job_id, created_at, updated_at, cancelled_at
           FROM study_arena_compiler_jobs
          WHERE workspace_id = $1 AND request_fingerprint = $2
            AND status IN ('queued', 'running')
          LIMIT 1`,
        [input.workspaceId, fingerprint]
      );
      if (raced.rows[0]) {
        return { status: raced.rows[0].status, job: mapRow(raced.rows[0]), deduped: true };
      }
    }
    throw error;
  }
  const job = mapRow(inserted.rows[0]);

  if (lessonCompileQueue) {
    try {
      const bullJob = await lessonCompileQueue.add(
        "compile",
        { compilerJobId: job.id },
        { jobId: job.id }
      );
      await pool.query(
        `UPDATE study_arena_compiler_jobs SET bullmq_job_id = $2, updated_at = now() WHERE id = $1`,
        [job.id, String(bullJob.id)]
      );
      const refreshed = await fetchJob(job.id);
      return { status: "queued", job: refreshed ?? job, deduped: false };
    } catch (error: any) {
      logger.warn("[StudyArena/compiler] BullMQ enqueue failed — sync fallback", {
        error: String(error),
        jobId: job.id,
      });
    }
  }

  // Sync fallback (Redis off or enqueue failed).
  try {
    await runCompile(job.id);
    const refreshed = await fetchJob(job.id);
    if (!refreshed) return { status: "error", message: "Compile job disappeared" };
    if (refreshed.status === "failed") {
      return { status: "error", message: refreshed.errorMessage ?? "Compile failed" };
    }
    return { status: refreshed.status === "completed" ? "completed" : "queued", job: refreshed, deduped: false };
  } catch (error: any) {
    return { status: "error", message: error?.message || "Compile failed" };
  }
}

export async function cancelCompilerJob(
  id: string,
  opts: { workspaceId: number; teacherId: number }
): Promise<"cancelled" | "not_found" | "forbidden" | "not_cancellable" | "database_unavailable"> {
  if (!isPgReady()) return "database_unavailable";
  const job = await fetchJob(id);
  if (!job) return "not_found";
  if (job.workspaceId !== opts.workspaceId) return "forbidden";
  if (job.teacherId !== opts.teacherId) return "forbidden";
  if (job.status !== "queued" && job.status !== "running") return "not_cancellable";

  const cancelled = await markJobCancelled(id);
  if (!cancelled) return "not_cancellable";

  if (job.bullmqJobId && lessonCompileQueue) {
    try {
      const bullJob = await lessonCompileQueue.getJob(job.bullmqJobId);
      if (bullJob) await bullJob.remove();
    } catch {
      /* best-effort */
    }
  }
  return "cancelled";
}

/** Re-queue a failed/cancelled job with the same inputs (new row + fingerprint). */
export async function retryCompilerJob(
  id: string,
  opts: { workspaceId: number; teacherId: number }
): Promise<EnqueueCompileResult | { status: "not_found" | "forbidden" | "not_retryable" }> {
  if (!isPgReady()) return { status: "database_unavailable" };
  const job = await fetchJob(id);
  if (!job) return { status: "not_found" };
  if (job.workspaceId !== opts.workspaceId || job.teacherId !== opts.teacherId) {
    return { status: "forbidden" };
  }
  if (job.status !== "failed" && job.status !== "cancelled") {
    return { status: "not_retryable" };
  }
  return enqueueLessonCompile({
    workspaceId: job.workspaceId,
    teacherId: job.teacherId,
    sourceText: job.sourceText,
    objective: job.objective,
    subject: job.subject,
    gradeLevel: job.gradeLevel,
  });
}
