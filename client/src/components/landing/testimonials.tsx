import { motion } from "framer-motion";
import { Clock, AlertCircle, BookX, ZapOff, ShieldCheck, Map, BookOpen, Target, Plane } from "lucide-react";

const painPoints = [
  {
    icon: Clock,
    title: "Information Overload",
    desc: "Drowning in notes, textbooks, and videos? 80% of study time is spent just deciding *what* to study.",
    color: "text-red-400"
  },
  {
    icon: AlertCircle,
    title: "The 'Wall' of Anxiety",
    desc: "That sinking feeling when you open a book and realize you don't know where to start. ✈️ Procrastination is just fear in disguise.",
    color: "text-orange-400"
  },
  {
    icon: BookX,
    title: "Forgotten by Friday",
    desc: "Reading isn't learning. Without active recall, 70% of what you study today is gone by next week.",
    color: "text-rose-400"
  },
  {
    icon: ZapOff,
    title: "Static Learning",
    desc: "One-size-fits-all textbooks don't care about *your* speed. You're either bored or left behind.",
    color: "text-amber-400"
  }
];

const steps = [
  { icon: ShieldCheck, label: "Assess", desc: "Quick diagnostic to find your strengths & gaps", color: "bg-secondary" },
  { icon: Map, label: "Personal Plan", desc: "AI builds your custom study roadmap", color: "bg-primary" },
  { icon: BookOpen, label: "Learn", desc: "AI tutor, flashcards & bite-sized lessons", color: "bg-secondary" },
  { icon: Target, label: "Practice", desc: "Smart quizzes that adapt to your level", color: "bg-primary" },
  { icon: Plane, label: "Launch", desc: "Ace your exam and reach your goals", color: "bg-secondary" },
];

export const Turbulence = () => {
  return (
    <section className="py-24 bg-zinc-950 dark:bg-background text-white dark:text-foreground relative overflow-hidden">
      {/* Abstract Grid/Vibration Effect */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
      </div>

      <div className="container relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto mb-20"
        >
          <span className="inline-block bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase mb-4">
            ⚠️ Standard Learning Warning
          </span>
          <h2 className="text-4xl md:text-6xl font-extrabold mb-6 tracking-tight text-zinc-50 dark:text-foreground">
            Studying in the <span className="text-red-500">Clouds?</span>
          </h2>
          <p className="text-zinc-300 dark:text-muted-foreground text-lg md:text-xl leading-relaxed">
            Most students are studying blind. No plan, no feedback, just pure chaos.
            It's not that you're not working hard—it's that your navigation system is broken.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {painPoints.map((point, i) => (
            <motion.div
              key={point.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group p-8 rounded-3xl bg-zinc-900/70 dark:bg-card border border-zinc-800 dark:border-border hover:border-red-500/30 transition-all duration-500"
            >
              <div className={`w-12 h-12 rounded-2xl bg-zinc-800 dark:bg-muted flex items-center justify-center mb-6 group-hover:scale-110 transition-transform ${point.color}`}>
                <point.icon size={24} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-zinc-50 dark:text-foreground">{point.title}</h3>
              <p className="text-zinc-400 dark:text-muted-foreground leading-relaxed text-sm group-hover:text-zinc-300 dark:group-hover:text-foreground/80 transition-colors">
                {point.desc}
              </p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-20 text-center"
        >
          <div className="inline-flex flex-col items-center">
            <p className="text-zinc-400 dark:text-muted-foreground text-sm mb-4 italic">Ready for clear skies?</p>
            <div className="w-1 h-12 bg-gradient-to-b from-red-500 to-primary rounded-full animate-bounce"></div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export const Journey = () => (
  <section id="journey" className="py-24 bg-card/50">
    <div className="container">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-16"
      >
        <h2 className="text-3xl md:text-4xl font-extrabold mb-3">
          Your Strategic Navigator 🧭
        </h2>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          We strip away the chaos. Here's your automated path from confusion to complete mastery.
        </p>
      </motion.div>

      <div className="relative max-w-3xl mx-auto">
        {/* Vertical dashed line */}
        <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-px border-l-2 border-dashed border-border -translate-x-1/2" />

        <div className="space-y-12">
          {steps.map((step, i) => (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`relative flex items-start gap-4 md:gap-0 ${i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                }`}
            >
              {/* Bubble */}
              <div
                className={`md:w-1/2 ${i % 2 === 0 ? "md:pr-12 md:text-right" : "md:pl-12"
                  }`}
              >
                <div className="bg-background sketch-border sketch-shadow p-5 rounded-2xl inline-block max-w-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_20px_hsl(var(--secondary)/0.5)]">
                  <div className="flex items-center gap-2 mb-1">
                    <step.icon size={18} className="text-foreground" />
                    <span className="font-heading font-bold text-sm">
                      {step.label}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{step.desc}</p>
                </div>
              </div>

              {/* Center dot */}
              <div className="absolute left-6 md:left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-foreground bg-background z-10 top-5" />

              {/* Spacer for other side */}
              <div className="hidden md:block md:w-1/2" />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  </section>
);
