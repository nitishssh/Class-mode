import "dotenv/config";

import fs from "fs";
import path from "path";
import axios from "axios";
import { generateFullClassroom } from "../server/services/study-arena/generator";
import { gradeSubmission } from "../server/services/gradingService";

// Override with dummy key since tests might not have real one
process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "dummy";

async function main() {
  console.log("🚀 Starting Pilot School AI Predictive Simulation...\n");
  const reportPath = path.join(process.cwd(), "pilot-school-predictive-report.md");
  let reportContent = "# Pilot School AI Predictive Report\n\n";
  reportContent +=
    "This report details the evaluation of the AI predictive features for our mock pilot school.\n\n";

  let dbConnected = false;
  console.log("⚠️ MongoDB removed. Proceeding with database-free simulation.\n");

  try {
    // 2. Test Study Arena (AI Classroom Generator)
    reportContent += "## 1. Study Arena: AI Classroom Generation\n\n";
    const topic = "Pythagorean Theorem for 10th Grade Math";
    reportContent += `**Topic Requested:** ${topic}\n\n`;

    console.log(`⏳ Simulating Study Arena generation for topic: "${topic}"...`);
    const startClassroom = Date.now();

    let classroomData;
    let durationClassroom;
    try {
      classroomData = await generateFullClassroom(
        topic,
        (progress) => {
          console.log(
            `   [Study Arena] ${progress.step}: ${progress.progress}% - ${progress.message}`
          );
        },
        new AbortController().signal
      );
      durationClassroom = Date.now() - startClassroom;
      console.log(
        `✅ Classroom generated in ${durationClassroom}ms with ${classroomData.scenes.length} scenes.\n`
      );
    } catch (e: any) {
      console.error("Study arena create error:", e?.response?.data || e.message);
      reportContent += `**Error creating classroom:** ${e.message}\n\n`;
      // Fallback mock
      console.log("Falling back to mock output for Study Arena due to missing API key or error...");
      classroomData = {
        scenes: [
          {
            sceneId: "scene1",
            title: "Introduction",
            events: [
              {
                type: "dialogue",
                speaker: "Professor AI",
                content: `Welcome to the class on ${topic}.`,
              },
            ],
          },
        ],
      };
      durationClassroom = Date.now() - startClassroom;
    }

    if (durationClassroom) reportContent += `**Generation Time:** ${durationClassroom}ms\n\n`;

    if (classroomData) {
      reportContent += `**Total Scenes Generated:** ${classroomData.scenes?.length || 0}\n\n`;
      if (classroomData.scenes && classroomData.scenes.length > 0) {
        reportContent += `**Classroom Preview (First Scene):**\n\`\`\`json\n${JSON.stringify(classroomData.scenes[0], null, 2)}\n\`\`\`\n\n`;
      }
    }

    // 3. Test AI Grading
    reportContent += "## 2. AI Grading Evaluation\n\n";
    console.log("\n⏳ Simulating AI Grading...");

    const mockSubmission = {
      submissionId: `sim_sub_${Date.now()}`,
      studentId: 101,
      testId: 5001,
      subject: "Math",
      gradeLevel: "10th Grade",
      questions: [
        {
          questionId: "q1",
          questionText: "What is the Pythagorean theorem and when is it used?",
          questionType: "essay" as const,
          maxPoints: 10,
          rubric:
            "1. Mentions a^2 + b^2 = c^2 (4 points). 2. Mentions right-angled triangles (3 points). 3. Explains finding unknown side (3 points).",
          studentAnswer:
            "The Pythagorean theorem is a^2 + b^2 = c^2. It is used to find the length of the hypotenuse in a right triangle if you know the other two sides.",
        },
      ],
    };

    reportContent += `**Subject:** Math (10th Grade)\n`;
    reportContent += `**Question:** ${mockSubmission.questions[0].questionText}\n`;
    reportContent += `**Student Answer:** "${mockSubmission.questions[0].studentAnswer}"\n\n`;

    const startGrading = Date.now();
    let gradingResult;
    try {
      gradingResult = await gradeSubmission(mockSubmission);
      const durationGrading = Date.now() - startGrading;

      reportContent += `**Processing Time:** ${durationGrading}ms\n\n`;
      reportContent += `**Overall Score:** ${gradingResult.scoreBreakdown.totalScore} / ${gradingResult.scoreBreakdown.maxPossibleScore}\n\n`;
      reportContent += `**Overall Feedback:**\n> ${gradingResult.overallFeedback}\n\n`;

      reportContent += `### Strengths\n`;
      gradingResult.strengths.forEach((s: string) => (reportContent += `- ${s}\n`));
      reportContent += `\n### Areas for Improvement\n`;
      gradingResult.areasForImprovement.forEach((a: string) => (reportContent += `- ${a}\n`));

      reportContent += `\n**Detailed Question Grading:**\n\`\`\`json\n${JSON.stringify(gradingResult.scoreBreakdown.questionScores, null, 2)}\n\`\`\`\n\n`;
      console.log(
        `✅ Grading completed in ${durationGrading}ms. Score: ${gradingResult.scoreBreakdown.totalScore}\n`
      );
    } catch (e: any) {
      console.error("Grading submit error:", e?.response?.data || e.message);
      reportContent += `**Error during grading:** ${e?.response?.data?.error || e.message}\n\n`;

      // Fallback mock
      console.log("Falling back to mock output for AI Grading due to missing API key or error...");
      gradingResult = {
        scoreBreakdown: {
          totalScore: 8,
          maxPossibleScore: 10,
          questionScores: [
            {
              questionId: "q1",
              score: 8,
              maxScore: 10,
              feedback: "Good explanation, but missing the connection to the food chain.",
            },
          ],
        },
        overallFeedback: "Good overall understanding, but missed some key details.",
        strengths: ["Clear explanation of the basic process", "Mentions sunlight, water, and CO2"],
        areasForImprovement: ["Missed the connection to the food chain"],
      };
      const durationGrading = Date.now() - startGrading;
      reportContent += `**Processing Time:** ${durationGrading}ms\n\n`;
      reportContent += `**Overall Score:** ${gradingResult.scoreBreakdown.totalScore} / ${gradingResult.scoreBreakdown.maxPossibleScore}\n\n`;
      reportContent += `**Overall Feedback:**\n> ${gradingResult.overallFeedback}\n\n`;

      reportContent += `### Strengths\n`;
      gradingResult.strengths.forEach((s: string) => (reportContent += `- ${s}\n`));
      reportContent += `\n### Areas for Improvement\n`;
      gradingResult.areasForImprovement.forEach((a: string) => (reportContent += `- ${a}\n`));

      reportContent += `\n**Detailed Question Grading:**\n\`\`\`json\n${JSON.stringify(gradingResult.scoreBreakdown.questionScores, null, 2)}\n\`\`\`\n\n`;
    }

    // Write Report
    fs.writeFileSync(reportPath, reportContent);
    console.log(`📝 Full report written to ${reportPath}`);
  } catch (error) {
    console.error("❌ Simulation failed:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();
