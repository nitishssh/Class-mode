import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { X, Share2 } from "lucide-react";
import confetti from "canvas-confetti";

interface Badge {
  name: string;
  emoji: string;
  description: string;
}

interface BadgePopProps {
  badge: Badge | null;
  isOpen: boolean;
  onClose: () => void;
}

export const BadgePop: React.FC<BadgePopProps> = ({ badge, isOpen, onClose }) => {
  React.useEffect(() => {
    if (isOpen && badge) {
      // Trigger confetti burst
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(function () {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [isOpen, badge]);

  if (!badge) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 10 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="relative w-full max-w-sm rounded-[2.5rem] border border-white/20 bg-gradient-badge p-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
          >
            <button
              onClick={onClose}
              className="absolute right-6 top-6 rounded-full p-2 transition-colors hover:bg-black/5"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>

            <div className="mb-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
                className="mb-4 text-8xl drop-shadow-lg"
              >
                {badge.emoji}
              </motion.div>
              <h2 className="student-h1 mb-2 text-2xl">New Badge Unlocked!</h2>
              <p className="mb-4 text-3xl font-black text-energy">{badge.name}</p>
              <p className="px-4 font-medium text-muted-foreground">{badge.description}</p>
            </div>

            <div className="mt-8 flex flex-col gap-3">
              <Button
                size="lg"
                className="h-14 rounded-full bg-energy text-lg font-bold text-white shadow-lg hover:bg-energy-dark hover:shadow-energy/20"
              >
                Continue Learning
              </Button>
              <Button
                variant="ghost"
                className="h-12 rounded-full font-bold text-muted-foreground hover:bg-black/5"
              >
                <Share2 className="mr-2 h-5 w-5" />
                Share with Class
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
