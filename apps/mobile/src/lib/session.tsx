import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import {
  authMeResponseSchema,
  mobileLoginResponseSchema,
  toSessionUser,
  type SessionUser,
} from '@/shared/mobile-api';
import { ApiError, OfflineError, apiGet, apiPost, apiRequest, onSessionExpired } from '@/lib/api';
import { clearTokens, getTokens, setTokens } from '@/lib/token-store';

// Cached identity for offline cold starts: role/name/schoolCode only —
// enough to render the shell with an "offline" banner. Tokens NEVER go in
// AsyncStorage (they live in SecureStore, see token-store.ts).
const CACHED_USER_KEY = 'classmode.sessionUser.v1';

export type SessionState =
  | { status: 'loading'; user: null }
  | { status: 'signedOut'; user: null }
  | { status: 'signedIn'; user: SessionUser; offline: boolean };

type SessionContextValue = {
  state: SessionState;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-fetch /me (e.g. after connectivity returns). */
  revalidate: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<SessionState>({ status: 'loading', user: null });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const safeSetState = useCallback((next: SessionState) => {
    if (mounted.current) setState(next);
  }, []);

  const hydrateFromServer = useCallback(async (): Promise<void> => {
    const me = await apiGet('/api/auth/me', authMeResponseSchema);
    const user = toSessionUser(me);
    await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(user)).catch(() => undefined);
    safeSetState({ status: 'signedIn', user, offline: false });
  }, [safeSetState]);

  // Cold-start bootstrap: stored tokens → /me; offline with tokens → cached
  // identity + offline flag (screens must not fetch unscoped data — the
  // schoolCode in the cache is the same fail-closed value the server issued).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const tokens = await getTokens();
      if (!tokens) {
        safeSetState({ status: 'signedOut', user: null });
        return;
      }
      try {
        await hydrateFromServer();
      } catch (err) {
        if (cancelled) return;
        if (err instanceof OfflineError) {
          const cached = await AsyncStorage.getItem(CACHED_USER_KEY).catch(() => null);
          if (cached) {
            try {
              const user = JSON.parse(cached) as SessionUser;
              safeSetState({ status: 'signedIn', user, offline: true });
              return;
            } catch {
              // fall through to signedOut
            }
          }
        }
        if (err instanceof ApiError && err.status === 401) {
          await clearTokens();
        }
        // 5xx/429 with no cache, or unusable cache: land on login rather than
        // an unscoped shell. Tokens are kept unless the 401 above cleared them.
        safeSetState({ status: 'signedOut', user: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrateFromServer, safeSetState]);

  // A definitive refresh failure anywhere in the API layer signs us out.
  useEffect(
    () =>
      onSessionExpired(() => {
        AsyncStorage.removeItem(CACHED_USER_KEY).catch(() => undefined);
        safeSetState({ status: 'signedOut', user: null });
      }),
    [safeSetState]
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const res = await apiPost('/api/auth/login', { email, password }, mobileLoginResponseSchema);
      await setTokens({ accessToken: res.token, refreshToken: res.refreshToken });
      const user = toSessionUser(res);
      await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(user)).catch(() => undefined);
      safeSetState({ status: 'signedIn', user, offline: false });
    },
    [safeSetState]
  );

  const signOut = useCallback(async () => {
    const tokens = await getTokens();
    // Best-effort server-side session invalidation; local sign-out never
    // blocks on the network.
    if (tokens) {
      apiRequest('/api/auth/logout', {
        method: 'POST',
        body: { refreshToken: tokens.refreshToken },
      }).catch(() => undefined);
    }
    await clearTokens();
    await AsyncStorage.removeItem(CACHED_USER_KEY).catch(() => undefined);
    safeSetState({ status: 'signedOut', user: null });
  }, [safeSetState]);

  const revalidate = useCallback(async () => {
    try {
      await hydrateFromServer();
    } catch {
      // keep current state; next revalidation can retry
    }
  }, [hydrateFromServer]);

  const value = useMemo(
    () => ({ state, signIn, signOut, revalidate }),
    [state, signIn, signOut, revalidate]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}

/**
 * The signed-in user, for screens inside the (app) group. Throws if used
 * while signed out — the (app) layout guarantees a session before rendering.
 */
export function useSessionUser(): { user: SessionUser; offline: boolean } {
  const { state } = useSession();
  if (state.status !== 'signedIn') {
    throw new Error('useSessionUser rendered outside a signed-in session');
  }
  return { user: state.user, offline: state.offline };
}
