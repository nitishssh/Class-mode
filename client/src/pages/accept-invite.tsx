import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function AcceptInvite() {
  const search = useSearch();
  const token = new URLSearchParams(search).get("token") ?? "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [invite, setInvite] = useState<{
    name: string;
    email: string;
    role: string;
    grades: string[];
  } | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ displayName: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setError("No invite token found.");
      return;
    }
    fetch(`/api/invite/validate/${token}`)
      .then(async (r) => {
        if (r.status === 410) {
          setError("This invite has expired. Ask your admin to resend it.");
          return;
        }
        if (!r.ok) {
          setError("Invalid or already-used invite link.");
          return;
        }
        const data = await r.json();
        setInvite(data);
        setForm((f) => ({ ...f, displayName: data.name }));
      })
      .catch(() => setError("Could not validate invite. Check your connection."));
  }, [token]);

  const submit = async () => {
    if (form.password !== form.confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (form.password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, displayName: form.displayName, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      toast({ title: "Account created!", description: "You can now sign in." });

      // Redirect based on role
      if (data.role === "teacher") {
        setLocation("/onboarding/teacher");
      } else {
        setLocation("/");
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-md space-y-4 text-center">
          <h2 className="text-2xl font-bold text-destructive">Invite Error</h2>
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => setLocation("/")}>
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-card p-8">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-primary">
            {invite.role === "teacher" ? "Teacher Invite" : "Student Invite"}
          </p>
          <h1 className="text-2xl font-bold">Welcome, {invite.name}!</h1>
          <p className="mt-1 text-sm text-muted-foreground">Set up your account to get started.</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Display name</Label>
            <Input
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input value={invite.email} disabled className="opacity-60" />
          </div>
          <div className="space-y-1">
            <Label>Password *</Label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="Min. 6 characters"
            />
          </div>
          <div className="space-y-1">
            <Label>Confirm password *</Label>
            <Input
              type="password"
              value={form.confirm}
              onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
            />
          </div>
        </div>

        <Button
          className="w-full"
          onClick={submit}
          disabled={loading || !form.password || !form.displayName}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating account…
            </>
          ) : (
            "Create Account"
          )}
        </Button>
      </div>
    </div>
  );
}
