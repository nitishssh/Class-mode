import fs from 'fs';
import path from 'path';

export type PromptId = string;
export type SnippetId = string;

export interface LoadedPrompt {
  id: PromptId;
  systemPrompt: string;
  userPromptTemplate: string;
}

/**
 * Get the prompts directory path
 */
function getPromptsDir(): string {
  return path.join(process.cwd(), 'server', 'lib', 'prompts', 'study-arena');
}

/**
 * Load a snippet by ID
 */
export function loadSnippet(snippetId: SnippetId): string {
  const snippetPath = path.join(process.cwd(), 'server', 'lib', 'prompts', 'snippets', `${snippetId}.md`);

  try {
    return fs.readFileSync(snippetPath, 'utf-8').trim();
  } catch {
    throw new Error(`Snippet not found: ${snippetId}`);
  }
}

/**
 * Process snippet includes in a template
 * Replaces {{snippet:name}} with actual snippet content
 */
function processSnippets(template: string): string {
  return template.replace(/\{\{snippet:([\w-]+)\}\}/g, (_, snippetId) => {
    return loadSnippet(snippetId);
  });
}

/**
 * Load a prompt by ID
 */
export function loadPrompt(promptId: PromptId): LoadedPrompt | null {
  const promptDir = path.join(getPromptsDir(), promptId);

  try {
    // Load system.md
    const systemPath = path.join(promptDir, 'system.md');
    let systemPrompt = fs.readFileSync(systemPath, 'utf-8').trim();
    systemPrompt = processSnippets(systemPrompt);

    // Load user.md (optional)
    const userPath = path.join(promptDir, 'user.md');
    let userPromptTemplate = '';
    try {
      userPromptTemplate = fs.readFileSync(userPath, 'utf-8').trim();
      userPromptTemplate = processSnippets(userPromptTemplate);
    } catch {
      // user.md is optional
    }

    return {
      id: promptId,
      systemPrompt,
      userPromptTemplate,
    };
  } catch (error) {
    console.error(`Failed to load prompt ${promptId}:`, error);
    return null;
  }
}

/**
 * Interpolate variables in a template
 * Replaces {{variable}} with values from the variables object
 */
export function interpolateVariables(template: string, variables: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = variables[key];
    if (value === undefined) return match;
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  });
}

/**
 * Build a complete prompt with variables
 */
export function buildPrompt(
  promptId: PromptId,
  variables: Record<string, unknown>,
): { system: string; user: string } | null {
  const prompt = loadPrompt(promptId);
  if (!prompt) return null;

  return {
    system: interpolateVariables(prompt.systemPrompt, variables),
    user: interpolateVariables(prompt.userPromptTemplate, variables),
  };
}
