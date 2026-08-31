import { ClassModeAIClient } from "../study-arena-client";
import { classModeAILessonDraftSchema } from "@shared/classmode-ai";
import type { ClassroomGenerationProgress } from "./types";

export async function generateFullClassroom(
  requirement: string,
  onProgress?: (progress: ClassroomGenerationProgress) => void,
  signal?: AbortSignal
): Promise<any> {
  const baseUrl = process.env.CLASSMODE_AI_BASE_URL?.trim();
  if (!baseUrl) throw new Error("CLASSMODE_AI_BASE_URL is required");

  const client = new ClassModeAIClient({
    baseUrl,
    serviceSecret: process.env.CLASSMODE_AI_SERVICE_SECRET,
  });

  const checkAborted = () => {
    if (signal?.aborted) throw new Error("Generation cancelled");
  };

  onProgress?.({
    step: "generating_agents",
    progress: 10,
    message: "Starting ClassMode AI generation...",
    scenesGenerated: 0,
  });

  // Adopt HTTP client
  const workspaceId = "legacy";
  const upstream = await client.createGenerationJob(workspaceId, {
    requirement,
  });

  let current = upstream;
  const deadline = Date.now() + Number(process.env.CLASSMODE_AI_GENERATION_TIMEOUT_MS || 180_000);
  
  while (current.status === "queued" || current.status === "running") {
    checkAborted();
    if (Date.now() >= deadline) throw new Error("ClassMode AI generation timed out");
    await new Promise((resolve) => setTimeout(resolve, 750));
    current = await client.getGenerationJob(workspaceId, upstream.id);
    onProgress?.({
      step: "generating_scenes",
      progress: Math.max(10, Math.min(90, current.progress)),
      message: current.message || "Generating...",
      scenesGenerated: current.scenesGenerated || 0,
      totalScenes: current.totalScenes,
    });
  }

  if (current.status !== "succeeded") {
    throw new Error(current.error || "ClassMode AI generation failed");
  }

  const rawDraft = await client.getLessonDraft(workspaceId, upstream.id);
  
  // Strip provider-specific tokens (e.g. OpenAI usage stats) at the border
  const cleanedDraft = JSON.parse(JSON.stringify(rawDraft, (key, value) => {
    if (key === "usage" || key === "providerTokens" || key === "openAiTokens") {
      return undefined;
    }
    return value;
  }));

  // Save the lesson draft exactly as received, verified by the Zod schema
  const draft = classModeAILessonDraftSchema.parse(cleanedDraft);

  onProgress?.({
    step: "completed",
    progress: 100,
    message: "Classroom generation completed",
    scenesGenerated: draft.scenes.length,
    totalScenes: draft.scenes.length,
  });

  return draft;
}
