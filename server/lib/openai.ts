import OpenAI from "openai";
import { z } from "zod";
import { logger } from "./logger";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
if (!process.env.OPENAI_API_KEY) {
  logger.warn("OPENAI_API_KEY is not set. AI features (tutor, test generation) will not work.");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatResponse {
  content: string;
}

// Validation schemas
const EvaluationSchema = z.object({
  score: z.number().min(0),
  confidence: z.number().min(0),
  feedback: z.string().min(1),
});

const StudyPlanSchema = z.object({
  plan: z.string(),
  resources: z.array(
    z.object({
      title: z.string(),
      type: z.string(),
      url: z.string().optional(),
    })
  ),
});

const PerformanceAnalysisSchema = z.object({
  averageScore: z.number(),
  hardestQuestions: z.array(
    z.object({
      questionId: z.number(),
      question: z.string(),
      avgScore: z.number(),
    })
  ),
  recommendations: z.string(),
});

// ── OpenAI error normaliser ───────────────────────────────────────────────────
function handleOpenAIError(err: any): never {
  if (err?.status === 429)
    throw Object.assign(new Error("AI rate limit reached, try again shortly"), { status: 503 });
  if (err?.status === 503 || err?.code === "ECONNREFUSED")
    throw Object.assign(new Error("AI is unavailable right now"), { status: 503 });
  throw Object.assign(new Error("AI is unavailable right now"), { status: 503 });
}

export async function aiChat(
  messages: ChatMessage[],
  systemPrompt?: string
): Promise<ChatResponse> {
  try {
    // Use provided system prompt or default
    if (systemPrompt) {
      // Check if system message already exists, if so update it, otherwise unshift
      const existingSystemIndex = messages.findIndex((msg) => msg.role === "system");
      if (existingSystemIndex !== -1) {
        messages[existingSystemIndex].content = systemPrompt;
      } else {
        messages.unshift({ role: "system", content: systemPrompt });
      }
    } else if (!messages.some((msg) => msg.role === "system")) {
      messages.unshift({
        role: "system",
        content:
          "You are an AI tutor for high school students. You're knowledgeable about physics, chemistry, mathematics, biology, and computer science. Provide clear, concise explanations. Include examples when helpful. For math problems, show step-by-step solutions. Keep explanations appropriate for high school level understanding. Be encouraging and supportive.",
      });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
    });

    return {
      content: response.choices[0].message.content || "I don't have a response for that.",
    };
  } catch (error) {
    logger.error("AI chat error:", error);
    handleOpenAIError(error);
  }
}

interface EvaluationResult {
  score: number;
  confidence: number;
  feedback: string;
}

export async function evaluateSubjectiveAnswer(
  studentAnswer: string,
  question: string,
  rubric: string,
  maxMarks: number
): Promise<EvaluationResult> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert teacher evaluating student answers. 
          Given the question, rubric, and student's answer, provide an evaluation with:
          1. A score between 0 and ${maxMarks} (can be decimal)
          2. A confidence level between 0 and 100 indicating how certain you are of your evaluation
          3. Constructive feedback explaining the score
          
          Respond with JSON in this format: { "score": number, "confidence": number, "feedback": string }`,
        },
        {
          role: "user",
          content: `Question: ${question}\nRubric: ${rubric}\nStudent Answer: ${studentAnswer}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "{}";
    try {
      const parsed = JSON.parse(content);
      const result = EvaluationSchema.parse(parsed);

      return {
        score: Math.min(maxMarks, result.score),
        confidence: Math.min(100, result.confidence),
        feedback: result.feedback,
      };
    } catch (parseError) {
      logger.error("AI evaluation schema validation error:", parseError);
      return {
        score: 0,
        confidence: 0,
        feedback: "Error processing evaluation. Please review manually.",
      };
    }
  } catch (error) {
    logger.error("AI evaluation service error:", error);
    return {
      score: 0,
      confidence: 0,
      feedback: "The AI service is currently unavailable. Please check back later.",
    };
  }
}

export async function generateStudyPlan(
  weakTopics: string[],
  strongTopics: string[],
  subject: string
): Promise<{ plan: string; resources: Array<{ title: string; type: string; url?: string }> }> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Generate a personalized study plan focused on improving weak topics, along with recommended resources.
          Return a JSON object with two fields:
          1. "plan": a structured study plan with bullet points and time estimates
          2. "resources": an array of recommended resources, each with "title", "type" (video, article, practice), and optional "url"
          
          Keep the response concise and focused on actionable advice.`,
        },
        {
          role: "user",
          content: `Subject: ${subject}
          Weak Topics: ${weakTopics.join(", ")}
          Strong Topics: ${strongTopics.join(", ")}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "{}";
    try {
      const parsed = JSON.parse(content);
      return StudyPlanSchema.parse(parsed);
    } catch (parseError) {
      logger.error("AI study plan schema validation error:", parseError);
      return {
        plan: "Error generating study plan. Please try again later.",
        resources: [{ title: "General review resources", type: "general" }],
      };
    }
  } catch (error) {
    logger.error("Study plan generation error:", error);
    return {
      plan: "Study plan generation failed. Please focus on reviewing the weak topics identified in your assessment.",
      resources: [{ title: "General review resources", type: "general" }],
    };
  }
}

export async function analyzeTestPerformance(
  testResults: Array<{
    studentId: number;
    score: number;
    answers: Array<{ questionId: number; score: number; question: string }>;
  }>
): Promise<{
  averageScore: number;
  hardestQuestions: Array<{ questionId: number; question: string; avgScore: number }>;
  recommendations: string;
}> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Analyze test performance data and provide insights.
          Return a JSON object with:
          1. "averageScore": the calculated average score
          2. "hardestQuestions": an array of questions with lowest average scores (max 3)
          3. "recommendations": teaching recommendations based on the results`,
        },
        {
          role: "user",
          content: `Test Data: ${JSON.stringify(testResults)}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "{}";
    try {
      const parsed = JSON.parse(content);
      return PerformanceAnalysisSchema.parse(parsed);
    } catch (parseError) {
      logger.error("AI test performance analysis schema validation error:", parseError);
      return {
        averageScore:
          testResults.reduce((sum, result) => sum + result.score, 0) / testResults.length,
        hardestQuestions: [],
        recommendations: "Error analyzing test performance. Please review individual results.",
      };
    }
  } catch (error) {
    logger.error("Test analysis error:", error);
    return {
      averageScore: testResults.reduce((sum, result) => sum + result.score, 0) / testResults.length,
      hardestQuestions: [],
      recommendations: "Performance analysis failed. Please review individual student results.",
    };
  }
}
