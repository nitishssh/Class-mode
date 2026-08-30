import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/lib/i18n";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Search,
  Plus,
  Play,
  Clock,
  Settings2,
  CheckCircle2,
  Layout,
  FileText,
  HelpCircle,
  Dna,
  History as HistoryIcon,
  Sparkles,
  ArrowLeft,
  MessageSquare,
  Send,
  Loader2,
  PencilLine,
  X,
  Users,
  BookOpen,
  Download,
  Code2,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  FileCode,
  Archive,
  ChevronDown,
} from "lucide-react";
import { useOrchestrator } from "../hooks/use-orchestrator";
import { usePlayback } from "../hooks/use-playback";
import { StatelessChatRequest } from "@shared/study-arena";
import "katex/dist/katex.min.css";
import { useToast } from "@/hooks/use-toast";
import { PlaybackControls } from "@/components/ai-classroom/PlaybackControls";
import { DiscussionCard } from "@/components/ai-classroom/DiscussionCard";
import { SpotlightOverlay } from "@/components/ai-classroom/SpotlightOverlay";
import { WhiteboardCanvas } from "@/components/ai-classroom/WhiteboardCanvas";
import { WidgetRenderer } from "@/components/ai-classroom/WidgetRenderer";
import { VideoPlayer } from "@/components/ai-classroom/VideoPlayer";
import { cacheClassroom, getCachedClassroom } from "@/lib/classroom-db";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ── Types ───────────────────────────────────────────────────────────────────

interface PlaybackAction {
  name: string;
  params?: Record<string, unknown>;
  [key: string]: unknown;
}

interface ProjectIssue {
  title?: string;
  description?: string;
  content?: string;
}

interface ProjectMilestone {
  title?: string;
  description?: string;
}

interface SceneContent {
  title?: string;
  points?: string[];
  image?: string;
  question?: string;
  options?: string[];
  correctIndex?: number;
  answer?: number;
  explanation?: string;
  widgetType?: string;
  projectTopic?: string;
  projectDescription?: string;
  targetSkills?: string[];
  issues?: ProjectIssue[];
  milestones?: ProjectMilestone[];
  [key: string]: unknown;
}

interface Scene {
  id: string;
  type:
    | "slides"
    | "quiz"
    | "simulation"
    | "pbl"
    | "interactive"
    | "code"
    | "diagram"
    | "game"
    | "visualization3d";
  title: string;
  content: SceneContent;
  actions?: PlaybackAction[];
  duration?: number;
}

interface ClassroomAgent {
  id: string;
  name: string;
  role: string;
  persona?: string;
}

interface ClassroomRecord {
  _id: string;
  id: string;
  topic: string;
  scenes: Scene[];
  status: string;
  createdAt: string;
  agents?: ClassroomAgent[];
  classroomId?: string;
}

interface ChatMessage {
  id?: string;
  role: string;
  name?: string;
  avatar?: string;
  color?: string;
  content: string;
}

interface AgentConfig {
  id: string;
  name: string;
  role: "teacher" | "assistant" | "student";
  avatar: string;
  persona: string;
  color: string;
  allowedActions: string[];
}

// ── Native Classroom Player ──────────────────────────────────────────────────

const ClassroomPlayer = ({ data, onClose }: { data: ClassroomRecord; onClose: () => void }) => {
  const { t } = useTranslation();
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const currentScene = data.scenes.at(currentSceneIndex) || data.scenes[0];
  const progress = ((currentSceneIndex + 1) / data.scenes.length) * 100;

  // Quiz state
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  // Multi-agent state
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const { sendMessage, isGenerating } = useOrchestrator();
  const { toast } = useToast();
  const slideAreaRef = useRef<HTMLDivElement>(null);

  // Playback engine
  const {
    mode: playbackMode,
    progress: playbackProgress,
    discussion,
    videoPrompt,
    lastAction,
    start: startPlayback,
    pause: pausePlayback,
    resume: resumePlayback,
    stop: stopPlayback,
    skip: skipAction,
    confirmDiscussion,
    skipDiscussion,
    confirmVideo,
    setTTSMode,
  } = usePlayback();
  // TTS mode toggle (browser vs server)
  const [serverTTS, setServerTTS] = useState(false);
  const toggleTTS = () => {
    const next = !serverTTS;
    setServerTTS(next);
    setTTSMode(next ? "server" : "browser");
  };

  // Microphone recording state
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const fd = new FormData();
        fd.append("audio", blob, "audio.webm");
        try {
          const res = await fetch("/api/ai-classroom/asr", { method: "POST", body: fd });
          if (res.ok) {
            const { text } = await res.json();
            if (text) setUserInput((prev) => (prev ? `${prev} ${text}` : text));
          }
        } catch {
          /* ignore ASR errors */
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      toast({
        title: "Mic unavailable",
        description: "Could not access microphone",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  };

  // Chat-driven actions (separate from playback-driven actions)
  const [lastChatAction, setLastChatAction] = useState<{
    name: string;
    params: Record<string, unknown>;
  } | null>(null);

  // Combined action: prefer playback, fall back to chat
  const activeAction = lastAction || lastChatAction;

  // Wire lastAction → whiteboard open/close state
  useEffect(() => {
    if (!lastAction) return;
    if (lastAction.name === "wb_open") setWhiteboardOpen(true);
    else if (lastAction.name === "wb_close") setWhiteboardOpen(false);
  }, [lastAction]);

  const nextScene = () => {
    if (currentSceneIndex < data.scenes.length - 1) {
      setCurrentSceneIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setAnswerRevealed(false);
    }
  };

  const prevScene = () => {
    if (currentSceneIndex > 0) {
      setCurrentSceneIndex((prev) => prev - 1);
      setSelectedAnswer(null);
      setAnswerRevealed(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") nextScene();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") prevScene();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const getAgentAvatar = (role: string): string => {
    switch (role) {
      case "teacher":
        return "👨‍🏫";
      case "assistant":
        return "🤖";
      case "student":
        return "🧑‍🎓";
      default:
        return "🧑";
    }
  };

  const handleSend = async () => {
    if (!userInput.trim() || isGenerating) return;

    const userMsg = { role: "user", content: userInput };
    setMessages((prev) => [...prev, userMsg]);
    setUserInput("");

    const agentColors = ["#7c3aed", "#2563eb", "#10b981", "#f59e0b", "#ef4444"];
    const classroomAgents = data.agents || [];
    const agentConfigs: AgentConfig[] =
      classroomAgents.length > 0
        ? classroomAgents.map((a: ClassroomAgent, i: number) => {
            const role = (
              a.role === "teacher" || a.role === "assistant" || a.role === "student"
                ? a.role
                : "student"
            ) as "teacher" | "assistant" | "student";
            return {
              id: a.id,
              name: a.name,
              role,
              avatar: getAgentAvatar(a.role),
              persona: a.persona || "",
              color: agentColors.at(i % agentColors.length) || "#7c3aed",
              allowedActions:
                role === "teacher"
                  ? [
                      "spotlight",
                      "laser",
                      "wb_open",
                      "wb_close",
                      "wb_clear",
                      "wb_delete",
                      "wb_draw_text",
                      "wb_draw_shape",
                      "wb_draw_chart",
                      "wb_draw_latex",
                      "wb_draw_table",
                      "wb_draw_line",
                      "wb_draw_code",
                      "wb_edit_code",
                      "discussion",
                    ]
                  : role === "assistant"
                    ? ["wb_open", "wb_draw_text", "wb_draw_latex", "wb_close", "discussion"]
                    : [],
            };
          })
        : [
            {
              id: "teacher",
              name: "Professor",
              role: "teacher",
              avatar: "👨‍🏫",
              persona: "Encouraging expert",
              color: "#7c3aed",
              allowedActions: [
                "spotlight",
                "laser",
                "wb_open",
                "wb_close",
                "wb_clear",
                "wb_delete",
                "wb_draw_text",
                "wb_draw_shape",
                "wb_draw_chart",
                "wb_draw_latex",
                "wb_draw_table",
                "wb_draw_line",
                "wb_draw_code",
                "wb_edit_code",
                "discussion",
              ],
            },
            {
              id: "student",
              name: "Alex",
              role: "student",
              avatar: "🧑‍🎓",
              persona: "Curious student",
              color: "#10b981",
              allowedActions: [],
            },
          ];

    const request: StatelessChatRequest = {
      messages: [...messages, userMsg],
      storeState: {
        currentSceneId: currentScene.id,
        whiteboardOpen: whiteboardOpen,
      },
      config: {
        agentIds: agentConfigs.map((a: AgentConfig) => a.id),
        agentConfigs,
        discussionTopic: data.topic,
      },
    };

    let currentAgentMsgId: string | null = null;

    await sendMessage(request, (event) => {
      if (event.type === "agent_start") {
        currentAgentMsgId = event.data.messageId;
        setMessages((prev) => [
          ...prev,
          {
            id: event.data.messageId,
            role: "assistant",
            name: event.data.agentName,
            avatar: event.data.agentAvatar,
            color: event.data.agentColor,
            content: "",
          },
        ]);
      } else if (event.type === "text_delta" && currentAgentMsgId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === currentAgentMsgId
              ? { ...msg, content: msg.content + event.data.content }
              : msg
          )
        );
      } else if (event.type === "action") {
        const name = event.data.actionName;
        if (name === "wb_open") setWhiteboardOpen(true);
        else if (name === "wb_close") setWhiteboardOpen(false);
        // All other wb_* and widget_* actions are handled by WhiteboardCanvas/WidgetRenderer via lastAction
        setLastChatAction({ name, params: event.data.params ?? {} });
      }
    });
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-white/50 px-6 py-3 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">{data.topic}</h1>
            <p className="text-sm text-muted-foreground">
              {t("classroom.scene", "Scene ")}
              {currentSceneIndex + 1}
              {t("classroom.of", " of ")}
              {data.scenes.length}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Playback controls */}
          <PlaybackControls
            mode={playbackMode}
            progress={playbackProgress}
            onPlay={() => {
              if (playbackMode === "paused") resumePlayback();
              else if (currentScene.actions?.length) startPlayback(currentScene.actions);
            }}
            onPause={pausePlayback}
            onStop={stopPlayback}
            onSkip={skipAction}
            className="w-52"
          />
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-purple-200 text-purple-700 hover:bg-purple-50"
            onClick={() => setWhiteboardOpen(!whiteboardOpen)}
          >
            <PencilLine className="h-4 w-4" />
            {t("whiteboard.title", "Whiteboard")}
          </Button>
          <Button
            variant={"default"}
            size="sm"
            className="gap-2 bg-blue-600 hover:bg-blue-700"
            onClick={() => setChatOpen(!chatOpen)}
          >
            <MessageSquare className="h-4 w-4" />
            {t("classroom.chat", "Chat")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={cn("gap-1", serverTTS ? "border-indigo-400 text-indigo-600" : "")}
            onClick={toggleTTS}
            title={
              serverTTS
                ? t("classroom.usingServerTTS", "Using server TTS — click to switch to browser TTS")
                : t(
                    "classroom.usingBrowserTTS",
                    "Using browser TTS — click to switch to server TTS"
                  )
            }
          >
            {serverTTS ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <Download className="h-4 w-4" />
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={async () => {
                  try {
                    const cid = data.classroomId || data.id;
                    const res = await fetch(`/api/ai-classroom/export/${cid}`, { method: "POST" });
                    if (!res.ok) throw new Error("Export failed");
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${data.topic.slice(0, 30)}.pptx`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch {
                    toast({
                      title: "Export failed",
                      description: "Could not generate PPTX",
                      variant: "destructive",
                    });
                  }
                }}
              >
                <Download className="mr-2 h-4 w-4" /> {t("classroom.exportPPTX", "Export as PPTX")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  try {
                    const cid = data.classroomId || data.id;
                    const a = document.createElement("a");
                    a.href = `/api/ai-classroom/export/${cid}/html`;
                    a.download = `${data.topic.slice(0, 30)}.html`;
                    a.click();
                  } catch {
                    toast({
                      title: "Export failed",
                      description: "Could not generate HTML",
                      variant: "destructive",
                    });
                  }
                }}
              >
                <FileCode className="mr-2 h-4 w-4" /> {t("classroom.exportHTML", "Export as HTML")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const cid = data.classroomId || data.id;
                  const a = document.createElement("a");
                  a.href = `/api/ai-classroom/export/${cid}/zip`;
                  a.download = `classroom-${cid}.zip`;
                  a.click();
                }}
              >
                <Archive className="mr-2 h-4 w-4" /> {t("classroom.exportZIP", "Export as ZIP")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex h-full overflow-hidden">
        {/* Sidebar Navigation */}
        <div className="hidden w-64 flex-col border-r bg-muted/30 p-4 lg:flex">
          <ScrollArea className="flex-1">
            <div className="space-y-2">
              {data.scenes.map((scene, idx) => (
                <button
                  key={scene.id}
                  onClick={() => setCurrentSceneIndex(idx)}
                  className={cn(
                    "w-full rounded-lg p-3 text-left transition-all",
                    currentSceneIndex === idx
                      ? "bg-white shadow-sm ring-1 ring-purple-100"
                      : "hover:bg-muted"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-md border",
                        currentSceneIndex === idx
                          ? "bg-purple-50 text-purple-600"
                          : "bg-background text-muted-foreground"
                      )}
                    >
                      {scene.type === "slides" && <Layout className="h-4 w-4" />}
                      {scene.type === "quiz" && <HelpCircle className="h-4 w-4" />}
                      {(scene.type === "simulation" || scene.type === "interactive") && (
                        <Dna className="h-4 w-4" />
                      )}
                      {scene.type === "pbl" && <FileText className="h-4 w-4" />}
                      {(scene.type === "code" ||
                        scene.type === "diagram" ||
                        scene.type === "game" ||
                        scene.type === "visualization3d") && <Code2 className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p
                        className={cn(
                          "truncate text-sm font-medium",
                          currentSceneIndex === idx ? "text-purple-900" : "text-gray-700"
                        )}
                      >
                        {scene.title}
                      </p>
                    </div>
                    {currentSceneIndex > idx && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
          <div className="mt-4 space-y-2 border-t pt-4">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t("classroom.overallProgress", "Overall Progress")}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        </div>

        {/* Main Content Area */}
        <div className="relative flex flex-1 flex-col overflow-hidden bg-slate-50 p-4 md:p-8">
          {/* Whiteboard */}
          {whiteboardOpen && (
            <WhiteboardCanvas
              isOpen={whiteboardOpen}
              action={activeAction}
              onClose={() => setWhiteboardOpen(false)}
              className="mb-3 h-56 shrink-0"
            />
          )}

          <ScrollArea className="flex-1 overflow-hidden rounded-3xl border bg-white shadow-2xl">
            <div ref={slideAreaRef} className="relative h-full min-h-[500px] w-full">
              {/* Spotlight overlay for spotlight/laser actions */}
              <SpotlightOverlay containerRef={slideAreaRef} action={activeAction} />
              {/* Scene Content */}
              <div className="p-8">
                {currentScene.type === "slides" && (
                  <div className="space-y-6">
                    <h2 className="text-3xl font-extrabold text-gray-900">
                      {currentScene.content.title}
                    </h2>
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-4">
                        {currentScene.content.points?.map((p: string, i: number) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="flex items-start gap-3 rounded-xl border bg-slate-50/50 p-4"
                          >
                            <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-700">
                              {i + 1}
                            </div>
                            <p className="text-lg leading-relaxed text-gray-700">{p}</p>
                          </motion.div>
                        ))}
                      </div>
                      {currentScene.content.image && (
                        <div className="rounded-2xl border bg-white p-2 shadow-lg">
                          <img
                            src={currentScene.content.image}
                            alt={currentScene.title}
                            className="h-full w-full rounded-xl object-cover"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {currentScene.type === "quiz" && (
                  <div className="mx-auto max-w-2xl space-y-8">
                    <div className="text-center">
                      <Badge
                        variant="outline"
                        className="mb-4 border-purple-200 bg-purple-50 text-purple-700"
                      >
                        {t("classroom.knowledgeCheck", "Knowledge Check")}
                      </Badge>
                      <h2 className="text-3xl font-bold">{currentScene.content.question}</h2>
                    </div>
                    <div className="grid gap-4">
                      {currentScene.content.options?.map((opt: string, i: number) => {
                        const correctIndex =
                          currentScene.content.correctIndex ?? currentScene.content.answer;
                        const isCorrect = i === correctIndex;
                        const isSelected = selectedAnswer === i;
                        return (
                          <Button
                            key={i}
                            variant="outline"
                            onClick={() => {
                              if (!answerRevealed) {
                                setSelectedAnswer(i);
                                setAnswerRevealed(true);
                              }
                            }}
                            className={cn(
                              "h-auto justify-start p-6 text-left text-lg transition-all",
                              !answerRevealed && "hover:border-purple-300 hover:bg-purple-50",
                              answerRevealed &&
                                isCorrect &&
                                "border-green-500 bg-green-50 text-green-900",
                              answerRevealed &&
                                isSelected &&
                                !isCorrect &&
                                "border-red-400 bg-red-50 text-red-900"
                            )}
                          >
                            <div
                              className={cn(
                                "mr-4 flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold",
                                answerRevealed &&
                                  isCorrect &&
                                  "border-green-500 bg-green-500 text-white",
                                answerRevealed &&
                                  isSelected &&
                                  !isCorrect &&
                                  "border-red-400 bg-red-400 text-white",
                                !(answerRevealed && (isCorrect || isSelected)) && "bg-background"
                              )}
                            >
                              {answerRevealed && isCorrect ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : (
                                String.fromCharCode(65 + i)
                              )}
                            </div>
                            {opt}
                          </Button>
                        );
                      })}
                    </div>
                    {answerRevealed && currentScene.content.explanation && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-900"
                      >
                        <p className="mb-1 font-semibold">
                          {t("classroom.explanation", "Explanation")}
                        </p>
                        <p className="text-sm">{currentScene.content.explanation}</p>
                      </motion.div>
                    )}
                  </div>
                )}

                {(currentScene.type === "simulation" ||
                  currentScene.type === "interactive" ||
                  currentScene.type === "code" ||
                  currentScene.type === "diagram" ||
                  currentScene.type === "game" ||
                  currentScene.type === "visualization3d") && (
                  <div className="h-full space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-bold">
                        {currentScene.content?.title || currentScene.title}
                      </h2>
                      <Badge variant="outline" className="capitalize">
                        {currentScene.content?.widgetType || currentScene.type}
                      </Badge>
                    </div>
                    <WidgetRenderer
                      scene={currentScene}
                      action={activeAction}
                      className="aspect-video"
                    />
                  </div>
                )}

                {currentScene.type === "pbl" && (
                  <div className="space-y-6">
                    <div>
                      <Badge
                        variant="outline"
                        className="mb-3 border-amber-200 bg-amber-50 text-amber-700"
                      >
                        {t("classroom.pbl", "Project-Based Learning")}
                      </Badge>
                      <h2 className="text-3xl font-extrabold text-gray-900">
                        {currentScene.content.projectTopic || currentScene.title}
                      </h2>
                      {currentScene.content.projectDescription && (
                        <p className="mt-2 text-lg text-muted-foreground">
                          {currentScene.content.projectDescription}
                        </p>
                      )}
                    </div>
                    {currentScene.content.targetSkills && (
                      <div className="flex flex-wrap gap-2">
                        {(Array.isArray(currentScene.content.targetSkills)
                          ? currentScene.content.targetSkills
                          : []
                        ).map((skill: string, i: number) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="border-purple-200 bg-purple-50 text-purple-700"
                          >
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {currentScene.content.issues && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-bold">
                          {t("classroom.projectTasks", "Project Tasks")}
                        </h3>
                        {(Array.isArray(currentScene.content.issues)
                          ? currentScene.content.issues
                          : []
                        ).map((issue: ProjectIssue, i: number) => (
                          <Card key={i} className="border-l-4 border-l-amber-400">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-base">
                                {issue.title || `${t("classroom.task", "Task")} ${i + 1}`}
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-muted-foreground">
                                {issue.description || issue.content || ""}
                              </p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                    {currentScene.content.milestones && (
                      <div className="space-y-3">
                        <h3 className="text-lg font-bold">
                          {t("classroom.milestones", "Milestones")}
                        </h3>
                        {(Array.isArray(currentScene.content.milestones)
                          ? currentScene.content.milestones
                          : []
                        ).map((m: ProjectMilestone | string, i: number) => (
                          <div
                            key={i}
                            className="flex items-start gap-3 rounded-xl border bg-slate-50/50 p-4"
                          >
                            <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                              {i + 1}
                            </div>
                            <div>
                              <p className="font-medium">
                                {typeof m === "string" ? m : m.title || ""}
                              </p>
                              {typeof m !== "string" && m.description && (
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {m.description}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Whiteboard is now rendered above the ScrollArea */}
            </div>
          </ScrollArea>

          {/* Player Controls */}
          <div className="mt-6 flex items-center justify-between">
            <div className="flex gap-3">
              <Button variant="outline" onClick={prevScene} disabled={currentSceneIndex === 0}>
                {t("classroom.previous", "Previous")}
              </Button>
              <Button
                onClick={nextScene}
                disabled={currentSceneIndex === data.scenes.length - 1}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {t("classroom.nextScene", "Next Scene")}
                <Play className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-4 text-sm font-medium text-gray-500">
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>
                  {data.agents?.length || 3} {t("classroom.aiAgentsOnline", "AI Agents Online")}
                </span>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <span>
                {t("classroom.scene", "Scene ")}
                {currentSceneIndex + 1} / {data.scenes.length}
              </span>
            </div>
          </div>
        </div>

        {/* Chat Sidebar/Drawer */}
        <AnimatePresence>
          {chatOpen && (
            <motion.div
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              className="absolute bottom-0 right-0 top-16 z-40 flex w-80 flex-col border-l bg-white shadow-2xl"
            >
              <div className="flex h-14 items-center justify-between border-b bg-blue-50/30 px-4">
                <div className="flex items-center gap-2 font-semibold text-blue-700">
                  <MessageSquare className="h-4 w-4" />
                  {t("classroom.classChat", "Class Chat")}
                </div>
                <Button variant="ghost" size="icon" onClick={() => setChatOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((msg, i) => (
                    <motion.div
                      key={msg.id || i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "flex flex-col gap-1",
                        msg.role === "user" ? "items-end" : "items-start"
                      )}
                    >
                      <div className="mb-1 flex items-center gap-2">
                        {msg.role !== "user" && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-500">
                            {msg.name}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {new Date().toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div
                        className={cn(
                          "max-w-[90%] rounded-2xl px-4 py-2 text-sm shadow-sm",
                          msg.role === "user"
                            ? "rounded-tr-none bg-blue-600 text-white"
                            : "rounded-tl-none border border-slate-200 bg-slate-100 text-gray-800"
                        )}
                      >
                        {msg.content || <Loader2 className="h-4 w-4 animate-spin opacity-50" />}
                      </div>
                    </motion.div>
                  ))}
                  {isGenerating &&
                    !messages.some((m) => m.id && messages.indexOf(m) === messages.length - 1) && (
                      <div className="flex items-center gap-2 p-2 text-xs italic text-muted-foreground">
                        <div className="flex gap-1">
                          <span className="h-1 w-1 animate-bounce rounded-full bg-gray-400" />
                          <span className="h-1 w-1 animate-bounce rounded-full bg-gray-400 [animation-delay:0.2s]" />
                          <span className="h-1 w-1 animate-bounce rounded-full bg-gray-400 [animation-delay:0.4s]" />
                        </div>
                        {t("classroom.directorThinking", "Director is thinking...")}
                      </div>
                    )}
                </div>
              </ScrollArea>

              <div className="border-t bg-slate-50/50 p-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="relative"
                >
                  <Input
                    placeholder={t("classroom.askQuestion", "Ask a question...")}
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    disabled={isGenerating}
                    className="rounded-xl border-slate-200 pr-20 focus-visible:ring-blue-500"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                    onTouchStart={startRecording}
                    onTouchEnd={stopRecording}
                    className={cn(
                      "absolute right-10 top-1 h-8 w-8 rounded-lg",
                      isRecording ? "bg-red-50 text-red-500" : "text-slate-400 hover:text-slate-600"
                    )}
                    title={t("classroom.holdSpeak", "Hold to speak")}
                  >
                    {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!userInput.trim() || isGenerating}
                    className="absolute right-1 top-1 h-8 w-8 rounded-lg bg-blue-600 hover:bg-blue-700"
                  >
                    {isGenerating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Video Player — blocks playback until video ends or is skipped */}
      <AnimatePresence>
        {videoPrompt && (
          <VideoPlayer
            src={videoPrompt.src}
            elementId={videoPrompt.elementId}
            onEnd={confirmVideo}
            onSkip={confirmVideo}
          />
        )}
      </AnimatePresence>

      {/* Discussion Card — appears mid-lesson */}
      {discussion && (
        <DiscussionCard
          topic={discussion.topic}
          prompt={discussion.prompt}
          onJoin={confirmDiscussion}
          onSkip={skipDiscussion}
        />
      )}
    </div>
  );
};

// ── Main Page Component ───────────────────────────────────────────────────────

export default function StudyArenaPage({
  initialTopic = "",
}: {
  initialTopic?: string;
} = {}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [topic, setTopic] = useState(initialTopic);
  const [sceneType, setSceneType] = useState<"slides" | "quiz" | "simulation" | "pbl">("slides");
  const [activeClassroomId, setActiveClassroomId] = useState<string | null>(null);
  const [classroomData, setClassroomData] = useState<ClassroomRecord | null>(null);

  // ── Health Check ───────────────────────────────────────────────────────────
  const { data: healthStatus } = useQuery({
    queryKey: ["ai-classroom-health"],
    queryFn: async () => {
      const res = await fetch("/api/ai-classroom/health");
      return res.json();
    },
    refetchInterval: 10000,
  });

  // ── History ────────────────────────────────────────────────────────────────
  const { data: history, isLoading: historyLoading } = useQuery<ClassroomRecord[]>({
    queryKey: ["ai-classroom-history"],
    queryFn: async () => {
      const res = await fetch("/api/ai-classroom/my-classrooms");
      if (!res.ok) throw new Error("Failed to fetch classrooms");
      const data = await res.json();
      // The endpoint returns { classrooms, total }, not a bare array. Normalize
      // so callers can safely `.map` over the result.
      return Array.isArray(data) ? data : (data?.classrooms ?? []);
    },
  });

  // ── SSE Progress Streaming ──────────────────────────────────────────────────
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState(0);
  const [jobMessage, setJobMessage] = useState("");

  useEffect(() => {
    if (!activeJobId) return;

    const evtSource = new EventSource(`/api/ai-classroom/status/${activeJobId}/stream`);

    evtSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.error) {
          setActiveJobId(null);
          toast({ title: "Error", description: data.error, variant: "destructive" });
          evtSource.close();
          return;
        }
        setJobProgress(data.progress || 0);
        setJobMessage(data.message || "");

        if (data.status === "succeeded") {
          setActiveJobId(null);
          setJobProgress(0);
          setJobMessage("");
          toast({
            title: "Ready!",
            description: "Your classroom has been generated successfully.",
          });
          queryClient.invalidateQueries({ queryKey: ["ai-classroom-history"] });
          evtSource.close();
        } else if (data.status === "failed") {
          setActiveJobId(null);
          setJobProgress(0);
          setJobMessage("");
          toast({
            title: "Generation Failed",
            description: data.error || "Something went wrong.",
            variant: "destructive",
          });
          evtSource.close();
        }
      } catch {
        // ignore malformed events
      }
    };

    evtSource.onerror = () => {
      evtSource.close();
    };

    return () => evtSource.close();
  }, [activeJobId, queryClient, toast]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleOpenClassroom = async (id: string) => {
    try {
      // Check IndexedDB cache first (24h TTL)
      const cached = await getCachedClassroom(id);
      if (cached) {
        setClassroomData(cached);
        setActiveClassroomId(id);
        return;
      }
      const res = await fetch(`/api/ai-classroom/classroom/${id}`);
      if (!res.ok) throw new Error("Failed to load classroom");
      const data = await res.json();
      // Cache for offline use
      cacheClassroom(data, parseInt(id)).catch(() => {});
      setClassroomData(data);
      setActiveClassroomId(id);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load classroom";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const createClassroomMutation = useMutation({
    mutationFn: async (vars: { topic: string; sceneTypes: string[] }) => {
      const res = await fetch("/api/ai-classroom/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars),
      });
      if (!res.ok) throw new Error("Failed to create classroom");
      return res.json();
    },
    onSuccess: (data: { jobId: string }) => {
      toast({
        title: "Generation Started",
        description: "Your AI classroom is being generated...",
      });
      queryClient.invalidateQueries({ queryKey: ["ai-classroom-history"] });
      setActiveJobId(data.jobId);
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
        <Card className="border-none bg-transparent shadow-none">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-purple-100">
              <Brain className="h-10 w-10 animate-pulse text-purple-600" />
            </div>
            <CardTitle className="text-3xl font-extrabold tracking-tight">
              {t("classroom.aiClassroom", "AI Classroom")}
            </CardTitle>
            <CardDescription className="text-lg">
              {t("classroom.initializing", "Initializing your interactive learning sanctuary...")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="mt-4 w-full max-w-xs space-y-2">
              <Progress value={45} className="h-2" />
              <p className="text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {t("classroom.connecting", "Connecting to ClassMode Learning Engine")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main Dashboard View ────────────────────────────────────────────────────

  return (
    <div className="container mx-auto space-y-6 p-4 md:p-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.history.back()}
            className="rounded-full"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">
              {t("classroom.studyArena", "ClassMode Learning")}
            </h1>
            <p className="text-lg text-muted-foreground">
              {t(
                "classroom.interactiveExperiences",
                "Interactive multi-agent classroom experiences"
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl border-purple-200">
            <Settings2 className="mr-2 h-4 w-4" />
            {t("classroom.preferences", "Preferences")}
          </Button>
          <Button className="rounded-xl bg-purple-600 shadow-lg shadow-purple-200 hover:bg-purple-700">
            <Plus className="mr-2 h-4 w-4" />
            {t("classroom.joinSession", "Join Session")}
          </Button>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-12">
        {/* Create Classroom Card */}
        <Card className="group overflow-hidden border-2 border-purple-100 shadow-xl md:col-span-5">
          <div className="h-2 bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500" />
          <CardHeader className="bg-slate-50/50">
            <CardTitle className="flex items-center gap-2 transition-colors group-hover:text-purple-700">
              <Sparkles className="h-5 w-5 text-purple-500" />
              {t("classroom.newLearningJourney", "New Learning Journey")}
            </CardTitle>
            <CardDescription>
              {t("classroom.whatToMaster", "What would you like to master today?")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t(
                    "classroom.topicPlaceholder",
                    "e.g. Quantum Mechanics for Beginners"
                  )}
                  className="h-12 rounded-xl border-slate-200 pl-10 focus:ring-purple-500"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(["slides", "quiz", "simulation", "pbl"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setSceneType(type)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3 text-left transition-all hover:shadow-md",
                      sceneType === type
                        ? "border-purple-500 bg-purple-50 ring-2 ring-purple-100"
                        : "border-slate-100 bg-white hover:border-slate-300"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg",
                        sceneType === type
                          ? "bg-purple-600 text-white"
                          : "bg-slate-100 text-slate-600"
                      )}
                    >
                      {type === "slides" && <Layout className="h-5 w-5" />}
                      {type === "quiz" && <HelpCircle className="h-5 w-5" />}
                      {type === "simulation" && <Dna className="h-5 w-5" />}
                      {type === "pbl" && <FileText className="h-5 w-5" />}
                    </div>
                    <span className="text-sm font-semibold capitalize">
                      {type === "pbl"
                        ? t("classroom.pblShort", "Problem Based")
                        : t("classroom.type." + type, type)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-3 border-t bg-slate-50/50">
            {activeJobId && (
              <div className="w-full space-y-2">
                <Progress value={jobProgress} className="h-2" />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {jobMessage || t("classroom.starting", "Starting...")}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={async () => {
                      try {
                        await fetch(`/api/ai-classroom/status/${activeJobId}`, {
                          method: "DELETE",
                        });
                        setActiveJobId(null);
                        setJobProgress(0);
                        setJobMessage("");
                        toast({ title: "Cancelled", description: "Generation cancelled." });
                      } catch (e) {
                        console.error("Error cancelling job:", e);
                      }
                    }}
                  >
                    {t("classroom.cancel", "Cancel")}
                  </Button>
                </div>
              </div>
            )}
            <Button
              className="h-12 w-full rounded-xl bg-purple-600 text-lg font-bold transition-all hover:bg-purple-700 disabled:opacity-50"
              onClick={handleCreateClassroom}
              disabled={createClassroomMutation.isPending || !!activeJobId}
            >
              {createClassroomMutation.isPending || activeJobId ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {activeJobId
                    ? `${t("classroom.generating", "Generating")} (${jobProgress}%)...`
                    : t("classroom.starting", "Starting...")}
                </>
              ) : (
                <>
                  <Brain className="mr-2 h-5 w-5" />
                  {t("classroom.startClassroom", "Start AI Classroom")}
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* History / Recent Sessions */}
        <div className="space-y-4 md:col-span-7">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <HistoryIcon className="h-5 w-5 text-muted-foreground" />
              {t("classroom.recentClassrooms", "Recent Classrooms")}
            </h2>
            <Button variant="link" className="text-purple-600">
              {t("classroom.viewAll", "View All")}
            </Button>
          </div>

          <ScrollArea className="h-[480px] rounded-2xl border bg-white shadow-sm">
            <div className="space-y-4 p-4">
              {historyLoading ? (
                Array(3)
                  .fill(0)
                  .map((_, i) => (
                    <div key={i} className="flex gap-4 rounded-2xl border p-4">
                      <Skeleton className="h-16 w-16 rounded-xl" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                    </div>
                  ))
              ) : history?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50">
                    <Clock className="h-8 w-8 text-slate-300" />
                  </div>
                  <h3 className="font-semibold text-slate-900">
                    {t("classroom.noSessions", "No sessions yet")}
                  </h3>
                  <p className="mt-1 max-w-[200px] text-sm text-muted-foreground">
                    {t(
                      "classroom.historyAppear",
                      "Your learning history will appear here once you start a classroom."
                    )}
                  </p>
                </div>
              ) : (
                history?.map((classroom) => (
                  <motion.div
                    key={classroom.id}
                    whileHover={{ scale: 1.01 }}
                    className="group relative flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:border-purple-200 hover:shadow-lg"
                  >
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 transition-colors group-hover:bg-purple-600 group-hover:text-white">
                      <BookOpen className="h-8 w-8" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h3 className="truncate font-bold text-gray-900 transition-colors group-hover:text-purple-700">
                        {classroom.topic}
                      </h3>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Layout className="h-3 w-3" />
                          {classroom.scenes?.length ?? "?"} {t("classroom.scenes", "Scenes")}
                        </span>
                        <Separator orientation="vertical" className="h-3" />
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          {t("classroom.nativePlayer", "Native Player")}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenClassroom(classroom.id)}
                      className="transform rounded-full transition-all hover:bg-purple-600 hover:text-white group-hover:translate-x-1"
                    >
                      <Play className="h-5 w-5" />
                    </Button>
                  </motion.div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
