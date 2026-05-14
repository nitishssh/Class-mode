import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  auth,
  firebaseEnabled,
  loginWithEmail,
  registerWithEmail,
  loginWithGoogle,
  logoutUser,
  resetPassword,
  getUserProfile,
  completeGoogleSignUp,
  UserProfile,
  UserRole,
} from "@/lib/firebase";
import { onAuthStateChanged, onIdTokenChanged, User } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, setServerToken, clearServerToken } from "@/lib/queryClient";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuthUser {
  user: User | null;
  profile: UserProfile | null;
  isNewUser?: boolean;
}

interface AuthContextType {
  currentUser: AuthUser;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    name: string,
    role: UserRole,
    additionalData?: Record<string, unknown>
  ) => Promise<void>;
  googleLogin: () => Promise<AuthUser>;
  completeGoogleRegistration: (
    user: User,
    role: UserRole,
    additionalData?: Record<string, unknown>
  ) => Promise<void>;
  logout: () => Promise<void>;
  resetUserPassword: (email: string) => Promise<void>;
  /** Re-sync auth state from the server (e.g. after a backend-only JWT login). */
  refreshSession: () => Promise<void>;
}

const FirebaseAuthContext = createContext<AuthContextType | undefined>(undefined);

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getProfileWithTimeout(uid: string): Promise<UserProfile | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
  return Promise.race([getUserProfile(uid), timeout]);
}

/**
 * Build a minimal profile from a Firebase Auth user when Firestore is unavailable.
 * FIX BUG-09: Reads role from Firebase custom claims (set by backend after sync-profile)
 * instead of always defaulting to "student".
 */
async function buildFallbackProfile(user: User): Promise<UserProfile | null> {
  if (!user.email) return null;
  let role: UserRole = "student";
  try {
    const tokenResult = await user.getIdTokenResult(false);
    if (tokenResult?.claims?.role) {
      role = tokenResult.claims.role as UserRole;
    }
  } catch {
    // Default to student if token claims can't be read
  }
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || user.email.split("@")[0],
    role,
    status: "active",
    photoURL: user.photoURL || undefined,
    createdAt: null,
    lastLogin: null,
  };
}

/**
 * Exchange a Firebase ID token for a server-issued JWT.
 * The server JWT is stored in module memory and attached to all subsequent
 * API requests via the Authorization header — no more per-request getIdToken() calls.
 *
 * FIX BUG-02: token is sent only in body — not duplicated in Authorization header.
 *
 * Returns true on success, false if the backend is unreachable (non-fatal —
 * the httpOnly cookie from a previous session may still authenticate requests).
 */
async function exchangeForServerJwt(user: User, role?: string): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const idToken = await user.getIdToken(attempt > 0); // force-refresh on retry
      const res = await fetch("/api/auth/firebase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ idToken, role }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          setServerToken(data.token);
        }
        return true;
      }

      // 401 = Firebase Admin rejected the token — don't retry
      if (res.status === 401) break;

      // Other errors — back off and retry
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    } catch {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }

  console.error("[auth] Could not exchange Firebase token for server JWT");
  return false;
}

/**
 * Called whenever Firebase silently refreshes its ID token (every ~55 min).
 * Gets a new server JWT so the server-side JWT doesn't drift out of sync.
 */
async function refreshServerJwt(user: User): Promise<void> {
  try {
    const idToken = await user.getIdToken();
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ idToken }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.token) setServerToken(data.token);
    }
  } catch {
    // Non-fatal — httpOnly cookie is still valid for ~7 days
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export const FirebaseAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser>({ user: null, profile: null });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { toast } = useToast();

  // Prevents onAuthStateChanged from running its Firestore fetch when login()
  // has already set the profile (avoids a redundant double-fetch).
  const skipNextAuthStateProfile = useRef(false);

  // FIX BUG-10: checkBackendAuth at provider scope so both onAuthStateChanged and refreshSession can call it.
  const checkBackendAuth = async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const backendUser = await res.json();
        const backendProfile: UserProfile = {
          uid: `backend_${backendUser.id}`,
          email: backendUser.email,
          displayName: backendUser.displayName || backendUser.name,
          role: backendUser.role,
          status: backendUser.status || "active",
          photoURL: backendUser.avatar || undefined,
          createdAt: null,
          lastLogin: null,
        };
        setCurrentUser({ user: null, profile: backendProfile });
        setIsLoading(false);
        return true;
      }
    } catch {
      // Network error — don't crash, fall through
    }
    return false;
  };

  // ── Single source of truth: onAuthStateChanged ────────────────────────────
  useEffect(() => {
    if (!firebaseEnabled || !auth) {
      // Dev/demo mode — provide a mock student profile so the app renders
      setTimeout(async () => {
        const hasBackendAuth = await checkBackendAuth();
        if (hasBackendAuth) return;

        setCurrentUser({
          user: null,
          profile: {
            uid: "dev_student",
            email: "student@example.com",
            displayName: "Dev Student",
            role: "student",
            status: "active",
            createdAt: null,
            lastLogin: null,
          },
        });
        setIsLoading(false);
      }, 0);
      return;
    }

    // onAuthStateChanged: fires on login/logout
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        if (skipNextAuthStateProfile.current) {
          skipNextAuthStateProfile.current = false;
          setIsLoading(false);
          return;
        }
        try {
          const profile = await getProfileWithTimeout(user.uid);
          // FIX BUG-09: await the now-async fallback builder
          const resolvedProfile = profile ?? (await buildFallbackProfile(user));
          
          // FIX BUG-14: warn user when Firestore is unreachable and we're using fallback
          if (!profile && resolvedProfile) {
            toast({
              title: "Running in offline mode",
              description: "Your profile could not be verified. Some features may be limited.",
              variant: "destructive",
            });
          }
          
          setCurrentUser({ user, profile: resolvedProfile });
        } catch {
          const fallback = await buildFallbackProfile(user).catch(() => null);
          setCurrentUser({ user, profile: fallback });
        }
        // Ensure server JWT is populated for users arriving via persisted Firebase session
        exchangeForServerJwt(user).catch(() => {});
      } else {
        clearServerToken();
        // FIX BUG-01: check if we have a backend session even if Firebase is logged out
        try {
          const hasBackendAuth = await checkBackendAuth();
          if (hasBackendAuth) return;
        } catch {
          // ignore
        }
        setCurrentUser({ user: null, profile: null });
      }
      setIsLoading(false);
    });

    // onIdTokenChanged: fires whenever Firebase silently refreshes the ID token.
    const unsubscribeToken = onIdTokenChanged(auth, async (user) => {
      if (user) {
        await refreshServerJwt(user);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeToken();
    };
  }, []);

  // ── login ─────────────────────────────────────────────────────────────────
  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const user = await loginWithEmail(email, password);
      const profile = await getProfileWithTimeout(user.uid);
      const resolvedProfile = profile ?? (await buildFallbackProfile(user));

      skipNextAuthStateProfile.current = true;
      setCurrentUser({ user, profile: resolvedProfile });

      const ok = await exchangeForServerJwt(user);
      if (!ok) {
        console.warn("[auth] Login succeeded but server JWT exchange failed");
      }

      toast({
        title: "Login successful",
        description: `Welcome back, ${resolvedProfile?.displayName || user.displayName || email}!`,
      });
    } catch (error: unknown) {
      setIsLoading(false);
      const err = error as Error & { code?: string };
      const code = err.code || "";
      if (code !== "auth/operation-not-allowed" && err.message !== "Firebase is not configured") {
        toast({
          title: "Login failed",
          description: err.message || "Please check your credentials and try again",
          variant: "destructive",
        });
      }
      throw error;
    }
  };

  // ── register ──────────────────────────────────────────────────────────────
  const register = async (
    email: string,
    password: string,
    name: string,
    role: UserRole,
    additionalData?: Record<string, unknown>
  ) => {
    setIsLoading(true);
    try {
      const user = await registerWithEmail(email, password, name, role, additionalData);

      // Exchange Firebase token for server JWT first, then sync profile
      // FIX BUG-08: establish backend session BEFORE calling sync-profile
      await exchangeForServerJwt(user, role);

      try {
        await apiRequest("POST", "/api/auth/sync-profile", {
          displayName: name,
          ...additionalData,
        });
      } catch (err) {
        console.warn("[auth] Failed to sync new profile to backend", (err as Error).message);
      }

      const profile = await getProfileWithTimeout(user.uid);
      skipNextAuthStateProfile.current = true;
      setCurrentUser({ user, profile });

      toast({ title: "Registration successful", description: `Welcome, ${name}!` });
    } catch (error: unknown) {
      setIsLoading(false);
      const err = error as Error & { code?: string };
      const code = err.code || "";
      if (code !== "auth/operation-not-allowed" && err.message !== "Firebase is not configured") {
        toast({
          title: "Registration failed",
          description: err.message || "Please check your information and try again",
          variant: "destructive",
        });
      }
      throw error;
    }
  };

  // ── googleLogin ───────────────────────────────────────────────────────────
  const googleLogin = async (): Promise<AuthUser> => {
    setIsLoading(true);
    try {
      const result = await loginWithGoogle();

      if (result.isNewUser) {
        setIsLoading(false);
        return { user: result.user, profile: null, isNewUser: true };
      }

      skipNextAuthStateProfile.current = true;
      setCurrentUser({ user: result.user, profile: result.profile });

      const ok = await exchangeForServerJwt(result.user);
      if (!ok) {
        console.warn("[auth] Google login succeeded but server JWT exchange failed");
      }

      toast({
        title: "Login successful",
        description: `Welcome back, ${result.profile?.displayName}!`,
      });

      return { user: result.user, profile: result.profile, isNewUser: false };
    } catch (error: unknown) {
      setIsLoading(false);
      toast({
        title: "Google login failed",
        description: (error as Error).message || "An error occurred during Google login",
        variant: "destructive",
      });
      throw error;
    }
  };

  // ── completeGoogleRegistration ────────────────────────────────────────────
  const completeGoogleRegistration = async (
    user: User,
    role: UserRole,
    additionalData?: Record<string, unknown>
  ) => {
    setIsLoading(true);
    try {
      const userData = await completeGoogleSignUp(user, role, additionalData);

      // FIX BUG-08: establish backend session BEFORE calling sync-profile
      await exchangeForServerJwt(user, role);

      try {
        await apiRequest("POST", "/api/auth/sync-profile", {
          displayName: userData.displayName,
          ...additionalData,
        });
      } catch (err) {
        console.warn("[auth] Failed to sync google profile to backend", (err as Error).message);
      }

      skipNextAuthStateProfile.current = true;
      setCurrentUser({ user, profile: userData });

      toast({
        title: "Registration successful",
        description: `Welcome, ${userData.displayName}!`,
      });
    } catch (error: unknown) {
      setIsLoading(false);
      toast({
        title: "Registration failed",
        description: (error as Error).message || "An error occurred completing your registration",
        variant: "destructive",
      });
      throw error;
    }
  };

  // ── logout ────────────────────────────────────────────────────────────────
  const logout = async () => {
    try {
      clearServerToken();

      // FIX BUG-10: Call server logout to clear the httpOnly cookie
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});

      if (firebaseEnabled && auth) {
        await logoutUser();
      }

      setCurrentUser({ user: null, profile: null });
      toast({ title: "Logged out", description: "You have been successfully logged out." });
    } catch (error: unknown) {
      toast({
        title: "Logout failed",
        description: (error as Error).message || "An error occurred during logout",
        variant: "destructive",
      });
      throw error;
    }
  };

  // ── refreshSession ────────────────────────────────────────────────────────
  // Called after a backend-only login (httpOnly cookie already set by server)
  // to sync React auth state without a full page reload.
  const refreshSession = async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) return;
      const backendUser = await res.json();
      const profile: UserProfile = {
        uid: `backend_${backendUser.id}`,
        email: backendUser.email,
        displayName: backendUser.displayName || backendUser.name,
        role: backendUser.role,
        status: backendUser.status || "active",
        photoURL: backendUser.avatar || undefined,
        createdAt: null,
        lastLogin: null,
      };
      setCurrentUser({ user: null, profile });
      if (backendUser.token) setServerToken(backendUser.token);
    } catch {
      // Non-fatal — user stays in current state
    }
  };

  // ── resetUserPassword ─────────────────────────────────────────────────────
  const resetUserPassword = async (email: string) => {
    try {
      await resetPassword(email);
      toast({
        title: "Password reset email sent",
        description: "Check your email for password reset instructions",
      });
    } catch (error: unknown) {
      toast({
        title: "Password reset failed",
        description: (error as Error).message || "An error occurred sending the reset email",
        variant: "destructive",
      });
      throw error;
    }
  };

  const value: AuthContextType = {
    currentUser,
    isLoading,
    login,
    register,
    googleLogin,
    completeGoogleRegistration,
    logout,
    resetUserPassword,
    refreshSession,
  };

  return <FirebaseAuthContext.Provider value={value}>{children}</FirebaseAuthContext.Provider>;
};

export const useFirebaseAuth = () => {
  const context = useContext(FirebaseAuthContext);
  if (context === undefined) {
    throw new Error("useFirebaseAuth must be used within a FirebaseAuthProvider");
  }
  return context;
};
