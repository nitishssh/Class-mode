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

export const sceneActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("speak"),
    agent: z.enum(["teacher", "classmate", "coach"]),
    text: z.string().min(1),
  }),
  z.object({
    type: z.literal("showSlide"),
    title: z.string().min(1),
    bullets: z.array(z.string()).max(6).default([]),
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
  }),
]);

export const lessonSceneSchema = z.object({
  id: z.string().min(1),
  actions: z.array(sceneActionSchema).min(1),
});

export const lessonScriptSchema = z.object({
  topic: z.string().min(1),
  conceptIds: z.array(z.string()).default([]),
  scenes: z.array(lessonSceneSchema).min(1),
});

export type SceneAction = z.infer<typeof sceneActionSchema>;
export type LessonScene = z.infer<typeof lessonSceneSchema>;
export type LessonScript = z.infer<typeof lessonScriptSchema>;

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

  return script;
}

// ── Attempt-first interaction (reuses the AI Tutor's Socratic prompt) ────────

export interface InteractionResult {
  feedback: string;
  /** Whether the student may proceed to the next scene. */
  proceed: boolean;
  /** Echoed attempt number so the client can escalate on retry. */
  attempt: number;
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

  return { feedback: content, proceed: true, attempt };
}
