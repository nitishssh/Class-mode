import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

async function listModels() {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");
  try {
    const result = await genAI.getGenerativeModel({ model: "gemini-pro" }); // Just to check connectivity
    console.log("Connectivity check with gemini-pro...");

    // There isn't a direct listModels in the current SDK version easily, but let's try a simple prompt
    const chat = await result.generateContent("Hello");
    console.log("Response:", chat.response.text());
    console.log("SUCCESS: gemini-pro is available");
  } catch (err) {
    console.error("FAILED: gemini-pro is not available", err);
  }
}

listModels();
