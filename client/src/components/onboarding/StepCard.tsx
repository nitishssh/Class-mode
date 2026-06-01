import { motion } from "framer-motion";
import { ReactNode } from "react";

export function StepCard({ children, onBack }: { children: ReactNode; onBack?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -50 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="mx-auto w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800 sm:p-8"
    >
      {onBack && (
        <button
          onClick={onBack}
          className="mb-6 flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          ← Back
        </button>
      )}
      {children}
    </motion.div>
  );
}
