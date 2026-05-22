export const USER_ROLES = [
  "student",
  "teacher",
  "parent",
  "principal",
  "school_admin",
  "admin",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["active", "pending", "suspended", "rejected"] as const;

export type UserStatus = (typeof USER_STATUSES)[number];

export const SELF_REGISTERABLE_ROLES = ["student", "teacher", "parent"] as const;

export type SelfRegisterableRole = (typeof SELF_REGISTERABLE_ROLES)[number];

export const SCHOOL_STAFF_ROLES = ["teacher", "principal", "school_admin"] as const;

export const TENANT_ADMIN_ROLES = ["school_admin", "principal", "admin"] as const;

const USER_ROLE_SET = new Set<string>(USER_ROLES);
const SELF_REGISTERABLE_ROLE_SET = new Set<string>(SELF_REGISTERABLE_ROLES);

export function isUserRole(role: unknown): role is UserRole {
  return typeof role === "string" && USER_ROLE_SET.has(role);
}

export function isSelfRegisterableRole(role: unknown): role is SelfRegisterableRole {
  return typeof role === "string" && SELF_REGISTERABLE_ROLE_SET.has(role);
}

export function normalizeSelfRegisterableRole(role: unknown): SelfRegisterableRole {
  return isSelfRegisterableRole(role) ? role : "student";
}

export function isTenantAdminRole(role: unknown): role is (typeof TENANT_ADMIN_ROLES)[number] {
  return typeof role === "string" && TENANT_ADMIN_ROLES.includes(role as any);
}
