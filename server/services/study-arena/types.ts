/**
 * Study Arena Types — Adapted from features/ai-classroom/studyArena
 * 
 * These types mirror the StudyArena generation pipeline but are simplified
 * for use within PersonalLearningPro's Express server.
 */

export type SceneType = 'slide' | 'quiz' | 'simulation' | 'pbl' | 'interactive';

/** Lightweight agent info passed to the generation pipeline */
export interface AgentInfo {
  id: string;
  name: string;
  role: string;
  persona?: string;
}

export interface SceneOutline {
  id: string;
  type: SceneType;
  title: string;
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
