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
