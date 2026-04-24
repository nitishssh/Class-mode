import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Calendar,
  BrainCircuit,
  Target,
  BarChart2,
  Brain,
  Code,
  Cloud,
  TrendingUp,
} from "lucide-react";

const features = [
  {
    title: "AI Study Planner",
    desc: "Create a personalized study plan based on your goals and weaknesses.",
    points: [
      "Personalized study roadmap",
      "Daily and weekly learning schedule",
      "Smart goal tracking",
    ],
    cta: "Try Sample Plan",
    icon: Calendar,
  },
  {
    title: "AI Tutor",
    desc: "Provides step-by-step explanations using AI.",
    points: ["Step-by-step explanations", "Ask questions anytime", "Adaptive teaching style"],
    cta: "Ask the AI",
    icon: BrainCircuit,
  },
  {
    title: "Smart Practice",
    desc: "Generates quizzes and tests automatically.",
    points: ["AI-generated quizzes", "Exam simulations", "Weakness detection"],
    cta: "Start Practice",
    icon: Target,
  },
  {
    title: "Performance Insights",
    desc: "Shows student learning progress.",
    points: ["Progress analytics", "Leaderboards & streaks", "Improvement tracking"],
    cta: "View Dashboard",
    icon: BarChart2,
  },
];

const cards = [
  {
    icon: Brain,
    title: "AI Systems",
    bullets: [
      "Personalised study plans",
      "Smart flashcard generation",
      "Adaptive difficulty engine",
    ],
  },
  {
    icon: Code,
    title: "Software & Tools",
    bullets: ["Interactive code labs", "Real-time collaboration", "Progress dashboards"],
  },
  {
    icon: Cloud,
    title: "Cloud Platform",
    bullets: ["Access anywhere, any device", "Auto-sync across sessions", "Offline mode support"],
  },
  {
    icon: TrendingUp,
    title: "Growth & Coaching",
    bullets: ["1-on-1 mentor matching", "Exam strategy workshops", "Performance analytics"],
  },
];

const FeatureCard = ({ feature, index }: { feature: any; index: number }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.1 * index }}
      className="notebook-card group relative overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-[8px_10px_0px_hsl(var(--foreground))] dark:hover:shadow-[8px_10px_0px_hsl(var(--primary))]"
      style={{ paddingLeft: "3.5rem" }}
    >
      {/* Notebook Punch Holes */}
      <div className="absolute bottom-0 left-3 top-0 z-20 flex flex-col justify-evenly py-4">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-4 w-4 rounded-full border border-border bg-background shadow-[inset_1px_1px_3px_rgba(0,0,0,0.15)] dark:shadow-[inset_1px_1px_3px_rgba(255,255,255,0.05)]"
          ></div>
        ))}
      </div>

      {/* Red margin line characteristic of notebook paper */}
      <div className="absolute bottom-0 left-[3.2rem] top-0 z-10 w-[2px] bg-red-300/40 dark:bg-red-900/40"></div>

      <div className="absolute right-0 top-0 z-10 h-8 w-8 bg-gradient-to-bl from-white/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100 dark:from-white/10"></div>

      <div className="relative z-10 mb-6 flex items-center gap-3">
        <div className="relative p-2 transition-transform group-hover:-rotate-6">
          {/* Handwritten style highlight behind icon */}
          <div className="absolute inset-0 -z-10 -rotate-3 rounded-sm bg-[#FFD455]/90 transition-transform group-hover:rotate-6 dark:bg-primary/30"></div>
          <feature.icon size={26} strokeWidth={2.5} className="text-foreground" />
        </div>
        <h3 className="relative inline-block font-sans text-2xl font-bold text-foreground">
          {feature.title}
          {/* Custom handwritten underline effect */}
          <svg
            className="absolute -bottom-2 left-0 h-3 w-full text-[#FFD455] opacity-80 dark:text-primary"
            viewBox="0 0 100 10"
            preserveAspectRatio="none"
          >
            <path
              d="M0 5 Q 50 10 100 2"
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </h3>
      </div>

      <ul className="relative z-10 mb-8 ml-2 mt-4 space-y-3">
        {feature.points.map((point: string, i: number) => (
          <li key={i} className="flex items-center gap-3 text-base font-medium text-foreground">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#4C6FFF] dark:bg-primary"></span>
            {point}
          </li>
        ))}
      </ul>

      <Button
        variant="outline"
        className="relative z-10 h-11 w-full rounded-full border-2 border-foreground bg-background px-6 text-sm font-bold text-foreground shadow-[2px_2px_0px_hsl(var(--foreground))] transition-colors hover:-translate-y-0.5 hover:bg-[#FFD455] hover:text-foreground hover:shadow-[4px_4px_0px_hsl(var(--foreground))] active:translate-y-0 active:shadow-none dark:shadow-[2px_2px_0px_hsl(var(--primary))] dark:hover:bg-primary dark:hover:shadow-[4px_4px_0px_hsl(var(--primary))] sm:w-auto"
      >
        {feature.cta} <span className="ml-1 text-lg leading-none">›</span>
      </Button>
    </motion.div>
  );
};

export const NotebookFeature = () => {
  return (
    <section className="notebook-bg overflow-hidden py-24 transition-colors duration-300 dark:bg-background">
      <div className="container max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <h2 className="mb-4 text-4xl font-extrabold text-foreground md:text-5xl">
            From Concept to Launch
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            EduAI guides students through every stage of learning —{" "}
            <br className="hidden md:block" />
            from understanding concepts to mastering exams.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, rotateX: 10, y: 40 }}
          whileInView={{ opacity: 1, rotateX: 0, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ perspective: "1000px" }}
          className="relative mx-auto max-w-4xl"
        >
          <div className="relative grid gap-8 md:grid-cols-2">
            {features.map((feature, i) => (
              <FeatureCard key={i} feature={feature} index={i} />
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export const OnboardingFeatures = () => (
  <section id="features" className="py-24">
    <div className="container">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-16 text-center"
      >
        <h2 className="mb-3 text-3xl font-extrabold md:text-4xl">Onboarding Features ✨</h2>
        <p className="mx-auto max-w-xl text-lg text-muted-foreground">
          Everything you need for a smooth learning journey.
        </p>
      </motion.div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="sketch-border hover-tilt sketch-shadow flex flex-col rounded-2xl bg-card p-6"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20">
              <card.icon size={22} className="text-foreground" />
            </div>
            <h3 className="mb-3 font-heading text-lg font-bold">{card.title}</h3>
            <ul className="flex-1 space-y-2">
              {card.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-0.5 text-primary">•</span>
                  {b}
                </li>
              ))}
            </ul>
            <button className="group mt-5 flex items-center gap-1 text-left text-sm font-bold text-foreground transition-colors hover:text-primary">
              Contact Us <span className="transition-transform group-hover:translate-x-1">→</span>
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);
