import 'dotenv/config';
import { GoogleGenerativeAI } from "@google/generative-ai";

async function listModels() {
  const apiKey = process.env.GOOGLE_API_KEY || "";
  console.log("Checking key:", apiKey.substring(0, 10) + "...");
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    console.log("Available models:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Failed to fetch models", err);
  }
}

listModels();
