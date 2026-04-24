import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Check, Send } from "lucide-react";
import { toast } from "sonner";
import schoolMeeting from "@/assets/school-meeting.png";

const samplePlans: Record<string, string[]> = {
  Mathematics: [
    "Day 1: Algebra fundamentals & practice set",
    "Day 2: Geometry concepts + visual exercises",
    "Day 3: Trigonometry with real-world problems",
    "Day 4: Statistics & data interpretation",
    "Day 5: Mixed revision quiz (AI-adaptive)",
    "Day 6: Weak-area deep dive (auto-detected)",
    "Day 7: Mock test & performance report",
  ],
  Science: [
    "Day 1: Physics — Forces & motion lab",
    "Day 2: Chemistry — Periodic trends flashcards",
    "Day 3: Biology — Cell structure visual guide",
    "Day 4: Physics — Energy & work problems",
    "Day 5: Chemistry — Balancing equations drill",
    "Day 6: Cross-topic revision quiz",
    "Day 7: Full-length practice test",
  ],
  English: [
    "Day 1: Reading comprehension strategies",
    "Day 2: Grammar & sentence correction",
    "Day 3: Essay writing framework",
    "Day 4: Vocabulary building (AI flashcards)",
    "Day 5: Critical analysis practice",
    "Day 6: Timed writing exercise",
    "Day 7: Mock test & AI feedback",
  ],
};

const plans = [
  {
    name: "All Access Pass",
    price: "Coming Soon",
    desc: "We're preparing our premium learning features for launch.",
    features: [
      "Unlimited AI study plans",
      "Smart tutor bot",
      "Performance analytics",
      "Priority support",
    ],
    cta: "Join Waitlist",
    highlighted: true,
  },
];

export const DemoWidget = () => {
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [plan, setPlan] = useState<string[] | null>(null);

  const generate = () => {
    if (!subject) return;
    setPlan(samplePlans[subject] || samplePlans["Mathematics"]);
  };

  return (
    <section className="bg-card/50 py-24">
      <div className="container max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-10 text-center"
        >
          <h2 className="mb-3 text-3xl font-extrabold md:text-4xl">Try It Now ✨</h2>
          <p className="text-lg text-muted-foreground">
            Enter a subject and get an instant 7-day micro study plan.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="sketch-border sketch-shadow-yellow rounded-2xl bg-background p-8"
        >
          <div className="mb-6 flex flex-col gap-4 sm:flex-row">
            <select
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setPlan(null);
              }}
              className="h-11 flex-1 rounded-lg border border-border bg-background px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select subject</option>
              <option>Mathematics</option>
              <option>Science</option>
              <option>English</option>
            </select>
            <input
              type="text"
              placeholder="Grade (e.g. 10th)"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="h-11 flex-1 rounded-lg border border-border bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button
              onClick={generate}
              className="sketch-border sketch-shadow-yellow hover-tilt rounded-full bg-primary font-heading text-primary-foreground hover:bg-primary/90"
              disabled={!subject}
            >
              <Sparkles size={16} className="mr-2" />
              Generate Plan
            </Button>
          </div>

          <AnimatePresence mode="wait">
            {plan && (
              <motion.div
                key="plan"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                {plan.map((day, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold">
                      {i + 1}
                    </span>
                    <span className="text-sm">{day}</span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
};

export const Pricing = () => {
  const [, setLocation] = useLocation();
  return (
    <section id="pricing" className="bg-card/50 py-24">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <h2 className="mb-3 text-3xl font-extrabold md:text-4xl">Choose Your Ticket 🎫</h2>
          <p className="text-lg text-muted-foreground">
            Simple pricing for every kind of learner. Tickets launching soon.
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
                  Launching Soon
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
                onClick={() => setLocation("/login")}
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

export const ContactForm = () => {
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "", message: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Please fill in your name and email.");
      return;
    }
    toast.success("Thank you! We'll be in touch shortly. ✨");
    setForm({ name: "", email: "", phone: "", role: "", message: "" });
  };

  const inputClasses =
    "w-full h-11 rounded-lg border border-border bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] transition-all";

  return (
    <section id="contact" className="relative flex min-h-[80vh] items-center overflow-hidden py-24">
      {/* Background illustration */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <img
          src={schoolMeeting}
          alt="Contact Section Background"
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
              ✨ Get in touch
            </span>
            <h2 className="text-4xl font-extrabold tracking-tight md:text-5xl">
              Book Your Digital Journey
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground md:text-xl">
              Whether you're a student, teacher, or school — we'd love to help you succeed. Fill out
              the form and our team will reach out within 24 hours.
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
              placeholder="Your name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClasses}
              maxLength={100}
            />
            <input
              type="email"
              placeholder="Email address"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputClasses}
              maxLength={255}
            />
            <input
              type="tel"
              placeholder="Phone (optional)"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className={inputClasses}
              maxLength={20}
            />
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className={inputClasses}
            >
              <option value="">I am a…</option>
              <option>Student</option>
              <option>Teacher</option>
              <option>School / Institution</option>
              <option>Parent</option>
            </select>
            <textarea
              placeholder="Tell us about your learning goals…"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="min-h-[100px] w-full resize-none rounded-lg border border-border bg-background px-4 py-3 text-sm transition-all focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] focus:outline-none focus:ring-2 focus:ring-primary"
              maxLength={1000}
            />
            <Button
              type="submit"
              className="sketch-border sketch-shadow-yellow hover-tilt w-full rounded-full bg-primary font-heading text-primary-foreground hover:bg-primary/90"
              size="lg"
            >
              <Send size={16} className="mr-2" />
              Send Message
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              We won't share your data. Privacy first. 🔒
            </p>
          </motion.form>
        </div>
      </div>
    </section>
  );
};
