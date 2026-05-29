import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Settings,
  Users,
  Mail,
  CreditCard,
  AlertTriangle,
  Copy,
  Trash2,
  Check,
  Loader2,
  MoreHorizontal,
  Shield,
} from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

import { useWorkspace } from "@/contexts/workspace-context";
import { useToast } from "@/hooks/use-toast";
import { getInitials } from "@/lib/utils";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

type MemberRole = "owner" | "admin" | "co-teacher" | "teaching-assistant" | "member" | "auditor";

interface WorkspaceMember {
  id: number;
  userId: number;
  displayName: string;
  email: string;
  role: MemberRole;
  joinedAt: string;
  avatarUrl?: string | null;
}

interface WorkspaceInvite {
  id: number;
  email: string;
  role: MemberRole;
  token: string;
  expiresAt: string;
  status: "pending" | "accepted" | "revoked" | "expired";
}

// ────────────────────────────────────────────────────────────
// Role styling helpers
// ────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  "co-teacher": "Co-teacher",
  "teaching-assistant": "Teaching Assistant",
  member: "Member",
  auditor: "Auditor",
};

const ROLE_CLASSES: Record<MemberRole, string> = {
  owner: "bg-purple-50 text-purple-700 border-purple-100",
  admin: "bg-blue-50 text-blue-700 border-blue-100",
  "co-teacher": "bg-green-50 text-green-700 border-green-100",
  "teaching-assistant": "bg-amber-50 text-amber-700 border-amber-100",
  member: "bg-muted text-muted-foreground border-border",
  auditor: "bg-orange-50 text-orange-700 border-orange-100",
};

function RoleBadge({ role }: { role: MemberRole }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${ROLE_CLASSES[role]}`}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}

// ────────────────────────────────────────────────────────────
// Tab: General
// ────────────────────────────────────────────────────────────

function GeneralTab({ workspaceId }: { workspaceId: number }) {
  const { activeWorkspace, refreshWorkspaces } = useWorkspace();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    name: activeWorkspace?.name ?? "",
    description: activeWorkspace?.description ?? "",
    type: activeWorkspace?.type ?? "school",
    iconUrl: activeWorkspace?.iconUrl ?? "",
  });

  // Sync when active workspace changes
  useEffect(() => {
    if (activeWorkspace) {
      setForm({
        name: activeWorkspace.name,
        description: activeWorkspace.description ?? "",
        type: activeWorkspace.type,
        iconUrl: activeWorkspace.iconUrl ?? "",
      });
    }
  }, [activeWorkspace]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to save");
      }
      await refreshWorkspaces();
      toast({ title: "Saved", description: "Workspace settings updated." });
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopySlug = () => {
    if (activeWorkspace?.slug) {
      navigator.clipboard.writeText(activeWorkspace.slug);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Workspace Details</CardTitle>
          <CardDescription>Update your workspace name, description, and appearance.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="ws-name">Workspace name</Label>
            <Input
              id="ws-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="My Workspace"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ws-description">Description</Label>
            <Textarea
              id="ws-description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="A short description of this workspace"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ws-type">Workspace type</Label>
            <Select
              value={form.type}
              onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
            >
              <SelectTrigger id="ws-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="school">School</SelectItem>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="personal">Personal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ws-icon">Icon URL</Label>
            <Input
              id="ws-icon"
              value={form.iconUrl}
              onChange={(e) => setForm((f) => ({ ...f, iconUrl: e.target.value }))}
              placeholder="https://example.com/icon.png"
            />
          </div>

          <div className="space-y-2">
            <Label>Slug</Label>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={activeWorkspace?.slug ?? "—"}
                className="bg-muted text-muted-foreground"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopySlug}
                disabled={!activeWorkspace?.slug}
                title="Copy slug"
              >
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Slug is auto-generated and cannot be edited.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Tab: Members
// ────────────────────────────────────────────────────────────

function MembersTab({ workspaceId }: { workspaceId: number }) {
  const { toast } = useToast();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<WorkspaceMember | null>(null);

  const fetchMembers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch members");
      const data = await res.json();
      setMembers(Array.isArray(data) ? data : (data.members ?? []));
    } catch {
      toast({ title: "Error", description: "Could not load members.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const handleChangeRole = async (memberId: number, newRole: MemberRole) => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error("Failed to update role");
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      );
      toast({ title: "Role updated" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Unknown", variant: "destructive" });
    }
  };

  const handleRemove = async (member: WorkspaceMember) => {
    setRemovingId(member.id);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members/${member.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove member");
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      toast({ title: "Member removed", description: `${member.displayName} has been removed.` });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Unknown", variant: "destructive" });
    } finally {
      setRemovingId(null);
      setConfirmRemove(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Members ({members.length})</CardTitle>
          <CardDescription>Manage who has access to this workspace.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {members.length === 0 && (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                No members found.
              </p>
            )}
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 px-6 py-3"
              >
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={member.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-xs">
                    {getInitials(member.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-medium">{member.displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                </div>
                <RoleBadge role={member.role} />
                <p className="hidden text-xs text-muted-foreground sm:block">
                  {new Date(member.joinedAt).toLocaleDateString()}
                </p>
                {member.role !== "owner" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {(["admin", "co-teacher", "teaching-assistant", "member", "auditor"] as MemberRole[]).map(
                        (role) => (
                          <DropdownMenuItem
                            key={role}
                            onSelect={() => handleChangeRole(member.id, role)}
                            className="text-sm"
                          >
                            {member.role === role && <Check className="mr-2 h-3.5 w-3.5" />}
                            {!member.role || member.role !== role ? (
                              <span className="mr-2 inline-block w-3.5" />
                            ) : null}
                            Set as {ROLE_LABELS[role]}
                          </DropdownMenuItem>
                        )
                      )}
                      <Separator className="my-1" />
                      <DropdownMenuItem
                        onSelect={() => setConfirmRemove(member)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Remove member
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Remove confirmation dialog */}
      <Dialog open={!!confirmRemove} onOpenChange={(o) => !o && setConfirmRemove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{" "}
              <span className="font-semibold">{confirmRemove?.displayName}</span> from this
              workspace? They will lose all access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRemove(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmRemove && handleRemove(confirmRemove)}
              disabled={removingId === confirmRemove?.id}
            >
              {removingId === confirmRemove?.id && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Tab: Invites
// ────────────────────────────────────────────────────────────

function InvitesTab({ workspaceId }: { workspaceId: number }) {
  const { toast } = useToast();
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<MemberRole>("member");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const fetchInvites = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/invites`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch invites");
      const data = await res.json();
      setInvites(Array.isArray(data) ? data : (data.invites ?? []));
    } catch {
      toast({ title: "Error", description: "Could not load invites.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const handleSendInvite = async () => {
    if (!newEmail.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: newEmail.trim(), role: newRole }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to send invite");
      }
      const invite = await res.json();
      setInvites((prev) => [invite, ...prev]);
      setNewEmail("");
      toast({ title: "Invite sent", description: `Invite sent to ${newEmail.trim()}` });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Unknown", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleRevoke = async (inviteId: number) => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/invites/${inviteId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to revoke invite");
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
      toast({ title: "Invite revoked" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Unknown", variant: "destructive" });
    }
  };

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/join/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Send invite form */}
      <Card>
        <CardHeader>
          <CardTitle>Invite members</CardTitle>
          <CardDescription>Send an email invitation to join this workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendInvite()}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as MemberRole)}>
                <SelectTrigger id="invite-role" className="w-40">
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
            <Button onClick={handleSendInvite} disabled={sending || !newEmail.trim()}>
              {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Invite
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pending invites list */}
      <Card>
        <CardHeader>
          <CardTitle>Pending invites</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-24 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : invites.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No pending invites.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center gap-3 px-6 py-3"
                >
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-sm font-medium">{invite.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Expires {new Date(invite.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <RoleBadge role={invite.role} />
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      invite.status === "pending"
                        ? "bg-amber-50 text-amber-700"
                        : invite.status === "accepted"
                        ? "bg-green-50 text-green-700"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {invite.status}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    title="Copy magic link"
                    onClick={() => handleCopyLink(invite.token)}
                  >
                    {copiedToken === invite.token ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  {invite.status === "pending" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive"
                      title="Revoke invite"
                      onClick={() => handleRevoke(invite.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Tab: Billing (stub)
// ────────────────────────────────────────────────────────────

function BillingTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing</CardTitle>
        <CardDescription>Manage your subscription and payment details.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Current plan</p>
              <p className="text-sm text-muted-foreground">Free</p>
            </div>
            <Badge variant="outline">Free</Badge>
          </div>
        </div>
        <Button disabled className="w-full">
          Upgrade plan
          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">Coming soon</span>
        </Button>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────
// Tab: Danger Zone
// ────────────────────────────────────────────────────────────

function DangerZoneTab({ workspaceId }: { workspaceId: number }) {
  const { activeWorkspace, refreshWorkspaces } = useWorkspace();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const workspaceName = activeWorkspace?.name ?? "";
  const canDelete = deleteConfirmText === workspaceName;

  const handleDelete = async () => {
    if (!canDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Failed to delete workspace");
      }
      toast({ title: "Workspace deleted", description: `"${workspaceName}" has been deleted.` });
      await refreshWorkspaces();
      navigate("/dashboard");
    } catch (err) {
      toast({
        title: "Delete failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Transfer ownership */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            Transfer Ownership
          </CardTitle>
          <CardDescription>
            Transfer ownership of this workspace to another member.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button disabled variant="outline">
            Transfer ownership
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">Coming soon</span>
          </Button>
        </CardContent>
      </Card>

      {/* Delete workspace */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Workspace
          </CardTitle>
          <CardDescription>
            Permanently delete this workspace and all its data. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog
            open={deleteOpen}
            onOpenChange={(o) => {
              setDeleteOpen(o);
              if (!o) setDeleteConfirmText("");
            }}
          >
            <DialogTrigger asChild>
              <Button variant="destructive">Delete workspace</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-destructive">Delete workspace</DialogTitle>
                <DialogDescription>
                  This will permanently delete{" "}
                  <span className="font-semibold">{workspaceName}</span> and all associated data.
                  Type the workspace name to confirm.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <Label htmlFor="delete-confirm">
                  Type <span className="font-mono font-semibold">{workspaceName}</span> to confirm
                </Label>
                <Input
                  id="delete-confirm"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={workspaceName}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={!canDelete || isDeleting}
                >
                  {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Delete workspace
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Main settings page
// ────────────────────────────────────────────────────────────

export default function WorkspaceSettings() {
  const { activeWorkspace, isLoading } = useWorkspace();

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-3 text-center">
        <p className="text-muted-foreground">No active workspace selected.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Workspace Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Manage settings for <span className="font-medium text-foreground">{activeWorkspace.name}</span>
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="flex h-auto flex-wrap gap-1 bg-transparent p-0">
          {[
            { value: "general", label: "General", icon: <Settings className="h-4 w-4" /> },
            { value: "members", label: "Members", icon: <Users className="h-4 w-4" /> },
            { value: "invites", label: "Invites", icon: <Mail className="h-4 w-4" /> },
            { value: "billing", label: "Billing", icon: <CreditCard className="h-4 w-4" /> },
            { value: "danger", label: "Danger Zone", icon: <AlertTriangle className="h-4 w-4" /> },
          ].map(({ value, label, icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              {icon}
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <GeneralTab workspaceId={activeWorkspace.id} />
        </TabsContent>

        <TabsContent value="members" className="mt-6">
          <MembersTab workspaceId={activeWorkspace.id} />
        </TabsContent>

        <TabsContent value="invites" className="mt-6">
          <InvitesTab workspaceId={activeWorkspace.id} />
        </TabsContent>

        <TabsContent value="billing" className="mt-6">
          <BillingTab />
        </TabsContent>

        <TabsContent value="danger" className="mt-6">
          <DangerZoneTab workspaceId={activeWorkspace.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
