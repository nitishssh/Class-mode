import { motion } from "framer-motion";

export function ProgressBar({
  currentStep,
  totalSteps,
}: {
  currentStep: number;
  totalSteps: number;
}) {
  const progress = (currentStep / totalSteps) * 100;
  return (
    <div className="mb-4 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
      <motion.div
        className="h-2 rounded-full bg-blue-600 dark:bg-blue-500"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.4, type: "spring", bounce: 0.2 }}
      />
    </div>
  );
}
