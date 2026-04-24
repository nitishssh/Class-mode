import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { auth } from "./firebase";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(method: string, url: string, body?: any): Promise<Response> {
  const headers: Record<string, string> = {};

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  if (auth?.currentUser) {
    try {
      headers["Authorization"] = `Bearer ${await auth.currentUser.getIdToken()}`;
    } catch (e) {
      console.warn("Failed to get Firebase token before API request", e);
    }
  }

  const res = await fetch(url, {
    method,
    credentials: "include",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const headers: Record<string, string> = {};

    // Attach Firebase token for authenticated queries
    if (auth?.currentUser) {
      try {
        headers["Authorization"] = `Bearer ${await auth.currentUser.getIdToken()}`;
      } catch {
        // proceed without token
      }
    }

    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
      headers,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes — was Infinity
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
