import { Router, Request, Response } from "express";
import { getPgPool } from "../db-pg";
import {
  pgFindUserById,
  pgFindUserByEmail,
  pgUpdateUser,
  pgFindWorkspaceById,
  pgFindWorkspaceBySlug,
  pgFindWorkspaceMembership,
  pgUpsertWorkspaceMembership,
  pgCreateWorkspaceInvite,
  pgFindWorkspaceInviteByTokenHash,
  pgFindPendingWorkspaceInviteByEmail,
  pgAcceptWorkspaceInvite,
  pgResendWorkspaceInvite,
  pgListUserWorkspaces,
  pgListWorkspaceMembers,
  pgListWorkspaceInvites,
  pgRevokeWorkspaceInvite,
  pgDeleteWorkspace,
  pgUpdateWorkspace,
  pgGetWorkspaceOnboardingProgress,
} from "../lib/db/pg-queries";
import {
  slugifyWorkspaceName,
  randomToken,
  tokenHash,
  hasWorkspacePermission,
  type WorkspaceRole,
} from "../lib/auth/auth-workspace";
import { sendWorkspaceInvite } from "../lib/integrations/mailer";
import { logger } from "../lib/logger";
import { authenticateToken } from "../middleware";

const router = Router();

// ─── Templates ───────────────────────────────────────────────────────────────

const WORKSPACE_TEMPLATES = [
  {
    id: "blank",
    name: "Blank Workspace",
    description: "Start from scratch.",
    type: "business",
    channels: [],
  },
  {
    id: "cbse-school",
    name: "CBSE School",
    description: "Pre-built channels for a CBSE classroom.",
    type: "school",
    channels: [
      { name: "Announcements", type: "announcement" },
      { name: "General", type: "text" },
      { name: "Doubts", type: "text" },
      { name: "Resources", type: "text" },
    ],
  },
  {
    id: "coaching",
    name: "Coaching Center",
    description: "For tutoring centers and coaching institutes.",
    type: "business",
    channels: [
      { name: "Announcements", type: "announcement" },
      { name: "General", type: "text" },
      { name: "Practice Tests", type: "text" },
    ],
  },
];

// ─── Helper: require membership with permission ───────────────────────────────

async function requirePermission(
  res: Response,
  workspaceId: number,
  userId: number,
  permission: Parameters<typeof hasWorkspacePermission>[1]
): Promise<{ membership: Awaited<ReturnType<typeof pgFindWorkspaceMembership>> } | null> {
  const membership = await pgFindWorkspaceMembership(workspaceId, userId);
  if (!membership) {
    res.status(403).json({ message: "Not a member of this workspace" });
    return null;
  }
  if (!hasWorkspacePermission(membership.role as WorkspaceRole, permission)) {
    res.status(403).json({ message: "Insufficient permissions" });
    return null;
  }
  return { membership };
}

// ─── GET /workspaces — list all workspaces for current user ──────────────────

router.get("/workspaces", authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ message: "Authentication required" });

    const entries = await pgListUserWorkspaces(user.id);
    return res.json(
      entries.map(({ workspace, membership }) => ({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        type: workspace.type,
        description: workspace.description,
        iconUrl: workspace.iconUrl,
        settings: workspace.settings,
        role: membership.role,
        memberSince: membership.createdAt,
      }))
    );
  } catch (err) {
    logger.error("[workspace] GET /workspaces failed", { err: String(err) });
    return res.status(500).json({ message: "Failed to list workspaces" });
  }
});

// ─── GET /workspaces/templates — list available templates ────────────────────

router.get("/workspaces/templates", authenticateToken, async (_req: Request, res: Response) => {
  return res.json(WORKSPACE_TEMPLATES);
});

// ─── POST /workspaces — create workspace ─────────────────────────────────────

router.post("/workspaces", authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ message: "Authentication required" });

    const { name, description, type, iconUrl, settings, templateId } = req.body;
    if (!name || typeof name !== "string") {
      return res.status(400).json({ message: "name is required" });
    }

    const baseSlug = slugifyWorkspaceName(name);
    // Ensure slug uniqueness with a suffix if needed
    let slug = baseSlug;
    const existing = await pgFindWorkspaceBySlug(slug);
    if (existing) {
      slug = `${baseSlug}-${Date.now()}`;
    }

    const template = templateId
      ? (WORKSPACE_TEMPLATES.find((t) => t.id === templateId) ?? null)
      : null;

    const pool = getPgPool();

    // Create workspace + membership + optional channels in a transaction
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Insert workspace
      const wsRes = await client.query(
        `INSERT INTO workspaces (name, slug, type, description, owner_id, members, icon_url, settings)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [
          name.trim(),
          slug,
          type ?? template?.type ?? "business",
          description ?? null,
          user.id,
          [user.id],
          iconUrl ?? null,
          JSON.stringify(settings ?? {}),
        ]
      );
      const wsRow = wsRes.rows[0];
      const workspaceId: number = wsRow.id;

      // Create owner membership
      await client.query(
        `INSERT INTO workspace_memberships (workspace_id, user_id, role, status)
         VALUES ($1,$2,'owner','active')
         ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'owner', status = 'active'`,
        [workspaceId, user.id]
      );

      // Create template channels if applicable
      if (template && template.channels.length > 0) {
        for (const ch of template.channels) {
          await client.query(`INSERT INTO channels (workspace_id, name, type) VALUES ($1,$2,$3)`, [
            workspaceId,
            ch.name,
            ch.type,
          ]);
        }
      }

      await client.query("COMMIT");

      return res.status(201).json({
        id: workspaceId,
        name: wsRow.name,
        slug: wsRow.slug,
        type: wsRow.type,
        description: wsRow.description,
        iconUrl: wsRow.icon_url ?? null,
        settings: wsRow.settings ?? {},
        ownerId: user.id,
        role: "owner",
      });
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    logger.error("[workspace] POST /workspaces failed", { err: String(err) });
    return res.status(500).json({ message: "Failed to create workspace" });
  }
});

// ─── GET /workspaces/join/:token — preview invite info ───────────────────────
// Public on purpose: a brand-new invitee has no account/session yet, so the
// join page must be able to render the invite (and decide login vs signup)
// before the user authenticates. `accountExists` tells the client whether the
// invited email already has an account so it can show "sign in" vs a signup form.

router.get("/workspaces/join/:token", async (req: Request, res: Response) => {
  try {
    const hash = tokenHash(req.params.token);
    const invite = await pgFindWorkspaceInviteByTokenHash(hash);
    if (!invite) return res.status(404).json({ message: "Invalid or expired invite token" });

    const [workspace, inviter, invitedUser] = await Promise.all([
      pgFindWorkspaceById(invite.workspaceId),
      invite.invitedBy ? pgFindUserById(invite.invitedBy) : Promise.resolve(null),
      pgFindUserByEmail(invite.email),
    ]);

    const now = new Date();
    const status =
      invite.status !== "pending" ? invite.status : invite.expiresAt < now ? "expired" : "pending";

    return res.json({
      workspace: workspace
        ? {
            id: workspace.id,
            name: workspace.name,
            type: workspace.type,
            description: workspace.description,
            iconUrl: workspace.iconUrl,
          }
        : null,
      inviterName: inviter?.displayName || inviter?.name || null,
      email: invite.email,
      name: invite.name ?? null,
      role: invite.role,
      kind: invite.kind,
      accountExists: !!invitedUser,
      expiresAt: invite.expiresAt,
      status,
    });
  } catch (err) {
    logger.error("[workspace] GET /workspaces/join/:token failed", { err: String(err) });
    return res.status(500).json({ message: "Failed to fetch invite" });
  }
});

// ─── GET /workspaces/:id — get workspace ─────────────────────────────────────

router.get("/workspaces/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ message: "Authentication required" });

    const workspaceId = parseInt(req.params.id, 10);
    if (Number.isNaN(workspaceId)) return res.status(400).json({ message: "Invalid workspace id" });

    const [workspace, membership] = await Promise.all([
      pgFindWorkspaceById(workspaceId),
      pgFindWorkspaceMembership(workspaceId, user.id),
    ]);

    if (!workspace) return res.status(404).json({ message: "Workspace not found" });
    if (!membership) return res.status(403).json({ message: "Not a member of this workspace" });

    return res.json({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      type: workspace.type,
      description: workspace.description,
      iconUrl: workspace.iconUrl,
      settings: workspace.settings,
      ownerId: workspace.ownerId,
      role: membership.role,
      createdAt: workspace.createdAt,
    });
  } catch (err) {
    logger.error("[workspace] GET /workspaces/:id failed", { err: String(err) });
    return res.status(500).json({ message: "Failed to fetch workspace" });
  }
});

// ─── PATCH /workspaces/:id — update workspace ────────────────────────────────

router.patch("/workspaces/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ message: "Authentication required" });

    const workspaceId = parseInt(req.params.id, 10);
    if (Number.isNaN(workspaceId)) return res.status(400).json({ message: "Invalid workspace id" });

    const perm = await requirePermission(res, workspaceId, user.id, "workspace:update");
    if (!perm) return;

    const { name, description, iconUrl, settings } = req.body;
    const updated = await pgUpdateWorkspace(workspaceId, {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(iconUrl !== undefined && { iconUrl }),
      ...(settings !== undefined && { settings }),
    });

    if (!updated) return res.status(404).json({ message: "Workspace not found" });
    return res.json({
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      type: updated.type,
      description: updated.description,
      iconUrl: updated.iconUrl,
      settings: updated.settings,
    });
  } catch (err) {
    logger.error("[workspace] PATCH /workspaces/:id failed", { err: String(err) });
    return res.status(500).json({ message: "Failed to update workspace" });
  }
});

// ─── DELETE /workspaces/:id — delete workspace ───────────────────────────────

router.delete("/workspaces/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ message: "Authentication required" });

    const workspaceId = parseInt(req.params.id, 10);
    if (Number.isNaN(workspaceId)) return res.status(400).json({ message: "Invalid workspace id" });

    const perm = await requirePermission(res, workspaceId, user.id, "workspace:delete");
    if (!perm) return;

    await pgDeleteWorkspace(workspaceId);
    return res.json({ message: "Workspace deleted" });
  } catch (err) {
    logger.error("[workspace] DELETE /workspaces/:id failed", { err: String(err) });
    return res.status(500).json({ message: "Failed to delete workspace" });
  }
});

// ─── POST /workspaces/:id/activate — set as active workspace ─────────────────

router.post("/workspaces/:id/activate", authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ message: "Authentication required" });

    const workspaceId = parseInt(req.params.id, 10);
    if (Number.isNaN(workspaceId)) return res.status(400).json({ message: "Invalid workspace id" });

    const membership = await pgFindWorkspaceMembership(workspaceId, user.id);
    if (!membership) return res.status(403).json({ message: "Not a member of this workspace" });

    await pgUpdateUser(user.id, { lastActiveWorkspaceId: workspaceId });
    return res.json({ message: "Active workspace updated", workspaceId });
  } catch (err) {
    logger.error("[workspace] POST /workspaces/:id/activate failed", { err: String(err) });
    return res.status(500).json({ message: "Failed to activate workspace" });
  }
});

// ─── GET /workspaces/:id/members — list members ──────────────────────────────

router.get("/workspaces/:id/members", authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ message: "Authentication required" });

    const workspaceId = parseInt(req.params.id, 10);
    if (Number.isNaN(workspaceId)) return res.status(400).json({ message: "Invalid workspace id" });

    const membership = await pgFindWorkspaceMembership(workspaceId, user.id);
    if (!membership) return res.status(403).json({ message: "Not a member of this workspace" });

    const members = await pgListWorkspaceMembers(workspaceId);
    return res.json(
      members.map(({ user: u, membership: m }) => ({
        userId: u.id,
        email: u.email,
        displayName: u.displayName || u.name,
        avatarUrl: u.avatar,
        role: m.role,
        status: m.status,
        joinedAt: m.createdAt,
      }))
    );
  } catch (err) {
    logger.error("[workspace] GET /workspaces/:id/members failed", { err: String(err) });
    return res.status(500).json({ message: "Failed to list members" });
  }
});

// ─── PATCH /workspaces/:id/members/:uid — change member role ─────────────────

router.patch(
  "/workspaces/:id/members/:uid",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user?.id) return res.status(401).json({ message: "Authentication required" });

      const workspaceId = parseInt(req.params.id, 10);
      const targetUserId = parseInt(req.params.uid, 10);
      if (Number.isNaN(workspaceId) || Number.isNaN(targetUserId)) {
        return res.status(400).json({ message: "Invalid id" });
      }

      const perm = await requirePermission(res, workspaceId, user.id, "workspace:members:manage");
      if (!perm) return;

      const { role } = req.body;
      const validRoles = ["admin", "co-teacher", "teaching-assistant", "member", "auditor"];
      if (!role || !validRoles.includes(role)) {
        return res.status(400).json({ message: `role must be one of: ${validRoles.join(", ")}` });
      }

      // Cannot change owner's role
      const targetMembership = await pgFindWorkspaceMembership(workspaceId, targetUserId);
      if (!targetMembership) {
        return res.status(404).json({ message: "Member not found" });
      }
      if (targetMembership.role === "owner") {
        return res.status(403).json({ message: "Cannot change the owner's role" });
      }

      await pgUpsertWorkspaceMembership({ workspaceId, userId: targetUserId, role });
      return res.json({ message: "Role updated", userId: targetUserId, role });
    } catch (err) {
      logger.error("[workspace] PATCH /workspaces/:id/members/:uid failed", { err: String(err) });
      return res.status(500).json({ message: "Failed to update member role" });
    }
  }
);

// ─── DELETE /workspaces/:id/members/:uid — remove member ─────────────────────

router.delete(
  "/workspaces/:id/members/:uid",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user?.id) return res.status(401).json({ message: "Authentication required" });

      const workspaceId = parseInt(req.params.id, 10);
      const targetUserId = parseInt(req.params.uid, 10);
      if (Number.isNaN(workspaceId) || Number.isNaN(targetUserId)) {
        return res.status(400).json({ message: "Invalid id" });
      }

      const perm = await requirePermission(res, workspaceId, user.id, "workspace:members:remove");
      if (!perm) return;

      const targetMembership = await pgFindWorkspaceMembership(workspaceId, targetUserId);
      if (!targetMembership) {
        return res.status(404).json({ message: "Member not found" });
      }
      if (targetMembership.role === "owner") {
        return res.status(403).json({ message: "Cannot remove the workspace owner" });
      }

      const pool = getPgPool();
      await pool.query(
        "DELETE FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2",
        [workspaceId, targetUserId]
      );
      // Remove from members array
      await pool.query(
        `UPDATE workspaces SET members = array_remove(members, $1::bigint) WHERE id = $2`,
        [targetUserId, workspaceId]
      );

      return res.json({ message: "Member removed" });
    } catch (err) {
      logger.error("[workspace] DELETE /workspaces/:id/members/:uid failed", { err: String(err) });
      return res.status(500).json({ message: "Failed to remove member" });
    }
  }
);

// ─── POST /workspaces/:id/invites — create invite ────────────────────────────

router.post("/workspaces/:id/invites", authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ message: "Authentication required" });

    const workspaceId = parseInt(req.params.id, 10);
    if (Number.isNaN(workspaceId)) return res.status(400).json({ message: "Invalid workspace id" });

    const perm = await requirePermission(res, workspaceId, user.id, "workspace:invite");
    if (!perm) return;

    const { email, name, role, kind } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "email is required" });
    }
    const inviteRole = role ?? "member";
    const validRoles = ["admin", "co-teacher", "teaching-assistant", "member", "auditor"];
    if (!validRoles.includes(inviteRole)) {
      return res.status(400).json({ message: `role must be one of: ${validRoles.join(", ")}` });
    }

    const workspace = await pgFindWorkspaceById(workspaceId);
    if (!workspace) return res.status(404).json({ message: "Workspace not found" });

    // If the email already belongs to an active member, there's nothing to invite.
    const existingUser = await pgFindUserByEmail(email);
    if (existingUser) {
      const existingMembership = await pgFindWorkspaceMembership(workspaceId, existingUser.id);
      if (existingMembership && existingMembership.status === "active") {
        return res.status(409).json({ message: "This person is already a member" });
      }
    }

    // Don't pile up duplicate pending invites for the same email — re-arm the
    // existing one instead so the most recent link is the only valid one.
    const pending = await pgFindPendingWorkspaceInviteByEmail(workspaceId, email);
    if (pending) {
      const rawToken = randomToken();
      const refreshed = await pgResendWorkspaceInvite(
        pending.id,
        workspaceId,
        tokenHash(rawToken),
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      );
      sendWorkspaceInvite(
        email,
        name ?? pending.name ?? "",
        workspace.name,
        rawToken,
        kind ?? pending.kind ?? "business_member"
      ).catch((e) =>
        logger.warn("[workspace/invites] Failed to send invite email", { error: String(e) })
      );
      return res
        .status(200)
        .json({ id: pending.id, status: refreshed?.status ?? "pending", token: rawToken });
    }

    const rawToken = randomToken();
    const invite = await pgCreateWorkspaceInvite({
      workspaceId,
      email,
      name: name ?? null,
      role: inviteRole,
      kind: kind ?? "business_member",
      tokenHash: tokenHash(rawToken),
      invitedBy: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    sendWorkspaceInvite(
      email,
      name ?? "",
      workspace.name,
      rawToken,
      kind ?? "business_member"
    ).catch((e) =>
      logger.warn("[workspace/invites] Failed to send invite email", { error: String(e) })
    );

    return res.status(201).json({ id: invite.id, status: invite.status, token: rawToken });
  } catch (err) {
    logger.error("[workspace] POST /workspaces/:id/invites failed", { err: String(err) });
    return res.status(500).json({ message: "Failed to create invite" });
  }
});

// ─── GET /workspaces/:id/invites — list pending invites ──────────────────────

router.get("/workspaces/:id/invites", authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ message: "Authentication required" });

    const workspaceId = parseInt(req.params.id, 10);
    if (Number.isNaN(workspaceId)) return res.status(400).json({ message: "Invalid workspace id" });

    const perm = await requirePermission(res, workspaceId, user.id, "workspace:invite");
    if (!perm) return;

    const invites = await pgListWorkspaceInvites(workspaceId);
    return res.json(invites);
  } catch (err) {
    logger.error("[workspace] GET /workspaces/:id/invites failed", { err: String(err) });
    return res.status(500).json({ message: "Failed to list invites" });
  }
});

// ─── DELETE /workspaces/:id/invites/:iid — revoke invite ─────────────────────

router.delete(
  "/workspaces/:id/invites/:iid",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user?.id) return res.status(401).json({ message: "Authentication required" });

      const workspaceId = parseInt(req.params.id, 10);
      const inviteId = parseInt(req.params.iid, 10);
      if (Number.isNaN(workspaceId) || Number.isNaN(inviteId)) {
        return res.status(400).json({ message: "Invalid id" });
      }

      const perm = await requirePermission(res, workspaceId, user.id, "workspace:invite");
      if (!perm) return;

      await pgRevokeWorkspaceInvite(inviteId, workspaceId);
      return res.json({ message: "Invite revoked" });
    } catch (err) {
      logger.error("[workspace] DELETE /workspaces/:id/invites/:iid failed", { err: String(err) });
      return res.status(500).json({ message: "Failed to revoke invite" });
    }
  }
);

// ─── POST /workspaces/:id/invites/:iid/resend — re-arm + re-send invite ──────

router.post(
  "/workspaces/:id/invites/:iid/resend",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user?.id) return res.status(401).json({ message: "Authentication required" });

      const workspaceId = parseInt(req.params.id, 10);
      const inviteId = parseInt(req.params.iid, 10);
      if (Number.isNaN(workspaceId) || Number.isNaN(inviteId)) {
        return res.status(400).json({ message: "Invalid id" });
      }

      const perm = await requirePermission(res, workspaceId, user.id, "workspace:invite");
      if (!perm) return;

      const rawToken = randomToken();
      const invite = await pgResendWorkspaceInvite(
        inviteId,
        workspaceId,
        tokenHash(rawToken),
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      );
      if (!invite) return res.status(404).json({ message: "Invite not found" });

      const workspace = await pgFindWorkspaceById(workspaceId);
      sendWorkspaceInvite(
        invite.email,
        invite.name ?? "",
        workspace?.name ?? "the workspace",
        rawToken,
        invite.kind ?? "business_member"
      ).catch((e) =>
        logger.warn("[workspace/invites] Failed to send invite email", { error: String(e) })
      );

      return res.json({ id: invite.id, status: invite.status, token: rawToken });
    } catch (err) {
      logger.error("[workspace] POST /workspaces/:id/invites/:iid/resend failed", {
        err: String(err),
      });
      return res.status(500).json({ message: "Failed to resend invite" });
    }
  }
);

// ─── GET /workspaces/:id/onboarding — onboarding progress ───────────────────

router.get("/workspaces/:id/onboarding", authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ message: "Authentication required" });

    const workspaceId = parseInt(req.params.id, 10);
    if (Number.isNaN(workspaceId)) return res.status(400).json({ message: "Invalid workspace id" });

    const membership = await pgFindWorkspaceMembership(workspaceId, user.id);
    if (!membership) return res.status(403).json({ message: "Not a member of this workspace" });

    const progress = await pgGetWorkspaceOnboardingProgress(workspaceId);
    const isComplete = progress.hasMembers && progress.hasChannels && progress.hasClasses;
    return res.json({ ...progress, isComplete });
  } catch (err) {
    logger.error("[workspace] GET /workspaces/:id/onboarding failed", { err: String(err) });
    return res.status(500).json({ message: "Failed to fetch onboarding progress" });
  }
});

// ─── POST /workspaces/join/:token — join via invite token ────────────────────

router.post("/workspaces/join/:token", authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ message: "Authentication required" });

    const rawToken = req.params.token;
    const hash = tokenHash(rawToken);
    const invite = await pgFindWorkspaceInviteByTokenHash(hash);

    if (!invite) return res.status(404).json({ message: "Invalid or expired invite token" });
    if (invite.status !== "pending") {
      return res.status(409).json({ message: `Invite is already ${invite.status}` });
    }
    if (invite.expiresAt < new Date()) {
      return res.status(410).json({ message: "Invite has expired" });
    }

    // Validate email matches (optional but recommended)
    const userRecord = await pgFindUserById(user.id);
    if (userRecord && invite.email.toLowerCase() !== userRecord.email.toLowerCase()) {
      return res.status(403).json({ message: "This invite was sent to a different email address" });
    }

    await pgUpsertWorkspaceMembership({
      workspaceId: invite.workspaceId,
      userId: user.id,
      role: invite.role as WorkspaceRole,
      status: "active",
    });

    await pgAcceptWorkspaceInvite(invite.id);

    const workspace = await pgFindWorkspaceById(invite.workspaceId);
    return res.json({
      message: "Joined workspace successfully",
      workspace: workspace
        ? { id: workspace.id, name: workspace.name, slug: workspace.slug }
        : { id: invite.workspaceId },
      role: invite.role,
    });
  } catch (err) {
    logger.error("[workspace] POST /workspaces/join/:token failed", { err: String(err) });
    return res.status(500).json({ message: "Failed to join workspace" });
  }
});

// ─── POST /workspaces/:id/transfer — transfer ownership ──────────────────────

router.post("/workspaces/:id/transfer", authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ message: "Authentication required" });

    const workspaceId = parseInt(req.params.id, 10);
    if (Number.isNaN(workspaceId)) return res.status(400).json({ message: "Invalid workspace id" });

    const perm = await requirePermission(res, workspaceId, user.id, "workspace:delete");
    if (!perm) return;

    const { newOwnerId } = req.body;
    if (!newOwnerId || typeof newOwnerId !== "number") {
      return res.status(400).json({ message: "newOwnerId (number) is required" });
    }
    if (newOwnerId === user.id) {
      return res.status(400).json({ message: "Cannot transfer ownership to yourself" });
    }

    const newOwnerMembership = await pgFindWorkspaceMembership(workspaceId, newOwnerId);
    if (!newOwnerMembership) {
      return res.status(404).json({ message: "Target user is not a member of this workspace" });
    }

    const client = await getPgPool().connect();
    try {
      await client.query("BEGIN");
      // Demote current owner to admin
      await client.query(
        `INSERT INTO workspace_memberships (workspace_id, user_id, role, status)
         VALUES ($1,$2,'admin','active')
         ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'admin'`,
        [workspaceId, user.id]
      );
      // Promote new owner
      await client.query(
        `INSERT INTO workspace_memberships (workspace_id, user_id, role, status)
         VALUES ($1,$2,'owner','active')
         ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'owner'`,
        [workspaceId, newOwnerId]
      );
      // Update workspace owner_id
      await client.query("UPDATE workspaces SET owner_id = $1 WHERE id = $2", [
        newOwnerId,
        workspaceId,
      ]);
      await client.query("COMMIT");
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }

    return res.json({ message: "Ownership transferred", newOwnerId });
  } catch (err) {
    logger.error("[workspace] POST /workspaces/:id/transfer failed", { err: String(err) });
    return res.status(500).json({ message: "Failed to transfer ownership" });
  }
});

export default router;
