/**
 * Prompt Builder — Builds system prompts for individual agents.
 *
 * Ported from OpenMAIC (MIT, github.com/THU-MAIC/OpenMAIC) lib/orchestration/prompt-builder.ts
 */

import {
  StatelessChatRequest,
  WhiteboardActionRecord,
  AgentTurnSummary,
  AgentInfo,
} from "@shared/study-arena";

const ROLE_GUIDELINES: Record<string, string> = {
  teacher: `Your role in this classroom: LEAD TEACHER.
You are responsible for:
- Controlling the lesson flow, slides, and pacing
- Explaining concepts clearly with examples and analogies
- Asking questions to check understanding
- Using spotlight/laser to direct attention to slide elements
- Using the whiteboard for diagrams and formulas
- Initiating discussion prompts at appropriate moments
You can use all available actions. Never announce your actions — just teach naturally.`,

  assistant: `Your role in this classroom: TEACHING ASSISTANT.
You are responsible for:
- Supporting the lead teacher by filling gaps and answering side questions
- Rephrasing explanations in simpler terms when students are confused
- Providing concrete examples and background context
- Using the whiteboard sparingly to supplement (not duplicate) the teacher's content
You play a supporting role — don't take over the lesson.`,

  student: `Your role in this classroom: STUDENT.
You are responsible for:
- Participating actively in discussions
- Asking questions, sharing observations, reacting to the lesson
- Keeping responses SHORT (1-2 sentences max)
- Only using the whiteboard when explicitly invited by the teacher
You are NOT a teacher — your responses should be much shorter than the teacher's.`,
};

const ALL_ACTION_DESCRIPTIONS: Record<string, string> = {
  spotlight: "Focus attention on a single key slide element. Params: { elementId: string }",
  laser: "Point at a slide element with a laser pointer. Params: { elementId: string }",
  wb_open: "Open the whiteboard panel. Params: {}",
  wb_close:
    "Close the whiteboard (only when returning to slide). Params: {}. Do NOT call at end of response.",
  wb_clear: "Clear all whiteboard content. Params: {}",
  wb_delete: "Delete one whiteboard element by ID. Params: { elementId: string }",
  wb_draw_text:
    "Add text. Params: { content: string, x: number, y: number, fontSize?: number }",
  wb_draw_shape:
    'Add shape. Params: { shape: "rectangle"|"circle"|"ellipse"|"triangle", x: number, y: number, width: number, height: number, fill?: string, stroke?: string }',
  wb_draw_chart:
    'Add chart. Params: { chartType: "bar"|"line"|"pie", x: number, y: number, width: number, height: number, data: { labels: string[], values: number[], seriesName?: string } }',
  wb_draw_latex:
    "Add LaTeX formula. Params: { latex: string, x: number, y: number, width?: number, height?: number }",
  wb_draw_table:
    "Add table. Params: { x: number, y: number, width?: number, height?: number, data: string[][] }",
  wb_draw_line:
    "Add line/arrow. Params: { startX: number, startY: number, endX: number, endY: number, arrow?: boolean, color?: string }",
  wb_draw_code:
    "Add code block. Params: { code: string, language: string, x: number, y: number, width?: number }",
  wb_edit_code:
    'Edit code block lines. Params: { elementId: string, op: "insert_after"|"insert_before"|"replace_lines"|"delete_lines", lineIndex: number, lines?: string[] }',
  widget_highlight:
    "Highlight a widget UI element. Params: { target: string, content?: string }",
  widget_setState:
    "Set widget state for a demo scenario. Params: { state: Record<string, any>, content?: string }",
  widget_annotation:
    "Add a floating annotation label on the widget. Params: { target: string, content: string }",
  widget_reveal:
    "Reveal a hidden widget element progressively. Params: { target: string, content?: string }",
  discussion:
    "Pause and invite the student into a discussion. Params: { topic: string, prompt: string }",
  play_video:
    "Play a video clip. Params: { url: string, startTime?: number, endTime?: number, caption?: string }",
};

const SLIDE_SCENE_ACTIONS = [
  "spotlight",
  "laser",
  "wb_open",
  "wb_close",
  "wb_clear",
  "wb_delete",
  "wb_draw_text",
  "wb_draw_shape",
  "wb_draw_chart",
  "wb_draw_latex",
  "wb_draw_table",
  "wb_draw_line",
  "wb_draw_code",
  "wb_edit_code",
  "discussion",
];

const WIDGET_SCENE_ACTIONS = [
  "widget_highlight",
  "widget_setState",
  "widget_annotation",
  "widget_reveal",
  "wb_open",
  "wb_close",
  "wb_clear",
  "wb_draw_text",
  "wb_draw_latex",
  "discussion",
];

const QUIZ_SCENE_ACTIONS = ["discussion"];

const PBL_SCENE_ACTIONS = [
  "wb_open",
  "wb_close",
  "wb_clear",
  "wb_draw_text",
  "wb_draw_shape",
  "wb_draw_latex",
  "discussion",
];

export function getEffectiveActions(
  allowedActions: string[] | undefined,
  sceneType: string
): string[] {
  let sceneAllowlist: string[];
  switch (sceneType) {
    case "slide":
    case "slides":
      sceneAllowlist = SLIDE_SCENE_ACTIONS;
      break;
    case "interactive":
    case "simulation":
    case "code":
    case "diagram":
    case "game":
    case "visualization3d":
      sceneAllowlist = WIDGET_SCENE_ACTIONS;
      break;
    case "quiz":
      sceneAllowlist = QUIZ_SCENE_ACTIONS;
      break;
    case "pbl":
      sceneAllowlist = PBL_SCENE_ACTIONS;
      break;
    default:
      sceneAllowlist = SLIDE_SCENE_ACTIONS;
  }

  if (!allowedActions || allowedActions.length === 0) return sceneAllowlist;
  return allowedActions.filter((a) => sceneAllowlist.includes(a));
}

function getSafeRoleGuideline(role: string): string {
  if (role === "teacher" || role === "assistant" || role === "student") {
    return ROLE_GUIDELINES[role];
  }
  return ROLE_GUIDELINES.student;
}

function getSafeActionDescription(actionName: string): string {
  if (Object.prototype.hasOwnProperty.call(ALL_ACTION_DESCRIPTIONS, actionName)) {
    return ALL_ACTION_DESCRIPTIONS[actionName];
  }
  return "No description";
}

export function getActionDescriptions(allowedActions: string[]): string {
  if (!allowedActions || allowedActions.length === 0) return "No actions available.";
  return allowedActions
    .map((a) => `- ${a}: ${getSafeActionDescription(a)}`)
    .join("\n");
}

export function buildStructuredPrompt(
  agent: AgentInfo,
  storeState: StatelessChatRequest["storeState"],
  discussionContext?: { topic: string; prompt?: string },
  whiteboardLedger?: WhiteboardActionRecord[],
  userProfile?: { nickname?: string; bio?: string },
  agentResponses?: AgentTurnSummary[],
  sceneType?: string
): string {
  const roleGuideline = getSafeRoleGuideline(agent.role);
  const effectiveActions = getEffectiveActions(agent.allowedActions, sceneType || "slide");
  const actionDescriptions = getActionDescriptions(effectiveActions);
  const language =
    (storeState as any).stage?.language || (storeState as any).language || "English";

  const peerContext =
    agentResponses && agentResponses.length > 0
      ? `\n# This Round's Context\n${agentResponses.map((r) => `- ${r.agentName}: "${r.contentPreview}"`).join("\n")}\n`
      : "";

  const wbContext =
    whiteboardLedger && whiteboardLedger.length > 0
      ? `\n# Whiteboard State\nRecent actions:\n${whiteboardLedger
          .slice(-5)
          .map((w) => `- ${w.actionName}: ${JSON.stringify(w.params).slice(0, 80)}`)
          .join("\n")}\n`
      : "";

  const discussionSection = discussionContext
    ? `\n# Active Discussion\nTopic: ${discussionContext.topic}\n${discussionContext.prompt ? `Prompt: ${discussionContext.prompt}` : ""}\n`
    : "";

  const userCtx =
    userProfile?.nickname
      ? `\n# Student\nName: ${userProfile.nickname}${userProfile.bio ? `\nBackground: ${userProfile.bio}` : ""}\n`
      : "";

  return `# Role
You are ${agent.name}.
## Personality
${agent.persona}
## Classroom Role
${roleGuideline}
${peerContext}${wbContext}${discussionSection}${userCtx}
# Language
Speak in ${language}.

# Output Format
Output a JSON array. Text and actions freely interleave.
Example: [{"type":"action","name":"spotlight","params":{"elementId":"img_1"}},{"type":"text","content":"Let's look at this diagram..."},{"type":"action","name":"wb_open","params":{}},{"type":"action","name":"wb_draw_latex","params":{"latex":"E=mc^2","x":100,"y":100}},{"type":"text","content":"Einstein's equation means..."}]

# Available Actions
${actionDescriptions}

# Whiteboard Coordinate System
0–1000 × 0–562 (16:9 aspect ratio). Leave whiteboard OPEN after drawing — do not close unless switching back to slide.

# Current State
Scene: ${storeState.currentSceneId || "None"}
Whiteboard: ${storeState.whiteboardOpen ? "Open" : "Closed"}

Remember: Speak naturally. Do NOT announce actions.`;
}

export function convertMessagesToOpenAI(messages: any[], _currentAgentId?: string) {
  return messages.map((msg) => ({
    role: msg.role === "assistant" ? "assistant" : "user",
    content: msg.content || msg.parts?.[0]?.text || "",
  }));
}

export function summarizeConversation(messages: any[]) {
  return messages
    .slice(-5)
    .map((m) => `[${m.role}] ${m.content.slice(0, 100)}`)
    .join("\n");
}
