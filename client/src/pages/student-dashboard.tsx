import { useState } from "react";
import { Link } from "wouter";
import {
  BookOpen,
  Brain,
  Trophy,
  Calendar,
  CheckCircle2,
  Play,
  Atom,
  FlaskConical,
  Calculator,
  Leaf,
  Code2,
  Headphones,
  UserCheck,
  BellRing,
  Sparkles,
  Video,
  Award,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFirebaseAuth } from "@/contexts/firebase-auth-context";
import { PageHeader } from "@/components/layout/page-header";
import { SmartCard } from "@/components/ui/smart-card";
import { StreakWidget } from "@/components/student/StreakWidget";
import { XPProgressBar } from "@/components/student/XPProgressBar";
import { TheLadder } from "@/components/student/TheLadder";
import { SocraticAssistant } from "@/components/student/SocraticAssistant";
import { BadgePop } from "@/components/student/animations/BadgePop";

import { useQuery } from "@tanstack/react-query";

// ─── Helpers ────────────────────────────────────────────────────────────────

const subjectMeta: Record<
  string,
  {
    icon: React.ReactNode;
    textColor: string;
    bgColor: string;
    accentColor: string;
  }
> = {
  Physics: {
    icon: <Atom className="h-5 w-5" />,
    textColor: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-500/10",
    accentColor: "bg-blue-500/30",
  },
  Chemistry: {
    icon: <FlaskConical className="h-5 w-5" />,
    textColor: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-500/10",
    accentColor: "bg-orange-500/30",
  },
  Mathematics: {
    icon: <Calculator className="h-5 w-5" />,
    textColor: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-500/10",
    accentColor: "bg-indigo-500/30",
  },
  Biology: {
    icon: <Leaf className="h-5 w-5" />,
    textColor: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-500/10",
    accentColor: "bg-emerald-500/30",
  },
  "Computer Science": {
    icon: <Code2 className="h-5 w-5" />,
    textColor: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-500/10",
    accentColor: "bg-purple-500/30",
  },
};

const getTimetableCellColor = (name: string) => {
  const colors: Record<string, string> = {
    Physics: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    Chemistry: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    Mathematics: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    Biology: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    CS: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    English: "bg-muted text-muted-foreground",
    Lunch: "bg-muted text-muted-foreground font-medium",
  };
  return colors[name] || "bg-card text-muted-foreground";
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function StudentDashboard() {
  const { currentUser } = useFirebaseAuth();
  const [communitiesOpen, setCommunitiesOpen] = useState(false);
  const [showBadge, setShowBadge] = useState(false);
  const [earnedBadge, setEarnedBadge] = useState<{
    name: string;
    emoji: string;
    description: string;
  } | null>(null);

  const { data: dashboardData, isLoading } = useQuery<any>({
    queryKey: ["/api/dashboards/student"],
  });

  const triggerBadge = () => {
    setEarnedBadge({
      name: "Knowledge Seeker",
      emoji: "📚",
      description:
        "You've successfully refactored the Class Mode design guide! Your dedication to student psychology is unmatched.",
    });
    setShowBadge(true);
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const {
    profile,
    subjects = [],
    upcomingTests = [],
    recentResults = [],
    tasks = [],
  } = dashboardData || {};

  const heroSession = upcomingTests[0]
    ? {
        subject: upcomingTests[0].subject,
        topic: upcomingTests[0].testTitle || upcomingTests[0].topic,
        progress: 0,
        examIn: new Date(upcomingTests[0].dueDate).toLocaleDateString(),
        isExamSoon: true,
        lastStudied: "N/A",
      }
    : null;

  const quickActions = [
    {
      title: "Ask AI Tutor",
      desc: "Get instant help",
      icon: <Brain className="h-6 w-6" />,
      href: "/ai-tutor",
      isPrimary: true,
    },
    {
      title: "Join Room",
      desc: "Study with peers",
      icon: <Video className="h-6 w-6" />,
      href: "/messages",
      isPrimary: false,
    },
    {
      title: "Focus Session",
      desc: "Timed deep work",
      icon: <Headphones className="h-6 w-6" />,
      href: "/focus",
      isPrimary: false,
    },
    {
      title: "Find Partner",
      desc: "Match study buddy",
      icon: <UserCheck className="h-6 w-6" />,
      href: "/partners",
      isPrimary: false,
    },
  ];

  return (
    <div className="flex flex-col gap-8 pb-20 lg:pb-8">
      <PageHeader
        title={`Welcome back, ${profile?.displayName || profile?.name || currentUser?.profile?.displayName || "Scholar"} 👋`}
        subtitle="Keep up the great work! Here's your learning overview."
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Student Dashboard" }]}
      >
        <Button
          asChild
          variant="default"
          className="rounded-full bg-accent shadow-soft hover:bg-accent-hover"
        >
          <Link href="/ai-tutor">
            <Sparkles className="mr-2 h-4 w-4" />
            AI Tutor
          </Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Primary & Secondary Tiers: Learning Stage */}
        <div className="lg:col-span-8 space-y-10">
          <section className="animate-fade-in-up grid grid-cols-1 gap-6 md:grid-cols-2">
            <StreakWidget
              streak={profile?.streak || 0}
              activity={[true, true, true, true, true, true, false]}
            />
            <XPProgressBar
              currentXP={profile?.xp || 0}
              nextLevelXP={1000}
              level={profile?.level || 1}
            />
          </section>

          <div className="grid grid-cols-1 gap-5">
            {heroSession ? (
              <div className="animate-fade-in-up overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
                <div className="p-8">
                  <div className="mb-8 flex items-start justify-between">
                    <div>
                      <div className="mb-3 flex items-center gap-2">
                        <Badge variant="default">Current Topic</Badge>
                        <Badge variant="live">Exam in {heroSession.examIn}</Badge>
                      </div>
                      <h2 className="font-display text-3xl leading-tight tracking-tight text-foreground">
                        {heroSession.topic}
                      </h2>
                      <p className="mt-1 text-base font-medium text-muted-foreground">
                        {heroSession.subject}
                      </p>
                    </div>
                    <div
                      className={`rounded-2xl p-4 ${subjectMeta[heroSession.subject]?.bgColor || "bg-muted"} ${subjectMeta[heroSession.subject]?.textColor || "text-foreground"} flex-shrink-0 shadow-soft`}
                    >
                      {subjectMeta[heroSession.subject]?.icon || <BookOpen className="h-5 w-5" />}
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <Button asChild className="flex-1 shadow-card">
                      <Link href="/ai-tutor">
                        <Play className="mr-2 h-4 w-4" />
                        Continue Learning
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card/50 p-8">
                <Calendar className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="text-lg font-semibold text-foreground">No upcoming tests</h3>
                <p className="text-sm text-muted-foreground">Take a break or review your notes.</p>
              </div>
            )}

            <div className="animate-fade-in-up mt-4">
              <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                <Sparkles className="h-4 w-4" /> Quick Actions
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {quickActions.map((action, i) => (
                  <Link key={i} href={action.href}>
                    <Card
                      className={`group h-full cursor-pointer border-border transition-all duration-200 hover:-translate-y-1 hover:shadow-card ${action.isPrimary ? "border-accent/10 bg-accent-soft" : "bg-card"}`}
                    >
                      <CardContent className="flex flex-col gap-3 p-4">
                        <div
                          className={`w-fit rounded-xl bg-background/50 p-2.5 shadow-soft backdrop-blur-sm transition-shadow group-hover:shadow-md ${action.isPrimary ? "text-accent" : "text-muted-foreground"}`}
                        >
                          {action.icon}
                        </div>
                        <div>
                          <div className="text-sm font-semibold leading-tight text-foreground">
                            {action.title}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <section className="animate-fade-in-up">
            <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <BookOpen className="h-4 w-4" /> Course Progress
            </h2>
            {subjects.length === 0 ? (
              <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
                You are not enrolled in any courses yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
                {subjects.map((subjectName: string, index: number) => {
                  const meta = subjectMeta[subjectName] || {
                    icon: <BookOpen />,
                    textColor: "text-foreground",
                    accentColor: "bg-accent",
                  };
                  return (
                    <SmartCard key={subjectName} type="flat" className="group hover:-translate-y-2">
                      <div className="mb-4 flex items-center justify-between">
                        <div
                          className={`rounded-xl bg-background/50 p-2.5 shadow-soft backdrop-blur-sm transition-transform group-hover:scale-110`}
                        >
                          <span className={meta.textColor}>{meta.icon}</span>
                        </div>
                      </div>
                      <div
                        className="truncate text-sm font-bold text-foreground"
                        title={subjectName}
                      >
                        {subjectName}
                      </div>
                    </SmartCard>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Secondary Tier: The Ladder */}
        <div className="lg:col-span-4 space-y-8 lg:sticky lg:top-8">
          <section className="animate-fade-in-up">
            <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <Sparkles className="h-4 w-4" /> Doubts
            </h2>
            <SocraticAssistant />
          </section>

          <section className="animate-fade-in-up">
            <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <Trophy className="h-4 w-4" /> The Ladder
            </h2>
            <TheLadder />
          </section>

          <section className="animate-fade-in-up">
            <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" /> Achievements
            </h2>
            {recentResults.length === 0 ? (
              <div className="rounded-xl border bg-card p-6 text-center text-muted-foreground">
                Your results will appear here after your first test.
              </div>
            ) : (
              <div className="space-y-3">
                {recentResults.slice(0, 3).map((result: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-all hover:shadow-soft"
                  >
                    <div className="flex-shrink-0 rounded-xl bg-emerald-500/10 p-2.5 text-emerald-700 shadow-soft">
                      <Award className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-foreground">
                        Attempt #{result.id}
                      </div>
                      <div className="text-[10px] font-medium text-muted-foreground">
                        Score: {result.score || 0}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <BadgePop badge={earnedBadge} isOpen={showBadge} onClose={() => setShowBadge(false)} />
      {!showBadge && (
        <Button
          onClick={triggerBadge}
          className="fixed bottom-8 right-8 h-14 w-14 animate-bounce rounded-full border-2 border-white/20 bg-energy shadow-modal hover:bg-energy-dark z-50 lg:hidden"
        >
          <Award className="h-7 w-7 text-white" />
        </Button>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-8 p-8">
      <div className="h-20 w-full rounded-xl bg-muted" />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="h-64 rounded-xl bg-muted lg:col-span-3" />
        <div className="h-64 rounded-xl bg-muted lg:col-span-2" />
      </div>
    </div>
  );
}
