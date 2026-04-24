/// <reference types="node" />
/**
 * scripts/seed-test-data.ts
 *
 * Seeds 50 test users across all roles into MongoDB.
 * Credentials: email = name@school.test, password = Test@1234
 *
 * Run with:
 *   npx tsx scripts/seed-test-data.ts
 */

import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import {
  MongoUser,
  MongoTest,
  MongoQuestion,
  MongoWorkspace,
  MongoChannel,
  getNextSequenceValue,
} from "../shared/mongo-schema.js";

const MONGO_URL = process.env.MONGODB_URL || "mongodb://localhost:27017/learningpro";
const DEFAULT_PASSWORD = "Test@1234";

// ── User definitions ──────────────────────────────────────────────────────────

const CLASSES = ["10A", "10B", "11A", "11B", "12A"];
const SUBJECTS = [
  "Mathematics",
  "Science",
  "English",
  "History",
  "Physics",
  "Chemistry",
  "Biology",
  "Computer Science",
  "Economics",
  "Geography",
];

const users = [
  // Admin
  { name: "System Admin", email: "admin@school.test", role: "admin", username: "admin" },
  // Principal
  {
    name: "Dr. Sarah Principal",
    email: "principal@school.test",
    role: "principal",
    username: "principal",
  },
  // School Admin
  {
    name: "Alex School Admin",
    email: "schooladmin@school.test",
    role: "school_admin",
    username: "schooladmin",
  },

  // 10 Teachers
  {
    name: "Mr. Raj Math",
    email: "teacher.math@school.test",
    role: "teacher",
    username: "teacher_math",
    subject: "Mathematics",
    class: "10A",
  },
  {
    name: "Ms. Priya Science",
    email: "teacher.science@school.test",
    role: "teacher",
    username: "teacher_science",
    subject: "Science",
    class: "10B",
  },
  {
    name: "Mrs. Emily English",
    email: "teacher.english@school.test",
    role: "teacher",
    username: "teacher_english",
    subject: "English",
    class: "11A",
  },
  {
    name: "Mr. Arun History",
    email: "teacher.history@school.test",
    role: "teacher",
    username: "teacher_history",
    subject: "History",
    class: "11B",
  },
  {
    name: "Ms. Neha Physics",
    email: "teacher.physics@school.test",
    role: "teacher",
    username: "teacher_physics",
    subject: "Physics",
    class: "12A",
  },
  {
    name: "Mr. Kiran Chem",
    email: "teacher.chem@school.test",
    role: "teacher",
    username: "teacher_chem",
    subject: "Chemistry",
    class: "10A",
  },
  {
    name: "Ms. Anita Bio",
    email: "teacher.bio@school.test",
    role: "teacher",
    username: "teacher_bio",
    subject: "Biology",
    class: "10B",
  },
  {
    name: "Mr. Suresh CS",
    email: "teacher.cs@school.test",
    role: "teacher",
    username: "teacher_cs",
    subject: "Computer Science",
    class: "11A",
  },
  {
    name: "Ms. Deepa Eco",
    email: "teacher.eco@school.test",
    role: "teacher",
    username: "teacher_eco",
    subject: "Economics",
    class: "11B",
  },
  {
    name: "Mr. Vinod Geo",
    email: "teacher.geo@school.test",
    role: "teacher",
    username: "teacher_geo",
    subject: "Geography",
    class: "12A",
  },

  // 35 Students (7 per class across 5 classes)
  ...CLASSES.flatMap((cls, ci) =>
    Array.from({ length: 7 }, (_, i) => {
      const n = ci * 7 + i + 1;
      return {
        name: `Student ${n} ${cls}`,
        email: `student${n}@school.test`,
        role: "student",
        username: `student${n}`,
        class: cls,
      };
    })
  ),

  // 2 Parents
  {
    name: "Parent One",
    email: "parent1@school.test",
    role: "parent",
    username: "parent1",
    studentId: "student1@school.test",
  },
  {
    name: "Parent Two",
    email: "parent2@school.test",
    role: "parent",
    username: "parent2",
    studentId: "student2@school.test",
  },
];

// ── Seed helpers ──────────────────────────────────────────────────────────────

async function initCounters() {
  // Get max existing IDs and ensure counters are above them
  const maxUser = await (MongoUser as any).findOne().sort({ id: -1 }).limit(1);
  const maxUserId = maxUser?.id || 0;

  const maxTest = await (mongoose.model("Test") as any)
    .findOne()
    .sort({ id: -1 })
    .limit(1)
    .catch(() => null);
  const maxTestId = maxTest?.id || 0;

  const maxWs = await (MongoWorkspace as any).findOne().sort({ id: -1 }).limit(1);
  const maxWsId = maxWs?.id || 0;

  const maxCh = await (MongoChannel as any).findOne().sort({ id: -1 }).limit(1);
  const maxChId = maxCh?.id || 0;

  // Use findOneAndUpdate with $max to set sequence only if it's lower
  const Counter = mongoose.model("Counter");
  await Counter.findOneAndUpdate({ _id: "userId" }, { $max: { seq: maxUserId } }, { upsert: true });
  await Counter.findOneAndUpdate(
    { _id: "test_id" },
    { $max: { seq: maxTestId } },
    { upsert: true }
  );
  await Counter.findOneAndUpdate(
    { _id: "workspace_id" },
    { $max: { seq: maxWsId } },
    { upsert: true }
  );
  await Counter.findOneAndUpdate(
    { _id: "channel_id" },
    { $max: { seq: maxChId } },
    { upsert: true }
  );

  // Also handle question counter
  const maxQ = await (mongoose.model("Question") as any)
    .findOne()
    .sort({ id: -1 })
    .limit(1)
    .catch(() => null);
  await Counter.findOneAndUpdate(
    { _id: "question_id" },
    { $max: { seq: maxQ?.id || 0 } },
    { upsert: true }
  );

  console.log(
    `  📊 Counters initialized: users=${maxUserId}, tests=${maxTestId}, workspace=${maxWsId}, channels=${maxChId}`
  );
}

async function seedUsers() {
  console.log("\n🌱 Seeding users...");
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const createdIds: number[] = [];

  for (const u of users) {
    const existing = await (MongoUser as any).findOne({ email: u.email });
    if (existing) {
      console.log(`  ⏭️  Skipped (exists): ${u.email}`);
      createdIds.push(existing.id);
      continue;
    }

    const id = await getNextSequenceValue("userId");
    const newUser = new (MongoUser as any)({
      id,
      username: u.username,
      password: passwordHash,
      name: u.name,
      email: u.email.toLowerCase(),
      role: u.role,
      displayName: u.name,
      class: (u as any).class || null,
      subject: (u as any).subject || null,
      status: "active",
    });

    await newUser.save();
    createdIds.push(id);
    console.log(`  ✅ Created [${u.role.padEnd(12)}] ${u.name} <${u.email}>`);
  }

  return createdIds;
}

async function seedWorkspaceAndChannels(allUserIds: number[]) {
  console.log("\n🌱 Seeding workspace & channels...");

  const existingWs = await (MongoWorkspace as any).findOne({ name: "School Workspace" });
  if (existingWs) {
    console.log("  ⏭️  Workspace already exists, updating members...");
    existingWs.members = [...new Set([...existingWs.members, ...allUserIds])];
    await existingWs.save();
    return existingWs.id;
  }

  const wsId = await getNextSequenceValue("workspace_id");
  const workspace = new (MongoWorkspace as any)({
    id: wsId,
    name: "School Workspace",
    description: "Main school collaboration workspace",
    ownerId: allUserIds[0],
    members: allUserIds,
  });
  await workspace.save();
  console.log(`  ✅ Created workspace: School Workspace (id=${wsId})`);

  const channels = [
    { name: "general", type: "text", category: "class", subject: null },
    { name: "announcements", type: "announcement", category: "announcement", subject: null },
    { name: "homework", type: "text", category: "class", subject: null },
    { name: "math-10a", type: "text", category: "class", subject: "Mathematics" },
    { name: "science-10b", type: "text", category: "class", subject: "Science" },
    { name: "english-11a", type: "text", category: "class", subject: "English" },
    { name: "teacher-lounge", type: "text", category: "teacher", subject: null },
    { name: "parent-updates", type: "text", category: "parent", subject: null },
  ];

  for (const ch of channels) {
    const chId = await getNextSequenceValue("channel_id");
    const channel = new (MongoChannel as any)({
      id: chId,
      workspaceId: wsId,
      name: ch.name,
      type: ch.type,
      category: ch.category,
      subject: ch.subject,
      isReadOnly: ch.type === "announcement",
      pinnedMessages: [],
    });
    await channel.save();
    console.log(`  ✅ Created channel: #${ch.name}`);
  }

  return wsId;
}

async function seedTests(teacherUserId: number) {
  console.log("\n🌱 Seeding tests...");

  const testDefs = [
    { title: "Math Mid-Term", subject: "Mathematics", class: "10A", totalMarks: 100, duration: 90 },
    { title: "Science Quiz", subject: "Science", class: "10B", totalMarks: 50, duration: 45 },
    { title: "English Essay", subject: "English", class: "11A", totalMarks: 80, duration: 60 },
    { title: "History Test", subject: "History", class: "11B", totalMarks: 75, duration: 60 },
    { title: "Physics Final", subject: "Physics", class: "12A", totalMarks: 100, duration: 120 },
  ];

  for (const t of testDefs) {
    const existing = await (mongoose.model("Test") as any).findOne({ title: t.title });
    if (existing) {
      console.log(`  ⏭️  Skipped test: ${t.title}`);
      continue;
    }

    const testId = await getNextSequenceValue("test_id");
    const test = new (mongoose.model("Test") as any)({
      id: testId,
      title: t.title,
      description: `${t.title} for class ${t.class}`,
      subject: t.subject,
      class: t.class,
      teacherId: teacherUserId,
      totalMarks: t.totalMarks,
      duration: t.duration,
      testDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
      questionTypes: ["mcq", "short"],
      status: "published",
    });
    await test.save();

    // Add 3 sample questions per test
    for (let q = 1; q <= 3; q++) {
      const qId = await getNextSequenceValue("question_id");
      const question = new (mongoose.model("Question") as any)({
        id: qId,
        testId: testId,
        type: "mcq",
        text: `${t.subject} Question ${q}: Which of the following is correct?`,
        options: { A: "Option A", B: "Option B", C: "Option C", D: "Option D" },
        correctAnswer: "A",
        marks: Math.floor(t.totalMarks / 3),
        order: q,
      });
      await question.save();
    }
    console.log(`  ✅ Created test: ${t.title} with 3 questions`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Connecting to MongoDB...");
  await mongoose.connect(MONGO_URL);
  console.log("✅ Connected!");

  console.log("\n🔧 Initializing counters...");
  await initCounters();

  const userIds = await seedUsers();
  await seedWorkspaceAndChannels(userIds);

  // Find the first teacher's ID for test seeding
  const mathTeacher = await (MongoUser as any).findOne({ email: "teacher.math@school.test" });
  if (mathTeacher) await seedTests(mathTeacher.id);

  console.log("\n✨ Seeding complete!");
  console.log("\n📋 Test Credentials (password for all: Test@1234)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Admin:        admin@school.test");
  console.log("  Principal:    principal@school.test");
  console.log("  School Admin: schooladmin@school.test");
  console.log("  Teacher:      teacher.math@school.test");
  console.log("  Teacher:      teacher.science@school.test");
  console.log("  Student:      student1@school.test  (class 10A)");
  console.log("  Student:      student8@school.test  (class 10B)");
  console.log("  Student:      student15@school.test (class 11A)");
  console.log("  Parent:       parent1@school.test");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
