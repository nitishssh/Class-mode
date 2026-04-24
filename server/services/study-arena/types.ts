/**
 * Study Arena Types — Adapted from features/ai-classroom/studyArena
 * 
 * These types mirror the StudyArena generation pipeline but are simplified
 * for use within PersonalLearningPro's Express server.
 */

export type SceneType = 'slide' | 'quiz' | 'simulation' | 'pbl' | 'interactive';

/** Lightweight agent info passed to the generation pipeline */
// ── Orchestration Types ───────────────────────────────────────────────────

export interface WhiteboardActionRecord {
  actionName: string;
  agentId: string;
  agentName: string;
  params: Record<string, any>;
}

export interface AgentTurnSummary {
  agentId: string;
  agentName: string;
  contentPreview: string;
  actionCount: number;
  whiteboardActions: WhiteboardActionRecord[];
}

export interface DirectorState {
  turnCount: number;
  agentResponses: AgentTurnSummary[];
  whiteboardLedger: WhiteboardActionRecord[];
}

export interface StatelessChatRequest {
  messages: any[];
  storeState: {
    stage: any | null;
    scenes: any[];
    currentSceneId: string | null;
    mode: string;
    whiteboardOpen: boolean;
  };
  config: {
    agentIds: string[];
    sessionType?: 'qa' | 'discussion';
    discussionTopic?: string;
    discussionPrompt?: string;
    triggerAgentId?: string;
    agentConfigs?: AgentInfo[];
  };
  directorState?: DirectorState;
  userProfile?: {
    nickname?: string;
    bio?: string;
  };
}

export type StatelessEvent =
  | {
      type: 'agent_start';
      data: {
        messageId: string;
        agentId: string;
        agentName: string;
        agentAvatar?: string;
        agentColor?: string;
      };
    }
  | { type: 'agent_end'; data: { messageId: string; agentId: string } }
  | { type: 'text_delta'; data: { content: string; messageId?: string } }
  | {
      type: 'action';
      data: {
        actionId: string;
        actionName: string;
        params: Record<string, any>;
        agentId: string;
        messageId?: string;
      };
    }
  | {
      type: 'thinking';
      data: { stage: 'director' | 'agent_loading'; agentId?: string };
    }
  | { type: 'cue_user'; data: { fromAgentId?: string; prompt?: string } }
  | {
      type: 'done';
      data: {
        totalActions: number;
        totalAgents: number;
        agentHadContent?: boolean;
        directorState?: DirectorState;
      };
    }
  | { type: 'error'; data: { message: string } };

export interface AgentInfo {
  id: string;
  name: string;
  role: 'teacher' | 'assistant' | 'student';
  persona: string;
  avatar?: string;
  color?: string;
  priority?: number;
  allowedActions?: string[];
}

export interface SceneOutline {
  id: string;
  type: SceneType;
  title: string;
  pblConfig?: any;
  description: string;
  keyPoints?: string[];
  order: number;
  language?: string;
  quizConfig?: {
    questionCount: number;
    difficulty: string;
    questionTypes: string[];
  };
  interactiveConfig?: {
    subject?: string;
    conceptName: string;
    conceptOverview: string;
    designIdea: string;
  };
  mediaGenerations?: Array<{
    elementId: string;
    type: 'image' | 'video';
    prompt: string;
    aspectRatio?: string;
  }>;
}

export interface GeneratedScene {
  id: string;
  type: SceneType;
  title: string;
  description: string;
  content: any;       // Slide elements, quiz questions, or HTML
  actions: any[];     // Teaching actions (spotlight, speech, etc.)
}

export interface ClassroomData {
  id: string;
  topic: string;
  languageDirective: string;
  agents: AgentInfo[];
  scenes: GeneratedScene[];
  createdAt: string;
}

export type AICallFn = (
  systemPrompt: string,
  userPrompt: string,
) => Promise<string>;

export type ClassroomGenerationStep =
  | 'initializing'
  | 'generating_agents'
  | 'generating_outlines'
  | 'generating_scenes'
  | 'completed';

export interface ClassroomGenerationProgress {
  step: ClassroomGenerationStep;
  progress: number;
  message: string;
  scenesGenerated: number;
  totalScenes?: number;
}
