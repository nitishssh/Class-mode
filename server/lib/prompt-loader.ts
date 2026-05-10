import fs from "fs";
import path from "path";
import { logger } from "./logger";

export type PromptId = string;
export type SnippetId = string;

export interface LoadedPrompt {
  id: PromptId;
  systemPrompt: string;
  userPromptTemplate: string;
}

const promptCache = new Map<PromptId, LoadedPrompt>();
const snippetCache = new Map<SnippetId, string>();

function getPromptsDir(): string {
  return path.join(process.cwd(), "server", "lib", "prompts", "study-arena");
}

export function loadSnippet(snippetId: SnippetId): string {
  const cached = snippetCache.get(snippetId);
  if (cached) return cached;

  const snippetPath = path.join(
    process.cwd(),
    "server",
    "lib",
    "prompts",
    "snippets",
    `${snippetId}.md`
  );

  try {
    const content = fs.readFileSync(snippetPath, "utf-8").trim();
    snippetCache.set(snippetId, content);
    return content;
  } catch {
    throw new Error(`Snippet not found: ${snippetId}`);
  }
}

function processSnippets(template: string): string {
  return template.replace(/\{\{snippet:([\w-]+)\}\}/g, (_, snippetId) => {
    return loadSnippet(snippetId);
  });
}

export function loadPrompt(promptId: PromptId): LoadedPrompt | null {
  const cached = promptCache.get(promptId);
  if (cached) return cached;

  const promptDir = path.join(getPromptsDir(), promptId);

  try {
    const systemPath = path.join(promptDir, "system.md");
    let systemPrompt = fs.readFileSync(systemPath, "utf-8").trim();
    systemPrompt = processSnippets(systemPrompt);

    const userPath = path.join(promptDir, "user.md");
    let userPromptTemplate = "";
    try {
      userPromptTemplate = fs.readFileSync(userPath, "utf-8").trim();
      userPromptTemplate = processSnippets(userPromptTemplate);
    } catch {
      // user.md is optional
    }

    const prompt: LoadedPrompt = { id: promptId, systemPrompt, userPromptTemplate };
    promptCache.set(promptId, prompt);
    return prompt;
  } catch (error) {
    logger.error(`Failed to load prompt ${promptId}:`, error);
    return null;
  }
}

export function clearPromptCache(): void {
  promptCache.clear();
  snippetCache.clear();
}

/**
 * Interpolate variables in a template
 * Replaces {{variable}} with values from the variables object
 */
export function interpolateVariables(template: string, variables: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = variables[key];
    if (value === undefined) return match;
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    return String(value);
  });
}

/**
 * Build a complete prompt with variables
 */
export function buildPrompt(
  promptId: PromptId,
  variables: Record<string, unknown>
): { system: string; user: string } | null {
  const prompt = loadPrompt(promptId);
  if (!prompt) return null;

  return {
    system: interpolateVariables(prompt.systemPrompt, variables),
    user: interpolateVariables(prompt.userPromptTemplate, variables),
  };
}
