import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Calendar, BrainCircuit, Target, BarChart2, Brain, Code, Cloud, TrendingUp } from "lucide-react";

const features = [
  {
    title: "AI Study Planner",
    desc: "Create a personalized study plan based on your goals and weaknesses.",
    points: ["Personalized study roadmap", "Daily and weekly learning schedule", "Smart goal tracking"],
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
    bullets: ["Personalised study plans", "Smart flashcard generation", "Adaptive difficulty engine"],
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
      className="notebook-card group hover:-translate-y-2 hover:shadow-[8px_10px_0px_hsl(var(--foreground))] dark:hover:shadow-[8px_10px_0px_hsl(var(--primary))] transition-all duration-300 relative overflow-hidden"
      style={{ paddingLeft: '3.5rem' }}
    >
      {/* Notebook Punch Holes */}
      <div className="absolute left-3 top-0 bottom-0 flex flex-col justify-evenly py-4 z-20">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="w-4 h-4 rounded-full bg-background border border-border shadow-[inset_1px_1px_3px_rgba(0,0,0,0.15)] dark:shadow-[inset_1px_1px_3px_rgba(255,255,255,0.05)]"></div>
        ))}
      </div>

      {/* Red margin line characteristic of notebook paper */}
      <div className="absolute left-[3.2rem] top-0 bottom-0 w-[2px] bg-red-300/40 dark:bg-red-900/40 z-10"></div>

      <div className="absolute top-0 right-0 w-8 h-8 bg-gradient-to-bl from-white/40 dark:from-white/10 to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity"></div>

      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className="p-2 relative group-hover:-rotate-6 transition-transform">
          {/* Handwritten style highlight behind icon */}
          <div className="absolute inset-0 bg-[#FFD455]/90 dark:bg-primary/30 -rotate-3 rounded-sm -z-10 group-hover:rotate-6 transition-transform"></div>
          <feature.icon size={26} strokeWidth={2.5} className="text-foreground" />
        </div>
        <h3 className="text-2xl font-bold text-foreground relative inline-block font-sans">
          {feature.title}
          {/* Custom handwritten underline effect */}
          <svg className="absolute -bottom-2 left-0 w-full h-3 text-[#FFD455] dark:text-primary opacity-80" viewBox="0 0 100 10" preserveAspectRatio="none">
            <path d="M0 5 Q 50 10 100 2" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
          </svg>
        </h3>
      </div>

      <ul className="space-y-3 mb-8 ml-2 mt-4 relative z-10">
        {feature.points.map((point: string, i: number) => (
          <li key={i} className="flex items-center gap-3 text-foreground text-base font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4C6FFF] dark:bg-primary shrink-0"></span>
            {point}
          </li>
        ))}
      </ul>

      <Button
        variant="outline"
        className="w-full sm:w-auto relative z-10 rounded-full bg-background border-2 border-foreground text-foreground font-bold hover:bg-[#FFD455] dark:hover:bg-primary hover:text-foreground transition-colors shadow-[2px_2px_0px_hsl(var(--foreground))] dark:shadow-[2px_2px_0px_hsl(var(--primary))] hover:shadow-[4px_4px_0px_hsl(var(--foreground))] dark:hover:shadow-[4px_4px_0px_hsl(var(--primary))] text-sm h-11 px-6 hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
      >
        {feature.cta} <span className="ml-1 text-lg leading-none">›</span>
      </Button>
    </motion.div>
  );
};

export const NotebookFeature = () => {
  return (
    <section className="py-24 notebook-bg overflow-hidden dark:bg-background transition-colors duration-300">
      <div className="container max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-extrabold mb-4 text-foreground">
            From Concept to Launch
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            EduAI guides students through every stage of learning — <br className="hidden md:block" />
            from understanding concepts to mastering exams.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, rotateX: 10, y: 40 }}
          whileInView={{ opacity: 1, rotateX: 0, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ perspective: "1000px" }}
          className="relative max-w-4xl mx-auto"
        >
          <div className="grid md:grid-cols-2 gap-8 relative">
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
        className="text-center mb-16"
      >
        <h2 className="text-3xl md:text-4xl font-extrabold mb-3">
          Onboarding Features ✨
        </h2>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Everything you need for a smooth learning journey.
        </p>
      </motion.div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="bg-card sketch-border hover-tilt sketch-shadow p-6 rounded-2xl flex flex-col"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-4">
              <card.icon size={22} className="text-foreground" />
            </div>
            <h3 className="font-heading font-bold text-lg mb-3">{card.title}</h3>
            <ul className="space-y-2 flex-1">
              {card.bullets.map((b) => (
                <li key={b} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  {b}
                </li>
              ))}
            </ul>
            <button className="mt-5 text-sm font-bold text-foreground hover:text-primary transition-colors text-left flex items-center gap-1 group">
              Contact Us <span className="group-hover:translate-x-1 transition-transform">→</span>
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);
