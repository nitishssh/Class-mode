/**
 * Multi-tenant (school) data-isolation guard.
 *
 * Invariant: only the platform super-role `role === "admin"` may see
 * cross-school data. Every other role (`school_admin`, `principal`, `teacher`,
 * `student`, …) must be scoped to its own `school_code`.
 *
 * The recurring trap this prevents: a freshly self-signed-up account has
 * `schoolCode === null` (set later during onboarding). Scoping helpers such as
 * `pgFindUsers` only apply a `school_code` filter when it is truthy, so passing
 * a null schoolCode silently returns EVERY school's rows. Tenant scoping must
 * therefore fail CLOSED — deny the request — rather than fall through to an
 * unscoped query.
 */

export interface TenantScope {
  /** Platform super-admin: allowed to see data across all schools. */
  isPlatformAdmin: boolean;
  /** The school_code to scope queries to, or undefined for a platform admin. */
  schoolCode?: string;
}

/** Minimal shape we need off a user record (camelCase or snake_case). */
interface ScopableUser {
  role?: string | null;
  schoolCode?: string | null;
  school_code?: string | null;
}

/**
 * Resolve the tenant scope for a request, failing closed.
 *
 * Returns `{ scope }` on success, or `{ error: { status, message } }` when the
 * account is not allowed to run a cross-tenant query (no associated school).
 *
 * Usage:
 *   const t = resolveTenantScope(requester);
 *   if ("error" in t) return res.status(t.error.status).json({ message: t.error.message });
 *   const rows = await pgFindUsers(
 *     t.scope.isPlatformAdmin ? { role: "student" } : { role: "student", schoolCode: t.scope.schoolCode },
 *   );
 */
export function resolveTenantScope(
  user: ScopableUser | null | undefined
): { scope: TenantScope } | { error: { status: number; message: string } } {
  if (!user) {
    return { error: { status: 400, message: "User not found" } };
  }
  if (user.role === "admin") {
    return { scope: { isPlatformAdmin: true } };
  }
  const schoolCode = user.schoolCode ?? user.school_code ?? null;
  if (!schoolCode) {
    return {
      error: {
        status: 403,
        message: "Forbidden: your account is not associated with a school yet",
      },
    };
  }
  return { scope: { isPlatformAdmin: false, schoolCode } };
}
