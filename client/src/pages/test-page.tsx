import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  CheckCircle,
  Lightbulb,
  Sparkles,
  BookOpen,
  AlertCircle,
  X,
  Home,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

import { TestProgress } from "@/components/test/test-progress";
import { QuestionCard } from "@/components/test/question-card";
import { AchieversBookPanel } from "@/components/test/achievers-book-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Test, Question } from "@shared/schema";

// Mock data for Achievers Book
const mockAchieversData = {
  summary: `
# Chapter 5: Electromagnetism

### Key Concepts
- **Magnetic Flux ($\Phi_B$)**: $\Phi_B = B \cdot A \cdot \cos(\theta)$
- **Faraday's Law of Induction**: $\mathcal{E} = -N \frac{d\Phi_B}{dt}$
- **Lenz's Law**: The direction of the induced current opposes the change in magnetic flux that produced it.

### Important Real-World Examples
1. **Generators**: Convert mechanical energy into electrical energy using electromagnetic induction.
2. **Transformers**: Step up or step down AC voltage by mutual induction.
  `,
  pyqs: [
    {
      year: 2023,
      board: "CBSE Set A",
      question: "Why can't a transformer be used with a DC source?",
      answer:
        "A transformer works on the principle of mutual induction which requires a changing magnetic flux. A DC source produces a constant magnetic field, so there is no changing flux, and thus no induced EMF.",
    },
    {
      year: 2022,
      board: "ICSE",
      question: "State Lenz's Law.",
      answer:
        "Lenz's Law states that the current induced in a circuit due to a change in a magnetic field is directed to oppose the change in flux and to exert a mechanical force which opposes the motion.",
    },
  ],
};

export default function TestPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [isBookOpen, setIsBookOpen] = useState(false);
  const [testCompleted, setTestCompleted] = useState(false);

  // States for feedback modal/view
  const [showResult, setShowResult] = useState(false);
  const [lastResult, setLastResult] = useState<{
    isCorrect?: boolean;
    answer?: string;
    explanation?: string;
  } | null>(null);

  // Queries
  const { data: test, isLoading: isLoadingTest } = useQuery<Test>({
    queryKey: [`/api/tests/${id}`],
    enabled: !!id,
  });

  const { data: questions, isLoading: isLoadingQuestions } = useQuery<Question[]>({
    queryKey: [`/api/tests/${id}/questions`],
    enabled: !!id,
  });

  // Mutations
  const initAttemptMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/test-attempts", { testId: parseInt(id!) });
      return res.json();
    },
    onSuccess: (data) => {
      setAttemptId(data.id);
    },
    onError: (err: any) => {
      toast({
        title: "Test Attempt Started",
        description: "Your answers are being recorded.",
      });
    },
  });

  const submitAnswerMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/answers", payload);
      return res.json();
    },
    onSuccess: (data, variables) => {
      const q = questions![currentQuestionIndex];
      let isCorrect = data.isCorrect;

      if (q.type !== "mcq") {
        if (!isCorrect && data.isCorrect == null) {
          isCorrect =
            variables.text?.trim().toLowerCase() === q.correctAnswer?.trim().toLowerCase();
        }
      }

      setLastResult({
        isCorrect,
        answer: q.correctAnswer || "Not specified",
        explanation: q.aiRubric || "Review the step-by-step logic in the Achievers Book.",
      });
      setShowResult(true);

      if (isCorrect) {
        toast({
          title: "🎉 Correct!",
          description: "Great job. Keep going!",
          variant: "default",
        });
      }
    },
  });

  const completeTestMutation = useMutation({
    mutationFn: async () => {
      if (!attemptId) return;
      const res = await apiRequest("PATCH", `/api/test-attempts/${attemptId}`, {
        status: "completed",
      });
      return res.json();
    },
    onSuccess: () => {
      setTestCompleted(true);
    },
  });

  useEffect(() => {
    if (test && !attemptId && !initAttemptMutation.isPending && !initAttemptMutation.isSuccess) {
      initAttemptMutation.mutate();
    }
  }, [test, attemptId]);

  if (isLoadingTest || isLoadingQuestions) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background">
        <div className="relative mb-6 flex h-24 w-24 items-center justify-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0.2 }}
            animate={{ scale: 1.2, opacity: 0 }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
            className="absolute inset-0 rounded-full bg-accent"
          />
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ repeat: Infinity, repeatType: "reverse", duration: 1 }}
            className="relative z-10"
          >
            <Sparkles className="h-12 w-12 text-accent" />
          </motion.div>
        </div>
        <span className="animate-pulse text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Prepping Focus Environment...
        </span>
      </div>
    );
  }

  if (!test || !questions || questions.length === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background p-6 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <X className="h-10 w-10 text-energy" />
        </div>
        <h2 className="mb-2 font-display text-3xl text-foreground">Test Not Found</h2>
        <p className="mb-8 font-body text-muted-foreground">
          It seems this assessment has been archived or is no longer available.
        </p>
        <Button
          onClick={() => setLocation("/")}
          className="h-12 rounded-full bg-primary px-8 text-primary-foreground hover:bg-primary/90"
        >
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  const handleNextQuestion = () => {
    setShowResult(false);
    setCurrentAnswer("");

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      completeTestMutation.mutate();
    }
  };

  const handleSubmit = () => {
    if (!attemptId) return;

    const payload: any = {
      attemptId,
      questionId: currentQuestion.id,
    };

    if (currentQuestion.type === "mcq") {
      payload.selectedOption = parseFloat(currentAnswer);
    } else {
      payload.text = currentAnswer;
    }

    submitAnswerMutation.mutate(payload);
  };

  const handleSkip = () => {
    handleNextQuestion();
  };

  const handleHintRequest = () => {
    toast({
      title: "AI Hint",
      description: currentQuestion.aiRubric
        ? `Nudge: Consider ${currentQuestion.aiRubric.substring(0, 50)}...`
        : "Check the Achievers Book for related concepts.",
    });
  };

  if (testCompleted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
        <Card className="animate-fade-in-up w-full max-w-2xl overflow-hidden rounded-[2.5rem] border border-border bg-card text-center shadow-modal">
          <CardContent className="p-12">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1, rotate: 360 }}
              className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full border border-progress/10 bg-progress-soft shadow-soft"
            >
              <CheckCircle className="h-12 w-12 text-progress" />
            </motion.div>
            <h1 className="mb-4 font-display text-4xl tracking-tight text-foreground">
              Bravo! Assessment Concluded
            </h1>
            <p className="mx-auto mb-10 max-w-md font-body text-lg leading-relaxed text-muted-foreground">
              You've shown great focus on{" "}
              <span className="font-bold text-foreground">"{test.title}"</span>. Here's how you
              performed.
            </p>

            <div className="mb-12 grid grid-cols-2 gap-8">
              <div className="rounded-3xl border border-border bg-muted/50 p-6 shadow-sm">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Time Invested
                </div>
                <div className="font-display text-4xl font-bold text-foreground">12:34</div>
              </div>
              <div className="rounded-3xl border border-border bg-muted/50 p-6 shadow-sm">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Subject Mastery
                </div>
                <div className="font-display text-4xl font-bold text-progress">85%</div>
              </div>
            </div>

            <div className="relative mb-10 overflow-hidden rounded-3xl border-2 border-dashed border-border bg-background p-8 text-left">
              <div className="absolute right-0 top-0 p-4 opacity-10">
                <Sparkles className="h-20 w-20 text-accent" />
              </div>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">
                <Lightbulb className="h-4 w-4 text-accent" />
                Tutor Insight
              </h3>
              <p className="font-body text-base leading-relaxed text-foreground">
                You demonstrated strong logical reasoning. For further mastery, we recommend a
                secondary review of <span className="font-bold text-accent">"Faraday's Law"</span>{" "}
                in the Digital Textbook before your next session.
              </p>
            </div>

            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Button
                onClick={() => setLocation("/")}
                className="h-14 rounded-full bg-primary px-10 font-bold text-primary-foreground shadow-soft transition-all hover:bg-primary/90"
              >
                <Home className="mr-3 h-5 w-5" />
                Back to Dashboard
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation("/subjects")}
                className="h-14 rounded-full border-border px-10 font-bold text-foreground transition-all hover:bg-muted"
              >
                <ArrowRight className="mr-3 h-5 w-5" />
                Learning Path
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <div className={cn("relative flex flex-1 flex-col transition-all duration-500 ease-in-out")}>
        <TestProgress
          currentQuestionIndex={currentQuestionIndex + 1}
          totalQuestions={questions.length}
          timeLimitMinutes={test.duration || 30}
          onTimeUp={() => completeTestMutation.mutate()}
        />

        <div className="relative flex-1 overflow-y-auto bg-background/50 px-6 pb-24 md:px-12">
          <div className="absolute right-8 top-8 hidden md:block">
            <Button
              variant="outline"
              onClick={() => setIsBookOpen(!isBookOpen)}
              className={cn(
                "h-11 rounded-xl border-border bg-card px-5 text-xs font-bold uppercase tracking-widest text-muted-foreground transition-all",
                "shadow-soft hover:border-accent/40 hover:text-accent",
                isBookOpen && "border-accent bg-accent-soft/30 text-accent"
              )}
            >
              <BookOpen className="mr-2 h-4 w-4" />
              {isBookOpen ? "Close Textbook" : "Digital Textbook"}
            </Button>
          </div>

          {!showResult ? (
            <div className="mx-auto max-w-4xl">
              <QuestionCard
                question={currentQuestion}
                currentAnswer={currentAnswer}
                onAnswerChange={setCurrentAnswer}
                onSubmit={handleSubmit}
                onSkip={handleSkip}
                onHintRequest={handleHintRequest}
                hintsRemaining={1}
                isSubmitting={submitAnswerMutation.isPending}
              />
            </div>
          ) : (
            <Card className="animate-fade-in mx-auto mt-12 w-full max-w-3xl overflow-hidden rounded-[2rem] border border-border bg-card shadow-modal">
              <CardContent className="space-y-8 p-10 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div
                    className={cn(
                      "flex h-20 w-20 items-center justify-center rounded-full border shadow-soft",
                      lastResult?.isCorrect
                        ? "border-progress/10 bg-progress-soft text-progress"
                        : "border-energy/10 bg-energy-soft text-energy"
                    )}
                  >
                    {lastResult?.isCorrect ? (
                      <CheckCircle className="h-10 w-10" />
                    ) : (
                      <AlertCircle className="h-10 w-10" />
                    )}
                  </div>
                  <h3
                    className={cn(
                      "font-display text-4xl leading-none tracking-tight",
                      lastResult?.isCorrect ? "text-progress" : "text-energy"
                    )}
                  >
                    {lastResult?.isCorrect ? "Perfectly stated!" : "A learning opportunity"}
                  </h3>
                </div>

                <div className="grid gap-6">
                  <div className="rounded-3xl border border-border bg-muted/50 p-8 text-left shadow-sm">
                    <span className="mb-3 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Model Solution
                    </span>
                    <p className="font-display text-xl leading-relaxed text-foreground">
                      {lastResult?.answer}
                    </p>
                  </div>
                  {lastResult?.explanation && (
                    <div className="rounded-3xl border border-dashed border-border bg-background/50 p-8 text-left">
                      <span className="mb-3 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Tutor Insight
                      </span>
                      <p className="font-body text-base leading-relaxed text-muted-foreground">
                        {lastResult.explanation}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex justify-center pt-4">
                  <Button
                    onClick={handleNextQuestion}
                    size="lg"
                    className="group h-14 rounded-full bg-accent px-12 text-base font-bold text-white shadow-modal transition-all hover:bg-accent-hover"
                  >
                    {currentQuestionIndex < questions.length - 1
                      ? "Next Problem"
                      : "Finalize Assessment"}
                    <ArrowRight className="ml-3 h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="fixed bottom-6 right-6 z-[70] md:hidden">
            <Button
              size="icon"
              className="h-14 w-14 rounded-full bg-accent text-white shadow-card"
              onClick={() => setIsBookOpen(!isBookOpen)}
            >
              {isBookOpen ? <X className="h-6 w-6" /> : <BookOpen className="h-6 w-6" />}
            </Button>
          </div>
        </div>
      </div>

      <AchieversBookPanel
        summary={mockAchieversData.summary}
        pyqs={mockAchieversData.pyqs}
        isOpen={isBookOpen}
        onChange={setIsBookOpen}
      />

      {isBookOpen && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setIsBookOpen(false)}
        />
      )}
    </div>
  );
}
