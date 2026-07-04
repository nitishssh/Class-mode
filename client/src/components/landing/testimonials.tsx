import { motion } from "framer-motion";
import { PhoneMissed, Wallet, FileStack, EyeOff, ClipboardList, Zap, BellRing } from "lucide-react";

const painPoints = [
  {
    icon: PhoneMissed,
    title: "Parents find out at 4 PM",
    desc: "An absence marked at 8 AM travels by phone tree — if someone remembers to call. Most days, nobody does.",
    color: "text-red-400",
  },
  {
    icon: Wallet,
    title: "Fee dues live in a notebook",
    desc: "Someone flips the pages, makes a list, and starts calling families one by one. Every month. Again.",
    color: "text-orange-400",
  },
  {
    icon: FileStack,
    title: "Records scattered everywhere",
    desc: "Attendance in registers, fees in a ledger, parents on teachers' personal WhatsApp. Nothing talks to anything.",
    color: "text-rose-400",
  },
  {
    icon: EyeOff,
    title: "You see it at month-end",
    desc: "By the time a report reaches your desk, the month is over. You're running today's school on last month's news.",
    color: "text-amber-400",
  },
];

const steps = [
  {
    icon: ClipboardList,
    label: "Tell us about your school",
    desc: "Two minutes in the form below — your classes, your student count, what hurts most.",
    color: "bg-secondary",
  },
  {
    icon: Zap,
    label: "We set you up the same day",
    desc: "We load your classes and students. Teachers get a link on the phones they already carry. That's the whole rollout.",
    color: "bg-primary",
  },
  {
    icon: BellRing,
    label: "Parents hear from you tomorrow",
    desc: "8:00 AM register, 8:03 AM WhatsApp. From the very first morning.",
    color: "bg-secondary",
  },
];

export const Turbulence = () => {
  return (
    <section className="relative overflow-hidden bg-zinc-950 py-24 text-white dark:bg-background dark:text-foreground">
      {/* Abstract Grid/Vibration Effect */}
      <div className="pointer-events-none absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
      </div>

      <div className="container relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto mb-20 max-w-3xl text-center"
        >
          <span className="mb-4 inline-block rounded-full border border-red-500/20 bg-red-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-red-400">
            ⚠️ 8:00 AM, any school day
          </span>
          <h2 className="mb-6 text-4xl font-extrabold tracking-tight text-zinc-50 dark:text-foreground md:text-6xl">
            The register knows. <span className="text-red-500">Nobody else does.</span>
          </h2>
          <p className="text-lg leading-relaxed text-zinc-300 dark:text-muted-foreground md:text-xl">
            Riya&apos;s seat is empty. Her teacher marks the register and moves on — thirty
            students, four periods, no time to call anyone. Her mother will find out at 4 PM. If
            someone remembers.
          </p>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {painPoints.map((point, i) => (
            <motion.div
              key={point.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 transition-all duration-500 hover:border-red-500/30 dark:border-border dark:bg-card"
            >
              <div
                className={`mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800 transition-transform group-hover:scale-110 dark:bg-muted ${point.color}`}
              >
                <point.icon size={24} />
              </div>
              <h3 className="mb-3 text-xl font-bold text-zinc-50 dark:text-foreground">
                {point.title}
              </h3>
              <p className="text-sm leading-relaxed text-zinc-400 transition-colors group-hover:text-zinc-300 dark:text-muted-foreground dark:group-hover:text-foreground/80">
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
            <p className="mb-4 max-w-md text-sm italic text-zinc-400 dark:text-muted-foreground">
              It&apos;s not that your school isn&apos;t working hard. The news just travels slower
              than the day. The same morning can go differently —
            </p>
            <div className="h-12 w-1 animate-bounce rounded-full bg-gradient-to-b from-red-500 to-primary"></div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export const Journey = () => (
  <section id="journey" className="bg-card/50 py-24">
    <div className="container">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-16 text-center"
      >
        <h2 className="mb-3 text-3xl font-extrabold md:text-4xl">
          Getting there is three steps. Not a project.
        </h2>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
          Class Mode was built inside a real school — teachers with thirty students and four
          periods, an office with one register. It runs on the phones your staff already carry. No
          server room, no consultant, no training day.
        </p>
      </motion.div>

      <div className="relative mx-auto max-w-3xl">
        {/* Vertical dashed line */}
        <div className="absolute bottom-0 left-6 top-0 w-px -translate-x-1/2 border-l-2 border-dashed border-border md:left-1/2" />

        <div className="space-y-12">
          {steps.map((step, i) => (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`relative flex items-start gap-4 md:gap-0 ${
                i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
              }`}
            >
              {/* Bubble */}
              <div className={`md:w-1/2 ${i % 2 === 0 ? "md:pr-12 md:text-right" : "md:pl-12"}`}>
                <div className="sketch-border sketch-shadow inline-block max-w-sm rounded-2xl bg-background p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_20px_hsl(var(--secondary)/0.5)]">
                  <div className="mb-1 flex items-center gap-2">
                    <step.icon size={18} className="text-foreground" />
                    <span className="font-heading text-sm font-bold">
                      {i + 1}. {step.label}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{step.desc}</p>
                </div>
              </div>

              {/* Center dot */}
              <div className="absolute left-6 top-5 z-10 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-foreground bg-background md:left-1/2" />

              {/* Spacer for other side */}
              <div className="hidden md:block md:w-1/2" />
            </motion.div>
          ))}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mt-16 text-center"
      >
        <a
          href="#contact"
          className="sketch-border sketch-shadow-yellow hover-tilt inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 font-heading text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98]"
        >
          Start with step one →
        </a>
      </motion.div>
    </div>
  </section>
);
