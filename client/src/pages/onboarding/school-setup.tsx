import { useState } from "react";
import { useLocation } from "wouter";
import { useFirebaseAuth } from "@/contexts/firebase-auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

const GRADES = ["Nursery", "LKG", "UKG", ...Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`)];
const BOARDS = ["CBSE", "ICSE", "State", "IB", "Other"] as const;

export default function SchoolSetup() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: "",
    city: "",
    board: "CBSE" as string,
    gradesOffered: [] as string[],
    logo: "",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const toggleGrade = (g: string) =>
    setForm((f) => ({
      ...f,
      gradesOffered: f.gradesOffered.includes(g)
        ? f.gradesOffered.filter((x) => x !== g)
        : [...f.gradesOffered, g],
    }));

  const uploadLogo = async () => {
    if (!logoFile) return;
    const fd = new FormData();
    fd.append("logo", logoFile);
    const res = await fetch("/api/school/logo", {
      method: "POST",
      body: fd,
      credentials: "include",
    });
    const data = await res.json();
    setForm((f) => ({ ...f, logo: data.url }));
  };

  const submit = async () => {
    if (!form.name || form.gradesOffered.length === 0) {
      toast({
        title: "Validation error",
        description: "School name and at least one grade are required.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      if (logoFile) await uploadLogo();
      await apiRequest("POST", "/api/school/setup", form);
      queryClient.invalidateQueries({ queryKey: ["/api/school/me"] });
      toast({ title: "School set up!", description: "Now invite your teachers." });
      setLocation("/onboarding/invite-teachers");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-6 rounded-2xl border border-border bg-card p-8">
        {/* Progress */}
        <div className="mb-2 flex gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${step >= s ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Set up your school</h2>
            <div className="space-y-2">
              <Label>School name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Springfield High School"
              />
            </div>
            <div className="space-y-2">
              <Label>City *</Label>
              <Input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="Mumbai"
              />
            </div>
            <div className="space-y-2">
              <Label>Board / Curriculum *</Label>
              <div className="flex flex-wrap gap-2">
                {BOARDS.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, board: b }))}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${form.board === b ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => setStep(2)}
              disabled={!form.name || !form.city}
            >
              Next →
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Upload school logo</h2>
            <p className="text-sm text-muted-foreground">Optional — you can skip this step.</p>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
            />
            {logoFile && <p className="text-xs text-muted-foreground">{logoFile.name}</p>}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(3)}>
                Skip
              </Button>
              <Button className="flex-1" onClick={() => setStep(3)}>
                Next →
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Grades offered *</h2>
            <p className="text-sm text-muted-foreground">Select all grades your school offers.</p>
            <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto">
              {GRADES.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGrade(g)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${form.gradesOffered.includes(g) ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}
                >
                  {g}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
                ← Back
              </Button>
              <Button
                className="flex-1"
                onClick={submit}
                disabled={loading || form.gradesOffered.length === 0}
              >
                {loading ? "Saving…" : "Complete Setup"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
