import { Router, Request, Response } from "express";
import { MongoLmsConnection, getNextSequenceValue } from "../../shared/mongo-schema";
import { authenticateToken } from "../routes";
import { getAuthUrl, exchangeCode, syncAssignments } from "../lib/lms/googleClassroom";
import { logger } from "../lib/logger";

const router = Router();

router.get("/google/auth", authenticateToken, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const url = getAuthUrl(String(user.id));
  res.redirect(url);
});

router.get("/google/callback", async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const userId = req.query.state as string;
  if (!code || !userId) return res.status(400).send("Missing code or state");

  try {
    const tokens = await exchangeCode(code);
    const seq = await getNextSequenceValue("LmsConnection");
    await MongoLmsConnection.create({
      id: seq,
      userId: Number(userId),
      provider: "google_classroom",
      accessToken: tokens.accessToken as string,
      refreshToken: tokens.refreshToken as string,
      tokenExpiry: tokens.expiryDate ? new Date(tokens.expiryDate) : null,
    });
    res.redirect("/educator/lms?connected=true");
  } catch (err: any) {
    logger.error("Google OAuth callback error:", err);
    res.status(500).send("OAuth failed");
  }
});

router.get("/google/sync", authenticateToken, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const conn = await MongoLmsConnection.findOne({ userId: user.id, provider: "google_classroom" });
  if (!conn) return res.status(400).json({ error: "Not connected to Google Classroom" });

  const assignments = await syncAssignments(user.id, (conn as any).accessToken);
  res.json({ success: true, data: assignments });
});

export default router;
