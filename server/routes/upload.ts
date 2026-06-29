import { Router, Request, Response } from "express";
import { upload, diskPathToUrl } from "../lib/upload";
import { logger } from "../lib/logger";
import { authenticateToken } from "../middleware";

const router = Router();

// POST /api/upload — Real multipart file upload (multer disk storage)
router.post("/", authenticateToken, upload.single("file"), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "No file provided. Send a multipart/form-data request with field name 'file'.",
      });
    }

    const url = diskPathToUrl(req.file.path);
    const userId = (req as any).user?.id || req.session?.userId;
    logger.info(`[upload] file uploaded`, { userId });

    return res.status(200).json({
      url,
      name: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
    });
  } catch {
    return res.status(500).json({ message: "Upload failed" });
  }
});

export default router;
