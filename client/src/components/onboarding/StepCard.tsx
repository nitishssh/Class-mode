import { motion } from "framer-motion";
import { ReactNode } from "react";

export function StepCard({ children, onBack }: { children: ReactNode; onBack?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -50 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 sm:p-8 w-full max-w-md mx-auto"
    >
      {onBack && (
        <button
          onClick={onBack}
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-6 flex items-center"
        >
          ← Back
        </button>
      )}
      {children}
    </motion.div>
  );
}
