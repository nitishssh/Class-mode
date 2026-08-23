import { getPgPool, isPgReady } from "../../db-pg";
import {
  MASTERED_THRESHOLD,
  WEAK_PREREQUISITE_THRESHOLD,
} from "./adaptive-policy";

/**
 * Cross-assignment reliance read model.
 *
 * The per-assignment report answers "how did this lesson go". Over-reliance is a
 * pattern across lessons: one assignment where a student leaned on hints is
 * noise, four in a row is the signal. Nothing here writes; it reads the evidence
 * events the player already records.
 *
 * The load-bearing measure is HINT-FIRST, not hint count. A hint taken after an
 * attempt is productive struggle; a hint taken before any attempt is the
 * cognitive offloading our pedagogy exists to prevent.
 */

/** Below this many gates of evidence the index is noise, so we refuse to show one. */
export const MIN_GATES_FOR_INDEX = 3;
/** A teacher-facing judgement about a child; keep the window bounded and cheap. */
export const MAX_WINDOW_DAYS = 90;
export const DEFAULT_WINDOW_DAYS = 30;
/** Reliance at or above this lands a student in the high-help cohort. */
export const HIGH_RELIANCE_THRESHOLD = 0.5;

export interface RelianceGateRow {
  studentId: number;
  studentName: string | null;
  assignmentId: string;
  assignmentAt: Date | string;
  gates: number;
  attempts: number;
  hints: number;
  hintFirstGates: number;
  assessed: boolean;
  transferCorrect: boolean | null;
  /** Concept the lesson tracks mastery under: primary_concept_id, else objective. */
  concept: string;
  /** Learner-model state for that concept, null when the student has no row yet. */
  pMastery: number | null;
  repetitions: number;
  reviewDueAt: Date | string | null;
}

export interface StudentReliance {
  studentId: number;
  studentName: string | null;
  assignments: number;
  /**
   * Most recent assignment in the window. Follow-up is recorded through the
   * existing per-assignment interventions endpoint, so a cross-assignment view
   * still needs one assignment to hang the note on.
   */
  latestAssignmentId: string;
  gates: number;
  attempts: number;
  hints: number;
  hintFirstGates: number;
  /** 0..1, higher = more reliant. Null when the evidence floor is not met. */
  reliance: number | null;
  /** Reliance on the most recent assignment minus the one before it. Null when < 2 scored. */
  trend: number | null;
  assessed: number;
  transferCorrect: number;
  transferFailed: number;
  /**
   * Named concepts behind the diagnostic cohorts. A cohort tells a teacher who;
   * these tell them what to actually sit down and do.
   */
  prerequisiteGapConcepts: string[];
  recallOverdueConcepts: string[];
}

export interface RelianceCohort {
  key: "failed_transfer" | "high_help" | "prerequisite_gap" | "recall_overdue";
  label: string;
  studentIds: number[];
  suggestedAction: string;
}

export interface RelianceModel {
  windowDays: number;
  students: StudentReliance[];
  cohorts: RelianceCohort[];
  /** Students seen in the window but below the gate floor — shown, never scored. */
  insufficientEvidence: number[];
}

/** Reliance for a single assignment's worth of gates. */
export function relianceScore(input: {
  gates: number;
  attempts: number;
  hints: number;
  hintFirstGates: number;
}): number {
  if (input.gates <= 0) return 0;
  const hintFirstRate = input.hintFirstGates / input.gates;
  const hintPerAttemptRate = Math.min(1, input.hints / Math.max(input.attempts, 1));
  return round2(0.6 * hintFirstRate + 0.4 * hintPerAttemptRate);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * Pure aggregation, split from the query so the metric is testable without a
 * database. Rows are one per (student, assignment).
 */
export function buildRelianceModel(rows: RelianceGateRow[], windowDays: number): RelianceModel {
  const byStudent = new Map<number, RelianceGateRow[]>();
  for (const row of rows) {
    const bucket = byStudent.get(row.studentId);
    if (bucket) bucket.push(row);
    else byStudent.set(row.studentId, [row]);
  }

  const students: StudentReliance[] = [];
  const insufficientEvidence: number[] = [];

  for (const [studentId, studentRows] of byStudent) {
    const ordered = [...studentRows].sort(
      (a, b) => new Date(a.assignmentAt).getTime() - new Date(b.assignmentAt).getTime()
    );
    const totals = ordered.reduce(
      (acc, row) => ({
        gates: acc.gates + row.gates,
        attempts: acc.attempts + row.attempts,
        hints: acc.hints + row.hints,
        hintFirstGates: acc.hintFirstGates + row.hintFirstGates,
      }),
      { gates: 0, attempts: 0, hints: 0, hintFirstGates: 0 }
    );

    const scored = totals.gates >= MIN_GATES_FOR_INDEX;
    if (!scored) insufficientEvidence.push(studentId);

    // Trend needs two assignments that each clear the floor on their own —
    // otherwise a one-gate lesson swings the arrow for no reason.
    const perAssignment = ordered
      .filter((row) => row.gates >= MIN_GATES_FOR_INDEX)
      .map((row) => relianceScore(row));
    const trend =
      perAssignment.length >= 2
        ? round2(
            perAssignment[perAssignment.length - 1] - perAssignment[perAssignment.length - 2]
          )
        : null;

    // A student can trip several diagnostics; name the concept behind each so the
    // teacher gets "fractions", not just a list of names.
    const now = Date.now();
    const prerequisiteGapConcepts = unique(
      ordered
        .filter(
          (row) =>
            row.transferCorrect === false &&
            row.pMastery !== null &&
            row.pMastery < WEAK_PREREQUISITE_THRESHOLD
        )
        .map((row) => row.concept)
    );
    const recallOverdueConcepts = unique(
      ordered
        .filter(
          (row) =>
            row.repetitions > 0 &&
            row.pMastery !== null &&
            row.pMastery >= MASTERED_THRESHOLD &&
            row.reviewDueAt !== null &&
            new Date(row.reviewDueAt).getTime() < now
        )
        .map((row) => row.concept)
    );

    students.push({
      studentId,
      studentName: ordered[ordered.length - 1]?.studentName ?? null,
      assignments: ordered.length,
      latestAssignmentId: ordered[ordered.length - 1].assignmentId,
      ...totals,
      reliance: scored ? relianceScore(totals) : null,
      trend,
      assessed: ordered.filter((row) => row.assessed).length,
      transferCorrect: ordered.filter((row) => row.transferCorrect === true).length,
      transferFailed: ordered.filter((row) => row.transferCorrect === false).length,
      prerequisiteGapConcepts,
      recallOverdueConcepts,
    });
  }

  students.sort((a, b) => (b.reliance ?? -1) - (a.reliance ?? -1) || a.studentId - b.studentId);

  const cohorts: RelianceCohort[] = (
    [
      {
        // A named prerequisite gap is a more actionable diagnosis than "failed
        // transfer", so it claims the student and failed_transfer below skips
        // them. Two overlapping lists of the same child is noise a teacher has
        // to reconcile by hand.
        key: "prerequisite_gap" as const,
        label: "Missing a prerequisite",
        studentIds: students
          .filter((s) => s.prerequisiteGapConcepts.length > 0)
          .map((s) => s.studentId),
        suggestedAction: "Reteach the earlier concept before repeating this lesson.",
      },
      {
        key: "failed_transfer" as const,
        label: "Failed independent transfer",
        studentIds: students
          .filter((s) => s.transferFailed > 0 && s.prerequisiteGapConcepts.length === 0)
          .map((s) => s.studentId),
        suggestedAction: "Review the misconception and assign supported practice.",
      },
      {
        key: "high_help" as const,
        label: "Reaching for hints before trying",
        studentIds: students
          .filter((s) => s.reliance !== null && s.reliance >= HIGH_RELIANCE_THRESHOLD)
          .map((s) => s.studentId),
        suggestedAction: "Sit with the first gate before they open a hint.",
      },
      {
        // Not a problem with this lesson: something they had, now going stale.
        key: "recall_overdue" as const,
        label: "Mastered, now due for recall",
        studentIds: students
          .filter((s) => s.recallOverdueConcepts.length > 0)
          .map((s) => s.studentId),
        suggestedAction: "Drop a short recall check into the next lesson.",
      },
    ] satisfies RelianceCohort[]
  ).filter((cohort) => cohort.studentIds.length > 0);

  return { windowDays, students, cohorts, insufficientEvidence };
}

export interface RelianceFilters {
  classId?: number | null;
  subject?: string | null;
  sinceDays?: number;
}

export async function getRelianceCohorts(
  workspaceId: number,
  filters: RelianceFilters = {}
): Promise<RelianceModel> {
  const windowDays = Math.min(
    MAX_WINDOW_DAYS,
    Math.max(1, filters.sinceDays ?? DEFAULT_WINDOW_DAYS)
  );
  if (!isPgReady()) throw new Error("database_unavailable");

  // Gate identity is (attempt_session_id, action_index). hint_first asks whether
  // the earliest hint at that gate landed before the earliest attempt — a gate
  // with hints and no attempt at all counts as hint-first.
  const result = await getPgPool().query<{
    student_id: number;
    student_name: string | null;
    assignment_id: string;
    assignment_at: Date;
    gates: number;
    attempts: number;
    hints: number;
    hint_first_gates: number;
    assessed: boolean;
    transfer_correct: boolean | null;
    concept: string;
    p_mastery: number | null;
    repetitions: number;
    review_due_at: Date | null;
  }>(
    `WITH scoped AS (
       SELECT e.student_id, e.assignment_id, e.attempt_session_id, e.action_index,
              e.event_kind, e.created_at
         FROM study_arena_evidence_events e
         JOIN study_arena_assignments a ON a.id = e.assignment_id
         JOIN study_arena_lesson_versions lv ON lv.id = e.lesson_version_id
         -- Teacher preview sessions are not learner evidence. The player already
         -- declines to write them, but a teacher walking their own lesson must
         -- never be able to appear in their class's reliance list.
         JOIN study_arena_attempt_sessions s
           ON s.id = e.attempt_session_id AND s.is_preview = false
        WHERE e.workspace_id = $1
          AND e.event_kind IN ('attempt', 'hint')
          AND e.created_at >= now() - make_interval(days => $2::int)
          AND ($3::bigint IS NULL OR a.school_class_id = $3::bigint)
          AND ($4::text IS NULL OR lv.subject = $4::text)
     ),
     gates AS (
       SELECT student_id, assignment_id, attempt_session_id, action_index,
              count(*) FILTER (WHERE event_kind = 'attempt')::int AS attempts,
              count(*) FILTER (WHERE event_kind = 'hint')::int   AS hints,
              (min(created_at) FILTER (WHERE event_kind = 'hint') IS NOT NULL
               AND (min(created_at) FILTER (WHERE event_kind = 'attempt') IS NULL
                    OR min(created_at) FILTER (WHERE event_kind = 'hint')
                       < min(created_at) FILTER (WHERE event_kind = 'attempt'))) AS hint_first
         FROM scoped
        GROUP BY student_id, assignment_id, attempt_session_id, action_index
     ),
     per_assignment AS (
       SELECT student_id, assignment_id,
              count(*)::int AS gates,
              sum(attempts)::int AS attempts,
              sum(hints)::int AS hints,
              count(*) FILTER (WHERE hint_first)::int AS hint_first_gates
         FROM gates
        GROUP BY student_id, assignment_id
     )
     SELECT p.student_id,
            COALESCE(u.display_name, u.name, u.username) AS student_name,
            p.assignment_id, a.created_at AS assignment_at,
            p.gates, p.attempts, p.hints, p.hint_first_gates,
            (assessment.submitted_at IS NOT NULL) AS assessed,
            assessment.correct AS transfer_correct,
            -- Mastery and review rows are keyed by the same expression the
            -- player writes them under (assignment-sessions.ts): the lesson's
            -- primary concept, falling back to its objective.
            COALESCE(lv.primary_concept_id, lv.objective) AS concept,
            lm.p_mastery,
            COALESCE(rs.repetitions, 0)::int AS repetitions,
            rs.due_at AS review_due_at
       FROM per_assignment p
       JOIN users u ON u.id = p.student_id
       JOIN study_arena_assignments a ON a.id = p.assignment_id
       JOIN study_arena_lesson_versions lv ON lv.id = a.lesson_version_id
       LEFT JOIN learner_mastery lm
         ON lm.student_id = p.student_id
        AND lm.concept = COALESCE(lv.primary_concept_id, lv.objective)
       LEFT JOIN review_schedule rs
         ON rs.student_id = p.student_id
        AND rs.concept = COALESCE(lv.primary_concept_id, lv.objective)
       LEFT JOIN LATERAL (
         SELECT ai.submitted_at, ev.correct
           FROM study_arena_attempt_sessions s
           JOIN study_arena_assessment_instances ai ON ai.attempt_session_id = s.id
           LEFT JOIN study_arena_assessment_evaluations ev
             ON ev.assessment_instance_id = ai.id
          WHERE s.assignment_id = p.assignment_id
            AND s.student_id = p.student_id
            AND s.is_preview = false
            AND ai.status = 'submitted'
          ORDER BY ai.submitted_at DESC
          LIMIT 1
       ) assessment ON true
      ORDER BY p.student_id, a.created_at`,
    [workspaceId, windowDays, filters.classId ?? null, filters.subject ?? null]
  );

  return buildRelianceModel(
    result.rows.map((row) => ({
      studentId: Number(row.student_id),
      studentName: row.student_name,
      assignmentId: row.assignment_id,
      assignmentAt: row.assignment_at,
      gates: Number(row.gates),
      attempts: Number(row.attempts),
      hints: Number(row.hints),
      hintFirstGates: Number(row.hint_first_gates),
      assessed: Boolean(row.assessed),
      transferCorrect: row.transfer_correct,
      concept: row.concept,
      pMastery: row.p_mastery === null ? null : Number(row.p_mastery),
      repetitions: Number(row.repetitions),
      reviewDueAt: row.review_due_at,
    })),
    windowDays
  );
}
