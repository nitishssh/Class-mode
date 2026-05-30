import { Router, Request, Response } from "express";
import { requireRole } from "../middleware";

const router = Router();

// In-memory mock data (since real data might be sparse for this task)
const MOCK_DATA = {
  overview: {
    totalStudents: 1240,
    totalTeachers: 45,
    activeClasses: 82,
    avgProgress: 68.5,
  },
  students: [
    { id: 1, name: "Alice Johnson", class: "Grade 10-A", progressPct: 85, lastActive: "2023-10-25T14:30:00Z", status: "active" },
    { id: 2, name: "Bob Smith", class: "Grade 10-B", progressPct: 62, lastActive: "2023-10-24T09:15:00Z", status: "active" },
    { id: 3, name: "Charlie Brown", class: "Grade 9-A", progressPct: 45, lastActive: "2023-10-20T11:00:00Z", status: "inactive" },
    { id: 4, name: "Diana Prince", class: "Grade 11-C", progressPct: 92, lastActive: "2023-10-26T08:45:00Z", status: "active" },
    { id: 5, name: "Evan Wright", class: "Grade 10-A", progressPct: 78, lastActive: "2023-10-26T10:20:00Z", status: "active" },
  ],
  teachers: [
    { id: 101, name: "Mr. Davis", classesAssigned: ["Grade 10-A", "Grade 10-B"], avgStudentProgress: 75, lastActive: "2023-10-26T15:00:00Z" },
    { id: 102, name: "Ms. Miller", classesAssigned: ["Grade 9-A", "Grade 11-C"], avgStudentProgress: 82, lastActive: "2023-10-26T13:30:00Z" },
    { id: 103, name: "Mrs. Wilson", classesAssigned: [], avgStudentProgress: 0, lastActive: "2023-10-21T09:00:00Z" },
  ],
  content: [
    { id: "sub_1", name: "Mathematics", topics: ["Algebra", "Geometry", "Calculus"], enabledForSchool: true },
    { id: "sub_2", name: "Physics", topics: ["Mechanics", "Thermodynamics", "Optics"], enabledForSchool: true },
    { id: "sub_3", name: "Chemistry", topics: ["Organic", "Inorganic", "Physical"], enabledForSchool: false },
    { id: "sub_4", name: "Biology", topics: ["Genetics", "Ecology", "Human Anatomy"], enabledForSchool: true },
    { id: "sub_5", name: "Computer Science", topics: ["Programming", "Data Structures", "Algorithms"], enabledForSchool: true },
  ],
  analytics: {
    dailyProgress: [
      { date: "2023-10-20", avgPct: 65 },
      { date: "2023-10-21", avgPct: 66 },
      { date: "2023-10-22", avgPct: 68 },
      { date: "2023-10-23", avgPct: 67 },
      { date: "2023-10-24", avgPct: 69 },
      { date: "2023-10-25", avgPct: 71 },
      { date: "2023-10-26", avgPct: 70 },
    ],
    subjectCompletion: [
      { subject: "Mathematics", pct: 75 },
      { subject: "Physics", pct: 60 },
      { subject: "Biology", pct: 82 },
      { subject: "Computer Science", pct: 90 },
    ],
    topStudents: [
      { name: "Diana Prince", progressPct: 92 },
      { name: "Alice Johnson", progressPct: 85 },
      { name: "Evan Wright", progressPct: 78 },
    ],
    bottomStudents: [
      { name: "Charlie Brown", progressPct: 45 },
      { name: "Bob Smith", progressPct: 62 },
    ]
  }
};

// Protect all routes with school_admin role
router.use(requireRole("school_admin"));

// GET /api/admin/overview
router.get("/overview", (req: Request, res: Response) => {
  res.json(MOCK_DATA.overview);
});

// GET /api/admin/students
router.get("/students", (req: Request, res: Response) => {
  res.json(MOCK_DATA.students);
});

// GET /api/admin/students/:id
router.get("/students/:id", (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const student = MOCK_DATA.students.find(s => s.id === id);
  if (!student) {
    return res.status(404).json({ error: "Student not found" });
  }
  res.json(student);
});

// GET /api/admin/teachers
router.get("/teachers", (req: Request, res: Response) => {
  res.json(MOCK_DATA.teachers);
});

// POST /api/admin/teachers/:id/classes
router.post("/teachers/:id/classes", (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const { classIds } = req.body;

  if (!Array.isArray(classIds)) {
    return res.status(400).json({ error: "classIds must be an array" });
  }

  const teacherIndex = MOCK_DATA.teachers.findIndex(t => t.id === id);
  if (teacherIndex === -1) {
    return res.status(404).json({ error: "Teacher not found" });
  }

  // Update mock data
  MOCK_DATA.teachers[teacherIndex].classesAssigned = classIds;

  res.json({ success: true, teacher: MOCK_DATA.teachers[teacherIndex] });
});

// GET /api/admin/content
router.get("/content", (req: Request, res: Response) => {
  res.json(MOCK_DATA.content);
});

// PUT /api/admin/content/:id
router.put("/content/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const { enabled } = req.body;

  if (typeof enabled !== "boolean") {
    return res.status(400).json({ error: "enabled must be a boolean" });
  }

  const contentIndex = MOCK_DATA.content.findIndex(c => c.id === id);
  if (contentIndex === -1) {
    return res.status(404).json({ error: "Content subject not found" });
  }

  // Update mock data
  MOCK_DATA.content[contentIndex].enabledForSchool = enabled;

  res.json({ success: true, content: MOCK_DATA.content[contentIndex] });
});

// GET /api/admin/analytics
router.get("/analytics", (req: Request, res: Response) => {
  res.json(MOCK_DATA.analytics);
});

export default router;
