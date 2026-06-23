// Roles that are allowed to pick a different role during their FIRST onboarding.
// This mirrors the server's CHANGEABLE_DEFAULT_ROLES in routes/onboarding.ts —
// keep the two lists in sync. Self-signup workspace creators land as
// school_admin (or admin) and may choose principal/teacher/school_admin;
// invited users (teacher, principal, student, parent) have a fixed role the
// server enforces with a 403, so the onboarding UI must not offer them a choice.
export const CHANGEABLE_DEFAULT_ROLES = ["school_admin", "admin"] as const;

export function canChooseOnboardingRole(currentRole: string | undefined | null): boolean {
  if (!currentRole) return false;
  return (CHANGEABLE_DEFAULT_ROLES as readonly string[]).includes(currentRole.toLowerCase());
}

// Maps a user's role to their post-login / post-onboarding dashboard path.
// Shared by the router (App.tsx) and the onboarding flow so both stay in sync.
export function getDashboardPath(role: string): string {
  const r = (role || "").toLowerCase();
  switch (r) {
    case "principal":
      return "/principal-dashboard";
    case "school_admin":
      return "/school-admin-dashboard";
    case "admin":
      return "/admin-dashboard";
    case "teacher":
      return "/teacher-dashboard";
    case "student":
      return "/student-dashboard";
    case "parent":
      return "/parent-dashboard";
    default:
      return "/teacher-dashboard";
  }
}
