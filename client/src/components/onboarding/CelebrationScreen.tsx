import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export interface SummaryData {
  name: string;
  city: string;
  board: string;
  subjects: string[];
  grades: string[];
  approximateStudents: string;
}

export function CelebrationScreen({
  summary,
  onComplete,
}: {
  summary: SummaryData;
  onComplete: () => void;
}) {
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    const duration = 2000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ["#26ccff", "#a25afd", "#ff5e7e", "#88ff5a", "#fcff42", "#ffa62d", "#ff36ff"],
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ["#26ccff", "#a25afd", "#ff5e7e", "#88ff5a", "#fcff42", "#ffa62d", "#ff36ff"],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();

    const timer = setTimeout(() => {
      setShowSummary(true);
    }, 2200);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-[400px]">
      <motion.h1
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", bounce: 0.5 }}
        className="text-4xl font-bold mb-6 text-gray-900 dark:text-white text-center"
      >
        You're all set!
      </motion.h1>

      {showSummary && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg w-full max-w-md mx-auto border border-gray-100 dark:border-gray-700"
        >
          <div className="space-y-4 mb-8 text-left">
            <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              {summary.name}
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-300">
              <div>
                <span className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                  City
                </span>
                {summary.city || "-"}
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                  Size
                </span>
                {summary.approximateStudents} students
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                  Board
                </span>
                {summary.board}
              </div>
              <div>
                <span className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                  Grades
                </span>
                {summary.grades.length > 0 ? summary.grades.join(", ") : "-"}
              </div>
            </div>
            {summary.subjects.length > 0 && (
              <div>
                <span className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                  Subjects
                </span>
                <div className="flex flex-wrap gap-2">
                  {summary.subjects.map((s) => (
                    <span
                      key={s}
                      className="px-2 py-1 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded text-xs font-medium"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-lg mb-6 border border-blue-100 dark:border-blue-800/50">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Your first AI-generated test is free — upload any chapter PDF and get 20 MCQs in 30
              seconds.
            </p>
          </div>

          <Button onClick={onComplete} className="w-full py-6 text-base" size="lg">
            Enter your workspace →
          </Button>
        </motion.div>
      )}
    </div>
  );
}
