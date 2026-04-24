import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TestDetailsForm } from "@/components/test/test-details-form";
import { QuestionForm } from "@/components/test/question-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileQuestion, CircleCheck, Settings2, Brain, Rocket } from "lucide-react";

/**
 * Multi-step test creation wizard. Manages tabs for:
 * 1. Test Details
 * 2. Add Questions
 * 3. Settings & Review (Coming Soon)
 */
export default function CreateTest() {
  const [activeTab, setActiveTab] = useState("test-details");
  const [testId, setTestId] = useState<number | null>(null);
  const [questionOrder, setQuestionOrder] = useState(1);

  const handleTestCreated = (id: number) => {
    setTestId(id);
    setActiveTab("add-questions");
  };

  const handleQuestionAdded = () => {
    setQuestionOrder((prev) => prev + 1);
  };

  const steps = [
    {
      key: "test-details",
      label: "Test Details",
      icon: <FileQuestion className="h-4 w-4" />,
      unlocked: true,
    },
    {
      key: "add-questions",
      label: "Add Questions",
      icon: <Brain className="h-4 w-4" />,
      unlocked: !!testId,
    },
    {
      key: "review",
      label: "Review & Publish",
      icon: <Settings2 className="h-4 w-4" />,
      unlocked: !!testId,
    },
  ];

  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5 text-white shadow-md">
            <FileQuestion className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Create a New Test</h1>
            <p className="text-sm text-muted-foreground">
              Design a custom assessment with AI-powered evaluation
            </p>
          </div>
        </div>
      </div>

      {/* Visual step indicator */}
      <div className="mb-6 flex items-center gap-2">
        {steps.map((step, i) => (
          <div key={step.key} className="flex flex-1 items-center gap-2 last:flex-none">
            <button
              onClick={() => step.unlocked && setActiveTab(step.key)}
              disabled={!step.unlocked}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all ${
                activeTab === step.key
                  ? "border-primary bg-primary text-primary-foreground shadow-md"
                  : step.unlocked
                    ? "cursor-pointer border-border bg-card text-foreground/80 hover:bg-muted"
                    : "cursor-not-allowed border-border/40 bg-muted/40 text-muted-foreground opacity-60"
              }`}
            >
              {step.icon}
              <span className="hidden sm:block">{step.label}</span>
            </button>
            {i < steps.length - 1 && (
              <div
                className={`h-px flex-1 ${testId && i === 0 ? "bg-primary/50" : "bg-border/40"}`}
              />
            )}
          </div>
        ))}
      </div>

      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Hidden tab triggers (steps above serve as visual triggers) */}
          <TabsList className="hidden">
            <TabsTrigger value="test-details">Test Details</TabsTrigger>
            <TabsTrigger value="add-questions">Add Questions</TabsTrigger>
            <TabsTrigger value="review">Review</TabsTrigger>
          </TabsList>

          <CardContent className="p-6">
            <TabsContent value="test-details" className="mt-0">
              <TestDetailsForm />
            </TabsContent>

            <TabsContent value="add-questions" className="mt-0">
              {testId ? (
                <div className="space-y-6">
                  <div>
                    <h2 className="mb-1 text-lg font-semibold">Add Questions to Your Test</h2>
                    <p className="mb-6 text-sm text-muted-foreground">
                      Create various types of questions to assess different skills
                    </p>
                  </div>
                  <QuestionForm
                    testId={testId}
                    order={questionOrder}
                    onSuccess={handleQuestionAdded}
                  />
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-muted-foreground">Please complete test details first</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="review" className="mt-0">
              {/* Premium Coming Soon for review tab */}
              <div className="flex flex-col items-center justify-center gap-5 py-16 text-center">
                <div className="relative">
                  <div className="absolute inset-0 scale-110 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 opacity-10 blur-2xl" />
                  <div className="relative rounded-3xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 p-6">
                    <Rocket className="h-10 w-10 text-blue-500" />
                  </div>
                </div>
                <div>
                  <Badge className="mb-3 border-amber-500/20 bg-amber-500/10 font-semibold text-amber-600 dark:text-amber-400">
                    🚀 Coming Soon
                  </Badge>
                  <h3 className="mb-2 text-xl font-bold">Review & Publish Test</h3>
                  <p className="mx-auto max-w-xs text-sm text-muted-foreground">
                    A full test review interface with preview mode, rubric editor, and one-click
                    publishing is on the way.
                  </p>
                </div>
                <div className="mt-2 grid w-full max-w-sm grid-cols-3 gap-3">
                  {["Preview Mode", "Rubric Editor", "One-Click Publish"].map((f) => (
                    <div
                      key={f}
                      className="rounded-xl border border-border/60 bg-card/60 px-3 py-3 text-center"
                    >
                      <CircleCheck className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                      <p className="text-xs font-medium text-muted-foreground">{f}</p>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </>
  );
}
