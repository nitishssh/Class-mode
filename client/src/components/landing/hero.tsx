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
          <span className="sketch-border sketch-shadow inline-block bg-card px-4 py-1.5 text-sm font-medium text-foreground">
            ✨ Ready for a smooth learning journey?
          </span>
          <h1 className="text-5xl font-extrabold leading-[1.08] tracking-tight md:text-6xl lg:text-7xl">
            Stop studying <br />
            <span className="italic text-primary">by accident.</span>
            <br />
            Start learning by design.
          </h1>
          <p className="max-w-lg text-lg leading-relaxed text-muted-foreground md:text-xl">
            The first AI co-pilot that maps your curriculum, clears the noise, and navigates you to
            mastery—day by day.
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            <Button
              size="lg"
              className="sketch-border sketch-shadow-yellow hover-tilt rounded-full bg-primary px-8 font-heading text-base text-primary-foreground hover:bg-primary/90"
              onClick={() => setLocation("/login")}
            >
              Start My Learning Plan
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
