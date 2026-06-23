import { motion } from "framer-motion";
import { ReactNode } from "react";

export function StepCard({ children }: { children: ReactNode; onBack?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="w-full flex-1 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-8 lg:p-10"
    >
      {children}
    </motion.div>
  );
}
