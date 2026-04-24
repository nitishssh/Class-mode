import { createContext, useContext, ReactNode, useMemo } from "react";
import { UserRole, User } from "@/types/chat";
import { useFirebaseAuth } from "./firebase-auth-context";

interface RoleContextValue {
  currentRole: UserRole;
  currentUser: User;
  setRole: (role: UserRole) => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

/**
 * Maps the Firebase auth user's role to a chat UserRole.
 * Falls back to 'student' for unknown or unset roles.
 */
function mapRole(role?: string): UserRole {
  if (role === "teacher" || role === "principal" || role === "admin") return "teacher";
  if (role === "parent") return "parent";
  return "student";
}

export const ChatRoleProvider = ({ children }: { children: ReactNode }) => {
  const { currentUser } = useFirebaseAuth();

  const currentRole = useMemo(() => {
    return mapRole(currentUser.profile?.role);
  }, [currentUser.profile?.role]);

  const chatUser: User = useMemo(
    () => ({
      id: currentUser.user?.uid || "student-me",
      name:
        currentUser.profile?.displayName ||
        currentUser.user?.displayName ||
        currentUser.user?.email?.split("@")[0] ||
        "Me",
      role: currentRole,
      isOnline: true,
    }),
    [currentUser, currentRole]
  );

  return (
    <RoleContext.Provider
      value={{
        currentRole,
        currentUser: chatUser,
        setRole: () => {}, // Role is derived from Firebase auth; ignore manual changes
      }}
    >
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = () => {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within ChatRoleProvider");
  return ctx;
};
