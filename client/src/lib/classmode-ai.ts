/**
 * client/src/lib/classmode-ai.ts
 *
 * Typed client for the ClassMode AI generation API (`/api/classmode-ai/*`).
 *
 * That Express route is a THIN PROXY: it scopes the request to the caller's
 * workspace and forwards to ClassMode Studio, which does the actual lesson
 * generation. So a failure here can originate in either service, and the two
 * need telling apart — hence the structured error type below.
 *
 * Why this module does not use `apiRequest` from ./queryClient:
 * `apiRequest` collapses every failure into `ApiError("<status>: <raw body>")`.
 * This API answers with a structured envelope — `{ message, code, requestId,
 * retryable }` — and that detail is worth keeping: `code` distinguishes "you
 * have no workspace" from "Studio is down", and `retryable` says whether a
 * retry could possibly help. Flattening it to a string and re-parsing would be
 * worse than reading it properly once, here.
 */

import { classModeAIJobSchema, type ClassModeAIJob } from "@shared/classmode-ai";
import { getServerToken } from "./queryClient";

export type { ClassModeAIJob };

/** Job states that will never change again — stop polling on these. */
const TERMINAL_STATUSES = new Set(["succeeded", "failed", "cancelled"]);

export function isTerminal(job: ClassModeAIJob): boolean {
  return job.done === true || TERMINAL_STATUSES.has(job.status);
}

/**
 * Error codes the proxy can return. `WORKSPACE_REQUIRED` is the tenant-isolation
 * failure: the server refuses to forward a request it cannot scope to a school,
 * and the UI must render a blocked state rather than any lesson content.
 */
export type ClassModeAIErrorCode =
  | "UNAUTHENTICATED"
  | "WORKSPACE_REQUIRED"
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "UPSTREAM_ERROR"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "NO_WORKSPACE";

export class ClassModeAIError extends Error {
  readonly status: number;
  readonly code: ClassModeAIErrorCode | undefined;
  readonly requestId: string | undefined;
  readonly retryable: boolean;

  constructor(args: {
    status: number;
    message: string;
    code?: ClassModeAIErrorCode;
    requestId?: string;
    retryable?: boolean;
  }) {
    super(args.message);
    this.name = "ClassModeAIError";
    this.status = args.status;
    this.code = args.code;
    this.requestId = args.requestId;
    // Absent `retryable` is treated as retryable only for 5xx — a 4xx repeated
    // unchanged will fail again.
    this.retryable = args.retryable ?? args.status >= 500;
  }

  /** True when no workspace is in scope, so nothing may be fetched or shown. */
  get isWorkspaceBlocked(): boolean {
    return (
      this.status === 409 || this.code === "WORKSPACE_REQUIRED" || this.code === "NO_WORKSPACE"
    );
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getServerToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(path, {
    method,
    credentials: "include",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Read the body once, then decide — calling res.json() on an HTML error page
  // (a proxy 502, say) throws a SyntaxError that would mask the real status.
  const raw = await res.text();
  let parsed: Record<string, unknown> | null;
  try {
    parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    throw new ClassModeAIError({
      status: res.status,
      message:
        (parsed?.message as string) ||
        (res.status === 404
          ? "ClassMode AI is not available on this server."
          : `Request failed (${res.status})`),
      code: parsed?.code as ClassModeAIErrorCode | undefined,
      requestId: parsed?.requestId as string | undefined,
      retryable: parsed?.retryable as boolean | undefined,
    });
  }

  return (parsed ?? {}) as T;
}

/**
 * Parse a `{ job }` response against the SHARED schema.
 *
 * The proxy unwraps Studio's envelope and re-sends just the job, so the shared
 * job schema — not the envelope schema — is what applies here. Validating
 * rather than casting means a contract drift between the two repos surfaces as
 * a clear error at the boundary instead of an undefined field deep in a render.
 */
function parseJob(payload: unknown): ClassModeAIJob {
  const result = classModeAIJobSchema.safeParse((payload as { job?: unknown })?.job);
  if (!result.success) {
    throw new ClassModeAIError({
      status: 502,
      message: "ClassMode AI returned a job in an unexpected shape.",
      code: "UPSTREAM_ERROR",
      retryable: false,
    });
  }
  return result.data;
}

export interface ClassModeAIHealth {
  service: string;
  available: boolean;
}

/**
 * Availability probe. Returns `available: false` rather than throwing when the
 * route is missing (404) or Studio is unreachable — an unconfigured
 * integration is an honest "unavailable", not an error the user caused.
 */
export async function fetchClassModeAIHealth(): Promise<ClassModeAIHealth> {
  try {
    const data = await request<Partial<ClassModeAIHealth>>("GET", "/api/classmode-ai/health");
    return { service: data.service ?? "classmode-ai", available: data.available === true };
  } catch (error) {
    if (error instanceof ClassModeAIError && !error.isWorkspaceBlocked) {
      return { service: "classmode-ai", available: false };
    }
    throw error;
  }
}

export async function createGenerationJob(input: {
  requirement: string;
  sourceText?: string;
}): Promise<ClassModeAIJob> {
  return parseJob(await request("POST", "/api/classmode-ai/generation-jobs", input));
}

export async function fetchGenerationJob(jobId: string): Promise<ClassModeAIJob> {
  return parseJob(
    await request("GET", `/api/classmode-ai/generation-jobs/${encodeURIComponent(jobId)}`)
  );
}

export async function cancelGenerationJob(jobId: string): Promise<ClassModeAIJob> {
  return parseJob(
    await request("DELETE", `/api/classmode-ai/generation-jobs/${encodeURIComponent(jobId)}`)
  );
}
