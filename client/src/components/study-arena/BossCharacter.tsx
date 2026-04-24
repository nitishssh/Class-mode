import { motion } from "framer-motion";

interface BossCharacterProps {
  name: string;
  maxHealth: number;
  currentHealth: number;
  isTakingDamage?: boolean;
}

export function BossCharacter({
  name,
  maxHealth,
  currentHealth,
  isTakingDamage,
}: BossCharacterProps) {
  const healthPercentage = Math.max(0, (currentHealth / maxHealth) * 100);

  // Color changes from indigo to red as health drops
  const healthColor =
    healthPercentage > 50
      ? "bg-indigo-500"
      : healthPercentage > 25
        ? "bg-amber-500"
        : "bg-rose-500";

  return (
    <div className="relative z-10 mx-auto flex w-full max-w-sm flex-col items-center justify-center p-4">
      {/* Title & Health Bar */}
      <div className="mb-8 flex w-full flex-col items-center gap-2">
        <h2 className="bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-2xl font-semibold uppercase tracking-[0.2em] text-transparent drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] md:text-3xl">
          {name}
        </h2>
        <div className="relative h-6 w-full overflow-hidden rounded-full border border-white/10 bg-background/50 shadow-[0_0_15px_rgba(0,0,0,0.5)] backdrop-blur-md">
          <motion.div
            className={`h-full ${healthColor} shadow-[0_0_15px_currentColor]`}
            initial={{ width: "100%" }}
            animate={{ width: `${healthPercentage}%` }}
            transition={{ type: "spring", stiffness: 50, damping: 15 }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-md">
            {currentHealth} / {maxHealth}
          </div>
        </div>
      </div>

      {/* Boss Visual (Abstract Geometric) */}
      <motion.div
        className="relative flex items-center justify-center"
        animate={
          isTakingDamage
            ? {
                x: [0, -10, 10, -10, 10, 0],
                rotate: [0, -5, 5, -5, 5, 0],
                scale: [1, 0.95, 1],
                filter: [
                  "drop-shadow(0 0 20px rgba(79,70,229,0.4))",
                  "drop-shadow(0 0 40px rgba(225,29,72,0.8))",
                  "drop-shadow(0 0 20px rgba(79,70,229,0.4))",
                ],
              }
            : {
                y: [-10, 10, -10], // Floating animation
                filter: [
                  "drop-shadow(0 0 20px rgba(255,255,255,0.1))",
                  "drop-shadow(0 0 30px rgba(79,70,229,0.3))", // Indigo glow
                  "drop-shadow(0 0 20px rgba(255,255,255,0.1))",
                ],
              }
        }
        transition={
          isTakingDamage
            ? { duration: 0.5 }
            : {
                y: {
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                },
                filter: {
                  duration: 3,
                  repeat: Infinity,
                  ease: "linear",
                },
              }
        }
      >
        {/* Central Core */}
        <div className="relative flex h-48 w-48 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-indigo-500/10 via-zinc-800/20 to-transparent shadow-[inset_0_0_40px_rgba(0,0,0,0.5)] md:h-64 md:w-64">
          {/* Inner pulsating elements */}
          <motion.div
            className="absolute inset-4 rounded-full border border-indigo-400/20"
            animate={{ rotate: 360, scale: [1, 1.05, 1] }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute inset-8 rounded-full border border-dashed border-white/5"
            animate={{ rotate: -360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          />
          {/* The eye/center */}
          <motion.div
            className="h-16 w-16 rounded-full border border-white bg-zinc-200 shadow-[0_0_30px_rgba(255,255,255,0.8)]"
            animate={
              isTakingDamage
                ? { scale: [1, 1.5, 1], backgroundColor: ["#e4e4e7", "#e11d48", "#e4e4e7"] }
                : {
                    scale: [1, 1.1, 1],
                  }
            }
            transition={isTakingDamage ? { duration: 0.3 } : { duration: 2, repeat: Infinity }}
          />
        </div>
      </motion.div>
    </div>
  );
}
