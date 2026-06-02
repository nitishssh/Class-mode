// ── Production guard ─────────────────────────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  console.warn("⚠️  WARNING: Running seed script in PRODUCTION environment! ⚠️");
}

import "dotenv/config";
import { connectPostgres } from "../db-pg";
import { storage } from "../storage";
import {
  InsertUser,
  InsertWorkspace,
  InsertChannel,
  InsertMessage,
  InsertTest,
  InsertTask,
  InsertNotification,
  InsertLiveClass,
  InsertFocusSession,
} from "../../shared/schema";

async function seedPilotData() {
  await connectPostgres();

  console.log("Seeding Pilot Admin User...");

  const pilotData: InsertUser = {
    username: "nitish_admin",
    password: "PilotPassword123!",
    email: "nitiskumar44470@gmail.com",
    name: "Nitish Admin",
    role: "admin",
    status: "active",
    class: "10",
    subject: "All",
  };

  const pilot = await storage.createUser(pilotData);
  console.log(`Created pilot admin user with ID: ${pilot.id} (username: ${pilotData.username})`);

  console.log("Seeding Workspace and Chat Data...");
  const workspaceData: InsertWorkspace = {
    name: "Pilot Headquarters",
    description: "Main workspace for pilot testing.",
    ownerId: pilot.id,
    type: "school",
    members: [pilot.id],
  };
  const workspace = await storage.createWorkspace(workspaceData);

  const channelData: InsertChannel = {
    workspaceId: workspace.id,
    name: "general-pilot",
    type: "text",
    class: "10",
  };
  const channel = await storage.createChannel(channelData);

  const messageData: InsertMessage = {
    channelId: channel.id,
    authorId: pilot.id,
    content: "Welcome to the pilot environment. This is a real mock message to test the chat feature.",
    type: "text",
    isHomework: false,
    readBy: [pilot.id],
  };
  await storage.createMessage(messageData);

  console.log("Seeding Test Data...");
  const testData: InsertTest = {
    title: "Pilot Diagnostic Assessment",
    description: "A mock test to verify test assignment and grading features.",
    subject: "Mathematics",
    class: "10",
    teacherId: pilot.id, // Admin acting as teacher
    totalMarks: 100,
    duration: 60,
    testDate: new Date(),
    questionTypes: ["mcq", "short"],
    status: "published",
  };
  const test = await storage.createTest(testData);

  await storage.createQuestion({
    testId: test.id,
    type: "mcq",
    text: "What is the square root of 144?",
    options: [
      { id: "0", text: "10" },
      { id: "1", text: "12" },
      { id: "2", text: "14" },
    ],
    correctAnswer: "1",
    marks: 10,
    order: 1,
  });

  console.log("Seeding Task Data...");
  const taskData: InsertTask = {
    userId: pilot.id,
    title: "Review Pilot Feedback",
    status: "todo",
    priority: "high",
    tags: ["pilot", "feedback"],
    comments: 0,
    attachments: 0,
  };
  await storage.createTask(taskData);

  console.log("Seeding Notification Data...");
  const notifData: InsertNotification = {
    userId: pilot.id,
    type: "announcement",
    title: "Pilot Environment Ready",
    body: "Your pilot account has been fully seeded with test data across all features.",
    isRead: false,
  };
  await storage.createNotification(notifData);

  console.log("Seeding Live Class Data...");
  const liveClassData: InsertLiveClass = {
    title: "Pilot Onboarding Session",
    description: "A live session to test Daily.co integration.",
    teacherId: pilot.id,
    class: "10",
    scheduledTime: new Date(Date.now() + 86400000), // Tomorrow
    durationMinutes: 45,
    status: "scheduled",
  };
  await storage.createLiveClass(liveClassData);

  console.log("Seeding Focus Session Data...");
  const focusData: InsertFocusSession = {
    userId: pilot.id,
    subject: "Deep Work",
    mode: "work",
    durationSeconds: 1500, // 25 mins
  };
  await storage.createFocusSession(focusData);

  console.log("--------------------------------------------------");
  console.log("Pilot Data Seeding Complete!");
  console.log(`Login Username: ${pilotData.username}`);
  console.log(`Login Password: ${pilotData.password}`);
  console.log("--------------------------------------------------");

  process.exit(0);
}

seedPilotData().catch((err) => {
  console.error("Error during pilot data seeding:", err);
  process.exit(1);
});
