import { describe, expect, it } from "vitest";
import { resolveNextScene } from "../services/study-arena/scene-director";
import type { LessonScript } from "../services/study-arena/lesson-script";

const script: LessonScript = {
  topic: "Linear equations",
  conceptIds: ["linear-equations-isolation"],
  scenes: [
    { id: "check", actions: [{ type: "assessment", agent: "teacher", assessmentId: "linear-equations-immediate", prompt: "Solve", gate: true }] },
    { id: "support", actions: [{ type: "ask", agent: "coach", prompt: "Try again", expects: "freeText", gate: true }] },
    { id: "done", actions: [{ type: "assessment", agent: "teacher", assessmentId: "linear-equations-delayed", prompt: "Recall", gate: true }] },
  ],
  sceneGraph: {
    version: "v1",
    entrySceneId: "check",
    transitions: [
      { fromSceneId: "check", toSceneId: "done", when: { kind: "assessment_result", correct: true } },
      { fromSceneId: "check", toSceneId: "support", when: { kind: "assessment_result", correct: false } },
      { fromSceneId: "support", toSceneId: "done", when: { kind: "always" } },
      { fromSceneId: "done", terminal: true, when: { kind: "always" } },
    ],
  },
};

const emptyEvidence = { helpDepth: 0, masteryByConcept: {}, prerequisiteMasteryByConcept: {} };

describe("Study Arena scene director", () => {
  it("starts from the declared entry and only follows a matching declared edge", () => {
    expect(resolveNextScene(script, { currentSceneId: null, branchPath: [] }, emptyEvidence)).toMatchObject({
      toSceneId: "check",
      rationale: "declared_entry_scene",
    });
    expect(
      resolveNextScene(script, { currentSceneId: "check", branchPath: ["check"] }, {
        ...emptyEvidence,
        assessmentResult: { assessmentId: "linear-equations-immediate", correct: false },
      })
    ).toMatchObject({ toSceneId: "support", transitionIndex: 1 });
  });

  it("uses authored order deterministically and completes at a declared terminal edge", () => {
    expect(
      resolveNextScene(script, { currentSceneId: "check", branchPath: ["check"] }, {
        ...emptyEvidence,
        assessmentResult: { assessmentId: "linear-equations-immediate", correct: true },
      })
    ).toMatchObject({ toSceneId: "done", transitionIndex: 0 });
    expect(resolveNextScene(script, { currentSceneId: "done", branchPath: ["check", "done"] }, emptyEvidence))
      .toMatchObject({ terminal: true, toSceneId: null });
  });

  it("routes high-help and prerequisite-gap learners through declared support", () => {
    const adaptive: LessonScript = {
      ...script,
      sceneGraph: {
        ...script.sceneGraph!,
        transitions: [
          { fromSceneId: "check", toSceneId: "support", when: { kind: "help_depth", operator: "gte", value: 3 } },
          { fromSceneId: "check", toSceneId: "support", when: { kind: "prerequisite_mastery", conceptId: "fractions", operator: "lt", value: 0.5 } },
          { fromSceneId: "check", toSceneId: "done", when: { kind: "always" } },
          { fromSceneId: "support", toSceneId: "done", when: { kind: "always" } },
          { fromSceneId: "done", terminal: true, when: { kind: "always" } },
        ],
      },
    };

    expect(resolveNextScene(adaptive, { currentSceneId: "check", branchPath: ["check"] }, {
      ...emptyEvidence,
      helpDepth: 3,
    })).toMatchObject({ toSceneId: "support", transitionIndex: 0 });
    expect(resolveNextScene(adaptive, { currentSceneId: "check", branchPath: ["check"] }, {
      ...emptyEvidence,
      prerequisiteMasteryByConcept: { fractions: 0.25 },
    })).toMatchObject({ toSceneId: "support", transitionIndex: 1 });
  });

  it("stops retrying a bounded edge and uses the next declared terminal route", () => {
    const boundedRetry: LessonScript = {
      ...script,
      sceneGraph: {
        ...script.sceneGraph!,
        transitions: [
          { fromSceneId: "check", toSceneId: "support", when: { kind: "always" }, maxTraversals: 1 },
          { fromSceneId: "check", terminal: true, when: { kind: "always" } },
          { fromSceneId: "support", toSceneId: "check", when: { kind: "always" }, maxTraversals: 1 },
          { fromSceneId: "done", terminal: true, when: { kind: "always" } },
        ],
      },
    };

    expect(resolveNextScene(boundedRetry, {
      currentSceneId: "check",
      branchPath: ["check", "support", "check"],
    }, emptyEvidence)).toMatchObject({
      terminal: true,
      toSceneId: null,
      transitionIndex: 1,
    });
  });

  it("retains implicit linear progression for legacy scripts", () => {
    const legacy = { ...script, sceneGraph: undefined };
    expect(resolveNextScene(legacy, { currentSceneId: "check", branchPath: ["check"] }, emptyEvidence))
      .toMatchObject({ toSceneId: "support", rationale: "implicit_linear_next" });
  });
});
