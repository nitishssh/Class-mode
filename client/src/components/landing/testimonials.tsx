import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Brain,
  Trophy,
  Video,
  BarChart2,
  ClipboardCheck,
  Users,
  MessageSquare,
  Check,
  ArrowRight,
  Search,
  Lightbulb,
  Target,
  TrendingUp,
  GraduationCap,
  LayoutDashboard,
  FileText,
  Layers,
} from "lucide-react";

const painPoints = [
  {
    emoji: "😩",
    audience: "Students",
    title: "Drowning in content",
    desc: "Notes, videos, textbooks — but no clear path. 80% of study time is spent deciding what to study, not actually studying.",
    color: "border-red-200 dark:border-red-900/40",
    bg: "bg-red-50 dark:bg-red-950/20",
    iconColor: "text-red-500",
  },
  {
    emoji: "📉",
    audience: "Students",
    title: "Forgotten by Friday",
    desc: "Without active recall, 70% of what you learn today is gone by next week. Passive reading doesn't work.",
    color: "border-orange-200 dark:border-orange-900/40",
    bg: "bg-orange-50 dark:bg-orange-950/20",
    iconColor: "text-orange-500",
  },
  {
    emoji: "🗂️",
    audience: "Schools",
    title: "Tools that don't connect",
    desc: "Attendance in one system, grades in another, messages somewhere else. Teachers spend more time on admin than teaching.",
    color: "border-violet-200 dark:border-violet-900/40",
    bg: "bg-violet-50 dark:bg-violet-950/20",
    iconColor: "text-violet-500",
  },
  {
    emoji: "👻",
    audience: "Schools",
    title: "No real visibility",
    desc: "Principals and boards get reports weeks after the fact. By the time you see the data, it's too late to help.",
    color: "border-blue-200 dark:border-blue-900/40",
    bg: "bg-blue-50 dark:bg-blue-950/20",
    iconColor: "text-blue-500",
  },
];

export const ProblemSection = () => {
  return (
    <section className="bg-zinc-950 py-24 text-white dark:bg-card/40">
      <div className="pointer-events-none absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808018_1px,transparent_1px),linear-gradient(to_bottom,#80808018_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>

      <div className="container relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto mb-16 max-w-2xl text-center"
        >
          <span className="mb-4 inline-block rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary">
            The problem
          </span>
          <h2 className="mb-5 text-4xl font-extrabold tracking-tight text-white dark:text-foreground md:text-5xl">
            School is hard enough already.
          </h2>
          <p className="text-lg leading-relaxed text-zinc-400 dark:text-muted-foreground">
            Whether you&apos;re a student trying to keep up or a school trying to keep track —
            the old way just isn&apos;t working.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {painPoints.map((point, i) => (
            <motion.div
              key={point.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group rounded-2xl border border-zinc-800 bg-zinc-900/60 p-7 transition-all duration-300 hover:border-zinc-700 dark:border-border dark:bg-card"
            >
              <div className="mb-4 text-3xl">{point.emoji}</div>
              <span className="mb-3 inline-block rounded-full bg-zinc-800 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:bg-muted dark:text-muted-foreground">
                {point.audience}
              </span>
              <h3 className="mb-2 text-lg font-bold text-white dark:text-foreground">
                {point.title}
              </h3>
              <p className="text-sm leading-relaxed text-zinc-400 dark:text-muted-foreground">
                {point.desc}
              </p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-16 text-center"
        >
          <p className="mb-3 text-sm italic text-zinc-500 dark:text-muted-foreground">
            ClassMode fixes all of this.
          </p>
          <div className="mx-auto h-12 w-px animate-bounce rounded-full bg-gradient-to-b from-zinc-600 to-primary" />
        </motion.div>
      </div>
    </section>
  );
};

const studentFeatures = [
  { icon: Brain, text: "AI Tutor available 24/7" },
  { icon: Video, text: "Live classes with real teachers" },
  { icon: Trophy, text: "Gamified streaks & achievements" },
  { icon: BookOpen, text: "Personalised study plans" },
  { icon: Target, text: "Smart practice quizzes" },
  { icon: BarChart2, text: "Personal progress tracking" },
];

const schoolFeatures = [
  { icon: ClipboardCheck, text: "AI-powered grading & OCR scanning" },
  { icon: BarChart2, text: "Real-time analytics dashboards" },
  { icon: Users, text: "Student & teacher management" },
  { icon: MessageSquare, text: "Parent communication hub" },
  { icon: TrendingUp, text: "Board-ready performance reports" },
  { icon: Video, text: "Live classroom infrastructure" },
];

export const DualAudience = () => {
  const [, setLocation] = useLocation();

  return (
    <section className="overflow-hidden">
      <div className="grid lg:grid-cols-2">
        {/* Student side */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-col justify-center bg-accent-soft/60 px-10 py-20 lg:px-16"
        >
          <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary">
            🎓 For Students
          </span>
          <h2 className="mb-4 text-3xl font-extrabold tracking-tight md:text-4xl">
            A calm, focused space
            <br />
            to learn and grow.
          </h2>
          <p className="mb-8 max-w-md text-lg leading-relaxed text-muted-foreground">
            No more overwhelm. ClassMode gives students a clear path, an AI tutor in their pocket,
            and the motivation to keep going.
          </p>

          <ul className="mb-10 space-y-3">
            {studentFeatures.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm font-medium text-foreground">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                </span>
                {text}
              </li>
            ))}
          </ul>

          <Button
            className="group w-fit gap-2 rounded-full bg-primary px-7 font-semibold text-primary-foreground hover:bg-primary/90"
            size="lg"
            onClick={() => setLocation("/login")}
          >
            Start learning free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </motion.div>

        {/* School side */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-col justify-center bg-slate-950 px-10 py-20 text-white lg:px-16"
        >
          <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-slate-200">
            🏫 For Schools
          </span>
          <h2 className="mb-4 text-3xl font-extrabold tracking-tight md:text-4xl">
            Give your school
            <br />a powerful brain.
          </h2>
          <p className="mb-8 max-w-md text-lg leading-relaxed text-slate-400">
            One platform for every role. Teachers teach more. Admins manage less. Principals see
            everything they need to make decisions.
          </p>

          <ul className="mb-10 space-y-3">
            {schoolFeatures.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm font-medium text-slate-200">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10">
                  <Icon className="h-3.5 w-3.5 text-slate-300" />
                </span>
                {text}
              </li>
            ))}
          </ul>

          <Button
            variant="outline"
            className="group w-fit gap-2 rounded-full border-white/20 px-7 font-semibold text-white hover:bg-white/10 hover:border-white/40"
            size="lg"
            onClick={() => setLocation("/login")}
          >
            Set up my school
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

const steps = [
  {
    number: "01",
    icon: Search,
    label: "Set up in minutes",
    desc: "Create your school, invite teachers, and onboard students — no IT team required. You're live in under 10 minutes.",
    color: "bg-primary/10 text-primary",
  },
  {
    number: "02",
    icon: Lightbulb,
    label: "Students start learning",
    desc: "Every student gets a personalised AI study plan from day one. Live classes, smart quizzes, and a tutor always available.",
    color: "bg-energy/10 text-energy-dark",
  },
  {
    number: "03",
    icon: TrendingUp,
    label: "Track growth in real time",
    desc: "Teachers grade faster, principals see the whole picture, and boards get clean, actionable reports — automatically.",
    color: "bg-progress/10 text-progress",
  },
];

export const HowItWorks = () => (
  <section id="journey" className="bg-card/40 py-24">
    <div className="container">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-16 text-center"
      >
        <span className="mb-3 inline-block rounded-full border border-border bg-card px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          How it works
        </span>
        <h2 className="mb-4 text-3xl font-extrabold tracking-tight md:text-4xl">
          Up and running in minutes.
        </h2>
        <p className="mx-auto max-w-xl text-lg text-muted-foreground">
          No complicated setup. No training needed. Just a better school experience, from day one.
        </p>
      </motion.div>

      <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
        {steps.map((step, i) => (
          <motion.div
            key={step.number}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.15 }}
            className="relative rounded-2xl border border-border bg-background p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-card"
          >
            {i < steps.length - 1 && (
              <div className="absolute -right-4 top-10 z-10 hidden h-px w-8 border-t-2 border-dashed border-border md:block" />
            )}
            <div
              className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl ${step.color}`}
            >
              <step.icon className="h-6 w-6" />
            </div>
            <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
              Step {step.number}
            </span>
            <h3 className="mb-3 text-xl font-bold">{step.label}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

const outcomes = [
  {
    metric: "5+ hrs",
    period: "saved per teacher, per week",
    detail:
      "Automated grading, AI-assisted test creation, and smart attendance tracking eliminate the paperwork that kills teacher time.",
    icon: ClipboardCheck,
    color: "text-primary",
    bg: "bg-primary/8",
  },
  {
    metric: "1 platform",
    period: "replacing 4–6 disconnected tools",
    detail:
      "No more juggling spreadsheets, separate LMS, messaging apps, and gradebooks. ClassMode is the single source of truth.",
    icon: Layers,
    color: "text-energy-dark",
    bg: "bg-energy/10",
  },
  {
    metric: "Real-time",
    period: "visibility across every classroom",
    detail:
      "Principals and boards no longer wait weeks for reports. Live dashboards show attendance, grades, and engagement — right now.",
    icon: LayoutDashboard,
    color: "text-progress",
    bg: "bg-progress/10",
  },
  {
    metric: "3×",
    period: "faster from enrolment to first lesson",
    detail:
      "Invite teachers, create classes, and onboard students in minutes. No IT tickets. No training sessions. Just start.",
    icon: TrendingUp,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
];

const roles = [
  {
    role: "Teachers",
    icon: GraduationCap,
    headline: "Teach more. Admin less.",
    points: [
      "AI drafts tests and quizzes in seconds",
      "Scan paper tests — ClassMode grades them",
      "Student progress visible at a glance",
      "Communicate with parents without leaving the platform",
    ],
  },
  {
    role: "Principals",
    icon: LayoutDashboard,
    headline: "See the whole school. Instantly.",
    points: [
      "Live view of every class's performance",
      "Attendance and engagement trends",
      "Flag at-risk students before it's too late",
      "Manage teachers and timetables in one place",
    ],
  },
  {
    role: "Boards & Admins",
    icon: FileText,
    headline: "Data you can act on.",
    points: [
      "Automated board-ready performance reports",
      "School-wide KPIs on a single dashboard",
      "Compliance documentation handled automatically",
      "Subscription and billing management built in",
    ],
  },
];

export const BusinessValue = () => {
  const [, setLocation] = useLocation();

  return (
    <section id="value" className="bg-background py-28">
      <div className="container">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto mb-20 max-w-3xl text-center"
        >
          <span className="mb-4 inline-block rounded-full border border-border bg-card px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            The business case
          </span>
          <h2 className="mb-5 text-4xl font-extrabold tracking-tight md:text-5xl">
            What your school actually gains.
          </h2>
          <p className="text-xl leading-relaxed text-muted-foreground">
            ClassMode isn't another tool to manage. It's the upgrade that makes your whole school
            run better — for teachers, leaders, and students alike.
          </p>
        </motion.div>

        {/* Outcome metrics */}
        <div className="mb-24 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {outcomes.map((item, i) => (
            <motion.div
              key={item.metric}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group rounded-2xl border border-border bg-card p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-card"
            >
              <div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-xl ${item.bg}`}>
                <item.icon className={`h-5 w-5 ${item.color}`} />
              </div>
              <p className={`mb-0.5 text-3xl font-extrabold tracking-tight ${item.color}`}>
                {item.metric}
              </p>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {item.period}
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">{item.detail}</p>
            </motion.div>
          ))}
        </div>

        {/* Role-by-role breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12 text-center"
        >
          <h3 className="text-2xl font-extrabold md:text-3xl">What it means for every role.</h3>
          <p className="mt-3 text-lg text-muted-foreground">
            One platform, but everyone gets exactly what they need.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3">
          {roles.map((r, i) => (
            <motion.div
              key={r.role}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12 }}
              className="rounded-2xl border border-border bg-card p-8"
            >
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <r.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {r.role}
                  </p>
                  <p className="font-bold text-foreground">{r.headline}</p>
                </div>
              </div>
              <ul className="space-y-3">
                {r.points.map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {point}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 rounded-2xl border border-primary/20 bg-accent-soft px-10 py-12 text-center"
        >
          <p className="mb-2 text-sm font-bold uppercase tracking-widest text-primary">
            Ready to see it live?
          </p>
          <h3 className="mb-4 text-3xl font-extrabold">
            Set up your school in under 10 minutes.
          </h3>
          <p className="mx-auto mb-8 max-w-lg text-lg text-muted-foreground">
            No contracts. No credit card. No IT team required. Just a better school experience
            from day one.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              className="group gap-2 rounded-full bg-primary px-8 font-semibold text-primary-foreground shadow-xp hover:bg-primary/90"
              onClick={() => setLocation("/login")}
            >
              Get started free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="gap-2 rounded-full px-8 font-semibold"
              onClick={() => setLocation("/login")}
            >
              Book a demo
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export { ProblemSection as Turbulence, HowItWorks as Journey };
