/**
 * Prompt Builder — Builds system prompts for individual agents.
 * 
 * Ported from features/ai-classroom/studyArena/lib/orchestration/prompt-builder.ts
 */

import { StatelessChatRequest, WhiteboardActionRecord, AgentTurnSummary, AgentInfo } from "@shared/study-arena";

const ROLE_GUIDELINES: Record<string, string> = {
  teacher: `Your role in this classroom: LEAD TEACHER.
You are responsible for:
- Controlling the lesson flow, slides, and pacing
- Explaining concepts clearly with examples and analogies
- Asking questions to check understanding
- Using spotlight/laser to direct attention to slide elements
- Using the whiteboard for diagrams and formulas
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

export function getActionDescriptions(allowedActions: string[]): string {
  const descriptions: Record<string, string> = {
    spotlight: 'Focus attention on a single key element. Params: { elementId: string }',
    laser: 'Point at an element with a laser pointer. Params: { elementId: string }',
    wb_open: 'Open the whiteboard. Params: {}',
    wb_draw_text: 'Add text to whiteboard. Params: { content: string, x: number, y: number }',
    wb_draw_shape: 'Add shape to whiteboard. Params: { shape: "rectangle"|"circle", x: number, y: number, width: number, height: number }',
    wb_draw_chart: 'Add chart to whiteboard. Params: { chartType: string, x: number, y: number, data: any }',
    wb_draw_latex: 'Add LaTeX formula. Params: { latex: string, x: number, y: number, height?: number }',
    wb_draw_table: 'Add table. Params: { x: number, y: number, data: string[][] }',
    wb_draw_line: 'Add line. Params: { startX: number, startY: number, endX: number, endY: number }',
    wb_clear: 'Clear whiteboard. Params: {}',
    wb_delete: 'Delete element by ID. Params: { elementId: string }',
    wb_close: 'Close whiteboard. Params: {}',
  };

  if (!allowedActions || allowedActions.length === 0) return 'No actions available.';
  return allowedActions.map(a => `- ${a}: ${descriptions[a] || 'No description'}`).join('\n');
}

export function buildStructuredPrompt(
  agent: AgentInfo,
  storeState: StatelessChatRequest['storeState'],
  discussionContext?: { topic: string; prompt?: string },
  whiteboardLedger?: WhiteboardActionRecord[],
  userProfile?: { nickname?: string; bio?: string },
  agentResponses?: AgentTurnSummary[],
): string {
  const roleGuideline = ROLE_GUIDELINES[agent.role] || ROLE_GUIDELINES.student;
  const actionDescriptions = getActionDescriptions(agent.allowedActions || []);
  const language = storeState.stage?.language || "English";

  const peerContext = agentResponses && agentResponses.length > 0
    ? `\n# This Round's Context\n${agentResponses.map(r => `- ${r.agentName}: "${r.contentPreview}"`).join('\n')}\n`
    : '';

  return `# Role
You are ${agent.name}.
## Personality
${agent.persona}
## Classroom Role
${roleGuideline}

${peerContext}
# Language
Speak in ${language}.

# Output Format
Output a JSON array for ALL responses.
Example: [{"type":"action","name":"spotlight","params":{"elementId":"img_1"}},{"type":"text","content":"Natural speech here"}]

# Available Actions
${actionDescriptions}

# Current State
Scene: ${storeState.currentSceneId || "None"}
Whiteboard: ${storeState.whiteboardOpen ? "Open" : "Closed"}

Remember: Speak naturally. Do NOT announce actions.`;
}

export function convertMessagesToOpenAI(messages: any[], currentAgentId?: string) {
  return messages.map(msg => ({
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content: msg.content || (msg.parts?.[0]?.text || '')
  }));
}

export function summarizeConversation(messages: any[]) {
  return messages.slice(-5).map(m => `[${m.role}] ${m.content.slice(0, 100)}`).join('\n');
}
