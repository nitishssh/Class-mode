/**
 * Study Arena Generator — Ported from features/ai-classroom/studyArena
 * 
 * This is the core generation pipeline adapted for PersonalLearningPro's
 * Express server. It replaces the Vercel AI SDK with the existing OpenAI
 * SDK already in server/lib/openai.ts.
 * 
 * Pipeline:
 *   1. Generate agent profiles (optional LLM call)
 *   2. Generate scene outlines from requirement (1 LLM call)
 *   3. For each outline: generate content + actions (2 LLM calls per scene)
 * 
 * Source: features/ai-classroom/studyArena/lib/server/classroom-generation.ts
 */

import OpenAI from "openai";
import { nanoid } from "nanoid";
import { logger } from "../../lib/logger";
import { buildPrompt } from "../../lib/prompt-loader";
import { geminiChat } from "../../lib/gemini";
import type {
  AgentInfo,
  SceneOutline,
  GeneratedScene,
  ClassroomData,
  AICallFn,
  ClassroomGenerationProgress,
} from "./types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

const LLM_TIMEOUT_MS = 120_000;
const PARALLEL_SCENE_BATCH_SIZE = 3;

// ── LLM Adapter ──────────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`LLM call timed out after ${ms}ms: ${label}`)), ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

function createAICallFn(): AICallFn {
  const hasGemini = !!process.env.GOOGLE_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;

  return async (systemPrompt: string, userPrompt: string): Promise<string> => {
    const label = userPrompt.substring(0, 60);

    if (hasGemini) {
      try {
        return await withTimeout(geminiChat(systemPrompt, userPrompt), LLM_TIMEOUT_MS, label);
      } catch (err) {
        logger.warn("[StudyArena] Gemini call failed, falling back to OpenAI if available:", err);
        if (!hasOpenAI) throw err;
      }
    }

    const response = await withTimeout(
      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 16384,
      }),
      LLM_TIMEOUT_MS,
      label,
    );
    return response.choices[0].message.content || "";
  };
}

// ── JSON Repair ──────────────────────────────────────────────────────────────
// Ported from features/ai-classroom/studyArena/lib/generation/json-repair.ts

function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }
  return cleaned.trim();
}

function parseJsonResponse<T>(text: string): T | null {
  try {
    const cleaned = stripCodeFences(text);
    return JSON.parse(cleaned) as T;
  } catch {
    // Try to extract JSON from mixed content
    const jsonMatch = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ── Default Agents ───────────────────────────────────────────────────────────
// Ported from features/ai-classroom/studyArena/lib/orchestration/registry/

const DEFAULT_AGENTS: AgentInfo[] = [
  {
    id: "teacher-1",
    name: "Professor",
    role: "teacher",
    persona: "An experienced and enthusiastic teacher who explains concepts clearly with real-world examples. Uses visual aids and analogies to make complex topics accessible.",
  },
  {
    id: "student-1",
    name: "Alex",
    role: "student",
    persona: "A curious and engaged student who asks clarifying questions and connects new concepts to prior knowledge. Helps other students understand by rephrasing explanations.",
  },
];

// ── Agent Profile Generation ─────────────────────────────────────────────────
// Ported from features/ai-classroom/studyArena/lib/server/classroom-generation.ts

async function generateAgentProfiles(
  requirement: string,
  aiCall: AICallFn,
): Promise<AgentInfo[]> {
  const systemPrompt =
    'You are an expert instructional designer. Generate agent profiles for a multi-agent classroom simulation. Return ONLY valid JSON, no markdown or explanation.';

  const userPrompt = `Generate agent profiles for a course with this requirement:
${requirement}

Requirements:
- Decide the appropriate number of agents based on the course content (typically 3-5)
- Exactly 1 agent must have role "teacher", the rest can be "assistant" or "student"
- Each agent needs: name, role, persona (2-3 sentences describing personality and teaching/learning style)

Return a JSON object with this exact structure:
{
  "agents": [
    {
      "name": "string",
      "role": "teacher" | "assistant" | "student",
      "persona": "string (2-3 sentences)"
    }
  ]
}`;

  try {
    const response = await aiCall(systemPrompt, userPrompt);
    const rawText = stripCodeFences(response);
    const parsed = JSON.parse(rawText) as {
      agents: Array<{ name: string; role: string; persona: string }>;
    };

    if (!parsed.agents || !Array.isArray(parsed.agents) || parsed.agents.length < 2) {
      throw new Error(`Expected at least 2 agents, got ${parsed.agents?.length ?? 0}`);
    }

    return parsed.agents.map((a, i) => ({
      id: `gen-${i}`,
      name: a.name,
      role: a.role as 'teacher' | 'assistant' | 'student',
      persona: a.persona,
    }));
  } catch (err) {
    logger.warn("Agent profile generation failed, using defaults:", err);
    return DEFAULT_AGENTS;
  }
}

// ── Outline Generation (Stage 1) ────────────────────────────────────────────
// Ported from features/ai-classroom/studyArena/lib/generation/outline-generator.ts

async function generateOutlines(
  requirement: string,
  aiCall: AICallFn,
  agents: AgentInfo[],
): Promise<{ languageDirective: string; outlines: SceneOutline[] }> {
  const teacherAgent = agents.find((a) => a.role === "teacher");
  const teacherContext = teacherAgent
    ? `Teacher: ${teacherAgent.name} — ${teacherAgent.persona}`
    : "";

  const prompt = buildPrompt("requirements-to-outlines", {
    requirement,
    pdfContent: "None",
    availableImages: "No images available",
    userProfile: "",
    mediaGenerationPolicy:
      "Do NOT include any mediaGenerations in the outlines. Both image and video generation are disabled.",
    researchContext: "None",
    teacherContext,
  });

  if (!prompt) {
    throw new Error("Prompt template 'requirements-to-outlines' not found");
  }

  const response = await aiCall(prompt.system, prompt.user || "Generate outlines for this topic.");
  const parsed = parseJsonResponse<
    { languageDirective: string; outlines: SceneOutline[] } | SceneOutline[]
  >(response);

  let languageDirective: string;
  let rawOutlines: SceneOutline[];

  if (Array.isArray(parsed)) {
    languageDirective = "Teach in the language that matches the user requirement.";
    rawOutlines = parsed;
  } else if (parsed && parsed.outlines) {
    languageDirective = parsed.languageDirective || "Teach in English.";
    rawOutlines = parsed.outlines;
  } else {
    throw new Error("Failed to parse scene outlines response");
  }

  const enriched = rawOutlines.map((outline, index) => ({
    ...outline,
    id: outline.id || nanoid(),
    order: index + 1,
  }));

  return { languageDirective, outlines: enriched };
}

// ── Scene Content Generation (Stage 2) ──────────────────────────────────────
// Ported from features/ai-classroom/studyArena/lib/generation/scene-generator.ts

async function generateSlideContent(
  outline: SceneOutline,
  aiCall: AICallFn,
  agents: AgentInfo[],
): Promise<any> {
  const teacherAgent = agents.find((a) => a.role === "teacher");
  const teacherContext = teacherAgent
    ? `Teacher: ${teacherAgent.name} — ${teacherAgent.persona}`
    : "";

  const prompt = buildPrompt("slide-content", {
    title: outline.title,
    description: outline.description,
    keyPoints: (outline.keyPoints || []).map((p, i) => `${i + 1}. ${p}`).join("\n"),
    elements: "(auto-generated from key points)",
    assignedImages: "No images available. Do not insert any image elements.",
    canvas_width: 1000,
    canvas_height: 562.5,
    teacherContext,
  });

  if (!prompt) return null;

  const response = await aiCall(prompt.system, prompt.user || "Generate slide content.");
  return parseJsonResponse(response);
}

async function generateQuizContent(
  outline: SceneOutline,
  aiCall: AICallFn,
): Promise<any> {
  const quizConfig = outline.quizConfig || {
    questionCount: 3,
    difficulty: "medium",
    questionTypes: ["single"],
  };

  const prompt = buildPrompt("quiz-content", {
    title: outline.title,
    description: outline.description,
    keyPoints: (outline.keyPoints || []).map((p, i) => `${i + 1}. ${p}`).join("\n"),
    questionCount: quizConfig.questionCount,
    difficulty: quizConfig.difficulty,
    questionTypes: quizConfig.questionTypes.join(", "),
  });

  if (!prompt) return null;

  const response = await aiCall(prompt.system, prompt.user || "Generate quiz content.");
  return parseJsonResponse(response);
}

// ── Interactive HTML Processing ─────────────────────────────────────────────
// Ported from features/ai-classroom/studyArena/lib/generation/interactive-post-processor.ts

function sanitizeGeneratedHtml(html: string): string {
  let sanitized = html;
  sanitized = sanitized.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, (match) => {
    if (/src\s*=\s*["'][^"']*cdn\.jsdelivr\.net/i.test(match)) return match;
    if (/renderMathInElement|katex|MathJax/i.test(match)) return match;
    if (/document\.addEventListener|querySelector|getElementById|className|style\./i.test(match)) return match;
    if (/fetch\s*\(|XMLHttpRequest|eval\s*\(|Function\s*\(|import\s*\(/i.test(match)) return '';
    return match;
  });
  sanitized = sanitized.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '');
  sanitized = sanitized.replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '');
  sanitized = sanitized.replace(/<embed[^>]*\/?>/gi, '');
  sanitized = sanitized.replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '');
  return sanitized;
}

function postProcessInteractiveHtml(html: string): string {
  let processed = sanitizeGeneratedHtml(html);
  processed = processed.replace(/\$\$([^$]+)\$\$/g, '\\[$1\\]');
  processed = processed.replace(/\$([^$\n]+?)\$/g, '\\($1\\)');

  // Inject KaTeX resources
  const katexInjection = `
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
<script>
document.addEventListener("DOMContentLoaded", function() {
    renderMathInElement(document.body, {
        delimiters: [
            {left: '\\\\[', right: '\\\\]', display: true},
            {left: '\\\\(', right: '\\\\)', display: false},
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false}
        ]
    });
});
</script>`;

  if (processed.includes("</head>")) {
    return processed.replace("</head>", `${katexInjection}\n</head>`);
  }
  return processed + katexInjection;
}

function extractHtml(response: string): string | null {
  const doctypeStart = response.indexOf('<!DOCTYPE html>');
  const htmlTagStart = response.indexOf('<html');
  const start = doctypeStart !== -1 ? doctypeStart : htmlTagStart;

  if (start !== -1) {
    const htmlEnd = response.lastIndexOf('</html>');
    if (htmlEnd !== -1) {
      return response.substring(start, htmlEnd + 7);
    }
  }

  const codeBlockMatch = response.match(/```(?:html)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();

  return null;
}

async function generateInteractiveContent(
  outline: SceneOutline,
  aiCall: AICallFn,
): Promise<any> {
  const config = outline.interactiveConfig;
  if (!config) return null;

  // Step 1: Scientific modeling (simplified)
  const modelPrompt = buildPrompt("interactive-scientific-model", {
    subject: config.subject || "",
    conceptName: config.conceptName,
    conceptOverview: config.conceptOverview,
    keyPoints: (outline.keyPoints || []).map((p, i) => `${i + 1}. ${p}`).join("\n"),
    designIdea: config.designIdea,
  });

  let scientificConstraints = "No specific scientific constraints available.";
  if (modelPrompt) {
    try {
      const res = await aiCall(modelPrompt.system, modelPrompt.user || "");
      const parsed = parseJsonResponse<any>(res);
      if (parsed?.core_formulas) {
        scientificConstraints = `Core Formulas: ${parsed.core_formulas.join("; ")}\nConstraints: ${parsed.constraints?.join("; ") || ""}`;
      }
    } catch (err) {
      logger.warn("[StudyArena] Scientific model generation failed, using defaults:", err);
    }
  }

  // Step 2: HTML generation
  const htmlPrompt = buildPrompt("interactive-html", {
    conceptName: config.conceptName,
    subject: config.subject || "",
    conceptOverview: config.conceptOverview,
    keyPoints: (outline.keyPoints || []).map((p, i) => `${i + 1}. ${p}`).join("\n"),
    scientificConstraints,
    designIdea: config.designIdea,
    language: outline.language || "en-US",
  });

  if (!htmlPrompt) return null;

  const response = await aiCall(htmlPrompt.system, htmlPrompt.user || "");
  const rawHtml = extractHtml(response);
  if (!rawHtml) return null;

  return { html: postProcessInteractiveHtml(rawHtml) };
}

async function generatePBLSceneContent(
  outline: SceneOutline,
  aiCall: AICallFn,
): Promise<any> {
  const config = outline.pblConfig;
  if (!config) return null;

  // Reduced complexity PBL generation for v1
  const prompt = buildPrompt("pbl-design", {
    projectTopic: config.projectTopic,
    projectDescription: config.projectDescription,
    targetSkills: config.targetSkills.join(", "),
    issueCount: config.issueCount,
    language: config.language || "en-US",
  });

  if (!prompt) return null;

  const response = await aiCall(prompt.system, prompt.user || "");
  return parseJsonResponse(response);
}

async function generateSceneContent(
  outline: SceneOutline,
  aiCall: AICallFn,
  agents: AgentInfo[],
): Promise<any> {
  switch (outline.type) {
    case "slide":
      return generateSlideContent(outline, aiCall, agents);
    case "quiz":
      return generateQuizContent(outline, aiCall);
    case "interactive":
    case "simulation":
      return generateInteractiveContent(outline, aiCall);
    case "pbl":
      return generatePBLSceneContent(outline, aiCall);
    default:
      return generateSlideContent(outline, aiCall, agents);
  }
}

async function generateSceneActions(
  outline: SceneOutline,
  content: any,
  aiCall: AICallFn,
  agents: AgentInfo[],
): Promise<any[]> {
  const promptId = 
    outline.type === "quiz" ? "quiz-actions" : 
    outline.type === "pbl" ? "pbl-actions" :
    (outline.type === "interactive" || outline.type === "simulation") ? "interactive-actions" :
    "slide-actions";
  
  const teacherAgent = agents.find((a) => a.role === "teacher");

  const prompt = buildPrompt(promptId, {
    title: outline.title,
    description: outline.description,
    content: JSON.stringify(content).substring(0, 4000),
    teacherName: teacherAgent?.name || "Professor",
    teacherPersona: teacherAgent?.persona || "An expert teacher",
    agentList: agents.map((a) => `${a.name} (${a.role})`).join(", "),
  });

  if (!prompt) return [];

  try {
    const response = await aiCall(prompt.system, prompt.user || "Generate teaching actions.");
    const parsed = parseJsonResponse<any[]>(response);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    logger.warn(`Failed to generate actions for scene: ${outline.title}`);
    return [];
  }
}

// ── Full Pipeline ────────────────────────────────────────────────────────────
// Ported from features/ai-classroom/studyArena/lib/server/classroom-generation.ts

export async function generateFullClassroom(
  requirement: string,
  onProgress?: (progress: ClassroomGenerationProgress) => void,
): Promise<ClassroomData> {
  const aiCall = createAICallFn();
  const classroomId = nanoid(10);

  // Step 1: Generate agents
  onProgress?.({
    step: "generating_agents",
    progress: 5,
    message: "Generating classroom agents...",
    scenesGenerated: 0,
  });

  const agents = await generateAgentProfiles(requirement, aiCall);
  logger.info(`Generated ${agents.length} agent profiles`);

  // Step 2: Generate outlines
  onProgress?.({
    step: "generating_outlines",
    progress: 15,
    message: "Generating scene outlines...",
    scenesGenerated: 0,
  });

  const { languageDirective, outlines } = await generateOutlines(requirement, aiCall, agents);
  logger.info(`Generated ${outlines.length} scene outlines`);

  onProgress?.({
    step: "generating_outlines",
    progress: 30,
    message: `Generated ${outlines.length} scene outlines`,
    scenesGenerated: 0,
    totalScenes: outlines.length,
  });

  // Step 3: Generate content + actions in parallel batches
  const scenes: GeneratedScene[] = [];
  let generatedCount = 0;

  for (let batchStart = 0; batchStart < outlines.length; batchStart += PARALLEL_SCENE_BATCH_SIZE) {
    const batch = outlines.slice(batchStart, batchStart + PARALLEL_SCENE_BATCH_SIZE);

    onProgress?.({
      step: "generating_scenes",
      progress: 30 + Math.floor((generatedCount / outlines.length) * 60),
      message: `Generating scenes ${batchStart + 1}-${Math.min(batchStart + batch.length, outlines.length)}/${outlines.length}...`,
      scenesGenerated: generatedCount,
      totalScenes: outlines.length,
    });

    const batchResults = await Promise.allSettled(
      batch.map(async (outline) => {
        const content = await generateSceneContent(outline, aiCall, agents);
        if (!content) {
          logger.warn(`Skipping scene "${outline.title}" — content generation failed`);
          return null;
        }
        const actions = await generateSceneActions(outline, content, aiCall, agents);
        logger.info(`Scene "${outline.title}": ${actions.length} actions`);
        return { outline, content, actions };
      }),
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled" && result.value) {
        const { outline, content, actions } = result.value;
        scenes.push({
          id: outline.id,
          type: outline.type,
          title: outline.title,
          description: outline.description,
          content,
          actions,
        });
        generatedCount++;
      } else if (result.status === "rejected") {
        logger.error(`Failed to generate scene in batch:`, result.reason);
      }
    }
  }

  if (scenes.length === 0) {
    throw new Error("No scenes were generated");
  }

  onProgress?.({
    step: "completed",
    progress: 100,
    message: `Classroom generation completed with ${scenes.length} scenes`,
    scenesGenerated: scenes.length,
    totalScenes: outlines.length,
  });

  return {
    id: classroomId,
    topic: requirement,
    languageDirective,
    agents,
    scenes,
    createdAt: new Date().toISOString(),
  };
}
