import { type Request, type Response, type NextFunction } from "express";
import { isPgReady } from "./db-pg";

// ── DB health guard ───────────────────────────────────────────────────────────
export function requireDb(req: Request, res: Response, next: NextFunction) {
  // Allow health / diagnostic endpoints through even when DB is down
  if (
    req.path === "/health" ||
    req.path.startsWith("/health/") ||
    req.path === "/ai-classroom/health"
  ) {
    return next();
  }
  if (!isPgReady()) {
    return res.status(503).json({
      error: "Database unavailable",
      message: "The application is unable to reach the database. Check that POSTGRESQL_URL is set and the server started.",
      action: "Check the server logs for connection errors.",
    });
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

export function requireWorkspaceRole(...roles: Array<"owner" | "admin" | "member">) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = (req as any).workspaceRole as string | null;
    if (!role || !roles.includes(role as any)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

export function requireVerifiedEmail(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user?.emailVerified) {
    return res.status(403).json({ error: "Email verification required" });
  }
  next();
}

export function requireActiveWorkspace(req: Request, res: Response, next: NextFunction) {
  if (!(req as any).workspace || !(req as any).workspaceRole) {
    return res.status(403).json({ error: "Active workspace required" });
  }
  next();
}

// ── PostgreSQL health guard (for Phase 8+ migrated routes) ───────────────────
export function requirePg(req: Request, res: Response, next: NextFunction) {
  if (!isPgReady()) {
    return res.status(503).json({ error: "PostgreSQL unavailable" });
  }
  next();
}

// ── Student data scoping ──────────────────────────────────────────────────────
export function scopeToStudent(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  const requestedId = req.params.studentId;
  if (user?.role === "student" && requestedId && requestedId !== String(user.id)) {
    return res.status(403).json({ error: "You can only access your own data" });
  }
  next();
}
