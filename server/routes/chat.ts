import { Router, Request, Response } from "express";
import { authenticateToken, requireVerifiedEmail } from "../middleware";
import { storage } from "../storage";
import { z } from "zod";
import {
  insertWorkspaceSchema,
  insertChannelSchema,
  insertMessageSchema,
  type Channel,
} from "@shared/schema";
import {
  pgFindWorkspaceMembership,
  pgFindWorkspaceById,
  pgCreateWorkspaceInvite,
} from "../lib/db/pg-queries";
import { isDmParticipant } from "../lib/chat/dm-channel";
import { randomToken, tokenHash } from "../lib/auth/auth-workspace";
import { sendWorkspaceInvite } from "../lib/integrations/mailer";
import { logger } from "../lib/logger";
import { recordAuditEvent, AUDIT_EVENTS } from "../lib/audit";
import { isPgReady, getPgPool } from "../db-pg";

const router = Router();

const workspaceInviteSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  role: z.enum(["admin", "member"]),
  kind: z.enum(["business_member", "student"]),
  studentMeta: z.record(z.string(), z.unknown()).optional(),
});

// ─── Workspace routes ───────────────────────────────────────────────────

router.post("/workspaces", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const body = insertWorkspaceSchema.parse({
      ...req.body,
      ownerId: req.session.userId,
      members: [],
    });

    const workspace = await storage.createWorkspace(body);
    return res.status(201).json(workspace);
  } catch (error) {
    if (error instanceof z.ZodError)
      return res.status(400).json({ message: "Invalid input", errors: error.errors });
    return res.status(500).json({ message: "Failed to create workspace" });
  }
});

router.get("/workspaces", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
    const workspaces = await storage.getWorkspaces(req.session.userId);
    return res.status(200).json(workspaces);
  } catch {
    return res.status(500).json({ message: "Failed to fetch workspaces" });
  }
});

router.get("/workspaces/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
    const workspace = await storage.getWorkspace(parseInt(req.params.id));
    if (!workspace) return res.status(404).json({ message: "Workspace not found" });
    if (!workspace.members.includes(req.session.userId)) {
      return res.status(403).json({ message: "Access denied" });
    }
    return res.status(200).json(workspace);
  } catch {
    return res.status(500).json({ message: "Failed to fetch workspace" });
  }
});

router.post(
  "/workspaces/:id/invites",
  authenticateToken,
  requireVerifiedEmail,
  async (req: Request, res: Response) => {
    try {
      const workspaceId = parseInt(req.params.id, 10);
      const user = (req as any).user;
      if (!user?.id || Number.isNaN(workspaceId)) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const membership = await pgFindWorkspaceMembership(workspaceId, user.id);
      if (!membership || !["owner", "admin"].includes(membership.role)) {
        return res
          .status(403)
          .json({ message: "Only workspace owners and admins can invite members" });
      }

      const parsed = workspaceInviteSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

      const workspace = await pgFindWorkspaceById(workspaceId);
      if (!workspace) return res.status(404).json({ message: "Workspace not found" });

      const rawToken = randomToken();
      const invite = await pgCreateWorkspaceInvite({
        workspaceId,
        email: parsed.data.email,
        name: parsed.data.name ?? null,
        role: parsed.data.kind === "student" ? "member" : parsed.data.role,
        kind: parsed.data.kind,
        tokenHash: tokenHash(rawToken),
        invitedBy: user.id,
        studentMeta: parsed.data.studentMeta ?? {},
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      sendWorkspaceInvite(
        parsed.data.email,
        parsed.data.name ?? "",
        workspace.name,
        rawToken,
        parsed.data.kind
      ).catch((e) =>
        logger.warn("[workspace/invites] Failed to send invite", { error: String(e) })
      );

      recordAuditEvent({
        actorUserId: user.id,
        eventType: AUDIT_EVENTS.INVITE_SENT,
        payload: {
          workspaceId,
          email: parsed.data.email,
          kind: parsed.data.kind,
          role: invite.role,
        },
      });

      return res.status(201).json({ id: invite.id, status: invite.status });
    } catch (error) {
      logger.error("[workspace/invites] Error", { error: String(error) });
      return res.status(500).json({ message: "Failed to create invite" });
    }
  }
);

router.post("/workspaces/:id/members", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
    const workspaceId = parseInt(req.params.id);
    const workspace = await storage.getWorkspace(workspaceId);
    if (!workspace) return res.status(404).json({ message: "Workspace not found" });

    if (workspace.ownerId !== req.session.userId && (req.session.role || "") !== "teacher") {
      return res
        .status(403)
        .json({ message: "Only the workspace owner or teachers can add members" });
    }

    const { userId } = req.body;
    if (!userId || typeof userId !== "number") {
      return res.status(400).json({ message: "userId (number) is required" });
    }

    const updated = await storage.addMemberToWorkspace(workspaceId, userId);
    return res.status(200).json(updated);
  } catch {
    return res.status(500).json({ message: "Failed to add member" });
  }
});

router.delete(
  "/workspaces/:id/members/:userId",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
      const workspaceId = parseInt(req.params.id);
      const targetUserId = parseInt(req.params.userId);

      const workspace = await storage.getWorkspace(workspaceId);
      if (!workspace) return res.status(404).json({ message: "Workspace not found" });

      if (workspace.ownerId !== req.session.userId && (req.session.role || "") !== "teacher") {
        return res
          .status(403)
          .json({ message: "Only the workspace owner or teachers can remove members" });
      }

      const updated = await storage.removeMemberFromWorkspace(workspaceId, targetUserId);
      return res.status(200).json(updated);
    } catch {
      return res.status(500).json({ message: "Failed to remove member" });
    }
  }
);

// ─── Channel routes ───────────────────────────────────────────────────

router.post("/workspaces/:id/channels", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
    if ((req.session.role || "") !== "teacher") {
      return res.status(403).json({ message: "Only teachers can create channels" });
    }

    const workspaceId = parseInt(req.params.id);
    const workspace = await storage.getWorkspace(workspaceId);
    if (!workspace) return res.status(404).json({ message: "Workspace not found" });
    if (!workspace.members.includes(req.session.userId)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const body = insertChannelSchema.parse({ ...req.body, workspaceId });
    const channel = await storage.createChannel(body);
    return res.status(201).json(channel);
  } catch (error) {
    if (error instanceof z.ZodError)
      return res.status(400).json({ message: "Invalid input", errors: error.errors });
    return res.status(500).json({ message: "Failed to create channel" });
  }
});

router.get("/workspaces/:id/channels", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
    const workspaceId = parseInt(req.params.id);
    const workspace = await storage.getWorkspace(workspaceId);
    if (!workspace) return res.status(404).json({ message: "Workspace not found" });
    if (!workspace.members.includes(req.session.userId)) {
      return res.status(403).json({ message: "Access denied" });
    }
    const channels = await storage.getChannelsByWorkspace(workspaceId);
    return res.status(200).json(channels);
  } catch {
    return res.status(500).json({ message: "Failed to fetch channels" });
  }
});

router.post("/channels", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });

    const channelData = insertChannelSchema.parse(req.body);

    if (!channelData.workspaceId)
      return res.status(400).json({ message: "Workspace ID is required" });
    const workspace = await storage.getWorkspace(channelData.workspaceId);
    if (!workspace || !workspace.members.includes(req.session.userId)) {
      return res.status(403).json({ message: "You are not a member of this workspace" });
    }

    const channel = await storage.createChannel(channelData);
    return res.status(201).json(channel);
  } catch (error) {
    if (error instanceof z.ZodError)
      return res.status(400).json({ message: "Invalid input", errors: error.errors });
    return res.status(500).json({ message: "Failed to create channel" });
  }
});

router.get("/channels/:id/messages", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });

    const channelId = parseInt(req.params.id);
    const channel = await storage.getChannel(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    // DM channels carry no workspace_id, so the workspace gate below rejected
    // every one of them — this is the route the client loads DM history from,
    // so a conversation you could see in the list 403'd the moment you opened
    // it. Authorize DMs by exact participation instead.
    if (channel.type === "dm") {
      if (!isDmParticipant(channel.name, req.session.userId))
        return res.status(403).json({ message: "Access denied" });
      const dmLimit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const dmBefore = req.query.before ? parseInt(req.query.before as string) : undefined;
      return res.status(200).json(await storage.getMessagesByChannel(channelId, dmLimit, dmBefore));
    }

    if (channel.workspaceId === null || channel.workspaceId === undefined)
      return res.status(403).json({ message: "Access denied" });
    const workspace = await storage.getWorkspace(channel.workspaceId);
    if (!workspace || !workspace.members.includes(req.session.userId)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const before = req.query.before ? parseInt(req.query.before as string) : undefined;

    const messages = await storage.getMessagesByChannel(channelId, limit, before);
    return res.status(200).json(messages);
  } catch {
    return res.status(500).json({ message: "Failed to fetch messages" });
  }
});

router.get("/channels/:id/unread", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
    const channelId = parseInt(req.params.id);

    const channel = await storage.getChannel(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    const messages = await storage.getMessagesByChannel(channelId, 50);
    const unreadCount = messages.filter((m) => !m.readBy?.includes(req.session!.userId!)).length;

    return res.status(200).json({ unreadCount });
  } catch {
    return res.status(500).json({ message: "Failed to fetch unread count" });
  }
});

router.get("/channels/:id/pinned", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });

    const channelId = parseInt(req.params.id);
    const channel = await storage.getChannel(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    if (channel.workspaceId === null || channel.workspaceId === undefined)
      return res.status(403).json({ message: "Access denied" });
    const workspace = await storage.getWorkspace(channel.workspaceId);
    if (!workspace || !workspace.members.includes(req.session.userId)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const pinned = await storage.getPinnedMessages(channelId);
    return res.status(200).json(pinned);
  } catch {
    return res.status(500).json({ message: "Failed to fetch pinned messages" });
  }
});

router.get(
  "/channels/query/:classOrUser",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
      const { classOrUser } = req.params;

      const allWorkspaces = await storage.getWorkspaces(req.session.userId);
      const workspaceIds = allWorkspaces.map((ws) => ws.id);
      const allChannels = await storage.getChannelsByWorkspaces(workspaceIds);

      const filtered = allChannels.filter(
        (c) =>
          !classOrUser ||
          c.class === classOrUser ||
          c.name.toLowerCase().includes(classOrUser.toLowerCase()) ||
          (c.subject && c.subject.toLowerCase().includes(classOrUser.toLowerCase()))
      );

      return res.status(200).json(filtered);
    } catch {
      return res.status(500).json({ message: "Failed to fetch channels" });
    }
  }
);

router.post(
  "/channels/:id/pin/:messageId",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
      if ((req.session.role || "") !== "teacher") {
        return res.status(403).json({ message: "Only teachers can pin messages" });
      }

      const channelId = parseInt(req.params.id);
      const messageId = parseInt(req.params.messageId);

      const channel = await storage.pinMessage(channelId, messageId);
      if (!channel) return res.status(404).json({ message: "Channel or message not found" });

      return res.status(200).json(channel);
    } catch {
      return res.status(500).json({ message: "Failed to pin message" });
    }
  }
);

router.delete(
  "/channels/:id/pin/:messageId",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
      if ((req.session.role || "") !== "teacher") {
        return res.status(403).json({ message: "Only teachers can unpin messages" });
      }

      const channelId = parseInt(req.params.id);
      const messageId = parseInt(req.params.messageId);

      const channel = await storage.unpinMessage(channelId, messageId);
      if (!channel) return res.status(404).json({ message: "Channel or message not found" });

      return res.status(200).json(channel);
    } catch {
      return res.status(500).json({ message: "Failed to unpin message" });
    }
  }
);

// ─── Message routes ───────────────────────────────────────────────────

router.get("/messages/:channelId", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });

    const channelId = parseInt(req.params.channelId);
    const channel = await storage.getChannel(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    if (channel.type !== "dm") {
      if (!channel.workspaceId) return res.status(403).json({ message: "Access denied" });
      const workspace = await storage.getWorkspace(channel.workspaceId);
      if (!workspace || !workspace.members.includes(req.session.userId)) {
        return res.status(403).json({ message: "Access denied" });
      }
    } else if (!isDmParticipant(channel.name, req.session.userId)) {
      // Was `name.includes(userId)`: user 1 passed for channel `dm_10_20` and
      // read a conversation between two strangers.
      return res.status(403).json({ message: "Access denied" });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const before = req.query.before ? parseInt(req.query.before as string) : undefined;

    const messages = await storage.getMessagesByChannel(channelId, limit, before);
    return res.status(200).json(messages);
  } catch {
    return res.status(500).json({ message: "Failed to fetch messages" });
  }
});

router.post("/messages", authenticateToken, async (req: Request, res: Response) => {
  try {
    // Token-authenticated requests have no session; fall back to req.user.
    const userId = (req as any).user?.id || req.session?.userId;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const body = insertMessageSchema.parse({
      ...req.body,
      authorId: userId,
    });

    const channel = await storage.getChannel(body.channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    if (channel.type === "dm") {
      // Was `split("-")` against `dm_1_2` names, so this denied every DM send
      // including the participants' own.
      if (!isDmParticipant(channel.name, userId)) {
        return res.status(403).json({ message: "Access denied" });
      }
    } else {
      if (!channel.workspaceId) return res.status(403).json({ message: "Access denied" });
      const workspace = await storage.getWorkspace(channel.workspaceId);
      if (!workspace || !workspace.members.includes(userId)) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    const message = await storage.createMessage(body);
    return res.status(201).json(message);
  } catch (error) {
    if (error instanceof z.ZodError)
      return res.status(400).json({ message: "Invalid input", errors: error.errors });
    return res.status(500).json({ message: "Failed to create message" });
  }
});

router.delete("/messages/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });

    const messageId = parseInt(req.params.id);
    if (isNaN(messageId)) return res.status(400).json({ message: "Invalid message ID" });

    if (!isPgReady()) return res.status(503).json({ message: "Database unavailable" });
    const msgRow = (
      await getPgPool().query("SELECT author_id, channel_id FROM messages WHERE id = $1", [
        messageId,
      ])
    ).rows[0];
    if (!msgRow) return res.status(404).json({ message: "Message not found" });

    const authorId = parseInt(msgRow.author_id);
    const channelId = parseInt(msgRow.channel_id);

    const isAuthor = authorId === req.session.userId;
    const isTeacher = req.session.role === "teacher";

    if (!isAuthor && !isTeacher) {
      return res.status(403).json({ message: "You can only delete your own messages" });
    }

    await storage.deleteMessage(messageId, channelId);
    return res.status(200).json({ message: "Message deleted" });
  } catch {
    return res.status(500).json({ message: "Failed to delete message" });
  }
});

router.post("/messages/:id/grade", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId || (req.session.role || "") !== "teacher") {
      return res.status(401).json({ message: "Only teachers can grade homework" });
    }

    const messageId = parseInt(req.params.id);
    if (isNaN(messageId)) return res.status(400).json({ message: "Invalid message ID" });

    const { status, channelId } = req.body;

    if (!["pending", "graded"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const updated = await storage.gradeMessage(
      messageId,
      status,
      channelId ? parseInt(channelId) : undefined
    );
    if (!updated) return res.status(404).json({ message: "Message not found" });

    return res.status(200).json(updated);
  } catch {
    return res.status(500).json({ message: "Failed to grade message" });
  }
});

router.post("/messages/:id/read", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
    const messageId = parseInt(req.params.id);
    if (isNaN(messageId)) return res.status(400).json({ message: "Invalid message ID" });
    const { channelId } = req.body;

    const updated = await storage.markMessageAsRead(
      messageId,
      req.session.userId,
      channelId ? parseInt(channelId) : undefined
    );
    if (!updated) return res.status(404).json({ message: "Message not found" });
    return res.status(200).json(updated);
  } catch {
    return res.status(500).json({ message: "Failed to mark message as read" });
  }
});

// ─── DM routes ───────────────────────────────────────────────────

router.post("/channels/dm", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });

    const { userIds } = req.body;
    if (!Array.isArray(userIds) || userIds.length < 2) {
      return res.status(400).json({ message: "At least two userIds are required" });
    }

    const id1 = parseInt(userIds[0]);
    const id2 = parseInt(userIds[1]);

    if (isNaN(id1) || isNaN(id2)) {
      return res.status(400).json({ message: "Invalid user IDs" });
    }

    // The caller has to be in the conversation they are opening. Without this
    // any authenticated user could mint or fetch the channel id for any two
    // strangers, which is the handle every other DM check keys off.
    if (id1 !== req.session.userId && id2 !== req.session.userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const channel = await storage.getOrCreateDMChannel(id1, id2);
    return res.status(200).json(channel);
  } catch {
    return res.status(500).json({ message: "Failed to create/fetch DM channel" });
  }
});

router.get("/users/me/dms", authenticateToken, async (req: Request, res: Response) => {
  try {
    // NOTE: session-only, like all 43 other auth checks in this router. Mobile
    // clients are token-only by contract (W-1) and therefore cannot use chat at
    // all — making just this route token-aware would hand mobile a DM list it
    // could not open. Tracked in TODOS.md as its own change.
    if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });

    const currentUserId = req.session.userId;
    const dms = await storage.getDMsByUser(currentUserId);

    const enrichedDms = await Promise.all(
      dms.map(async (dm) => {
        const parts = dm.name.split("_");
        if (parts.length === 3) {
          const id1 = parseInt(parts[1]);
          const id2 = parseInt(parts[2]);
          const partnerId = id1 === currentUserId ? id2 : id1;

          const partner = await storage.getUser(partnerId);
          if (partner) {
            return {
              ...dm,
              partner: {
                id: partner.id,
                username: partner.username,
                // #324.2: `username` is empty for every seeded and invited
                // account (only self-signup generates one), and the client
                // uses it as the conversation title — so a working DM list
                // would still have rendered blank rows. Added rather than
                // substituted so existing consumers of `username` are
                // untouched.
                name: partner.name || partner.username,
                avatar: partner.avatar,
                role: partner.role,
              },
            };
          }
        }
        return dm;
      })
    );

    return res.status(200).json(enrichedDms);
  } catch {
    return res.status(500).json({ message: "Failed to fetch DMs" });
  }
});

// ─── Conversation routes ───────────────────────────────────────────────────

router.get("/chat/conversations", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const userId = req.session.userId;
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const role = user.role ?? "student";

    let workspaces = await storage.getWorkspaces(userId);
    if (workspaces.length === 0) {
      const newWs = await storage.createWorkspace({
        name: "School",
        description: "Default school workspace",
        ownerId: userId,
        members: [userId],
      });

      const defaultChannels = [
        { name: "school-announcements", type: "announcement" as const },
        { name: "class-10a-mathematics", type: "text" as const, subject: "Mathematics" },
        { name: "class-10a-science", type: "text" as const, subject: "Science" },
        { name: "class-10a-english", type: "text" as const, subject: "English" },
      ];

      for (const ch of defaultChannels) {
        await storage.createChannel({
          workspaceId: newWs.id,
          name: ch.name,
          type: ch.type,
          subject: (ch as any).subject ?? null,
        });
      }

      workspaces = await storage.getWorkspaces(userId);
      logger.info(`[chat/conversations] Seeded workspace`, { userId });
    }

    type ExtendedChannel = Channel & { category?: string; isReadOnly?: boolean };
    const workspaceIds = workspaces.map((ws) => ws.id);
    const allChannels = (await storage.getChannelsByWorkspaces(workspaceIds)) as ExtendedChannel[];

    const accessible = allChannels.filter((ch: ExtendedChannel) => {
      const category = ch.category ?? "class";
      if (category === "announcement") return true;
      if (category === "class" && (role === "student" || role === "teacher")) return true;
      if (category === "teacher" && role === "student") return true;
      if (category === "parent" && role === "teacher") return true;
      if (category === "friend" && role === "student") return true;
      return false;
    });

    const conversations = accessible.map((ch: ExtendedChannel) => ({
      id: String(ch.id),
      name: ch.name,
      category: ch.category ?? "class",
      isGroup: ch.type !== "dm",
      isReadOnly: ch.isReadOnly ?? false,
      participants: [],
      lastMessage: undefined,
      unreadCount: 0,
      subject: ch.subject ?? undefined,
    }));

    return res.status(200).json(conversations);
  } catch (err) {
    console.error("[chat/conversations] Error:", err);
    return res.status(500).json({ message: "Failed to fetch conversations" });
  }
});

router.post(
  "/chat/conversations/:id/read",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });

      const channelId = parseInt(req.params.id);
      if (isNaN(channelId)) return res.status(400).json({ message: "Invalid conversation ID" });

      const messages = await storage.getMessagesByChannel(channelId, 100);
      await Promise.all(
        messages
          .filter((m: { readBy?: number[] }) => !m.readBy?.includes(req.session!.userId!))
          .map((m: { id: number }) => storage.markMessageAsRead(m.id, req.session!.userId!))
      );

      if (isPgReady()) {
        getPgPool()
          .query("UPDATE channels SET unread_counts = unread_counts - $1 WHERE id = $2", [
            String(req.session.userId),
            channelId,
          ])
          .catch(() => null);
      }

      return res.status(200).json({ message: "Marked as read" });
    } catch {
      return res.status(500).json({ message: "Failed to mark conversation as read" });
    }
  }
);

export default router;
