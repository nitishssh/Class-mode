import React, { createContext, useContext, useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { clearServerToken, setServerToken } from "@/lib/queryClient";
import type { UserRole } from "@/lib/firebase";
import {
  loginWithEmail,
  registerWithEmail,
  loginWithGoogle,
  logoutUser,
  resetPassword,
  type UserProfile as FirebaseUserProfile,
} from "@/lib/firebase";

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
  completeGoogleRegistration: (
    user: unknown,
    role: UserRole,
    additionalData?: Record<string, unknown>
  ) => Promise<void>;
  logout: () => Promise<void>;
  resetUserPassword: (email: string) => Promise<void>;
  refreshSession: () => Promise<void>;
}

const FirebaseAuthContext = createContext<AuthContextType | undefined>(undefined);

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

async function exchangeFirebaseToken(
  idToken: string,
  options: { role?: UserRole; workspaceName?: string } = {}
): Promise<UserProfile> {
  const res = await fetch("/api/auth/firebase", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      idToken,
      role: options.role,
      workspaceName: options.workspaceName,
    }),
  });
  if (!res.ok) throw await parseError(res, "Firebase login failed");
  const data = await res.json();
  if (data.token) setServerToken(data.token);
  return profileFromMe(data);
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

export const FirebaseAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
      let profile: UserProfile;
      try {
        const firebaseUser = await loginWithEmail(email, password);
        const idToken = await firebaseUser.getIdToken();
        profile = await exchangeFirebaseToken(idToken);
      } catch (error) {
        if (!import.meta.env.DEV) throw error;
        profile = await localPasswordLogin(email, password);
      }
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
      let profile: UserProfile;
      try {
        const firebaseUser = await registerWithEmail(email, password, name, "admin");
        const idToken = await firebaseUser.getIdToken();
        profile = await exchangeFirebaseToken(idToken, { workspaceName });
      } catch (error) {
        if (!import.meta.env.DEV) throw error;
        profile = await localPasswordSignup({ email, password, name, workspaceName });
      }
      setCurrentUser({ user: runtimeUserFromProfile(profile), profile });
      toast({ title: "Workspace created", description: `Welcome, ${name}!` });
    } finally {
      setIsLoading(false);
    }
  };

  const googleLogin = async (): Promise<AuthUser> => {
    setIsLoading(true);
    try {
      const result = await loginWithGoogle();
      const idToken = await result.user.getIdToken();
      const profile = await exchangeFirebaseToken(idToken);
      const authUser = { user: runtimeUserFromProfile(profile), profile, isNewUser: result.isNewUser };
      setCurrentUser(authUser);
      return authUser;
    } finally {
      setIsLoading(false);
    }
  };

  const completeGoogleRegistration: AuthContextType["completeGoogleRegistration"] = async (
    user,
    role,
    additionalData
  ) => {
    const firebaseUser = user as { getIdToken?: () => Promise<string> };
    if (!firebaseUser.getIdToken) throw new Error("Invalid Firebase user");
    const profileData = additionalData as Partial<FirebaseUserProfile> | undefined;
    const profile = await exchangeFirebaseToken(await firebaseUser.getIdToken(), {
      role,
      workspaceName: profileData?.institutionId,
    });
    setCurrentUser({ user: runtimeUserFromProfile(profile), profile });
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
    await logoutUser().catch(() => {});
    clearServerToken();
    setCurrentUser({ user: null, profile: null });
    toast({ title: "Logged out", description: "You have been successfully logged out." });
  };

  const resetUserPassword = async (email: string) => {
    await resetPassword(email);
    toast({
      title: "Password reset email sent",
      description: "Check your email for reset instructions.",
    });
  };

  return (
    <FirebaseAuthContext.Provider
      value={{
        currentUser,
        isLoading,
        login,
        register,
        googleLogin,
        completeGoogleRegistration,
        logout,
        resetUserPassword,
        refreshSession,
      }}
    >
      {children}
    </FirebaseAuthContext.Provider>
  );
};

export const AuthProvider = FirebaseAuthProvider;

export const useFirebaseAuth = () => {
  const context = useContext(FirebaseAuthContext);
  if (context === undefined) {
    throw new Error("useFirebaseAuth must be used within a FirebaseAuthProvider");
  }
  return context;
};

export const useAuth = useFirebaseAuth;
