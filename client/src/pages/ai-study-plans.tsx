import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Loader2,
  Calendar,
  Clock,
  CheckCircle2,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StudyTask {
  task: string;
  duration: string;
}

interface StudyDay {
  day: number;
  title: string;
  tasks: StudyTask[];
}

interface StudyPlan {
  days: StudyDay[];
}

interface WeakSubject {
  subject: string;
  avgScore: number;
}

export default function AiStudyPlans() {
  const { toast } = useToast();
  const [plan, setPlan] = useState<StudyPlan | null>(null);

  const { data: weakSubjects = [], isLoading: isLoadingWeak } = useQuery<WeakSubject[]>({
    queryKey: ["/api/student/weak-subjects"],
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/ai/study-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weakSubjects }),
      });
      if (!response.ok) throw new Error("Failed to generate plan");
      return response.json();
    },
    onSuccess: (data) => {
      setPlan(data);
      toast({ title: "Study Plan Generated", description: "Your 7-day plan is ready." });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate study plan. Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader
        title="Personalized Study Plan"
        subtitle="AI-generated revision paths focused on your improvement areas."
      >
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending || isLoadingWeak}
          className="h-11 rounded-full bg-accent px-8 text-[10px] font-bold uppercase tracking-widest text-white shadow-card hover:bg-accent-hover"
        >
          {generateMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating Plan...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" /> Generate 7-Day Plan
            </>
          )}
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Sidebar: Weak Subjects */}
        <div className="space-y-6">
          <Card className="border-border bg-card shadow-soft">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                Target Areas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {weakSubjects.length > 0 ? (
                <div className="space-y-3">
                  {weakSubjects.map((s: any) => (
                    <div
                      key={s.subject}
                      className="flex items-center justify-between rounded-xl border border-amber-500/10 bg-amber-500/5 p-3"
                    >
                      <span className="text-sm font-semibold text-foreground">{s.subject}</span>
                      <Badge
                        variant="outline"
                        className="border-amber-200 bg-background text-amber-600"
                      >
                        Avg: {Math.round(s.avgScore)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center">
                  <div className="mx-auto mb-3 w-fit rounded-full bg-emerald-500/10 p-3 text-emerald-600">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">You're doing great!</p>
                  <p className="mt-1 px-4 text-xs text-muted-foreground">
                    All your subjects are above 60% average.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content: The Plan */}
        <div className="lg:col-span-2">
          {!plan ? (
            <div className="flex h-full min-h-[400px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border bg-muted/30 p-12 text-center">
              <div className="mb-6 rounded-full bg-background p-5 shadow-soft">
                <Calendar className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-foreground">Ready to start?</h3>
              <p className="mx-auto mb-8 max-w-sm text-sm text-muted-foreground">
                Click generate to create a focused revision schedule based on your recent test
                performance.
              </p>
              <Button
                variant="outline"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="rounded-full px-8 text-[10px] font-bold uppercase tracking-widest"
              >
                Create My Plan
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {plan.days.map((day) => (
                <Card
                  key={day.day}
                  className="group overflow-hidden border-border bg-card shadow-soft transition-all duration-300 hover:shadow-md"
                >
                  <div className="flex flex-col md:flex-row">
                    <div className="flex flex-col items-center justify-center border-b border-border bg-muted/50 p-6 md:w-32 md:border-b-0 md:border-r">
                      <span className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                        Day
                      </span>
                      <span className="font-display text-4xl leading-none text-accent">
                        {day.day}
                      </span>
                    </div>
                    <div className="flex-1 p-6">
                      <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
                        {day.title}
                        <ChevronRight className="h-4 w-4 text-muted-foreground/30" />
                      </h3>
                      <div className="grid gap-3">
                        {day.tasks.map((task, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-4 rounded-xl border border-border/60 bg-background p-3 transition-colors group-hover:border-accent/20"
                          >
                            <div className="rounded-lg bg-accent-soft p-2 text-accent">
                              <Clock className="h-3.5 w-3.5" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-foreground">{task.task}</p>
                            </div>
                            <Badge
                              variant="default"
                              className="bg-muted text-[9px] font-bold uppercase tracking-widest text-muted-foreground"
                            >
                              {task.duration}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
