import crypto from "crypto";
import jwt from "jsonwebtoken";
import type { PgUser, PgWorkspace, PgWorkspaceMembership } from "../db/pg-queries";

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// ── JWT: single source of truth ────────────────────────────────────────────
// Both the auth routes and the auth middleware previously read process.env
// independently — the middleware even carried a hardcoded fallback secret,
// so the two could silently diverge. Resolve and validate the secret once,
// here, and have everything import from this module.
function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length > 0) return secret;
  // Tests inject a secret via vitest config; never allow a real server to
  // run on a guessable default.
  throw new Error("JWT_SECRET environment variable is required.");
}

export const JWT_SECRET: string = resolveJwtSecret();

export type AccessTokenPayload = {
  userId: number;
  sessionId?: number;
  role?: string;
  email?: string;
  emailVerified?: boolean;
  workspaceId?: number | null;
  workspaceRole?: string | null;
};

export function issueAccessToken(
  payload: AccessTokenPayload,
  expiresIn: jwt.SignOptions["expiresIn"] = "15m"
): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

/**
 * Verify and decode an access token. Returns the payload on success, or null
 * on any failure (expired, bad signature, malformed) — callers decide how to
 * respond. Centralizing this means token rules live in exactly one place.
 */
export function verifyAccessToken(token: string | undefined | null): AccessTokenPayload | null {
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as AccessTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Decode a token WITHOUT verifying its signature. Only used by the test
 * harness fallback in the auth middleware (guarded by NODE_ENV === "test").
 * Never trust the result of this in production code paths.
 */
export function decodeAccessTokenUnsafe(token: string): AccessTokenPayload | null {
  try {
    return jwt.decode(token) as AccessTokenPayload | null;
  } catch {
    return null;
  }
}

/**
 * Pull a bearer token out of a cookie or Authorization header.
 */
export function extractAccessToken(req: {
  cookies?: Record<string, string | undefined>;
  headers?: Record<string, unknown>;
  get?: (name: string) => string | undefined;
}): string | undefined {
  const cookieToken = req.cookies?.[ACCESS_COOKIE];
  if (cookieToken) return cookieToken;

  const authHeader =
    (req.headers?.authorization as string | undefined) ||
    (req.headers?.Authorization as string | undefined) ||
    (typeof req.get === "function" ? req.get("Authorization") : undefined);

  if (typeof authHeader === "string" && authHeader.length > 0) {
    const parts = authHeader.split(" ");
    return parts.length === 2 ? parts[1] : parts[0];
  }
  return undefined;
}

export type WorkspaceRole =
  "owner" | "admin" | "co-teacher" | "teaching-assistant" | "member" | "auditor";

export type WorkspacePermission =
  | "workspace:read"
  | "workspace:update"
  | "workspace:billing"
  | "workspace:invite"
  | "workspace:members:manage"
  | "workspace:members:remove"
  | "workspace:delete"
  | "curriculum:create"
  | "curriculum:grade"
  | "class:start"
  | "analytics:view";

const ROLE_PERMISSIONS: Record<WorkspaceRole, WorkspacePermission[]> = {
  owner: [
    "workspace:read",
    "workspace:update",
    "workspace:billing",
    "workspace:invite",
    "workspace:members:manage",
    "workspace:members:remove",
    "workspace:delete",
    "curriculum:create",
    "curriculum:grade",
    "class:start",
    "analytics:view",
  ],
  admin: [
    "workspace:read",
    "workspace:update",
    "workspace:invite",
    "workspace:members:manage",
    "workspace:members:remove",
    "curriculum:create",
    "curriculum:grade",
    "class:start",
    "analytics:view",
  ],
  "co-teacher": [
    "workspace:read",
    "workspace:invite",
    "curriculum:create",
    "curriculum:grade",
    "class:start",
  ],
  "teaching-assistant": ["workspace:read", "curriculum:grade", "analytics:view"],
  member: ["workspace:read"],
  auditor: ["workspace:read", "analytics:view"],
};

export const ACCESS_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: ACCESS_TOKEN_TTL_MS,
};

export const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: REFRESH_TOKEN_TTL_MS,
};

// Express clearCookie already expires cookies immediately. Passing maxAge is
// deprecated and will be ignored in Express 5, so keep a dedicated option set
// with the same security/path attributes but no lifetime.
export const AUTH_COOKIE_CLEAR_OPTS = {
  httpOnly: ACCESS_COOKIE_OPTS.httpOnly,
  secure: ACCESS_COOKIE_OPTS.secure,
  sameSite: ACCESS_COOKIE_OPTS.sameSite,
};

export function randomToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function tokenHash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function slugifyWorkspaceName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || `workspace-${Date.now()}`;
}

export function permissionsForWorkspaceRole(role?: WorkspaceRole | null): string[] {
  if (!role) return [];
  return ROLE_PERMISSIONS[role] ?? [];
}

export function hasWorkspacePermission(
  role: WorkspaceRole | null | undefined,
  permission: WorkspacePermission
): boolean {
  if (!role) return false;
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission);
}

export function authMePayload(args: {
  user: PgUser;
  workspace?: PgWorkspace | null;
  membership?: PgWorkspaceMembership | null;
}) {
  const workspaceRole = args.membership?.role ?? null;
  return {
    user: {
      id: args.user.id,
      email: args.user.email,
      displayName: args.user.displayName || args.user.name,
      status: args.user.status,
      emailVerified: args.user.emailVerified,
      legacyRole: args.user.role,
      role: args.user.role,
      name: args.user.name,
      avatar: args.user.avatar,
      school_code: args.user.schoolCode,
      grade: args.user.grade,
      board: args.user.board,
      subjects: args.user.subjects,
      class: args.user.class,
      onboardingComplete: args.user.onboardingComplete,
    },
    activeWorkspace: args.workspace
      ? {
          id: args.workspace.id,
          name: args.workspace.name,
          slug: args.workspace.slug,
          type: args.workspace.type,
        }
      : null,
    workspaceRole,
    permissions: permissionsForWorkspaceRole(workspaceRole),
    onboardingComplete: args.user.onboardingComplete,
  };
}
