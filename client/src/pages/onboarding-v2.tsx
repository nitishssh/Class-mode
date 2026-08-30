import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  Check,
  Compass,
  Crown,
  GraduationCap,
  Map,
  Medal,
  School,
  Sparkles,
  Target,
  Trophy,
  Users,
  Wand2,
} from "lucide-react";
import { StepCard } from "@/components/onboarding/StepCard";
import { ProgressBar } from "@/components/onboarding/ProgressBar";
import { ChipSelect } from "@/components/onboarding/ChipSelect";
import { CelebrationScreen } from "@/components/onboarding/CelebrationScreen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getDashboardPath, canChooseOnboardingRole } from "@/lib/role-routes";
import {
  loadOnboardingProgress,
  saveOnboardingProgress,
  clearOnboardingProgress,
} from "@/lib/onboarding-persistence";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface OnboardingData {
  role: "principal" | "teacher" | "school_admin" | "";
  userType: string;
  name: string;
  city: string;
  board: string;
  subjects: string[];
  grades: string[];
  approximateStudents: string;
  currentTools: string[];
  discoverySource: string;
}

const TOTAL_STEPS = 6;

const DEFAULT_DATA: OnboardingData = {
  role: "",
  userType: "",
  name: "",
  city: "",
  board: "",
  subjects: [],
  grades: [],
  approximateStudents: "",
  currentTools: [],
  discoverySource: "",
};

const BOARDS = [
  { label: "CBSE", value: "CBSE" },
  { label: "ICSE", value: "ICSE" },
  { label: "State", value: "State" },
  { label: "IB", value: "IB" },
  { label: "Other", value: "Other" },
];

const SUBJECTS = [
  { label: "Math", value: "Math" },
  { label: "Physics", value: "Physics" },
  { label: "Chemistry", value: "Chemistry" },
  { label: "Biology", value: "Biology" },
  { label: "English", value: "English" },
  { label: "History", value: "History" },
  { label: "Computer Science", value: "Computer Science" },
];

const GRADES = [
  { label: "1-5", value: "1-5" },
  { label: "6-8", value: "6-8" },
  { label: "9-10", value: "9-10" },
  { label: "11-12", value: "11-12" },
];

const SIZES = [
  { label: "1-50", value: "1-50" },
  { label: "50-200", value: "50-200" },
  { label: "200-500", value: "200-500" },
  { label: "500+", value: "500+" },
];

const TOOLS = [
  { label: "WhatsApp groups", value: "WhatsApp groups" },
  { label: "Google Classroom", value: "Google Classroom" },
  { label: "Paper registers", value: "Paper registers" },
  { label: "Excel/Sheets", value: "Excel/Sheets" },
  { label: "Another app", value: "Another app" },
  { label: "Nothing", value: "Nothing" },
];

const SOURCES = [
  { label: "Google search", value: "Google search" },
  { label: "Friend/colleague", value: "Friend/colleague" },
  { label: "Social media", value: "Social media" },
  { label: "YouTube", value: "YouTube" },
  { label: "WhatsApp forward", value: "WhatsApp forward" },
  { label: "Other", value: "Other" },
];

const ROLES = [
  {
    label: "School Owner / Principal",
    value: "principal",
    userType: "school_owner",
    icon: Crown,
    reward: "Leadership dashboard",
    description: "Track school-wide learning signals.",
  },
  {
    label: "Teacher",
    value: "teacher",
    userType: "teacher",
    icon: GraduationCap,
    reward: "Classroom insights",
    description: "Spot who needs help before marks drop.",
  },
  {
    label: "Coaching Center Owner",
    value: "school_admin",
    userType: "coaching_center_owner",
    icon: Building2,
    reward: "Batch analytics",
    description: "Compare cohorts and test readiness.",
  },
  {
    label: "Tutor",
    value: "teacher",
    userType: "independent_tutor",
    icon: BookOpen,
    reward: "Learner progress map",
    description: "Personalize practice for each student.",
  },
];

const STEP_META = [
  {
    title: "Choose your path",
    short: "Role",
    reward: "Analytics lens",
    icon: Compass,
  },
  {
    title: "Name your realm",
    short: "Campus",
    reward: "Workspace shell",
    icon: School,
  },
  {
    title: "Set curriculum terrain",
    short: "Subjects",
    reward: "Skill map",
    icon: BookOpen,
  },
  {
    title: "Size your cohort",
    short: "Scale",
    reward: "Benchmarks",
    icon: Users,
  },
  {
    title: "Mark old tools",
    short: "Tools",
    reward: "Migration hints",
    icon: Wand2,
  },
  {
    title: "Launch command center",
    short: "Launch",
    reward: "First win",
    icon: Trophy,
  },
];

function useUnlockedCount(data: OnboardingData, step: Step) {
  return useMemo(() => {
    const checks = [
      Boolean(data.role && data.userType),
      Boolean(data.name && data.city),
      Boolean(data.board && data.subjects.length > 0),
      Boolean(data.grades.length > 0 && data.approximateStudents),
      data.currentTools.length > 0,
      Boolean(data.discoverySource),
    ];

    return Math.max(checks.filter(Boolean).length, Math.min(step - 1, TOTAL_STEPS));
  }, [data, step]);
}

function OnboardingMap({
  data,
  step,
  unlockedCount,
}: {
  data: OnboardingData;
  step: Step;
  unlockedCount: number;
}) {
  const selectedRole = ROLES.find((role) => role.userType === data.userType);
  const xp = Math.min(unlockedCount * 120 + (step < 7 ? 40 : 120), 760);
  const analyticsCompleteness = Math.round((unlockedCount / TOTAL_STEPS) * 100);
  const subjects = data.subjects.length ? data.subjects.slice(0, 3).join(", ") : "No subjects yet";

  return (
    <aside className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
      <div className="absolute inset-0 opacity-60">
        <div className="absolute left-6 top-8 h-40 w-40 rounded-full bg-progress/10 blur-3xl" />
        <div className="absolute bottom-16 right-8 h-44 w-44 rounded-full bg-energy/20 blur-3xl" />
      </div>

      <div className="relative flex h-full flex-col">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Setup quest
            </p>
            <h2 className="mt-1 font-display text-3xl font-semibold text-foreground">
              Analytics Realm
            </h2>
          </div>
          <Badge className="border-energy/30 bg-energy-soft text-energy-dark">XP {xp}</Badge>
        </div>

        <div className="rounded-xl border border-border bg-background/70 p-4">
          <div className="mb-3 flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Readiness</span>
            <span>{analyticsCompleteness}%</span>
          </div>
          <ProgressBar currentStep={unlockedCount} totalSteps={TOTAL_STEPS} />
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-progress-soft p-3 text-progress">
              <BarChart3 className="mb-2 h-4 w-4" />
              <div className="text-lg font-bold">{data.subjects.length || 0}</div>
              <div className="text-[10px] font-semibold uppercase">Signals</div>
            </div>
            <div className="rounded-lg bg-accent-soft p-3 text-accent">
              <Target className="mb-2 h-4 w-4" />
              <div className="text-lg font-bold">{data.grades.length || 0}</div>
              <div className="text-[10px] font-semibold uppercase">Grade bands</div>
            </div>
            <div className="rounded-lg bg-energy-soft p-3 text-energy-dark">
              <Medal className="mb-2 h-4 w-4" />
              <div className="text-lg font-bold">{unlockedCount}</div>
              <div className="text-[10px] font-semibold uppercase">Badges</div>
            </div>
          </div>
        </div>

        <div className="my-5 flex-1 rounded-2xl border border-border bg-cream-50/70 p-4 dark:bg-card">
          <div className="relative mx-auto min-h-[320px] max-w-sm">
            <div className="absolute inset-x-8 top-20 h-44 rounded-[45%] border-2 border-dashed border-progress/30" />
            <div className="absolute left-12 top-16 h-20 w-20 rounded-full bg-gradient-challenge shadow-challenge" />
            <div className="absolute right-8 top-28 h-24 w-24 rounded-full bg-gradient-streak shadow-streak" />
            <div className="absolute bottom-12 left-8 h-24 w-24 rounded-full bg-gradient-math shadow-card" />
            <div className="absolute bottom-8 right-16 h-20 w-20 rounded-full bg-gradient-xp shadow-xp" />

            {STEP_META.map((item, index) => {
              const Icon = item.icon;
              const isUnlocked = index < unlockedCount;
              const isActive = step - 1 === index;
              const positions = [
                "left-8 top-8",
                "right-12 top-20",
                "left-16 top-36",
                "right-6 bottom-24",
                "left-8 bottom-10",
                "right-24 bottom-4",
              ];

              return (
                <motion.div
                  key={item.short}
                  animate={{ scale: isActive ? 1.08 : 1, y: isActive ? -4 : 0 }}
                  className={cn(
                    "absolute flex h-16 w-16 flex-col items-center justify-center rounded-xl border text-center shadow-soft transition-colors",
                    positions[index],
                    isUnlocked
                      ? "border-progress/30 bg-white text-progress dark:bg-card"
                      : isActive
                        ? "border-energy/50 bg-energy-soft text-energy-dark"
                        : "border-border bg-background text-muted-foreground"
                  )}
                >
                  {isUnlocked ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  <span className="mt-1 text-[10px] font-bold">{item.short}</span>
                </motion.div>
              );
            })}

            <motion.div
              animate={{ scale: 1 + unlockedCount * 0.035 }}
              transition={{ type: "spring", bounce: 0.25 }}
              className="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-4 border-white bg-foreground text-background shadow-modal"
            >
              <Sparkles className="h-5 w-5" />
              <span className="mt-1 text-xs font-bold">Insight Core</span>
            </motion.div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-background/80 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              {selectedRole ? (
                <selectedRole.icon className="h-5 w-5" />
              ) : (
                <Map className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">
                {selectedRole?.reward || "Pick a path to tune analytics"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {data.name || "Your workspace"} will start with {subjects} and{" "}
                {data.approximateStudents || "your student"} benchmarks.
              </p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function StepHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6">
      <Badge variant="outline" className="mb-3 border-primary/20 bg-primary/5 text-primary">
        {eyebrow}
      </Badge>
      <h1 className="font-display text-4xl font-semibold leading-tight text-foreground md:text-5xl">
        {title}
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground md:text-base">
        {description}
      </p>
    </div>
  );
}

function ContinueButton({
  children = "Continue",
  disabled,
  onClick,
}: {
  children?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      className="h-12 w-full justify-between px-5 text-base"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
      <ArrowRight className="h-4 w-4" />
    </Button>
  );
}

export default function OnboardingV2() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const {
    currentUser: { profile },
    refreshSession,
  } = useAuth();
  // Resume from saved progress if the user dropped off mid-flow. Clamp to
  // steps 1-6 so we never restore directly onto the celebration screen (7).
  const [step, setStep] = useState<Step>(() => {
    const saved = loadOnboardingProgress(profile?.uid);
    return (Math.min(Math.max(saved?.step ?? 1, 1), TOTAL_STEPS) as Step) || 1;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Only self-signup workspace creators (school_admin/admin) may choose a role
  // during onboarding. Invited users (teacher, principal, ...) have a fixed
  // role the server enforces — so only offer role options they're allowed to
  // pick, otherwise they fill the whole wizard and hit a 403 at submit.
  const roleLocked = !!profile && !canChooseOnboardingRole(profile.role);
  const availableRoles = roleLocked ? ROLES.filter((r) => r.value === profile?.role) : ROLES;

  const [data, setData] = useState<OnboardingData>(() => {
    const saved = loadOnboardingProgress(profile?.uid);
    return saved?.data
      ? { ...DEFAULT_DATA, ...(saved.data as Partial<OnboardingData>) }
      : DEFAULT_DATA;
  });

  // Persist progress on every change (best-effort). Skip step 7 — onboarding is
  // already submitted/complete by then and the draft has been cleared.
  useEffect(() => {
    if (step >= 7) return;
    saveOnboardingProgress(profile?.uid, { step, data });
  }, [step, data, profile?.uid]);

  const unlockedCount = useUnlockedCount(data, step);
  const activeStep = STEP_META[Math.min(step, TOTAL_STEPS) - 1];

  const nextStep = () => setStep((s) => Math.min(s + 1, 7) as Step);
  const prevStep = () => setStep((s) => Math.max(s - 1, 1) as Step);

  const updateData = (updates: Partial<OnboardingData>) => {
    setData((d) => ({ ...d, ...updates }));
  };

  const submitOnboarding = async () => {
    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/onboarding/complete", {
        role: data.role,
        userType: data.userType,
        school: {
          name: data.name,
          city: data.city,
          board: data.board,
          gradesOffered: data.grades,
          approximateStudents: data.approximateStudents,
        },
        user: {
          subjects: data.subjects,
        },
        businessIntel: {
          currentTools: data.currentTools,
          discoverySource: data.discoverySource,
        },
      });
      // The onboarding guard reads onboardingComplete from this query's cache.
      // Invalidate it so the guard sees the fresh "complete" state and doesn't
      // bounce the user back into onboarding after they land on the dashboard.
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      await refreshSession();
      clearOnboardingProgress(profile?.uid);
      nextStep();
    } catch (error) {
      toast({
        title: "Error saving progress",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-5 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,1fr)_430px]">
        <main className="flex min-h-[calc(100vh-2.5rem)] flex-col">
          {step < 7 && (
            <div className="mb-5 rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Mission {step} of {TOTAL_STEPS}
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    Unlock: {activeStep.reward}
                  </p>
                </div>
                <div className="flex gap-2">
                  {STEP_META.map((item, index) => (
                    <div
                      key={item.short}
                      className={cn(
                        "h-2.5 w-8 rounded-full transition-colors",
                        index < unlockedCount
                          ? "bg-progress"
                          : index === step - 1
                            ? "bg-energy"
                            : "bg-muted"
                      )}
                    />
                  ))}
                </div>
              </div>
              <ProgressBar currentStep={step} totalSteps={TOTAL_STEPS} />
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 1 && (
              <StepCard key="step1">
                <StepHeader
                  eyebrow="Personalized onboarding"
                  title="Pick the analytics lens you need first."
                  description="This decides the dashboard language, recommendations, and first-win checklist you see after setup."
                />
                <div className="grid gap-3 md:grid-cols-2">
                  {availableRoles.map((role) => {
                    const Icon = role.icon;
                    const selected = data.userType === role.userType;
                    return (
                      <button
                        key={role.label}
                        className={cn(
                          "group rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-card",
                          selected
                            ? "border-primary bg-primary/10"
                            : "border-border bg-background hover:border-primary/40"
                        )}
                        onClick={() => {
                          updateData({
                            role: role.value as OnboardingData["role"],
                            userType: role.userType,
                          });
                          nextStep();
                        }}
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <div className="rounded-lg bg-card p-2 text-primary shadow-soft">
                            <Icon className="h-5 w-5" />
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            +120 XP
                          </Badge>
                        </div>
                        <h3 className="font-semibold text-foreground">{role.label}</h3>
                        <p className="mt-1 text-sm leading-5 text-muted-foreground">
                          {role.description}
                        </p>
                        <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-progress">
                          {role.reward}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </StepCard>
            )}

            {step === 2 && (
              <StepCard key="step2">
                <Button variant="ghost" size="sm" className="mb-5 px-2" onClick={prevStep}>
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <StepHeader
                  eyebrow="Workspace identity"
                  title="Give your learning realm a name."
                  description="Analytics works better when each report knows which school, center, or tutoring workspace it belongs to."
                />
                <div className="mb-6 grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="name">Institution name</Label>
                    <Input
                      id="name"
                      placeholder="e.g. Springfield High"
                      value={data.name}
                      onChange={(e) => updateData({ name: e.target.value })}
                      className="mt-2 h-12"
                    />
                  </div>
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      placeholder="e.g. New York"
                      value={data.city}
                      onChange={(e) => updateData({ city: e.target.value })}
                      className="mt-2 h-12"
                    />
                  </div>
                </div>
                <ContinueButton disabled={!data.name || !data.city} onClick={nextStep} />
              </StepCard>
            )}

            {step === 3 && (
              <StepCard key="step3">
                <Button variant="ghost" size="sm" className="mb-5 px-2" onClick={prevStep}>
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <StepHeader
                  eyebrow="Progressive disclosure"
                  title="Build the subject map."
                  description="Choose the curriculum board first, then only the subject signals you want analytics to track."
                />
                <div className="mb-6 rounded-xl border border-border bg-background p-4">
                  <Label className="mb-3 block">Board</Label>
                  <ChipSelect
                    options={BOARDS}
                    selected={data.board ? [data.board] : []}
                    onChange={(val) => updateData({ board: val[0] })}
                  />
                </div>

                <AnimatePresence>
                  {data.board && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      className="mb-6 rounded-xl border border-border bg-background p-4"
                    >
                      <Label className="mb-3 block">Subjects to track</Label>
                      <ChipSelect
                        options={SUBJECTS}
                        selected={data.subjects}
                        onChange={(val) => updateData({ subjects: val })}
                        multi
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <ContinueButton
                  disabled={!data.board || data.subjects.length === 0}
                  onClick={nextStep}
                />
              </StepCard>
            )}

            {step === 4 && (
              <StepCard key="step4">
                <Button variant="ghost" size="sm" className="mb-5 px-2" onClick={prevStep}>
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <StepHeader
                  eyebrow="First benchmark"
                  title="Set the cohort scale."
                  description="This lets ClassMode compare completion, test volume, and performance against the right class size."
                />
                <div className="mb-6 rounded-xl border border-border bg-background p-4">
                  <Label className="mb-3 block">Grades offered</Label>
                  <ChipSelect
                    options={GRADES}
                    selected={data.grades}
                    onChange={(val) => updateData({ grades: val })}
                    multi
                  />
                </div>

                <AnimatePresence>
                  {data.grades.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      className="mb-6 rounded-xl border border-border bg-background p-4"
                    >
                      <Label className="mb-3 block">Approximate students</Label>
                      <ChipSelect
                        options={SIZES}
                        selected={data.approximateStudents ? [data.approximateStudents] : []}
                        onChange={(val) => updateData({ approximateStudents: val[0] })}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <ContinueButton
                  disabled={data.grades.length === 0 || !data.approximateStudents}
                  onClick={nextStep}
                />
              </StepCard>
            )}

            {step === 5 && (
              <StepCard key="step5">
                <Button variant="ghost" size="sm" className="mb-5 px-2" onClick={prevStep}>
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <StepHeader
                  eyebrow="Choose your own pace"
                  title="What should analytics replace or connect with?"
                  description="This step is optional. Answering it helps us show migration hints instead of generic feature tours."
                />
                <div className="mb-6 rounded-xl border border-border bg-background p-4">
                  <ChipSelect
                    options={TOOLS}
                    selected={data.currentTools}
                    onChange={(val) => updateData({ currentTools: val })}
                    multi
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <ContinueButton onClick={nextStep}>
                    {data.currentTools.length ? "Unlock migration hints" : "Continue"}
                  </ContinueButton>
                  <Button variant="ghost" className="h-12" onClick={nextStep}>
                    Skip
                  </Button>
                </div>
              </StepCard>
            )}

            {step === 6 && (
              <StepCard key="step6">
                <Button variant="ghost" size="sm" className="mb-5 px-2" onClick={prevStep}>
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <StepHeader
                  eyebrow="Final unlock"
                  title="Launch your analytics command center."
                  description="One quick source tag helps us learn which onboarding paths work. You can skip and still enter the workspace."
                />

                <div className="mb-6 rounded-xl border border-border bg-background p-4">
                  <Label className="mb-3 block">How did you find us?</Label>
                  <ChipSelect
                    options={SOURCES}
                    selected={data.discoverySource ? [data.discoverySource] : []}
                    onChange={(val) => updateData({ discoverySource: val[0] })}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <Button
                    className="h-12 justify-between px-5 text-base"
                    onClick={submitOnboarding}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Completing setup..." : "Finish and reveal dashboard"}
                    <Trophy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-12"
                    onClick={submitOnboarding}
                    disabled={isSubmitting}
                  >
                    Skip
                  </Button>
                </div>
              </StepCard>
            )}

            {step === 7 && (
              <motion.div
                key="step7"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-1 items-center"
              >
                <CelebrationScreen
                  summary={{
                    name: data.name,
                    city: data.city,
                    board: data.board,
                    subjects: data.subjects,
                    grades: data.grades,
                    approximateStudents: data.approximateStudents,
                  }}
                  onComplete={() => setLocation(getDashboardPath(data.role || profile?.role || ""))}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <OnboardingMap data={data} step={step} unlockedCount={unlockedCount} />
      </div>
    </div>
  );
}
