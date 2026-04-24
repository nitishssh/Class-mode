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
  completeGoogleRegistration: (user: User, role: UserRole, additionalData?: Record<string, unknown>) => Promise<void>;
  logout: () => Promise<void>;
  resetUserPassword: (email: string) => Promise<void>;
}

const FirebaseAuthContext = createContext<AuthContextType | undefined>(undefined);

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Fetch profile but resolve null after 5 s so we never hang. */
async function getProfileWithTimeout(uid: string): Promise<UserProfile | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
  return Promise.race([getUserProfile(uid), timeout]);
}

/**
 * Build a minimal profile directly from a Firebase Auth user when Firestore is unavailable.
 * This prevents infinite loading if Firestore is blocked/offline, at least showing a default student role.
 */
function buildFallbackProfile(user: import("firebase/auth").User): UserProfile | null {
  if (!user.email) return null;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || user.email.split("@")[0],
    role: "student", // Safe default; user can be re-authenticated properly later
    status: "active",
    photoURL: user.photoURL || undefined,
    createdAt: null,
    lastLogin: null,
  };
}

/**
 * After a successful Firebase login, post the ID token to the backend so the
 * Express session is established for subsequent API calls.
 */
async function syncFirebaseSession(user: import("firebase/auth").User) {
  try {
    const idToken = await user.getIdToken();
    await fetch("/api/auth/firebase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ idToken }),
    });
  } catch (e) {
    console.warn("[auth] Failed to sync Firebase session to backend:", e);
  }
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

  // ── Single source of truth: onAuthStateChanged ────────────────────────────
  useEffect(() => {
    if (!firebaseEnabled || !auth) {
      // For development/demo purposes without Firebase keys, provide a mock student profile
      // Use setTimeout to move the state update out of the synchronous render path
      setTimeout(() => {
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
          // login()/register() already fetched and set the profile — skip double fetch.
          skipNextAuthStateProfile.current = false;
          setIsLoading(false);
          return;
        }
        try {
          const profile = await getProfileWithTimeout(user.uid);
          // If Firestore is offline/blocked, build a minimal fallback profile
          // so the user doesn't get stuck on the login screen indefinitely
          setCurrentUser({ user, profile: profile ?? buildFallbackProfile(user) });
        } catch {
          setCurrentUser({ user, profile: buildFallbackProfile(user) });
        }
      } else {
        // No Firebase user — check if there's a backend JWT in localStorage
        const storedToken = localStorage.getItem("auth_token");
        const storedUser = localStorage.getItem("auth_user");
        if (storedToken && storedUser) {
          try {
            // Verify token is still valid by fetching /api/auth/me
            const res = await fetch("/api/auth/me", {
              headers: { Authorization: `Bearer ${storedToken}` },
              credentials: "include",
            });
            if (res.ok) {
              const backendUser = await res.json();
              // Create a minimal profile from backend user data
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
              // Use a synthetic "user" shell so the rest of the app works
              setCurrentUser({ user: null, profile: backendProfile });
              setIsLoading(false);
              return;
            } else {
              // Token expired or invalid — clear it
              localStorage.removeItem("auth_token");
              localStorage.removeItem("auth_user");
            }
          } catch {
            localStorage.removeItem("auth_token");
            localStorage.removeItem("auth_user");
          }
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
      // Fetch profile ourselves so the dashboard renders immediately and
      // onAuthStateChanged doesn't do a double Firestore read.
      const profile = await getProfileWithTimeout(user.uid);
      const resolvedProfile = profile ?? buildFallbackProfile(user);
      skipNextAuthStateProfile.current = true;
      setCurrentUser({ user, profile: resolvedProfile });

      // Bridge Firebase session to backend for protected API calls
      syncFirebaseSession(user).catch(() => {});

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
    // NOTE: do NOT call setIsLoading(false) here — onAuthStateChanged will do it
    // (or the skip branch above already did).
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

      // Sync profile to backend so MongoDB user is bridged immediately
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

      toast({
        title: "Registration successful",
        description: `Welcome, ${name}!`,
      });
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
      syncFirebaseSession(result.user).catch(() => {});

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
  const completeGoogleRegistration = async (user: User, role: UserRole, additionalData?: Record<string, unknown>) => {
    setIsLoading(true);
    try {
      const userData = await completeGoogleSignUp(user, role, additionalData);

      // Sync profile to backend after completing google sign up
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

      // Bridge Firebase session to backend for protected API calls
      syncFirebaseSession(user).catch(() => {});

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
      // Clear backend JWT auth (for backend-only users)
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      document.cookie = "access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

      // Clear Firebase auth
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
