import type { ClassModeAILessonDraft } from "@shared/classmode-ai";
import {
  ensureScriptA11y,
  lessonScriptSchema,
  type LessonScript,
  type SceneAction,
} from "./lesson-script";

function safeId(value: string, index: number): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
  return normalized || `scene-${index + 1}`;
}

function serverOwnedAssessment(subject: string, objective: string): {
  conceptId: string;
  action: SceneAction;
} | null {
  const haystack = `${subject} ${objective}`.toLowerCase();
  if (/linear equation|solve.*\bx\b/.test(haystack)) {
    return {
      conceptId: "linear-equations-isolation",
      action: {
        type: "assessment",
        agent: "teacher",
        assessmentId: "linear-equations-immediate",
        prompt: "Independent transfer check — no hints: solve 3x + 6 = 21. Enter x and briefly explain your steps.",
        gate: true,
      },
    };
  }
  if (/photosynth/.test(haystack)) {
    return {
      conceptId: "photosynthesis",
      action: {
        type: "assessment",
        agent: "teacher",
        assessmentId: "photosynthesis-transfer",
        prompt: "Independent transfer check — explain how light and carbon dioxide help a plant make glucose.",
        gate: true,
      },
    };
  }
  return null;
}

/** Converts untrusted AI presentation output into ClassMode's attempt-first contract. */
export function adaptClassModeAIDraft(input: {
  draft: ClassModeAILessonDraft;
  objective: string;
  subject: string;
}): LessonScript {
  const usedIds = new Set<string>();
  const scenes = input.draft.scenes.slice(0, 6).map((scene, index) => {
    let id = safeId(scene.id, index);
    while (usedIds.has(id)) id = `${id}-${index + 1}`;
    usedIds.add(id);
    const question = scene.questions[0];
    const bullets = scene.textBlocks.filter((text) => text !== scene.title).slice(0, 6);
    const actions: SceneAction[] = [];
    if (bullets.length || scene.kind === "slide") {
      actions.push({ type: "showSlide", title: scene.title, bullets });
    }
    actions.push(question
      ? {
          type: "ask",
          agent: "teacher",
          prompt: question.prompt.slice(0, 2000),
          expects: question.choices?.length ? "choice" : "freeText",
          ...(question.choices?.length ? { choices: question.choices.slice(0, 8) } : {}),
          ...(question.answerKey ? { answerKey: question.answerKey } : {}),
          gate: true,
        }
      : {
          type: "ask",
          agent: "teacher",
          prompt: `Before moving on, explain in your own words how “${scene.title}” supports this goal: ${input.objective}`.slice(0, 2000),
          expects: "freeText",
          gate: true,
        });
    return { id, actions };
  });

  const assessment = serverOwnedAssessment(input.subject, input.objective);
  if (assessment) {
    scenes.push({ id: "independent-transfer", actions: [assessment.action] });
  }
  return lessonScriptSchema.parse(ensureScriptA11y({
    topic: input.objective,
    conceptIds: assessment ? [assessment.conceptId] : [],
    ...(assessment ? { primaryConceptId: assessment.conceptId } : {}),
    scenes,
  }));
}
