import { z } from 'zod';

import { apiGet, apiPost } from '@/lib/api';

const assignmentSchema = z.object({
  id: z.string().uuid(),
  objective: z.string(),
  subject: z.string(),
  gradeLevel: z.string().nullable(),
  dueAt: z.string().nullable(),
  status: z.enum(['not_started', 'in_progress', 'completed']),
});
const assignmentsSchema = z.object({ assignments: z.array(assignmentSchema) });
export type LearningAssignment = z.infer<typeof assignmentSchema>;

const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('speak'), agent: z.string(), text: z.string() }),
  z.object({ type: z.literal('showSlide'), title: z.string(), bullets: z.array(z.string()) }),
  z.object({ type: z.literal('highlight'), target: z.string(), label: z.string() }),
  z.object({ type: z.literal('ask'), prompt: z.string(), expects: z.enum(['freeText', 'choice']), choices: z.array(z.string()).optional(), gate: z.literal(true) }),
  z.object({ type: z.literal('assessment'), prompt: z.string(), assessmentId: z.string(), gate: z.literal(true) }),
]);

const sessionSchema = z.object({ status: z.literal('ok'), sessionId: z.string().uuid() });
const segmentSchema = z.union([
  z.object({ status: z.literal('ready'), attemptSessionId: z.string().uuid(), gateIndex: z.number().int(), scene: z.object({ id: z.string(), actions: z.array(actionSchema) }) }),
  z.object({ status: z.literal('completed'), attemptSessionId: z.string().uuid(), gateIndex: z.number().int() }),
]);
export type LearningSegment = z.infer<typeof segmentSchema>;
export type LearningAction = z.infer<typeof actionSchema>;

const interactionSchema = z.object({ feedback: z.string(), proceed: z.boolean(), attempt: z.number().int() }).passthrough();
const assessmentIssueSchema = z.object({
  status: z.literal('issued'),
  assessmentInstanceId: z.string().uuid(),
  actionNonce: z.string().uuid(),
  actionIndex: z.number().int(),
});
const assessmentSubmitSchema = z.object({ status: z.enum(['submitted', 'replayed']), correct: z.boolean(), nextActionIndex: z.number().int() });

export const fetchLearningAssignments = () => apiGet('/api/study-arena-beta/my-assignments', assignmentsSchema);
export const openLearningSession = (assignmentId: string) => apiPost('/api/study-arena-beta/assignment-session', { assignmentId }, sessionSchema);
export const fetchNextSegment = (attemptSessionId: string) => apiPost('/api/study-arena-beta/assignment-next-segment', { attemptSessionId }, segmentSchema);

function idempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    return (char === 'x' ? value : (value & 0x3) | 0x8).toString(16);
  });
}

export async function submitAttempt(input: { assignment: LearningAssignment; segment: Extract<LearningSegment, { status: 'ready' }>; answer: string }) {
  const gate = input.segment.scene.actions.find((action) => action.type === 'ask' || action.type === 'assessment');
  if (!gate) throw new Error('This segment has no attempt gate');
  if (gate.type === 'assessment') {
    const issued = await apiPost('/api/study-arena-beta/assignment-assessment-instance', {
      attemptSessionId: input.segment.attemptSessionId,
      actionIndex: input.segment.gateIndex,
    }, assessmentIssueSchema);
    const result = await apiPost('/api/study-arena-beta/assignment-assessment-submit', {
      attemptSessionId: input.segment.attemptSessionId,
      assessmentInstanceId: issued.assessmentInstanceId,
      actionNonce: issued.actionNonce,
      answer: input.answer,
      idempotencyKey: idempotencyKey(),
    }, assessmentSubmitSchema);
    return { proceed: true, feedback: result.correct ? 'Independent check passed.' : 'Recorded. Your teacher can review this evidence.' };
  }
  return apiPost('/api/study-arena-beta/interaction', {
    topic: input.assignment.objective.slice(0, 300),
    question: gate.prompt,
    answer: input.answer,
    lessonId: input.assignment.id,
    actionKey: input.segment.scene.id.slice(0, 40),
    gateIndex: input.segment.gateIndex,
    attempt: 1,
    attemptSessionId: input.segment.attemptSessionId,
    actionIndex: input.segment.gateIndex,
    idempotencyKey: idempotencyKey(),
  }, interactionSchema);
}
