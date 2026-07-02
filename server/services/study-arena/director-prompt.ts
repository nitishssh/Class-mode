/**
 * Director Prompt — Builds the system prompt for the multi-agent orchestrator.
 *
 * Ported from features/ai-classroom/studyArena/lib/orchestration/director-prompt.ts
 */

import { WhiteboardActionRecord, AgentTurnSummary, AgentInfo } from "@shared/study-arena";

export function buildDirectorPrompt(
  agents: AgentInfo[],
  conversationSummary: string,
  agentResponses: AgentTurnSummary[],
  turnCount: number,
  discussionContext?: { topic: string; prompt?: string } | null,
  triggerAgentId?: string | null,
  whiteboardLedger?: WhiteboardActionRecord[],
  userProfile?: { nickname?: string; bio?: string },
  _whiteboardOpen?: boolean
): string {
  const agentList = agents
    .map((a) => `- id: "${a.id}", name: "${a.name}", role: ${a.role}, priority: ${a.priority || 0}`)
    .join("\n");

  const respondedList =
    agentResponses.length > 0
      ? agentResponses
          .map((r) => {
            return `- ${r.agentName} (${r.agentId}): "${r.contentPreview}" [${r.actionCount} actions]`;
          })
          .join("\n")
      : "None yet.";

  const isDiscussion = !!discussionContext;

  const discussionSection = isDiscussion
    ? `\n# Discussion Mode
Topic: "${discussionContext!.topic}"${discussionContext!.prompt ? `\nPrompt: "${discussionContext!.prompt}"` : ""}${triggerAgentId ? `\nInitiator: "${triggerAgentId}"` : ""}
This is a student-initiated discussion, not a Q&A session.\n`
    : "";

  const rule1 = isDiscussion
    ? `1. The discussion initiator${triggerAgentId ? ` ("${triggerAgentId}")` : ""} should speak first to kick off the topic. Then the teacher responds to guide the discussion. After that, other students may add their perspectives.`
    : "1. The teacher (role: teacher, highest priority) should usually speak first to address the user's question or topic.";

  const studentProfileSection =
    userProfile?.nickname || userProfile?.bio
      ? `
# Student Profile
Student name: ${userProfile.nickname || "Unknown"}
${userProfile.bio ? `Background: ${userProfile.bio}` : ""}
`
      : "";

  return `You are the Director of a multi-agent classroom. Your job is to decide which agent should speak next based on the conversation context.

# Available Agents
${agentList}

# Agents Who Already Spoke This Round
${respondedList}

# Conversation Context
${conversationSummary}
${discussionSection}${studentProfileSection}

# Rules
${rule1}
2. After the teacher, consider whether a student agent would add value (ask a follow-up question, crack a joke, take notes, offer a different perspective).
3. Do NOT repeat an agent who already spoke this round unless absolutely necessary.
4. If the conversation seems complete (question answered, topic covered), output END.
5. Current turn: ${turnCount + 1}. Consider conversation length — don't let discussions drag on unnecessarily.
6. Prefer brevity — 1-2 agents responding is usually enough. Don't force every agent to speak.
7. You can output {"next_agent":"USER"} to cue the user to speak.

# Output Format
You MUST output ONLY a JSON object:
{"next_agent":"<agent_id>"}
or
{"next_agent":"USER"}
or
{"next_agent":"END"}`;
}

export function parseDirectorDecision(content: string): {
  nextAgentId: string | null;
  shouldEnd: boolean;
} {
  try {
    const jsonMatch = content.match(/\{[\s\S]*?"next_agent"[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const nextAgent = parsed.next_agent;

      if (!nextAgent || nextAgent === "END") {
        return { nextAgentId: null, shouldEnd: true };
      }

      return { nextAgentId: nextAgent, shouldEnd: false };
    }
  } catch {
    console.warn("[Director] Failed to parse decision:", content.slice(0, 200));
  }
  return { nextAgentId: null, shouldEnd: true };
}
