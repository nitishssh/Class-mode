import { motion } from "framer-motion";

export function ProgressBar({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  const progress = (currentStep / totalSteps) * 100;
  return (
    <div className="w-full bg-gray-200 rounded-full h-2 mb-4 dark:bg-gray-700">
      <motion.div
        className="bg-blue-600 h-2 rounded-full dark:bg-blue-500"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.4, type: "spring", bounce: 0.2 }}
      />
    </div>
  );
}
