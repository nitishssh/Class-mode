export interface StudyArenaResume<TScript = unknown> {
  version: 1;
  lessonId: string;
  topic: string;
  script: TScript;
  cursor: number;
  totalGates: number;
  savedAt: string;
}

export const STUDY_ARENA_RESUME_KEY = "study-arena:resume:v1";

/**
 * Mirror of the server's zod caps (server/routes/study-arena-beta.ts). The
 * player clamps to these before sending so an over-long topic or answer never
 * comes back as a 400 the student cannot act on.
 */
export const STUDY_ARENA_LIMITS = { topic: 300, question: 2000, answer: 4000 } as const;

/**
 * Honest, student-facing copy for a failed request, by HTTP status.
 *
 * Never blames the student for a failure that isn't theirs — but a 400 IS
 * about what they typed, so say so. Reporting it as a connection problem sent
 * them to check their wifi and retry the same text forever: false, and a dead
 * end. Status 0 means the request never got an answer, which is the only case
 * where "check your connection" is the truth.
 */
export function studyArenaErrorMessage(status: number): string {
  if (status === 401) return "Your session expired. Please sign in again.";
  if (status === 403 || status === 429) return "You've used today's AI time. Come back tomorrow.";
  if (status === 400) return "That was a bit too long — shorten it and try again.";
  if (status >= 500) return "That's on us — something broke. Please try again.";
  return "Couldn't reach the lesson service. Check your connection and try again.";
}

export function isUsableChoiceAction(action: { expects?: string; choices?: unknown[] }): boolean {
  return action.expects === "choice" && (action.choices?.length ?? 0) >= 2;
}

export function isStudyArenaResume(value: unknown): value is StudyArenaResume {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.version === 1 &&
    typeof record.lessonId === "string" &&
    record.lessonId.length > 0 &&
    typeof record.topic === "string" &&
    record.script !== null &&
    typeof record.script === "object" &&
    Number.isInteger(record.cursor) &&
    Number(record.cursor) >= 0 &&
    Number.isInteger(record.totalGates) &&
    Number(record.totalGates) > 0 &&
    typeof record.savedAt === "string"
  );
}

export function readStudyArenaResume(storage: Pick<Storage, "getItem">): StudyArenaResume | null {
  try {
    const raw = storage.getItem(STUDY_ARENA_RESUME_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isStudyArenaResume(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeStudyArenaResume(
  storage: Pick<Storage, "setItem">,
  resume: StudyArenaResume
): boolean {
  try {
    storage.setItem(STUDY_ARENA_RESUME_KEY, JSON.stringify(resume));
    return true;
  } catch {
    return false;
  }
}

export function clearStudyArenaResume(storage: Pick<Storage, "removeItem">): void {
  try {
    storage.removeItem(STUDY_ARENA_RESUME_KEY);
  } catch {
    // Storage may be disabled or full. Resume is optional and must not block a lesson.
  }
}
