import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Building2, BriefcaseBusiness, User, CheckCircle2, Loader2, ArrowRight, ArrowLeft, X, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/contexts/workspace-context";
import { useToast } from "@/hooks/use-toast";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

type WorkspaceType = "school" | "business" | "personal";
type InviteRole = "admin" | "co-teacher" | "teaching-assistant" | "member" | "auditor";

interface Template {
  id: string;
  name: string;
  description: string;
  type: WorkspaceType;
}

const TYPE_OPTIONS: {
  type: WorkspaceType;
  label: string;
  icon: React.ReactNode;
  description: string;
}[] = [
  {
    type: "school",
    label: "School",
    icon: <Building2 className="h-7 w-7" />,
    description: "Classrooms, students, educators",
  },
  {
    type: "business",
    label: "Business",
    icon: <BriefcaseBusiness className="h-7 w-7" />,
    description: "Teams, projects, and training",
  },
  {
    type: "personal",
    label: "Personal",
    icon: <User className="h-7 w-7" />,
    description: "Solo study and self-improvement",
  },
];

// ────────────────────────────────────────────────────────────
// Step indicators
// ────────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <React.Fragment key={i}>
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors",
              i + 1 < current
                ? "bg-accent text-white"
                : i + 1 === current
                ? "bg-accent text-white ring-4 ring-accent/20"
                : "bg-muted text-muted-foreground"
            )}
          >
            {i + 1 < current ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
          </div>
          {i < total - 1 && (
            <div
              className={cn(
                "h-px flex-1 transition-colors",
                i + 1 < current ? "bg-accent" : "bg-border"
              )}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Step 1: Name & Type
// ────────────────────────────────────────────────────────────

interface Step1Props {
  name: string;
  setName: (v: string) => void;
  type: WorkspaceType;
  setType: (v: WorkspaceType) => void;
  templateId: string | null;
  setTemplateId: (v: string | null) => void;
  templates: Template[];
  templatesLoading: boolean;
  onNext: () => void;
}

function Step1({ name, setName, type, setType, templateId, setTemplateId, templates, templatesLoading, onNext }: Step1Props) {
  const filteredTemplates = templates.filter((t) => t.type === type || !t.type);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="ws-name">Workspace name</Label>
        <Input
          id="ws-name"
          placeholder="My Workspace"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>

      <div className="space-y-3">
        <Label>Type</Label>
        <div className="grid grid-cols-3 gap-3">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.type}
              type="button"
              onClick={() => setType(opt.type)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border p-4 text-sm transition-all hover:border-accent/50",
                type === opt.type
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.icon}
              <span className="font-medium">{opt.label}</span>
              <span className="hidden text-center text-xs sm:block">{opt.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Templates */}
      {!templatesLoading && filteredTemplates.length > 0 && (
        <div className="space-y-3">
          <Label>Template (optional)</Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {filteredTemplates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplateId(templateId === t.id ? null : t.id)}
                className={cn(
                  "rounded-xl border p-3 text-left text-sm transition-all hover:border-accent/50",
                  templateId === t.id
                    ? "border-accent bg-accent-soft"
                    : "border-border"
                )}
              >
                <p className="font-medium">{t.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <Button onClick={onNext} disabled={!name.trim()} className="w-full">
        Continue
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Step 2: Invite members
// ────────────────────────────────────────────────────────────

interface InviteEntry {
  email: string;
  role: InviteRole;
}

interface Step2Props {
  invites: InviteEntry[];
  setInvites: React.Dispatch<React.SetStateAction<InviteEntry[]>>;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}

function Step2({ invites, setInvites, onBack, onNext, onSkip }: Step2Props) {
  const [inputEmail, setInputEmail] = useState("");
  const [inputRole, setInputRole] = useState<InviteRole>("member");

  const addEmails = () => {
    const emails = inputEmail
      .split(/[,\s]+/)
      .map((e) => e.trim())
      .filter((e) => e && e.includes("@"));
    const newEntries: InviteEntry[] = emails.map((email) => ({ email, role: inputRole }));
    setInvites((prev) => {
      const existing = new Set(prev.map((e) => e.email));
      return [...prev, ...newEntries.filter((e) => !existing.has(e.email))];
    });
    setInputEmail("");
  };

  const removeInvite = (idx: number) => {
    setInvites((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Invite people to collaborate in this workspace. You can also do this later.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="invite-emails">Email addresses</Label>
          <Input
            id="invite-emails"
            placeholder="alice@example.com, bob@example.com"
            value={inputEmail}
            onChange={(e) => setInputEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addEmails()}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Role</Label>
          <Select value={inputRole} onValueChange={(v) => setInputRole(v as InviteRole)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="co-teacher">Co-teacher</SelectItem>
              <SelectItem value="teaching-assistant">Teaching Assistant</SelectItem>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="auditor">Auditor</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={addEmails} type="button">
          <Plus className="mr-1.5 h-4 w-4" />
          Add
        </Button>
      </div>

      {invites.length > 0 && (
        <div className="rounded-xl border border-border divide-y">
          {invites.map((inv, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2">
              <span className="flex-1 truncate text-sm">{inv.email}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {inv.role}
              </span>
              <button
                type="button"
                onClick={() => removeInvite(i)}
                className="rounded p-0.5 text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} type="button">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={invites.length > 0 ? onNext : onSkip}
          className="flex-1"
          type="button"
        >
          {invites.length > 0 ? (
            <>
              Send invites & continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          ) : (
            "Skip for now"
          )}
        </Button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Step 3: Done
// ────────────────────────────────────────────────────────────

function Step3({ workspaceName, onGo }: { workspaceName: string; onGo: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-50 text-green-600">
        <CheckCircle2 className="h-10 w-10" />
      </div>
      <div>
        <h2 className="text-2xl font-bold">You're all set!</h2>
        <p className="mt-2 text-muted-foreground">
          Your workspace <span className="font-semibold text-foreground">{workspaceName}</span> is
          ready to use.
        </p>
      </div>
      <Button size="lg" onClick={onGo}>
        Go to workspace
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Main wizard
// ────────────────────────────────────────────────────────────

export default function WorkspaceCreate() {
  const [step, setStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [createdId, setCreatedId] = useState<number | null>(null);

  // Step 1 state
  const [name, setName] = useState("");
  const [type, setType] = useState<WorkspaceType>("school");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  // Step 2 state
  const [invites, setInvites] = useState<InviteEntry[]>([]);

  const { refreshWorkspaces } = useWorkspace();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  useEffect(() => {
    fetch("/api/workspaces/templates", { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setTemplates(Array.isArray(data) ? data : (data.templates ?? [])))
      .catch(() => setTemplates([]))
      .finally(() => setTemplatesLoading(false));
  }, []);

  const createWorkspace = async (skipInvites = false) => {
    setIsCreating(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, type, templateId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to create workspace");
      }
      const workspace = await res.json();
      setCreatedId(workspace.id ?? workspace.workspace?.id);

      // Send invites if any
      if (!skipInvites && invites.length > 0) {
        await Promise.allSettled(
          invites.map((inv) =>
            fetch(`/api/workspaces/${workspace.id ?? workspace.workspace?.id}/invites`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(inv),
            })
          )
        );
      }

      await refreshWorkspaces();
      setStep(3);
    } catch (err) {
      toast({
        title: "Creation failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleGoToWorkspace = () => {
    navigate("/dashboard");
  };

  const STEP_TITLES = ["Name & Type", "Invite Members", "Done"];

  return (
    <div className="animate-fade-in-up mx-auto max-w-xl py-10">
      <div className="mb-8 space-y-4">
        <h1 className="font-display text-3xl font-bold tracking-tight">Create workspace</h1>
        <StepIndicator current={step} total={3} />
        <p className="text-sm font-medium text-muted-foreground">{STEP_TITLES[step - 1]}</p>
      </div>

      {isCreating ? (
        <div className="flex h-40 flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Creating your workspace…</p>
        </div>
      ) : step === 1 ? (
        <Step1
          name={name}
          setName={setName}
          type={type}
          setType={setType}
          templateId={templateId}
          setTemplateId={setTemplateId}
          templates={templates}
          templatesLoading={templatesLoading}
          onNext={() => setStep(2)}
        />
      ) : step === 2 ? (
        <Step2
          invites={invites}
          setInvites={setInvites}
          onBack={() => setStep(1)}
          onNext={() => createWorkspace(false)}
          onSkip={() => createWorkspace(true)}
        />
      ) : (
        <Step3 workspaceName={name} onGo={handleGoToWorkspace} />
      )}
    </div>
  );
}
