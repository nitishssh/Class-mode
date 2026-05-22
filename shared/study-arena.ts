/**
 * Shared Types for Study Arena (AI Classroom)
 */

export type SceneType = "slides" | "quiz" | "simulation" | "pbl" | "interactive";

export type WidgetType = "simulation" | "diagram" | "code" | "game" | "visualization3d";

export interface WidgetConfig {
  type: WidgetType;
  [key: string]: any;
}

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
  | { type: "cue_user"; data: { fromAgentId?: string; prompt?: string } }
  | {
      type: "done";
      data: {
        totalActions: number;
        totalAgents: number;
        agentHadContent?: boolean;
        directorState?: DirectorState;
      };
    }
  | { type: "error"; data: { message: string } };

// ── Action types for playback engine ──────────────────────────────────────────

export type ActionName =
  | "speech"
  | "spotlight"
  | "laser"
  | "wb_open"
  | "wb_close"
  | "wb_clear"
  | "wb_delete"
  | "wb_draw_text"
  | "wb_draw_shape"
  | "wb_draw_chart"
  | "wb_draw_latex"
  | "wb_draw_table"
  | "wb_draw_line"
  | "wb_draw_code"
  | "wb_edit_code"
  | "widget_highlight"
  | "widget_setState"
  | "widget_annotation"
  | "widget_reveal"
  | "discussion"
  | "play_video";

export interface PlaybackAction {
  actionId?: string;
  type: "action" | "text";
  name?: ActionName;
  content?: string;
  params?: Record<string, any>;
}

export const FIRE_AND_FORGET_ACTIONS: ActionName[] = ["spotlight", "laser"];
export const SYNC_ACTIONS: ActionName[] = [
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
  "widget_highlight",
  "widget_setState",
  "widget_annotation",
  "widget_reveal",
  "play_video",
];
