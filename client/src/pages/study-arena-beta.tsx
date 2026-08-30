import confetti from "@/lib/confetti";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  STUDY_ARENA_LIMITS,
  clearStudyArenaResume,
  isUsableChoiceAction,
  readStudyArenaResume,
  studyArenaErrorMessage,
  writeStudyArenaResume,
  type StudyArenaResume,
} from "@/lib/study-arena-resume";
import { Sparkles, GraduationCap, Lightbulb, MessageCircleQuestion, Loader2 } from "lucide-react";

// ── Scene-script types (mirror server/services/study-arena/lesson-script.ts) ──

type AgentRole = "teacher" | "classmate" | "coach";

type SceneAction =
  | { type: "speak"; agent: AgentRole; text: string; a11y?: SceneActionA11y }
  | { type: "showSlide"; title: string; bullets: string[]; a11y?: SceneActionA11y }
  | { type: "highlight"; target: string; label: string; a11y?: SceneActionA11y }
  | {
      type: "ask";
      agent: AgentRole;
      prompt: string;
      expects: "freeText" | "choice";
      choices?: string[];
      gate: true;
      a11y?: SceneActionA11y;
    }
  | {
      type: "assessment";
      agent: AgentRole;
      prompt: string;
      assessmentId:
        | "linear-equations-immediate"
        | "linear-equations-delayed"
        | "photosynthesis-transfer"
        | "english-reading-inference"
        | "social-studies-causation";
      gate: true;
      a11y?: SceneActionA11y;
    };

type SceneActionA11y = {
  name: string;
  keyboardOperation: string;
  focusTarget: "next-gate" | "alert" | "self";
  textAlternative: string;
  ariaLive: "off" | "polite" | "assertive";
};

interface LessonScene {
  id: string;
  actions: SceneAction[];
}
interface LessonScript {
  topic: string;
  conceptIds: string[];
  scenes: LessonScene[];
}

type AssignedNextSegment =
  | {
      status: "ready";
      attemptSessionId: string;
      scene: LessonScene;
      gateIndex: number;
      decision: { version: number };
    }
  | {
      status: "completed";
      attemptSessionId: string;
      gateIndex: number;
      decision: { version: number };
    };

type LinearSprintPhase = "immediate" | "delayed";

interface FlatAction {
  key: string;
  sceneIndex: number;
  action: SceneAction;
  /** 0-based index among gated asks; undefined for non-ask actions. */
  gateIndex?: number;
}

function flattenScript(script: LessonScript): { flat: FlatAction[]; totalGates: number } {
  let gateCount = 0;
  const flat = script.scenes.flatMap((scene, si) =>
    scene.actions.flatMap((action, ai) => {
      if (
        !action ||
        !["speak", "showSlide", "highlight", "ask", "assessment"].includes(action.type)
      ) {
        console.error("[study-arena] skipped unknown scene action", action);
        return [];
      }
      return [
        {
          key: `${si}-${ai}`,
          sceneIndex: si,
          action,
          gateIndex:
            action.type === "ask" || action.type === "assessment" ? gateCount++ : undefined,
        },
      ];
    })
  );
  return { flat, totalGates: gateCount };
}

function flattenAssignedScene(scene: LessonScene, gateIndex: number): FlatAction[] {
  return scene.actions.flatMap((action, actionIndex) => {
    if (
      !action ||
      !["speak", "showSlide", "highlight", "ask", "assessment"].includes(action.type)
    ) {
      console.error("[study-arena] skipped unknown assigned scene action", action);
      return [];
    }
    return [
      {
        // The gate cursor comes from the server and is the only assigned-action
        // identifier used for evidence; never derive it from a local script.
        key: `assigned-${gateIndex}-${actionIndex}`,
        sceneIndex: gateIndex,
        action,
        gateIndex: action.type === "ask" || action.type === "assessment" ? gateIndex : undefined,
      },
    ];
  });
}

const AGENTS: Record<AgentRole, { label: string; className: string; icon: typeof GraduationCap }> =
  {
    teacher: { label: "Teacher", className: "text-accent", icon: GraduationCap },
    classmate: { label: "Classmate", className: "text-sky-600", icon: MessageCircleQuestion },
    coach: { label: "Coach", className: "text-amber-600", icon: Lightbulb },
  };

class ApiError extends Error {
  status: number;
  constructor(status: number) {
    super(`Request failed: ${status}`);
    this.status = status;
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  // Preserve the status so callers can tell "your session expired" from
  // "you're out of AI time for today" from "our fault" — a bare Error can't.
  if (!res.ok) throw new ApiError(res.status);
  return res.json() as Promise<T>;
}

const LIMITS = STUDY_ARENA_LIMITS;

function messageForError(err: unknown): string {
  return studyArenaErrorMessage(err instanceof ApiError ? err.status : 0);
}

export default function StudyArenaBeta() {
  const delayedRecallRequested =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("sprint") === "linear-equations" &&
    new URLSearchParams(window.location.search).get("review") === "delayed";
  const [phase, setPhase] = useState<"setup" | "generating" | "playing">("setup");
  const [topic, setTopic] = useState("");
  const [script, setScript] = useState<LessonScript | null>(null);
  const [flat, setFlat] = useState<FlatAction[]>([]);
  const [cursor, setCursor] = useState(0);
  const [genError, setGenError] = useState<string | null>(null);
  // A per-lesson id so gate answers roll up into "completed a full lesson"
  // server-side; total gate count travels with it for the same metric.
  const [lessonId, setLessonId] = useState<string>("");
  const [totalGates, setTotalGates] = useState(0);
  const [attemptSessionId, setAttemptSessionId] = useState<string | null>(null);
  const [isAssignedSession, setIsAssignedSession] = useState(false);
  const [awaitingAssignedSegment, setAwaitingAssignedSegment] = useState(false);
  const [assignedCompleted, setAssignedCompleted] = useState(false);
  const [assignedSegmentError, setAssignedSegmentError] = useState<string | null>(null);
  const [isPreviewSession, setIsPreviewSession] = useState(false);
  const [a11yStatus, setA11yStatus] = useState("Ready to begin.");
  const [resumeCandidate, setResumeCandidate] = useState<StudyArenaResume<LessonScript> | null>(
    () =>
      typeof window === "undefined"
        ? null
        : (readStudyArenaResume(window.localStorage) as StudyArenaResume<LessonScript> | null)
  );

  // Per-ask student responses, keyed by action key.
  const [responses, setResponses] = useState<Record<string, { answer: string; feedback: string }>>(
    {}
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [cursor, responses]);

  const loadAssignedSegment = useCallback(
    async (sessionId: string, completedActions: FlatAction[]) => {
      setAwaitingAssignedSegment(true);
      setAssignedSegmentError(null);
      setAssignedCompleted(false);
      // Keep only actions already delivered by the server while reconnecting.
      setFlat(completedActions);
      setCursor(completedActions.length);
      try {
        const segment = await postJson<AssignedNextSegment>(
          "/api/study-arena-beta/assignment-next-segment",
          { attemptSessionId: sessionId }
        );
        if (segment.status === "completed") {
          setAssignedCompleted(true);
          setA11yStatus("Lesson complete.");
          return;
        }
        const sceneActions = flattenAssignedScene(segment.scene, segment.gateIndex);
        if (!sceneActions.length) throw new Error("invalid assigned scene");
        setScript({ topic: "Assigned lesson", conceptIds: [], scenes: [segment.scene] });
        setFlat([...completedActions, ...sceneActions]);
        setCursor(completedActions.length);
        const gate = sceneActions.find(
          (fa) => fa.action.type === "ask" || fa.action.type === "assessment"
        );
        const a11yName =
          gate?.action.a11y?.name ??
          (gate?.action.type === "assessment" ? "Independent assessment" : "Attempt gate");
        setA11yStatus(`Scene ready. ${a11yName}.`);
      } catch (error) {
        console.error(error);
        setAssignedSegmentError(
          "We couldn't reload your lesson step. Check your connection and try again."
        );
      } finally {
        setAwaitingAssignedSegment(false);
      }
    },
    []
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const previewLessonVersionId = params.get("preview");
    const assignmentId = params.get("assignment");

    if (previewLessonVersionId) {
      setPhase("generating");
      clearStudyArenaResume(window.localStorage);
      setResumeCandidate(null);
      setIsPreviewSession(true);
      void postJson<{
        attemptSessionId: string;
        assignmentId: string;
        lessonVersionId: string;
        isPreview: boolean;
      }>(`/api/study-arena-beta/lesson-versions/${previewLessonVersionId}/preview-session`, {})
        .then((data) => {
          setLessonId(data.lessonVersionId);
          setScript({ topic: "Teacher preview", conceptIds: [], scenes: [] });
          setFlat([]);
          setCursor(0);
          setResponses({});
          setTotalGates(1);
          setAttemptSessionId(data.attemptSessionId);
          setIsAssignedSession(true);
          setAssignedCompleted(false);
          setA11yStatus("Teacher preview started. Progress will not affect learner evidence.");
          setPhase("playing");
          void loadAssignedSegment(data.attemptSessionId, []);
        })
        .catch((error) => {
          console.error(error);
          setGenError("This preview is unavailable. Open it again from lesson creation.");
          setPhase("setup");
        });
      return;
    }

    if (!assignmentId) return;
    setPhase("generating");
    clearStudyArenaResume(window.localStorage);
    setResumeCandidate(null);
    setIsPreviewSession(false);
    void postJson<{
      sessionId: string;
      nextActionIndex: number;
      assignmentId: string;
    }>("/api/study-arena-beta/assignment-session", { assignmentId })
      .then((data) => {
        setLessonId(assignmentId);
        // Assigned lessons are scene-by-scene. This placeholder supplies copy
        // for the existing interaction API; it is never a locally-held script.
        setScript({ topic: "Assigned lesson", conceptIds: [], scenes: [] });
        setFlat([]);
        setCursor(0);
        setResponses({});
        setTotalGates(1);
        setAttemptSessionId(data.sessionId);
        setIsAssignedSession(true);
        setAssignedCompleted(false);
        setA11yStatus("Assigned lesson session opened.");
        setPhase("playing");
        void loadAssignedSegment(data.sessionId, []);
      })
      .catch((error) => {
        console.error(error);
        setGenError("This assigned lesson is unavailable. Please ask your teacher for help.");
        setPhase("setup");
      });
  }, [loadAssignedSegment]);

  const startLesson = async (linearSprint?: LinearSprintPhase) => {
    const t = topic.trim();
    if (!t && !linearSprint) return;
    setPhase("generating");
    setGenError(null);
    setIsAssignedSession(false);
    setAwaitingAssignedSegment(false);
    setAssignedCompleted(false);
    setAssignedSegmentError(null);
    setAttemptSessionId(null);
    clearStudyArenaResume(window.localStorage);
    setResumeCandidate(null);
    try {
      const newLessonId = crypto.randomUUID();
      const data = await postJson<LessonScript>(
        linearSprint
          ? "/api/study-arena-beta/linear-equations-sprint"
          : "/api/study-arena-beta/lesson-script",
        linearSprint
          ? { phase: linearSprint }
          : { topic: t.slice(0, LIMITS.topic), lessonId: newLessonId }
      );
      const { flat: flattened, totalGates: gateCount } = flattenScript(data);
      // A script with no gated ask is a generation failure, not a lesson —
      // never let the player fall straight through to the "complete 🎉" card
      // (that would fabricate success, violating the demo-data-honesty rule).
      if (flattened.length === 0 || gateCount === 0) {
        setGenError("Couldn't build a full lesson for that. Try rephrasing the topic.");
        setPhase("setup");
        return;
      }
      setScript(data);
      setFlat(flattened);
      setLessonId(newLessonId);
      setTotalGates(gateCount);
      setCursor(0);
      setResponses({});
      setPhase("playing");
    } catch (err) {
      console.error(err);
      setGenError(messageForError(err));
      setPhase("setup");
    }
  };

  const continueLesson = () => {
    if (!resumeCandidate) return;
    try {
      const restoredScript = resumeCandidate.script;
      const restored = flattenScript(restoredScript);
      if (restored.flat.length === 0 || restored.totalGates === 0)
        throw new Error("invalid resume");
      setScript(restoredScript);
      setFlat(restored.flat);
      setLessonId(resumeCandidate.lessonId);
      setTotalGates(restored.totalGates);
      setCursor(Math.min(resumeCandidate.cursor, restored.flat.length - 1));
      setResponses({});
      setTopic(resumeCandidate.topic);
      setResumeCandidate(null);
      setPhase("playing");
    } catch {
      clearStudyArenaResume(window.localStorage);
      setResumeCandidate(null);
      setGenError("That saved lesson could not be restored. Please start a new one.");
    }
  };

  // Auto-advance through non-gated actions; halt on a gated `ask`.
  const current = flat[cursor];
  useEffect(() => {
    if (phase !== "playing" || !current) return;
    if (current.action.type === "ask" || current.action.type === "assessment") return; // halt — wait for the student
    const id = setTimeout(() => setCursor((c) => c + 1), 650);
    return () => clearTimeout(id);
  }, [phase, current, cursor]);

  const advancePastAsk = useCallback(() => setCursor((c) => c + 1), []);
  const resolveCurrentGate = useCallback(() => {
    if (isAssignedSession && attemptSessionId) {
      // A successful assigned gate changes server state. Drop the just-resolved
      // segment and obtain the one scene the server now permits.
      void loadAssignedSegment(attemptSessionId, flat.slice(0, cursor + 1));
      return;
    }
    advancePastAsk();
  }, [advancePastAsk, attemptSessionId, cursor, flat, isAssignedSession, loadAssignedSegment]);
  const reconnectAssignedSession = useCallback(() => {
    if (!attemptSessionId) return;
    void loadAssignedSegment(attemptSessionId, flat.slice(0, cursor));
  }, [attemptSessionId, cursor, flat, loadAssignedSegment]);

  const isAwaitingAnswer =
    phase === "playing" &&
    (current?.action.type === "ask" || current?.action.type === "assessment");
  const finished =
    phase === "playing" && (isAssignedSession ? assignedCompleted : cursor >= flat.length);
  const sceneTotal = script?.scenes.length ?? 0;
  const sceneNow = current ? current.sceneIndex + 1 : sceneTotal;

  useEffect(() => {
    if (isAssignedSession || phase !== "playing" || !script || !lessonId) return;
    if (finished) {
      clearStudyArenaResume(window.localStorage);
      return;
    }
    writeStudyArenaResume(window.localStorage, {
      version: 1,
      lessonId,
      topic: script.topic,
      script,
      cursor,
      totalGates,
      savedAt: new Date().toISOString(),
    });
  }, [cursor, finished, isAssignedSession, lessonId, phase, script, totalGates]);

  return (
    <div className="animate-fade-in-up mx-auto flex h-[calc(100dvh-7rem)] max-w-3xl flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-accent/10 bg-accent-soft">
            <Sparkles className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="font-display text-lg text-foreground">ClassMode Learning</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
              Attempt-first · Beta
            </p>
          </div>
        </div>
        {phase === "playing" && (
          <span className="rounded-md bg-muted/50 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {isPreviewSession
              ? "Teacher preview"
              : isAssignedSession
                ? "Assigned lesson"
                : `Scene ${sceneNow} / ${sceneTotal}`}
          </span>
        )}
      </div>

      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {a11yStatus}
      </div>

      {isPreviewSession && phase === "playing" && (
        <div
          role="status"
          className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          Preview mode — your answers are not saved as learner evidence.
        </div>
      )}

      {/* Setup */}
      {phase !== "playing" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
          <GraduationCap className="h-14 w-14 text-accent" strokeWidth={1.5} />
          <div>
            <h2 className="font-display text-2xl text-foreground">What should we learn?</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              I'll build a short interactive lesson — and I'll stop to make you think at every step,
              not just lecture at you.
            </p>
          </div>
          <div className="w-full max-w-md">
            {resumeCandidate && (
              <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-left">
                <p className="text-sm font-semibold text-amber-900">Continue where you left off?</p>
                <p className="mt-1 text-sm text-amber-800">{resumeCandidate.topic}</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={continueLesson} className="rounded-lg">
                    Continue lesson
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg"
                    onClick={() => {
                      clearStudyArenaResume(window.localStorage);
                      setResumeCandidate(null);
                    }}
                  >
                    Start over
                  </Button>
                </div>
              </div>
            )}
            <Textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => {
                if (window.matchMedia("(pointer: coarse)").matches) return;
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  startLesson();
                }
              }}
              placeholder="e.g. Photosynthesis, Pythagoras' theorem, Newton's second law"
              className="min-h-[56px] resize-none rounded-xl"
              disabled={phase === "generating"}
            />
            {genError && <p className="mt-2 text-sm text-rose-600">{genError}</p>}
            <Button
              onClick={() => void startLesson()}
              disabled={!topic.trim() || phase === "generating"}
              className="mt-3 w-full rounded-xl bg-accent text-white hover:bg-accent/90"
            >
              {phase === "generating" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Building your lesson…
                </>
              ) : (
                "Start lesson"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => void startLesson("immediate")}
              disabled={phase === "generating"}
              className="mt-2 w-full rounded-xl"
            >
              Try the linear equations mastery sprint
            </Button>
            {delayedRecallRequested && (
              <Button
                variant="outline"
                onClick={() => void startLesson("delayed")}
                disabled={phase === "generating"}
                className="mt-2 w-full rounded-xl border-amber-400 text-amber-800 hover:bg-amber-50"
              >
                Start your no-AI linear equations recall check
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Playing */}
      {phase === "playing" && (
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto pr-1">
          {flat.slice(0, cursor).map((fa) => (
            <ActionView key={fa.key} action={fa.action} response={responses[fa.key]} />
          ))}

          {isAwaitingAnswer &&
            current &&
            (current.action.type === "assessment" ? (
              <AssessmentCard
                key={current.key}
                action={current.action}
                lessonId={lessonId}
                attemptSessionId={attemptSessionId}
                actionIndex={current.gateIndex ?? 0}
                onResolved={(answer, feedback) => {
                  setResponses((r) => ({ ...r, [current.key]: { answer, feedback } }));
                  resolveCurrentGate();
                }}
                onReconnect={isAssignedSession ? reconnectAssignedSession : undefined}
              />
            ) : current.action.type === "ask" ? (
              <AskCard
                key={current.key}
                action={current.action}
                topic={script!.topic}
                lessonId={lessonId}
                actionKey={current.key}
                gateIndex={current.gateIndex ?? 0}
                totalGates={totalGates}
                attemptSessionId={attemptSessionId}
                onResolved={(answer, feedback) => {
                  setResponses((r) => ({ ...r, [current.key]: { answer, feedback } }));
                  resolveCurrentGate();
                }}
                onReconnect={isAssignedSession ? reconnectAssignedSession : undefined}
              />
            ) : null)}

          {awaitingAssignedSegment && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading your next lesson step…
            </div>
          )}
          {assignedSegmentError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-900">{assignedSegmentError}</p>
              <Button
                variant="outline"
                className="mt-3 rounded-xl"
                onClick={reconnectAssignedSession}
              >
                Reconnect lesson
              </Button>
            </div>
          )}

          {finished && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
              <p className="font-display text-lg text-emerald-800">Lesson complete 🎉</p>
              <p className="mt-1 text-sm text-emerald-700">
                You worked through every checkpoint yourself — that's how it sticks.
              </p>
              <Button
                variant="outline"
                className="mt-4 rounded-xl"
                onClick={() => {
                  clearStudyArenaResume(window.localStorage);
                  setPhase("setup");
                  setScript(null);
                  setFlat([]);
                  setTopic("");
                  setIsAssignedSession(false);
                  setAttemptSessionId(null);
                  setAssignedCompleted(false);
                }}
              >
                Learn something else
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Renderers ─────────────────────────────────────────────────────────────────

function AgentBubble({ agent, children }: { agent: AgentRole; children: React.ReactNode }) {
  const meta = AGENTS[agent];
  const Icon = meta.icon;
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted">
        <Icon className={cn("h-4 w-4", meta.className)} />
      </div>
      <div>
        <p className={cn("mb-0.5 text-[10px] font-bold uppercase tracking-widest", meta.className)}>
          {meta.label}
        </p>
        <div className="text-sm leading-relaxed text-foreground">{children}</div>
      </div>
    </div>
  );
}

function ActionView({
  action,
  response,
}: {
  action: SceneAction;
  response?: { answer: string; feedback: string };
}) {
  if (action.type === "speak") {
    return <AgentBubble agent={action.agent}>{action.text}</AgentBubble>;
  }
  if (action.type === "showSlide") {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h3 className="mb-3 font-display text-base text-foreground">{action.title}</h3>
        <ul className="space-y-1.5">
          {action.bullets.map((b, i) => (
            <li key={i} className="flex gap-2 text-sm text-muted-foreground">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              {b}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (action.type === "highlight") {
    return (
      <div className="rounded-xl border-l-4 border-accent bg-accent-soft p-4" role="note">
        <p className="text-xs font-bold uppercase tracking-widest text-accent">
          Focus: {action.target}
        </p>
        <p className="mt-1 text-sm text-foreground">{action.label}</p>
      </div>
    );
  }
  if (action.type === "assessment") {
    return (
      <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
        <AgentBubble agent={action.agent}>
          <span className="font-medium">{action.prompt}</span>
        </AgentBubble>
        {response && (
          <div className="mt-3 space-y-2 border-t border-sky-200/70 pt-3">
            <p className="text-sm text-foreground">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Your answer
              </span>
              <br />
              {response.answer}
            </p>
            <p className="text-sm italic text-sky-800">{response.feedback}</p>
          </div>
        )}
      </div>
    );
  }
  // Completed ask (history): show question + the student's own answer + feedback.
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-800 dark:bg-amber-950/30">
      <AgentBubble agent={action.agent}>
        <span className="font-medium">{action.prompt}</span>
      </AgentBubble>
      {response && (
        <div className="mt-3 space-y-2 border-t border-amber-200/70 pt-3">
          <p className="text-sm text-foreground">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Your answer
            </span>
            <br />
            {response.answer}
          </p>
          <p className="text-sm italic text-amber-800">{response.feedback}</p>
        </div>
      )}
    </div>
  );
}

function AssessmentCard({
  action,
  lessonId,
  attemptSessionId,
  actionIndex,
  onResolved,
  onReconnect,
}: {
  action: Extract<SceneAction, { type: "assessment" }>;
  lessonId: string;
  attemptSessionId: string | null;
  actionIndex: number;
  onResolved: (answer: string, feedback: string) => void;
  onReconnect?: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; feedback: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const value = answer.trim();
    if (!value || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      if (attemptSessionId) {
        const issued = await postJson<{ assessmentInstanceId: string; actionNonce: string }>(
          "/api/study-arena-beta/assignment-assessment-instance",
          { attemptSessionId, actionIndex }
        );
        const response = await postJson<{ correct: boolean; status?: string }>(
          "/api/study-arena-beta/assignment-assessment-submit",
          {
            attemptSessionId,
            assessmentInstanceId: issued.assessmentInstanceId,
            actionNonce: issued.actionNonce,
            answer: value,
            idempotencyKey: crypto.randomUUID(),
          }
        );
        
        if (response.status === "invalid") {
           setError("Attempt rejected (invalid answer key format).");
           return;
        }

        if (response.correct) {
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        } else {
          // Trigger shake by toggling a class
          const el = document.getElementById(`assessment-card-${actionIndex}`);
          if (el) {
            el.classList.remove("animate-shake");
            void el.offsetWidth; // trigger reflow
            el.classList.add("animate-shake");
          }
        }

        setResult({
          correct: response.correct,
          feedback: response.correct
            ? "Correct — your independent result has been recorded."
            : "Not quite. Review the earlier steps, then ask your teacher for another practice opportunity.",
        });
      } else {
        const response = await postJson<{ correct: boolean; feedback: string }>(
          "/api/study-arena-beta/assessment",
          { assessmentId: action.assessmentId, answer: value, lessonId }
        );
        setResult(response);
      }
    } catch (err) {
      if (attemptSessionId && err instanceof ApiError && err.status === 409) {
        onReconnect?.();
        return;
      }
      setError(messageForError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      id={`assessment-card-${actionIndex}`}
      className="rounded-2xl border-2 border-sky-300 bg-sky-50 p-5 shadow-soft"
      role="group"
      aria-label={action.a11y?.name ?? "Independent assessment"}
    >
      <AgentBubble agent={action.agent}>
        <span className="font-semibold" id="assessment-prompt">
          {action.prompt}
        </span>
      </AgentBubble>
      <p className="mt-2 text-xs font-medium text-sky-700">Independent check · AI hints are off</p>
      <Textarea
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        onKeyDown={(event) => {
          if (window.matchMedia("(pointer: coarse)").matches) return;
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void submit();
          }
        }}
        aria-label={action.a11y?.name ?? "Independent assessment answer"}
        aria-describedby="assessment-prompt"
        placeholder="Enter x = …"
        className="mt-4 min-h-[64px] resize-none rounded-xl bg-white"
        disabled={submitting || !!result}
      />
      {error && (
        <p role="alert" className="mt-2 text-sm text-rose-600">
          {error}
        </p>
      )}
      {result ? (
        <div className="mt-3">
          <p
            role="status"
            aria-live="assertive"
            className={cn("text-sm", result.correct ? "text-emerald-700" : "text-amber-800")}
          >
            {result.feedback}
          </p>
          <Button
            onClick={() => onResolved(answer.trim(), result.feedback)}
            aria-label="Continue after assessment"
            className="mt-3 min-h-11 rounded-xl bg-accent text-white hover:bg-accent/90"
          >
            Continue
          </Button>
        </div>
      ) : (
        <Button
          onClick={() => void submit()}
          disabled={!answer.trim() || submitting}
          aria-label={action.a11y?.name ?? "Submit independent answer"}
          className="mt-3 min-h-11 rounded-xl bg-accent text-white hover:bg-accent/90"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit independent answer"}
        </Button>
      )}
    </div>
  );
}

function AskCard({
  action,
  topic,
  lessonId,
  actionKey,
  gateIndex,
  totalGates,
  attemptSessionId,
  onResolved,
  onReconnect,
}: {
  action: Extract<SceneAction, { type: "ask" }>;
  topic: string;
  lessonId: string;
  actionKey: string;
  gateIndex: number;
  totalGates: number;
  attemptSessionId: string | null;
  onResolved: (answer: string, feedback: string) => void;
  onReconnect?: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  // A pedagogy nudge (the tutor asking the student to reconsider) is NOT an
  // error — keep the two channels separate so a "think again" never renders in
  // the same rose crash styling as a network failure.
  const [nudge, setNudge] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Attempts at THIS gate; escalates the server's support ladder on retry.
  const [attempt, setAttempt] = useState(1);
  const [eliminatedChoices, setEliminatedChoices] = useState<Set<string>>(() => new Set());
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // A "choice" gate is only usable with a real set of options; anything less
  // falls back to the free-text box rather than rendering zero buttons.
  const isChoice = isUsableChoiceAction(action);

  const submit = async (value: string) => {
    const v = value.trim();
    if (!v || submitting) return;
    setSubmitting(true);
    setError(null);
    setNudge(null);
    try {
      const res = await postJson<{ feedback: string; proceed: boolean }>(
        "/api/study-arena-beta/interaction",
        {
          topic: topic.slice(0, LIMITS.topic),
          question: action.prompt.slice(0, LIMITS.question),
          answer: v.slice(0, LIMITS.answer),
          lessonId,
          actionKey,
          gateIndex,
          totalGates,
          attempt,
          ...(attemptSessionId
            ? {
                attemptSessionId,
                actionIndex: gateIndex,
                idempotencyKey: crypto.randomUUID(),
              }
            : {}),
        }
      );
      if (res.proceed) {
        setFeedback(res.feedback);
      } else {
        // Not through the gate yet — show the nudge warmly and let them retry.
        setNudge(res.feedback);
      }
    } catch (err) {
      // A response can be lost after the server persisted evidence. Reloading
      // the next segment is replay-safe and avoids re-submitting a stale gate.
      if (attemptSessionId && err instanceof ApiError && err.status === 409) {
        onReconnect?.();
        return;
      }
      setError(messageForError(err));
    } finally {
      setSubmitting(false);
    }
  };

  // The escape hatch: a stuck student can ask for more help (escalates the
  // ladder) instead of being trapped at a gate they can't answer.
  const tryAgain = () => {
    if (isChoice && answer) {
      setEliminatedChoices((choices) => new Set(choices).add(answer));
      setAnswer("");
    }
    setAttempt((a) => a + 1);
    setFeedback(null);
    setNudge(null);
    if (!isChoice) setAnswer("");
  };

  return (
    <div
      className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 shadow-soft dark:border-amber-700 dark:bg-amber-950/40"
      role="group"
      aria-label={action.a11y?.name ?? "Attempt gate"}
    >
      <AgentBubble agent={action.agent}>
        <span className="font-semibold" id={`gate-prompt-${gateIndex}`}>
          {action.prompt}
        </span>
      </AgentBubble>

      <div className="mt-4">
        {isChoice ? (
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-labelledby={`gate-prompt-${gateIndex}`}
          >
            {action.choices!.map((c) => (
              <Button
                key={c}
                variant="outline"
                size="sm"
                disabled={submitting || !!feedback || eliminatedChoices.has(c)}
                aria-label={`Choose answer: ${c}`}
                onClick={() => {
                  setAnswer(c);
                  submit(c);
                }}
                className={cn(
                  "min-h-11 rounded-lg px-4",
                  answer === c && "border-amber-500 bg-amber-100",
                  eliminatedChoices.has(c) && "line-through opacity-40"
                )}
              >
                {c}
              </Button>
            ))}
          </div>
        ) : (
          <Textarea
            ref={inputRef}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (window.matchMedia("(pointer: coarse)").matches) return;
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(answer);
              }
            }}
            onFocus={() => {
              window.requestAnimationFrame(() =>
                inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
              );
            }}
            aria-label={action.a11y?.name ?? "Your attempt"}
            aria-describedby={`gate-prompt-${gateIndex}`}
            placeholder="Type your attempt — even a rough idea counts…"
            className="min-h-[64px] resize-none rounded-xl bg-white"
            disabled={submitting || !!feedback}
          />
        )}

        {/* Pedagogy nudge: warm coach voice, not an error. */}
        {nudge && !feedback && (
          <div className="mt-3" role="status" aria-live="polite">
            <AgentBubble agent="coach">{nudge}</AgentBubble>
          </div>
        )}

        {/* Transport/system errors only. */}
        {error && (
          <p role="alert" className="mt-2 text-sm text-rose-600">
            {error}
          </p>
        )}

        {feedback ? (
          <div className="mt-3">
            <p className="text-sm italic text-amber-800">{feedback}</p>
            <div className="mt-3 flex gap-2">
              <Button
                onClick={() => onResolved(answer, feedback)}
                aria-label="Continue to next step"
                className="min-h-11 rounded-xl bg-accent text-white hover:bg-accent/90"
              >
                Continue
              </Button>
              <Button
                variant="outline"
                onClick={tryAgain}
                className="min-h-11 rounded-xl"
                title="Get more help and try this one again"
              >
                Try again
              </Button>
            </div>
          </div>
        ) : (
          !isChoice && (
            <Button
              onClick={() => submit(answer)}
              disabled={!answer.trim() || submitting}
              aria-label={action.a11y?.name ?? "Submit attempt"}
              className="mt-3 min-h-11 rounded-xl bg-accent text-white hover:bg-accent/90"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit attempt"}
            </Button>
          )
        )}
      </div>
    </div>
  );
}
