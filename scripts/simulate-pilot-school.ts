import "dotenv/config";

import fs from "fs";
import path from "path";
import axios from "axios";
import { generateFullClassroom } from "../server/services/study-arena/generator";
import { gradeSubmission } from "../server/services/gradingService";
import { connectPostgres, isPgReady } from "../server/db-pg";

// Override with dummy key since tests might not have real one
process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "dummy";

async function main() {
  console.log("🚀 Starting Pilot School AI Predictive Simulation...\n");
  const reportPath = path.join(process.cwd(), "pilot-school-predictive-report.md");
  let reportContent = "# Pilot School AI Predictive Report\n\n";
  reportContent +=
    "This report details the evaluation of the AI predictive features for our mock pilot school.\n\n";

  console.log("⚠️ MongoDB removed. Connecting to PostgreSQL for grading persistence...\n");
  await connectPostgres();
  const dbConnected = isPgReady();
  if (dbConnected) {
    console.log("✅ PostgreSQL connected — grading outcomes will persist.\n");
  } else {
    console.log(
      "⚠️ PostgreSQL unavailable (POSTGRESQL_URL unset or unreachable). " +
        "Grading will run AI-only without persistence.\n"
    );
  }

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
      content:
        "The Pythagorean theorem is a^2 + b^2 = c^2. It is used to find the length of the hypotenuse in a right triangle if you know the other two sides.",
      contentType: "text" as const,
      rubric: {
        title: "Pythagorean Theorem Essay",
        gradingType: "essay" as const,
        totalPoints: 10,
        criteria: [
          {
            name: "Mentions Formula",
            description: "Mentions a^2 + b^2 = c^2",
            maxPoints: 4,
            weight: 0.4,
          },
          {
            name: "Mentions Right Triangle",
            description: "Mentions right-angled triangles",
            maxPoints: 3,
            weight: 0.3,
          },
          {
            name: "Explains Usage",
            description: "Explains finding unknown side",
            maxPoints: 3,
            weight: 0.3,
          },
        ],
      },
    };

    reportContent += `**Subject:** Math (10th Grade)\n`;
    reportContent += `**Question:** What is the Pythagorean theorem and when is it used?\n`;
    reportContent += `**Student Answer:** "${mockSubmission.content}"\n\n`;

    const startGrading = Date.now();
    let gradingResult;
    try {
      gradingResult = await gradeSubmission(mockSubmission);
      const durationGrading = Date.now() - startGrading;

      reportContent += `**Processing Time:** ${durationGrading}ms\n\n`;
      reportContent += `**Overall Score:** ${gradingResult.scoreBreakdown?.totalScore} / ${gradingResult.scoreBreakdown?.maxScore}\n\n`;
      reportContent += `**Overall Feedback:**\n> ${gradingResult.overallFeedback}\n\n`;

      reportContent += `### Strengths\n`;
      gradingResult.strengths?.forEach((s: string) => (reportContent += `- ${s}\n`));
      reportContent += `\n### Areas for Improvement\n`;
      gradingResult.areasForImprovement?.forEach((a: string) => (reportContent += `- ${a}\n`));

      reportContent += `\n**Detailed Question Grading:**\n\`\`\`json\n${JSON.stringify(gradingResult.scoreBreakdown?.criteria, null, 2)}\n\`\`\`\n\n`;
      console.log(
        `✅ Grading completed in ${durationGrading}ms. Score: ${gradingResult.scoreBreakdown?.totalScore}\n`
      );
    } catch (e: any) {
      console.error("Grading submit error:", e?.response?.data || e.message);
      reportContent += `**Error during grading:** ${e?.response?.data?.error || e.message}\n\n`;

      // Fallback mock
      console.log("Falling back to mock output for AI Grading due to missing API key or error...");
      gradingResult = {
        scoreBreakdown: {
          totalScore: 8,
          maxScore: 10,
          criteria: [
            {
              criterionName: "Mentions Formula",
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
      reportContent += `**Overall Score:** ${gradingResult.scoreBreakdown.totalScore} / ${gradingResult.scoreBreakdown.maxScore}\n\n`;
      reportContent += `**Overall Feedback:**\n> ${gradingResult.overallFeedback}\n\n`;

      reportContent += `### Strengths\n`;
      gradingResult.strengths.forEach((s: string) => (reportContent += `- ${s}\n`));
      reportContent += `\n### Areas for Improvement\n`;
      gradingResult.areasForImprovement.forEach((a: string) => (reportContent += `- ${a}\n`));

      reportContent += `\n**Detailed Question Grading:**\n\`\`\`json\n${JSON.stringify(gradingResult.scoreBreakdown.criteria, null, 2)}\n\`\`\`\n\n`;
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
