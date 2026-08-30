import { useEffect, useState } from "react";
import confetti from "@/lib/confetti";
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
    <div className="flex min-h-[400px] w-full flex-col items-center justify-center">
      <motion.h1
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", bounce: 0.5 }}
        className="mb-6 text-center text-4xl font-bold text-gray-900 dark:text-white"
      >
        You're all set!
      </motion.h1>

      {showSummary && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="mx-auto w-full max-w-md rounded-xl border border-gray-100 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="mb-8 space-y-4 text-left">
            <h3 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
              {summary.name}
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-300">
              <div>
                <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-400">
                  City
                </span>
                {summary.city || "-"}
              </div>
              <div>
                <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-400">
                  Size
                </span>
                {summary.approximateStudents} students
              </div>
              <div>
                <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-400">
                  Board
                </span>
                {summary.board}
              </div>
              <div>
                <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-400">
                  Grades
                </span>
                {summary.grades.length > 0 ? summary.grades.join(", ") : "-"}
              </div>
            </div>
            {summary.subjects.length > 0 && (
              <div>
                <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-400">
                  Subjects
                </span>
                <div className="flex flex-wrap gap-2">
                  {summary.subjects.map((s) => (
                    <span
                      key={s}
                      className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mb-6 rounded-lg border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 dark:border-blue-800/50 dark:from-blue-900/20 dark:to-indigo-900/20">
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
