import { describe, expect, it } from "vitest";
import { adaptClassModeAIDraft } from "../services/study-arena/classmode-ai-adapter";

describe("ClassMode AI lesson adapter", () => {
  it("turns presentation output into gated attempts and a server-owned transfer check", () => {
    const script = adaptClassModeAIDraft({
      subject: "Mathematics",
      objective: "Solve linear equations for x",
      draft: {
        classroomId: "room-1",
        scenes: [
          {
            id: "balance",
            title: "Balance both sides",
            kind: "slide",
            textBlocks: ["Do the same operation on each side."],
            questions: [],
          },
        ],
      },
    });
    expect(script.primaryConceptId).toBe("linear-equations-isolation");
    expect(script.scenes[0].actions.at(-1)).toMatchObject({ type: "ask", gate: true });
    expect(script.scenes.at(-1)?.actions[0]).toMatchObject({
      type: "assessment",
      assessmentId: "linear-equations-immediate",
      gate: true,
    });
    expect(JSON.stringify(script)).not.toContain("secret-solution");
  });

  it("does not invent mastery authority for an unsupported subject", () => {
    const script = adaptClassModeAIDraft({
      subject: "Art",
      objective: "Compare two compositions",
      draft: {
        classroomId: "room-2",
        scenes: [
          { id: "compare", title: "Composition", kind: "slide", textBlocks: [], questions: [] },
        ],
      },
    });
    expect(script.conceptIds).toEqual([]);
    expect(
      script.scenes.flatMap((scene) => scene.actions).some((action) => action.type === "assessment")
    ).toBe(false);
  });
});
