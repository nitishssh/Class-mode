import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Sparkles,
  Brain,
  Presentation,
  History,
  ExternalLink,
  Play,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";

interface ClassroomRecord {
  id?: number;
  studyArenaJobId?: string;
  classroomId?: string;
  topic?: string;
  status: "pending" | "generating" | "ready" | "error";
  url?: string;
  createdAt?: string;
}

interface JobStatus {
  jobId: string;
  status: "pending" | "running" | "succeeded" | "failed";
  step?: string;
  progress?: number;
  message?: string;
  scenesGenerated?: number;
  totalScenes?: number;
  done: boolean;
  result?: { classroomId?: string; url?: string };
  error?: string;
}

export default function AIClassroom() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [topic, setTopic] = useState("");
  const [sceneType, setSceneType] = useState<"slides" | "quiz" | "simulation" | "pbl">("slides");
  const [activeClassroomUrl, setActiveClassroomUrl] = useState<string | null>(null);

  // ── Polling state ──────────────────────────────────────────────────────────
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Tracks consecutive fetch failures; polling stops after 10 (≈ 50 s of silence).
  const pollErrorCount = useRef(0);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setActiveJobId(null);
    pollErrorCount.current = 0;
  }, []);

  const startPolling = useCallback(
    (jobId: string) => {
      setActiveJobId(jobId);
      setJobStatus({ jobId, status: "pending", done: false, step: "Queued" });
      pollErrorCount.current = 0;

      // Clear any existing poll
      if (pollingRef.current) clearInterval(pollingRef.current);

      const poll = async () => {
        try {
          const res = await fetch(`/api/ai-classroom/job/${jobId}`);
          if (!res.ok) throw new Error(`Poll returned ${res.status}`);
          const data: JobStatus = await res.json();
          pollErrorCount.current = 0;
          setJobStatus(data);

          if (data.done) {
            stopPolling();
            queryClient.invalidateQueries({ queryKey: ["ai-classroom-history"] });

            if (data.status === "succeeded") {
              toast({
                title: "Classroom Ready!",
                description: "Your AI classroom has been generated successfully.",
              });

              const historyRes = await fetch("/api/ai-classroom/my-classrooms");
              if (historyRes.ok) {
                const classrooms: ClassroomRecord[] = await historyRes.json();
                const match = classrooms.find((c) => c.studyArenaJobId === jobId);
                if (match?.url) {
                  setActiveClassroomUrl(match.url);
                }
              }
            } else {
              toast({
                title: "Generation Failed",
                description: data.error || "Classroom generation encountered an error.",
                variant: "destructive",
              });
            }
          }
        } catch {
          pollErrorCount.current += 1;
          if (pollErrorCount.current >= 10) {
            stopPolling();
            setJobStatus((prev) =>
              prev ? { ...prev, done: true, status: "failed", error: "Lost contact with generation service." } : prev
            );
            toast({
              title: "Connection Lost",
              description: "Could not reach the generation service. Please refresh and try again.",
              variant: "destructive",
            });
          }
        }
      };

      // First poll immediately, then every 5 seconds
      poll();
      pollingRef.current = setInterval(poll, 5000);
    },
    [queryClient, stopPolling, toast],
  );

  // Check if Study Arena is available
  const { data: healthStatus } = useQuery({
    queryKey: ["ai-classroom-health"],
    queryFn: async () => {
      const res = await fetch("/api/ai-classroom/health");
      return res.json();
    },
    refetchInterval: 30000,
  });

  // Fetch classroom history
  const { data: history } = useQuery<ClassroomRecord[]>({
    queryKey: ["ai-classroom-history"],
    queryFn: async () => {
      const res = await fetch("/api/ai-classroom/my-classrooms");
      if (!res.ok) throw new Error("Failed to fetch history");
      return res.json();
    },
    enabled: !!healthStatus?.available,
  });

  const createClassroomMutation = useMutation({
    mutationFn: async (data: { topic: string; sceneTypes: string[] }) => {
      const res = await fetch("/api/ai-classroom/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create classroom");
      return res.json();
    },
    onSuccess: (data: { id: number; jobId: string; status: string }) => {
      toast({
        title: "Generation Started",
        description: "Your AI classroom is being generated. This may take a few minutes...",
      });
      queryClient.invalidateQueries({ queryKey: ["ai-classroom-history"] });
      // Start polling for job completion
      startPolling(data.jobId);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create classroom",
        variant: "destructive",
      });
    },
  });

  const handleCreateClassroom = () => {
    if (!topic.trim()) {
      toast({ title: "Error", description: "Please enter a topic", variant: "destructive" });
      return;
    }
    createClassroomMutation.mutate({
      topic: topic.trim(),
      sceneTypes: [sceneType],
    });
  };

  if (!healthStatus?.available) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-6 w-6" />
              AI Classroom
            </CardTitle>
            <CardDescription>Multi-agent interactive learning experiences</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="py-8 text-center">
              <Brain className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">AI Classroom Not Available</h3>
              <p className="mb-4 text-muted-foreground">
                The Study Arena service is not configured or not running.
              </p>
              <p className="text-sm text-muted-foreground">
                To enable this feature, start the Study Arena infrastructure and configure
                STUDY_ARENA_URL.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If a classroom is active, render it in an iframe
  if (activeClassroomUrl) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col bg-background">
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Live AI Classroom</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={activeClassroomUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Fullscreen
              </a>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setActiveClassroomUrl(null)}>
              Close
            </Button>
          </div>
        </div>
        <div className="w-full flex-1 bg-muted/20">
          <iframe
            src={activeClassroomUrl}
            className="h-full w-full border-0"
            allow="microphone; camera; display-capture"
            title="Study Arena AI Classroom"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <Sparkles className="h-8 w-8" />
            AI Classroom
          </h1>
          <p className="mt-1 text-muted-foreground">
            Create interactive learning experiences with AI teachers and agents
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Presentation className="h-5 w-5" />
                Create Classroom
              </CardTitle>
              <CardDescription>
                Generate a full AI classroom with slides, quizzes, and interactive content
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="topic">Topic</Label>
                <Input
                  id="topic"
                  placeholder="e.g., Quantum Physics, Machine Learning, Ancient Rome"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  disabled={!!activeJobId}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sceneType">Scene Type</Label>
                <Select
                  value={sceneType}
                  onValueChange={(v: "slides" | "quiz" | "simulation" | "pbl") => setSceneType(v)}
                  disabled={!!activeJobId}
                >
                  <SelectTrigger id="sceneType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slides">Slides</SelectItem>
                    <SelectItem value="quiz">Quiz</SelectItem>
                    <SelectItem value="simulation">Interactive Simulation</SelectItem>
                    <SelectItem value="pbl">Project-Based Learning</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Generation Progress */}
              {activeJobId && jobStatus && (
                <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-sm font-medium">
                      {jobStatus.step || "Generating..."}
                    </span>
                  </div>
                  {jobStatus.totalScenes && jobStatus.totalScenes > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          Scenes: {jobStatus.scenesGenerated || 0} / {jobStatus.totalScenes}
                        </span>
                        <span>
                          {Math.round(
                            ((jobStatus.scenesGenerated || 0) / jobStatus.totalScenes) * 100,
                          )}
                          %
                        </span>
                      </div>
                      <Progress
                        value={
                          ((jobStatus.scenesGenerated || 0) / jobStatus.totalScenes) * 100
                        }
                      />
                    </div>
                  )}
                  {jobStatus.message && (
                    <p className="text-xs text-muted-foreground">{jobStatus.message}</p>
                  )}
                </div>
              )}

              <Button
                onClick={handleCreateClassroom}
                disabled={createClassroomMutation.isPending || !!activeJobId}
                className="w-full"
              >
                {createClassroomMutation.isPending || activeJobId ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {activeJobId ? "Generating..." : "Submitting..."}
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Create Classroom
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* History Column */}
        <Card className="flex h-full max-h-[600px] flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              My Classrooms
            </CardTitle>
            <CardDescription>Recent sessions you&apos;ve generated</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-[480px] px-6">
              {!history || history.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <p>No classrooms generated yet.</p>
                </div>
              ) : (
                <div className="space-y-4 pb-6">
                  {history.map((classroom) => (
                    <div
                      key={classroom.id}
                      className="flex flex-col gap-3 rounded-lg border bg-card/50 p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium capitalize">
                            {classroom.topic || "Untitled Session"}
                          </h4>
                          <span className="text-xs text-muted-foreground">
                            {classroom.classroomId
                              ? `ID: ${classroom.classroomId}`
                              : classroom.studyArenaJobId
                                ? `Job: ${classroom.studyArenaJobId}`
                                : ""}{" "}
                            • {new Date(classroom.createdAt!).toLocaleDateString()}
                          </span>
                        </div>
                        <div
                          className={`rounded px-2 py-1 text-xs font-medium ${
                            classroom.status === "ready"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : classroom.status === "error"
                                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                          }`}
                        >
                          {classroom.status}
                        </div>
                      </div>

                      {classroom.url && (
                        <Button
                          size="sm"
                          className="w-full"
                          variant="secondary"
                          onClick={() => setActiveClassroomUrl(classroom.url!)}
                        >
                          <Play className="mr-2 h-4 w-4" />
                          Join Classroom
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
