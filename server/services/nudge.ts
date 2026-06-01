import { getCachedJSON, setCachedJSON } from "../lib/redis";
// Or whatever AI tool is available

// A generic nudge fallback if AI is unavailable or fails
const FALLBACK_NUDGES = [
  "Have you considered the basic principles we covered in the last lesson?",
  "What do you think is the first step to solving this?",
  "Can you break this problem down into smaller parts?",
  "What information do you already have that might help here?"
];

export async function getSocraticNudge(topic: string): Promise<string> {
  const normalizedTopic = topic.trim().toLowerCase();
  if (!normalizedTopic) return FALLBACK_NUDGES[0];

  const cacheKey = `nudge:${normalizedTopic}`;
  
  // Try Cache
  const cached = await getCachedJSON<string>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // We would normally call an LLM here to generate a socratic hint for the specific topic.
    // For now, we will select a pseudo-random fallback or generate a basic one,
    // assuming full LLM integration for this specific nudge generation might be overkill
    // if OpenAI is not set up perfectly yet.
    
    // In a full implementation, we'd use something like:
    // const prompt = `Provide a one-sentence Socratic nudge for a student asking about "${topic}". Do not give the answer.`;
    // const response = await openai.chat.completions.create({...})
    
    const nudge = `Thinking about ${topic}... What foundational concept does this relate to?`;
    
    // Cache for 24 hours (86400 seconds) since generic topics don't change
    await setCachedJSON(cacheKey, nudge, 86400);
    return nudge;
  } catch (error) {
    console.error("Failed to generate nudge:", error);
    return FALLBACK_NUDGES[Math.floor(Math.random() * FALLBACK_NUDGES.length)];
  }
}
