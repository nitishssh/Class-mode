import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ApprovalKind = "objective" | "source" | "assessment";
type Step = 1 | 2 | 3 | 4;

type ApprovalsState = Partial<Record<ApprovalKind, { at: string; by: number }>>;

const STEPS: Array<{ id: Step; label: string }> = [
  { id: 1, label: "Source & objective" },
  { id: 2, label: "Approve outline" },
  { id: 3, label: "Preview" },
  { id: 4, label: "Recipients & publish" },
];

/**
 * Four-step teacher creation flow:
 * source/objective → approvals → preview → recipients/publish.
 * Publication stays disabled until all three approvals are recorded.
 */
export default function StudyArenaCreate() {
  const [step, setStep] = useState<Step>(1);
  const [sourceText, setSourceText] = useState("");
  const [objective, setObjective] = useState("");
  const [subject, setSubject] = useState("Mathematics");
  const [gradeLevel, setGradeLevel] = useState("");
  const [scriptJson, setScriptJson] = useState("");
  const [compilerJobId, setCompilerJobId] = useState<string | null>(null);
  const [compilerStatus, setCompilerStatus] = useState<string | null>(null);
  const [lessonVersionId, setLessonVersionId] = useState<string | null>(null);
  const [approvals, setApprovals] = useState<ApprovalsState>({});
  const [studentIdsText, setStudentIdsText] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approvalsComplete = useMemo(
    () => Boolean(approvals.objective && approvals.source && approvals.assessment),
    [approvals]
  );

  const parseStudentIds = (): number[] =>
    studentIdsText
      .split(/[\s,]+/)
      .map((part) => Number(part.trim()))
      .filter((id) => Number.isInteger(id) && id > 0);

  const api = async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(path, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      ...init,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.message || `Request failed (${response.status})`);
    }
    return body as T;
  };

  const enqueueCompile = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api<{
        jobId: string;
        status: string;
        lessonVersionId: string | null;
      }>("/api/study-arena-beta/compiler/jobs", {
        method: "POST",
        body: JSON.stringify({ sourceText, objective, subject, gradeLevel: gradeLevel || undefined }),
      });
      setCompilerJobId(result.jobId);
      setCompilerStatus(result.status);
      if (result.lessonVersionId) {
        setLessonVersionId(result.lessonVersionId);
        setStep(2);
        return;
      }
      // Poll briefly for sync/async completion.
      for (let i = 0; i < 20; i++) {
        await new Promise((resolve) => setTimeout(resolve, 750));
        const job = await api<{
          status: string;
          lessonVersionId: string | null;
          errorMessage: string | null;
        }>(`/api/study-arena-beta/compiler/jobs/${result.jobId}`);
        setCompilerStatus(job.status);
        if (job.status === "completed" && job.lessonVersionId) {
          setLessonVersionId(job.lessonVersionId);
          setStep(2);
          return;
        }
        if (job.status === "failed" || job.status === "cancelled") {
          throw new Error(job.errorMessage || `Compile ${job.status}`);
        }
      }
      throw new Error("Compile is still running. Refresh job status from step 1.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not compile lesson");
    } finally {
      setBusy(false);
    }
  };

  const createDraftFromScript = async () => {
    setBusy(true);
    setError(null);
    try {
      const script = JSON.parse(scriptJson);
      const result = await api<{ lessonVersionId: string }>("/api/study-arena-beta/lesson-drafts", {
        method: "POST",
        body: JSON.stringify({
          subject,
          gradeLevel: gradeLevel || undefined,
          objective,
          script,
        }),
      });
      setLessonVersionId(result.lessonVersionId);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create draft");
    } finally {
      setBusy(false);
    }
  };

  const recordApproval = async (kind: ApprovalKind) => {
    if (!lessonVersionId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ approvals: ApprovalsState; complete: boolean }>(
        `/api/study-arena-beta/lesson-versions/${lessonVersionId}/approvals`,
        { method: "POST", body: JSON.stringify({ kind }) }
      );
      setApprovals(result.approvals);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record approval");
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!lessonVersionId) return;
    const studentIds = parseStudentIds();
    if (studentIds.length === 0) {
      setError("Enter at least one student user ID.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ assignmentId: string }>(
        `/api/study-arena-beta/lesson-versions/${lessonVersionId}/publish`,
        {
          method: "POST",
          body: JSON.stringify({
            studentIds,
            dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
          }),
        }
      );
      setAssignmentId(result.assignmentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Study Arena</p>
        <h1 className="mt-1 font-display text-3xl text-foreground">Create a lesson</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Source and objective → approve outline → preview → publish to students.
        </p>
      </div>

      <ol className="grid gap-2 sm:grid-cols-4">
        {STEPS.map((item) => (
          <li
            key={item.id}
            className={cn(
              "rounded-xl border px-3 py-2 text-sm",
              step === item.id
                ? "border-accent bg-accent-soft text-foreground"
                : "border-border text-muted-foreground"
            )}
          >
            <span className="font-semibold">{item.id}.</span> {item.label}
          </li>
        ))}
      </ol>

      {error && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      {step === 1 && (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-xl">1. Source & objective</h2>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Subject</span>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Grade level (optional)</span>
            <Input value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Learning objective</span>
            <Textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              className="min-h-[72px]"
              placeholder="Students will isolate a variable in a one-step linear equation."
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Source material</span>
            <Textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              className="min-h-[140px]"
              placeholder="Paste textbook excerpt or notes the lesson should ground in…"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy || !sourceText.trim() || !objective.trim() || !subject.trim()}
              onClick={() => void enqueueCompile()}
              className="min-h-11"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Compile lesson"}
            </Button>
            {compilerStatus && (
              <span className="self-center text-sm text-muted-foreground">
                Job {compilerJobId?.slice(0, 8)}… · {compilerStatus}
              </span>
            )}
          </div>
          <div className="border-t border-border pt-4">
            <p className="mb-2 text-sm text-muted-foreground">Or paste a lesson script JSON for a draft:</p>
            <Textarea
              value={scriptJson}
              onChange={(e) => setScriptJson(e.target.value)}
              className="min-h-[120px] font-mono text-xs"
              placeholder='{"topic":"...","conceptIds":["linear-equations-isolation"],"scenes":[...]}'
            />
            <Button
              variant="outline"
              className="mt-2 min-h-11"
              disabled={busy || !scriptJson.trim() || !objective.trim()}
              onClick={() => void createDraftFromScript()}
            >
              Create draft from script
            </Button>
          </div>
        </section>
      )}

      {step === 2 && lessonVersionId && (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-xl">2. Approve outline</h2>
          <p className="text-sm text-muted-foreground">
            Record objective, source, and assessment approvals before publish. Draft{" "}
            <code className="text-xs">{lessonVersionId}</code>
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {(["objective", "source", "assessment"] as ApprovalKind[]).map((kind) => {
              const done = Boolean(approvals[kind]);
              return (
                <Button
                  key={kind}
                  variant={done ? "secondary" : "outline"}
                  disabled={busy || done}
                  className="min-h-11 capitalize"
                  onClick={() => void recordApproval(kind)}
                >
                  {done ? <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" /> : null}
                  Approve {kind}
                </Button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="min-h-11" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button className="min-h-11" disabled={!approvalsComplete} onClick={() => setStep(3)}>
              Continue to preview
            </Button>
          </div>
        </section>
      )}

      {step === 3 && lessonVersionId && (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-xl">3. Preview</h2>
          <p className="text-sm text-muted-foreground">
            Open a teacher preview session. Preview attempts never write learner evidence.
          </p>
          <Link href={`/study-arena-beta?preview=${lessonVersionId}`}>
            <Button className="min-h-11">Open preview player</Button>
          </Link>
          <div className="flex gap-2">
            <Button variant="outline" className="min-h-11" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button className="min-h-11" onClick={() => setStep(4)}>
              Continue to recipients
            </Button>
          </div>
        </section>
      )}

      {step === 4 && lessonVersionId && (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-xl">4. Recipients & publish</h2>
          {!approvalsComplete && (
            <p className="text-sm text-amber-800">
              Publish stays disabled until objective, source, and assessment approvals are complete.
            </p>
          )}
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Student user IDs (comma or space separated)</span>
            <Textarea
              value={studentIdsText}
              onChange={(e) => setStudentIdsText(e.target.value)}
              className="min-h-[80px]"
              placeholder="12, 15, 18"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Due at (optional)</span>
            <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="min-h-11" onClick={() => setStep(3)}>
              Back
            </Button>
            <Button
              className="min-h-11"
              disabled={busy || !approvalsComplete || !!assignmentId}
              onClick={() => void publish()}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish assignment"}
            </Button>
          </div>
          {assignmentId && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              Published.{" "}
              <Link className="underline" href={`/study-arena-report?assignment=${assignmentId}`}>
                Open assignment report
              </Link>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
