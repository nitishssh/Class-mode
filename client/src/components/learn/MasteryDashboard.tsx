import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow, isPast } from "date-fns";
import { Brain, CalendarClock, Target, TrendingUp, Sparkles } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MasteryRow {
  concept: string;
  subject: string | null;
  pMastery: number;
  confidence: number;
  updatedAt: string;
}

interface ReviewRow {
  concept: string;
  sm2Ef: number;
  intervalDays: number;
  repetitions: number;
  dueAt: string;
  lastReviewedAt: string | null;
}

interface MasteryDashboardData {
  mastery: MasteryRow[];
  reviews: ReviewRow[];
  dueCount: number;
}

/** Map a 0..1 mastery probability to a label + colour band. */
function masteryBand(p: number): { label: string; tone: string } {
  if (p >= 0.8) return { label: "Mastered", tone: "text-emerald-600" };
  if (p >= 0.6) return { label: "Proficient", tone: "text-accent" };
  if (p >= 0.35) return { label: "Developing", tone: "text-amber-600" };
  return { label: "Beginning", tone: "text-muted-foreground" };
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Brain;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft">
        <Icon className="h-4.5 w-4.5 text-accent" />
      </div>
      <div className="font-display text-3xl text-foreground">{value}</div>
      <div className="mt-1 text-sm font-medium text-foreground">{label}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

/**
 * Learner Mastery & Spaced-Repetition dashboard.
 *
 * Reads the per-student learner model (BKT mastery vector + SM-2 review
 * schedule) from `/api/learn/mastery` and renders concept mastery curves and
 * upcoming review cards, giving students transparent, actionable progress.
 */
export default function MasteryDashboard() {
  const { data, isLoading, isError } = useQuery<MasteryDashboardData>({
    queryKey: ["learn-mastery"],
    queryFn: async () => {
      const res = await fetch("/api/learn/mastery", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load mastery dashboard");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-border bg-card" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl border border-border bg-card" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
        Couldn't load your progress. Please try again in a moment.
      </div>
    );
  }

  const mastery = data?.mastery ?? [];
  const reviews = data?.reviews ?? [];
  const dueCount = data?.dueCount ?? 0;

  if (mastery.length === 0 && reviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft">
          <Sparkles className="h-8 w-8 text-accent" />
        </div>
        <div>
          <h3 className="font-display text-xl text-foreground">No progress yet</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Start an <span className="font-semibold text-accent">Ask</span> session with your AI
            tutor on any topic. As you work through concepts, your mastery levels and review
            schedule will appear here.
          </p>
        </div>
      </div>
    );
  }

  const avgMastery =
    mastery.length > 0
      ? Math.round((mastery.reduce((sum, m) => sum + m.pMastery, 0) / mastery.length) * 100)
      : 0;

  const dueReviews = reviews.filter((r) => isPast(new Date(r.dueAt)));
  const upcomingReviews = reviews.filter((r) => !isPast(new Date(r.dueAt)));

  return (
    <div className="space-y-8">
      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={Brain}
          label="Concepts tracked"
          value={String(mastery.length)}
          hint="across all your topics"
        />
        <StatCard
          icon={TrendingUp}
          label="Average mastery"
          value={`${avgMastery}%`}
          hint="weighted across concepts"
        />
        <StatCard
          icon={CalendarClock}
          label="Reviews due"
          value={String(dueCount)}
          hint={dueCount > 0 ? "ready to review now" : "you're all caught up"}
        />
      </div>

      {/* Mastery vector */}
      {mastery.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <Target className="h-4 w-4 text-accent" />
            <h3 className="font-display text-lg text-foreground">Concept mastery</h3>
          </div>
          <div className="space-y-3">
            {mastery.map((m) => {
              const pct = Math.round(m.pMastery * 100);
              const band = masteryBand(m.pMastery);
              return (
                <div
                  key={m.concept}
                  className="rounded-2xl border border-border bg-card p-4"
                  data-testid="mastery-row"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium text-foreground">{m.concept}</span>
                      {m.subject && (
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          {m.subject}
                        </Badge>
                      )}
                    </div>
                    <span className={cn("shrink-0 text-sm font-semibold", band.tone)}>
                      {pct}% · {band.label}
                    </span>
                  </div>
                  <Progress value={pct} className="h-2" />
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Confidence {Math.round(m.confidence * 100)}%</span>
                    <span>updated {formatDistanceToNow(new Date(m.updatedAt), { addSuffix: true })}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Review schedule */}
      {reviews.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-accent" />
            <h3 className="font-display text-lg text-foreground">Review schedule</h3>
          </div>

          {dueReviews.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-600">
                Due now
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {dueReviews.map((r) => (
                  <ReviewCard key={r.concept} review={r} due />
                ))}
              </div>
            </div>
          )}

          {upcomingReviews.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Upcoming
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {upcomingReviews.map((r) => (
                  <ReviewCard key={r.concept} review={r} />
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function ReviewCard({ review, due }: { review: ReviewRow; due?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-4",
        due ? "border-amber-500/40 bg-amber-500/5" : "border-border"
      )}
      data-testid="review-card"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="truncate font-medium text-foreground">{review.concept}</span>
        <span
          className={cn(
            "shrink-0 text-xs font-semibold",
            due ? "text-amber-600" : "text-muted-foreground"
          )}
        >
          {due ? "Due" : formatDistanceToNow(new Date(review.dueAt), { addSuffix: true })}
        </span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {review.repetitions} review{review.repetitions === 1 ? "" : "s"} · interval{" "}
        {review.intervalDays} day{review.intervalDays === 1 ? "" : "s"}
      </div>
    </div>
  );
}
