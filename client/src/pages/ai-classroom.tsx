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
  Play,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Users,
  BookOpen,
  ArrowLeft,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ────────────────────────────────────────────────────────────────────

interface ClassroomRecord {
  id?: number;
  studyArenaJobId?: string;
  topic?: string;
  status: "pending" | "generating" | "ready" | "error";
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
  result?: { classroomId?: number };
  error?: string;
}

interface AgentInfo {
  id: string;
  name: string;
  role: string;
  persona?: string;
}

interface GeneratedScene {
  id: string;
  type: string;
  title: string;
  description: string;
  content: any;
  actions: any[];
}

interface ClassroomData {
  id: string;
  topic: string;
  languageDirective: string;
  agents: AgentInfo[];
  scenes: GeneratedScene[];
  createdAt: string;
}

// ── Agent Colors & Avatars ──────────────────────────────────────────────────

const AGENT_COLORS: Record<string, string> = {
  teacher: "bg-blue-500",
  student: "bg-emerald-500",
  assistant: "bg-purple-500",
};

const AGENT_ICONS: Record<string, string> = {
  teacher: "👨‍🏫",
  student: "🧑‍🎓",
  assistant: "🤖",
};

// ── Native Classroom Player ─────────────────────────────────────────────────

function ClassroomPlayer({
  data,
  onClose,
}: {
  data: ClassroomData;
  onClose: () => void;
}) {
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const currentScene = data.scenes[currentSceneIndex];
  const progress = ((currentSceneIndex + 1) / data.scenes.length) * 100;

  const nextScene = () => {
    if (currentSceneIndex < data.scenes.length - 1) {
      setCurrentSceneIndex((prev) => prev + 1);
    }
  };

  const prevScene = () => {
    if (currentSceneIndex > 0) {
      setCurrentSceneIndex((prev) => prev - 1);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600">
              <BookOpen className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold leading-none">{data.topic}</h2>
              <p className="text-xs text-muted-foreground">
                Scene {currentSceneIndex + 1} of {data.scenes.length}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Agent Avatars */}
          <div className="hidden items-center gap-1 md:flex">
            {data.agents.map((agent) => (
              <div
                key={agent.id}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${AGENT_COLORS[agent.role] || "bg-gray-500"}`}
                title={`${agent.name} (${agent.role})`}
              >
                {AGENT_ICONS[agent.role] || "👤"}
              </div>
            ))}
          </div>
          <Badge variant="outline" className="text-xs">
            <Users className="mr-1 h-3 w-3" />
            {data.agents.length} agents
          </Badge>
        </div>
      </div>

      {/* Progress Bar */}
      <Progress value={progress} className="h-1 rounded-none" />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Scene Sidebar */}
        <div className="hidden w-64 flex-shrink-0 border-r bg-muted/20 lg:block">
          <ScrollArea className="h-full p-3">
            <div className="space-y-1.5">
              {data.scenes.map((scene, idx) => (
                <button
                  key={scene.id}
                  onClick={() => setCurrentSceneIndex(idx)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-all ${
                    idx === currentSceneIndex
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : idx < currentSceneIndex
                        ? "bg-muted/50 text-muted-foreground"
                        : "text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-[10px] font-bold">
                    {idx < currentSceneIndex ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <span className="text-xs">{idx + 1}</span>
                    )}
                  </span>
                  <span className="truncate">{scene.title}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Scene Content */}
        <div className="flex flex-1 flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentScene.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex-1 overflow-auto p-6 md:p-10"
            >
              <div className="mx-auto max-w-4xl">
                <div className="mb-6">
                  <Badge variant="outline" className="mb-2">
                    {currentScene.type === "quiz" ? "🧪 Quiz" : "📋 Slide"}
                  </Badge>
                  <h2 className="text-2xl font-bold">{currentScene.title}</h2>
                  <p className="mt-1 text-muted-foreground">{currentScene.description}</p>
                </div>

                {/* Scene Content Renderer */}
                <Card className="border-none shadow-xl">
                  <CardContent className="p-6 md:p-8">
                    {currentScene.type === "quiz" ? (
                      <QuizRenderer content={currentScene.content} />
                    ) : (
                      <SlideRenderer content={currentScene.content} />
                    )}
                  </CardContent>
                </Card>

                {/* Agent Actions */}
                {currentScene.actions && currentScene.actions.length > 0 && (
                  <div className="mt-6 space-y-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                      <Users className="h-4 w-4" />
                      Teaching Actions
                    </h3>
                    {currentScene.actions.slice(0, 5).map((action: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3"
                      >
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs text-white">
                          {action.agentName?.[0] || "T"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-muted-foreground">
                            {action.agentName || "Teacher"} · {action.type || "speak"}
                          </p>
                          <p className="mt-0.5 text-sm">
                            {action.speech || action.text || action.content || JSON.stringify(action)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between border-t px-6 py-3">
            <Button
              variant="outline"
              onClick={prevScene}
              disabled={currentSceneIndex === 0}
              className="gap-2"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>

            <div className="hidden gap-1 sm:flex">
              {data.scenes.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSceneIndex(idx)}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === currentSceneIndex
                      ? "w-6 bg-primary"
                      : idx < currentSceneIndex
                        ? "w-3 bg-primary/40"
                        : "w-3 bg-muted-foreground/20"
                  }`}
                />
              ))}
            </div>

            <Button
              onClick={nextScene}
              disabled={currentSceneIndex === data.scenes.length - 1}
              className="gap-2"
            >
              {currentSceneIndex === data.scenes.length - 1 ? "Finish" : "Next"}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Scene Renderers ─────────────────────────────────────────────────────────

function SlideRenderer({ content }: { content: any }) {
  if (!content) return <p className="text-muted-foreground">No content available.</p>;

  // Handle elements array (PPTist-style from StudyArena)
  if (content.elements && Array.isArray(content.elements)) {
    return (
      <div className="space-y-4">
        {content.elements.map((el: any, idx: number) => {
          if (el.type === "text") {
            return (
              <div key={idx} className="prose dark:prose-invert max-w-none">
                <p>{el.content || el.text || ""}</p>
              </div>
            );
          }
          if (el.type === "image" && el.src) {
            return <img key={idx} src={el.src} alt="" className="max-h-80 rounded-lg" />;
          }
          if (el.type === "shape") {
            return (
              <div
                key={idx}
                className="rounded-lg p-4"
                style={{ backgroundColor: el.fill || "#5b9bd5" }}
              >
                {el.text && <p className="text-white">{el.text}</p>}
              </div>
            );
          }
          return null;
        })}
        {content.remark && (
          <blockquote className="border-l-4 border-primary/30 pl-4 italic text-muted-foreground">
            {content.remark}
          </blockquote>
        )}
      </div>
    );
  }

  // Fallback: render raw content as formatted text
  if (typeof content === "string") {
    return <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap">{content}</div>;
  }

  return (
    <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-4 text-xs">
      {JSON.stringify(content, null, 2)}
    </pre>
  );
}

function QuizRenderer({ content }: { content: any }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);

  const questions = content?.questions || (Array.isArray(content) ? content : []);
  if (questions.length === 0) {
    return <p className="text-muted-foreground">No quiz questions generated.</p>;
  }

  return (
    <div className="space-y-6">
      {questions.map((q: any, idx: number) => (
        <div key={q.id || idx} className="space-y-3 rounded-lg border p-4">
          <p className="font-medium">
            {idx + 1}. {q.question || q.text}
          </p>
          {q.options && (
            <div className="space-y-2">
              {q.options.map((opt: any, oi: number) => {
                const optValue = typeof opt === "string" ? opt : opt.value || opt.label;
                const optLabel = typeof opt === "string" ? opt : opt.label || opt.value;
                const isSelected = answers[q.id || idx] === optValue;
                const isCorrect = showResults && q.answer?.includes(optValue);

                return (
                  <button
                    key={oi}
                    onClick={() =>
                      !showResults &&
                      setAnswers((prev) => ({ ...prev, [q.id || idx]: optValue }))
                    }
                    className={`flex w-full items-center gap-3 rounded-lg border px-4 py-2.5 text-left text-sm transition-all ${
                      showResults
                        ? isCorrect
                          ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                          : isSelected
                            ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                            : ""
                        : isSelected
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border text-xs font-medium ${
                        isSelected ? "border-primary bg-primary text-primary-foreground" : ""
                      }`}
                    >
                      {String.fromCharCode(65 + oi)}
                    </span>
                    {optLabel}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
      <Button
        onClick={() => setShowResults(!showResults)}
        className="w-full"
        variant={showResults ? "outline" : "default"}
      >
        {showResults ? "Hide Answers" : "Check Answers"}
      </Button>
    </div>
  );
}

// ── Main Page Component ─────────────────────────────────────────────────────

export default function AIClassroom() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [topic, setTopic] = useState("");
  const [sceneType, setSceneType] = useState<"slides" | "quiz" | "simulation" | "pbl">("slides");
  const [activeClassroomId, setActiveClassroomId] = useState<number | null>(null);
  const [classroomData, setClassroomData] = useState<ClassroomData | null>(null);

  // ── Polling state ──────────────────────────────────────────────────────────
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

            if (data.status === "succeeded" && data.result?.classroomId) {
              toast({
                title: "Classroom Ready!",
                description: "Your AI classroom has been generated successfully.",
              });
              // Auto-open the classroom
              openClassroom(data.result.classroomId);
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
              prev
                ? { ...prev, done: true, status: "failed", error: "Lost contact with generation service." }
                : prev,
            );
            toast({
              title: "Connection Lost",
              description: "Could not reach the generation service. Please refresh and try again.",
              variant: "destructive",
            });
          }
        }
      };

      poll();
      pollingRef.current = setInterval(poll, 5000);
    },
    [queryClient, stopPolling, toast],
  );

  // Load classroom data by ID (native, no iframe)
  const openClassroom = async (id: number) => {
    try {
      const res = await fetch(`/api/ai-classroom/${id}`);
      if (!res.ok) throw new Error("Failed to load classroom");
      const data: ClassroomData = await res.json();
      setClassroomData(data);
      setActiveClassroomId(id);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to open classroom",
        variant: "destructive",
      });
    }
  };

  // Check health
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
    onSuccess: (data: { jobId: string }) => {
      toast({
        title: "Generation Started",
        description: "Your AI classroom is being generated. This may take a few minutes...",
      });
      queryClient.invalidateQueries({ queryKey: ["ai-classroom-history"] });
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

  // ── Native Classroom View ──────────────────────────────────────────────────

  if (activeClassroomId && classroomData) {
    return (
      <ClassroomPlayer
        data={classroomData}
        onClose={() => {
          setActiveClassroomId(null);
          setClassroomData(null);
        }}
      />
    );
  }

  // ── Unavailable State ──────────────────────────────────────────────────────

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
              <p className="text-muted-foreground">
                The Study Arena engine is initializing. Please wait...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main Dashboard View ────────────────────────────────────────────────────

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <Sparkles className="h-8 w-8 text-violet-500" />
            Study Arena
          </h1>
          <p className="mt-1 text-muted-foreground">
            Create interactive AI-powered learning experiences with multi-agent classrooms
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <Card className="border-violet-200/50 dark:border-violet-800/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Presentation className="h-5 w-5 text-violet-500" />
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
                  onKeyDown={(e) => e.key === "Enter" && handleCreateClassroom()}
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
                    <SelectItem value="slides">📋 Slides</SelectItem>
                    <SelectItem value="quiz">🧪 Quiz</SelectItem>
                    <SelectItem value="simulation">🎮 Interactive Simulation</SelectItem>
                    <SelectItem value="pbl">🔬 Project-Based Learning</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Generation Progress */}
              {activeJobId && jobStatus && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="space-y-3 overflow-hidden rounded-lg border bg-gradient-to-br from-violet-50 to-indigo-50 p-4 dark:from-violet-950/30 dark:to-indigo-950/30"
                >
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
                    <span className="text-sm font-medium">{jobStatus.step || "Generating..."}</span>
                  </div>
                  <Progress value={jobStatus.progress || 0} className="h-2" />
                  {jobStatus.totalScenes && jobStatus.totalScenes > 0 && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        Scenes: {jobStatus.scenesGenerated || 0} / {jobStatus.totalScenes}
                      </span>
                      <span>{jobStatus.progress || 0}%</span>
                    </div>
                  )}
                  {jobStatus.message && (
                    <p className="text-xs text-muted-foreground">{jobStatus.message}</p>
                  )}
                </motion.div>
              )}

              <Button
                onClick={handleCreateClassroom}
                disabled={createClassroomMutation.isPending || !!activeJobId}
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
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
                  <BookOpen className="mx-auto mb-3 h-12 w-12 opacity-30" />
                  <p>No classrooms generated yet.</p>
                  <p className="mt-1 text-xs">Create your first classroom above!</p>
                </div>
              ) : (
                <div className="space-y-3 pb-6">
                  {history.map((classroom) => (
                    <div
                      key={classroom.id}
                      className="flex flex-col gap-3 rounded-lg border bg-card/50 p-4 transition-all hover:shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium capitalize">
                            {classroom.topic || "Untitled Session"}
                          </h4>
                          <span className="text-xs text-muted-foreground">
                            ID: {classroom.id} •{" "}
                            {new Date(classroom.createdAt!).toLocaleDateString()}
                          </span>
                        </div>
                        <Badge
                          variant={
                            classroom.status === "ready"
                              ? "default"
                              : classroom.status === "error"
                                ? "destructive"
                                : "outline"
                          }
                          className="text-xs"
                        >
                          {classroom.status}
                        </Badge>
                      </div>

                      {classroom.status === "ready" && classroom.id && (
                        <Button
                          size="sm"
                          className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                          onClick={() => openClassroom(classroom.id!)}
                        >
                          <Play className="mr-2 h-4 w-4" />
                          Open Classroom
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
