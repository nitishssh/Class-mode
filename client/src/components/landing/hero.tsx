import { Button } from "@/components/ui/button";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { Check, CheckCheck, MousePointer, Activity, Clock } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import heroImg from "@/assets/hero-runway.png";
import waDoodle from "@/assets/whatsapp-doodle.png";

export const Hero = () => {
  const [step, setStep] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef);

  // Synced loop for the storytelling mockup (loops steps 0 to 3); paused while off-screen
  useEffect(() => {
    if (!inView) return;
    const interval = setInterval(() => {
      setStep((prev) => (prev + 1) % 4);
    }, 4500);
    return () => clearInterval(interval);
  }, [inView]);

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-screen items-center overflow-hidden bg-background pt-16"
    >
      {/* Background illustration with atmospheric glows */}
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <img
          src={heroImg}
          alt=""
          className="h-full w-full select-none object-cover opacity-15 grayscale filter dark:opacity-10"
        />
        {/* Soft, modern glowing grids & ambient meshes */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/60 to-background" />
        <div className="pointer-events-none absolute left-[-10%] top-[-20%] h-[50%] w-[50%] rounded-full bg-primary/10 blur-[120px]" />
        <div className="pointer-events-none absolute bottom-[-10%] right-[-10%] h-[60%] w-[60%] rounded-full bg-energy/10 blur-[150px]" />
      </div>

      <div className="container relative z-10 grid items-center gap-12 py-20 lg:grid-cols-12">
        {/* Left Column: Copy & Actions */}
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="space-y-8 lg:col-span-6"
        >
          <div className="space-y-4">
            <span className="sketch-border sketch-shadow-yellow inline-flex items-center gap-2 bg-card/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-foreground backdrop-blur-sm">
              <span className="flex h-2 w-2 animate-pulse rounded-full bg-primary" />
              For schools running on paper and WhatsApp
            </span>
            <h1 className="font-heading text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
              Marked absent <br />
              at{" "}
              <span className="relative inline-block font-mono font-medium text-primary">8:02</span>
              . Mum knows <br />
              <span className="font-display italic text-energy-dark underline decoration-primary decoration-wavy decoration-[3px] underline-offset-8 dark:text-energy">
                the same morning.
              </span>
            </h1>
          </div>

          <p className="max-w-xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            Your teacher taps the morning register once. ClassMode does the rest — the day's
            absentee call list, the WhatsApp alert to the parent, the fee reminder, and the live
            dashboard on the principal's desk. AI tutoring for every student, built-in.
          </p>

          <div className="flex flex-wrap gap-4 pt-2">
            <Button
              size="lg"
              className="sketch-border sketch-shadow-yellow hover-tilt rounded-full bg-primary px-8 font-heading text-base font-bold text-primary-foreground transition-all hover:bg-primary/95"
              onClick={() =>
                document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Request founding-school pilot
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="sketch-border sketch-shadow hover-tilt rounded-full bg-card/60 px-8 font-heading text-base font-medium backdrop-blur-sm"
              onClick={() =>
                document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })
              }
            >
              See how it works
            </Button>
          </div>

          <ul className="flex flex-wrap gap-x-6 gap-y-3 pt-2 text-sm font-medium text-muted-foreground">
            {["Free founding-school pilot", "Same-day setup", "Runs on teachers' own phones"].map(
              (point) => (
                <li key={point} className="flex items-center gap-2">
                  <Check size={16} strokeWidth={3} className="shrink-0 text-primary" />
                  {point}
                </li>
              )
            )}
          </ul>
        </motion.div>

        {/* Right Column: Premium High-Fidelity Storytelling Mockup */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="relative flex min-h-[500px] items-center justify-center lg:col-span-6"
        >
          {/* Main Glow Backdrop */}
          <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-tr from-primary/10 to-energy/10 blur-3xl" />

          {/* Interactive Showcase Frame — decorative mockup, hidden from the a11y tree */}
          <div
            aria-hidden="true"
            className="relative flex h-[460px] w-full max-w-[480px] origin-center scale-[0.78] items-center justify-center sm:scale-100"
          >
            {/* 1. MOCK TABLET REGISTER (Back Layer) */}
            <motion.div
              style={{ rotateX: 6, rotateY: -10 }}
              className="absolute left-2 top-4 z-10 w-[360px] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
            >
              {/* Window header */}
              <div className="flex h-9 items-center justify-between border-b border-border/80 bg-muted/40 px-4">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                  <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
                </div>
                <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  <Clock size={10} />
                  {step === 0 ? "8:01 AM" : "8:02 AM"}
                </span>
                <span className="w-12 text-right font-mono text-[10px] text-muted-foreground/40">
                  10.0.1
                </span>
              </div>

              {/* Tablet Content */}
              <div className="space-y-4 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-foreground">Grade 6-B Registration</p>
                    <p className="text-[9px] text-muted-foreground">Classroom: West Wing</p>
                  </div>
                  <span className="inline-flex animate-pulse items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-600">
                    <span className="h-1 w-1 rounded-full bg-emerald-500" /> Live
                  </span>
                </div>

                {/* Student list */}
                <div className="space-y-2">
                  {/* Student 1 */}
                  <div className="flex items-center justify-between rounded-lg bg-muted/30 p-2 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-cream-300 text-[10px] font-bold text-foreground dark:bg-cream-500">
                        RG
                      </div>
                      <span className="font-medium">Rohan Gupta</span>
                    </div>
                    <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                      Present
                    </span>
                  </div>

                  {/* Student 2 (Riya Sharma - Interactive) */}
                  <div
                    className={`flex items-center justify-between rounded-lg p-2 text-xs transition-all duration-500 ${step >= 1 ? "border border-red-500/20 bg-red-500/5 shadow-sm" : "bg-muted/30"}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                        RS
                      </div>
                      <span className="font-semibold">Riya Sharma</span>
                    </div>

                    <div className="relative flex items-center">
                      <AnimatePresence mode="wait">
                        {step === 0 ? (
                          <motion.span
                            key="present"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600"
                          >
                            Present
                          </motion.span>
                        ) : (
                          <motion.span
                            key="absent"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1, y: [0, -2, 2, 0] }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="animate-pulse-live rounded bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive"
                          >
                            Absent
                          </motion.span>
                        )}
                      </AnimatePresence>

                      {/* Mock Cursor Click Animation */}
                      {step === 1 && (
                        <motion.div
                          initial={{ x: 40, y: 30, opacity: 0 }}
                          animate={{ x: 5, y: 5, opacity: 1 }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          className="pointer-events-none absolute bottom-[-20px] right-[-10px] z-30 text-foreground"
                        >
                          <MousePointer
                            size={18}
                            className="fill-foreground text-foreground drop-shadow"
                          />
                          <span className="absolute right-0 top-0 h-3 w-3 animate-ping rounded-full bg-primary/40" />
                        </motion.div>
                      )}
                    </div>
                  </div>

                  {/* Student 3 */}
                  <div className="flex items-center justify-between rounded-lg bg-muted/30 p-2 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-cream-300 text-[10px] font-bold text-foreground dark:bg-cream-500">
                        SK
                      </div>
                      <span className="font-medium">Sam Keeler</span>
                    </div>
                    <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                      Present
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* 2. MOCK SMARTPHONE (WhatsApp Notification - Overlaying Right Layer) */}
            <motion.div
              style={{ rotateX: 6, rotateY: -10 }}
              animate={step === 2 ? { y: [0, -8, 8, -6, 6, 0] } : {}}
              transition={{ duration: 0.5 }}
              className="absolute bottom-4 right-0 z-20 flex h-[320px] w-[210px] flex-col overflow-hidden rounded-[30px] border-[6px] border-zinc-900 bg-zinc-950 shadow-2xl"
            >
              {/* Phone Camera Notch */}
              <div className="absolute left-1/2 top-0 z-30 h-3.5 w-16 -translate-x-1/2 rounded-b-xl bg-zinc-900" />

              {/* WhatsApp Mock Header */}
              <div className="flex items-center gap-1.5 border-b border-black/10 bg-[#075E54] px-3 pb-2 pt-4 text-white dark:border-white/5 dark:bg-[#202c33]">
                <div className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-zinc-700 text-[9px] font-bold">
                  🏫
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[10px] font-bold leading-tight">ClassMode Alerts</p>
                  <p className="text-[7px] text-emerald-100 opacity-90">Online</p>
                </div>
                <div className="flex h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              </div>

              {/* WhatsApp Messages Content */}
              <div className="relative flex flex-1 flex-col justify-end space-y-2.5 overflow-hidden bg-[#efeae2] p-3 text-[9px] dark:bg-[#0b141a]">
                {/* WhatsApp Chat Wallpaper Pattern Overlay */}
                <div
                  className="pointer-events-none absolute inset-0 bg-[size:120px] bg-repeat opacity-[0.06] dark:opacity-[0.03]"
                  style={{ backgroundImage: `url(${waDoodle})` }}
                />

                <div className="relative flex w-full flex-1 flex-col justify-end space-y-2">
                  {/* Encryption Notice */}
                  <div className="mx-auto max-w-[90%] rounded-lg border border-amber-200/50 bg-amber-100 p-1.5 text-center text-[7px] leading-normal text-[#667781] shadow-sm dark:border-amber-900/20 dark:bg-amber-950/40 dark:text-amber-200/70">
                    🔒 Messages are end-to-end encrypted. No one outside of this chat can read them.
                  </div>

                  <AnimatePresence>
                    {/* Alert delivered at 8:02 AM */}
                    {step >= 2 && (
                      <motion.div
                        key="school-alert"
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="max-w-[88%] self-start rounded-lg rounded-tl-none border border-black/5 bg-white p-2 text-[#111b21] shadow-sm dark:border-white/5 dark:bg-[#202c33] dark:text-[#e9edef]"
                      >
                        <p className="leading-snug">
                          🔔 <strong>ClassMode Alert:</strong> Riya was marked{" "}
                          <strong>ABSENT</strong> from morning registration (8:02 AM). Please
                          verify.
                        </p>
                        <span className="mt-1 block flex items-center justify-end gap-0.5 text-right text-[7px] text-[#667781] dark:text-[#8696a0]">
                          8:02 AM <CheckCheck size={10} className="text-[#53bdeb]" />
                        </span>
                      </motion.div>
                    )}

                    {/* Mum replies at 8:03 AM */}
                    {step >= 3 && (
                      <motion.div
                        key="mum-reply"
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="max-w-[88%] self-end rounded-lg rounded-tr-none border border-black/5 bg-[#d9fdd3] p-2 text-[#111b21] shadow-sm dark:border-white/5 dark:bg-[#005c4b] dark:text-[#e9edef]"
                      >
                        <p className="leading-snug">
                          Oh dear! She is home sick today. Sending doctor's note now.
                        </p>
                        <span className="mt-0.5 block text-right text-[7px] text-[#667781] dark:text-[#8696a0]/80">
                          8:03 AM
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>

            {/* 3. MOCK PRINCIPAL REPORT CARD (Floating Front Left Layer) */}
            <motion.div
              style={{ rotateX: 6, rotateY: -10 }}
              className="absolute bottom-6 left-[-20px] z-30 w-[180px] rounded-xl border border-border bg-card/90 p-3.5 shadow-xl backdrop-blur"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                  <Activity size={10} className="text-primary" /> Live Insights
                </span>
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[8px] font-bold text-primary">
                  Principal View
                </span>
              </div>

              <div className="space-y-1">
                <p className="text-[9px] text-muted-foreground">Today's Attendance</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold tracking-tight text-foreground">
                    {step === 3 ? "95.8%" : "96.4%"}
                  </span>
                  <span
                    className={`text-[8px] font-bold ${step === 3 ? "text-red-500" : "text-emerald-500"}`}
                  >
                    {step === 3 ? "-0.6%" : "+1.2%"}
                  </span>
                </div>
              </div>

              {/* Live status feed */}
              <div className="mt-3 space-y-1.5 border-t border-border/80 pt-2.5 text-[8px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>Register complete (8:02 AM)</span>
                </div>
                {step >= 2 && (
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    <span>WhatsApp alert delivered</span>
                  </div>
                )}
                {step >= 3 && (
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    <span className="font-semibold text-foreground">Mum replied: Home sick</span>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
