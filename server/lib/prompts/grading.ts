// ─── Grading Prompt Templates for OpenAI GPT-4o ───────────────────────

export interface GradingPromptContext {
  rubricText: string;
  contentType: string;
  content: string;
  language?: string; // for code grading
  studentId?: number;
}

// ─── System Prompt: Essay / Text Grading ───────────────────────────────

export function buildEssayGradingSystemPrompt(): string {
  return `
You are an expert educator and grader. You will be given a student submission and a grading rubric.
Your job is to:
1. Score each rubric criterion based on the submission content.
2. Provide constructive feedback for each criterion.
3. Give an overall assessment with strengths and areas for improvement.

RESPONSE FORMAT: You MUST respond in valid JSON matching this schema:
{
  "criteria": [
    { "criterionName": "...", "score": <number>, "maxScore": <number>, "feedback": "..." }
  ],
  "overallFeedback": "...",
  "strengths": ["...", "..."],
  "areasForImprovement": ["...", "..."]
}

RULES:
- Score each criterion honestly and fairly.
- Do not give full marks unless the work truly deserves it.
- Feedback should be specific and actionable.
- Be encouraging but honest.
`.trim();
}

// ─── System Prompt: Code Grading ───────────────────────────────────────

export function buildCodeGradingSystemPrompt(language: string): string {
  return `
You are an expert software engineer and coding instructor. You will grade a ${language} code submission using the provided rubric.

EVALUATION CRITERIA:
- Correctness: Does the code produce the expected output? Are there bugs?
- Code Quality: Is it readable? Well-named variables? Proper structure?
- Best Practices: Does it follow ${language} conventions? Error handling?
- Efficiency: Time/space complexity considerations.
- Documentation: Are there helpful comments? Good function/docs?

RESPONSE FORMAT: You MUST respond in valid JSON matching this schema:
{
  "criteria": [
    { "criterionName": "...", "score": <number>, "maxScore": <number>, "feedback": "..." }
  ],
  "overallFeedback": "...",
  "strengths": ["Clean variable naming", "Good error handling"],
  "areasForImprovement": ["Add more comments", "Consider edge cases"]
}

RULES:
- Run through the code mentally to check logic.
- Penalize for syntax errors, undefined variables, infinite loops.
- Reward clean, idiomatic ${language} code.
- Be specific about what lines or patterns need improvement.
`.trim();
}

// ─── System Prompt: Math/STEM Grading ─────────────────────────────────

export function buildMathGradingSystemPrompt(): string {
  return `
You are an expert mathematics/science instructor. You will grade a student's solution using the provided rubric.

EVALUATION CRITERIA:
- Correctness: Is the final answer correct? Are the steps valid?
- Methodology: Did the student use an appropriate method/solution path?
- Clarity: Are the steps clearly shown and explained?
- Completeness: Did they answer all parts of the question?
- Notation: Proper use of mathematical/scientific notation?

RESPONSE FORMAT: You MUST respond in valid JSON matching this schema:
{
  "criteria": [
    { "criterionName": "...", "score": <number>, "maxScore": <number>, "feedback": "..." }
  ],
  "overallFeedback": "...",
  "strengths": ["..."],
  "areasForImprovement": ["..."]
}

RULES:
- Check each step for mathematical validity.
- Award partial credit where steps are correct but final answer is wrong.
- Be explicit about which step contains an error.
`.trim();
}

// ─── User Message Builder ──────────────────────────────────────────────

export function buildGradingUserMessage(ctx: GradingPromptContext): string {
  const { rubricText, contentType, content, language } = ctx;
  const typeLabel =
    contentType === "code_python"
      ? "Python code"
      : contentType === "code_javascript"
        ? "JavaScript code"
        : contentType === "code_typescript"
          ? "TypeScript code"
          : "text submission";

  return `
--- RUBRIC ---
${rubricText}

--- STUDENT SUBMISSION (${typeLabel}${language ? ` - ${language}` : ""}) ---
${content}

---

Please grade this submission against the rubric and respond in the required JSON format.
`.trim();
}

// ─── Few-Shot Examples for Essay Grading ───────────────────────────────

export function getEssayFewShotExamples(): { role: "user" | "assistant"; content: string }[] {
  return [
    {
      role: "user",
      content: `
RUBRIC:
- Content (10 pts, weight 40%): Clarity of argument and use of evidence
- Organization (5 pts, weight 20%): Logical flow and structure
- Grammar (5 pts, weight 20%): Correct grammar and spelling
- Originality (10 pts, weight 20%): Unique insights and perspective

SUBMISSION:
The industrial revolution changed society forever. It brought many new machines. People moved to cities. This was good but also bad because cities were crowded.

GRADING:
`.trim(),
    },
    {
      role: "assistant",
      content: JSON.stringify({
        criteria: [
          {
            criterionName: "Content",
            score: 4,
            maxScore: 10,
            feedback:
              "The submission makes basic claims but lacks specific evidence or examples. The argument is underdeveloped.",
          },
          {
            criterionName: "Organization",
            score: 3,
            maxScore: 5,
            feedback:
              "Sentences are simple and disconnected. There is no clear introduction, body, or conclusion structure.",
          },
          {
            criterionName: "Grammar",
            score: 5,
            maxScore: 5,
            feedback: "Grammar and spelling are correct throughout.",
          },
          {
            criterionName: "Originality",
            score: 3,
            maxScore: 10,
            feedback:
              "The insights are generic and could apply to any basic summary of the industrial revolution. No unique perspective is offered.",
          },
        ],
        overallFeedback:
          "This is a very basic response that needs significant development. Add specific historical examples, organize into paragraphs, and offer your own analysis.",
        strengths: ["Correct grammar", "Clear sentences"],
        areasForImprovement: [
          "Add specific evidence and examples",
          "Structure with introduction/body/conclusion",
          "Develop a unique argument or perspective",
        ],
      }),
    },
  ];
}

// ─── Select appropriate system prompt based on grading type ──────────

export function getSystemPrompt(gradingType: string, language?: string): string {
  switch (gradingType) {
    case "code":
      return buildCodeGradingSystemPrompt(language ?? "code");
    case "math":
      return buildMathGradingSystemPrompt();
    case "essay":
    default:
      return buildEssayGradingSystemPrompt();
  }
}
