import { Router, Response, Request as ExpressRequest } from "express";
import { pgFindUserById, pgDeleteUser, pgExportInteractionLog } from "../lib/db/pg-queries";
import { authenticateToken } from "../middleware";
import { logger } from "../lib/logger";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const archiver = require("archiver");

const router = Router();

router.get("/export", authenticateToken, async (req: ExpressRequest, res: Response) => {
  const user = (req as any).user;
  try {
    const userDoc = await pgFindUserById(user.id);
    if (!userDoc) return res.status(404).json({ error: "User not found" });

    // Interaction log holds the student's own learning activity (incl. Study
    // Arena gate answers) — it is personal data and must be in the right-of-
    // access export, not just profile.json.
    const interactions = await pgExportInteractionLog(user.id);

    const zip = archiver("zip", { zlib: { level: 9 } });
    res.attachment("user-data.zip");
    zip.pipe(res);
    zip.append(JSON.stringify(userDoc, null, 2), { name: "profile.json" });
    zip.append(JSON.stringify(interactions, null, 2), { name: "learning-activity.json" });
    await zip.finalize();
  } catch (err: any) {
    logger.error("GDPR export error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Export failed" });
  }
});

router.delete("/delete", authenticateToken, async (req: ExpressRequest, res: Response) => {
  const user = (req as any).user;
  try {
    await pgDeleteUser(user.id);
    res.json({ success: true, message: "User data deleted" });
  } catch (err: any) {
    logger.error("GDPR delete error:", err);
    res.status(500).json({ error: "Deletion failed" });
  }
});

export default router;
