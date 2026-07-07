import {
  Bell,
  MessageSquare,
  LineChart,
  Sparkles,
  Wallet,
  ClipboardList,
  Trophy,
  CalendarDays,
  Video,
  ShieldCheck,
  BookOpenCheck,
  Eye,
  Smartphone,
} from "lucide-react";
import {
  AudiencePage,
  type AudienceFeature,
  type AudienceOutcome,
} from "@/components/landing/audience";

const outcomes: AudienceOutcome[] = [
  { icon: Eye, metric: "Real-time", label: "visibility into your child's day" },
  { icon: Bell, metric: "Instant", label: "attendance & activity alerts" },
  { icon: Sparkles, metric: "24/7", label: "AI tutor your child can ask anything" },
  { icon: Smartphone, metric: "1 app", label: "no more chasing teachers or notices" },
];

const features: AudienceFeature[] = [
  {
    icon: LineChart,
    name: "Progress & Performance Insights",
    headline: "See how your child is really doing — not just at report-card time.",
    description:
      "A parent-friendly view of your child's growth across subjects, built from their actual classwork and tests instead of a once-a-term grade.",
    bullets: [
      "Subject-by-subject progress in plain language",
      "Spot which topics need support early",
      "Compare effort and improvement over time",
    ],
  },
  {
    icon: Bell,
    name: "Attendance Alerts",
    headline: "Know the moment your child is marked absent.",
    description:
      "When a teacher marks attendance, you get a notification — so an unexpected absence never goes unnoticed until it's too late.",
    bullets: [
      "Instant alert if your child is absent or late",
      "A running attendance record you can check anytime",
      "Peace of mind on school days",
    ],
  },
  {
    icon: Sparkles,
    name: "AI Tutor",
    headline: "A patient tutor for your child, available any time of day.",
    description:
      "Stuck on homework at 9pm? Your child can ask the AI tutor for step-by-step explanations in their own words — no appointment, no extra tuition fees.",
    bullets: [
      "Step-by-step help, not just answers",
      "Adapts to your child's level and pace",
      "Encourages understanding, not copying",
    ],
  },
  {
    icon: BookOpenCheck,
    name: "AI Study Plans",
    headline: "A personalised roadmap so your child always knows what to study next.",
    description:
      "Class Mode builds a daily and weekly plan around your child's goals and weak spots, turning “I don't know where to start” into a clear path.",
    bullets: [
      "Personalised daily & weekly schedule",
      "Focuses time on weaker topics",
      "Builds steady study habits",
    ],
  },
  {
    icon: ClipboardList,
    name: "Homework & Tasks",
    headline: "Never hear “I forgot I had homework” again.",
    description:
      "Every assignment and deadline in one place, so you and your child can see what's due this week at a glance.",
    bullets: [
      "All homework and due dates in one list",
      "Gentle reminders before deadlines",
      "See what's completed and what's pending",
    ],
  },
  {
    icon: BookOpenCheck,
    name: "Tests & Smart Practice",
    headline: "Understand results — and the weak areas behind them.",
    description:
      "Beyond the score, you can see which concepts your child struggled with and the practice they're doing to close the gap.",
    bullets: [
      "Clear results after every test",
      "Automatic detection of weak topics",
      "Practice quizzes tailored to those gaps",
    ],
  },
  {
    icon: MessageSquare,
    name: "Direct Messaging with Teachers",
    headline: "Reach the right teacher without chasing phone numbers.",
    description:
      "Message your child's teachers directly inside Class Mode, with a record of the conversation you can refer back to.",
    bullets: [
      "One place to talk to every teacher",
      "No lost notes in schoolbags",
      "History you can look back on",
    ],
  },
  {
    icon: Wallet,
    name: "Fees & Payments",
    headline: "Total transparency on what's due and what's paid.",
    description:
      "See fee dues, due dates, and payment history clearly — with reminders so a deadline never sneaks up on you.",
    bullets: [
      "Clear breakdown of dues and paid amounts",
      "Reminders before due dates",
      "A record of past payments",
    ],
  },
  {
    icon: CalendarDays,
    name: "Calendar & Timetable",
    headline: "Always know what your child's school week looks like.",
    description:
      "Your child's timetable, exams, and school events in one shared calendar, so the whole family can plan around them.",
    bullets: [
      "Daily class timetable at your fingertips",
      "Exam and event dates in advance",
      "Plan the week without surprises",
    ],
  },
  {
    icon: Video,
    name: "Live Classes",
    headline: "Learning continues even when your child can't be in the room.",
    description:
      "When classes run online, your child joins live — and misses nothing if they're unwell, thanks to recordings and materials.",
    bullets: [
      "Join live lessons from home",
      "Catch up with recordings",
      "Materials shared alongside each class",
    ],
  },
  {
    icon: Trophy,
    name: "Achievements & Motivation",
    headline: "Celebrate the wins that keep your child going.",
    description:
      "Streaks, badges, and milestones turn steady effort into something worth cheering — small moments of pride you can share.",
    bullets: [
      "Streaks that reward consistency",
      "Badges for milestones reached",
      "Positive motivation, not pressure",
    ],
  },
  {
    icon: ShieldCheck,
    name: "Privacy & Safety",
    headline: "Your family's data stays your family's.",
    description:
      "Class Mode is built with data protection in mind — you can see how information is used, and it's never sold.",
    bullets: [
      "Clear, privacy-first data handling",
      "Your data is never sold",
      "Access controlled by the school",
    ],
  },
];

const ForParents = () => (
  <AudiencePage
    eyebrow="✨ For Parents"
    title="Everything your child's school does,"
    titleAccent="finally visible to you."
    intro="Class Mode brings your child's learning, attendance, homework, results, and fees into one place — with alerts, direct lines to teachers, and an AI tutor on call. Here's what every feature means for you as a parent."
    crosslink={{ label: "See it for Principals & Boards →", href: "/for-schools" }}
    outcomes={outcomes}
    featuresHeading="Every feature, from a parent's point of view"
    features={features}
    ctaHeading="Want Class Mode at your child's school?"
    ctaSub="Tell us your school's name and we'll reach out — or share this with the principal to get the conversation started."
  />
);

export default ForParents;
