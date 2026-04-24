/**
 * Multer disk-storage configuration for file uploads.
 *
 * Files are stored in <project-root>/public/uploads/<YYYY-MM-DD>/
 * with a timestamp-prefixed safe filename.
 *
 * Max file size  : 10 MB
 * Allowed types  : images (jpeg, png, gif, webp) + pdf + common docs
 */

import multer, { FileFilterCallback } from "multer";
import path from "path";
import fs from "fs";
import { Request } from "express";

// ─── Destination ──────────────────────────────────────────────────────────────

const UPLOAD_DIR = path.resolve("public", "uploads");

/** Return today's dated sub-folder, creating it if missing. */
function getDatedDir(): string {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const dir = path.join(UPLOAD_DIR, today);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, getDatedDir());
  },
  filename(_req, file, cb) {
    // Sanitise original name (strip spaces/special chars)
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}_${safeName}`);
  },
});

// ─── File filter ──────────────────────────────────────────────────────────────

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

function fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
  if (ALLOWED_MIME.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type '${file.mimetype}' is not allowed.`));
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
});

/** Convert an absolute disk path to a web-accessible URL path. */
export function diskPathToUrl(absPath: string): string {
  // e.g. /path/to/project/public/uploads/2025-01-01/file.png
  //  → /uploads/2025-01-01/file.png
  const rel = path.relative(path.resolve("public"), absPath);
  return "/" + rel.replace(/\\/g, "/");
}
