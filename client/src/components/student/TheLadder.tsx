import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Rocket, Target, Trophy, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { SmartCard } from "@/components/ui/smart-card";
import { Button } from "@/components/ui/button";

interface Milestone {
  id: number;
  phase: 'decide' | 'plan' | 'compete' | 'sorted';
  competencyId: number;
  competencyName: string;
  reflection: string | null;
  score: number;
  createdAt: string;
}

const PHASES = [
  { id: 'decide', label: 'Decide', icon: <Target className="h-4 w-4" />, description: 'Explore career paths' },
  { id: 'plan', label: 'Plan', icon: <Rocket className="h-4 w-4" />, description: 'Build your roadmap' },
  { id: 'compete', label: 'Compete', icon: <Trophy className="h-4 w-4" />, description: 'Join competitions' },
  { id: 'sorted', label: 'Sorted', icon: <Briefcase className="h-4 w-4" />, description: 'Placement ready' },
];

export function TheLadder({ className }: { className?: string }) {
  const { data: milestones = [], isLoading } = useQuery<Milestone[]>({
    queryKey: ["/api/lifecycle/milestones/me"],
  });

  const latestPhase = milestones.length > 0 
    ? milestones[0].phase 
    : null;

  const currentPhaseIndex = PHASES.findIndex(p => p.id === latestPhase);
  const readinessScore = Math.round(((currentPhaseIndex + 1) / PHASES.length) * 100) || 0;

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <SmartCard type="flat" className="bg-accent-soft border-accent/10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-widest text-accent">Career Readiness</span>
          <span className="text-lg font-display font-bold text-accent">{readinessScore}%</span>
        </div>
        <div className="h-2 w-full bg-background/50 rounded-full overflow-hidden">
          <div 
            className="h-full bg-accent transition-all duration-1000 ease-out" 
            style={{ width: `${readinessScore}%` }}
          />
        </div>
      </SmartCard>

      <div className="relative pl-8 space-y-8">
        {/* Timeline Line */}
        <div className="absolute left-[15px] top-2 bottom-2 w-0.5 border-l-2 border-dotted border-muted-foreground/30" />

        {PHASES.map((phase, idx) => {
          const isCompleted = idx <= currentPhaseIndex;
          const isCurrent = idx === currentPhaseIndex + 1;
          const isLocked = idx > currentPhaseIndex + 1;

          return (
            <div key={phase.id} className="relative">
              {/* Node Icon */}
              <div className={cn(
                "absolute -left-[25px] top-0 h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 shadow-sm",
                isCompleted ? "bg-progress border-progress text-white shadow-challenge" : 
                isCurrent ? "bg-background border-energy text-energy animate-pulse shadow-streak" : 
                "bg-background border-muted text-muted-foreground"
              )}>
                {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : phase.icon}
              </div>

              <div className={cn(
                "flex flex-col gap-1 transition-opacity duration-300",
                isLocked && "opacity-50"
              )}>
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-foreground">{phase.label}</h4>
                  {isCompleted && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-accent">
                      <Rocket className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-snug">
                  {phase.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      
      {readinessScore < 100 && (
        <div className="mt-4 p-4 rounded-xl bg-energy-soft border border-energy/10 text-center">
          <p className="text-xs font-medium text-energy-dark">
            Next: Complete your first project to unlock the "Plan" phase.
          </p>
        </div>
      )}
    </div>
  );
}
