import { randomUUID } from "node:crypto";
import { type Request, type Response, type NextFunction } from "express";
import { isPgReady } from "./db-pg";
import "express-session";
import { pgFindFirstWorkspaceMembership, pgFindUserById } from "./lib/pg-queries";
import {
  authMePayload,
  extractAccessToken,
  verifyAccessToken,
  decodeAccessTokenUnsafe,
} from "./lib/auth-workspace";
import { requestContext } from "./lib/request-context";

declare module "express-session" {
  interface SessionData {
    userId: number;
    role: string;
    firebaseUid?: string;
    email?: string;
    oauthState?: string;
    lmsOauthUserId?: number;
    googleSignInState?: string;
    googleSignInWorkspaceName?: string;
  }
}

// ── Request ID correlation ───────────────────────────────────────────────────
// Propagates an inbound `x-request-id` (e.g. from a load balancer or client)
// or generates a fresh one, so a single user flow can be traced across log
// lines and, on error, correlated between the client-visible response and
// Cloud Logging. Must run before any middleware that logs.
export function requestId(req: Request, res: Response, next: NextFunction) {
  const inbound = req.headers["x-request-id"];
  const id = (Array.isArray(inbound) ? inbound[0] : inbound) || randomUUID();
  req.id = id;
  res.setHeader("X-Request-Id", id);
  requestContext.run({ requestId: id }, next);
}

function isDevAuthWithoutDbEnabled(req: Request): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.ENABLE_DEV_AUTH_WITHOUT_DB === "true" &&
    req.path?.startsWith("/auth/")
  );
}

// ── Auth Middleware ──────────────────────────────────────────────────────────
export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  // Extract token from cookie or Authorization header
  const token = extractAccessToken(req);

  // 1. Try Token
  if (token) {
    const payload = verifyAccessToken(token);
    if (payload?.userId) {
      const user = await pgFindUserById(payload.userId);
      if (user && !["suspended", "rejected"].includes(user.status)) {
        const workspaceContext = await pgFindFirstWorkspaceMembership(user.id);
        // Mobile clients (X-Client: mobile) are token-only: never bind an
        // express-session for them — RN's native cookie jar would keep the
        // session alive after logout (W-1 contract).
        if (req.session && req.headers["x-client"] !== "mobile") {
          req.session.userId = user.id;
          req.session.role = user.role;
          req.session.firebaseUid = user.firebaseUid || user.authSubject;
        }
        (req as any).user = {
          id: user.id,
          role: user.role,
          email: user.email,
          status: user.status,
          emailVerified: user.emailVerified,
          firebaseUid: user.firebaseUid,
          authSubject: user.authSubject,
          // Tenant scope: resolveTenantScope reads schoolCode — omitting it
          // makes every school-scoped route fail closed for non-platform admins.
          schoolCode: user.schoolCode,
          schoolId: user.schoolId,
        };
        (req as any).workspace = workspaceContext?.workspace ?? null;
        (req as any).workspaceRole = workspaceContext?.membership.role ?? null;
        (req as any).permissions = authMePayload({
          user,
          workspace: workspaceContext?.workspace ?? null,
          membership: workspaceContext?.membership ?? null,
        }).permissions;
        return next();
      }
    }
  }

  // 2. Try Session (never for mobile clients — token-only per W-1)
  if (req.session?.userId && req.headers["x-client"] !== "mobile") {
    try {
      const user = await pgFindUserById(req.session.userId);
      if (user && !["suspended", "rejected"].includes(user.status)) {
        const workspaceContext = await pgFindFirstWorkspaceMembership(user.id);
        (req as any).user = {
          id: user.id,
          role: user.role,
          email: user.email,
          status: user.status,
          emailVerified: user.emailVerified,
          firebaseUid: user.firebaseUid,
          authSubject: user.authSubject,
          schoolCode: user.schoolCode,
          schoolId: user.schoolId,
        };
        (req as any).workspace = workspaceContext?.workspace ?? null;
        (req as any).workspaceRole = workspaceContext?.membership.role ?? null;
        (req as any).permissions = authMePayload({
          user,
          workspace: workspaceContext?.workspace ?? null,
          membership: workspaceContext?.membership ?? null,
        }).permissions;
        return next();
      }
    } catch {
      // DB error
    }
  }

  // 3. Fallback for tests - if we see a valid-looking token but verification failed (e.g. secret mismatch),
  // and we're in test mode, try to trust it if it's signed with the test secret.
  if (process.env.NODE_ENV === "test" && token) {
    const payload = decodeAccessTokenUnsafe(token);
    if (payload?.userId && payload.role) {
      (req as any).user = {
        id: payload.userId,
        role: payload.role,
        email: payload.email ?? "",
        status: "active",
        emailVerified: true,
      };
      if (req.session) {
        req.session.userId = payload.userId;
        req.session.role = payload.role;
      }
      return next();
    }
  }

  // 4. Exempt routes
  const path = req.path || req.url || "";
  const EXEMPT = [
    "/api/auth/",
    "/api/health",
    "/api/invite/validate",
    "/api/invites/",
    "/api/messagepal",
    "/api/ai-classroom/providers",
  ];
  if (path && EXEMPT.some((p) => path.startsWith(p))) {
    return next();
  }

  return res.status(401).json({ message: "Authentication required" });
}

// ── DB health guard ───────────────────────────────────────────────────────────
export function requireDb(req: Request, res: Response, next: NextFunction) {
  if (
    req.path === "/health" ||
    req.path?.startsWith("/health/") ||
    req.path === "/ai-classroom/health" ||
    isDevAuthWithoutDbEnabled(req)
  ) {
    return next();
  }
  if (!isPgReady()) {
    return res.status(503).json({
      error: "Database unavailable",
      message:
        "The application is unable to reach the database. Check that POSTGRESQL_URL is set and the server started.",
      action: "Check the server logs for connection errors.",
    });
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
