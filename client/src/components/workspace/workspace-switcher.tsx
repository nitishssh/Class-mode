import React, { useState } from "react";
import { useLocation } from "wouter";
import { Check, ChevronsUpDown, Loader2, Plus, LogIn } from "lucide-react";

import { cn, getInitials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

import { useWorkspace, type WorkspaceWithRole } from "@/contexts/workspace-context";

const ROLE_LABELS: Record<WorkspaceWithRole["role"], string> = {
  owner: "Owner",
  admin: "Admin",
  "co-teacher": "Co-teacher",
  "teaching-assistant": "TA",
  member: "Member",
  auditor: "Auditor",
};

const ROLE_CLASSES: Record<WorkspaceWithRole["role"], string> = {
  owner: "bg-purple-50 text-purple-700 border-purple-100",
  admin: "bg-blue-50 text-blue-700 border-blue-100",
  "co-teacher": "bg-green-50 text-green-700 border-green-100",
  "teaching-assistant": "bg-amber-50 text-amber-700 border-amber-100",
  member: "bg-muted text-muted-foreground border-border",
  auditor: "bg-orange-50 text-orange-700 border-orange-100",
};

function WorkspaceAvatar({
  workspace,
  size = "sm",
}: {
  workspace: WorkspaceWithRole;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-6 w-6 text-xs" : "h-8 w-8 text-sm";
  if (workspace.iconUrl) {
    return (
      <img
        src={workspace.iconUrl}
        alt={workspace.name}
        className={cn("flex-shrink-0 rounded-md object-cover", dim)}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex flex-shrink-0 items-center justify-center rounded-md bg-accent-soft font-semibold text-accent",
        dim
      )}
    >
      {getInitials(workspace.name)}
    </div>
  );
}

export function WorkspaceSwitcher({ isCollapsed = false }: { isCollapsed?: boolean }) {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<number | null>(null);
  const { allWorkspaces, activeWorkspace, switchWorkspace } = useWorkspace();
  const [, navigate] = useLocation();

  const handleSelect = async (workspace: WorkspaceWithRole) => {
    if (workspace.id === activeWorkspace?.id) {
      setOpen(false);
      return;
    }
    setSwitching(workspace.id);
    try {
      await switchWorkspace(workspace.id);
    } finally {
      setSwitching(null);
      setOpen(false);
    }
  };

  const trigger = (
    <Button
      variant="ghost"
      role="combobox"
      aria-expanded={open}
      aria-label="Select workspace"
      className={cn(
        "flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted",
        isCollapsed ? "w-10 justify-center" : "w-full justify-between"
      )}
    >
      {activeWorkspace ? (
        <>
          <WorkspaceAvatar workspace={activeWorkspace} size="sm" />
          {!isCollapsed && (
            <>
              <span
                data-testid="workspace-switcher-name"
                className="flex-1 truncate text-left"
              >
                {activeWorkspace.name}
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            </>
          )}
        </>
      ) : (
        <>
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
            <Plus className="h-3 w-3" />
          </div>
          {!isCollapsed && (
            <>
              <span
                data-testid="workspace-switcher-empty"
                className="flex-1 truncate text-left text-muted-foreground"
              >
                No workspace
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            </>
          )}
        </>
      )}
    </Button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start" side="right" sideOffset={8}>
        <Command>
          <CommandInput placeholder="Search workspace..." className="h-9" />
          <CommandList>
            <CommandEmpty>No workspace found.</CommandEmpty>
            {allWorkspaces.length > 0 && (
              <CommandGroup heading="Workspaces">
                {allWorkspaces.map((ws) => {
                  const isActive = ws.id === activeWorkspace?.id;
                  const isSwitching = switching === ws.id;
                  return (
                    <CommandItem
                      key={ws.id}
                      value={ws.name}
                      onSelect={() => handleSelect(ws)}
                      className="flex items-center gap-2 py-2"
                    >
                      <WorkspaceAvatar workspace={ws} size="sm" />
                      <div className="flex flex-1 flex-col overflow-hidden">
                        <span className="truncate text-sm font-medium">{ws.name}</span>
                        <span
                          className={cn(
                            "inline-flex w-fit items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                            ROLE_CLASSES[ws.role]
                          )}
                        >
                          {ROLE_LABELS[ws.role]}
                        </span>
                      </div>
                      {isSwitching ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : isActive ? (
                        <Check className="h-4 w-4 text-accent" />
                      ) : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            <CommandSeparator />

            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  navigate("/workspace/new");
                }}
                className="flex items-center gap-2 py-2 text-sm"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-md border border-dashed border-border">
                  <Plus className="h-3.5 w-3.5" />
                </div>
                Create new workspace
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  navigate("/workspace/join");
                }}
                className="flex items-center gap-2 py-2 text-sm"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-md border border-border">
                  <LogIn className="h-3.5 w-3.5" />
                </div>
                Join workspace
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
