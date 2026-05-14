import { QueryClient, QueryFunction } from "@tanstack/react-query";

// ── Server JWT store ───────────────────────────────────────────────────────────
// Holds the server-issued JWT returned by /api/auth/firebase, /api/auth/login,
// or /api/auth/register. Lives in module memory — never in localStorage.
// The httpOnly access_token cookie is the primary credential; this variable
// lets the Authorization header work even when cookies are blocked (e.g. CORS).
let _serverToken: string | null = null;

export function setServerToken(token: string): void {
  _serverToken = token;
}

export function clearServerToken(): void {
  _serverToken = null;
}

export function getServerToken(): string | null {
  return _serverToken;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

function authHeaders(): Record<string, string> {
  return _serverToken ? { Authorization: `Bearer ${_serverToken}` } : {};
}

// ── apiRequest ────────────────────────────────────────────────────────────────
// All mutating API calls go through here. Uses the server JWT — never calls
// Firebase getIdToken(), which avoids the race condition with token refresh.
export async function apiRequest(method: string, url: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = { ...authHeaders() };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method,
    credentials: "include",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  await throwIfResNotOk(res);
  return res;
}

// ── getQueryFn ────────────────────────────────────────────────────────────────
type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
      headers: authHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

// ── QueryClient ───────────────────────────────────────────────────────────────
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
