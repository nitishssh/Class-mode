/**
 * Study Arena Types — Adapted from features/ai-classroom/studyArena
 *
 * These types describe the StudyArena generation pipeline as used within
 * PersonalLearningPro's Express server.
 *
 * The multi-agent orchestration wire contract (StatelessChatRequest,
 * StatelessEvent, DirectorState, AgentTurnSummary, WhiteboardActionRecord,
 * AgentInfo) is the SAME contract the client sends and the director graph
 * consumes, so it lives in `@shared/study-arena` as the single source of
 * truth and is re-exported here. Do NOT redefine those types locally — two
 * copies silently drift and TypeScript will not catch a mismatch across the
 * route ↔ orchestrator boundary.
 */

export type {
  AgentInfo,
  AgentTurnSummary,
  WhiteboardActionRecord,
  DirectorState,
  StatelessChatRequest,
  StatelessEvent,
} from "@shared/study-arena";

import type { AgentInfo } from "@shared/study-arena";

// ── Generation-pipeline types (server-only) ───────────────────────────────
// `SceneType`/`WidgetType` here intentionally differ from the playback enums
// in `@shared/study-arena`: this set covers the generation outline stage.

export type SceneType = "slide" | "quiz" | "simulation" | "pbl" | "interactive" | "code" | "diagram" | "game" | "visualization3d";
export type WidgetType = "simulation" | "diagram" | "code" | "game" | "visualization3d";

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
  widgetType?: WidgetType;
  widgetOutline?: {
    // code
    language?: string;
    starterCode?: string;
    // diagram
    diagramType?: string;
    nodeCount?: number;
    // game
    gameType?: string;
    challenge?: string;
    // simulation / visualization3d
    subject?: string;
    conceptName?: string;
    designIdea?: string;
    [key: string]: any;
  };
  mediaGenerations?: Array<{
    elementId: string;
    type: "image" | "video";
    prompt: string;
    aspectRatio?: string;
  }>;
}

export interface GeneratedScene {
  id: string;
  type: SceneType;
  title: string;
  description: string;
  content: any; // Slide elements, quiz questions, or HTML
  actions: any[]; // Teaching actions (spotlight, speech, etc.)
}

export interface ClassroomData {
  id: string;
  topic: string;
  languageDirective: string;
  agents: AgentInfo[];
  scenes: GeneratedScene[];
  createdAt: string;
}

export type AICallFn = (systemPrompt: string, userPrompt: string) => Promise<string>;

export type ClassroomGenerationStep =
  | "initializing"
  | "generating_agents"
  | "generating_outlines"
  | "generating_scenes"
  | "completed";

export interface ClassroomGenerationProgress {
  step: ClassroomGenerationStep;
  progress: number;
  message: string;
  scenesGenerated: number;
  totalScenes?: number;
}
