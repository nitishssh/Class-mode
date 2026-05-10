/**
 * Director Graph — LangGraph StateGraph for Multi-Agent Orchestration
 *
 * Ported and simplified for internal Study Arena service.
 */

import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import {
  StatelessEvent,
  StatelessChatRequest,
  AgentTurnSummary,
  WhiteboardActionRecord,
  AgentInfo,
} from "@shared/study-arena";

import { AISdkLangGraphAdapter } from "./ai-sdk-adapter";
import { GeminiLangGraphAdapter } from "./gemini-adapter";
import {
  buildStructuredPrompt,
  summarizeConversation,
  convertMessagesToOpenAI,
} from "./prompt-builder";
import { buildDirectorPrompt, parseDirectorDecision } from "./director-prompt";
import { createParserState, parseStructuredChunk } from "./orchestrator";

// ==================== State Definition ====================

const OrchestratorState = Annotation.Root({
  // Input
  messages: Annotation<any[]>,
  storeState: Annotation<any>,
  availableAgentIds: Annotation<string[]>,
  maxTurns: Annotation<number>,
  discussionContext: Annotation<{ topic: string; prompt?: string } | null>,
  triggerAgentId: Annotation<string | null>,
  userProfile: Annotation<{ nickname?: string; bio?: string } | null>,
  agentConfigs: Annotation<Record<string, AgentInfo>>,

  // Mutable
  currentAgentId: Annotation<string | null>,
  turnCount: Annotation<number>,
  agentResponses: Annotation<AgentTurnSummary[]>({
    reducer: (prev, update) => [...prev, ...update],
    default: () => [],
  }),
  whiteboardLedger: Annotation<WhiteboardActionRecord[]>({
    reducer: (prev, update) => {
      const combined = [...prev, ...update];
      return combined.length > 100 ? combined.slice(-100) : combined;
    },
    default: () => [],
  }),
  shouldEnd: Annotation<boolean>,
  totalActions: Annotation<number>,
});

type OrchestratorStateType = typeof OrchestratorState.State;

// ==================== Helper ====================

function getAdapter() {
  const hasGemini = !!process.env.GOOGLE_API_KEY;
  return hasGemini ? new GeminiLangGraphAdapter() : new AISdkLangGraphAdapter();
}

// ==================== Director Node ====================

async function directorNode(
  state: OrchestratorStateType,
  config: LangGraphRunnableConfig
): Promise<Partial<OrchestratorStateType>> {
  const write = config.writer as (chunk: StatelessEvent) => void;
  const isSingleAgent = state.availableAgentIds.length <= 1;

  if (state.turnCount >= state.maxTurns) {
    return { shouldEnd: true };
  }

  // Single agent logic
  if (isSingleAgent) {
    const agentId = state.availableAgentIds[0] || "default";
    if (state.turnCount === 0) {
      write({ type: "thinking", data: { stage: "agent_loading", agentId } });
      return { currentAgentId: agentId, shouldEnd: false };
    }
    write({ type: "cue_user", data: { fromAgentId: agentId } });
    return { shouldEnd: true };
  }

  // Multi agent: Turn 0 trigger
  if (state.turnCount === 0 && state.triggerAgentId) {
    const triggerId = state.triggerAgentId;
    write({ type: "thinking", data: { stage: "agent_loading", agentId: triggerId } });
    return { currentAgentId: triggerId, shouldEnd: false };
  }

  // Multi agent: LLM-based decision
  write({ type: "thinking", data: { stage: "director" } });

  const conversationSummary = summarizeConversation(state.messages);
  const prompt = buildDirectorPrompt(
    Object.values(state.agentConfigs),
    conversationSummary,
    state.agentResponses,
    state.turnCount,
    state.discussionContext,
    state.triggerAgentId,
    state.whiteboardLedger,
    state.userProfile || undefined,
    state.storeState.whiteboardOpen
  );

  const adapter = getAdapter();

  try {
    const result = await adapter._generate([
      new SystemMessage(prompt),
      new HumanMessage("Decide which agent should speak next."),
    ]);

    const decision = parseDirectorDecision(result.generations[0]?.text || "");

    if (decision.shouldEnd || !decision.nextAgentId) {
      return { shouldEnd: true };
    }

    if (decision.nextAgentId === "USER") {
      write({ type: "cue_user", data: { fromAgentId: state.currentAgentId || undefined } });
      return { shouldEnd: true };
    }

    write({ type: "thinking", data: { stage: "agent_loading", agentId: decision.nextAgentId } });
    return { currentAgentId: decision.nextAgentId, shouldEnd: false };
  } catch (error) {
    console.error("[Director] Error:", error);
    return { shouldEnd: true };
  }
}

function directorCondition(state: OrchestratorStateType): "agent_generate" | typeof END {
  return state.shouldEnd ? END : "agent_generate";
}

// ==================== Agent Generate Node ====================

async function agentGenerateNode(
  state: OrchestratorStateType,
  config: LangGraphRunnableConfig
): Promise<Partial<OrchestratorStateType>> {
  const agentId = state.currentAgentId;
  const agentConfig = state.agentConfigs[agentId!];
  if (!agentConfig) return { shouldEnd: true };

  const write = config.writer as (chunk: StatelessEvent) => void;
  const messageId = `msg-${Date.now()}`;

  write({
    type: "agent_start",
    data: {
      messageId,
      agentId: agentId!,
      agentName: agentConfig.name,
      agentAvatar: agentConfig.avatar,
      agentColor: agentConfig.color,
    },
  });

  const adapter = getAdapter();
  const systemPrompt = buildStructuredPrompt(
    agentConfig,
    state.storeState,
    state.discussionContext || undefined,
    state.whiteboardLedger,
    state.userProfile || undefined,
    state.agentResponses
  );

  const openaiMessages = convertMessagesToOpenAI(state.messages, agentId!);
  const lcMessages = [
    new SystemMessage(systemPrompt),
    ...openaiMessages.map((m) =>
      m.role === "assistant" ? new AIMessage(m.content) : new HumanMessage(m.content)
    ),
  ];

  let fullText = "";
  let actionCount = 0;
  const whiteboardActions: WhiteboardActionRecord[] = [];
  const parserState = createParserState();

  try {
    for await (const chunk of adapter.streamGenerate(lcMessages)) {
      if (chunk.type === "delta") {
        const parseResult = parseStructuredChunk(chunk.content, parserState);

        for (const entry of parseResult.ordered) {
          if (entry.type === "text") {
            const text = parseResult.textChunks[entry.index];
            fullText += text;
            write({ type: "text_delta", data: { content: text, messageId } });
          } else if (entry.type === "action") {
            const action = parseResult.actions[entry.index];
            actionCount++;
            if (action.actionName.startsWith("wb_")) {
              whiteboardActions.push({
                actionName: action.actionName,
                agentId: agentId!,
                agentName: agentConfig.name,
                params: action.params,
              });
            }
            write({
              type: "action",
              data: {
                actionId: action.actionId,
                actionName: action.actionName,
                params: action.params,
                agentId: agentId!,
                messageId,
              },
            });
          }
        }

        // Handle trailing partial text
        if (
          !parseResult.isDone &&
          parseResult.textChunks.length >
            parseResult.ordered.filter((e) => e.type === "text").length
        ) {
          const lastText = parseResult.textChunks[parseResult.textChunks.length - 1];
          fullText += lastText;
          write({ type: "text_delta", data: { content: lastText, messageId } });
        }
      }
    }
  } catch (error) {
    console.error(`[AgentGenerate] Error for ${agentConfig.name}:`, error);
  }

  write({ type: "agent_end", data: { messageId, agentId: agentId! } });

  return {
    turnCount: state.turnCount + 1,
    agentResponses: [
      {
        agentId: agentId!,
        agentName: agentConfig.name,
        contentPreview: fullText.slice(0, 200),
        actionCount,
        whiteboardActions,
      },
    ],
    currentAgentId: null,
  };
}

// ==================== Graph Construction ====================

export function createOrchestrationGraph() {
  const graph = new StateGraph(OrchestratorState)
    .addNode("director", directorNode)
    .addNode("agent_generate", agentGenerateNode)
    .addEdge(START, "director")
    .addConditionalEdges("director", directorCondition, {
      agent_generate: "agent_generate",
      [END]: END,
    })
    .addEdge("agent_generate", "director");

  return graph.compile();
}

export function buildInitialState(request: StatelessChatRequest): typeof OrchestratorState.State {
  const agentConfigs: Record<string, AgentInfo> = {};
  request.config.agentConfigs?.forEach((a) => (agentConfigs[a.id] = a));

  const turnCount = request.directorState?.turnCount ?? 0;

  return {
    messages: request.messages,
    storeState: request.storeState,
    availableAgentIds: request.config.agentIds,
    maxTurns: turnCount + 1,
    discussionContext: request.config.discussionTopic
      ? {
          topic: request.config.discussionTopic,
          prompt: request.config.discussionPrompt,
        }
      : null,
    triggerAgentId: request.config.triggerAgentId || null,
    userProfile: request.userProfile || null,
    agentConfigs,
    currentAgentId: null,
    turnCount,
    agentResponses: request.directorState?.agentResponses || [],
    whiteboardLedger: request.directorState?.whiteboardLedger || [],
    shouldEnd: false,
    totalActions: 0,
  };
}
