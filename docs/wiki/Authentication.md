# Authentication & Onboarding

## Features

- **Role-Based Access Control (RBAC)**: Workspace roles (`owner`, `admin`, `member`) + system roles (`student`, `teacher`, `parent`, `principal`, `school_admin`, `admin`).
- **Email/Password Auth**: Self-hosted bcrypt + JWT. Signup creates a workspace automatically.
- **Google OAuth 2.0 (Server-Side)**: `GET /api/auth/google/start` → Google consent → `GET /api/auth/google/callback`. No popups, no JS tokens. Works in all browsers including mobile in-app browsers.
- **Invitation System**: Workspace admins invite members via tokenized email links. SHA-256 hashed tokens, 7-day expiry.
- **Email Verification & Password Reset**: OTP-based flows via Nodemailer SMTP.
- **OTP Brute-Force Protection**: `attempts` counter in `otps` table; locks out after threshold.
- **Session Management**: Dual-token system — JWT access token (15m, HttpOnly cookie) + opaque refresh token (30d, HttpOnly cookie + PostgreSQL `sessions` table).

## Implementation Files

| File | Responsibility |
|---|---|
| `server/routes/auth.ts` | All auth endpoints |
| `server/routes/onboarding.ts` | Teacher/student invite flows |
| `server/routes/workspace.ts` | Workspace CRUD + membership |
| `server/lib/auth-workspace.ts` | JWT helpers, permission checks |
| `server/lib/google-signin.ts` | Server-side Google OAuth 2.0 |
| `server/lib/mailer.ts` | SMTP email sending |

## Test Coverage

Auth flows are tested in `server/tests/auth.test.ts`, `auth_routes.test.ts`, and `auth_security.test.ts`. Tests cover signup, login, invite acceptance, password hashing, and role logic.

## Notes

- Google OAuth and Google Classroom share the same OAuth Web client. Both redirect URIs must be registered in GCP Console.
- `ENABLE_FIREBASE_AUTH_COMPAT=true` keeps the legacy Firebase token exchange endpoint active for backward compatibility.
