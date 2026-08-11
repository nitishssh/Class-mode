import { getPgPool, isPgReady } from "../../db-pg";
import { createHash, randomUUID } from "crypto";
import { lessonScriptSchema, type LessonScript } from "./lesson-script";
import { applyLearnerUpdateInTransaction } from "../../lib/ai/learner-model";
import { evaluateAssessment, type AssessmentEvaluationTargets } from "./assessment-evaluators";
import { bktUpdate, DEFAULT_BKT } from "../../lib/ai/knowledge-tracing";
import { DEFAULT_SM2, sm2Next } from "../../lib/ai/spaced-repetition";
import { getRecommendedNextAction } from "./adaptive-policy";
import { resolveNextScene, type SceneDirectorDecision } from "./scene-director";

export type AssignmentSessionAccess =
  | {
      status: "ok";
      sessionId: string;
      assignmentId: string;
      lessonVersionId: string;
      nextActionIndex: number;
    }
  | { status: "not_found" | "unavailable" | "forbidden" | "database_unavailable" };

export type AssignedEvidenceResult =
  | { status: "recorded"; nextActionIndex: number }
  | { status: "replayed"; nextActionIndex: number }
  | { status: "forbidden" | "inactive" | "out_of_sequence" | "database_unavailable" };

export type AssignedActionCheck =
  | { status: "ok" }
  | { status: "forbidden" | "inactive" | "out_of_sequence" | "database_unavailable" };

export type AssignedAssessmentIssue =
  | {
      status: "issued";
      assessmentInstanceId: string;
      assessmentId: string;
      prompt: string;
      actionIndex: number;
      actionNonce: string;
    }
  | { status: "forbidden" | "inactive" | "out_of_sequence" | "unavailable" | "database_unavailable" };

export type AssignedAssessmentSubmission =
  | { status: "submitted"; correct: boolean; nextActionIndex: number }
  | { status: "replayed"; correct: boolean; nextActionIndex: number }
  | { status: "forbidden" | "inactive" | "invalid" | "expired" | "database_unavailable" };

export type AssignedNextSegment =
  | {
      status: "ready";
      attemptSessionId: string;
      scene: LessonScript["scenes"][number];
      gateIndex: number;
      decision: SceneDirectorDecision & { version: number };
    }
  | {
      status: "completed";
      attemptSessionId: string;
      gateIndex: number;
      decision: SceneDirectorDecision & { version: number };
    }
  | { status: "forbidden" | "inactive" | "unavailable" | "database_unavailable" };

/**
 * Opens the one server-owned attempt session for an enrolled student. The query
 * joins assignment, immutable enrollment, and lesson version so clients cannot
 * obtain a session by guessing an assignment UUID from another class/workspace.
 */
export async function openAssignmentAttemptSession(
  assignmentId: string,
  studentId: number
): Promise<AssignmentSessionAccess> {
  if (!isPgReady()) return { status: "database_unavailable" };

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const access = await client.query<{
      assignment_id: string;
      lesson_version_id: string;
      assignment_status: string;
      available_at: Date;
      due_at: Date | null;
      enrollment_exists: boolean;
      script: unknown;
    }>(
      `SELECT a.id AS assignment_id,
              a.lesson_version_id,
              a.status AS assignment_status,
              a.available_at,
              a.due_at,
              v.script,
              EXISTS (
                SELECT 1 FROM study_arena_assignment_enrollments e
                WHERE e.assignment_id = a.id AND e.student_id = $2
              ) AS enrollment_exists
         FROM study_arena_assignments a
         JOIN study_arena_lesson_versions v ON v.id = a.lesson_version_id
        WHERE a.id = $1
        FOR UPDATE`,
      [assignmentId, studentId]
    );

    const assignment = access.rows[0];
    if (!assignment) {
      await client.query("ROLLBACK");
      return { status: "not_found" };
    }
    if (!assignment.enrollment_exists) {
      await client.query("ROLLBACK");
      return { status: "forbidden" };
    }
    if (
      assignment.assignment_status !== "published" ||
      assignment.available_at > new Date() ||
      (assignment.due_at !== null && assignment.due_at < new Date())
    ) {
      await client.query("ROLLBACK");
      return { status: "unavailable" };
    }

    const created = await client.query<{
      id: string;
      assignment_id: string;
      lesson_version_id: string;
      next_action_index: number;
      script: unknown;
    }>(
      `WITH session AS (
        INSERT INTO study_arena_attempt_sessions
         (assignment_id, student_id, lesson_version_id, is_preview)
       VALUES ($1, $2, $3, false)
       ON CONFLICT (assignment_id, student_id) WHERE (is_preview = false) DO UPDATE
         SET assignment_id = EXCLUDED.assignment_id
       WHERE study_arena_attempt_sessions.status = 'active'
       RETURNING id, assignment_id, lesson_version_id, next_action_index
       )
       SELECT session.*, v.script
         FROM session
         JOIN study_arena_lesson_versions v ON v.id = session.lesson_version_id`,
      [assignment.assignment_id, studentId, assignment.lesson_version_id]
    );
    const session = created.rows[0];
    if (!session) {
      await client.query("ROLLBACK");
      return { status: "unavailable" };
    }

    await client.query("COMMIT");
    return {
      status: "ok",
      sessionId: session.id,
      assignmentId: session.assignment_id,
      lessonVersionId: session.lesson_version_id,
      nextActionIndex: session.next_action_index,
    };
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    throw new Error("Could not open Study Arena attempt session");
  } finally {
    client.release();
  }
}

/**
 * Teacher preview: opens an is_preview session against a draft assignment for
 * the lesson version. Never enrolls students; evidence/mastery writers must
 * short-circuit when is_preview is true.
 */
export async function openPreviewSession(input: {
  lessonVersionId: string;
  teacherId: number;
  workspaceId: number;
}): Promise<AssignmentSessionAccess> {
  if (!isPgReady()) return { status: "database_unavailable" };

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const version = await client.query<{
      id: string;
      workspace_id: number;
      created_by: number;
      script: unknown;
    }>(
      `SELECT id, workspace_id, created_by, script
         FROM study_arena_lesson_versions
        WHERE id = $1
        FOR UPDATE`,
      [input.lessonVersionId]
    );
    const row = version.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return { status: "not_found" };
    }
    if (Number(row.workspace_id) !== input.workspaceId || Number(row.created_by) !== input.teacherId) {
      await client.query("ROLLBACK");
      return { status: "forbidden" };
    }

    // Reuse one draft preview assignment per lesson version + teacher.
    const existing = await client.query<{ id: string }>(
      `SELECT id FROM study_arena_assignments
        WHERE lesson_version_id = $1 AND created_by = $2 AND status = 'draft'
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE`,
      [input.lessonVersionId, input.teacherId]
    );
    let assignmentId = existing.rows[0]?.id;
    if (!assignmentId) {
      const created = await client.query<{ id: string }>(
        `INSERT INTO study_arena_assignments
           (workspace_id, lesson_version_id, created_by, status)
         VALUES ($1, $2, $3, 'draft')
         RETURNING id`,
        [input.workspaceId, input.lessonVersionId, input.teacherId]
      );
      assignmentId = created.rows[0].id;
    }

    // Prefer an existing active preview session for this teacher.
    const prior = await client.query<{
      id: string;
      assignment_id: string;
      lesson_version_id: string;
      next_action_index: number;
    }>(
      `SELECT id, assignment_id, lesson_version_id, next_action_index
         FROM study_arena_attempt_sessions
        WHERE assignment_id = $1 AND student_id = $2 AND is_preview = true AND status = 'active'
        LIMIT 1`,
      [assignmentId, input.teacherId]
    );
    if (prior.rows[0]) {
      await client.query("COMMIT");
      return {
        status: "ok",
        sessionId: prior.rows[0].id,
        assignmentId: prior.rows[0].assignment_id,
        lessonVersionId: prior.rows[0].lesson_version_id,
        nextActionIndex: prior.rows[0].next_action_index,
      };
    }

    const session = await client.query<{
      id: string;
      assignment_id: string;
      lesson_version_id: string;
      next_action_index: number;
    }>(
      `INSERT INTO study_arena_attempt_sessions
         (assignment_id, student_id, lesson_version_id, is_preview)
       VALUES ($1, $2, $3, true)
       RETURNING id, assignment_id, lesson_version_id, next_action_index`,
      [assignmentId, input.teacherId, input.lessonVersionId]
    );
    await client.query("COMMIT");
    return {
      status: "ok",
      sessionId: session.rows[0].id,
      assignmentId: session.rows[0].assignment_id,
      lessonVersionId: session.rows[0].lesson_version_id,
      nextActionIndex: session.rows[0].next_action_index,
    };
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    throw new Error("Could not open Study Arena preview session");
  } finally {
    client.release();
  }
}

function parseStoredDecision(value: unknown): (SceneDirectorDecision & { version: number }) | null {
  if (!value || typeof value !== "object") return null;
  const decision = value as Partial<SceneDirectorDecision & { version: number }>;
  if (
    typeof decision.version !== "number" ||
    typeof decision.terminal !== "boolean" ||
    (decision.fromSceneId !== null && typeof decision.fromSceneId !== "string") ||
    (decision.toSceneId !== null && typeof decision.toSceneId !== "string") ||
    typeof decision.rationale !== "string" ||
    (decision.transitionIndex !== null && typeof decision.transitionIndex !== "number")
  ) {
    return null;
  }
  return decision as SceneDirectorDecision & { version: number };
}

/** Returns the one scene the server has already authorized for this session. */
export async function getAssignedNextSegment(input: {
  attemptSessionId: string;
  studentId: number;
}): Promise<AssignedNextSegment> {
  if (!isPgReady()) return { status: "database_unavailable" };

  const client = await getPgPool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{
      student_id: number;
      status: string;
      next_action_index: number;
      current_scene_id: string | null;
      director_decision: unknown;
      director_decision_version: number;
      script: unknown;
    }>(
      `SELECT s.student_id, s.status, s.next_action_index, s.current_scene_id,
              s.director_decision, s.director_decision_version, v.script
         FROM study_arena_attempt_sessions s
         JOIN study_arena_lesson_versions v ON v.id = s.lesson_version_id
        WHERE s.id = $1
        FOR UPDATE`,
      [input.attemptSessionId]
    );
    const session = result.rows[0];
    if (!session || Number(session.student_id) !== input.studentId) {
      await client.query("ROLLBACK");
      return { status: "forbidden" };
    }
    if (session.status === "completed") {
      const decision = parseStoredDecision(session.director_decision);
      await client.query("COMMIT");
      return decision
        ? { status: "completed", attemptSessionId: input.attemptSessionId, gateIndex: session.next_action_index, decision }
        : { status: "unavailable" };
    }
    if (session.status !== "active") {
      await client.query("ROLLBACK");
      return { status: "inactive" };
    }

    const parsedScript = lessonScriptSchema.safeParse(session.script);
    if (!parsedScript.success) {
      await client.query("ROLLBACK");
      return { status: "unavailable" };
    }

    let decision = parseStoredDecision(session.director_decision);
    let currentSceneId = session.current_scene_id;
    if (!decision || decision.version !== session.director_decision_version || currentSceneId === null) {
      const initial = resolveNextScene(parsedScript.data, { currentSceneId: null, branchPath: [] }, {
        helpDepth: 0,
        masteryByConcept: {},
        prerequisiteMasteryByConcept: {},
      });
      decision = { ...initial, version: session.director_decision_version + 1 };
      currentSceneId = initial.toSceneId;
      await client.query(
        `UPDATE study_arena_attempt_sessions
            SET current_scene_id = $2::text,
                branch_path = CASE WHEN $2::text IS NULL THEN branch_path ELSE branch_path || to_jsonb($2::text) END,
                director_decision = $3,
                director_decision_version = $4
          WHERE id = $1`,
        [input.attemptSessionId, currentSceneId, JSON.stringify(decision), decision.version]
      );
    }

    if (decision.terminal || !currentSceneId) {
      await client.query(
        `UPDATE study_arena_attempt_sessions SET status = 'completed', completed_at = now() WHERE id = $1`,
        [input.attemptSessionId]
      );
      await client.query("COMMIT");
      return { status: "completed", attemptSessionId: input.attemptSessionId, gateIndex: session.next_action_index, decision };
    }
    const scene = parsedScript.data.scenes.find((candidate) => candidate.id === currentSceneId);
    if (!scene) {
      await client.query("ROLLBACK");
      return { status: "unavailable" };
    }
    await client.query("COMMIT");
    return { status: "ready", attemptSessionId: input.attemptSessionId, scene, gateIndex: session.next_action_index, decision };
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    throw new Error("Could not load the next Study Arena segment");
  } finally {
    client.release();
  }
}

async function persistNextDirectorDecision(
  client: { query: (text: string, values?: unknown[]) => Promise<{ rows: Array<{ next_action_index: number }> }> },
  input: {
    attemptSessionId: string;
    studentId: number;
    script: LessonScript;
    currentSceneId: string | null;
    completedSceneIds: string[];
    branchPath: string[];
    decisionVersion: number;
    assessmentResult?: { assessmentId: string; correct: boolean };
  }
): Promise<{ nextActionIndex: number; decision: SceneDirectorDecision & { version: number } }> {
  const helpResult = await client.query(
    `SELECT count(*)::int AS help_depth
       FROM study_arena_evidence_events
      WHERE attempt_session_id = $1 AND event_kind IN ('attempt', 'hint')`,
    [input.attemptSessionId]
  );
  const masteryResult = await client.query(
    `SELECT concept, p_mastery FROM learner_mastery WHERE student_id = $1`,
    [input.studentId]
  );
  const masteryByConcept = Object.fromEntries(
    masteryResult.rows.map((row: any) => [row.concept, Number(row.p_mastery)])
  );
  const next = resolveNextScene(
    input.script,
    { currentSceneId: input.currentSceneId, branchPath: input.branchPath },
    {
      assessmentResult: input.assessmentResult,
      helpDepth: Number((helpResult.rows[0] as any)?.help_depth ?? 0),
      masteryByConcept,
      prerequisiteMasteryByConcept: masteryByConcept,
    }
  );
  const decision = { ...next, version: input.decisionVersion + 1 };
  const completed = input.currentSceneId
    ? [...input.completedSceneIds, input.currentSceneId]
    : input.completedSceneIds;
  const branchPath = next.toSceneId ? [...input.branchPath, next.toSceneId] : input.branchPath;
  const updated = await client.query(
    `UPDATE study_arena_attempt_sessions
        SET next_action_index = next_action_index + 1,
            current_scene_id = $2,
            completed_scene_ids = $3,
            branch_path = $4,
            director_decision = $5,
            director_decision_version = $6,
            status = CASE WHEN $7 THEN 'completed' ELSE status END,
            completed_at = CASE WHEN $7 THEN now() ELSE completed_at END
      WHERE id = $1
    RETURNING next_action_index`,
    [
      input.attemptSessionId,
      next.toSceneId,
      JSON.stringify(completed),
      JSON.stringify(branchPath),
      JSON.stringify(decision),
      decision.version,
      next.terminal,
    ]
  );
  return { nextActionIndex: updated.rows[0].next_action_index, decision };
}

/**
 * Atomically records a single assigned-lesson action and advances the server
 * cursor. The unique idempotency key makes retries safe; the locked cursor
 * rejects skipped or duplicated action indexes.
 */
export async function recordAssignedEvidence(input: {
  attemptSessionId: string;
  studentId: number;
  actionIndex: number;
  idempotencyKey: string;
  eventKind: "attempt" | "hint" | "assessment" | "intervention";
  evidence: Record<string, unknown>;
}): Promise<AssignedEvidenceResult> {
  if (!isPgReady()) return { status: "database_unavailable" };

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const sessionResult = await client.query<{
      assignment_id: string;
      student_id: number;
      lesson_version_id: string;
      workspace_id: number;
      objective: string;
      status: string;
      next_action_index: number;
      current_scene_id: string | null;
      completed_scene_ids: string[];
      branch_path: string[];
      director_decision_version: number;
      script: unknown;
      is_preview: boolean;
    }>(
      `SELECT s.assignment_id,
              s.student_id,
              s.lesson_version_id,
              a.workspace_id,
              v.objective,
              s.status,
              s.next_action_index,
              s.current_scene_id,
              s.completed_scene_ids,
              s.branch_path,
              s.director_decision_version,
              v.script,
              s.is_preview
         FROM study_arena_attempt_sessions s
         JOIN study_arena_assignments a ON a.id = s.assignment_id
         JOIN study_arena_lesson_versions v ON v.id = s.lesson_version_id
        WHERE s.id = $1
        FOR UPDATE`,
      [input.attemptSessionId]
    );
    const session = sessionResult.rows[0];
    if (!session || Number(session.student_id) !== input.studentId) {
      await client.query("ROLLBACK");
      return { status: "forbidden" };
    }
    if (session.status !== "active") {
      await client.query("ROLLBACK");
      return { status: "inactive" };
    }

    // Teacher preview: advance the cursor for UX without writing learner evidence.
    if (session.is_preview) {
      if (input.actionIndex !== session.next_action_index) {
        await client.query("ROLLBACK");
        return { status: "out_of_sequence" };
      }
      const script = lessonScriptSchema.safeParse(session.script);
      if (!script.success || !session.current_scene_id) {
        await client.query("ROLLBACK");
        return { status: "inactive" };
      }
      const updated = await persistNextDirectorDecision(client, {
        attemptSessionId: input.attemptSessionId,
        studentId: input.studentId,
        script: script.data,
        currentSceneId: session.current_scene_id,
        completedSceneIds: session.completed_scene_ids,
        branchPath: session.branch_path,
        decisionVersion: session.director_decision_version,
      });
      await client.query("COMMIT");
      return { status: "recorded", nextActionIndex: updated.nextActionIndex };
    }

    const prior = await client.query<{ action_index: number }>(
      `SELECT action_index
         FROM study_arena_evidence_events
        WHERE attempt_session_id = $1 AND idempotency_key = $2`,
      [input.attemptSessionId, input.idempotencyKey]
    );
    if (prior.rows[0]) {
      await client.query("COMMIT");
      return { status: "replayed", nextActionIndex: session.next_action_index };
    }
    if (input.actionIndex !== session.next_action_index) {
      await client.query("ROLLBACK");
      return { status: "out_of_sequence" };
    }

    await client.query(
      `INSERT INTO study_arena_evidence_events
         (workspace_id, assignment_id, attempt_session_id, student_id,
          lesson_version_id, objective, event_kind, action_index,
          idempotency_key, evidence)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        session.workspace_id,
        session.assignment_id,
        input.attemptSessionId,
        input.studentId,
        session.lesson_version_id,
        session.objective,
        input.eventKind,
        input.actionIndex,
        input.idempotencyKey,
        JSON.stringify(input.evidence),
      ]
    );
    const script = lessonScriptSchema.safeParse(session.script);
    if (!script.success || !session.current_scene_id) {
      await client.query("ROLLBACK");
      return { status: "inactive" };
    }
    const updated = await persistNextDirectorDecision(client, {
      attemptSessionId: input.attemptSessionId,
      studentId: input.studentId,
      script: script.data,
      currentSceneId: session.current_scene_id,
      completedSceneIds: session.completed_scene_ids,
      branchPath: session.branch_path,
      decisionVersion: session.director_decision_version,
    });
    await client.query("COMMIT");
    return { status: "recorded", nextActionIndex: updated.nextActionIndex };
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    throw new Error("Could not record Study Arena assignment evidence");
  } finally {
    client.release();
  }
}

/**
 * Cheap preflight before an AI call. `recordAssignedEvidence` still owns the
 * locked, transactional cursor advance; this check only avoids spending a model
 * call on a session the server already knows is invalid or stale.
 */
export async function checkAssignedAction(input: {
  attemptSessionId: string;
  studentId: number;
  actionIndex: number;
}): Promise<AssignedActionCheck> {
  if (!isPgReady()) return { status: "database_unavailable" };

  const result = await getPgPool().query<{
    student_id: number;
    status: string;
    next_action_index: number;
  }>(
    `SELECT student_id, status, next_action_index
       FROM study_arena_attempt_sessions
      WHERE id = $1`,
    [input.attemptSessionId]
  );
  const session = result.rows[0];
  if (!session || Number(session.student_id) !== input.studentId) return { status: "forbidden" };
  if (session.status !== "active") return { status: "inactive" };
  if (session.next_action_index !== input.actionIndex) return { status: "out_of_sequence" };
  return { status: "ok" };
}

/** Issues the one permitted no-AI assessment for the session's current cursor. */
export async function issueAssignedAssessment(input: {
  attemptSessionId: string;
  studentId: number;
  actionIndex: number;
}): Promise<AssignedAssessmentIssue> {
  if (!isPgReady()) return { status: "database_unavailable" };

  const client = await getPgPool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{
      student_id: number;
      session_status: string;
      next_action_index: number;
      assignment_status: string;
      available_at: Date;
      due_at: Date | null;
      script: unknown;
      evaluator_version: string;
      current_scene_id: string | null;
      is_preview: boolean;
    }>(
      `SELECT s.student_id, s.status AS session_status, s.next_action_index,
              a.status AS assignment_status, a.available_at, a.due_at,
              v.script, v.evaluator_version, s.current_scene_id, s.is_preview
         FROM study_arena_attempt_sessions s
         JOIN study_arena_assignments a ON a.id = s.assignment_id
         JOIN study_arena_lesson_versions v ON v.id = s.lesson_version_id
        WHERE s.id = $1
        FOR UPDATE`,
      [input.attemptSessionId]
    );
    const session = result.rows[0];
    if (!session || Number(session.student_id) !== input.studentId) {
      await client.query("ROLLBACK");
      return { status: "forbidden" };
    }
    if (session.session_status !== "active") {
      await client.query("ROLLBACK");
      return { status: "inactive" };
    }
    // Preview sessions use draft assignments — skip published/window checks.
    if (
      !session.is_preview &&
      (session.assignment_status !== "published" ||
        session.available_at > new Date() ||
        (session.due_at !== null && session.due_at < new Date()))
    ) {
      await client.query("ROLLBACK");
      return { status: "unavailable" };
    }
    if (session.next_action_index !== input.actionIndex) {
      await client.query("ROLLBACK");
      return { status: "out_of_sequence" };
    }

    const script = lessonScriptSchema.safeParse(session.script);
    // Only the scene persisted by the director can issue an assessment. The
    // cursor remains the replay-protection index; it is not a client-selected
    // position in the script's flattened action list.
    const action = script.success
      ? script.data.scenes
          .find((scene) => scene.id === session.current_scene_id)
          ?.actions.find((candidate) => candidate.type === "assessment")
      : undefined;
    if (!action || action.type !== "assessment") {
      await client.query("ROLLBACK");
      return { status: "unavailable" };
    }

    const actionNonce = randomUUID();
    const instance = await client.query<{ id: string }>(
      `INSERT INTO study_arena_assessment_instances
         (attempt_session_id, assessment_id, evaluator_version, action_index, nonce_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        input.attemptSessionId,
        action.assessmentId,
        session.evaluator_version,
        input.actionIndex,
        createHash("sha256").update(actionNonce).digest("hex"),
      ]
    );
    await client.query("COMMIT");
    return {
      status: "issued",
      assessmentInstanceId: instance.rows[0].id,
      assessmentId: action.assessmentId,
      prompt: action.prompt,
      actionIndex: input.actionIndex,
      actionNonce,
    };
  } catch (error: any) {
    await client.query("ROLLBACK").catch(() => {});
    if (error?.code === "23505") return { status: "unavailable" };
    throw new Error("Could not issue Study Arena assessment", { cause: error });
  } finally {
    client.release();
  }
}

/** Validates and consumes a server-issued no-AI assessment exactly once. */
export async function submitAssignedAssessment(input: {
  attemptSessionId: string;
  assessmentInstanceId: string;
  studentId: number;
  actionNonce: string;
  answer: string;
  idempotencyKey: string;
}): Promise<AssignedAssessmentSubmission> {
  if (!isPgReady()) return { status: "database_unavailable" };
  const client = await getPgPool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{
      student_id: number; status: string; next_action_index: number; assignment_id: string;
      lesson_version_id: string; workspace_id: number; objective: string; subject: string; primary_concept_id: string | null; assessment_id: string;
      evaluator_version: string; template_id: string | null; template_config: unknown;
      action_index: number; nonce_hash: string | null;
      instance_status: string; due_at: Date | null; correct: boolean | null;
      current_scene_id: string | null; completed_scene_ids: string[]; branch_path: string[];
      director_decision_version: number; script: unknown; is_preview: boolean;
    }>(
      `SELECT s.student_id, s.status, s.next_action_index, s.assignment_id, s.lesson_version_id,
              a.workspace_id, v.objective, v.subject, v.primary_concept_id, i.assessment_id, i.evaluator_version,
              v.template_id, v.template_config, i.action_index,
              i.nonce_hash, i.status AS instance_status, i.due_at, e.correct,
              s.current_scene_id, s.completed_scene_ids, s.branch_path, s.director_decision_version, v.script,
              s.is_preview
         FROM study_arena_assessment_instances i
         JOIN study_arena_attempt_sessions s ON s.id = i.attempt_session_id
         JOIN study_arena_assignments a ON a.id = s.assignment_id
         JOIN study_arena_lesson_versions v ON v.id = s.lesson_version_id
         LEFT JOIN study_arena_assessment_evaluations e ON e.assessment_instance_id = i.id
        WHERE i.id = $1 AND i.attempt_session_id = $2 FOR UPDATE`,
      [input.assessmentInstanceId, input.attemptSessionId]
    );
    const row = result.rows[0];
    if (!row || Number(row.student_id) !== input.studentId) { await client.query("ROLLBACK"); return { status: "forbidden" }; }
    if (row.instance_status === "submitted" && row.correct !== null) {
      await client.query("COMMIT");
      return { status: "replayed", correct: row.correct, nextActionIndex: row.next_action_index };
    }
    if (row.status !== "active") { await client.query("ROLLBACK"); return { status: "inactive" }; }
    if (row.due_at && row.due_at < new Date()) { await client.query("ROLLBACK"); return { status: "expired" }; }
    if (
      !row.nonce_hash ||
      createHash("sha256").update(input.actionNonce).digest("hex") !== row.nonce_hash ||
      row.next_action_index !== row.action_index
    ) { await client.query("ROLLBACK"); return { status: "invalid" }; }
    const evaluation = evaluateAssessment(
      row.assessment_id,
      input.answer,
      row.template_config as AssessmentEvaluationTargets | null
    );
    const correct = evaluation.correct;

    // Teacher preview: evaluate for UX, advance cursor, never write mastery/evidence.
    if (row.is_preview) {
      await client.query(`UPDATE study_arena_assessment_instances SET status = 'submitted', submitted_at = now() WHERE id = $1`, [input.assessmentInstanceId]);
      const script = lessonScriptSchema.safeParse(row.script);
      if (!script.success || !row.current_scene_id) {
        await client.query("ROLLBACK");
        return { status: "invalid" };
      }
      const updated = await persistNextDirectorDecision(client, {
        attemptSessionId: input.attemptSessionId,
        studentId: input.studentId,
        script: script.data,
        currentSceneId: row.current_scene_id,
        completedSceneIds: row.completed_scene_ids,
        branchPath: row.branch_path,
        decisionVersion: row.director_decision_version,
        assessmentResult: { assessmentId: row.assessment_id, correct },
      });
      await client.query("COMMIT");
      return { status: "submitted", correct, nextActionIndex: updated.nextActionIndex };
    }

    const concept = row.primary_concept_id ?? row.objective;
    const [mastery, schedule, attempts] = await Promise.all([
      client.query<{ p_mastery: number; confidence: number }>(`SELECT p_mastery, confidence FROM learner_mastery WHERE student_id = $1 AND concept = $2`, [input.studentId, concept]),
      client.query<{ sm2_ef: number; interval_days: number; repetitions: number }>(`SELECT sm2_ef, interval_days, repetitions FROM review_schedule WHERE student_id = $1 AND concept = $2`, [input.studentId, concept]),
      client.query<{ count: string }>(`SELECT count(*) FROM study_arena_evidence_events WHERE attempt_session_id = $1 AND event_kind IN ('attempt','hint')`, [input.attemptSessionId]),
    ]);
    const previousMastery = mastery.rows[0]?.p_mastery ?? DEFAULT_BKT.pInit;
    const pMastery = bktUpdate(Number(previousMastery), correct);
    const confidence = Math.min(0.95, Number(mastery.rows[0]?.confidence ?? 0) + 0.15);
    const previousSchedule = schedule.rows[0]
      ? { sm2Ef: Number(schedule.rows[0].sm2_ef), intervalDays: Number(schedule.rows[0].interval_days), repetitions: Number(schedule.rows[0].repetitions) }
      : DEFAULT_SM2;
    const nextReview = sm2Next(previousSchedule, correct ? 4 : 1);
    const dueAt = new Date(Date.now() + nextReview.intervalDays * 86_400_000);
    const recommendation = getRecommendedNextAction({ correct, pMastery, prerequisiteMastery: null, helpDepth: Number(attempts.rows[0].count) });
    await client.query(
      `INSERT INTO study_arena_assessment_evaluations
         (assessment_instance_id, evaluator_version, correct, confidence, misconception_code)
       VALUES ($1, $2, $3, $4, $5)`,
      [input.assessmentInstanceId, row.evaluator_version, correct, evaluation.confidence, evaluation.misconceptionCode]
    );
    await client.query(
      `INSERT INTO study_arena_evidence_events
        (workspace_id, assignment_id, attempt_session_id, student_id, lesson_version_id, objective,
         event_kind, action_index, idempotency_key, evidence)
       VALUES ($1,$2,$3,$4,$5,$6,'assessment',$7,$8,$9)`,
      [row.workspace_id, row.assignment_id, input.attemptSessionId, input.studentId, row.lesson_version_id,
       row.objective, row.action_index, input.idempotencyKey,
       JSON.stringify({ assessmentInstanceId: input.assessmentInstanceId, correct })]
    );
    await applyLearnerUpdateInTransaction(client, input.studentId, {
      masteryDeltas: [{ concept, subject: row.subject, pMastery, confidence }],
      reviewUpdates: [{ concept, sm2Ef: nextReview.sm2Ef, intervalDays: nextReview.intervalDays, repetitions: nextReview.repetitions, dueAt }],
      interaction: { kind: "assigned_assessment", concept, payload: { assessmentInstanceId: input.assessmentInstanceId, correct, recommendation } },
    });
    await client.query(`UPDATE study_arena_assessment_instances SET status = 'submitted', submitted_at = now() WHERE id = $1`, [input.assessmentInstanceId]);
    const script = lessonScriptSchema.safeParse(row.script);
    if (!script.success || !row.current_scene_id) {
      await client.query("ROLLBACK");
      return { status: "invalid" };
    }
    const updated = await persistNextDirectorDecision(client, {
      attemptSessionId: input.attemptSessionId,
      studentId: input.studentId,
      script: script.data,
      currentSceneId: row.current_scene_id,
      completedSceneIds: row.completed_scene_ids,
      branchPath: row.branch_path,
      decisionVersion: row.director_decision_version,
      assessmentResult: { assessmentId: row.assessment_id, correct },
    });
    await client.query(
      `UPDATE study_arena_attempt_sessions
          SET adaptive_recommendation = $2
        WHERE id = $1`,
      [input.attemptSessionId, JSON.stringify({ recommendation, concept, pMastery })]
    );
    await client.query("COMMIT");
    return { status: "submitted", correct, nextActionIndex: updated.nextActionIndex };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw new Error("Could not submit Study Arena assessment", { cause: error });
  } finally { client.release(); }
}
