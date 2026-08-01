import React, { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Loader2, Building2, UserCheck, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { useAuth } from "@/contexts/auth-context";
import { useWorkspace } from "@/contexts/workspace-context";
import { useToast } from "@/hooks/use-toast";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface InviteInfo {
  workspace: {
    id: number;
    name: string;
    type: string;
    description: string | null;
    iconUrl: string | null;
  };
  inviterName?: string;
  email: string;
  name: string | null;
  role: string;
  kind?: "business_member" | "student";
  /** Whether the invited email already has an account (login vs signup). */
  accountExists: boolean;
  expiresAt: string;
  status: "pending" | "accepted" | "revoked" | "expired";
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  "co-teacher": "Co-teacher",
  "teaching-assistant": "Teaching Assistant",
  member: "Member",
  auditor: "Auditor",
};

// ────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────

export default function JoinWorkspace() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [, navigate] = useLocation();
  const { currentUser, isLoading: authLoading, refreshSession } = useAuth();
  const { refreshWorkspaces } = useWorkspace();
  const { toast } = useToast();

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [signup, setSignup] = useState({ displayName: "", password: "" });

  // Fetch invite info on mount
  useEffect(() => {
    if (!token) {
      setFetchError("Invalid invite link.");
      setIsFetching(false);
      return;
    }
    fetch(`/api/workspaces/join/${token}`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || "Invite not found or expired.");
        }
        return res.json();
      })
      .then((data: InviteInfo) => {
        setInfo(data);
        if (data.name) setSignup((s) => ({ ...s, displayName: data.name as string }));
      })
      .catch((err) => setFetchError(err instanceof Error ? err.message : "Could not load invite"))
      .finally(() => setIsFetching(false));
  }, [token]);

  const handleAccept = async () => {
    if (!currentUser.profile) {
      // Redirect to login, then come back
      navigate(`/login?redirect=/workspace/join/${token}`);
      return;
    }

    setIsJoining(true);
    try {
      const res = await fetch(`/api/workspaces/join/${token}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to join workspace");
      }
      await refreshWorkspaces();
      setJoined(true);
      toast({
        title: "Joined!",
        description: `You've joined ${info?.workspace.name ?? "the workspace"}.`,
      });
    } catch (err) {
      toast({
        title: "Could not join",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsJoining(false);
    }
  };

  // Brand-new invitee: create the account + join + sign in, all in one step.
  const handleSignup = async () => {
    if (signup.password.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    setIsJoining(true);
    try {
      const res = await fetch(`/api/auth/workspace-invite/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          token,
          displayName: signup.displayName,
          password: signup.password,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        // An account already exists for this email → route them to sign in.
        if (res.status === 409 && body.accountExists) {
          navigate(`/login?redirect=/workspace/join/${token}`);
          return;
        }
        throw new Error(body.message || "Failed to create account");
      }
      // The endpoint set the session cookies; pull the new profile into the SPA
      // so the dashboard (a protected route) recognizes the user immediately.
      await refreshSession();
      await refreshWorkspaces();
      setJoined(true);
      toast({
        title: "Welcome!",
        description: `Your account is ready and you've joined ${info?.workspace.name ?? "the workspace"}.`,
      });
    } catch (err) {
      toast({
        title: "Could not create account",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsJoining(false);
    }
  };

  // ── Loading state ──────────────────────────────────────────
  if (isFetching || authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────
  if (fetchError || !info) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold">Invalid invite</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {fetchError ?? "This invite link is invalid or has expired."}
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/dashboard")}>
          Go to dashboard
        </Button>
      </div>
    );
  }

  // ── Joined success state ───────────────────────────────────
  if (joined) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-600">
          <UserCheck className="h-8 w-8" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold">You're in!</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You've joined <span className="font-semibold">{info.workspace.name}</span> as{" "}
            <span className="font-semibold">{ROLE_LABELS[info.role] ?? info.role}</span>.
          </p>
        </div>
        <Button onClick={() => navigate("/dashboard")}>Go to dashboard</Button>
      </div>
    );
  }

  // ── Invite card ────────────────────────────────────────────
  const isExpired = info.status === "expired" || new Date(info.expiresAt) < new Date();
  const isRevoked = info.status === "revoked";
  const isAccepted = info.status === "accepted";
  const canAccept = !isExpired && !isRevoked && !isAccepted;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/30 p-6">
      <div className="w-full max-w-md">
        <Card className="shadow-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              {info.workspace.iconUrl ? (
                <img
                  src={info.workspace.iconUrl}
                  alt={info.workspace.name}
                  className="h-full w-full rounded-2xl object-cover"
                />
              ) : (
                <Building2 className="h-8 w-8" />
              )}
            </div>
            <CardTitle className="text-2xl">{info.workspace.name}</CardTitle>
            <CardDescription>
              {info.inviterName ? (
                <>
                  <span className="font-medium">{info.inviterName}</span> has invited you to join
                  this workspace
                </>
              ) : (
                "You've been invited to join this workspace"
              )}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {info.workspace.description && (
              <p className="text-center text-sm text-muted-foreground">
                {info.workspace.description}
              </p>
            )}

            <div className="flex items-center justify-center gap-3">
              <span className="text-sm text-muted-foreground">Your role:</span>
              <span className="rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent">
                {ROLE_LABELS[info.role] ?? info.role}
              </span>
            </div>

            {isExpired && (
              <div className="rounded-lg bg-destructive/10 p-3 text-center text-sm text-destructive">
                This invite has expired.
              </div>
            )}
            {isRevoked && (
              <div className="rounded-lg bg-destructive/10 p-3 text-center text-sm text-destructive">
                This invite has been revoked.
              </div>
            )}
            {isAccepted && (
              <div className="rounded-lg bg-green-50 p-3 text-center text-sm text-green-700">
                This invite has already been accepted.
              </div>
            )}

            {/* Brand-new invitee with no account: collect name + password and
                create the account + join in one step. */}
            {canAccept && !currentUser.profile && info.accountExists === false && (
              <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium">Create your account</p>
                <div className="space-y-1.5">
                  <Label htmlFor="join-email">Email</Label>
                  <Input id="join-email" value={info.email} disabled className="opacity-60" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="join-name">Your name</Label>
                  <Input
                    id="join-name"
                    value={signup.displayName}
                    onChange={(e) => setSignup((s) => ({ ...s, displayName: e.target.value }))}
                    placeholder="Jane Doe"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="join-password">Password</Label>
                  <Input
                    id="join-password"
                    type="password"
                    value={signup.password}
                    onChange={(e) => setSignup((s) => ({ ...s, password: e.target.value }))}
                    placeholder="Min. 8 characters"
                    onKeyDown={(e) => e.key === "Enter" && handleSignup()}
                  />
                </div>
              </div>
            )}

            {canAccept && !currentUser.profile && info.accountExists && (
              <p className="text-center text-xs text-muted-foreground">
                You already have an account — sign in to accept this invite.
              </p>
            )}

            <div className="flex flex-col gap-2 pt-2">
              {canAccept && !currentUser.profile && info.accountExists === false ? (
                <Button
                  onClick={handleSignup}
                  disabled={isJoining || !signup.displayName || !signup.password}
                  className="w-full"
                  size="lg"
                >
                  {isJoining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create account & join
                </Button>
              ) : (
                <Button
                  onClick={handleAccept}
                  disabled={!canAccept || isJoining}
                  className="w-full"
                  size="lg"
                >
                  {isJoining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {currentUser.profile ? "Accept invitation" : "Sign in to accept"}
                </Button>
              )}
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={() => navigate("/dashboard")}
              >
                Maybe later
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Expires {new Date(info.expiresAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
