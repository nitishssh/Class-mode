import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  clearStudyArenaResume,
  isUsableChoiceAction,
  readStudyArenaResume,
  writeStudyArenaResume,
  type StudyArenaResume,
} from "@/lib/study-arena-resume";
import { Sparkles, GraduationCap, Lightbulb, MessageCircleQuestion, Loader2 } from "lucide-react";

// ── Scene-script types (mirror server/services/study-arena/lesson-script.ts) ──

type AgentRole = "teacher" | "classmate" | "coach";

type SceneAction =
  | { type: "speak"; agent: AgentRole; text: string }
  | { type: "showSlide"; title: string; bullets: string[] }
  | {
      type: "ask";
      agent: AgentRole;
      prompt: string;
      expects: "freeText" | "choice";
      choices?: string[];
      gate: true;
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
      if (!action || !["speak", "showSlide", "ask"].includes(action.type)) {
        console.error("[study-arena] skipped unknown scene action", action);
        return [];
      }
      return [
        {
          key: `${si}-${ai}`,
          sceneIndex: si,
          action,
          gateIndex: action.type === "ask" ? gateCount++ : undefined,
        },
      ];
    })
  );
  return { flat, totalGates: gateCount };
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

// Mirror the server's zod caps (server/routes/study-arena-beta.ts) so an
// over-long topic or answer is trimmed before it is sent. Without this the
// request comes back 400 and the student is stuck retrying the same text.
const LIMITS = { topic: 300, question: 2000, answer: 4000 } as const;

/**
 * Honest, student-facing copy for a failed request.
 *
 * Never blames the student for a failure that isn't theirs — but a 400 IS
 * about what they typed, so say so. Reporting it as a connection problem
 * (the old fall-through) sent them to check their wifi and retry the same
 * text forever, which is both false and a dead end.
 */
function messageForError(err: unknown): string {
  const status = err instanceof ApiError ? err.status : 0;
  if (status === 401) return "Your session expired. Please sign in again.";
  if (status === 403 || status === 429) return "You've used today's AI time. Come back tomorrow.";
  if (status === 400) return "That was a bit too long — shorten it and try again.";
  if (status >= 500) return "That's on us — something broke. Please try again.";
  return "Couldn't reach the lesson service. Check your connection and try again.";
}

export default function StudyArenaBeta() {
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

  const startLesson = async () => {
    const t = topic.trim();
    if (!t) return;
    setPhase("generating");
    setGenError(null);
    clearStudyArenaResume(window.localStorage);
    setResumeCandidate(null);
    try {
      const newLessonId = crypto.randomUUID();
      const data = await postJson<LessonScript>("/api/study-arena-beta/lesson-script", {
        topic: t.slice(0, LIMITS.topic),
        lessonId: newLessonId,
      });
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
    if (current.action.type === "ask") return; // halt — wait for the student
    const id = setTimeout(() => setCursor((c) => c + 1), 650);
    return () => clearTimeout(id);
  }, [phase, current, cursor]);

  const advancePastAsk = useCallback(() => setCursor((c) => c + 1), []);

  const isAwaitingAnswer = phase === "playing" && current?.action.type === "ask";
  const finished = phase === "playing" && cursor >= flat.length;
  const sceneTotal = script?.scenes.length ?? 0;
  const sceneNow = current ? current.sceneIndex + 1 : sceneTotal;

  useEffect(() => {
    if (phase !== "playing" || !script || !lessonId) return;
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
  }, [cursor, finished, lessonId, phase, script, totalGates]);

  return (
    <div className="animate-fade-in-up mx-auto flex h-[calc(100dvh-7rem)] max-w-3xl flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-accent/10 bg-accent-soft">
            <Sparkles className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="font-display text-lg text-foreground">Study Arena</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
              Attempt-first · Beta
            </p>
          </div>
        </div>
        {phase === "playing" && (
          <span className="rounded-md bg-muted/50 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Scene {sceneNow} / {sceneTotal}
          </span>
        )}
      </div>

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
              onClick={startLesson}
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
          </div>
        </div>
      )}

      {/* Playing */}
      {phase === "playing" && (
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto pr-1">
          {flat.slice(0, cursor).map((fa) => (
            <ActionView key={fa.key} action={fa.action} response={responses[fa.key]} />
          ))}

          {isAwaitingAnswer && current && (
            <AskCard
              key={current.key}
              action={current.action as Extract<SceneAction, { type: "ask" }>}
              topic={script!.topic}
              lessonId={lessonId}
              actionKey={current.key}
              gateIndex={current.gateIndex ?? 0}
              totalGates={totalGates}
              onResolved={(answer, feedback) => {
                setResponses((r) => ({ ...r, [current.key]: { answer, feedback } }));
                advancePastAsk();
              }}
            />
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
  // Completed ask (history): show question + the student's own answer + feedback.
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
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

function AskCard({
  action,
  topic,
  lessonId,
  actionKey,
  gateIndex,
  totalGates,
  onResolved,
}: {
  action: Extract<SceneAction, { type: "ask" }>;
  topic: string;
  lessonId: string;
  actionKey: string;
  gateIndex: number;
  totalGates: number;
  onResolved: (answer: string, feedback: string) => void;
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
        }
      );
      if (res.proceed) {
        setFeedback(res.feedback);
      } else {
        // Not through the gate yet — show the nudge warmly and let them retry.
        setNudge(res.feedback);
      }
    } catch (err) {
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
    <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 shadow-soft">
      <AgentBubble agent={action.agent}>
        <span className="font-semibold">{action.prompt}</span>
      </AgentBubble>

      <div className="mt-4">
        {isChoice ? (
          <div className="flex flex-wrap gap-2">
            {action.choices!.map((c) => (
              <Button
                key={c}
                variant="outline"
                size="sm"
                disabled={submitting || !!feedback || eliminatedChoices.has(c)}
                onClick={() => {
                  setAnswer(c);
                  submit(c);
                }}
                className={cn(
                  "rounded-lg",
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
            placeholder="Type your attempt — even a rough idea counts…"
            className="min-h-[64px] resize-none rounded-xl bg-white"
            disabled={submitting || !!feedback}
          />
        )}

        {/* Pedagogy nudge: warm coach voice, not an error. */}
        {nudge && !feedback && (
          <div className="mt-3">
            <AgentBubble agent="coach">{nudge}</AgentBubble>
          </div>
        )}

        {/* Transport/system errors only. */}
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}

        {feedback ? (
          <div className="mt-3">
            <p className="text-sm italic text-amber-800">{feedback}</p>
            <div className="mt-3 flex gap-2">
              <Button
                onClick={() => onResolved(answer, feedback)}
                className="rounded-xl bg-accent text-white hover:bg-accent/90"
              >
                Continue
              </Button>
              <Button
                variant="outline"
                onClick={tryAgain}
                className="rounded-xl"
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
              className="mt-3 rounded-xl bg-accent text-white hover:bg-accent/90"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit attempt"}
            </Button>
          )
        )}
      </div>
    </div>
  );
}
