import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import heroImg from "@/assets/hero-runway.png";

export const Hero = () => {
  const [, setLocation] = useLocation();
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden pt-16">
      {/* Background illustration */}
      <div className="absolute inset-0 z-0">
        <img
          src={heroImg}
          alt="Illustrated airport runway with educational elements"
          className="h-full w-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
      </div>

      <div className="container relative z-10 grid items-center gap-12 py-20 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="space-y-6"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-accent-soft px-4 py-1.5 text-sm font-semibold text-primary">
            🎓 Meet ClassMode — your school's AI co-pilot
          </span>
          <h1 className="text-5xl font-extrabold leading-[1.08] tracking-tight md:text-6xl lg:text-7xl">
            Every student <br />
            <span className="text-primary">deserves to thrive.</span>
            <br />
            ClassMode makes it happen.
          </h1>
          <p className="max-w-lg text-lg leading-relaxed text-muted-foreground md:text-xl">
            AI tutoring, live classes, smart grading, and real-time insights — all in one warm,
            friendly platform every school can love.
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            <Button
              size="lg"
              className="rounded-full bg-primary px-8 font-heading text-base text-primary-foreground shadow-xp hover:bg-primary/90"
              onClick={() => setLocation("/login")}
            >
              Get Started Free
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="sketch-border sketch-shadow hover-tilt rounded-full bg-card px-8 font-heading text-base"
            >
              See How It Works
            </Button>
          </div>
        </motion.div>

        {/* Floating element removed as per user request */}
      </div>
    </section>
  );
};
