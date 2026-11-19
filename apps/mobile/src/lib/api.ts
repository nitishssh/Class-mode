import { z } from "zod";

import { mobileRefreshResponseSchema } from "@/shared/mobile-api";
import { clearTokens, getTokens, setTokens } from "@/lib/token-store";

// Same API contract as the web client: the server repo's shared/ schemas are
// synced into src/shared/ (npm run sync-shared) and used to parse responses.
//
// Mobile auth contract (W-1): every request carries `X-Client: mobile` and
// `Authorization: Bearer <access>`; cookies are never used (credentials:
// "omit" — RN's native cookie jar must not resurrect sessions after logout).
// On a 401 the client runs ONE refresh for any number of concurrent callers
// (single-flight) and retries once. Only a definitive 401 from the refresh
// endpoint clears stored tokens; 429/5xx/network errors keep them and
// surface as retryable failures.
//
// EXPO_PUBLIC_API_URL overrides the target, e.g. a LAN address so a physical
// device can reach your dev server: EXPO_PUBLIC_API_URL=http://192.168.1.10:5001
const DEV_API_URL = "http://localhost:5001";
const PROD_API_URL = "https://classmode.inmodel.in";

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? (__DEV__ ? DEV_API_URL : PROD_API_URL);

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: string
  ) {
    super(`API ${status}: ${body.slice(0, 200)}`);
    this.name = "ApiError";
  }

  /** Human message from the server's `{ message }` shape, if present. */
  get serverMessage(): string | null {
    try {
      const parsed = JSON.parse(this.body) as { message?: unknown };
      return typeof parsed.message === "string" ? parsed.message : null;
    } catch {
      return null;
    }
  }
}

/** Network-level failure (offline, DNS, timeout) — always retryable. */
export class OfflineError extends Error {
  constructor(cause?: unknown) {
    super("Network request failed");
    this.name = "OfflineError";
    this.cause = cause;
  }
}

/** Server responded but with a shape the synced schemas don't recognize. */
export class ContractError extends Error {
  constructor(
    public path: string,
    public zodError: z.ZodError
  ) {
    super(`Response contract mismatch on ${path}`);
    this.name = "ContractError";
  }
}

type SessionExpiredListener = () => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

/** SessionProvider subscribes here: fired when a refresh definitively fails (401). */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

function emitSessionExpired() {
  for (const listener of sessionExpiredListeners) listener();
}

async function rawFetch(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_URL}${path}`, init);
  } catch (err) {
    throw new OfflineError(err);
  }
}

// ── Single-flight refresh ────────────────────────────────────────────────────
let refreshInFlight: Promise<string | null> | null = null;

/**
 * Rotate the refresh token and return a fresh access token.
 * - 401 from the server → the session is truly dead: clear tokens, notify, null.
 * - anything else (429/5xx/offline) → keep tokens, propagate the error so the
 *   caller's request fails retryably WITHOUT logging the user out.
 */
async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const stored = await getTokens();
      if (!stored) {
        emitSessionExpired();
        return null;
      }
      const res = await rawFetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Client": "mobile" },
        credentials: "omit",
        body: JSON.stringify({ refreshToken: stored.refreshToken }),
      });
      if (res.status === 401) {
        await clearTokens();
        emitSessionExpired();
        return null;
      }
      if (!res.ok) {
        throw new ApiError(res.status, await res.text());
      }
      const parsed = mobileRefreshResponseSchema.parse(await res.json());
      await setTokens({ accessToken: parsed.token, refreshToken: parsed.refreshToken });
      return parsed.token;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown };

async function request(path: string, options: RequestOptions = {}): Promise<unknown> {
  const { body, headers, ...rest } = options;

  const send = async (accessToken: string | null): Promise<Response> =>
    rawFetch(path, {
      ...rest,
      credentials: "omit",
      headers: {
        "Content-Type": "application/json",
        "X-Client": "mobile",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  const stored = await getTokens();
  let res = await send(stored?.accessToken ?? null);

  // One silent refresh + retry on 401. Excluded: login (401 = bad creds),
  // logout, and refresh itself. /api/auth/me DOES refresh — a cold start
  // with an expired 15-min access token must not log the user out.
  const noRefreshPaths = ["/api/auth/login", "/api/auth/logout", "/api/auth/refresh"];
  if (res.status === 401 && stored && !noRefreshPaths.some((p) => path.startsWith(p))) {
    const freshToken = await refreshAccessToken();
    if (freshToken) {
      res = await send(freshToken);
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, await res.text());
  }
  if (res.status === 204) return undefined;
  return res.json();
}

function parseWith<T>(path: string, schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    // Never render unvalidated data — surface a loud, reportable failure.
    throw new ContractError(path, result.error);
  }
  return result.data;
}

/** GET and validate the response against a shared zod schema. */
export async function apiGet<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  return parseWith(path, schema, await request(path));
}

/** POST a JSON body and validate the response against a shared zod schema. */
export async function apiPost<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
  return parseWith(path, schema, await request(path, { method: "POST", body }));
}

export { request as apiRequest, refreshAccessToken };
