/**
 * Study Arena — Attempt-First Lesson Script (Phase 1, "inspired by OpenMAIC").
 *
 * Inspired by OpenMAIC's action/playback engines (MIT, THU-MAIC — see
 * features/ai-classroom/studyArena/NOTICE.md), but deliberately NOT a copy.
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
import { aiChat } from "../../lib/openai";
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
    prompt: z.string().min(1),
    expects: z.enum(["freeText", "choice"]),
    choices: z.array(z.string()).optional(),
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
  const { content } = await aiChat(
    [{ role: "user", content: `Create the lesson for: ${topic}` }],
    systemPrompt
  );

  let parsed: unknown;
  try {
    parsed = parseScriptJson(content);
  } catch (err) {
    logger.error("[StudyArena/lesson-script] JSON parse failed", { error: String(err) });
    throw new Error("Failed to generate a valid lesson script", { cause: err });
  }

  const script = lessonScriptSchema.parse(parsed);

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
}

/**
 * Respond to a student's answer at a gated `ask`. Reuses the attempt-first
 * tutor prompt: never hands over the answer, nudges them forward. Phase 1 always
 * lets the student proceed after a genuine attempt (grading-gated progression is
 * Phase 2); empty/blank answers are sent back.
 */
export async function respondToInteraction(params: {
  topic: string;
  question: string;
  answer: string;
  language?: string;
}): Promise<InteractionResult> {
  const answer = params.answer.trim();
  if (answer.length === 0) {
    return { feedback: "Give it a try first — even a rough idea is fine. What's your thinking?", proceed: false };
  }

  const systemPrompt = buildTutorSystemPrompt({
    subject: params.topic,
    hintLevel: 1,
    language: params.language,
  });

  const { content } = await aiChat(
    [
      {
        role: "user",
        content: `The lesson asked me: "${params.question}"\nMy answer: "${answer}"\nIn ONE or two short sentences, tell me if I'm on the right track and nudge my thinking — do NOT give the full answer. End by encouraging me to continue.`,
      },
    ],
    systemPrompt
  );

  return { feedback: content, proceed: true };
}
