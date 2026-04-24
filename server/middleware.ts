import { type Request, type Response, type NextFunction } from "express";
import mongoose from "mongoose";

// ── DB health guard ───────────────────────────────────────────────────────────
export function requireDb(req: Request, res: Response, next: NextFunction) {
  // Allow health / diagnostic endpoints through even when DB is down
  if (req.path === "/health" || req.path.startsWith("/health/") || req.path === "/ai-classroom/health") {
    return next();
  }
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: "Database unavailable, try again shortly" });
  }
  next();
}

// ── Auth check (session-based fallback) ───────────────────────────────────────
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ── Role guard ────────────────────────────────────────────────────────────────
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

// ── Student data scoping ──────────────────────────────────────────────────────
export function scopeToStudent(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  const requestedId = req.params.studentId;
  if (user?.role === "student" && requestedId && requestedId !== user.uid) {
    return res.status(403).json({ error: "You can only access your own data" });
  }
  next();
}
