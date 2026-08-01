import { describe, expect, it } from "vitest";
import { renderStudyArenaGate } from "../../scripts/study-arena-gate";

const armed = {
  pilotStartedAt: "2026-07-01T00:00:00.000Z",
  pilotEndsAt: "2026-07-31T00:00:00.000Z",
  teacherReviewed: false,
};

describe("Study Arena adoption gate", () => {
  it("does not infer a window when the pilot timestamp is absent", () => {
    expect(renderStudyArenaGate({ teacherReviewed: false })).toMatch(/NOT ARMED/);
  });

  it("keeps fewer than five unassisted students on WATCH", () => {
    expect(renderStudyArenaGate({ ...armed, unassistedStudentsCompleted: 4 })).toMatch(/WATCH/);
  });

  it("never passes when usage rows or estimates are missing", () => {
    const result = renderStudyArenaGate({
      ...armed,
      unassistedStudentsCompleted: 5,
      costPerCompletedLessonInr: 1,
      costRowsMissing: 1,
    });
    expect(result).toMatch(/UNKNOWN/);
    expect(result).not.toMatch(/gate MET/);
  });

  it("treats exactly ₹2 as over the strict cost bar", () => {
    expect(
      renderStudyArenaGate({
        ...armed,
        unassistedStudentsCompleted: 5,
        costPerCompletedLessonInr: 2,
        costRowsMissing: 0,
      })
    ).toMatch(/must be <₹2/);
  });

  it("requires recorded teacher review after student and cost thresholds pass", () => {
    const input = {
      ...armed,
      unassistedStudentsCompleted: 5,
      costPerCompletedLessonInr: 1.25,
      costRowsMissing: 0,
    };
    expect(renderStudyArenaGate(input)).toMatch(/PENDING until a teacher/);
    expect(renderStudyArenaGate({ ...input, teacherReviewed: true })).toMatch(/gate MET/);
  });
});
