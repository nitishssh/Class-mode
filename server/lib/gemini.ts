import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "./logger";

const API_KEY = process.env.GOOGLE_API_KEY || "";

if (!API_KEY) {
  logger.warn("[Gemini] GOOGLE_API_KEY is not set. Gemini features will be limited.");
}

const genAI = new GoogleGenerativeAI(API_KEY);

export async function geminiChat(systemPrompt: string, userPrompt: string, model: string = "gemini-2.0-flash") {
  try {
    const generativeModel = genAI.getGenerativeModel({ model });
    
    // Combine system and user prompt for Gemini (Gemini 1.5 supports systemInstruction)
    const result = await generativeModel.generateContent({
      systemInstruction: systemPrompt,
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    });

    const response = await result.response;
    return response.text();
  } catch (error) {
    logger.error("[Gemini] Chat error:", error);
    throw error;
  }
}

export async function* streamGeminiChat(systemPrompt: string, userPrompt: string, model: string = "gemini-2.0-flash") {
  try {
    const generativeModel = genAI.getGenerativeModel({ model });
    
    const result = await generativeModel.generateContentStream({
      systemInstruction: systemPrompt,
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    });

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        yield chunkText;
      }
    }
  } catch (error) {
    logger.error("[Gemini] Stream error:", error);
    throw error;
  }
}
