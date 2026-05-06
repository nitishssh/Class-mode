import { Router, Request, Response } from "express";
import { MongoUser } from "../../shared/mongo-schema";
import { authenticateToken } from "../routes";
import { logger } from "../lib/logger";
import archiver from "archiver";
import { Request as ExpressRequest } from "express";

const router = Router();

router.get("/export", authenticateToken, async (req: ExpressRequest, res: Response) => {
  const user = (req as any).user;
  try {
    const userDoc = await MongoUser.findOne({ id: user.id }).lean();
    if (!userDoc) return res.status(404).json({ error: "User not found" });

    const zip = archiver("zip", { zlib: { level: 9 } });
    res.attachment("user-data.zip");
    zip.pipe(res);

    zip.append(JSON.stringify(userDoc, null, 2), { name: "profile.json" });

    zip.finalize();
  } catch (err: any) {
    logger.error("GDPR export error:", err);
    res.status(500).json({ error: "Export failed" });
  }
});

router.delete("/delete", authenticateToken, async (req: ExpressRequest, res: Response) => {
  const user = (req as any).user;
  try {
    await MongoUser.deleteOne({ id: user.id });
    res.json({ success: true, message: "User data deleted" });
  } catch (err: any) {
    logger.error("GDPR delete error:", err);
    res.status(500).json({ error: "Deletion failed" });
  }
});

export default router;
