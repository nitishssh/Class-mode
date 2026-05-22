import crypto from "crypto";
import type { PgUser, PgWorkspace, PgWorkspaceMembership } from "./pg-queries";

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type WorkspaceRole = "owner" | "admin" | "member";

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
  if (role === "owner") {
    return [
      "workspace:read",
      "workspace:update",
      "workspace:billing",
      "workspace:invite",
      "workspace:members:manage",
    ];
  }
  if (role === "admin") {
    return ["workspace:read", "workspace:update", "workspace:invite", "workspace:members:manage"];
  }
  if (role === "member") return ["workspace:read"];
  return [];
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
  };
}
