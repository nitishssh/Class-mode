import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Search,
  Plus,
  Play,
  Clock,
  Settings2,
  CheckCircle2,
  AlertCircle,
  Layout,
  FileText,
  HelpCircle,
  Dna,
  History as HistoryIcon,
  Sparkles,
  Trophy,
  ArrowLeft,
  MessageSquare,
  Send,
  Loader2,
  PencilLine,
  Eraser,
  X,
  Users,
  BookOpen,
} from "lucide-react";
import { useOrchestrator } from "../hooks/use-orchestrator";
import { 
  StatelessChatRequest, 
  StatelessEvent, 
  DirectorState,
  WhiteboardActionRecord,
  AgentInfo,
} from "@shared/study-arena";
import "katex/dist/katex.min.css";
import { InlineMath, BlockMath } from "react-katex";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ── Types ───────────────────────────────────────────────────────────────────

interface Scene {
  id: string;
  type: "slides" | "quiz" | "simulation" | "pbl";
  title: string;
  content: any;
  duration?: number;
}

interface ClassroomRecord {
  _id: string;
  id: string;
  topic: string;
  scenes: Scene[];
  status: string;
  createdAt: string;
}

interface WhiteboardElement {
  id: string;
  type: string;
  content?: string;
  latex?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  data?: any;
}

// ── Whiteboard Component ─────────────────────────────────────────────────────

const Whiteboard = ({ 
  isOpen, 
  elements, 
  onClose,
  onClear
}: { 
  isOpen: boolean; 
  elements: WhiteboardElement[]; 
  onClose: () => void;
  onClear: () => void;
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="absolute inset-4 z-50 rounded-2xl bg-white/95 backdrop-blur-xl shadow-2xl border-2 border-purple-100 flex flex-col overflow-hidden"
        >
          <div className="h-12 border-b flex items-center justify-between px-4 bg-purple-50/50">
            <div className="flex items-center gap-2 text-purple-700 font-semibold text-sm">
              <PencilLine className="h-4 w-4" />
              Whiteboard
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onClear} className="h-8 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50">
                <Eraser className="h-3 w-3 mr-1" />
                Clear
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="flex-1 relative bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] overflow-hidden">
            {elements.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30 flex-col gap-2">
                <PencilLine className="h-12 w-12 opacity-10" />
                <p className="text-sm">The whiteboard is ready for notes</p>
              </div>
            )}
            
            <div className="absolute inset-0 pointer-events-none">
              <svg className="w-full h-full" viewBox="0 0 1000 562">
                {elements.map((el) => {
                  if (el.type === 'line') {
                    const data = el.data || {};
                    return (
                      <line
                        key={el.id}
                        x1={el.x}
                        y1={el.y}
                        x2={data.endX || el.x + 100}
                        y2={data.endY || el.y + 100}
                        stroke="#7c3aed"
                        strokeWidth="2"
                        strokeDasharray="4 2"
                      />
                    );
                  }
                  if (el.type === 'shape') {
                    return (
                      <rect
                        key={el.id}
                        x={el.x}
                        y={el.y}
                        width={el.width || 100}
                        height={el.height || 100}
                        fill="none"
                        stroke="#7c3aed"
                        strokeWidth="2"
                        rx="4"
                      />
                    );
                  }
                  return null;
                })}
              </svg>

              {elements.map((el) => {
                if (el.type === 'text' || el.type === 'latex') {
                  const style: React.CSSProperties = {
                    position: 'absolute',
                    left: `${(el.x / 1000) * 100}%`,
                    top: `${(el.y / 562) * 100}%`,
                    maxWidth: el.width ? `${(el.width / 1000) * 100}%` : '200px',
                    transform: 'translate(-0%, -0%)',
                    pointerEvents: 'auto',
                  };
                  return (
                    <div key={el.id} style={style}>
                      {el.type === 'latex' ? (
                        <div className="bg-white/90 p-2 rounded-lg shadow-sm border border-purple-100 text-purple-900 border-l-4 border-l-purple-500">
                          <InlineMath math={el.latex || ""} />
                        </div>
                      ) : (
                        <div className="bg-white/80 p-2 rounded-lg shadow-sm border border-gray-100 text-sm font-medium border-l-4 border-l-blue-400">
                          {el.content}
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ── Native Classroom Player ──────────────────────────────────────────────────

const ClassroomPlayer = ({ data, onClose }: { data: ClassroomRecord; onClose: () => void }) => {
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const currentScene = data.scenes[currentSceneIndex];
  const progress = ((currentSceneIndex + 1) / data.scenes.length) * 100;

  // Quiz state
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerRevealed, setAnswerRevealed] = useState(false);

  // Multi-agent state
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [wbElements, setWbElements] = useState<WhiteboardElement[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [userInput, setUserInput] = useState("");
  const { sendMessage, isGenerating } = useOrchestrator();

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

  const handleSend = async () => {
    if (!userInput.trim() || isGenerating) return;

    const userMsg = { role: "user", content: userInput };
    setMessages((prev) => [...prev, userMsg]);
    setUserInput("");

    const agentColors = ["#7c3aed", "#2563eb", "#10b981", "#f59e0b", "#ef4444"];
    const agentAvatars: Record<string, string> = { teacher: "👨‍🏫", assistant: "🤖", student: "🧑‍🎓" };
    const classroomAgents = (data as any).agents || [];
    const agentConfigs = classroomAgents.length > 0
      ? classroomAgents.map((a: any, i: number) => ({
          id: a.id,
          name: a.name,
          role: a.role,
          avatar: agentAvatars[a.role] || "🧑",
          persona: a.persona,
          color: agentColors[i % agentColors.length],
          allowedActions: a.role === "teacher" ? ["wb_open", "wb_draw_text", "wb_draw_latex", "wb_close", "wb_clear", "wb_delete"] : [],
        }))
      : [
          { id: "teacher", name: "Professor", role: "teacher", avatar: "👨‍🏫", persona: "Encouraging expert", color: "#7c3aed", allowedActions: ["wb_open", "wb_draw_text", "wb_draw_latex", "wb_close", "wb_clear", "wb_delete"] },
          { id: "student", name: "Alex", role: "student", avatar: "🧑‍🎓", persona: "Curious student", color: "#10b981", allowedActions: [] },
        ];

    const request: StatelessChatRequest = {
      messages: [...messages, userMsg],
      storeState: {
        currentSceneId: currentScene.id,
        whiteboardOpen: whiteboardOpen,
      },
      config: {
        agentIds: agentConfigs.map((a: any) => a.id),
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
            content: "" 
          }
        ]);
      } else if (event.type === "text_delta" && currentAgentMsgId) {
        setMessages((prev) => 
          prev.map((msg) => 
            msg.id === currentAgentMsgId ? { ...msg, content: msg.content + event.data.content } : msg
          )
        );
      } else if (event.type === "action") {
        const name = event.data.actionName;
        if (name === "wb_open") setWhiteboardOpen(true);
        else if (name === "wb_close") setWhiteboardOpen(false);
        else if (name === "wb_clear") setWbElements([]);
        else if (name === "wb_delete" && event.data.params?.elementId) {
          setWbElements((prev) => prev.filter((el) => el.id !== event.data.params.elementId));
        } else if (name.startsWith("wb_draw_")) {
          const type = name.replace("wb_draw_", "");
          setWbElements((prev) => [
            ...prev,
            {
              id: event.data.actionId,
              type,
              x: event.data.params.x,
              y: event.data.params.y,
              content: event.data.params.content,
              latex: event.data.params.latex,
              width: event.data.params.width,
              height: event.data.params.height,
              data: event.data.params,
            }
          ]);
        }
      }
    });
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-3 bg-white/50 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">{data.topic}</h1>
            <p className="text-sm text-muted-foreground">Scene {currentSceneIndex + 1} of {data.scenes.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2 border-purple-200 text-purple-700 hover:bg-purple-50"
            onClick={() => setWhiteboardOpen(!whiteboardOpen)}
          >
            <PencilLine className="h-4 w-4" />
            Whiteboard
          </Button>
          <Button 
            variant={"default"} 
            size="sm" 
            className="gap-2 bg-blue-600 hover:bg-blue-700"
            onClick={() => setChatOpen(!chatOpen)}
          >
            <MessageSquare className="h-4 w-4" />
            Class Chat
          </Button>
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
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-md border",
                      currentSceneIndex === idx ? "bg-purple-50 text-purple-600" : "bg-background text-muted-foreground"
                    )}>
                      {scene.type === "slides" && <Layout className="h-4 w-4" />}
                      {scene.type === "quiz" && <HelpCircle className="h-4 w-4" />}
                      {scene.type === "simulation" && <Dna className="h-4 w-4" />}
                      {scene.type === "pbl" && <FileText className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className={cn(
                        "truncate text-sm font-medium",
                        currentSceneIndex === idx ? "text-purple-900" : "text-gray-700"
                      )}>
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
              <span>Overall Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        </div>

        {/* Main Content Area */}
        <div className="relative flex flex-1 flex-col overflow-hidden bg-slate-50 p-4 md:p-8">
          <ScrollArea className="flex-1 rounded-3xl border bg-white shadow-2xl overflow-hidden">
            <div className="relative h-full w-full min-h-[500px]">
              {/* Scene Content */}
              <div className="p-8">
                {currentScene.type === "slides" && (
                  <div className="space-y-6">
                    <h2 className="text-3xl font-extrabold text-gray-900">{currentScene.content.title}</h2>
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
                      <Badge variant="outline" className="mb-4 bg-purple-50 text-purple-700 border-purple-200">Knowledge Check</Badge>
                      <h2 className="text-3xl font-bold">{currentScene.content.question}</h2>
                    </div>
                    <div className="grid gap-4">
                      {currentScene.content.options?.map((opt: string, i: number) => {
                        const correctIndex = currentScene.content.correctIndex ?? currentScene.content.answer;
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
                              answerRevealed && isCorrect && "border-green-500 bg-green-50 text-green-900",
                              answerRevealed && isSelected && !isCorrect && "border-red-400 bg-red-50 text-red-900",
                            )}
                          >
                            <div className={cn(
                              "mr-4 flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold",
                              answerRevealed && isCorrect && "bg-green-500 text-white border-green-500",
                              answerRevealed && isSelected && !isCorrect && "bg-red-400 text-white border-red-400",
                              !(answerRevealed && (isCorrect || isSelected)) && "bg-background",
                            )}>
                              {answerRevealed && isCorrect ? <CheckCircle2 className="h-4 w-4" /> : String.fromCharCode(65 + i)}
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
                        <p className="font-semibold mb-1">Explanation</p>
                        <p className="text-sm">{currentScene.content.explanation}</p>
                      </motion.div>
                    )}
                  </div>
                )}

                {currentScene.type === "simulation" && (
                  <div className="h-full space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-bold">{currentScene.content.title || currentScene.title}</h2>
                    </div>
                    <div className="aspect-video w-full rounded-2xl border-4 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center">
                      {currentScene.content.html ? (
                        <iframe
                          srcDoc={currentScene.content.html}
                          className="h-full w-full rounded-xl border-none"
                          sandbox="allow-scripts allow-same-origin"
                          title="Simulation"
                        />
                      ) : (
                        <div className="text-center text-muted-foreground">
                          <Brain className="mx-auto mb-2 h-12 w-12 opacity-20" />
                          <p>Interactive Simulation Engine</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {currentScene.type === "pbl" && (
                  <div className="space-y-6">
                    <div>
                      <Badge variant="outline" className="mb-3 bg-amber-50 text-amber-700 border-amber-200">Project-Based Learning</Badge>
                      <h2 className="text-3xl font-extrabold text-gray-900">{currentScene.content.projectTopic || currentScene.title}</h2>
                      {currentScene.content.projectDescription && (
                        <p className="mt-2 text-lg text-muted-foreground">{currentScene.content.projectDescription}</p>
                      )}
                    </div>
                    {currentScene.content.targetSkills && (
                      <div className="flex flex-wrap gap-2">
                        {(Array.isArray(currentScene.content.targetSkills) ? currentScene.content.targetSkills : []).map((skill: string, i: number) => (
                          <Badge key={i} variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">{skill}</Badge>
                        ))}
                      </div>
                    )}
                    {currentScene.content.issues && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-bold">Project Tasks</h3>
                        {(Array.isArray(currentScene.content.issues) ? currentScene.content.issues : []).map((issue: any, i: number) => (
                          <Card key={i} className="border-l-4 border-l-amber-400">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-base">{issue.title || `Task ${i + 1}`}</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-muted-foreground">{issue.description || issue.content || ""}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                    {currentScene.content.milestones && (
                      <div className="space-y-3">
                        <h3 className="text-lg font-bold">Milestones</h3>
                        {(Array.isArray(currentScene.content.milestones) ? currentScene.content.milestones : []).map((m: any, i: number) => (
                          <div key={i} className="flex items-start gap-3 rounded-xl border bg-slate-50/50 p-4">
                            <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                              {i + 1}
                            </div>
                            <div>
                              <p className="font-medium">{m.title || m}</p>
                              {m.description && <p className="text-sm text-muted-foreground mt-1">{m.description}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Whiteboard Overlay */}
              <Whiteboard 
                isOpen={whiteboardOpen} 
                elements={wbElements} 
                onClose={() => setWhiteboardOpen(false)} 
                onClear={() => setWbElements([])}
              />
            </div>
          </ScrollArea>

          {/* Player Controls */}
          <div className="mt-6 flex items-center justify-between">
            <div className="flex gap-3">
              <Button variant="outline" onClick={prevScene} disabled={currentSceneIndex === 0}>
                Previous
              </Button>
              <Button onClick={nextScene} disabled={currentSceneIndex === data.scenes.length - 1} className="bg-purple-600 hover:bg-purple-700">
                Next Scene
                <Play className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-4 text-sm font-medium text-gray-500">
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{(data as any).agents?.length || 3} AI Agents Online</span>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <span>Scene {currentSceneIndex + 1} / {data.scenes.length}</span>
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
              className="absolute top-16 right-0 bottom-0 w-80 bg-white border-l shadow-2xl z-40 flex flex-col"
            >
              <div className="h-14 border-b flex items-center justify-between px-4 bg-blue-50/30">
                <div className="flex items-center gap-2 font-semibold text-blue-700">
                  <MessageSquare className="h-4 w-4" />
                  Class Chat
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
                      <div className="flex items-center gap-2 mb-1">
                        {msg.role !== "user" && <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded uppercase font-bold text-slate-500">{msg.name}</span>}
                        <span className="text-[10px] text-muted-foreground">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className={cn(
                        "max-w-[90%] rounded-2xl px-4 py-2 text-sm shadow-sm",
                        msg.role === "user" 
                          ? "bg-blue-600 text-white rounded-tr-none" 
                          : "bg-slate-100 text-gray-800 rounded-tl-none border border-slate-200"
                      )}>
                        {msg.content || <Loader2 className="h-4 w-4 animate-spin opacity-50" />}
                      </div>
                    </motion.div>
                  ))}
                  {isGenerating && !messages.some(m => m.id && messages.indexOf(m) === messages.length - 1) && (
                    <div className="flex items-center gap-2 text-muted-foreground text-xs italic p-2">
                      <div className="flex gap-1">
                        <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" />
                        <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                      Director is thinking...
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="p-4 border-t bg-slate-50/50">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="relative"
                >
                  <Input
                    placeholder="Ask a question..."
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    disabled={isGenerating}
                    className="pr-12 rounded-xl border-slate-200 focus-visible:ring-blue-500"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!userInput.trim() || isGenerating}
                    className="absolute right-1 top-1 h-8 w-8 bg-blue-600 hover:bg-blue-700 rounded-lg"
                  >
                    {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ── Main Page Component ───────────────────────────────────────────────────────

export default function StudyArenaPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [topic, setTopic] = useState("");
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
      return res.json();
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
          toast({ title: "Ready!", description: "Your classroom has been generated successfully." });
          queryClient.invalidateQueries({ queryKey: ["ai-classroom-history"] });
          evtSource.close();
        } else if (data.status === "failed") {
          setActiveJobId(null);
          setJobProgress(0);
          setJobMessage("");
          toast({ title: "Generation Failed", description: data.error || "Something went wrong.", variant: "destructive" });
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
      const res = await fetch(`/api/ai-classroom/classroom/${id}`);
      if (!res.ok) throw new Error("Failed to load classroom");
      const data = await res.json();
      setClassroomData(data);
      setActiveClassroomId(id);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
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
        <Card className="border-none shadow-none bg-transparent">
          <CardHeader className="text-center">
            <div className="mx-auto w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mb-4">
              <Brain className="h-10 w-10 text-purple-600 animate-pulse" />
            </div>
            <CardTitle className="text-3xl font-extrabold tracking-tight">AI Classroom</CardTitle>
            <CardDescription className="text-lg">Initializing your interactive learning sanctuary...</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="w-full max-w-xs space-y-2 mt-4">
              <Progress value={45} className="h-2" />
              <p className="text-xs text-center text-muted-foreground uppercase tracking-widest font-bold">Connecting to Study Arena Engine</p>
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
            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">Study Arena</h1>
            <p className="text-lg text-muted-foreground">Interactive multi-agent classroom experiences</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl border-purple-200">
            <Settings2 className="mr-2 h-4 w-4" />
            Preferences
          </Button>
          <Button className="rounded-xl bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-200">
            <Plus className="mr-2 h-4 w-4" />
            Join Session
          </Button>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-12">
        {/* Create Classroom Card */}
        <Card className="md:col-span-5 border-2 border-purple-100 shadow-xl overflow-hidden group">
          <div className="h-2 bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500" />
          <CardHeader className="bg-slate-50/50">
            <CardTitle className="flex items-center gap-2 group-hover:text-purple-700 transition-colors">
              <Sparkles className="h-5 w-5 text-purple-500" />
              New Learning Journey
            </CardTitle>
            <CardDescription>What would you like to master today?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="e.g. Quantum Mechanics for Beginners"
                  className="pl-10 h-12 rounded-xl border-slate-200 focus:ring-purple-500"
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
                    <div className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg",
                      sceneType === type ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-600"
                    )}>
                      {type === "slides" && <Layout className="h-5 w-5" />}
                      {type === "quiz" && <HelpCircle className="h-5 w-5" />}
                      {type === "simulation" && <Dna className="h-5 w-5" />}
                      {type === "pbl" && <FileText className="h-5 w-5" />}
                    </div>
                    <span className="text-sm font-semibold capitalize">{type === "pbl" ? "Problem Based" : type}</span>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
          <CardFooter className="bg-slate-50/50 border-t flex-col gap-3">
            {activeJobId && (
              <div className="w-full space-y-2">
                <Progress value={jobProgress} className="h-2" />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{jobMessage || "Starting..."}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={async () => {
                      try {
                        await fetch(`/api/ai-classroom/status/${activeJobId}`, { method: "DELETE" });
                        setActiveJobId(null);
                        setJobProgress(0);
                        setJobMessage("");
                        toast({ title: "Cancelled", description: "Generation cancelled." });
                      } catch {}
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            <Button
              className="w-full h-12 rounded-xl bg-purple-600 hover:bg-purple-700 text-lg font-bold transition-all disabled:opacity-50"
              onClick={handleCreateClassroom}
              disabled={createClassroomMutation.isPending || !!activeJobId}
            >
              {createClassroomMutation.isPending || activeJobId ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {activeJobId ? `Generating (${jobProgress}%)...` : "Starting..."}
                </>
              ) : (
                <>
                  <Brain className="mr-2 h-5 w-5" />
                  Start AI Classroom
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* History / Recent Sessions */}
        <div className="md:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <HistoryIcon className="h-5 w-5 text-muted-foreground" />
              Recent Classrooms
            </h2>
            <Button variant="link" className="text-purple-600">View All</Button>
          </div>
          
          <ScrollArea className="h-[480px] rounded-2xl border bg-white shadow-sm">
            <div className="space-y-4 p-4">
              {historyLoading ? (
                Array(3).fill(0).map((_, i) => (
                  <div key={i} className="flex gap-4 p-4 border rounded-2xl">
                    <Skeleton className="h-16 w-16 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  </div>
                ))
              ) : history?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <Clock className="h-8 w-8 text-slate-300" />
                  </div>
                  <h3 className="font-semibold text-slate-900">No sessions yet</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-[200px]">Your learning history will appear here once you start a classroom.</p>
                </div>
              ) : (
                history?.map((classroom) => (
                  <motion.div
                    key={classroom.id}
                    whileHover={{ scale: 1.01 }}
                    className="group relative flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:border-purple-200 hover:shadow-lg"
                  >
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                      <BookOpen className="h-8 w-8" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h3 className="truncate font-bold text-gray-900 group-hover:text-purple-700 transition-colors">
                        {classroom.topic}
                      </h3>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Layout className="h-3 w-3" />
                          {classroom.scenes?.length ?? "?"} Scenes
                        </span>
                        <Separator orientation="vertical" className="h-3" />
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Native Player
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenClassroom(classroom.id)}
                      className="rounded-full hover:bg-purple-600 hover:text-white transition-all transform group-hover:translate-x-1"
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
