import { describe, expect, it } from "vitest";
import {
  STUDY_ARENA_RESUME_KEY,
  clearStudyArenaResume,
  isUsableChoiceAction,
  readStudyArenaResume,
  writeStudyArenaResume,
} from "../../client/src/lib/study-arena-resume";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
    raw: values,
  };
}

describe("Study Arena resume storage", () => {
  it("round-trips script and cursor without storing student answers", () => {
    const storage = memoryStorage();
    expect(
      writeStudyArenaResume(storage, {
        version: 1,
        lessonId: "lesson-1",
        topic: "Photosynthesis",
        script: { scenes: [{ id: "s1", actions: [] }] },
        cursor: 3,
        totalGates: 2,
        savedAt: "2026-07-21T00:00:00.000Z",
      })
    ).toBe(true);
    const raw = storage.raw.get(STUDY_ARENA_RESUME_KEY) ?? "";
    expect(raw).not.toContain("answer");
    expect(raw).not.toContain("feedback");
    expect(readStudyArenaResume(storage)).toMatchObject({ cursor: 3, lessonId: "lesson-1" });
  });

  it("rejects malformed or corrupt saved state", () => {
    const storage = memoryStorage();
    storage.setItem(STUDY_ARENA_RESUME_KEY, "not-json");
    expect(readStudyArenaResume(storage)).toBeNull();
    storage.setItem(STUDY_ARENA_RESUME_KEY, JSON.stringify({ version: 1, cursor: -1 }));
    expect(readStudyArenaResume(storage)).toBeNull();
  });

  it("clears saved state", () => {
    const storage = memoryStorage();
    storage.setItem(STUDY_ARENA_RESUME_KEY, "{}");
    clearStudyArenaResume(storage);
    expect(storage.getItem(STUDY_ARENA_RESUME_KEY)).toBeNull();
  });
});

describe("Study Arena client guards", () => {
  it("only treats a choice action as usable with at least two options", () => {
    expect(isUsableChoiceAction({ expects: "choice", choices: [] })).toBe(false);
    expect(isUsableChoiceAction({ expects: "choice", choices: ["one"] })).toBe(false);
    expect(isUsableChoiceAction({ expects: "choice", choices: ["one", "two"] })).toBe(true);
    expect(isUsableChoiceAction({ expects: "freeText" })).toBe(false);
  });
});
