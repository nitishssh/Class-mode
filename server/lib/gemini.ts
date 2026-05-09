import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "./logger";

const API_KEY = process.env.GOOGLE_API_KEY || "";

let genAI: GoogleGenerativeAI | null = null;

if (API_KEY) {
  logger.info("[Gemini] Initializing Gemini API with API Key");
  genAI = new GoogleGenerativeAI(API_KEY);
} else {
  logger.warn("[Gemini] GOOGLE_API_KEY not set. Gemini features will be disabled.");
}

export async function geminiChat(
  systemPrompt: string,
  userPrompt: string,
  model: string = "gemini-2.0-flash",
  options: { jsonMode?: boolean } = {}
): Promise<string> {
  if (!genAI) throw new Error("Gemini service not initialized — set GOOGLE_API_KEY");

  const generativeModel = genAI.getGenerativeModel({ model });
  const result = await generativeModel.generateContent({
    systemInstruction: systemPrompt,
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    ...(options.jsonMode ? { generationConfig: { responseMimeType: "application/json" } } : {}),
  });

  return result.response.text();
}

export async function* streamGeminiChat(
  systemPrompt: string,
  userPrompt: string,
  model: string = "gemini-2.0-flash"
): AsyncGenerator<string> {
  if (!genAI) throw new Error("Gemini service not initialized — set GOOGLE_API_KEY");

  const generativeModel = genAI.getGenerativeModel({ model });
  const result = await generativeModel.generateContentStream({
    systemInstruction: systemPrompt,
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
  });

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}
