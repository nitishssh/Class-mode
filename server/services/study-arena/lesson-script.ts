/**
 * Study Arena — Attempt-First Lesson Script (Phase 1, "inspired by OpenMAIC").
 *
 * Inspired by OpenMAIC's action/playback engines (MIT, THU-MAIC — see
 * docs/OpenMAIC-ATTRIBUTION.md), but deliberately NOT a copy.
 * The difference is pedagogical: OpenMAIC's timeline plays straight through
 * (the AI lectures at the student). Ours inverts the loop — every scene ends in
 * a GATED `ask` that halts playback until the student attempts. That single move
 * turns passive lecture-playback into active, attempt-first learning, reusing
 * the same principle we shipped in the AI Tutor.
 *
 * See docs/study-arena-inspired-by-openmaic.md.
 */

import { z } from "zod";
import { jsonrepair } from "jsonrepair";
import { generate } from "../../lib/ai/gateway";
import { buildTutorSystemPrompt } from "../../lib/prompts/tutor";
import { logger } from "../../lib/logger";

// ── Scene-script contract (the one schema that makes it work) ────────────────

/** WCAG 2.2 AA / keyboard / aria-live contract for every interactive scene action. */
export const sceneActionA11ySchema = z.object({
  name: z.string().min(1),
  keyboardOperation: z.string().min(1),
  focusTarget: z.enum(["next-gate", "alert", "self"]).default("next-gate"),
  textAlternative: z.string().min(1),
  ariaLive: z.enum(["off", "polite", "assertive"]).default("polite"),
});

export type SceneActionA11y = z.infer<typeof sceneActionA11ySchema>;

export const sceneActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("speak"),
    agent: z.enum(["teacher", "classmate", "coach"]),
    text: z.string().min(1),
    a11y: sceneActionA11ySchema.optional(),
  }),
  z.object({
    type: z.literal("showSlide"),
    title: z.string().min(1),
    bullets: z.array(z.string()).max(6).default([]),
    a11y: sceneActionA11ySchema.optional(),
  }),
  z.object({
    // A semantic reference to content already rendered in the scene. The player
    // announces the focus; it never relies on colour alone to convey meaning.
    type: z.literal("highlight"),
    target: z.string().min(1).max(120),
    label: z.string().min(1).max(240),
    a11y: sceneActionA11ySchema.optional(),
  }),
  z.object({
    type: z.literal("ask"),
    agent: z.enum(["teacher", "classmate", "coach"]),
    // Cap the prompt so the client (which echoes it back to /interaction,
    // where question is capped at 2000) can never 400-loop on a long prompt.
    prompt: z.string().min(1).max(2000),
    expects: z.enum(["freeText", "choice"]),
    choices: z.array(z.string().min(1)).optional(),
    // The gate: playback MUST stop here until the student responds.
    gate: z.literal(true),
    a11y: sceneActionA11ySchema.optional(),
  }),
  z.object({
    // An independent retrieval check. Unlike an `ask`, this is graded locally
    // by the server and never receives an AI-generated response.
    type: z.literal("assessment"),
    agent: z.enum(["teacher", "classmate", "coach"]),
    prompt: z.string().min(1).max(2000),
    assessmentId: z.enum([
      "linear-equations-immediate",
      "linear-equations-delayed",
      "photosynthesis-transfer",
      "english-reading-inference",
      "social-studies-causation",
    ]),
    gate: z.literal(true),
    a11y: sceneActionA11ySchema.optional(),
  }),
]);

/** Fills WCAG defaults so every action has a usable accessible name and live region. */
export function ensureActionA11y(
  action: z.infer<typeof sceneActionSchema>
): z.infer<typeof sceneActionSchema> {
  if (action.a11y) {
    return { ...action, a11y: sceneActionA11ySchema.parse(action.a11y) };
  }
  switch (action.type) {
    case "speak":
      return {
        ...action,
        a11y: {
          name: `${action.agent} narration`,
          keyboardOperation: "Listen; press Tab to move to the next control",
          focusTarget: "next-gate",
          textAlternative: action.text,
          ariaLive: "polite",
        },
      };
    case "showSlide":
      return {
        ...action,
        a11y: {
          name: action.title,
          keyboardOperation: "Read slide content; press Tab to continue",
          focusTarget: "next-gate",
          textAlternative: [action.title, ...action.bullets].join(". "),
          ariaLive: "polite",
        },
      };
    case "highlight":
      return {
        ...action,
        a11y: {
          name: action.label,
          keyboardOperation: "Focus moves to the highlighted content",
          focusTarget: "self",
          textAlternative: action.label,
          ariaLive: "polite",
        },
      };
    case "ask":
      return {
        ...action,
        a11y: {
          name: "Attempt gate",
          keyboardOperation:
            action.expects === "choice"
              ? "Use arrow keys or Tab to choose an option, then Enter to submit"
              : "Type your answer, then press Enter or activate Submit",
          focusTarget: "self",
          textAlternative: action.prompt,
          ariaLive: "polite",
        },
      };
    case "assessment":
      return {
        ...action,
        a11y: {
          name: "Independent assessment",
          keyboardOperation: "Type your answer, then press Enter or activate Submit",
          focusTarget: "self",
          textAlternative: action.prompt,
          ariaLive: "assertive",
        },
      };
  }
}

/** Ensures every action in a script carries a11y defaults (templates + generated). */
export function ensureScriptA11y<T extends { scenes: Array<{ actions: Array<z.infer<typeof sceneActionSchema>> }> }>(
  script: T
): T {
  return {
    ...script,
    scenes: script.scenes.map((scene) => ({
      ...scene,
      actions: scene.actions.map((action) => ensureActionA11y(action)),
    })),
  };
}

export const lessonSceneSchema = z.object({
  id: z.string().min(1),
  actions: z.array(sceneActionSchema).min(1),
});

/**
 * Predicates are declarations only. The future server-owned scene director
 * evaluates them against trusted evidence; a player must never choose an edge.
 */
export const sceneTransitionPredicateSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("always") }),
  z.object({
    kind: z.literal("assessment_result"),
    assessmentId: z.string().min(1).optional(),
    correct: z.boolean(),
  }),
  z.object({
    kind: z.literal("help_depth"),
    operator: z.enum(["gte", "lt"]),
    value: z.number().int().min(1).max(20),
  }),
  z.object({
    kind: z.literal("mastery"),
    conceptId: z.string().min(1),
    operator: z.enum(["gte", "lt"]),
    value: z.number().min(0).max(1),
  }),
  z.object({
    kind: z.literal("prerequisite_mastery"),
    conceptId: z.string().min(1),
    operator: z.enum(["gte", "lt"]),
    value: z.number().min(0).max(1),
  }),
]);

export const sceneTransitionSchema = z
  .object({
    fromSceneId: z.string().min(1),
    toSceneId: z.string().min(1).optional(),
    terminal: z.literal(true).optional(),
    when: sceneTransitionPredicateSchema.default({ kind: "always" }),
    // Cycles are allowed only when every participating transition is explicitly
    // bounded. The director will later enforce this limit from persisted state.
    maxTraversals: z.number().int().min(1).max(20).optional(),
  })
  .superRefine((transition, ctx) => {
    if ((transition.toSceneId === undefined) === (transition.terminal === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A transition must declare exactly one of toSceneId or terminal: true",
        path: ["toSceneId"],
      });
    }
  });

export const lessonSceneGraphSchema = z.object({
  version: z.literal("v1"),
  entrySceneId: z.string().min(1),
  transitions: z.array(sceneTransitionSchema).min(1).max(100),
});

export type SceneTransitionPredicate = z.infer<typeof sceneTransitionPredicateSchema>;
export type SceneTransition = z.infer<typeof sceneTransitionSchema>;
export type LessonSceneGraph = z.infer<typeof lessonSceneGraphSchema>;

type SceneGraphValidationInput = {
  scenes: Array<{ id: string; actions: Array<{ type: string }> }>;
  sceneGraph?: LessonSceneGraph;
};

/**
 * Validates the immutable graph a teacher is about to publish. Scripts without
 * a graph retain legacy linear behavior: each scene implicitly leads to the
 * following scene and the final scene is terminal.
 */
export function validateLessonSceneGraph(
  script: SceneGraphValidationInput,
  ctx: z.RefinementCtx
): void {
  const sceneIds = script.scenes.map((scene) => scene.id);
  const knownSceneIds = new Set(sceneIds);
  const duplicateIds = sceneIds.filter((id, index) => sceneIds.indexOf(id) !== index);
  for (const id of new Set(duplicateIds)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Scene ID "${id}" must be unique`,
      path: ["scenes"],
    });
  }

  const graph = script.sceneGraph;
  if (!graph || duplicateIds.length > 0) return;

  if (!knownSceneIds.has(graph.entrySceneId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Entry scene "${graph.entrySceneId}" does not exist`,
      path: ["sceneGraph", "entrySceneId"],
    });
  }

  const transitionsByScene = new Map<string, SceneTransition[]>();
  const adjacency = new Map<string, string[]>();
  const reverseAdjacency = new Map<string, string[]>();
  const terminalScenes = new Set<string>();
  for (const sceneId of sceneIds) {
    adjacency.set(sceneId, []);
    reverseAdjacency.set(sceneId, []);
  }

  graph.transitions.forEach((transition, index) => {
    if (!knownSceneIds.has(transition.fromSceneId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Transition source "${transition.fromSceneId}" does not exist`,
        path: ["sceneGraph", "transitions", index, "fromSceneId"],
      });
      return;
    }
    const sourceTransitions = transitionsByScene.get(transition.fromSceneId) ?? [];
    sourceTransitions.push(transition);
    transitionsByScene.set(transition.fromSceneId, sourceTransitions);

    if (transition.terminal) terminalScenes.add(transition.fromSceneId);
    if (!transition.toSceneId) return;
    if (!knownSceneIds.has(transition.toSceneId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Transition target "${transition.toSceneId}" does not exist`,
        path: ["sceneGraph", "transitions", index, "toSceneId"],
      });
      return;
    }
    adjacency.get(transition.fromSceneId)?.push(transition.toSceneId);
    reverseAdjacency.get(transition.toSceneId)?.push(transition.fromSceneId);
  });

  if (!knownSceneIds.has(graph.entrySceneId)) return;

  const reachable = new Set<string>();
  const pending = [graph.entrySceneId];
  while (pending.length) {
    const sceneId = pending.pop()!;
    if (reachable.has(sceneId)) continue;
    reachable.add(sceneId);
    for (const target of adjacency.get(sceneId) ?? []) pending.push(target);
  }
  for (const sceneId of sceneIds) {
    if (!reachable.has(sceneId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Scene "${sceneId}" is not reachable from the entry scene`,
        path: ["sceneGraph"],
      });
    }
  }

  const assessmentScenes = new Set(
    script.scenes
      .filter((scene) => scene.actions.some((action) => action.type === "assessment"))
      .map((scene) => scene.id)
  );
  const successfulEndings = new Set([...assessmentScenes, ...terminalScenes]);
  const canReachEnding = new Set(successfulEndings);
  const endingPending = [...successfulEndings];
  while (endingPending.length) {
    const sceneId = endingPending.pop()!;
    for (const source of reverseAdjacency.get(sceneId) ?? []) {
      if (!canReachEnding.has(source)) {
        canReachEnding.add(source);
        endingPending.push(source);
      }
    }
  }
  for (const sceneId of reachable) {
    if (!canReachEnding.has(sceneId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Scene "${sceneId}" cannot reach an independent assessment or terminal transition`,
        path: ["sceneGraph"],
      });
    }
  }

  // An edge belongs to a cycle if its target can reach its source. Requiring a
  // traversal cap on each such edge prevents an authoring mistake from creating
  // an endlessly routable lesson while still allowing bounded retry loops.
  const hasPath = (from: string, to: string): boolean => {
    const seen = new Set<string>();
    const stack = [from];
    while (stack.length) {
      const current = stack.pop()!;
      if (current === to) return true;
      if (seen.has(current)) continue;
      seen.add(current);
      for (const next of adjacency.get(current) ?? []) stack.push(next);
    }
    return false;
  };
  graph.transitions.forEach((transition, index) => {
    if (
      transition.toSceneId &&
      knownSceneIds.has(transition.fromSceneId) &&
      knownSceneIds.has(transition.toSceneId) &&
      hasPath(transition.toSceneId, transition.fromSceneId) &&
      transition.maxTraversals === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Every transition in a cycle must declare maxTraversals",
        path: ["sceneGraph", "transitions", index, "maxTraversals"],
      });
    }
  });
}

export const lessonScriptSchema = z
  .object({
  topic: z.string().min(1),
  conceptIds: z.array(z.string()).default([]),
  primaryConceptId: z.string().min(1).optional(),
  scenes: z.array(lessonSceneSchema).min(1),
    sceneGraph: lessonSceneGraphSchema.optional(),
  })
  .superRefine(validateLessonSceneGraph);

export type SceneAction = z.infer<typeof sceneActionSchema>;
export type LessonScene = z.infer<typeof lessonSceneSchema>;
export type LessonScript = z.infer<typeof lessonScriptSchema>;

export const sourceSpanSchema = z.object({
  sourceLabel: z.string().min(1).max(200),
  sourceLocator: z.string().max(500).optional(),
  excerpt: z.string().min(20).max(4000),
});

export const scienceTemplateSchema = z.object({
  templateId: z.literal("science-explanation-v1"),
  objectiveTaxonomy: z.enum(["predict", "explain-cause-effect", "interpret-observation"]),
  sourceSpans: z.array(sourceSpanSchema).min(1),
  evaluatorVersion: z.literal("science-explanation-v1"),
});
export type ScienceTemplate = z.infer<typeof scienceTemplateSchema>;

/**
 * English and Social Studies pilots use source-grounded, structured responses.
 * Their evaluator targets stay in lesson-version metadata rather than the scene
 * JSON, so students never receive an answer key with an assigned segment.
 */
export const englishTemplateSchema = z.object({
  templateId: z.literal("english-reading-inference-v1"),
  objectiveTaxonomy: z.enum(["identify-central-idea", "make-textual-inference", "analyze-claim-evidence"]),
  sourceSpans: z.array(sourceSpanSchema).min(1),
  evaluatorVersion: z.literal("english-reading-inference-v1"),
  evaluationTargets: z.object({
    acceptedInferences: z.array(z.string().min(2).max(200)).min(1).max(8),
    requiredEvidenceTerms: z.array(z.string().min(2).max(100)).min(1).max(8),
  }),
});
export type EnglishTemplate = z.infer<typeof englishTemplateSchema>;

export const socialStudiesTemplateSchema = z.object({
  templateId: z.literal("social-studies-causation-v1"),
  objectiveTaxonomy: z.enum(["chronological-reasoning", "analyze-source-perspective", "explain-cause-effect"]),
  sourceSpans: z.array(sourceSpanSchema).min(1),
  evaluatorVersion: z.literal("social-studies-causation-v1"),
  evaluationTargets: z.object({
    acceptedCauses: z.array(z.string().min(2).max(200)).min(1).max(8),
    acceptedEffects: z.array(z.string().min(2).max(200)).min(1).max(8),
  }),
});
export type SocialStudiesTemplate = z.infer<typeof socialStudiesTemplateSchema>;

export const subjectTemplateSchema = z.discriminatedUnion("templateId", [
  scienceTemplateSchema,
  englishTemplateSchema,
  socialStudiesTemplateSchema,
]);
export type SubjectTemplate = z.infer<typeof subjectTemplateSchema>;

export function subjectForTemplate(template: SubjectTemplate): string {
  switch (template.templateId) {
    case "science-explanation-v1":
      return "science";
    case "english-reading-inference-v1":
      return "english";
    case "social-studies-causation-v1":
      return "social studies";
  }
}

export function requiredAssessmentForTemplate(
  template: SubjectTemplate
): "photosynthesis-transfer" | "english-reading-inference" | "social-studies-causation" {
  switch (template.templateId) {
    case "science-explanation-v1":
      return "photosynthesis-transfer";
    case "english-reading-inference-v1":
      return "english-reading-inference";
    case "social-studies-causation-v1":
      return "social-studies-causation";
  }
}

export const LINEAR_EQUATIONS_SPRINT_TOPIC = "Linear equations";

/**
 * A deterministic first pilot, rather than a model-generated lesson. Keeping
 * the practice and transfer item stable is essential when evaluating whether
 * the attempt-first harness improves independent learning.
 */
export function createLinearEquationsSprint(): LessonScript {
  return ensureScriptA11y({
    topic: LINEAR_EQUATIONS_SPRINT_TOPIC,
    conceptIds: ["linear-equations-isolation"],
    scenes: [
      {
        id: "balance",
        actions: [
          {
            type: "showSlide",
            title: "Keep both sides balanced",
            bullets: [
              "An equation says two expressions have the same value.",
              "Whatever you do to one side, do to the other.",
              "Your goal is to get x on its own.",
            ],
          },
          {
            type: "ask",
            agent: "teacher",
            prompt: "For x + 4 = 11, what would you do first to get x by itself? Explain why.",
            expects: "freeText",
            gate: true,
          },
        ],
      },
      {
        id: "inverse-operations",
        actions: [
          {
            type: "speak",
            agent: "coach",
            text: "Use inverse operations in reverse order: undo addition or subtraction before undoing multiplication.",
          },
          {
            type: "ask",
            agent: "teacher",
            prompt: "Solve 2x + 5 = 17. Show the two operations you would undo.",
            expects: "freeText",
            gate: true,
          },
        ],
      },
      {
        id: "immediate-transfer",
        actions: [
          {
            type: "assessment",
            agent: "teacher",
            assessmentId: "linear-equations-immediate",
            prompt:
              "Independent check — no hints this time: solve 3x + 6 = 21. Enter the value of x and a short reason.",
            gate: true,
          },
        ],
      },
    ],
  });
}

/** A scheduled, no-AI recall check that follows the initial sprint after 72 hours. */
export function createLinearEquationsDelayedCheck(): LessonScript {
  return ensureScriptA11y({
    topic: LINEAR_EQUATIONS_SPRINT_TOPIC,
    conceptIds: ["linear-equations-isolation"],
    scenes: [
      {
        id: "delayed-transfer",
        actions: [
          {
            type: "assessment",
            agent: "teacher",
            assessmentId: "linear-equations-delayed",
            prompt:
              "Delayed recall check — no hints or notes: solve 4x - 5 = 23. Enter the value of x.",
            gate: true,
          },
        ],
      },
    ],
  });
}

const LINEAR_EQUATIONS_ANSWERS = {
  "linear-equations-immediate": 5,
  "linear-equations-delayed": 7,
} as const;

export type LinearEquationsAssessmentId = keyof typeof LINEAR_EQUATIONS_ANSWERS;

/**
 * Accept common answer forms such as `5`, `x = 5`, or `x=5`. This deliberately
 * grades a small fixed pilot item without asking an LLM to judge its own help.
 */
export function gradeLinearEquationsAssessment(
  assessmentId: LinearEquationsAssessmentId,
  answer: string
): boolean {
  const normalized = answer.trim().replace(/\s/g, "").replace(/^x=/i, "");
  return Number(normalized) === LINEAR_EQUATIONS_ANSWERS[assessmentId];
}

export interface GenerateLessonOptions {
  language?: string;
  /** Roughly how many teach→ask scenes to produce. */
  sceneCount?: number;
}

// ── Generation ───────────────────────────────────────────────────────────────

function buildGenerationPrompt(topic: string, opts: GenerateLessonOptions): string {
  const sceneCount = Math.min(Math.max(opts.sceneCount ?? 4, 2), 8);
  const langLine = opts.language
    ? `Write the lesson in ${opts.language}, but keep technical terms in their standard form.`
    : "";
  return [
    `You are designing a short, interactive school lesson on: "${topic}".`,
    `Produce EXACTLY ${sceneCount} scenes. ${langLine}`,
    ``,
    `Each scene teaches ONE small idea and then makes the student DO something. Rules:`,
    `- Begin a scene with 1 "showSlide" (a title + up to 4 short bullets) and/or 1-2 short "speak" actions from the "teacher".`,
    `- You MAY add one "speak" from a "classmate" that asks a natural beginner question, or a "coach" that gives a study tip.`,
    `- END EVERY SCENE with exactly one "ask" action with "gate": true. The ask must require the student to think — solve a step, predict an outcome, or explain in their own words. NEVER hand them the answer in the ask.`,
    `- Keep every text field short (1-3 sentences). No long lectures.`,
    `- "expects" is "freeText" normally; use "choice" with a "choices" array only for genuine multiple-choice checks.`,
    ``,
    `Return ONLY valid JSON (no markdown fences) of the form:`,
    `{"topic": string, "conceptIds": string[], "scenes": [{"id": string, "actions": [ ... ]}]}`,
    `Action shapes:`,
    `{"type":"speak","agent":"teacher|classmate|coach","text":string}`,
    `{"type":"showSlide","title":string,"bullets":string[]}`,
    `{"type":"ask","agent":"teacher|classmate|coach","prompt":string,"expects":"freeText|choice","choices":string[]?,"gate":true}`,
  ].join("\n");
}

function parseScriptJson(raw: string): unknown {
  let text = raw.trim();
  // Strip accidental code fences.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  try {
    return JSON.parse(text);
  } catch {
    return JSON.parse(jsonrepair(text));
  }
}

/**
 * Generate an attempt-first lesson script for a topic.
 * Guarantees (via post-processing) that every scene ends in a gated `ask`.
 */
export async function generateLessonScript(
  topic: string,
  opts: GenerateLessonOptions = {}
): Promise<LessonScript> {
  const systemPrompt = buildGenerationPrompt(topic, opts);
  const content = await generate({
    model: "fast",
    fallback: "orchestrator",
    system: systemPrompt,
    messages: [{ role: "user", content: `Create the lesson for: ${topic}` }],
    feature: "lesson_script",
  });

  let parsed: unknown;
  try {
    parsed = parseScriptJson(content);
  } catch (err) {
    logger.error("[StudyArena/lesson-script] JSON parse failed", { error: String(err) });
    throw new Error("Failed to generate a valid lesson script", { cause: err });
  }

  const script = lessonScriptSchema.parse(parsed);

  // Sanitize gated asks before the client ever sees them. A "choice" ask with
  // fewer than 2 options renders zero buttons and no textarea — an unpassable
  // gate that hard-locks the lesson. Degrade it to a free-text attempt instead
  // of dropping the scene, so the student can still answer.
  for (const scene of script.scenes) {
    for (const action of scene.actions) {
      if (action.type === "ask" && action.expects === "choice" && (action.choices?.length ?? 0) < 2) {
        action.expects = "freeText";
        delete action.choices;
      }
    }
  }

  // Clamp the topic to the /interaction route's cap (300) so echoing it back
  // from the client can never 400 every gate.
  if (script.topic.length > 300) {
    script.topic = script.topic.slice(0, 300);
  }

  // Safety net: enforce the inverted loop even if the model slips — drop any
  // scene that has no gated ask rather than letting it lecture without a gate.
  script.scenes = script.scenes.filter((scene) =>
    scene.actions.some((a) => a.type === "ask" && a.gate === true)
  );
  if (script.scenes.length === 0) {
    throw new Error("Generated lesson had no interactive checkpoints");
  }

  return ensureScriptA11y(script);
}

// ── Attempt-first interaction (reuses the AI Tutor's Socratic prompt) ────────

export interface InteractionResult {
  feedback: string;
  /** Whether the student may proceed to the next scene. */
  proceed: boolean;
  /** Echoed attempt number so the client can escalate on retry. */
  attempt: number;
}

const SAFE_FEEDBACK_FALLBACK =
  "I couldn't make a useful hint this time. Try explaining one part you do understand, then continue when you're ready.";

export function sanitizeTutorFeedback(value: string): string {
  const feedback = value.replace(/\s+/g, " ").trim().slice(0, 800);
  if (!feedback) return SAFE_FEEDBACK_FALLBACK;
  if (
    /\b(as an ai|language model|cannot (?:assist|help|comply)|can't (?:assist|help|comply)|policy|safety guidelines)\b/i.test(
      feedback
    )
  ) {
    return SAFE_FEEDBACK_FALLBACK;
  }
  return feedback;
}

/**
 * The escalating-support ladder for a stuck student. This is an EFFORT gate,
 * not a correctness gate: a genuine attempt always earns `proceed: true`, so
 * the student is never trapped. But repeated attempts at the SAME gate escalate
 * how much the tutor helps — a gentle nudge first, a concrete scaffolded hint
 * next, then reveal-and-explain-back — so a student who can't answer gets more
 * support instead of the same rejection.
 */
function laddedInstruction(attempt: number): string {
  if (attempt <= 1) {
    return "In ONE or two short sentences, tell me if I'm on the right track and nudge my thinking — do NOT give the full answer. End by encouraging me to try or to continue.";
  }
  if (attempt === 2) {
    return "I tried again and I'm still stuck. Give me ONE concrete, scaffolded hint that points at the very next step — still do NOT hand me the full answer. Keep it to two short sentences and warm.";
  }
  return "I've tried a few times and I'm struggling. Reveal the key idea in one short, plain sentence, then ask me to explain it back in my own words so I still have to think. Be encouraging, not disappointed.";
}

/**
 * Respond to a student's answer at a gated `ask`. Reuses the attempt-first
 * tutor prompt and applies the support ladder above. Empty/blank answers are
 * sent back without proceeding (and without spending an LLM call).
 */
export async function respondToInteraction(params: {
  topic: string;
  question: string;
  answer: string;
  language?: string;
  /** 1-based attempt count at this gate; escalates the hint ladder. */
  attempt?: number;
}): Promise<InteractionResult> {
  const attempt = Math.max(1, Math.floor(params.attempt ?? 1));
  const answer = params.answer.trim();
  if (answer.length === 0) {
    return {
      feedback: "Give it a try first — even a rough idea is fine. What's your thinking?",
      proceed: false,
      attempt,
    };
  }

  // hintLevel tracks the attempt so the reused tutor prompt loosens up too.
  const hintLevel = (attempt >= 3 ? 3 : attempt === 2 ? 2 : 1) as 1 | 2 | 3;
  const systemPrompt = buildTutorSystemPrompt({
    subject: params.topic,
    hintLevel,
    language: params.language,
  });

  const content = await generate({
    model: "fast",
    fallback: "orchestrator",
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `The lesson asked me: "${params.question}"\nMy answer: "${answer}"\n${laddedInstruction(attempt)}`,
      },
    ],
    feature: "lesson_interaction",
  });

  return { feedback: sanitizeTutorFeedback(content), proceed: true, attempt };
}
