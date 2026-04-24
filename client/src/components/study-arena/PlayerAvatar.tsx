import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Zap, Flame, Star, Skull } from "lucide-react";

interface StatusEffect {
  type: "combo" | "fire" | "stunned" | "boosted";
  duration?: number;
  value?: number; // e.g., combo multiplier
}

interface PlayerAvatarProps {
  id: string;
  name: string;
  avatarUrl?: string;
  health: number;
  maxHealth: number;
  score: number;
  isCurrentPlayer?: boolean;
  statusEffects?: StatusEffect[];
  isTakingDamage?: boolean;
}

export function PlayerAvatar({
  name,
  avatarUrl,
  health,
  maxHealth,
  score,
  isCurrentPlayer,
  statusEffects = [],
  isTakingDamage,
}: PlayerAvatarProps) {
  const healthPercentage = Math.max(0, (health / maxHealth) * 100);
  const isDead = health <= 0;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const hasCombo = statusEffects.some((s) => s.type === "combo");
  const comboValue = statusEffects.find((s) => s.type === "combo")?.value;

  return (
    <motion.div
      className={`relative flex flex-col items-center gap-2 ${isDead ? "opacity-50 grayscale" : ""}`}
      animate={
        isTakingDamage
          ? {
              x: [-5, 5, -5, 5, 0],
              y: [2, -2, 2, -2, 0],
            }
          : {}
      }
      transition={{ duration: 0.3 }}
    >
      {/* Status Effects Container */}
      <div className="absolute -top-6 left-1/2 z-20 flex -translate-x-1/2 gap-1">
        <AnimatePresence>
          {statusEffects.map((effect, idx) => (
            <motion.div
              key={effect.type + idx}
              initial={{ scale: 0, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0, opacity: 0 }}
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold shadow-lg"
              style={{
                backgroundColor:
                  effect.type === "combo"
                    ? "#f59e0b"
                    : effect.type === "fire"
                      ? "#ef4444"
                      : effect.type === "boosted"
                        ? "#10b981"
                        : "#6b7280",
                color: "white",
              }}
            >
              {effect.type === "combo" && <Zap className="h-3 w-3" />}
              {effect.type === "fire" && <Flame className="h-3 w-3" />}
              {effect.type === "boosted" && <Star className="h-3 w-3" />}
              {effect.type === "stunned" && <Skull className="h-3 w-3" />}

              {effect.value && `x${effect.value}`}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Avatar */}
      <div
        className={`relative ${isCurrentPlayer ? "rounded-full ring-1 ring-white/50 ring-offset-4 ring-offset-[#0a0a0a]" : ""}`}
      >
        <Avatar
          className={`h-16 w-16 border border-white/10 bg-[#151515] ${hasCombo ? "border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.2)]" : ""}`}
        >
          <AvatarImage src={avatarUrl} alt={name} />
          <AvatarFallback className="bg-[#1a1a1a] text-lg font-medium text-zinc-300">
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>

        {/* Health Bar Overlay/Indicator */}
        <div className="absolute -bottom-1 left-1/2 h-2 w-[120%] -translate-x-1/2 overflow-hidden rounded-full border border-white/10 bg-black/80 backdrop-blur-sm">
          <motion.div
            className={`h-full ${healthPercentage > 30 ? "bg-indigo-500" : "bg-rose-500"}`}
            initial={{ width: "100%" }}
            animate={{ width: `${healthPercentage}%` }}
            transition={{ type: "spring", stiffness: 50 }}
          />
        </div>
      </div>

      {/* Name and Score */}
      <div className="mt-2 text-center">
        <p
          className={`w-20 truncate text-sm tracking-wide ${isCurrentPlayer ? "font-medium text-white" : "text-zinc-500"}`}
        >
          {name}
        </p>
        <p className="font-mono text-[11px] font-medium text-zinc-600">{score} pts</p>
      </div>
    </motion.div>
  );
}
