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
