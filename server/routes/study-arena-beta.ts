/**
 * Study Arena (Beta) — attempt-first interactive lessons.
 *
 * Phase 1 of the "inspired by OpenMAIC" rebuild. Isolated behind a feature flag
 * so it sits alongside the existing /api/ai-classroom path without disturbing it.
 * See docs/study-arena-inspired-by-openmaic.md.
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { authenticateToken } from "../middleware";
import { checkAIQuota } from "../middleware/aiQuota";
import { pgIncrementAIUsage } from "../lib/db/pg-queries";
import {
  createLinearEquationsDelayedCheck,
  createLinearEquationsSprint,
  gradeLinearEquationsAssessment,
  generateLessonScript,
  ensureScriptA11y,
  lessonScriptSchema,
  requiredAssessmentForTemplate,
  scienceTemplateSchema,
  subjectForTemplate,
  subjectTemplateSchema,
  respondToInteraction,
} from "../services/study-arena/lesson-script";
import { getPgPool, isPgReady } from "../db-pg";
import { getStudyArenaConcept } from "../services/study-arena/concept-registry";
import { commitLearnerUpdate, getLearnerSnapshot } from "../lib/ai/learner-model";
import { logger } from "../lib/logger";
import {
  checkAssignedAction,
  getAssignedNextSegment,
  issueAssignedAssessment,
  openAssignmentAttemptSession,
  openPreviewSession,
  recordAssignedEvidence,
  submitAssignedAssessment,
} from "../services/study-arena/assignment-sessions";
import {
  cancelCompilerJob,
  enqueueLessonCompile,
  getCompilerJob,
  retryCompilerJob,
} from "../services/study-arena/lesson-compiler";

const router = Router();

function configuredCost(name: string): number | null {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    logger.error("[study-arena-beta] invalid configured AI cost", { name });
    return null;
  }
  return value;
}

/** Feature flag — default ON in dev, gated by env in prod. */
export function isStudyArenaBetaEnabled(): boolean {
  return process.env.STUDY_ARENA_BETA !== "false" && process.env.NODE_ENV !== "production"
    ? true
    : process.env.STUDY_ARENA_BETA === "true";
}

function requireFlag(_req: Request, res: Response, next: () => void) {
  if (!isStudyArenaBetaEnabled()) {
    return res.status(404).json({ message: "Study Arena beta is not enabled" });
  }
  next();
}

router.get("/health", (_req, res) => {
  res.json({ enabled: isStudyArenaBetaEnabled(), service: "study-arena-beta" });
});

const assignmentSessionSchema = z.object({
  assignmentId: z.string().uuid(),
});
const nextSegmentSchema = z.object({
  attemptSessionId: z.string().uuid(),
});
const createAssignedLessonSchema = z.object({
  subject: z.string().min(1).max(120),
  gradeLevel: z.string().max(80).optional(),
  objective: z.string().min(1).max(500),
  script: lessonScriptSchema,
  studentIds: z.array(z.number().int().positive()).min(1).max(200),
  dueAt: z.string().datetime().optional(),
  /** General cross-subject template contract. */
  subjectTemplate: subjectTemplateSchema.optional(),
  /** @deprecated: accepted only for previously authored Science callers. */
  scienceTemplate: scienceTemplateSchema.optional(),
}).superRefine((value, ctx) => {
  if (value.subjectTemplate && value.scienceTemplate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Provide only one subject template", path: ["subjectTemplate"] });
  }
});
const interventionSchema = z.object({
  cohortKey: z.enum(["failed_transfer", "high_help", "prerequisite_gap", "recall_overdue"]),
  studentId: z.number().int().positive().optional(),
  actionNote: z.string().min(1).max(1000),
});

const APPROVAL_KINDS = ["objective", "source", "assessment"] as const;
type ApprovalKind = (typeof APPROVAL_KINDS)[number];

const lessonDraftSchema = z
  .object({
    subject: z.string().min(1).max(120),
    gradeLevel: z.string().max(80).optional(),
    objective: z.string().min(1).max(500),
    script: lessonScriptSchema.optional(),
    compilerJobId: z.string().uuid().optional(),
    subjectTemplate: subjectTemplateSchema.optional(),
    scienceTemplate: scienceTemplateSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.script && !value.compilerJobId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide a script or a completed compilerJobId",
        path: ["script"],
      });
    }
    if (value.subjectTemplate && value.scienceTemplate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide only one subject template",
        path: ["subjectTemplate"],
      });
    }
  });

const approvalSchema = z.object({
  kind: z.enum(APPROVAL_KINDS),
});

const publishLessonSchema = z.object({
  studentIds: z.array(z.number().int().positive()).min(1).max(200),
  dueAt: z.string().datetime().optional(),
});

const compileEnqueueSchema = z.object({
  sourceText: z.string().min(1).max(50_000),
  objective: z.string().min(1).max(500),
  subject: z.string().min(1).max(120),
  gradeLevel: z.string().max(80).optional(),
});

function requireTeacher(req: Request, res: Response): number | null {
  if (req.user?.role !== "teacher" && req.user?.role !== "admin") {
    res.status(403).json({ message: "Only teachers can perform this action" });
    return null;
  }
  return (req.user?.id || req.session?.userId) as number;
}

/** Students for real assignments; teachers/admins for preview sessions they own. */
function canUseAttemptSession(req: Request): boolean {
  const role = req.user?.role;
  return role === "student" || role === "teacher" || role === "admin";
}

function approvalsComplete(approvals: unknown): boolean {
  if (!approvals || typeof approvals !== "object") return false;
  const record = approvals as Record<string, unknown>;
  return APPROVAL_KINDS.every((kind) => {
    const entry = record[kind];
    return Boolean(entry && typeof entry === "object" && (entry as { at?: unknown }).at);
  });
}

/** Teacher-owned authoring: creates one immutable lesson version and assignment. */
/** @deprecated Prefer draft → approve → publish. Kept for backward compatibility. */
router.post(
  "/assignments",
  requireFlag,
  authenticateToken,
  async (req: Request, res: Response) => {
    const parsed = createAssignedLessonSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
    if (req.user?.role !== "teacher" && req.user?.role !== "admin") {
      return res.status(403).json({ message: "Only teachers can assign Study Arena lessons" });
    }
    const workspaceId = (req as any).workspace?.id as number | undefined;
    const teacherId = (req.user?.id || req.session?.userId) as number;
    if (!workspaceId) return res.status(409).json({ message: "No active workspace" });
    if (!isPgReady()) return res.status(503).json({ message: "Assignments are temporarily unavailable" });
    const template = parsed.data.subjectTemplate ?? parsed.data.scienceTemplate;
    if (template && parsed.data.subject.trim().toLowerCase() !== subjectForTemplate(template)) {
      return res.status(400).json({ message: `${template.templateId} requires ${subjectForTemplate(template)} as the subject` });
    }
    if (template) {
      const assessmentIds = parsed.data.script.scenes
        .flatMap((scene) => scene.actions)
        .filter((action) => action.type === "assessment")
        .map((action) => action.assessmentId);
      if (!assessmentIds.includes(requiredAssessmentForTemplate(template))) {
        return res.status(400).json({ message: "This subject template requires its verified transfer check" });
      }
    }
    const primaryConceptId = parsed.data.script.primaryConceptId ?? parsed.data.script.conceptIds[0];
    if (!primaryConceptId || !getStudyArenaConcept(primaryConceptId)) {
      return res.status(400).json({ message: "An assigned lesson requires a supported primary concept" });
    }
    const client = await getPgPool().connect();
    try {
      await client.query("BEGIN");
      const enrolled = await client.query<{ user_id: number }>(
        `SELECT m.user_id FROM workspace_memberships m
           JOIN users u ON u.id = m.user_id
          WHERE m.workspace_id = $1 AND m.status = 'active' AND m.user_id = ANY($2::bigint[])
            AND u.role = 'student'`,
        [workspaceId, parsed.data.studentIds]
      );
      if (enrolled.rows.length !== parsed.data.studentIds.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Every student must be an active workspace member" });
      }
      const version = await client.query<{ id: string }>(
        `INSERT INTO study_arena_lesson_versions
           (workspace_id, created_by, status, subject, grade_level, objective, script, evaluator_version, template_id, template_config, primary_concept_id, published_at)
         VALUES ($1, $2, 'published', $3, $4, $5, $6, $7, $8, $9, $10, now()) RETURNING id`,
        [
          workspaceId, teacherId, parsed.data.subject, parsed.data.gradeLevel ?? null, parsed.data.objective,
          JSON.stringify(parsed.data.script), template?.evaluatorVersion ?? "v1", template?.templateId ?? null,
          JSON.stringify(template && "evaluationTargets" in template ? template.evaluationTargets : {}), primaryConceptId,
        ]
      );
      if (template) {
        for (const source of template.sourceSpans) {
          await client.query(
            `INSERT INTO study_arena_source_spans
               (lesson_version_id, objective, source_label, source_locator, excerpt)
             VALUES ($1, $2, $3, $4, $5)`,
            [version.rows[0].id, parsed.data.objective, source.sourceLabel, source.sourceLocator ?? null, source.excerpt]
          );
        }
      }
      const assignment = await client.query<{ id: string }>(
        `INSERT INTO study_arena_assignments
           (workspace_id, lesson_version_id, created_by, status, due_at)
         VALUES ($1, $2, $3, 'published', $4) RETURNING id`,
        [workspaceId, version.rows[0].id, teacherId, parsed.data.dueAt ? new Date(parsed.data.dueAt) : null]
      );
      await client.query(
        `INSERT INTO study_arena_assignment_enrollments (assignment_id, student_id)
         SELECT $1, unnest($2::bigint[])`,
        [assignment.rows[0].id, parsed.data.studentIds]
      );
      await client.query("COMMIT");
      return res.status(201).json({ assignmentId: assignment.rows[0].id, lessonVersionId: version.rows[0].id });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      logger.error("[study-arena-beta] assignment creation failed", { error: String(error), workspaceId, teacherId });
      return res.status(500).json({ message: "Could not create assignment" });
    } finally {
      client.release();
    }
  }
);

/** Create a draft lesson version from a pasted script or a completed compiler job. Does not assign. */
router.post("/lesson-drafts", requireFlag, authenticateToken, async (req: Request, res: Response) => {
  const teacherId = requireTeacher(req, res);
  if (teacherId === null) return;
  const parsed = lessonDraftSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
  const workspaceId = (req as any).workspace?.id as number | undefined;
  if (!workspaceId) return res.status(409).json({ message: "No active workspace" });
  if (!isPgReady()) return res.status(503).json({ message: "Drafts are temporarily unavailable" });

  const template = parsed.data.subjectTemplate ?? parsed.data.scienceTemplate;
  let script = parsed.data.script;
  let linkedJobId: string | null = null;

  if (parsed.data.compilerJobId) {
    const job = await getCompilerJob(parsed.data.compilerJobId);
    if (!job || job.workspaceId !== workspaceId) {
      return res.status(404).json({ message: "Compiler job not found" });
    }
    if (job.teacherId !== teacherId) return res.status(403).json({ message: "Not your compiler job" });
    if (job.status !== "completed" || !job.lessonVersionId) {
      return res.status(409).json({ message: "Compiler job is not completed" });
    }
    // Reuse the draft the compiler already created.
    return res.status(200).json({ lessonVersionId: job.lessonVersionId, compilerJobId: job.id, reused: true });
  }

  if (!script) return res.status(400).json({ message: "Script is required" });
  script = ensureScriptA11y(script);
  if (template && parsed.data.subject.trim().toLowerCase() !== subjectForTemplate(template)) {
    return res.status(400).json({ message: `${template.templateId} requires ${subjectForTemplate(template)} as the subject` });
  }
  const primaryConceptId = script.primaryConceptId ?? script.conceptIds[0];
  if (!primaryConceptId || !getStudyArenaConcept(primaryConceptId)) {
    return res.status(400).json({ message: "A draft lesson requires a supported primary concept" });
  }

  try {
    const client = await getPgPool().connect();
    try {
      await client.query("BEGIN");
      const version = await client.query<{ id: string }>(
        `INSERT INTO study_arena_lesson_versions
           (workspace_id, created_by, status, subject, grade_level, objective, script,
            evaluator_version, template_id, template_config, primary_concept_id, approvals)
         VALUES ($1, $2, 'draft', $3, $4, $5, $6, $7, $8, $9, $10, '{}'::jsonb)
         RETURNING id`,
        [
          workspaceId,
          teacherId,
          parsed.data.subject,
          parsed.data.gradeLevel ?? null,
          parsed.data.objective,
          JSON.stringify(script),
          template?.evaluatorVersion ?? "v1",
          template?.templateId ?? null,
          JSON.stringify(template && "evaluationTargets" in template ? template.evaluationTargets : {}),
          primaryConceptId,
        ]
      );
      if (template) {
        for (const source of template.sourceSpans) {
          await client.query(
            `INSERT INTO study_arena_source_spans
               (lesson_version_id, objective, source_label, source_locator, excerpt)
             VALUES ($1, $2, $3, $4, $5)`,
            [version.rows[0].id, parsed.data.objective, source.sourceLabel, source.sourceLocator ?? null, source.excerpt]
          );
        }
      }
      await client.query("COMMIT");
      return res.status(201).json({ lessonVersionId: version.rows[0].id, compilerJobId: linkedJobId });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error("[study-arena-beta] lesson draft creation failed", { error: String(error), workspaceId, teacherId });
    return res.status(500).json({ message: "Could not create lesson draft" });
  }
});

/** Record one of the three required creation approvals (objective / source / assessment). */
router.post(
  "/lesson-versions/:id/approvals",
  requireFlag,
  authenticateToken,
  async (req: Request, res: Response) => {
    const teacherId = requireTeacher(req, res);
    if (teacherId === null) return;
    const lessonVersionId = z.string().uuid().safeParse(req.params.id);
    const body = approvalSchema.safeParse(req.body);
    if (!lessonVersionId.success || !body.success) {
      return res.status(400).json({ message: "Invalid approval request" });
    }
    const workspaceId = (req as any).workspace?.id as number | undefined;
    if (!workspaceId) return res.status(409).json({ message: "No active workspace" });
    if (!isPgReady()) return res.status(503).json({ message: "Approvals are temporarily unavailable" });

    const client = await getPgPool().connect();
    try {
      // Row lock prevents concurrent approval kinds from clobbering each other
      // via read-modify-write on the approvals jsonb blob.
      await client.query("BEGIN");
      const existing = await client.query<{
        id: string;
        workspace_id: number;
        created_by: number;
        status: string;
        approvals: Record<string, unknown>;
      }>(
        `SELECT id, workspace_id, created_by, status, approvals
           FROM study_arena_lesson_versions WHERE id = $1 FOR UPDATE`,
        [lessonVersionId.data]
      );
      const version = existing.rows[0];
      if (!version || Number(version.workspace_id) !== workspaceId) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Lesson version not found" });
      }
      if (Number(version.created_by) !== teacherId && req.user?.role !== "admin") {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Only the lesson owner can record approvals" });
      }
      if (version.status !== "draft") {
        await client.query("ROLLBACK");
        return res.status(409).json({ message: "Only draft lessons accept approvals" });
      }

      const kind = body.data.kind as ApprovalKind;
      const nextApprovals = {
        ...(version.approvals && typeof version.approvals === "object" ? version.approvals : {}),
        [kind]: { at: new Date().toISOString(), by: teacherId },
      };
      await client.query(
        `UPDATE study_arena_lesson_versions SET approvals = $2::jsonb WHERE id = $1`,
        [lessonVersionId.data, JSON.stringify(nextApprovals)]
      );
      await client.query("COMMIT");
      return res.json({
        lessonVersionId: lessonVersionId.data,
        approvals: nextApprovals,
        complete: approvalsComplete(nextApprovals),
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      logger.error("[study-arena-beta] approval failed", { error: String(error) });
      return res.status(500).json({ message: "Could not record approval" });
    } finally {
      client.release();
    }
  }
);

/**
 * Publish a draft lesson as an assignment. Requires objective + source + assessment
 * approvals. Creates enrollments the same way as POST /assignments.
 */
router.post(
  "/lesson-versions/:id/publish",
  requireFlag,
  authenticateToken,
  async (req: Request, res: Response) => {
    const teacherId = requireTeacher(req, res);
    if (teacherId === null) return;
    const lessonVersionId = z.string().uuid().safeParse(req.params.id);
    const body = publishLessonSchema.safeParse(req.body);
    if (!lessonVersionId.success || !body.success) {
      return res.status(400).json({ message: "Invalid publish request" });
    }
    const workspaceId = (req as any).workspace?.id as number | undefined;
    if (!workspaceId) return res.status(409).json({ message: "No active workspace" });
    if (!isPgReady()) return res.status(503).json({ message: "Publish is temporarily unavailable" });

    const client = await getPgPool().connect();
    try {
      await client.query("BEGIN");
      const versionResult = await client.query<{
        id: string;
        workspace_id: number;
        created_by: number;
        status: string;
        approvals: unknown;
      }>(
        `SELECT id, workspace_id, created_by, status, approvals
           FROM study_arena_lesson_versions WHERE id = $1 FOR UPDATE`,
        [lessonVersionId.data]
      );
      const version = versionResult.rows[0];
      if (!version || Number(version.workspace_id) !== workspaceId) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Lesson version not found" });
      }
      if (Number(version.created_by) !== teacherId && req.user?.role !== "admin") {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "Only the lesson owner can publish" });
      }
      if (version.status !== "draft") {
        await client.query("ROLLBACK");
        return res.status(409).json({ message: "Only draft lessons can be published" });
      }
      if (!approvalsComplete(version.approvals)) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          message: "Publication blocked: objective, source, and assessment approvals are required",
          approvals: version.approvals,
        });
      }

      const enrolled = await client.query<{ user_id: number }>(
        `SELECT m.user_id FROM workspace_memberships m
           JOIN users u ON u.id = m.user_id
          WHERE m.workspace_id = $1 AND m.status = 'active' AND m.user_id = ANY($2::bigint[])
            AND u.role = 'student'`,
        [workspaceId, body.data.studentIds]
      );
      if (enrolled.rows.length !== body.data.studentIds.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Every student must be an active workspace member" });
      }

      await client.query(
        `UPDATE study_arena_lesson_versions
            SET status = 'published', published_at = now()
          WHERE id = $1`,
        [lessonVersionId.data]
      );
      const assignment = await client.query<{ id: string }>(
        `INSERT INTO study_arena_assignments
           (workspace_id, lesson_version_id, created_by, status, due_at)
         VALUES ($1, $2, $3, 'published', $4) RETURNING id`,
        [
          workspaceId,
          lessonVersionId.data,
          teacherId,
          body.data.dueAt ? new Date(body.data.dueAt) : null,
        ]
      );
      await client.query(
        `INSERT INTO study_arena_assignment_enrollments (assignment_id, student_id)
         SELECT $1, unnest($2::bigint[])`,
        [assignment.rows[0].id, body.data.studentIds]
      );
      await client.query("COMMIT");
      return res.status(201).json({
        assignmentId: assignment.rows[0].id,
        lessonVersionId: lessonVersionId.data,
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      logger.error("[study-arena-beta] publish failed", { error: String(error) });
      return res.status(500).json({ message: "Could not publish lesson" });
    } finally {
      client.release();
    }
  }
);

/** Teacher preview session — never contaminates learner evidence (is_preview=true). */
router.post(
  "/lesson-versions/:id/preview-session",
  requireFlag,
  authenticateToken,
  async (req: Request, res: Response) => {
    const teacherId = requireTeacher(req, res);
    if (teacherId === null) return;
    const lessonVersionId = z.string().uuid().safeParse(req.params.id);
    if (!lessonVersionId.success) return res.status(400).json({ message: "Invalid lesson version ID" });
    const workspaceId = (req as any).workspace?.id as number | undefined;
    if (!workspaceId) return res.status(409).json({ message: "No active workspace" });

    try {
      const result = await openPreviewSession({
        lessonVersionId: lessonVersionId.data,
        teacherId,
        workspaceId,
      });
      if (result.status === "not_found") return res.status(404).json({ message: "Lesson version not found" });
      if (result.status === "forbidden") return res.status(403).json({ message: "Not allowed to preview this lesson" });
      if (result.status === "database_unavailable") {
        return res.status(503).json({ message: "Preview is temporarily unavailable" });
      }
      if (result.status !== "ok") return res.status(409).json({ message: "Could not open preview" });
      return res.json({
        status: "ok",
        attemptSessionId: result.sessionId,
        assignmentId: result.assignmentId,
        lessonVersionId: result.lessonVersionId,
        nextActionIndex: result.nextActionIndex,
        isPreview: true,
      });
    } catch (error) {
      logger.error("[study-arena-beta] preview session failed", { error: String(error) });
      return res.status(500).json({ message: "Could not open preview session" });
    }
  }
);

/** Enqueue (or sync-run) a durable lesson compile job. */
router.post("/compiler/jobs", requireFlag, authenticateToken, async (req: Request, res: Response) => {
  const teacherId = requireTeacher(req, res);
  if (teacherId === null) return;
  const parsed = compileEnqueueSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
  const workspaceId = (req as any).workspace?.id as number | undefined;
  if (!workspaceId) return res.status(409).json({ message: "No active workspace" });

  const result = await enqueueLessonCompile({
    workspaceId,
    teacherId,
    sourceText: parsed.data.sourceText,
    objective: parsed.data.objective,
    subject: parsed.data.subject,
    gradeLevel: parsed.data.gradeLevel,
  });
  if (result.status === "database_unavailable") {
    return res.status(503).json({ message: "Compiler is temporarily unavailable" });
  }
  if (result.status === "error") {
    return res.status(500).json({ message: result.message });
  }
  return res.status(result.deduped ? 200 : 201).json({
    jobId: result.job.id,
    status: result.job.status,
    deduped: result.deduped,
    lessonVersionId: result.job.lessonVersionId,
    progress: result.job.progress,
  });
});

router.get("/compiler/jobs/:id", requireFlag, authenticateToken, async (req: Request, res: Response) => {
  const teacherId = requireTeacher(req, res);
  if (teacherId === null) return;
  const jobId = z.string().uuid().safeParse(req.params.id);
  if (!jobId.success) return res.status(400).json({ message: "Invalid job ID" });
  const workspaceId = (req as any).workspace?.id as number | undefined;
  if (!workspaceId) return res.status(409).json({ message: "No active workspace" });

  const job = await getCompilerJob(jobId.data);
  if (!job || job.workspaceId !== workspaceId) return res.status(404).json({ message: "Job not found" });
  if (job.teacherId !== teacherId && req.user?.role !== "admin") {
    return res.status(403).json({ message: "Not your compiler job" });
  }
  return res.json({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    lessonVersionId: job.lessonVersionId,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  });
});

router.post("/compiler/jobs/:id/cancel", requireFlag, authenticateToken, async (req: Request, res: Response) => {
  const teacherId = requireTeacher(req, res);
  if (teacherId === null) return;
  const jobId = z.string().uuid().safeParse(req.params.id);
  if (!jobId.success) return res.status(400).json({ message: "Invalid job ID" });
  const workspaceId = (req as any).workspace?.id as number | undefined;
  if (!workspaceId) return res.status(409).json({ message: "No active workspace" });

  const result = await cancelCompilerJob(jobId.data, { workspaceId, teacherId });
  if (result === "not_found") return res.status(404).json({ message: "Job not found" });
  if (result === "forbidden") return res.status(403).json({ message: "Not your compiler job" });
  if (result === "not_cancellable") return res.status(409).json({ message: "Job cannot be cancelled" });
  if (result === "database_unavailable") return res.status(503).json({ message: "Unavailable" });
  return res.json({ jobId: jobId.data, status: "cancelled" });
});

router.post("/compiler/jobs/:id/retry", requireFlag, authenticateToken, async (req: Request, res: Response) => {
  const teacherId = requireTeacher(req, res);
  if (teacherId === null) return;
  const jobId = z.string().uuid().safeParse(req.params.id);
  if (!jobId.success) return res.status(400).json({ message: "Invalid job ID" });
  const workspaceId = (req as any).workspace?.id as number | undefined;
  if (!workspaceId) return res.status(409).json({ message: "No active workspace" });

  const result = await retryCompilerJob(jobId.data, { workspaceId, teacherId });
  if (result.status === "not_found") return res.status(404).json({ message: "Job not found" });
  if (result.status === "forbidden") return res.status(403).json({ message: "Not your compiler job" });
  if (result.status === "not_retryable") return res.status(409).json({ message: "Job cannot be retried" });
  if (result.status === "database_unavailable") return res.status(503).json({ message: "Unavailable" });
  if (result.status === "error") return res.status(500).json({ message: result.message });
  if (result.status !== "queued" && result.status !== "running" && result.status !== "completed") {
    return res.status(500).json({ message: "Unexpected compiler retry result" });
  }
  return res.status(201).json({
    jobId: result.job.id,
    status: result.job.status,
    lessonVersionId: result.job.lessonVersionId,
    deduped: result.deduped,
  });
});

/** Teacher-only view of assignment progress and independent assessment evidence. */
router.get(
  "/assignments/:assignmentId/report",
  requireFlag,
  authenticateToken,
  async (req: Request, res: Response) => {
    if (req.user?.role !== "teacher" && req.user?.role !== "admin") {
      return res.status(403).json({ message: "Only teachers can view assignment reports" });
    }
    const assignmentId = z.string().uuid().safeParse(req.params.assignmentId);
    if (!assignmentId.success) return res.status(400).json({ message: "Invalid assignment ID" });
    const workspaceId = (req as any).workspace?.id as number | undefined;
    if (!workspaceId) return res.status(409).json({ message: "No active workspace" });
    if (!isPgReady()) return res.status(503).json({ message: "Reports are temporarily unavailable" });
    try {
      const report = await getPgPool().query<{
        student_id: number;
        student_name: string | null;
        session_status: string | null;
        next_action_index: number | null;
        assessment_correct: boolean | null;
        assessment_submitted_at: Date | null;
        help_depth: number;
        current_scene_id: string | null;
        adaptive_path: string[];
        adaptive_decision: Record<string, unknown> | null;
        adaptive_decision_version: number | null;
        adaptive_rationale: string | null;
      }>(
        `SELECT e.student_id, COALESCE(u.display_name, u.name, u.username) AS student_name,
                s.status AS session_status, s.next_action_index, s.current_scene_id,
                COALESCE(s.branch_path, '[]'::jsonb) AS adaptive_path,
                CASE WHEN s.director_decision_version > 0 THEN s.director_decision ELSE NULL END AS adaptive_decision,
                CASE WHEN s.director_decision_version > 0 THEN s.director_decision_version ELSE NULL END AS adaptive_decision_version,
                CASE WHEN s.director_decision_version > 0 THEN s.director_decision->>'rationale' ELSE NULL END AS adaptive_rationale,
                assessment.correct AS assessment_correct, assessment.submitted_at AS assessment_submitted_at,
                COALESCE((SELECT count(*) FROM study_arena_evidence_events evidence
                  WHERE evidence.attempt_session_id = s.id AND evidence.event_kind IN ('attempt', 'hint')), 0)::int AS help_depth
           FROM study_arena_assignments a
           JOIN study_arena_assignment_enrollments e ON e.assignment_id = a.id
           JOIN users u ON u.id = e.student_id
           LEFT JOIN study_arena_attempt_sessions s
             ON s.assignment_id = a.id AND s.student_id = e.student_id
           LEFT JOIN LATERAL (
             SELECT assessment.submitted_at, evaluation.correct
               FROM study_arena_assessment_instances assessment
               LEFT JOIN study_arena_assessment_evaluations evaluation
                 ON evaluation.assessment_instance_id = assessment.id
              WHERE assessment.attempt_session_id = s.id AND assessment.status = 'submitted'
              ORDER BY assessment.submitted_at DESC
              LIMIT 1
           ) assessment ON true
          WHERE a.id = $1 AND a.workspace_id = $2
          ORDER BY student_name NULLS LAST, e.student_id`,
        [assignmentId.data, workspaceId]
      );
      if (!report.rows.length) {
        const exists = await getPgPool().query(
          `SELECT 1 FROM study_arena_assignments WHERE id = $1 AND workspace_id = $2`,
          [assignmentId.data, workspaceId]
        );
        if (!exists.rows[0]) return res.status(404).json({ message: "Assignment not found" });
      }
      const completed = report.rows.filter((row) => row.assessment_submitted_at !== null);
      const groups = [
        { key: "failed_transfer", label: "Failed independent transfer", studentIds: completed.filter((row) => row.assessment_correct === false).map((row) => row.student_id), suggestedAction: "Review the misconception and assign supported practice." },
        { key: "high_help", label: "High help depth", studentIds: report.rows.filter((row) => row.help_depth >= 3).map((row) => row.student_id), suggestedAction: "Check prerequisite understanding in a small group." },
      ].filter((group) => group.studentIds.length > 0);
      return res.json({
        assignmentId: assignmentId.data,
        enrolled: report.rows.length,
        started: report.rows.filter((row) => row.session_status !== null).length,
        independentlyAssessed: completed.length,
        correct: completed.filter((row) => row.assessment_correct === true).length,
        students: report.rows,
        groups,
      });
    } catch (error) {
      logger.error("[study-arena-beta] assignment report failed", { error: String(error), assignmentId: assignmentId.data });
      return res.status(500).json({ message: "Could not load assignment report" });
    }
  }
);

router.post("/assignments/:assignmentId/interventions", requireFlag, authenticateToken, async (req, res) => {
  if (req.user?.role !== "teacher" && req.user?.role !== "admin") return res.status(403).json({ message: "Only teachers can record follow-up" });
  const assignmentId = z.string().uuid().safeParse(req.params.assignmentId);
  const body = interventionSchema.safeParse(req.body);
  const workspaceId = (req as any).workspace?.id;
  if (!assignmentId.success || !body.success) return res.status(400).json({ message: "Invalid intervention" });
  if (!workspaceId || !isPgReady()) return res.status(503).json({ message: "Interventions are temporarily unavailable" });
  const teacherId = (req.user?.id || req.session?.userId) as number;
  const inserted = await getPgPool().query(
    `INSERT INTO study_arena_intervention_actions (assignment_id, student_id, teacher_id, cohort_key, action_note)
     SELECT $1, $2, $3, $4, $5 WHERE EXISTS (SELECT 1 FROM study_arena_assignments WHERE id = $1 AND workspace_id = $6)
     RETURNING id`,
    [assignmentId.data, body.data.studentId ?? null, teacherId, body.data.cohortKey, body.data.actionNote, workspaceId]
  );
  if (!inserted.rows[0]) return res.status(404).json({ message: "Assignment not found" });
  return res.status(201).json({ interventionId: inserted.rows[0].id });
});

/**
 * Creates or resumes the single server-owned session for an assigned student.
 * This is intentionally separate from the legacy self-serve generation path:
 * a client-provided lesson id is never accepted as evidence of enrollment.
 */
router.post(
  "/assignment-session",
  requireFlag,
  authenticateToken,
  async (req: Request, res: Response) => {
    const parsed = assignmentSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
    }
    if (req.user?.role !== "student") {
      return res.status(403).json({ message: "Only assigned students can start a lesson" });
    }

    const studentId = (req.user?.id || req.session?.userId) as number;
    try {
      const session = await openAssignmentAttemptSession(parsed.data.assignmentId, studentId);
      if (session.status === "not_found") {
        return res.status(404).json({ message: "Assignment not found" });
      }
      if (session.status === "forbidden") {
        return res.status(403).json({ message: "You are not assigned to this lesson" });
      }
      if (session.status === "unavailable") {
        return res.status(409).json({ message: "This assignment is not currently available" });
      }
      if (session.status === "database_unavailable") {
        return res.status(503).json({ message: "Lesson sessions are temporarily unavailable" });
      }
      return res.json(session);
    } catch (error) {
      logger.error("[study-arena-beta] assignment session failed", {
        error: String(error),
        assignmentId: parsed.data.assignmentId,
        studentId,
      });
      return res.status(500).json({ message: "Could not start lesson session" });
    }
  }
);

/**
 * The assigned player never receives a future route or full immutable script.
 * A retry returns the same persisted director decision and segment.
 */
router.post(
  "/assignment-next-segment",
  requireFlag,
  authenticateToken,
  async (req: Request, res: Response) => {
    const parsed = nextSegmentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
    if (!canUseAttemptSession(req)) {
      return res.status(403).json({ message: "Only assigned students or previewing teachers can load a lesson segment" });
    }
    try {
      const segment = await getAssignedNextSegment({
        attemptSessionId: parsed.data.attemptSessionId,
        studentId: (req.user?.id || req.session?.userId) as number,
      });
      if (segment.status === "forbidden") {
        return res.status(403).json({ message: "You are not assigned to this lesson session" });
      }
      if (segment.status === "inactive" || segment.status === "unavailable") {
        return res.status(409).json({ message: "This lesson segment is not currently available" });
      }
      if (segment.status === "database_unavailable") {
        return res.status(503).json({ message: "Lesson segments are temporarily unavailable" });
      }
      return res.json(segment);
    } catch (error) {
      logger.error("[study-arena-beta] next segment failed", { error: String(error) });
      return res.status(500).json({ message: "Could not load lesson segment" });
    }
  }
);

const generateSchema = z.object({
  topic: z.string().min(1).max(300),
  lessonId: z.string().uuid().optional(),
  language: z.string().max(40).optional(),
  sceneCount: z.number().int().min(2).max(8).optional(),
});

router.post(
  "/lesson-script",
  requireFlag,
  authenticateToken,
  await checkAIQuota("ai_tutor"),
  async (req: Request, res: Response) => {
    const parsed = generateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
    }
    try {
      const script = await generateLessonScript(parsed.data.topic, {
        language: parsed.data.language,
        sceneCount: parsed.data.sceneCount,
      });

      const userId = (req.user?.id || req.session?.userId) as number;
      const usageRecorded = await pgIncrementAIUsage({
        userId,
        workspaceId: (req as any).workspace?.id,
        feature: "ai_tutor",
        metadata: {
          type: "study_arena_lesson",
          lessonId: parsed.data.lessonId ?? null,
          scenes: script.scenes.length,
          estimatedCostInr: configuredCost("STUDY_ARENA_GENERATION_COST_INR"),
        },
      });
      if (!usageRecorded) {
        logger.error("[study-arena-beta] generation usage was not recorded", {
          userId,
          lessonId: parsed.data.lessonId,
        });
      }

      res.json(script);
    } catch (error) {
      logger.error("[study-arena-beta] lesson generation failed", { error: String(error) });
      res.status(500).json({ message: "Failed to generate lesson" });
    }
  }
);

// ── Linear-equations mastery sprint ──────────────────────────────────────────
// This is intentionally deterministic: the pilot needs a fixed teaching and
// transfer sequence before we can make claims about learning gains.
const sprintSchema = z.object({
  phase: z.enum(["immediate", "delayed"]).default("immediate"),
});

router.post(
  "/linear-equations-sprint",
  requireFlag,
  authenticateToken,
  async (req: Request, res: Response) => {
    const parsed = sprintSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
    }
    if (parsed.data.phase === "delayed" && req.user?.role === "student") {
      const userId = (req.user?.id || req.session?.userId) as number;
      const snapshot = await getLearnerSnapshot(userId);
      const isDue = snapshot.dueReviews.some((review) => review.concept === "linear-equations-isolation");
      if (!isDue) {
        return res.status(409).json({ message: "Your independent recall check is not due yet." });
      }
    }
    return res.json(
      parsed.data.phase === "delayed"
        ? createLinearEquationsDelayedCheck()
        : createLinearEquationsSprint()
    );
  }
);

const assessmentSchema = z.object({
  assessmentId: z.enum(["linear-equations-immediate", "linear-equations-delayed"]),
  answer: z.string().min(1).max(200),
  lessonId: z.string().uuid().optional(),
});

const assignedAssessmentIssueSchema = z.object({
  attemptSessionId: z.string().uuid(),
  actionIndex: z.number().int().min(0).max(64),
});
const assignedAssessmentSubmitSchema = z.object({
  attemptSessionId: z.string().uuid(),
  assessmentInstanceId: z.string().uuid(),
  actionNonce: z.string().uuid(),
  answer: z.string().min(1).max(200),
  idempotencyKey: z.string().uuid(),
});

router.post(
  "/assignment-assessment-instance",
  requireFlag,
  authenticateToken,
  async (req: Request, res: Response) => {
    const parsed = assignedAssessmentIssueSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
    }
    if (!canUseAttemptSession(req)) {
      return res.status(403).json({ message: "Only assigned students or previewing teachers can start an assessment" });
    }

    try {
      const issued = await issueAssignedAssessment({
        attemptSessionId: parsed.data.attemptSessionId,
        studentId: (req.user?.id || req.session?.userId) as number,
        actionIndex: parsed.data.actionIndex,
      });
      if (issued.status === "forbidden") {
        return res.status(403).json({ message: "You are not assigned to this lesson session" });
      }
      if (issued.status === "inactive" || issued.status === "out_of_sequence" || issued.status === "unavailable") {
        return res.status(409).json({ message: "This assessment is not currently available" });
      }
      if (issued.status === "database_unavailable") {
        return res.status(503).json({ message: "Assessments are temporarily unavailable" });
      }
      return res.json(issued);
    } catch (error) {
      logger.error("[study-arena-beta] assessment issue failed", { error: String(error) });
      return res.status(500).json({ message: "Could not start assessment" });
    }
  }
);

router.post(
  "/assessment",
  requireFlag,
  authenticateToken,
  async (req: Request, res: Response) => {
    const parsed = assessmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
    }

    const correct = gradeLinearEquationsAssessment(
      parsed.data.assessmentId,
      parsed.data.answer
    );
    const userId = (req.user?.id || req.session?.userId) as number;

    // The first transfer check is followed by a 72-hour no-AI recall check.
    // The second one updates the same concept but leaves later scheduling to
    // the existing spaced-repetition loop.
    if (req.user?.role === "student") {
      try {
        if (parsed.data.assessmentId === "linear-equations-delayed") {
          const snapshot = await getLearnerSnapshot(userId);
          const isDue = snapshot.dueReviews.some(
            (review) => review.concept === "linear-equations-isolation"
          );
          if (!isDue) {
            return res.status(409).json({ message: "Your independent recall check is not due yet." });
          }
        }
        const dueAt =
          parsed.data.assessmentId === "linear-equations-immediate"
            ? new Date(Date.now() + 72 * 60 * 60 * 1000)
            : new Date(Date.now() + (correct ? 6 : 1) * 24 * 60 * 60 * 1000);
        const committed = await commitLearnerUpdate(userId, {
          masteryDeltas: [
            {
              concept: "linear-equations-isolation",
              subject: "Mathematics",
              pMastery: correct ? 0.65 : 0.25,
              confidence: 0.35,
            },
          ],
          reviewUpdates: [
            {
              concept: "linear-equations-isolation",
              sm2Ef: 2.5,
              intervalDays: Math.max(
                1,
                Math.round((dueAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
              ),
              repetitions: correct ? 1 : 0,
              dueAt,
            },
          ],
          interaction: {
            kind: "linear_equations_transfer_check",
            concept: "linear-equations-isolation",
            payload: {
              assessmentId: parsed.data.assessmentId,
              lessonId: parsed.data.lessonId ?? null,
              correct,
            },
          },
        });
        if (!committed) {
          logger.error("[study-arena-beta] assessment log failed (non-blocking)", {
            userId,
            assessmentId: parsed.data.assessmentId,
          });
        }
      } catch (error) {
        logger.error("[study-arena-beta] assessment log failed (non-blocking)", {
          error: String(error),
          userId,
          assessmentId: parsed.data.assessmentId,
        });
      }
    }

    res.json({
      correct,
      feedback: correct
        ? "Correct — you isolated x successfully. Your next no-AI check is scheduled in your review queue."
        : "Not quite. Revisit which operation undoes the final step, then try a fresh practice problem.",
    });
  }
);

router.post(
  "/assignment-assessment-submit",
  requireFlag,
  authenticateToken,
  async (req: Request, res: Response) => {
    const parsed = assignedAssessmentSubmitSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
    if (!canUseAttemptSession(req)) return res.status(403).json({ message: "Only assigned students or previewing teachers can submit an assessment" });
    try {
      const submitted = await submitAssignedAssessment({
        ...parsed.data,
        studentId: (req.user?.id || req.session?.userId) as number,
      });
      if (submitted.status === "forbidden") return res.status(403).json({ message: "You are not assigned to this assessment" });
      if (submitted.status === "database_unavailable") return res.status(503).json({ message: "Assessments are temporarily unavailable" });
      if (submitted.status === "inactive" || submitted.status === "invalid" || submitted.status === "expired") return res.status(409).json({ message: "This assessment submission is no longer valid" });
      return res.json(submitted);
    } catch (error) {
      logger.error("[study-arena-beta] assessment submit failed", { error: String(error) });
      return res.status(500).json({ message: "Could not submit assessment" });
    }
  }
);

const interactionSchema = z.object({
  topic: z.string().min(1).max(300),
  question: z.string().min(1).max(2000),
  answer: z.string().max(4000),
  language: z.string().max(40).optional(),
  // Grouping keys so gate answers can be rolled up into "did this student
  // complete a full gated lesson?" — the pilot's adoption signal. All optional
  // so an older client still works; the metric simply can't group its rows.
  lessonId: z.string().uuid().optional(),
  actionKey: z.string().max(40).optional(),
  gateIndex: z.number().int().min(0).max(64).optional(),
  totalGates: z.number().int().min(1).max(64).optional(),
  attempt: z.number().int().min(1).max(20).optional(),
  attemptSessionId: z.string().uuid().optional(),
  actionIndex: z.number().int().min(0).max(64).optional(),
  idempotencyKey: z.string().uuid().optional(),
}).superRefine((value, ctx) => {
  const assignedFields = [value.attemptSessionId, value.actionIndex, value.idempotencyKey];
  if (assignedFields.some((field) => field !== undefined) && assignedFields.some((field) => field === undefined)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "attemptSessionId, actionIndex, and idempotencyKey must be supplied together",
    });
  }
});

router.post(
  "/interaction",
  requireFlag,
  authenticateToken,
  await checkAIQuota("ai_tutor"),
  async (req: Request, res: Response) => {
    const parsed = interactionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
    }
    try {
      const userId = (req.user?.id || req.session?.userId) as number;
      if (parsed.data.attemptSessionId && canUseAttemptSession(req)) {
        const actionCheck = await checkAssignedAction({
          attemptSessionId: parsed.data.attemptSessionId,
          studentId: userId,
          actionIndex: parsed.data.actionIndex!,
        });
        if (actionCheck.status === "forbidden") {
          return res.status(403).json({ message: "You are not assigned to this lesson session" });
        }
        if (actionCheck.status === "inactive" || actionCheck.status === "out_of_sequence") {
          return res.status(409).json({ message: "This lesson step is no longer available. Refresh to continue." });
        }
        if (actionCheck.status === "database_unavailable") {
          return res.status(503).json({ message: "Lesson progress is temporarily unavailable" });
        }
      }

      const result = await respondToInteraction(parsed.data);

      if (parsed.data.attemptSessionId && canUseAttemptSession(req) && result.proceed) {
        const recorded = await recordAssignedEvidence({
          attemptSessionId: parsed.data.attemptSessionId,
          studentId: userId,
          actionIndex: parsed.data.actionIndex!,
          idempotencyKey: parsed.data.idempotencyKey!,
          eventKind: "attempt",
          evidence: {
            attempt: result.attempt,
            proceed: result.proceed,
            feedbackLength: result.feedback.length,
          },
        });
        if (recorded.status === "forbidden") {
          return res.status(403).json({ message: "You are not assigned to this lesson session" });
        }
        if (recorded.status === "inactive" || recorded.status === "out_of_sequence") {
          return res.status(409).json({ message: "This lesson step is no longer available. Refresh to continue." });
        }
        if (recorded.status === "database_unavailable") {
          return res.status(503).json({ message: "Lesson progress is temporarily unavailable" });
        }
      }

      if (result.proceed) {
        const usageRecorded = await pgIncrementAIUsage({
          userId,
          workspaceId: (req as any).workspace?.id,
          feature: "ai_tutor",
          metadata: {
            type: "study_arena_interaction",
            lessonId: parsed.data.lessonId ?? null,
            attempt: result.attempt,
            estimatedCostInr: configuredCost("STUDY_ARENA_INTERACTION_COST_INR"),
          },
        });
        if (!usageRecorded) {
          logger.error("[study-arena-beta] interaction usage was not recorded", {
            userId,
            lessonId: parsed.data.lessonId,
            actionKey: parsed.data.actionKey,
          });
        }

        // Record the gate answer for the adoption metric — but ONLY for real
        // students (a teacher/principal poking the beta would pollute the
        // "students completing lessons" signal), and NEVER let a logging
        // failure break the student's flow. Writes through the learner-model
        // single writer, tagged so the metric can filter cleanly.
        if (req.user?.role === "student" && parsed.data.lessonId) {
          try {
            const committed = await commitLearnerUpdate(userId, {
              interaction: {
                kind: "study_arena_gate_answer",
                concept: parsed.data.topic.slice(0, 120),
                payload: {
                  lessonId: parsed.data.lessonId,
                  actionKey: parsed.data.actionKey ?? null,
                  gateIndex: parsed.data.gateIndex ?? null,
                  totalGates: parsed.data.totalGates ?? null,
                  attempt: result.attempt,
                  answer: parsed.data.answer.trim(),
                },
              },
            });
            if (!committed) {
              logger.error("[study-arena-beta] gate-answer log failed (non-blocking)", {
                userId,
                lessonId: parsed.data.lessonId,
                reason: "commitLearnerUpdate returned false",
              });
            }
          } catch (logErr) {
            logger.error("[study-arena-beta] gate-answer log failed (non-blocking)", {
              error: String(logErr),
            });
          }
        }
      }

      res.json(result);
    } catch (error) {
      logger.error("[study-arena-beta] interaction failed", { error: String(error) });
      res.status(500).json({ message: "Failed to process answer" });
    }
  }
);

export default router;
