// seed.js — Greenfield Academy end-to-end onboarding seed
// Usage: node scripts/seed.js
// Safe to re-run: deletes all documents for the fixed schoolId before inserting.

require("dotenv").config();
const mongoose = require("mongoose");

// ─── Fixed seed anchor ────────────────────────────────────────────────────────
const SCHOOL_OBJECT_ID = new mongoose.Types.ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa");
const ADMIN_FIREBASE_UID = "seed-admin-priya-sharma";

// ─── Inline schemas (mirrors shared/mongo-schema.ts + shared/onboarding-schema.ts) ──

const Counter = mongoose.model(
  "Counter",
  new mongoose.Schema({
    _id: String,
    seq: { type: Number, default: 0 },
  })
);

async function nextId(name) {
  const doc = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
}

const School =
  mongoose.models.School ||
  mongoose.model(
    "School",
    new mongoose.Schema({
      _id: mongoose.Schema.Types.ObjectId,
      name: String,
      city: String,
      board: String,
      logo: String,
      gradesOffered: [String],
      createdBy: String,
      onboardingComplete: { type: Boolean, default: false },
      createdAt: { type: Date, default: Date.now },
    })
  );

const Invite =
  mongoose.models.Invite ||
  mongoose.model(
    "Invite",
    new mongoose.Schema({
      email: String,
      name: String,
      role: String,
      schoolId: mongoose.Schema.Types.ObjectId,
      classId: mongoose.Schema.Types.ObjectId,
      grades: [String],
      token: { type: String, unique: true },
      status: { type: String, default: "pending" },
      invitedBy: String,
      expiresAt: Date,
      createdAt: { type: Date, default: Date.now },
    })
  );

const SchoolClass =
  mongoose.models.SchoolClass ||
  mongoose.model(
    "SchoolClass",
    new mongoose.Schema({
      name: String,
      grade: String,
      teacherFirebaseUid: String,
      schoolId: mongoose.Schema.Types.ObjectId,
      students: [String],
      createdAt: { type: Date, default: Date.now },
    })
  );

const User =
  mongoose.models.User ||
  mongoose.model(
    "User",
    new mongoose.Schema({
      id: { type: Number, required: true, unique: true },
      username: { type: String, required: true, unique: true },
      password: { type: String, required: true },
      name: String,
      email: { type: String, unique: true },
      role: String,
      status: { type: String, default: "active" },
      school_code: String,
      grade: String,
      board: String,
      subjects: [String],
      subject: String,
      class: String,
      firebaseUid: String,
      displayName: String,
      schoolId: mongoose.Schema.Types.ObjectId,
      onboardingComplete: { type: Boolean, default: false },
      createdAt: { type: Date, default: Date.now },
    })
  );

const Test =
  mongoose.models.Test ||
  mongoose.model(
    "Test",
    new mongoose.Schema({
      id: { type: Number, required: true, unique: true },
      title: String,
      description: String,
      subject: String,
      class: String,
      teacherId: Number,
      totalMarks: { type: Number, default: 100 },
      duration: { type: Number, default: 60 },
      testDate: Date,
      questionTypes: [String],
      status: String,
      schoolId: mongoose.Schema.Types.ObjectId,
      scheduledAt: Date,
      createdAt: { type: Date, default: Date.now },
    })
  );

const Question =
  mongoose.models.Question ||
  mongoose.model(
    "Question",
    new mongoose.Schema({
      id: { type: Number, required: true, unique: true },
      testId: Number,
      type: String,
      text: String,
      options: mongoose.Schema.Types.Mixed,
      correctAnswer: String,
      marks: { type: Number, default: 1 },
      order: Number,
    })
  );

const TestAttempt =
  mongoose.models.TestAttempt ||
  mongoose.model(
    "TestAttempt",
    new mongoose.Schema({
      id: { type: Number, required: true, unique: true },
      testId: Number,
      studentId: Number,
      startTime: Date,
      endTime: Date,
      score: Number,
      status: String,
      schoolId: mongoose.Schema.Types.ObjectId,
      subject: String,
      classId: mongoose.Schema.Types.ObjectId,
      submittedAt: Date,
    })
  );

// ─── Seed data definitions ────────────────────────────────────────────────────

const NOW = new Date();
const days = (n) => new Date(NOW.getTime() + n * 86400_000);

// Months for test titles
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const thisMonth = MONTHS[NOW.getMonth()];
const nextMonth = MONTHS[(NOW.getMonth() + 1) % 12];

// Stable fake firebaseUids for seed users (email-derived)
const uid = (email) => `seed-${email.replace(/[@.]/g, "-")}`;

const TEACHERS = [
  {
    name: "Ravi Kumar",
    email: "ravi@greenfield.edu",
    subject: "Mathematics",
    grades: ["1", "2", "3"],
  },
  {
    name: "Anjali Menon",
    email: "anjali@greenfield.edu",
    subject: "Science",
    grades: ["4", "5", "6"],
  },
  {
    name: "Deepak Nair",
    email: "deepak@greenfield.edu",
    subject: "English",
    grades: ["7", "8", "9"],
  },
  { name: "Sunita Rao", email: "sunita@greenfield.edu", subject: "Social Studies", grades: ["10"] },
];

const STUDENTS = [
  { name: "Aarav Singh", email: "aarav@student.greenfield.edu", grade: "3" },
  { name: "Meera Pillai", email: "meera@student.greenfield.edu", grade: "3" },
  { name: "Rohit Das", email: "rohit@student.greenfield.edu", grade: "5" },
  { name: "Kavya Iyer", email: "kavya@student.greenfield.edu", grade: "5" },
  { name: "Arjun Nambiar", email: "arjun@student.greenfield.edu", grade: "7" },
  { name: "Pooja Verma", email: "pooja@student.greenfield.edu", grade: "7" },
  { name: "Siddharth Bose", email: "siddharth@student.greenfield.edu", grade: "9" },
  { name: "Lakshmi Reddy", email: "lakshmi@student.greenfield.edu", grade: "9" },
  { name: "Kiran Joshi", email: "kiran@student.greenfield.edu", grade: "10" },
  { name: "Divya Pillai", email: "divya@student.greenfield.edu", grade: "10" },
];

// Classes: [grade, teacherEmail, [studentEmails]]
const CLASS_DEFS = [
  {
    grade: "3",
    teacher: "ravi@greenfield.edu",
    students: ["aarav@student.greenfield.edu", "meera@student.greenfield.edu"],
    subject: "Mathematics",
  },
  {
    grade: "5",
    teacher: "anjali@greenfield.edu",
    students: ["rohit@student.greenfield.edu", "kavya@student.greenfield.edu"],
    subject: "Science",
  },
  {
    grade: "7",
    teacher: "deepak@greenfield.edu",
    students: ["arjun@student.greenfield.edu", "pooja@student.greenfield.edu"],
    subject: "English",
  },
  {
    grade: "9",
    teacher: "deepak@greenfield.edu",
    students: ["siddharth@student.greenfield.edu", "lakshmi@student.greenfield.edu"],
    subject: "English",
  },
  {
    grade: "10",
    teacher: "sunita@greenfield.edu",
    students: ["kiran@student.greenfield.edu", "divya@student.greenfield.edu"],
    subject: "Social Studies",
  },
];

// 5 MCQ questions per subject
const QUESTIONS = {
  Mathematics: [
    { text: "What is 7 × 8?", options: ["48", "54", "56", "64"], answer: "2" },
    { text: "Which is a prime number?", options: ["9", "15", "17", "21"], answer: "2" },
    {
      text: "What is the perimeter of a square with side 5 cm?",
      options: ["10", "20", "25", "30"],
      answer: "1",
    },
    { text: "Simplify: 3/4 + 1/4", options: ["1/2", "3/4", "1", "4/4"], answer: "2" },
    { text: "What is 15% of 200?", options: ["20", "25", "30", "35"], answer: "2" },
  ],
  Science: [
    {
      text: "Which gas do plants absorb during photosynthesis?",
      options: ["Oxygen", "Nitrogen", "Carbon Dioxide", "Hydrogen"],
      answer: "2",
    },
    {
      text: "What is the unit of force?",
      options: ["Joule", "Newton", "Watt", "Pascal"],
      answer: "1",
    },
    {
      text: "Which planet is closest to the Sun?",
      options: ["Venus", "Earth", "Mars", "Mercury"],
      answer: "3",
    },
    {
      text: "What is the chemical symbol for water?",
      options: ["CO2", "H2O", "O2", "NaCl"],
      answer: "1",
    },
    {
      text: "Which organ pumps blood in the human body?",
      options: ["Liver", "Kidney", "Heart", "Lungs"],
      answer: "2",
    },
  ],
  English: [
    {
      text: "Which is a noun in: 'The dog barked loudly'?",
      options: ["barked", "loudly", "the", "dog"],
      answer: "3",
    },
    {
      text: "Choose the correct spelling:",
      options: ["recieve", "receive", "receve", "receeve"],
      answer: "1",
    },
    {
      text: "What is the plural of 'child'?",
      options: ["childs", "childes", "children", "childrens"],
      answer: "2",
    },
    {
      text: "Which tense: 'She was reading a book'?",
      options: ["Simple Past", "Past Continuous", "Present Perfect", "Future"],
      answer: "1",
    },
    { text: "Synonym of 'happy':", options: ["sad", "angry", "joyful", "tired"], answer: "2" },
  ],
  "Social Studies": [
    {
      text: "Who was the first Prime Minister of India?",
      options: ["Mahatma Gandhi", "Sardar Patel", "Jawaharlal Nehru", "B.R. Ambedkar"],
      answer: "2",
    },
    {
      text: "Which river is the longest in India?",
      options: ["Yamuna", "Ganga", "Godavari", "Indus"],
      answer: "1",
    },
    {
      text: "The Tropic of Cancer passes through how many Indian states?",
      options: ["6", "7", "8", "9"],
      answer: "2",
    },
    {
      text: "Which is the smallest state of India by area?",
      options: ["Goa", "Sikkim", "Tripura", "Manipur"],
      answer: "0",
    },
    {
      text: "The Indian Constitution was adopted on:",
      options: ["15 Aug 1947", "26 Jan 1950", "26 Nov 1949", "2 Oct 1948"],
      answer: "2",
    },
  ],
};

// Scores: varied, 2 students intentionally below 60 (Meera grade-3, Siddharth grade-9)
const SCORES = {
  "aarav@student.greenfield.edu": { completed: 78, upcoming: null },
  "meera@student.greenfield.edu": { completed: 52, upcoming: null }, // weak
  "rohit@student.greenfield.edu": { completed: 85, upcoming: null },
  "kavya@student.greenfield.edu": { completed: 91, upcoming: null },
  "arjun@student.greenfield.edu": { completed: 74, upcoming: null },
  "pooja@student.greenfield.edu": { completed: 67, upcoming: null },
  "siddharth@student.greenfield.edu": { completed: 48, upcoming: null }, // weak
  "lakshmi@student.greenfield.edu": { completed: 82, upcoming: null },
  "kiran@student.greenfield.edu": { completed: 76, upcoming: null },
  "divya@student.greenfield.edu": { completed: 63, upcoming: null },
};

// ─── Main seed function ───────────────────────────────────────────────────────

async function seedAll() {
  if (!process.env.MONGODB_URL) throw new Error("MONGODB_URL not set in .env");
  await mongoose.connect(process.env.MONGODB_URL);

  // ── 0. Clean up previous seed data for this school ──────────────────────────
  console.log("Cleaning previous seed data...");
  const allEmails = [
    "priya.admin@greenfield.edu",
    ...TEACHERS.map((t) => t.email),
    ...STUDENTS.map((s) => s.email),
  ];
  const existingUsers = await User.find({ email: { $in: allEmails } }).select("id");
  const userIds = existingUsers.map((u) => u.id);

  await Promise.all([
    School.deleteOne({ _id: SCHOOL_OBJECT_ID }),
    Invite.deleteMany({ schoolId: SCHOOL_OBJECT_ID }),
    SchoolClass.deleteMany({ schoolId: SCHOOL_OBJECT_ID }),
    User.deleteMany({ email: { $in: allEmails } }),
    Test.deleteMany({ schoolId: SCHOOL_OBJECT_ID }),
    Question.deleteMany({
      testId: { $in: await Test.find({ schoolId: SCHOOL_OBJECT_ID }).distinct("id") },
    }),
    TestAttempt.deleteMany({ schoolId: SCHOOL_OBJECT_ID }),
  ]);

  // ── 1. School ────────────────────────────────────────────────────────────────
  console.log("Seeding school...");
  await School.create({
    _id: SCHOOL_OBJECT_ID,
    name: "Greenfield Academy",
    city: "Bengaluru",
    board: "CBSE",
    logo: "https://placehold.co/200x200?text=GA",
    gradesOffered: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
    createdBy: ADMIN_FIREBASE_UID,
    onboardingComplete: true,
  });

  // ── 2. Users ─────────────────────────────────────────────────────────────────
  console.log("Seeding users...");

  const adminId = await nextId("users");
  const adminDoc = {
    id: adminId,
    username: "priya.admin",
    password: "hashed_seed_password",
    name: "Priya Sharma",
    email: "priya.admin@greenfield.edu",
    role: "admin",
    status: "active",
    firebaseUid: ADMIN_FIREBASE_UID,
    displayName: "Priya Sharma",
    schoolId: SCHOOL_OBJECT_ID,
    onboardingComplete: true,
  };

  const teacherDocs = [];
  for (const t of TEACHERS) {
    const id = await nextId("users");
    teacherDocs.push({
      id,
      username: t.email.split("@")[0],
      password: "hashed_seed_password",
      name: t.name,
      email: t.email,
      role: "teacher",
      status: "active",
      subject: t.subject,
      subjects: [t.subject],
      grade: t.grades.join(","),
      firebaseUid: uid(t.email),
      displayName: t.name,
      schoolId: SCHOOL_OBJECT_ID,
      onboardingComplete: true,
    });
  }

  const studentDocs = [];
  for (const s of STUDENTS) {
    const id = await nextId("users");
    studentDocs.push({
      id,
      username: s.email.split("@")[0],
      password: "hashed_seed_password",
      name: s.name,
      email: s.email,
      role: "student",
      status: "active",
      grade: s.grade,
      board: "CBSE",
      firebaseUid: uid(s.email),
      displayName: s.name,
      schoolId: SCHOOL_OBJECT_ID,
      onboardingComplete: true,
    });
  }

  await User.insertMany([adminDoc, ...teacherDocs, ...studentDocs]);

  // Build lookup maps
  const teacherByEmail = {};
  for (const doc of teacherDocs) teacherByEmail[doc.email] = doc;

  const studentByEmail = {};
  for (const doc of studentDocs) studentByEmail[doc.email] = doc;

  // ── 3. Classes ───────────────────────────────────────────────────────────────
  console.log("Seeding classes...");
  const classDocs = CLASS_DEFS.map((c) => ({
    name: `Grade ${c.grade} - Section A`,
    grade: c.grade,
    teacherFirebaseUid: uid(c.teacher),
    schoolId: SCHOOL_OBJECT_ID,
    students: c.students.map((e) => uid(e)),
  }));
  const insertedClasses = await SchoolClass.insertMany(classDocs);

  // Map grade → inserted class doc
  const classByGrade = {};
  for (let i = 0; i < CLASS_DEFS.length; i++) {
    classByGrade[CLASS_DEFS[i].grade] = { ...CLASS_DEFS[i], _id: insertedClasses[i]._id };
  }

  // ── 4. Tests & Questions ─────────────────────────────────────────────────────
  console.log("Seeding tests...");
  const testDocs = [];
  const questionDocs = [];

  for (const classDef of CLASS_DEFS) {
    const teacher = teacherByEmail[classDef.teacher];
    const qs = QUESTIONS[classDef.subject];

    // Completed test
    const completedId = await nextId("tests");
    testDocs.push({
      id: completedId,
      title: `${classDef.subject} Test ${thisMonth}`,
      description: `${classDef.subject} assessment for Grade ${classDef.grade}`,
      subject: classDef.subject,
      class: classDef.grade,
      teacherId: teacher.id,
      totalMarks: 50,
      duration: 30,
      testDate: days(-30),
      questionTypes: ["mcq"],
      status: "completed",
      schoolId: SCHOOL_OBJECT_ID,
      createdAt: days(-30),
    });

    for (let i = 0; i < qs.length; i++) {
      const qid = await nextId("questions");
      questionDocs.push({
        id: qid,
        testId: completedId,
        type: "mcq",
        text: qs[i].text,
        options: qs[i].options.map((text, idx) => ({ id: String(idx), text })),
        correctAnswer: qs[i].answer,
        marks: 10,
        order: i + 1,
      });
    }

    // Upcoming test
    const upcomingId = await nextId("tests");
    testDocs.push({
      id: upcomingId,
      title: `${classDef.subject} Test ${nextMonth}`,
      description: `${classDef.subject} assessment for Grade ${classDef.grade}`,
      subject: classDef.subject,
      class: classDef.grade,
      teacherId: teacher.id,
      totalMarks: 50,
      duration: 30,
      testDate: days(7),
      scheduledAt: days(7),
      questionTypes: ["mcq"],
      status: "published",
      schoolId: SCHOOL_OBJECT_ID,
      createdAt: NOW,
    });

    for (let i = 0; i < qs.length; i++) {
      const qid = await nextId("questions");
      questionDocs.push({
        id: qid,
        testId: upcomingId,
        type: "mcq",
        text: qs[i].text,
        options: qs[i].options.map((text, idx) => ({ id: String(idx), text })),
        correctAnswer: qs[i].answer,
        marks: 10,
        order: i + 1,
      });
    }
  }

  await Test.insertMany(testDocs);
  await Question.insertMany(questionDocs);

  // Build completed test lookup: grade → test doc
  const completedTestByGrade = {};
  for (let i = 0; i < CLASS_DEFS.length; i++) {
    completedTestByGrade[CLASS_DEFS[i].grade] = testDocs[i * 2]; // every even index is completed
  }

  // ── 5. Test Results (attempts) ───────────────────────────────────────────────
  console.log("Seeding test results...");
  const attemptDocs = [];
  for (const classDef of CLASS_DEFS) {
    const test = completedTestByGrade[classDef.grade];
    const classDoc = classByGrade[classDef.grade];
    for (const studentEmail of classDef.students) {
      const student = studentByEmail[studentEmail];
      const score = SCORES[studentEmail].completed;
      const id = await nextId("testattempts");
      attemptDocs.push({
        id,
        testId: test.id,
        studentId: student.id,
        startTime: days(-25),
        endTime: days(-25),
        submittedAt: days(-25),
        score,
        status: "evaluated",
        schoolId: SCHOOL_OBJECT_ID,
        subject: classDef.subject,
        classId: classDoc._id,
      });
    }
  }
  await TestAttempt.insertMany(attemptDocs);

  // ── 6. Invites ───────────────────────────────────────────────────────────────
  console.log("Seeding invites...");
  const inviteDocs = [];

  for (const t of TEACHERS) {
    inviteDocs.push({
      email: t.email,
      name: t.name,
      role: "teacher",
      schoolId: SCHOOL_OBJECT_ID,
      grades: t.grades,
      token: `seed-token-${uid(t.email)}`,
      status: "accepted",
      invitedBy: ADMIN_FIREBASE_UID,
      expiresAt: days(30),
    });
  }

  for (const s of STUDENTS) {
    const classDef = CLASS_DEFS.find((c) => c.students.includes(s.email));
    const classDoc = classDef ? classByGrade[classDef.grade] : null;
    inviteDocs.push({
      email: s.email,
      name: s.name,
      role: "student",
      schoolId: SCHOOL_OBJECT_ID,
      classId: classDoc?._id,
      grades: [s.grade],
      token: `seed-token-${uid(s.email)}`,
      status: "accepted",
      invitedBy: ADMIN_FIREBASE_UID,
      expiresAt: days(30),
    });
  }

  await Invite.insertMany(inviteDocs);

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log(`
Greenfield Academy seeded successfully.
  1 admin
  ${TEACHERS.length} teachers
  ${STUDENTS.length} students
  ${CLASS_DEFS.length} classes
  ${testDocs.length} tests
  ${attemptDocs.length} test results
  ${inviteDocs.length} invites
`);

  await mongoose.disconnect();
}

seedAll().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

module.exports = { seedAll };
