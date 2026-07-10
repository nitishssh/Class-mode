import { Router, Request, Response } from "express";
import { authenticateToken } from "../middleware";
import { storage } from "../storage";

const router = Router();

function authedUserId(req: Request): number | null {
  const userId = (req as any).user?.id ?? req.session?.userId;
  return typeof userId === "number" && Number.isFinite(userId) ? userId : null;
}

// ─── Notification routes ──────────────────────────────────────────────────

router.get("/notifications", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = authedUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const notifications = await storage.getNotificationsByUser(userId);
    return res.status(200).json(notifications);
  } catch {
    return res.status(500).json({ message: "Failed to get notifications" });
  }
});

router.patch("/notifications/read-all", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = authedUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    await storage.markAllNotificationsRead(userId);
    return res.status(200).json({ message: "All notifications marked as read" });
  } catch {
    return res.status(500).json({ message: "Failed to mark all notifications as read" });
  }
});

router.patch("/notifications/:id/read", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = authedUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const notifId = parseInt(req.params.id);
    if (isNaN(notifId)) {
      return res.status(400).json({ message: "Invalid notification ID" });
    }
    const updated = await storage.markNotificationRead(notifId, userId);
    if (updated === undefined) {
      const all = await storage.getNotificationsByUser(userId);
      const owned = all.find((n) => n.id === notifId);
      if (!owned) {
        return res.status(404).json({ message: "Notification not found" });
      }
      return res.status(403).json({ message: "Forbidden: Not your notification" });
    }
    return res.status(200).json(updated);
  } catch {
    return res.status(500).json({ message: "Failed to mark notification as read" });
  }
});

router.delete("/notifications/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = authedUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const notifId = parseInt(req.params.id);
    if (isNaN(notifId)) {
      return res.status(400).json({ message: "Invalid notification ID" });
    }
    const allNotifs = await storage.getNotificationsByUser(userId);
    const owned = allNotifs.find((n) => n.id === notifId);
    if (!owned) {
      return res.status(404).json({ message: "Notification not found" });
    }
    const deleted = await storage.dismissNotification(notifId, userId);
    if (!deleted) {
      return res.status(403).json({ message: "Forbidden: Not your notification" });
    }
    return res.status(204).send();
  } catch {
    return res.status(500).json({ message: "Failed to delete notification" });
  }
});

// ─── Push Token routes ────────────────────────────────────────────────────

router.post("/tokens", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = authedUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { token, deviceType } = req.body;
    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "Token is required" });
    }
    await storage.savePushToken(userId, token, deviceType || null);
    return res.status(200).json({ success: true, message: "Push token registered successfully" });
  } catch (error) {
    console.error("Failed to save push token:", error);
    return res.status(500).json({ message: "Failed to register push token" });
  }
});

router.delete("/tokens", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = authedUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { token } = req.body;
    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "Token is required" });
    }
    await storage.deletePushToken(userId, token);
    return res.status(200).json({ success: true, message: "Push token removed successfully" });
  } catch (error) {
    console.error("Failed to delete push token:", error);
    return res.status(500).json({ message: "Failed to remove push token" });
  }
});

export default router;
