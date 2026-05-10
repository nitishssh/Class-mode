/**
 * Shared Types for Study Arena (AI Classroom)
 */

export type SceneType = "slides" | "quiz" | "simulation" | "pbl";

export interface AgentInfo {
  id: string;
  name: string;
  role: "teacher" | "assistant" | "student";
  persona: string;
  avatar?: string;
  color?: string;
  priority?: number;
  allowedActions?: string[];
}

export interface AgentTurnSummary {
  agentId: string;
  agentName: string;
  contentPreview: string;
  actionCount: number;
  whiteboardActions: WhiteboardActionRecord[];
}

export interface WhiteboardActionRecord {
  actionName: string;
  agentId: string;
  agentName: string;
  params: any;
}

export interface DirectorState {
  turnCount: number;
  agentResponses: AgentTurnSummary[];
  whiteboardLedger: WhiteboardActionRecord[];
}

export interface StatelessChatRequest {
  messages: any[];
  storeState: {
    currentSceneId?: string | null;
    whiteboardOpen: boolean;
    language?: string;
    stage?: any;
  };
  config: {
    agentIds: string[];
    agentConfigs?: AgentInfo[];
    discussionTopic?: string;
    discussionPrompt?: string;
    triggerAgentId?: string;
  };
  directorState?: DirectorState;
  userProfile?: {
    nickname?: string;
    bio?: string;
  };
}

export type StatelessEvent =
  | { type: "thinking"; data: { stage: string; agentId?: string } }
  | {
      type: "agent_start";
      data: {
        messageId: string;
        agentId: string;
        agentName: string;
        agentAvatar?: string;
        agentColor?: string;
      };
    }
  | { type: "text_delta"; data: { content: string; messageId: string } }
  | {
      type: "action";
      data: {
        actionId: string;
        actionName: string;
        params: any;
        agentId: string;
        messageId: string;
      };
    }
  | { type: "agent_end"; data: { messageId: string; agentId: string } }
  | { type: "cue_user"; data: { fromAgentId?: string } }
  | { type: "error"; data: { message: string } };
