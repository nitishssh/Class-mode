import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useFirebaseAuth } from "@/contexts/firebase-auth-context";

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
  const {
    currentUser: { profile },
  } = useFirebaseAuth();

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

  useEffect(() => {
    refreshWorkspaces();
  }, [profile?.id, refreshWorkspaces]);

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
