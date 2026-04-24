import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Trophy,
  Flame,
  Star,
  Zap,
  Target,
  BookOpen,
  Clock,
  CheckCircle2,
  Lock,
  TrendingUp,
  Calendar,
  Award,
  Brain,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AchievementBadge {
  id: string;
  name: string;
  description: string;
  icon: ReactNode;

  gradient: string;
  xp: number;
  earned: boolean;
  progress?: number;
  total?: number;
  earnedDate?: string;
  tier: "bronze" | "silver" | "gold" | "platinum";
}

const tierConfig = {
  bronze: {
    label: "Bronze",
    color: "text-amber-700 dark:text-amber-600",
    ring: "ring-amber-600/30",
    bg: "bg-amber-600/10",
  },
  silver: {
    label: "Silver",
    color: "text-slate-400",
    ring: "ring-slate-400/30",
    bg: "bg-slate-400/10",
  },
  gold: {
    label: "Gold",
    color: "text-amber-400",
    ring: "ring-amber-400/40",
    bg: "bg-amber-400/10",
  },
  platinum: {
    label: "Platinum",
    color: "text-violet-400",
    ring: "ring-violet-400/40",
    bg: "bg-violet-400/10",
  },
};

const BADGES: AchievementBadge[] = [
  {
    id: "1",
    name: "First Step",
    description: "Complete your first study session",
    icon: <Rocket className="h-7 w-7" />,
    gradient: "from-blue-500 to-cyan-500",
    xp: 50,
    earned: true,
    earnedDate: "Feb 18, 2026",
    tier: "bronze",
  },
  {
    id: "2",
    name: "Perfect Score",
    description: "Get 100% on any quiz or test",
    icon: <Star className="h-7 w-7" />,
    gradient: "from-amber-400 to-yellow-500",
    xp: 200,
    earned: true,
    earnedDate: "Mar 2, 2026",
    tier: "gold",
  },
  {
    id: "3",
    name: "3-Day Streak",
    description: "Study for 3 consecutive days",
    icon: <Flame className="h-7 w-7" />,
    gradient: "from-orange-400 to-red-500",
    xp: 75,
    earned: true,
    earnedDate: "Feb 20, 2026",
    tier: "bronze",
  },
  {
    id: "4",
    name: "7-Day Warrior",
    description: "Maintain a 7-day study streak",
    icon: <Flame className="h-7 w-7" />,
    gradient: "from-orange-500 to-rose-600",
    xp: 150,
    earned: true,
    earnedDate: "Feb 28, 2026",
    tier: "silver",
  },
  {
    id: "5",
    name: "Quick Learner",
    description: "Complete 5 topics in a single week",
    icon: <Zap className="h-7 w-7" />,
    gradient: "from-yellow-400 to-amber-500",
    xp: 120,
    earned: true,
    earnedDate: "Mar 4, 2026",
    tier: "silver",
  },
  {
    id: "6",
    name: "AI Explorer",
    description: "Have 10 sessions with the AI Tutor",
    icon: <Brain className="h-7 w-7" />,
    gradient: "from-violet-500 to-purple-600",
    xp: 100,
    earned: true,
    earnedDate: "Mar 6, 2026",
    tier: "silver",
  },
  {
    id: "7",
    name: "30-Day Legend",
    description: "Maintain a 30-day study streak",
    icon: <Trophy className="h-7 w-7" />,
    gradient: "from-amber-400 to-orange-500",
    xp: 500,
    earned: false,
    progress: 6,
    total: 30,
    tier: "gold",
  },
  {
    id: "8",
    name: "Test Conqueror",
    description: "Score above 90% on 10 tests",
    icon: <Target className="h-7 w-7" />,
    gradient: "from-emerald-500 to-teal-600",
    xp: 300,
    earned: false,
    progress: 4,
    total: 10,
    tier: "gold",
  },
  {
    id: "9",
    name: "Early Bird",
    description: "Complete 5 sessions before 8 AM",
    icon: <Clock className="h-7 w-7" />,
    gradient: "from-cyan-500 to-blue-500",
    xp: 150,
    earned: false,
    progress: 2,
    total: 5,
    tier: "silver",
  },
  {
    id: "10",
    name: "Bookworm",
    description: "Study every subject in a week",
    icon: <BookOpen className="h-7 w-7" />,
    gradient: "from-indigo-500 to-blue-600",
    xp: 200,
    earned: false,
    progress: 3,
    total: 5,
    tier: "silver",
  },
  {
    id: "11",
    name: "Grandmaster",
    description: "Earn 2000 XP total",
    icon: <Award className="h-7 w-7" />,
    gradient: "from-violet-500 to-indigo-600",
    xp: 1000,
    earned: false,
    progress: 695,
    total: 2000,
    tier: "platinum",
  },
  {
    id: "12",
    name: "Consistent Scholar",
    description: "Attend every class for a month",
    icon: <Calendar className="h-7 w-7" />,
    gradient: "from-teal-500 to-emerald-600",
    xp: 400,
    earned: false,
    progress: 0,
    total: 30,
    tier: "platinum",
  },
];

const CURRENT_XP = 695;
const NEXT_LEVEL_XP = 1000;
const LEVEL = 7;

function BadgeCard({ badge }: { badge: AchievementBadge }) {
  const tier = tierConfig[badge.tier];
  return (
    <Card
      className={cn(
        "group overflow-hidden border transition-all duration-200 hover:shadow-lg",
        badge.earned ? `ring-1 ${tier.ring}` : "opacity-75"
      )}
    >
      <CardContent className="flex flex-col items-center gap-3 p-4 text-center">
        {/* Badge Icon */}
        <div className="relative">
          <div
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-lg transition-transform group-hover:scale-110",
              badge.earned ? `bg-gradient-to-br ${badge.gradient}` : "bg-muted"
            )}
          >
            {badge.earned ? badge.icon : <Lock className="h-6 w-6 text-muted-foreground" />}
          </div>
          {badge.earned && (
            <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-emerald-500">
              <CheckCircle2 className="h-3 w-3 text-white" />
            </div>
          )}
        </div>

        {/* Tier badge */}
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
            tier.bg,
            tier.color
          )}
        >
          {tier.label}
        </span>

        {/* Name & desc */}
        <div>
          <p className="text-sm font-bold leading-tight">{badge.name}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {badge.description}
          </p>
        </div>

        {/* XP */}
        <div
          className={cn(
            "flex items-center gap-1 text-xs font-bold",
            badge.earned ? "text-amber-500" : "text-muted-foreground"
          )}
        >
          <Star className="h-3 w-3" />+{badge.xp} XP
        </div>

        {/* Progress bar for locked */}
        {!badge.earned && badge.progress !== undefined && badge.total !== undefined && (
          <div className="w-full">
            <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
              <span>Progress</span>
              <span className="font-semibold">
                {badge.progress}/{badge.total}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${badge.gradient} transition-all`}
                style={{ width: `${(badge.progress / badge.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Earned date */}
        {badge.earned && badge.earnedDate && (
          <p className="text-[10px] text-muted-foreground/60">Earned {badge.earnedDate}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function AchievementsPage() {
  const earnedCount = BADGES.filter((b) => b.earned).length;
  const totalXP = BADGES.filter((b) => b.earned).reduce((acc, b) => acc + b.xp, 0);

  return (
    <>
      <PageHeader
        title="Achievements"
        subtitle="Unlock badges, earn XP, and level up your learning journey."
        className="animate-fade-in-up"
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Achievements" }]}
      />

      {/* Level & XP Banner */}
      <Card
        className="animate-fade-in-up mb-6 overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 to-violet-500/5"
        style={{ animationDelay: "50ms" }}
      >
        <div className="h-1 w-full bg-gradient-to-r from-primary to-violet-500" />
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center gap-4">
            {/* Level Badge */}
            <div className="relative flex-shrink-0">
              <div className="flex h-16 w-16 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-violet-600 text-white shadow-xl">
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                  LVL
                </span>
                <span className="text-2xl font-black leading-none">{LEVEL}</span>
              </div>
              <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-amber-400">
                <Star className="h-2.5 w-2.5 text-white" />
              </div>
            </div>

            {/* XP Progress */}
            <div className="min-w-[200px] flex-1">
              <div className="mb-1 flex items-center justify-between">
                <div>
                  <span className="text-lg font-bold">{CURRENT_XP}</span>
                  <span className="text-sm text-muted-foreground"> / {NEXT_LEVEL_XP} XP</span>
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  Level {LEVEL + 1} in {NEXT_LEVEL_XP - CURRENT_XP} XP
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-violet-500 transition-all duration-1000"
                  style={{ width: `${(CURRENT_XP / NEXT_LEVEL_XP) * 100}%` }}
                />
              </div>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap items-center gap-4">
              {[
                {
                  label: "Badges Earned",
                  value: `${earnedCount}/${BADGES.length}`,
                  icon: <Trophy className="h-4 w-4 text-amber-500" />,
                },
                {
                  label: "Total XP",
                  value: totalXP.toLocaleString(),
                  icon: <Star className="h-4 w-4 text-amber-400" />,
                },
                {
                  label: "Current Streak",
                  value: "6 Days",
                  icon: <Flame className="h-4 w-4 text-orange-500" />,
                },
                {
                  label: "Completion",
                  value: `${Math.round((earnedCount / BADGES.length) * 100)}%`,
                  icon: <TrendingUp className="h-4 w-4 text-emerald-500" />,
                },
              ].map((stat, i) => (
                <div key={i} className="flex items-center gap-2">
                  {stat.icon}
                  <div>
                    <div className="text-base font-bold leading-tight">{stat.value}</div>
                    <div className="text-[10px] text-muted-foreground">{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Earned Badges */}
      <section className="animate-fade-in-up mb-8" style={{ animationDelay: "100ms" }}>
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Earned Badges
          </h2>
          <Badge className="border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400">
            {earnedCount} unlocked
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {BADGES.filter((b) => b.earned).map((badge, i) => (
            <div
              key={badge.id}
              className="animate-fade-in-up"
              style={{ animationDelay: `${100 + i * 40}ms` }}
            >
              <BadgeCard badge={badge} />
            </div>
          ))}
        </div>
      </section>

      {/* Locked Badges */}
      <section className="animate-fade-in-up" style={{ animationDelay: "300ms" }}>
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Badges to Unlock
          </h2>
          <Badge className="border bg-muted text-[10px] text-muted-foreground">
            {BADGES.length - earnedCount} remaining
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {BADGES.filter((b) => !b.earned).map((badge, i) => (
            <div
              key={badge.id}
              className="animate-fade-in-up"
              style={{ animationDelay: `${300 + i * 40}ms` }}
            >
              <BadgeCard badge={badge} />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
