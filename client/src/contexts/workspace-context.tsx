import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";

export interface WorkspaceWithRole {
  id: number;
  name: string;
  slug: string | null;
  type: string;
  description: string | null;
  iconUrl: string | null;
  role: "owner" | "admin" | "co-teacher" | "teaching-assistant" | "member" | "auditor";
}

interface WorkspaceContextType {
  allWorkspaces: WorkspaceWithRole[];
  activeWorkspace: WorkspaceWithRole | null;
  switchWorkspace: (id: number) => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  isLoading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

async function fetchWorkspaces(): Promise<WorkspaceWithRole[]> {
  const res = await fetch("/api/workspaces", { credentials: "include" });
  if (!res.ok) return [];
  const data = await res.json();
  // API may return { workspaces: [...] } or a plain array
  return Array.isArray(data) ? data : (data.workspaces ?? []);
}

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [allWorkspaces, setAllWorkspaces] = useState<WorkspaceWithRole[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceWithRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  // Workspaces belong to whoever is signed in, so the fetch has to follow the
  // session rather than the component lifecycle. Keying on the user id (not on
  // a boolean) also covers switching accounts inside one tab.
  const { currentUser, isLoading: authLoading } = useAuth();
  const userId = currentUser.profile?.id ?? null;

  const refreshWorkspaces = useCallback(async () => {
    setIsLoading(true);
    try {
      const workspaces = await fetchWorkspaces();
      setAllWorkspaces(workspaces);
      // Determine active workspace: prefer the one marked active, else first
      if (workspaces.length > 0) {
        setActiveWorkspace((prev) => {
          if (prev) {
            const updated = workspaces.find((w) => w.id === prev.id);
            return updated ?? workspaces[0];
          }
          return workspaces[0];
        });
      } else {
        setActiveWorkspace(null);
      }
    } catch {
      // silently fail — workspace features degrade gracefully
    } finally {
      setIsLoading(false);
    }
  }, []);

  const switchWorkspace = useCallback(
    async (id: number) => {
      try {
        const res = await fetch(`/api/workspaces/${id}/activate`, {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || "Failed to switch workspace");
        }
        // Update active workspace in state from the current list
        const target = allWorkspaces.find((w) => w.id === id);
        if (target) setActiveWorkspace(target);
        // Refresh to get any server-side changes
        await refreshWorkspaces();
        toast({
          title: "Workspace switched",
          description: `Now in ${target?.name ?? "workspace"}`,
        });
      } catch (err) {
        toast({
          title: "Switch failed",
          description: err instanceof Error ? err.message : "Could not switch workspace",
          variant: "destructive",
        });
        throw err;
      }
    },
    [allWorkspaces, refreshWorkspaces, toast]
  );

  // Previously this fetched once on mount, which was wrong in three ways at
  // once, all from the same cause: the provider mounts with the app, long
  // before anyone has signed in.
  //
  //   - Anonymous visitors to /login fired a request that could only ever 401.
  //   - That 401 was the ONLY fetch, so signing in left the list empty and the
  //     switcher told the owner of a workspace they had none — until a full
  //     page reload happened to remount everything.
  //   - Signing out left the previous account's workspace on screen. This
  //     state is plain useState, so the queryClient.clear() that logout()
  //     already does for cached queries never reached it.
  //
  // Keying the effect on the user id fixes all three: no id means no request
  // and no stale data, and a change of id (sign in, sign out, switch account)
  // re-runs it.
  useEffect(() => {
    // Auth is still resolving the session. Fetching now would repeat the
    // original bug — a request while nominally logged out, then no retry.
    if (authLoading) return;

    if (userId === null) {
      setAllWorkspaces([]);
      setActiveWorkspace(null);
      // Nothing is coming, so consumers must not be left on a spinner.
      setIsLoading(false);
      return;
    }

    refreshWorkspaces();
  }, [authLoading, userId, refreshWorkspaces]);

  return (
    <WorkspaceContext.Provider
      value={{ allWorkspaces, activeWorkspace, switchWorkspace, refreshWorkspaces, isLoading }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = (): WorkspaceContextType => {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
};
