// Regression: ISSUE-002 — a 400 was reported to students as a connection failure
// Found by /qa on 2026-07-31
// Report: .gstack/qa-reports/qa-report-localhost-2026-07-31.md
//
// The player capped nothing before sending, so a topic over the route's 300-char
// limit came back 400; messageForError handled 401/403/429/>=500 and let 400 fall
// through to "Couldn't reach the lesson service. Check your connection." That is
// false (the service answered) and a dead end (retrying the same text always fails).
import { describe, expect, it } from "vitest";
import {
  STUDY_ARENA_LIMITS,
  studyArenaErrorMessage,
} from "../../client/src/lib/study-arena-resume";

describe("Study Arena error copy", () => {
  it("does not blame the connection for a 400", () => {
    const message = studyArenaErrorMessage(400);
    expect(message).not.toMatch(/connection/i);
    expect(message).not.toMatch(/couldn't reach/i);
    // Must tell the student what to actually do about it.
    expect(message).toMatch(/shorten/i);
  });

  it("keeps each failure mode distinguishable", () => {
    expect(studyArenaErrorMessage(401)).toMatch(/sign in again/i);
    expect(studyArenaErrorMessage(403)).toMatch(/today's AI time/i);
    expect(studyArenaErrorMessage(429)).toMatch(/today's AI time/i);
    expect(studyArenaErrorMessage(500)).toMatch(/on us/i);
    expect(studyArenaErrorMessage(503)).toMatch(/on us/i);

    const distinct = new Set(
      [400, 401, 403, 500, 0].map((status) => studyArenaErrorMessage(status))
    );
    expect(distinct.size).toBe(5);
  });

  it("still says check your connection only when the request never got an answer", () => {
    // status 0 is the client's "no response" sentinel — the one honest case.
    expect(studyArenaErrorMessage(0)).toMatch(/connection/i);
  });

  it("never blames the student for a server-side failure", () => {
    for (const status of [500, 502, 503]) {
      expect(studyArenaErrorMessage(status)).not.toMatch(/shorten|too long|your topic/i);
    }
  });

  it("clamps to the caps the route actually enforces", () => {
    // Mirrors server/routes/study-arena-beta.ts zod schemas. If the route caps
    // change and these don't, the 400 dead-end comes straight back.
    expect(STUDY_ARENA_LIMITS.topic).toBe(300);
    expect(STUDY_ARENA_LIMITS.question).toBe(2000);
    expect(STUDY_ARENA_LIMITS.answer).toBe(4000);

    const overLong = "photosynthesis ".repeat(30);
    expect(overLong.length).toBeGreaterThan(STUDY_ARENA_LIMITS.topic);
    expect(overLong.slice(0, STUDY_ARENA_LIMITS.topic)).toHaveLength(300);
  });
});
