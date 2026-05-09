import { GoogleGenerativeAI } from "@google/generative-ai";
import { VertexAI } from "@google-cloud/vertexai";
import { logger } from "./logger";

const API_KEY = process.env.GOOGLE_API_KEY || "";
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || process.env.VITE_FIREBASE_PROJECT_ID;
const REGION = process.env.GOOGLE_CLOUD_REGION || "us-central1";

// ── Service Detection ────────────────────────────────────────────────────────
// If running on GCP (detected via PROJECT_ID and no API_KEY), we prefer Vertex AI
const useVertex = !!PROJECT_ID && !API_KEY;

let genAI: GoogleGenerativeAI | null = null;
let vertexAI: VertexAI | null = null;

if (useVertex) {
  logger.info(`[Gemini] Initializing Vertex AI in project ${PROJECT_ID}, region ${REGION}`);
  vertexAI = new VertexAI({ project: PROJECT_ID, location: REGION });
} else if (API_KEY) {
  logger.info("[Gemini] Initializing Gemini API with API Key");
  genAI = new GoogleGenerativeAI(API_KEY);
} else {
  logger.warn("[Gemini] Neither GOOGLE_API_KEY nor GOOGLE_CLOUD_PROJECT is set. Gemini features will be disabled.");
}

export async function geminiChat(systemPrompt: string, userPrompt: string, model: string = "gemini-2.0-flash") {
  try {
    if (vertexAI) {
      const generativeModel = vertexAI.getGenerativeModel({ model });
      const result = await generativeModel.generateContent({
        systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      });
      const response = await result.response;
      return response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    if (genAI) {
      const generativeModel = genAI.getGenerativeModel({ model });
      const result = await generativeModel.generateContent({
        systemInstruction: systemPrompt,
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      });
      const response = await result.response;
      return response.text();
    }

    throw new Error("Gemini service not initialized");
  } catch (error) {
    logger.error("[Gemini] Chat error:", error);
    throw error;
  }
}

export async function* streamGeminiChat(systemPrompt: string, userPrompt: string, model: string = "gemini-2.0-flash") {
  try {
    if (vertexAI) {
      const generativeModel = vertexAI.getGenerativeModel({ model });
      const result = await generativeModel.generateContentStream({
        systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      });

      for await (const chunk of result.stream) {
        const chunkText = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
        if (chunkText) yield chunkText;
      }
      return;
    }

    if (genAI) {
      const generativeModel = genAI.getGenerativeModel({ model });
      const result = await generativeModel.generateContentStream({
        systemInstruction: systemPrompt,
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      });

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) yield chunkText;
      }
      return;
    }

    throw new Error("Gemini service not initialized");
  } catch (error) {
    logger.error("[Gemini] Stream error:", error);
    throw error;
  }
}
