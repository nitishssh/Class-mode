/**
 * use-chat-auth.ts
 *
 * After Firebase login, calls POST /api/auth/firebase to synchronise the
 * Firebase user with the MongoDB backend and establish a server-side session.
 * This allows subsequent API calls (conversations, messages) and WebSocket
 * connections to be authenticated.
 */

import { useEffect, useRef, useCallback } from "react";
import { useFirebaseAuth } from "@/contexts/firebase-auth-context";

interface ChatAuthResult {
  userId: number;
  displayName: string;
  role: string;
  avatar?: string;
}

/**
 * Syncs the currently logged-in Firebase user with the Express backend.
 * Should be mounted once, high in the tree (e.g. inside App or ChatLayout).
 */
export function useChatAuth() {
  const { currentUser } = useFirebaseAuth();
  const syncedUid = useRef<string | null>(null);

  const syncWithBackend = useCallback(async (): Promise<ChatAuthResult | null> => {
    const fbUser = currentUser.user;
    if (!fbUser) return null;

    // Avoid re-syncing for the same Firebase UID
    if (syncedUid.current === fbUser.uid) return null;

    try {
      const idToken = await fbUser.getIdToken();

      const res = await fetch("/api/auth/firebase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // include cookies so session is stored
        body: JSON.stringify({ idToken }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("[useChatAuth] Backend sync failed:", err.message || res.status);
        return null;
      }

      const data: ChatAuthResult = await res.json();
      syncedUid.current = fbUser.uid;
      console.log("[useChatAuth] Synced with backend. userId=", data.userId, "role=", data.role);
      return data;
    } catch (err) {
      console.error("[useChatAuth] Network error:", err);
      return null;
    }
  }, [currentUser.user]);

  useEffect(() => {
    if (currentUser.user && syncedUid.current !== currentUser.user.uid) {
      syncWithBackend();
    }
  }, [currentUser.user, syncWithBackend]);

  return { syncWithBackend };
}
