import { useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence } from "framer-motion";
import { StepCard } from "@/components/onboarding/StepCard";
import { ProgressBar } from "@/components/onboarding/ProgressBar";
import { ChipSelect } from "@/components/onboarding/ChipSelect";
import { CelebrationScreen, SummaryData } from "@/components/onboarding/CelebrationScreen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
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
  { label: "School Owner / Principal", value: "principal", userType: "school_owner" },
  { label: "Teacher", value: "teacher", userType: "teacher" },
  { label: "Coaching Center Owner", value: "school_admin", userType: "coaching_center_owner" },
  { label: "Tutor", value: "teacher", userType: "independent_tutor" },
];

export default function OnboardingV2() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [data, setData] = useState<OnboardingData>({
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
  });

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
      nextStep(); // go to step 7 (celebration)
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center pt-16 px-4">
      {step < 7 && (
        <div className="w-full max-w-md mb-8">
          <ProgressBar currentStep={step} totalSteps={6} />
        </div>
      )}

      <AnimatePresence mode="wait">
        {step === 1 && (
          <StepCard key="step1">
            <h2 className="text-2xl font-bold mb-2">Welcome! What describes you best?</h2>
            <p className="text-sm text-gray-500 mb-6">We will customize the experience for you.</p>
            <div className="flex flex-col gap-3">
              {ROLES.map((r) => (
                <Button
                  key={r.label}
                  variant={data.userType === r.userType ? "default" : "outline"}
                  className="w-full justify-start text-left h-auto py-3 px-4"
                  onClick={() => {
                    updateData({ role: r.value as any, userType: r.userType });
                    nextStep();
                  }}
                >
                  {r.label}
                </Button>
              ))}
            </div>
          </StepCard>
        )}

        {step === 2 && (
          <StepCard key="step2" onBack={prevStep}>
            <h2 className="text-2xl font-bold mb-6">What's your institution called?</h2>
            <div className="space-y-4 mb-6">
              <div>
                <Label htmlFor="name">Institution Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. Springfield High"
                  value={data.name}
                  onChange={(e) => updateData({ name: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder="e.g. New York"
                  value={data.city}
                  onChange={(e) => updateData({ city: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <Button
              className="w-full"
              disabled={!data.name || !data.city}
              onClick={nextStep}
            >
              Continue
            </Button>
          </StepCard>
        )}

        {step === 3 && (
          <StepCard key="step3" onBack={prevStep}>
            <h2 className="text-2xl font-bold mb-2">Board & subjects</h2>
            <p className="text-sm text-gray-500 mb-6">We'll personalize your AI tools based on this.</p>
            
            <div className="mb-6">
              <Label className="mb-2 block">Select Board</Label>
              <ChipSelect
                options={BOARDS}
                selected={data.board ? [data.board] : []}
                onChange={(val) => updateData({ board: val[0] })}
              />
            </div>

            {data.board && (
              <div className="mb-6">
                <Label className="mb-2 block">Select Subjects</Label>
                <ChipSelect
                  options={SUBJECTS}
                  selected={data.subjects}
                  onChange={(val) => updateData({ subjects: val })}
                  multi
                />
              </div>
            )}

            <Button
              className="w-full"
              disabled={!data.board || data.subjects.length === 0}
              onClick={nextStep}
            >
              Continue
            </Button>
          </StepCard>
        )}

        {step === 4 && (
          <StepCard key="step4" onBack={prevStep}>
            <h2 className="text-2xl font-bold mb-2">How big is your institution?</h2>
            <p className="text-sm text-gray-500 mb-6">This helps us recommend the right plan for you.</p>

            <div className="mb-6">
              <Label className="mb-2 block">Grades Offered</Label>
              <ChipSelect
                options={GRADES}
                selected={data.grades}
                onChange={(val) => updateData({ grades: val })}
                multi
              />
            </div>

            {data.grades.length > 0 && (
              <div className="mb-6">
                <Label className="mb-2 block">Approximate Students</Label>
                <ChipSelect
                  options={SIZES}
                  selected={data.approximateStudents ? [data.approximateStudents] : []}
                  onChange={(val) => updateData({ approximateStudents: val[0] })}
                />
              </div>
            )}

            <Button
              className="w-full"
              disabled={data.grades.length === 0 || !data.approximateStudents}
              onClick={nextStep}
            >
              Continue
            </Button>
          </StepCard>
        )}

        {step === 5 && (
          <StepCard key="step5" onBack={prevStep}>
            <h2 className="text-2xl font-bold mb-2">What do you use today?</h2>
            <p className="text-sm text-gray-500 mb-6">So we can show you what EduAI replaces.</p>
            
            <div className="mb-8">
              <ChipSelect
                options={TOOLS}
                selected={data.currentTools}
                onChange={(val) => updateData({ currentTools: val })}
                multi
              />
            </div>

            <div className="flex flex-col gap-3">
              <Button className="w-full" onClick={nextStep}>
                Continue
              </Button>
              <Button variant="ghost" className="w-full text-xs text-gray-500" onClick={nextStep}>
                Skip this step
              </Button>
            </div>
          </StepCard>
        )}

        {step === 6 && (
          <StepCard key="step6" onBack={prevStep}>
            <h2 className="text-2xl font-bold mb-2">How did you find us?</h2>
            <p className="text-sm text-gray-500 mb-6">Helps us reach more educators like you.</p>

            <div className="mb-8">
              <ChipSelect
                options={SOURCES}
                selected={data.discoverySource ? [data.discoverySource] : []}
                onChange={(val) => updateData({ discoverySource: val[0] })}
              />
            </div>

            <div className="flex flex-col gap-3">
              <Button 
                className="w-full" 
                onClick={submitOnboarding}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Completing setup..." : "Finish"}
              </Button>
              <Button 
                variant="ghost" 
                className="w-full text-xs text-gray-500" 
                onClick={submitOnboarding}
                disabled={isSubmitting}
              >
                Skip this step
              </Button>
            </div>
          </StepCard>
        )}

        {step === 7 && (
          <motion.div
            key="step7"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full max-w-2xl mt-10"
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
              onComplete={() => setLocation("/dashboard")}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
