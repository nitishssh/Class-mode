// ── Production guard ─────────────────────────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  throw new Error("Never run the seed script in production. Exiting.");
}

import "dotenv/config";
import mongoose from "mongoose";
import { connectMongoDB } from "../db";
import { storage } from "../storage";
import { InsertTest, InsertQuestion } from "../../shared/schema";

async function seedData() {
  await connectMongoDB();

  // Create or get a mock teacher
  let users = await storage.getUsers("teacher");
  let teacherId = users.length > 0 ? users[0].id : 1;

  if (users.length === 0) {
    console.log("No teacher found, creating a dummy teacher...");
    const dummyTeacher = await storage.createUser({
      username: "dummy_teacher_" + Date.now(),
      password: "Seed@TestOnly1",
      email: "teacher" + Date.now() + "@school.com",
      name: "Dummy Teacher",
      role: "teacher",
      status: "active",
    });
    teacherId = dummyTeacher.id;
  }

  // 1. Create a Test for "Chapter 5: Electromagnetism"
  const testData: InsertTest = {
    title: "Chapter 5: Electromagnetism Test",
    description: "A quick revision test covering flux, induction and related topics.",
    subject: "Physics",
    class: "12",
    teacherId: teacherId,
    totalMarks: 50,
    duration: 15,
    testDate: new Date(),
    questionTypes: ["mcq", "numerical", "short"],
    status: "published",
  };

  const test = await storage.createTest(testData);
  console.log(`Created test with ID: ${test.id}`);

  // Create Questions
  const questions: InsertQuestion[] = [
    {
      testId: test.id,
      type: "mcq",
      text: "Magnetic flux through a loop changes because...",
      options: [
        { id: "0", text: "Field strength changed" },
        { id: "1", text: "Area changed" },
        { id: "2", text: "Angle changed" },
        { id: "3", text: "All of the above" },
      ],
      correctAnswer: "3",
      marks: 10,
      order: 1,
      aiRubric: "Option 'All of the above' covers all variations in the formula Flux = B·A·cosθ.",
    },
    {
      testId: test.id,
      type: "numerical",
      text: "A coil of area 0.04 m² is in a magnetic field of 0.5 T. If the field drops to zero in 0.1s, what is the induced EMF (in Volts)?",
      options: null,
      correctAnswer: "0.2",
      marks: 15,
      order: 2,
      aiRubric: "Use Faraday's law: EMF = -d(Flux)/dt = -(0 - 0.5 * 0.04) / 0.1 = 0.2 V",
    },
    {
      testId: test.id,
      type: "short",
      text: "Explain briefly why a transformer cannot be used to step up DC voltage.",
      options: null,
      correctAnswer:
        "DC produces a constant magnetic field, so there is no changing flux to induce an EMF in the secondary coil.",
      marks: 25,
      order: 3,
      aiRubric:
        "Award full marks if the answer mentions that DC has zero frequency/constant flux, and induction relies on *changing* flux (Faraday's Law).",
    },
  ];

  for (const q of questions) {
    await storage.createQuestion(q);
    console.log(`Created question: ${q.text.substring(0, 30)}...`);
  }

  console.log("Seeding complete! You can access this test at /test/" + test.id);
  process.exit(0);
}

seedData().catch((err) => {
  console.error("Error during seeding:", err);
  process.exit(1);
});
