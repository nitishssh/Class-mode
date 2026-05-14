import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, Users, School, Star, Sparkles } from "lucide-react";

const stats = [
  { value: "200+", label: "Schools onboarded" },
  { value: "12k+", label: "Active students" },
  { value: "94%", label: "Avg grade improvement" },
];

export const Hero = () => {
  const [, setLocation] = useLocation();

  return (
    <section className="relative flex min-h-screen items-center overflow-hidden pt-16">
      {/* Warm gradient bg */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-accent-soft/20 to-background" />

      {/* Decorative blobs */}
      <div className="absolute -right-48 -top-48 h-[600px] w-[600px] rounded-full bg-primary/6 blur-3xl" />
      <div className="absolute -bottom-48 -left-48 h-[600px] w-[600px] rounded-full bg-energy/8 blur-3xl" />

      <div className="container relative z-10 py-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="mx-auto max-w-4xl text-center"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-accent-soft px-5 py-2 text-sm font-semibold text-primary"
          >
            <Star className="h-3.5 w-3.5 fill-current" />
            Trusted by 200+ classrooms worldwide
          </motion.div>

          {/* Headline */}
          <h1 className="mb-6 text-5xl font-extrabold leading-[1.08] tracking-tight md:text-7xl">
            Where every classroom
            <br />
            <span className="text-primary">comes alive.</span>
          </h1>

          {/* Subtext */}
          <p className="mx-auto mb-10 max-w-2xl text-xl leading-relaxed text-muted-foreground">
            AI tutoring, live classes, smart grading, and real-time insights — one warm, friendly
            platform that students love and teachers trust.
          </p>

          {/* Dual CTAs */}
          <div className="mb-16 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              className="group h-14 gap-2 rounded-full bg-primary px-8 text-base font-semibold text-primary-foreground shadow-xp transition-all hover:bg-primary/90 hover:shadow-lg"
              onClick={() => setLocation("/login")}
            >
              <Users className="h-5 w-5" />
              I'm a Student
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-14 gap-2 rounded-full border-2 border-border px-8 text-base font-semibold transition-all hover:border-primary/30 hover:bg-accent-soft"
              onClick={() => setLocation("/login")}
            >
              <School className="h-5 w-5" />
              Set Up My School
            </Button>
          </div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="grid grid-cols-3 gap-8 border-t border-border pt-12"
          >
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                className="text-center"
              >
                <p className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
                  {stat.value}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Floating feature chips */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mt-16 flex flex-wrap items-center justify-center gap-3"
        >
          {[
            "✦ AI Tutor",
            "✦ Live Classes",
            "✦ Smart Grading",
            "✦ Study Streaks",
            "✦ Analytics",
            "✦ Parent Portal",
          ].map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground"
            >
              {chip}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
};
