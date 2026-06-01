import React, { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Loader2, Building2, UserCheck, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { useFirebaseAuth } from "@/contexts/firebase-auth-context";
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
  role: string;
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
  const { currentUser, isLoading: authLoading } = useFirebaseAuth();
  const { refreshWorkspaces } = useWorkspace();
  const { toast } = useToast();

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [joined, setJoined] = useState(false);

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
      .then((data: InviteInfo) => setInfo(data))
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

            {!currentUser.profile && canAccept && (
              <p className="text-center text-xs text-muted-foreground">
                You'll be asked to sign in before joining.
              </p>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <Button
                onClick={handleAccept}
                disabled={!canAccept || isJoining}
                className="w-full"
                size="lg"
              >
                {isJoining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {currentUser.profile ? "Accept invitation" : "Sign in to accept"}
              </Button>
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
