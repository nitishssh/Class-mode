import React, { createContext, useContext, useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { clearServerToken, setServerToken } from "@/lib/queryClient";

// Authentication is now fully server-backed (local password + server-side
// Google OAuth). The Firebase client SDK has been removed; this type used to
// live in @/lib/firebase.
export type UserRole = "student" | "teacher" | "school_admin" | "admin" | "principal" | "parent";

export interface UserProfile {
  uid: string;
  id?: number;
  email: string;
  displayName: string;
  role: UserRole;
  status: "active" | "pending" | "suspended" | "rejected";
  emailVerified?: boolean;
  photoURL?: string;
  school_code?: string | null;
  grade?: string | null;
  board?: string | null;
  subjects?: string[];
  class?: string | null;
  classId?: string | null;
  workspaceRole?: "owner" | "admin" | "member" | null;
  activeWorkspace?: {
    id: number;
    name: string;
    slug: string | null;
    type: string;
  } | null;
  permissions?: string[];
  createdAt?: unknown;
  lastLogin?: unknown;
}

interface AuthUser {
  user: AuthRuntimeUser | null;
  profile: UserProfile | null;
  isNewUser?: boolean;
}

interface AuthRuntimeUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

interface AuthContextType {
  currentUser: AuthUser;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<UserProfile>;
  register: (
    email: string,
    password: string,
    name: string,
    role: UserRole,
    additionalData?: Record<string, unknown>
  ) => Promise<void>;
  googleLogin: () => Promise<AuthUser>;
  // High-level Google auth that always returns a usable profile: signs the
  // user in if they exist, creates a workspace for them if they're new.
  // workspaceNameHint is used only when the server has to create a workspace.
  googleAuth: (workspaceNameHint?: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  resetUserPassword: (email: string) => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function profileFromMe(data: any): UserProfile {
  const user = data.user ?? data;
  return {
    uid: `local_${user.id}`,
    id: user.id,
    email: user.email,
    displayName: user.displayName || user.name || user.email,
    role: (user.legacyRole || user.role || "student") as UserRole,
    status: user.status || "active",
    emailVerified: user.emailVerified ?? false,
    photoURL: user.avatar || undefined,
    school_code: user.school_code ?? null,
    grade: user.grade ?? null,
    board: user.board ?? null,
    subjects: user.subjects ?? [],
    class: user.class ?? null,
    classId: user.class ?? null,
    workspaceRole: data.workspaceRole ?? null,
    activeWorkspace: data.activeWorkspace ?? null,
    permissions: data.permissions ?? [],
    createdAt: null,
    lastLogin: null,
  };
}

function runtimeUserFromProfile(profile: UserProfile): AuthRuntimeUser {
  return {
    uid: profile.uid,
    email: profile.email,
    displayName: profile.displayName,
    photoURL: profile.photoURL,
  };
}

async function parseError(res: Response, fallback: string) {
  const body = await res.json().catch(() => ({}));
  return new Error(body.message || body.error || fallback);
}

async function localPasswordLogin(email: string, password: string): Promise<UserProfile> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw await parseError(res, "Login failed");
  const data = await res.json();
  if (data.token) setServerToken(data.token);
  return profileFromMe(data);
}

async function localPasswordSignup(args: {
  email: string;
  password: string;
  name: string;
  workspaceName: string;
}): Promise<UserProfile> {
  const res = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(args),
  });
  if (!res.ok) throw await parseError(res, "Signup failed");
  const data = await res.json();
  if (data.token) setServerToken(data.token);
  return profileFromMe(data);
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser>({ user: null, profile: null });
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const refreshSession = async () => {
    let res = await fetch("/api/auth/me", { credentials: "include" });
    if (!res.ok) {
      // Try to refresh access token using the refresh_token cookie
      const refreshRes = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      }).catch(() => null);
      if (refreshRes && refreshRes.ok) {
        const refreshData = await refreshRes.json().catch(() => ({}));
        if (refreshData.token) {
          setServerToken(refreshData.token);
          // Retry fetching user profile with new token
          res = await fetch("/api/auth/me", { credentials: "include" });
        }
      }
    }
    if (!res.ok) {
      clearServerToken();
      setCurrentUser({ user: null, profile: null });
      return;
    }
    const data = await res.json();
    const profile = profileFromMe(data);
    setCurrentUser({ user: runtimeUserFromProfile(profile), profile });
  };

  useEffect(() => {
    refreshSession().finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string): Promise<UserProfile> => {
    setIsLoading(true);
    try {
      // Single server-backed path. Local password is the identity provider;
      // Google sign-in is a separate server-side redirect (googleAuth).
      const profile = await localPasswordLogin(email, password);
      setCurrentUser({ user: runtimeUserFromProfile(profile), profile });
      toast({
        title: "Login successful",
        description: `Welcome back, ${profile.displayName || email}!`,
      });
      return profile;
    } finally {
      setIsLoading(false);
    }
  };

  const register: AuthContextType["register"] = async (
    email,
    password,
    name,
    role,
    additionalData
  ) => {
    if (role === "student") {
      throw new Error("Student accounts are invite-only. Use an invite link from your workspace.");
    }
    setIsLoading(true);
    try {
      const workspaceName =
        typeof additionalData?.workspaceName === "string" && additionalData.workspaceName
          ? additionalData.workspaceName
          : `${name}'s Workspace`;
      const profile = await localPasswordSignup({ email, password, name, workspaceName });
      setCurrentUser({ user: runtimeUserFromProfile(profile), profile });
      toast({ title: "Workspace created", description: `Welcome, ${name}!` });
    } finally {
      setIsLoading(false);
    }
  };

  // Google sign-in is now server-driven: the "Continue with Google" button
  // navigates to /api/auth/google/start, which handles the entire OAuth code
  // flow server-side and sets the session cookie before redirecting to
  // /dashboard. These stubs remain on the context for type compatibility
  // but should not be called by new UI code.
  const googleLogin = async (): Promise<AuthUser> => {
    window.location.href = "/api/auth/google/start";
    return new Promise<AuthUser>(() => {}); // never resolves; page navigates
  };

  const googleAuth = async (workspaceNameHint?: string): Promise<UserProfile> => {
    const url = workspaceNameHint
      ? `/api/auth/google/start?workspaceName=${encodeURIComponent(workspaceNameHint)}`
      : "/api/auth/google/start";
    window.location.href = url;
    return new Promise<UserProfile>(() => {}); // never resolves; page navigates
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
    clearServerToken();
    setCurrentUser({ user: null, profile: null });
    toast({ title: "Logged out", description: "You have been successfully logged out." });
  };

  const resetUserPassword = async (email: string) => {
    // Server-driven reset: sends an OTP/link via the mailer. Always returns a
    // generic success to avoid leaking which emails are registered.
    await fetch("/api/auth/password/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email }),
    }).catch(() => {});
    toast({
      title: "Password reset email sent",
      description: "If that account exists, check your email for reset instructions.",
    });
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isLoading,
        login,
        register,
        googleLogin,
        googleAuth,
        logout,
        resetUserPassword,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within a AuthProvider");
  }
  return context;
};
