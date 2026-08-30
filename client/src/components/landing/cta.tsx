import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { Check, Send, CheckCheck, BookOpen, Brain, Sparkles, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/queryClient";
import schoolMeeting from "@/assets/school-meeting.png";
import waDoodle from "@/assets/whatsapp-doodle.png";

const studyTopics = [
  {
    id: "photosynthesis",
    name: "Science: Photosynthesis",
    subject: "Grade 7 Biology",
    reply: "Can you summarize how photosynthesis works? I have a quiz tomorrow.",
    ack: "Of course! 🍃 Photosynthesis is how plants make food using sunlight.\n\nHere are the 3 main ingredients:\n1. **Sunlight** (absorbed by chlorophyll)\n2. **Water** (from roots)\n3. **Carbon Dioxide** (from air)\n\nThey turn these into **Glucose** (food) and release **Oxygen** 💨.",
    followUp: "Got it. What exactly does chlorophyll do?",
    followUpAck:
      "Think of **chlorophyll** as a tiny solar panel! ☀️ It's the green pigment in leaves that captures sunlight energy to power the chemical process.",
    parent: "Arjun's Phone",
    color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  },
  {
    id: "quadratics",
    name: "Math: Quadratic Formula",
    subject: "Grade 10 Algebra",
    reply: "How do I solve: x² - 5x + 6 = 0 using the quadratic formula?",
    ack: "Let's solve it! 📐\n\nFor ax² + bx + c = 0, the formula is:\n`x = [-b ± √(b² - 4ac)] / 2a`\n\nHere, a=1, b=-5, c=6.\n1. `b² - 4ac` = `25 - 24 = 1`\n2. `√1 = 1`\n3. `x = (5 ± 1) / 2`\n\nSo, **x = 3** or **x = 2**! Let me know if you want another practice question. 🧠",
    followUp: "Why is the term under the square root called the discriminant?",
    followUpAck:
      "Great question! It's called the **discriminant** (d = b² - 4ac) because it 'discriminates' or tells us the *nature* of the roots:\n\n• d > 0: 2 real roots\n• d = 0: 1 real root\n• d < 0: no real roots!",
    parent: "Riya's Phone",
    color: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  },
  {
    id: "french-rev",
    name: "History: French Revolution",
    subject: "Grade 9 History",
    reply: "What were the main causes of the French Revolution in 1789?",
    ack: "The French Revolution had 3 main causes (the 'Three Estates'):\n\n1. **Social Inequality**: The 3rd Estate (98% of people: peasants/middle class) paid all taxes, while nobles and clergy paid none.\n2. **Economic Crisis**: France was bankrupt from royal spending and foreign war debt.\n3. **Famine**: Extreme winters led to bad harvests, bread shortages, and starvation.",
    followUp: "What was the Tennis Court Oath?",
    followUpAck:
      "The **Tennis Court Oath** was a pivotal moment in June 1789! When the 3rd Estate got locked out of the estates-general meeting, they gathered on a nearby tennis court and swore not to leave until France had a written constitution. 📜",
    parent: "Meera's Phone",
    color: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  },
  {
    id: "shakespeare",
    name: "English: Macbeth Act 1",
    subject: "Grade 11 Literature",
    reply: "What is the meaning of 'Fair is foul, and foul is fair' in Macbeth?",
    ack: "That famous line is spoken by the three Witches! 🧙‍♀️\n\nIt sets the main theme of the play: **appearances vs. reality**.\n\nIt means that things that seem good ('fair') will turn out to be evil/corrupt ('foul'), and things that seem bad may actually have truth. It foreshadows how Macbeth will slide into tyranny.",
    followUp: "How does this connect to Macbeth's character?",
    followUpAck:
      "Macbeth starts as a 'fair' war hero, but is tempted by ambition and commits 'foul' murders. His first line in the play even mirrors the witches: *'So foul and fair a day I have not seen.'*",
    parent: "Kabir's Phone",
    color: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
  },
];

type StudyTopic = (typeof studyTopics)[number];

const DEFAULT_TOPIC_ID = studyTopics[0].id;

const conversation = (s: StudyTopic) => [
  { from: "student" as const, text: s.reply, time: "4:15 PM" },
  { from: "tutor" as const, text: s.ack, time: "4:16 PM" },
  { from: "student" as const, text: s.followUp, time: "4:17 PM" },
  { from: "tutor" as const, text: s.followUpAck, time: "4:17 PM" },
];

// Chat copy uses **bold** and *italic* markers; render them as <strong>/<em>
// instead of literal asterisks.
const renderMarkers = (text: string) =>
  text
    .split("**")
    .map((part, i) =>
      i % 2 === 1 ? (
        <strong key={i}>{part}</strong>
      ) : (
        <React.Fragment key={i}>
          {part.split("*").map((sub, j) => (j % 2 === 1 ? <em key={j}>{sub}</em> : sub))}
        </React.Fragment>
      )
    );

const plans = [
  {
    name: "Founding School Pilot",
    price: "Free",
    desc: "Full product, direct line to the people building it. All we ask for is honest feedback from your mornings.",
    features: [
      "One-tap attendance, with the day's absentee call list",
      "Parent WhatsApp alerts, switched on together when you're ready",
      "Fee tracking & automatic reminders",
      "Live dashboard for principals",
      "AI learning tools for every student",
      "Same-day setup — no hardware, no IT",
    ],
    cta: "Request a pilot",
    highlighted: true,
  },
];

const TypingDots = () => (
  <span className="flex items-center gap-1 px-1 py-0.5">
    {[0, 1, 2].map((i) => (
      <motion.span
        key={i}
        animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-muted-foreground"
      />
    ))}
  </span>
);

export const DemoWidget = () => {
  const [activeId, setActiveId] = useState<string>(DEFAULT_TOPIC_ID);
  const [shownCount, setShownCount] = useState<number>(0);
  const [typingFrom, setTypingFrom] = useState<"tutor" | "student" | undefined>(undefined);
  const timers = useRef<number[]>([]);
  const chatRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  // Ambient loops only animate while the section is on screen
  const ambientActive = useInView(sectionRef);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => {
    return () => clearTimers();
  }, []);

  // Keep the newest bubble in view as the conversation plays out — but don't
  // yank the user back down if they've scrolled up to reread an earlier message
  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [shownCount, typingFrom]);

  const startAnimation = useCallback((topicId: string) => {
    clearTimers();
    setActiveId(topicId);
    setShownCount(0);
    setTypingFrom(undefined);

    const ts: number[] = [];

    // Step 0: Immediate show student's query (visible = 1)
    setShownCount(1);

    // Step 1: Wait 1s, show typing indicator from AI Tutor
    ts.push(
      window.setTimeout(() => {
        setTypingFrom("tutor");
      }, 1000)
    );

    // Step 2: Wait 3.5s total, hide typing, show AI Tutor's reply (visible = 2)
    ts.push(
      window.setTimeout(() => {
        setTypingFrom(undefined);
        setShownCount(2);
      }, 3500)
    );

    // Step 3: Wait 5.5s total, show typing indicator from student
    ts.push(
      window.setTimeout(() => {
        setTypingFrom("student");
      }, 5500)
    );

    // Step 4: Wait 7.5s total, hide typing, show student's follow-up query (visible = 3)
    ts.push(
      window.setTimeout(() => {
        setTypingFrom(undefined);
        setShownCount(3);
      }, 7500)
    );

    // Step 5: Wait 9.5s total, show typing indicator from AI Tutor
    ts.push(
      window.setTimeout(() => {
        setTypingFrom("tutor");
      }, 9500)
    );

    // Step 6: Wait 12.5s total, hide typing, show AI Tutor's second reply (visible = 4)
    ts.push(
      window.setTimeout(() => {
        setTypingFrom(undefined);
        setShownCount(4);
      }, 12500)
    );

    timers.current = ts;
  }, []);

  // First playback starts via onViewportEnter on the section — when it is
  // actually seen, not on page load (the section sits below the fold).

  const activeTopic = studyTopics.find((t) => t.id === activeId)!;
  const msgs = conversation(activeTopic);

  return (
    <motion.section
      ref={sectionRef}
      id="demo"
      onViewportEnter={() => startAnimation(DEFAULT_TOPIC_ID)}
      viewport={{ once: true, margin: "-15% 0px" }}
      className="relative overflow-hidden bg-card/50 py-24"
    >
      {/* Ambient shifting neon glows in the background — paused while off-screen */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
        <motion.div
          animate={ambientActive ? { x: [0, 40, -40, 0], y: [0, -30, 30, 0] } : {}}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -top-[20%] left-[-10%] h-[45%] w-[45%] rounded-full bg-primary/5 blur-[100px]"
        />
        <motion.div
          animate={ambientActive ? { x: [0, -40, 40, 0], y: [0, 30, -30, 0] } : {}}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -bottom-[20%] right-[-10%] h-[50%] w-[50%] rounded-full bg-energy/5 blur-[120px]"
        />
      </div>

      {/* Decorative floating items — paused while off-screen */}
      <div className="pointer-events-none absolute inset-0 z-0 hidden lg:block" aria-hidden="true">
        <motion.div
          animate={ambientActive ? { y: [0, -12, 0] } : {}}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-[8%] top-[20%] text-2xl opacity-20 grayscale filter dark:invert"
        >
          📚
        </motion.div>
        <motion.div
          animate={ambientActive ? { y: [0, 15, 0] } : {}}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute right-[8%] top-[30%] text-2xl opacity-20 grayscale filter dark:invert"
        >
          💡
        </motion.div>
      </div>

      <div className="container relative z-10 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12 text-center"
        >
          <span className="sketch-border sketch-shadow mb-4 inline-block bg-card px-4 py-1.5 text-sm font-medium text-foreground">
            ✨ 24/7 Learning Companion
          </span>
          <h2 className="mb-3 text-3xl font-extrabold md:text-4xl">
            AI Tutoring. <span className="italic text-primary">Right on WhatsApp.</span>
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            No complex dashboards or new apps for students to install. They chat with their school's
            ClassMode AI tutor, review class notes, translate, and solve equations.
          </p>
        </motion.div>

        <div className="relative z-10 grid gap-8 md:grid-cols-2">
          {/* ClassMode Learning Topics list */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Brain size={14} className="text-primary" /> Select a study topic
            </p>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_12px_40px_-12px_rgba(0,0,0,0.15)] dark:border-zinc-800 dark:bg-zinc-900"
            >
              {/* App header */}
              <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
                <div>
                  <p className="flex items-center gap-1.5 text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">
                    ClassMode Learn Hub
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Interactive WhatsApp Tutor Simulator
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">
                  <Sparkles
                    size={10}
                    className="animate-spin"
                    style={{ animationDuration: "3s" }}
                  />{" "}
                  4 Active
                </span>
              </div>

              {/* Roster / Topics */}
              <div className="divide-y divide-zinc-100 p-2 dark:divide-zinc-800">
                {studyTopics.map((t) => {
                  const isActive = activeId === t.id;
                  return (
                    <motion.button
                      key={t.id}
                      whileHover={{ scale: 1.02, x: 4 }}
                      whileTap={{ scale: 0.995 }}
                      onClick={() => startAnimation(t.id)}
                      className={`flex w-full items-center justify-between rounded-xl p-3.5 text-left transition-all ${
                        isActive
                          ? "border border-primary/20 bg-primary/5 shadow-md ring-1 ring-primary/10"
                          : "border border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <span
                          className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${t.color}`}
                        >
                          <BookOpen size={16} />
                        </span>
                        <span className="flex flex-col">
                          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {t.name}
                          </span>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            {t.subject}
                          </span>
                        </span>
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isActive
                            ? "animate-pulse bg-primary/20 text-primary"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {isActive ? "Studying" : "Try Chat"}
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Sync footer */}
              <div className="flex items-center gap-2 border-t border-zinc-100 px-5 py-3.5 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Simulated conversation · sample syllabus topics
              </div>
            </motion.div>
          </div>

          {/* Student's phone — WhatsApp AI Tutor */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <MessageSquare size={14} className="text-primary" /> Student&apos;s phone
            </p>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_12px_40px_-12px_rgba(0,0,0,0.15)] dark:border-zinc-800 dark:bg-zinc-900"
            >
              {/* WhatsApp Mock Header */}
              <div className="flex items-center gap-3 border-b border-black/10 bg-[#075E54] px-5 py-3.5 text-white dark:border-white/5 dark:bg-[#202c33]">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-lg dark:bg-zinc-800">
                  🤖
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <p className="truncate text-sm font-bold text-white">Sunrise AI Tutor</p>
                    <svg
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      className="shrink-0 fill-current text-emerald-400"
                    >
                      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                  </div>
                  <p className="text-[11px] text-white/80">
                    {typingFrom === "tutor" ? "typing…" : "online study companion"}
                  </p>
                </div>
              </div>

              <div
                ref={chatRef}
                className="relative max-h-[420px] min-h-[420px] flex-1 space-y-3 overflow-y-auto bg-[#efeae2] p-5 dark:bg-[#0b141a]"
              >
                {/* WhatsApp Chat Wallpaper Pattern Overlay */}
                <div
                  className="pointer-events-none absolute inset-0 bg-[size:120px] bg-repeat opacity-[0.06] dark:opacity-[0.03]"
                  style={{ backgroundImage: `url(${waDoodle})` }}
                />

                <div className="relative flex min-h-full w-full flex-col justify-end space-y-3">
                  {/* Thread divider */}
                  <div className="my-2 text-center">
                    <span className="rounded-full border border-black/5 bg-white/90 px-3 py-1 text-[9px] font-semibold text-zinc-600 shadow-sm dark:border-white/5 dark:bg-zinc-800 dark:text-zinc-400">
                      {activeTopic.parent}
                    </span>
                  </div>

                  {/* Encryption Notice */}
                  <div className="mx-auto max-w-[90%] rounded-lg border border-amber-200/50 bg-amber-100/80 p-2 text-center text-[8px] leading-normal text-[#667781] shadow-sm dark:border-amber-900/10 dark:bg-amber-950/20 dark:text-amber-200/70">
                    🔒 Messages are end-to-end encrypted. No one outside of this chat can read them.
                  </div>

                  <AnimatePresence>
                    {msgs.slice(0, shownCount).map((msg, i) => {
                      const isTutor = msg.from === "tutor";
                      return (
                        <motion.div
                          key={`${activeId}-${i}`}
                          layout
                          initial={{
                            opacity: 0,
                            x: isTutor ? -16 : 16,
                            scale: 0.95,
                          }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          transition={{ type: "spring", stiffness: 350, damping: 26 }}
                          className={
                            isTutor
                              ? "mr-auto max-w-[85%] whitespace-pre-line rounded-xl rounded-tl-none border border-black/5 bg-white p-3 text-xs text-[#111b21] shadow-sm dark:border-white/5 dark:bg-[#202c33] dark:text-[#e9edef]"
                              : "ml-auto max-w-[85%] whitespace-pre-line rounded-xl rounded-tr-none border border-black/5 bg-[#d9fdd3] p-3 text-xs text-[#111b21] shadow-sm dark:border-white/5 dark:bg-[#005c4b] dark:text-[#e9edef]"
                          }
                        >
                          <p className="leading-relaxed">{renderMarkers(msg.text)}</p>
                          <span className="mt-1 block flex items-center justify-end gap-0.5 text-right font-mono text-[8px] text-[#667781] dark:text-[#8696a0]">
                            {msg.time}
                            {isTutor && <CheckCheck size={10} className="text-[#53bdeb]" />}
                          </span>
                        </motion.div>
                      );
                    })}
                    {typingFrom && (
                      <motion.div
                        key={`${activeId}-typing`}
                        layout
                        initial={{ opacity: 0, x: typingFrom === "tutor" ? -16 : 16, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={
                          typingFrom === "tutor"
                            ? "mr-auto w-fit rounded-xl rounded-tl-none border border-black/5 bg-white p-3 shadow-sm dark:border-white/5 dark:bg-[#202c33]"
                            : "ml-auto w-fit rounded-xl rounded-tr-none border border-black/5 bg-[#d9fdd3] p-3 shadow-sm dark:border-white/5 dark:bg-[#005c4b]"
                        }
                      >
                        <TypingDots />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-8 text-center text-sm text-muted-foreground"
        >
          A preview of the real conversation students have with the AI Tutor on WhatsApp — class
          materials are synchronized, enabling smart revision anytime, anywhere.
        </motion.p>
      </div>
    </motion.section>
  );
};

export const Pricing = () => {
  return (
    <section id="pricing" className="bg-card/50 py-24">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <h2 className="mb-3 text-3xl font-extrabold md:text-4xl">
            Founding schools ride free. 🎫
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            We&apos;re onboarding a small number of founding schools. Simple per-student pricing
            comes later — and we&apos;ll agree on it together, after you&apos;ve seen a month of
            better mornings.
          </p>
        </motion.div>

        <div className="mx-auto flex max-w-4xl justify-center">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`sketch-border hover-tilt flex w-full max-w-sm flex-col rounded-2xl p-6 transition-all ${
                plan.highlighted
                  ? "sketch-shadow-yellow bg-card ring-2 ring-primary"
                  : "sketch-shadow bg-card"
              }`}
            >
              {plan.highlighted && (
                <span className="mb-4 self-start rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
                  Limited founding seats
                </span>
              )}
              <h3 className="font-heading text-xl font-bold">{plan.name}</h3>
              <p className="mt-2 font-heading text-3xl font-extrabold">{plan.price}</p>
              <p className="mb-6 mt-2 text-sm text-muted-foreground">{plan.desc}</p>
              <ul className="flex-1 space-y-4">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm font-medium">
                    <Check size={18} className="shrink-0 text-primary" strokeWidth={3} />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className={`sketch-border hover-tilt mt-8 h-12 rounded-full font-heading text-base ${
                  plan.highlighted
                    ? "sketch-shadow-yellow bg-primary text-primary-foreground hover:bg-primary/90"
                    : "sketch-shadow bg-card"
                }`}
                variant={plan.highlighted ? "default" : "outline"}
                onClick={() =>
                  document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" })
                }
              >
                {plan.cta}
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const emptyContactForm = { name: "", school: "", email: "", phone: "", role: "", message: "" };

export const ContactForm = () => {
  const [form, setForm] = useState(emptyContactForm);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.name.trim() || (!form.phone.trim() && !form.email.trim())) {
      toast.error("Please fill in your name and a phone number or email.");
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/leads", form);
      toast.success("Thank you! We'll be in touch shortly. ✨");
      setForm(emptyContactForm);
    } catch (err) {
      // apiRequest throws "<status>: <body>" — surface the server's message when present
      let message = "Couldn't send your message. Please try again.";
      const raw = err instanceof Error ? err.message : "";
      try {
        const body = JSON.parse(raw.replace(/^\d{3}:\s*/, ""));
        message = body?.message || body?.error || message;
      } catch {
        // non-JSON body (network failure etc.) — keep the generic message
      }
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  // text-base (16px) keeps iOS Safari from auto-zooming on focus
  const inputClasses =
    "w-full h-11 rounded-lg border border-border bg-background px-4 text-base focus:outline-none focus:ring-2 focus:ring-primary focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] transition-all";

  return (
    <section id="contact" className="relative flex min-h-[80vh] items-center overflow-hidden py-24">
      {/* Background illustration */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
        <img
          src={schoolMeeting}
          alt=""
          className="h-full w-full select-none object-cover opacity-35 mix-blend-multiply grayscale dark:opacity-15 dark:mix-blend-screen"
        />
        {/* Fade out right side (where form is), keep left visible */}
        <div className="absolute inset-0 bg-gradient-to-l from-background via-background/80 to-background/20" />
        {/* Fade top and bottom edges */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-transparent to-background/60" />
      </div>

      <div className="container relative z-10 flex justify-end">
        <div className="w-full max-w-lg">
          <div className="mb-10 text-left">
            <span className="sketch-border sketch-shadow mb-4 inline-block bg-card px-4 py-1.5 text-sm font-medium text-foreground">
              ✨ Step one
            </span>
            <h2 className="text-4xl font-extrabold tracking-tight md:text-5xl">
              Tell us about your school.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground md:text-xl">
              Two minutes now. We&apos;ll call you within 24 hours, set you up the same day — and
              your teachers mark their first register the next morning.
            </p>
          </div>

          {/* Form */}
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="sketch-border sketch-shadow space-y-4 rounded-2xl bg-card/70 p-8 backdrop-blur-xl dark:bg-card/50"
          >
            <input
              type="text"
              name="name"
              autoComplete="name"
              placeholder="Your name"
              aria-label="Your name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClasses}
              maxLength={100}
            />
            <input
              type="text"
              placeholder="School / Institution (optional)"
              value={form.school}
              onChange={(e) => setForm({ ...form, school: e.target.value })}
              className={inputClasses}
              maxLength={200}
            />
            <input
              type="email"
              placeholder="Email address"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputClasses}
              maxLength={150}
            />
            <input
              type="tel"
              placeholder="Phone number"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className={inputClasses}
              maxLength={20}
            />
            <select
              aria-label="I am a…"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className={inputClasses}
            >
              <option value="">I am a…</option>
              <option>Principal / School owner</option>
              <option>Teacher</option>
              <option>Parent</option>
              <option>Other</option>
            </select>
            <textarea
              placeholder="How many students? What's hardest right now — attendance, fees, parent calls?"
              aria-label="Tell us about your school"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="min-h-[100px] w-full resize-none rounded-lg border border-border bg-background px-4 py-3 text-base transition-all focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] focus:outline-none focus:ring-2 focus:ring-primary"
              maxLength={1000}
            />
            <Button
              type="submit"
              className="sketch-border sketch-shadow-yellow hover-tilt w-full rounded-full bg-primary font-heading text-primary-foreground hover:bg-primary/90"
              size="lg"
              disabled={submitting}
            >
              <Send size={16} className="mr-2" />
              {submitting ? "Sending…" : "Send Message"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              We won&apos;t share your data. Privacy first. 🔒
            </p>
          </motion.form>
        </div>
      </div>
    </section>
  );
};
