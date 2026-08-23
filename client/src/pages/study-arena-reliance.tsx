/**
 * Cross-assignment reliance — "which students are riding the hints?"
 *
 * Deliberately not a ranking: no rank numbers, no leaderboard, no student-facing
 * score. The question this page answers is "where should I spend the next twenty
 * minutes", so reliance is always shown next to whether the student could do it
 * alone, and a student without enough evidence is shown blank rather than guessed at.
 */

import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowDownRight, ArrowUpRight, Loader2, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StudentReliance {
  studentId: number;
  studentName: string | null;
  assignments: number;
  latestAssignmentId: string;
  gates: number;
  attempts: number;
  hints: number;
  hintFirstGates: number;
  reliance: number | null;
  trend: number | null;
  assessed: number;
  transferCorrect: number;
  transferFailed: number;
  prerequisiteGapConcepts: string[];
  recallOverdueConcepts: string[];
}

interface RelianceModel {
  windowDays: number;
  students: StudentReliance[];
  cohorts: Array<{
    key: "failed_transfer" | "high_help" | "prerequisite_gap" | "recall_overdue";
    label: string;
    studentIds: number[];
    suggestedAction: string;
  }>;
  insufficientEvidence: number[];
}

const WINDOWS = [7, 30, 90];

function TrendIcon({ trend }: { trend: number | null }) {
  if (trend === null)
    return <Minus className="h-4 w-4 text-muted-foreground" aria-label="No trend yet" />;
  if (trend > 0.05)
    return <ArrowUpRight className="h-4 w-4 text-amber-700" aria-label="Leaning on hints more" />;
  if (trend < -0.05)
    return (
      <ArrowDownRight className="h-4 w-4 text-emerald-700" aria-label="Leaning on hints less" />
    );
  return <Minus className="h-4 w-4 text-muted-foreground" aria-label="Steady" />;
}

export default function StudyArenaReliance() {
  const [windowDays, setWindowDays] = useState(30);
  const [model, setModel] = useState<RelianceModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recordedGroups, setRecordedGroups] = useState<Set<string>>(() => new Set());

  // The window buttons clear the previous window's rows before refetching, so
  // this effect only writes the response — no cascading setState on mount.
  useEffect(() => {
    let stale = false;
    void fetch(`/api/study-arena-beta/reliance?sinceDays=${windowDays}`, {
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load reliance for this window.");
        return response.json() as Promise<RelianceModel>;
      })
      .then((next) => {
        if (!stale) setModel(next);
      })
      .catch((loadError) => {
        if (!stale)
          setError(loadError instanceof Error ? loadError.message : "Unable to load reliance.");
      });
    return () => {
      stale = true;
    };
  }, [windowDays]);

  const selectWindow = (days: number) => {
    if (days === windowDays) return;
    setModel(null);
    setError(null);
    setWindowDays(days);
  };

  // A cohort is who; the concepts behind it are what to actually reteach.
  const conceptsFor = (cohort: RelianceModel["cohorts"][number]): string[] => {
    if (!model) return [];
    const key =
      cohort.key === "prerequisite_gap"
        ? "prerequisiteGapConcepts"
        : cohort.key === "recall_overdue"
          ? "recallOverdueConcepts"
          : null;
    if (!key) return [];
    return [
      ...new Set(
        model.students
          .filter((student) => cohort.studentIds.includes(student.studentId))
          .flatMap((student) => student[key])
      ),
    ];
  };

  const recordFollowUp = async (cohort: RelianceModel["cohorts"][number]) => {
    if (!model) return;
    // The interventions endpoint is per-assignment, so each student's note lands
    // on their own most recent assignment rather than an arbitrary shared one.
    const actionNote = window.prompt(`Follow-up for ${cohort.label}:`, cohort.suggestedAction);
    if (!actionNote) return;
    const targets = model.students.filter((student) =>
      cohort.studentIds.includes(student.studentId)
    );
    await Promise.all(
      targets.map((student) =>
        fetch(`/api/study-arena-beta/assignments/${student.latestAssignmentId}/interventions`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cohortKey: cohort.key,
            studentId: student.studentId,
            actionNote,
          }),
        })
      )
    );
    setRecordedGroups((current) => new Set(current).add(cohort.key));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-accent">
            Study Arena evidence
          </p>
          <h1 className="mt-1 font-display text-3xl text-foreground">Who is riding the hints?</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Taking a hint after trying is productive struggle. Taking one before trying is not.
          </p>
        </div>
        <div className="flex gap-2">
          {WINDOWS.map((days) => (
            <Button
              key={days}
              size="sm"
              variant={days === windowDays ? "default" : "outline"}
              className="min-h-11"
              onClick={() => selectWindow(days)}
            >
              {days}d
            </Button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {!model && !error && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </div>
      )}

      {model && model.students.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No attempt evidence in the last {model.windowDays} days. Publish an assignment and the
          pattern will build here.
        </p>
      )}

      {model && model.students.length > 0 && (
        <>
          <section className="space-y-3">
            <h2 className="font-display text-xl text-foreground">Suggested follow-up</h2>
            {model.cohorts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nobody stands out this window — attempts are outpacing hints.
              </p>
            ) : (
              model.cohorts.map((cohort) => (
                <div
                  key={cohort.key}
                  className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4"
                >
                  <div>
                    <p className="font-medium">
                      {cohort.label} · {cohort.studentIds.length}
                    </p>
                    <p className="text-sm text-muted-foreground">{cohort.suggestedAction}</p>
                    {conceptsFor(cohort).length > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {conceptsFor(cohort).join(" · ")}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={recordedGroups.has(cohort.key)}
                    onClick={() => void recordFollowUp(cohort)}
                  >
                    {recordedGroups.has(cohort.key) ? "Recorded" : "Record follow-up"}
                  </Button>
                </div>
              ))
            )}
          </section>

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="grid gap-4 border-b border-border bg-muted/40 px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground lg:grid-cols-[minmax(9rem,1fr)_auto_auto_auto_minmax(8rem,1fr)_minmax(8rem,1fr)]">
              <span>Student</span>
              <span>Lessons</span>
              <span>Hints before trying</span>
              <span>Trend</span>
              <span>On their own</span>
              <span>Concept flags</span>
            </div>
            {model.students.map((student) => (
              <div
                key={student.studentId}
                className="grid gap-4 border-b border-border px-4 py-3 text-sm last:border-0 lg:grid-cols-[minmax(9rem,1fr)_auto_auto_auto_minmax(8rem,1fr)_minmax(8rem,1fr)]"
              >
                <span>{student.studentName ?? `Student ${student.studentId}`}</span>
                <span className="text-muted-foreground">
                  {student.assignments} · {student.gates} gates
                </span>
                {student.reliance === null ? (
                  <span className="text-muted-foreground">Not enough evidence</span>
                ) : (
                  <span
                    className={
                      student.reliance >= 0.5
                        ? "font-medium text-amber-700"
                        : "text-muted-foreground"
                    }
                  >
                    {student.hintFirstGates} of {student.gates}
                  </span>
                )}
                <span className="flex items-center">
                  <TrendIcon trend={student.trend} />
                </span>
                <span
                  className={
                    student.transferFailed > 0
                      ? "text-amber-700"
                      : student.assessed > 0
                        ? "text-emerald-700"
                        : "text-muted-foreground"
                  }
                >
                  {student.assessed === 0
                    ? "Not checked yet"
                    : `${student.transferCorrect} of ${student.assessed} correct`}
                </span>
                <span className="min-w-0 text-xs text-muted-foreground">
                  {student.prerequisiteGapConcepts.length > 0 && (
                    <span className="block truncate text-amber-700">
                      Prerequisite: {student.prerequisiteGapConcepts.join(", ")}
                    </span>
                  )}
                  {student.recallOverdueConcepts.length > 0 && (
                    <span className="block truncate">
                      Recall due: {student.recallOverdueConcepts.join(", ")}
                    </span>
                  )}
                  {student.prerequisiteGapConcepts.length === 0 &&
                    student.recallOverdueConcepts.length === 0 &&
                    "—"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <Link href="/study-arena-report">
        <Button variant="outline" className="min-h-11">
          Back to a single assignment
        </Button>
      </Link>
    </div>
  );
}
