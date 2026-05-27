# Authentication & Onboarding

## Features

*   **Role-Based Access Control (RBAC):** Supports multiple roles including Student, Parent, Teacher, School Admin, Business Owner, and Super Admin.
*   **Onboarding Flows:** Distinct registration and invitation flows depending on the role. For example, teachers register differently than standard users, and there's a dedicated workspace signup for business owners.
*   **Security:** Standard JWT or session-based authentication, password hashing (bcrypt), and email verification.

## Test Status

*   The authentication flow is well-tested. Files like `auth.test.ts`, `auth_routes.test.ts`, and `auth_security.test.ts` are all passing.
*   Test coverage checks successful signup, invitation acceptance, password hashing, and role logic.

## Simplification Recommendations

*   **Consolidate Auth Routes:** The `server/routes/auth.ts` and `server/routes/onboarding.ts` have overlapping logic (teacher invites and acceptance live inside `onboarding.ts` as `/invite/teacher` and `/invite/accept`). Consider a unified `POST /api/users` endpoint that accepts a `role` and handles the specific side-effects (like creating a workspace or linking a parent) via strategy patterns or simple switch statements instead of separate routing files.
*   **Role Logic:** The authorization middleware is defined in `server/middleware.ts` (imported as `requireRole`). Keep it simple (e.g., `requireRole(['admin', 'teacher'])`) rather than splitting role decisions across many files.
