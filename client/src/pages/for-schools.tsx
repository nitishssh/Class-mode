import {
  LayoutDashboard,
  BarChart3,
  AlertTriangle,
  CalendarCheck,
  Wallet,
  Sparkles,
  CalendarRange,
  Database,
  Rocket,
  MessagesSquare,
  FileCheck2,
  Layers,
  Clock,
  LineChart,
  ShieldCheck,
} from "lucide-react";
import { AudiencePage, type AudienceFeature, type AudienceOutcome } from "@/components/landing/audience";

const outcomes: AudienceOutcome[] = [
  { icon: Clock, metric: "5+ hrs/week", label: "saved per teacher" },
  { icon: Layers, metric: "1 platform", label: "replacing 4–6 tools" },
  { icon: LineChart, metric: "Real-time", label: "school-wide visibility" },
  { icon: Rocket, metric: "3× faster", label: "from enrolment to first lesson" },
];

const features: AudienceFeature[] = [
  {
    icon: LayoutDashboard,
    name: "Real-time School Dashboard",
    headline: "See every class, live — not a report that's a month old.",
    description:
      "A single control room for the whole institution. Attendance, activity, and performance update as they happen, so leadership decisions are based on today's reality.",
    bullets: [
      "Live view across every class and grade",
      "Drill from school-wide down to a single student",
      "No waiting on manual report compilation",
    ],
  },
  {
    icon: BarChart3,
    name: "School-wide Analytics & KPIs",
    headline: "Board-ready numbers without the spreadsheet marathon.",
    description:
      "Track the metrics that matter to a governing body — outcomes, participation, and trends — packaged so you can present them, not rebuild them.",
    bullets: [
      "Institution-level KPIs at a glance",
      "Trends across terms and cohorts",
      "Export-ready views for board meetings",
    ],
  },
  {
    icon: AlertTriangle,
    name: "At-risk Student Flags",
    headline: "Catch struggling and disengaging students before they slip.",
    description:
      "Class Mode surfaces students whose attendance or performance is trending the wrong way, turning intervention from reactive to proactive.",
    bullets: [
      "Early flags on falling attendance or scores",
      "A shortlist for counsellors and mentors",
      "Intervene while it still makes a difference",
    ],
  },
  {
    icon: CalendarCheck,
    name: "Attendance Automation",
    headline: "Retire the paper register — and inform parents automatically.",
    description:
      "Teachers mark attendance in seconds; the system compiles records, flags patterns, and can notify parents of absences without extra admin.",
    bullets: [
      "Fast, structured attendance capture",
      "Automatic parent notifications on absence",
      "Term and year reports generated for you",
    ],
  },
  {
    icon: Wallet,
    name: "Fee Collection & Finance",
    headline: "Know your collection rate at any moment.",
    description:
      "Track dues, payments, and outstanding balances across the school, so finance conversations start from live figures rather than guesswork.",
    bullets: [
      "Live view of dues vs. collected",
      "Outstanding-balance visibility by class",
      "Payment history and reminders",
    ],
  },
  {
    icon: Sparkles,
    name: "Teacher Productivity & AI Tools",
    headline: "Give teachers hours back every week.",
    description:
      "AI drafts tests, grades objective work, and scans handwritten answers with OCR — so staff spend time teaching, not on paperwork.",
    bullets: [
      "AI-assisted test creation",
      "Automated grading and OCR answer capture",
      "Built-in parent communication",
    ],
  },
  {
    icon: CalendarRange,
    name: "Timetable Management",
    headline: "Build and adjust the school schedule in one place.",
    description:
      "Create timetables, manage slots, and push changes that flow straight to teachers, students, and parents — no reprints, no confusion.",
    bullets: [
      "Central timetable builder",
      "Changes propagate to everyone instantly",
      "Fewer clashes and manual reworks",
    ],
  },
  {
    icon: Database,
    name: "Dynamic Student Information System",
    headline: "Your student records, shaped to how your school actually works.",
    description:
      "A flexible SIS that adapts to your fields and structures instead of forcing your institution into a rigid template.",
    bullets: [
      "Configurable student data model",
      "One source of truth for records",
      "Tenant-isolated — your data stays yours",
    ],
  },
  {
    icon: Rocket,
    name: "Fast Onboarding",
    headline: "From enrolment to first lesson without IT tickets.",
    description:
      "Set up classes, invite teachers, and enrol students through guided flows — most schools are running lessons the same week.",
    bullets: [
      "Guided school, teacher, and student setup",
      "No training program required",
      "Roles and permissions handled for you",
    ],
  },
  {
    icon: MessagesSquare,
    name: "Communication Hub",
    headline: "One channel for the whole school community.",
    description:
      "Teachers, parents, and staff communicate in-platform, keeping conversations on record and off scattered WhatsApp groups.",
    bullets: [
      "Structured messaging across roles",
      "A durable record of communication",
      "Announcements that reach the right people",
    ],
  },
  {
    icon: FileCheck2,
    name: "Compliance & Reporting",
    headline: "Audit-ready documentation, generated as you go.",
    description:
      "Attendance, performance, and finance reports are produced automatically, and data is handled with privacy and access controls built in.",
    bullets: [
      "Automated report generation",
      "Privacy-first, access-controlled data",
      "Documentation ready for inspections and boards",
    ],
  },
  {
    icon: ShieldCheck,
    name: "Tenant Isolation & Data Security",
    headline: "Your school's data is walled off from every other school's.",
    description:
      "Class Mode enforces strict tenant boundaries so no one outside your institution can see your data — security your board can sign off on.",
    bullets: [
      "Strict per-school data isolation",
      "Role-based access to sensitive records",
      "Built to fail closed, not open",
    ],
  },
];

const ForSchools = () => (
  <AudiencePage
    eyebrow="✨ For Principals, Admins & Boards"
    title="Run the whole institution from"
    titleAccent="one live command center."
    intro="Class Mode replaces the spreadsheets, separate LMS, and messaging apps with a single platform — giving leadership real-time visibility, giving teachers their hours back, and giving boards the reports they need. Here's what every feature means at the institution level."
    crosslink={{ label: "See it for Parents →", href: "/for-parents" }}
    outcomes={outcomes}
    featuresHeading="Every feature, from a leadership point of view"
    features={features}
    ctaHeading="Bring Class Mode to your institution"
    ctaSub="Request a pilot and we'll walk your leadership team through the platform with your school's context in mind."
  />
);

export default ForSchools;
