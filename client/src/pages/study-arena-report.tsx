import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StudentEvidence {
  student_id: number;
  student_name: string | null;
  session_status: string | null;
  next_action_index: number | null;
  assessment_correct: boolean | null;
  assessment_submitted_at: string | null;
  help_depth: number;
  current_scene_id: string | null;
  adaptive_path: string[];
  adaptive_decision: {
    fromSceneId: string | null;
    toSceneId: string | null;
    terminal: boolean;
    rationale: string;
    version: number;
  } | null;
  adaptive_decision_version: number | null;
  adaptive_rationale: string | null;
}

interface AssignmentReport {
  enrolled: number;
  started: number;
  independentlyAssessed: number;
  correct: number;
  students: StudentEvidence[];
  groups: Array<{
    key: "failed_transfer" | "high_help";
    label: string;
    studentIds: number[];
    suggestedAction: string;
  }>;
}

export default function StudyArenaReport() {
  // wouter's useLocation() returns the PATHNAME only — it never contains "?",
  // so splitting it for the query string always yielded undefined and this page
  // was permanently stuck on the "choose an assignment" empty state.
  // useSearch() is the reactive accessor for the query string (same pattern as
  // accept-invite.tsx).
  const search = useSearch();
  const assignmentId = new URLSearchParams(search).get("assignment");
  const [report, setReport] = useState<AssignmentReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recordedGroups, setRecordedGroups] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!assignmentId) return;
    void fetch(`/api/study-arena-beta/assignments/${assignmentId}/report`, {
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load this assignment report.");
        return response.json() as Promise<AssignmentReport>;
      })
      .then(setReport)
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : "Unable to load report.")
      );
  }, [assignmentId]);

  if (!assignmentId)
    return (
      <p className="text-sm text-muted-foreground">Choose an assignment to view its evidence.</p>
    );
  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (!report)
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  const recordFollowUp = async (group: AssignmentReport["groups"][number]) => {
    const actionNote = window.prompt(`Follow-up for ${group.label}:`, group.suggestedAction);
    if (!actionNote) return;
    const response = await fetch(
      `/api/study-arena-beta/assignments/${assignmentId}/interventions`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cohortKey: group.key, actionNote }),
      }
    );
    if (!response.ok) throw new Error("Could not record follow-up.");
    setRecordedGroups((current) => new Set(current).add(group.key));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-accent">
            Study Arena evidence
          </p>
          <h1 className="mt-1 font-display text-3xl text-foreground">Assignment progress</h1>
        </div>
        <Link href="/study-arena/create">
          <Button variant="outline" className="min-h-11">
            Create lesson
          </Button>
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Enrolled", report.enrolled],
          ["Started", report.started],
          ["Independent checks", report.independentlyAssessed],
          ["Correct", report.correct],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>
      <section className="space-y-3">
        <h2 className="font-display text-xl text-foreground">Recommended follow-up</h2>
        {report.groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Insufficient evidence for an intervention group.
          </p>
        ) : (
          report.groups.map((group) => (
            <div
              key={group.key}
              className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4"
            >
              <div>
                <p className="font-medium">
                  {group.label} · {group.studentIds.length}
                </p>
                <p className="text-sm text-muted-foreground">{group.suggestedAction}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={recordedGroups.has(group.key)}
                onClick={() => void recordFollowUp(group)}
              >
                {recordedGroups.has(group.key) ? "Recorded" : "Record follow-up"}
              </Button>
            </div>
          ))
        )}
      </section>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid gap-4 border-b border-border bg-muted/40 px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground lg:grid-cols-[minmax(9rem,1fr)_auto_auto_minmax(14rem,1.5fr)]">
          <span>Student</span>
          <span>Progress</span>
          <span>Independent check</span>
          <span>Adaptive path</span>
        </div>
        {report.students.map((student) => (
          <div
            key={student.student_id}
            className="grid gap-4 border-b border-border px-4 py-3 text-sm last:border-0 lg:grid-cols-[minmax(9rem,1fr)_auto_auto_minmax(14rem,1.5fr)]"
          >
            <span>{student.student_name ?? `Student ${student.student_id}`}</span>
            <span>
              {student.session_status ? `Step ${student.next_action_index ?? 0}` : "Not started"}
            </span>
            <span
              className={
                student.assessment_correct
                  ? "text-emerald-700"
                  : student.assessment_submitted_at
                    ? "text-amber-700"
                    : "text-muted-foreground"
              }
            >
              {student.assessment_correct
                ? "Correct"
                : student.assessment_submitted_at
                  ? "Needs follow-up"
                  : "Not submitted"}
            </span>
            <div className="min-w-0">
              {student.adaptive_decision ? (
                <>
                  <p className="truncate font-medium">
                    {student.adaptive_path.length > 0
                      ? student.adaptive_path.join(" → ")
                      : (student.current_scene_id ?? "Terminal")}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {student.adaptive_rationale ?? student.adaptive_decision.rationale} · decision v
                    {student.adaptive_decision_version ?? student.adaptive_decision.version}
                  </p>
                </>
              ) : (
                <span className="text-muted-foreground">Awaiting first decision</span>
              )}
            </div>
          </div>
        ))}
      </div>
      {/*
        "Open learner view" used to link to /study-arena-beta?assignment=... here.
        It could never work: the player opens by POSTing /assignment-session, which
        rejects any role that is not "student", so every role that can reach this
        report (teacher, admin, school_admin) got "Only assigned students can start
        a lesson". It went unnoticed because this page was itself unreachable until
        the useSearch() fix above. Removed rather than shipped as a dead end; see
        TODOS.md for rebuilding it on a read-only preview session.
      */}
    </div>
  );
}
