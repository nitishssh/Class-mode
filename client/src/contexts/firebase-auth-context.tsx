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
import { onAuthStateChanged, User } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// ── Types ──────────────────────────────────────────────────────────────────────

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
  /** Re-hydrates auth state after a JWT cookie login without a full page reload. */
  refreshSession: () => Promise<void>;
}

const FirebaseAuthContext = createContext<AuthContextType | undefined>(undefined);

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Fetch profile but resolve null after 5 s so we never hang. */
async function getProfileWithTimeout(uid: string): Promise<UserProfile | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
  return Promise.race([getUserProfile(uid), timeout]);
}

/**
 * Build a minimal profile from a Firebase Auth user when Firestore is unavailable.
 * FIX BUG-09: Reads role from Firebase custom claims (set by backend after sync-profile)
 * instead of always defaulting to "student".
 */
async function buildFallbackProfile(user: import("firebase/auth").User): Promise<UserProfile | null> {
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
 * After a successful Firebase login, post the ID token to the backend so the
 * Express session is established for subsequent API calls.
 * FIX BUG-02: token is sent only in body — not duplicated in Authorization header.
 */
async function syncFirebaseSession(user: import("firebase/auth").User): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/auth/firebase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ idToken }),
      });
      if (res.ok) return true;
      console.warn(`[auth] Session sync returned ${res.status}, attempt ${attempt + 1}/2`);
    } catch (e) {
      console.warn(`[auth] Session sync failed (attempt ${attempt + 1}/2):`, e);
    }
  }
  console.error(
    "[auth] Could not sync Firebase session to backend after 2 attempts. API calls may fail."
  );
  return false;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export const FirebaseAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser>({ user: null, profile: null });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { toast } = useToast();

  // Ref to prevent onAuthStateChanged from overwriting a profile that login() just set.
  // When login()/register() sets a profile we raise this flag; onAuthStateChanged skips its
  // own Firestore call for that one event and clears the flag.
  const skipNextAuthStateProfile = useRef(false);

  // FIX BUG-10: checkBackendAuth at provider scope (not inside useEffect) so
  // both onAuthStateChanged and refreshSession can call it.
  // Relies on the httpOnly "access_token" cookie — no localStorage.
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
      // For development/demo purposes without Firebase keys, provide a mock student profile
      // Use setTimeout to move the state update out of the synchronous render path
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

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        if (skipNextAuthStateProfile.current) {
          skipNextAuthStateProfile.current = false;
          setIsLoading(false);
          return;
        }
        try {
          const profile = await getProfileWithTimeout(user.uid);
          syncFirebaseSession(user).catch((err) =>
            console.warn("Failed to sync session on auth state change", err)
          );
          // FIX BUG-09: await async buildFallbackProfile
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
          // FIX BUG-09: await the now-async fallback builder
          const fallback = await buildFallbackProfile(user).catch(() => null);
          setCurrentUser({ user, profile: fallback });
        }
      } else {
        // FIX BUG-01: wrap checkBackendAuth in try/catch so setIsLoading always resolves
        try {
          const hasBackendAuth = await checkBackendAuth();
          if (hasBackendAuth) return;
        } catch {
          // ignore — fall through to clear user
        }
        setCurrentUser({ user: null, profile: null });
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
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
      const synced = await syncFirebaseSession(user);
      if (!synced) console.warn("[auth] Login succeeded but backend session sync failed");
      toast({
        title: "Login successful",
        description: `Welcome back, ${resolvedProfile?.displayName || user.displayName || email}!`,
      });
    } catch (error: unknown) {
      const err = error as Error & { code?: string };
      setIsLoading(false);
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

      // FIX BUG-08 (register path): establish backend session BEFORE calling sync-profile
      const synced = await syncFirebaseSession(user);
      if (!synced) console.warn("[auth] Register: backend session sync failed");

      // Now sync profile to MongoDB (session is established so authenticateToken passes)
      try {
        await apiRequest("POST", "/api/auth/sync-profile", {
          displayName: name,
          ...additionalData,
        });
      } catch (err: unknown) {
        console.warn("Failed to sync new profile to backend", (err as Error).message);
      }

      const profile = await getProfileWithTimeout(user.uid);
      skipNextAuthStateProfile.current = true;
      setCurrentUser({ user, profile });

      toast({ title: "Registration successful", description: `Welcome, ${name}!` });
    } catch (error: unknown) {
      const err = error as Error & { code?: string };
      setIsLoading(false);
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

  // ── Google login ──────────────────────────────────────────────────────────
  const googleLogin = async (): Promise<AuthUser> => {
    setIsLoading(true);
    try {
      const result = await loginWithGoogle();

      if (result.isNewUser) {
        // New user — don't update currentUser yet, wait for role selection
        setIsLoading(false);
        return { user: result.user, profile: null, isNewUser: true };
      }

      skipNextAuthStateProfile.current = true;
      setCurrentUser({ user: result.user, profile: result.profile });

      // Bridge Firebase session to backend for protected API calls
      const synced = await syncFirebaseSession(result.user);
      if (!synced) {
        console.warn("[auth] Google login succeeded but backend session sync failed");
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

  // ── completeGoogleRegistration ─────────────────────────────────────────────
  const completeGoogleRegistration = async (
    user: User,
    role: UserRole,
    additionalData?: Record<string, unknown>
  ) => {
    setIsLoading(true);
    try {
      const userData = await completeGoogleSignUp(user, role, additionalData);

      // FIX BUG-08: establish backend session BEFORE calling sync-profile
      // (authenticateToken middleware requires the session to exist)
      const synced = await syncFirebaseSession(user);
      if (!synced) console.warn("[auth] Google registration: backend session sync failed");

      // Now safe to call sync-profile (session is live)
      try {
        await apiRequest("POST", "/api/auth/sync-profile", {
          displayName: userData.displayName,
          ...additionalData,
        });
      } catch (err: unknown) {
        console.warn("Failed to sync google profile to backend", (err as Error).message);
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
      // FIX BUG-10: Call server logout to clear the httpOnly cookie (can't be done client-side)
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
      // Clean up any legacy localStorage items (migration safety net)
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      if (firebaseEnabled && auth) await logoutUser();
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
  // Allows the auth dialog to update context after a JWT cookie login (BUG-18 fix support)
  const refreshSession = async () => {
    setIsLoading(true);
    if (firebaseEnabled && auth?.currentUser) {
      const fbUser = auth.currentUser;
      const profile = await getProfileWithTimeout(fbUser.uid);
      setCurrentUser({ user: fbUser, profile: profile ?? (await buildFallbackProfile(fbUser)) });
      setIsLoading(false);
      return;
    }
    const ok = await checkBackendAuth();
    if (!ok) {
      setCurrentUser({ user: null, profile: null });
      setIsLoading(false);
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
