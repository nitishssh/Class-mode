# 🔐 Workspace-based Local Authentication System Design

## AI-Powered Personalized Learning App — Local & Workspace Implementation

---

## 👥 User Roles

| Role             | Access Level                                       | Permission Key            |
| ---------------- | -------------------------------------------------- | ------------------------- |
| Workspace Owner  | Full workspace control, billing, member management | `workspaceRole: "owner"`  |
| Workspace Admin  | Member management, content moderation, analytics   | `workspaceRole: "admin"`  |
| Workspace Member | Access to workspace channels, tests, AI tutor      | `workspaceRole: "member"` |
| System Admin     | Global platform management, infrastructure         | `role: "admin"`           |

> Roles and permissions are managed in PostgreSQL and enforced via JWT session claims.

---

## 🗺️ Master Login Flow

```
[App Launch]
      │
      ▼
[Check /api/auth/me]
      │
      ├──── Not Authenticated ────────────► [Landing Page / Login]
      │
      └──── Authenticated ────────────────► [Dashboard / Workspace Select]
```

---

## 1️⃣ Workspace Signup Flow (New Institution/Business)

```
[Signup Screen]
      │
      ▼
[Enter Basic Info]
  - Full Name
  - Email
  - Password
  - Workspace Name (e.g., "Delhi Public School")
      │
      ▼
[POST /api/auth/signup]
  - Creates User record (role: "admin", status: "active")
  - Creates Workspace record (slugified name, ownerId: user.id)
  - Creates WorkspaceMembership (role: "owner")
  - Issues Access Token (Cookie) + Refresh Token (Cookie/DB)
      │
      ▼
[Email Verification Sent]
  - sendEmailVerification(user)
      │
      ▼
[Redirect to Workspace Dashboard]
```

---

## 2️⃣ Login Flow (Email + Password)

```
[Login Screen]
  - Email + Password
      │
      ▼
[POST /api/auth/login]
      │
      ├── 401: Invalid Credentials ───► [Show Error]
      ├── 403: Account Suspended ─────► [Show Suspension Notice]
      │
      └── SUCCESS?
              │
              ▼
      [Backend Issues Tokens]
      - Access Token (JWT, 15m TTL, HttpOnly Cookie)
      - Refresh Token (Random String, 30d TTL, HttpOnly Cookie + DB Session)
              │
              ▼
      [Frontend Redirects to /]
      - /api/auth/me returns User + Active Workspace context
```

---

## 3️⃣ Google OAuth Flow (Server-Side)

The Google sign-in flow is handled entirely server-side to avoid browser popup/redirect issues (COOP headers, popup blockers, MetaMask, Safari ITP, mobile in-app browsers).

```
[Login Screen]
  - Click "Continue with Google"
      │
      ▼
[GET /api/auth/google/start]
  - Generates state parameter (CSRF protection)
  - Stores state in session
  - Redirects to accounts.google.com with:
      - client_id, redirect_uri, scope (openid email profile)
      - response_type=code, state
      │
      ▼
[User consents at Google]
      │
      ▼
[accounts.google.com → GET /api/auth/google/callback?code=…&state=…]
      │
      ▼
[Server validates state, exchanges code for tokens]
  - POST to https://oauth2.googleapis.com/token
  - Fetches user info (email, name, picture)
      │
      ▼
[Upsert user in PostgreSQL]
  - auth_provider: "google", auth_subject: google_sub
  - Creates workspace if first login
  - Issues Access Token + Refresh Token (same as email/password flow)
      │
      ▼
[302 Redirect to /dashboard]
```

**Implementation**: `server/lib/google-signin.ts`
**Routes**: `GET /api/auth/google/start`, `GET /api/auth/google/callback`

> The same OAuth Web client is reused for Google Classroom. Both redirect URIs must be registered in GCP Console:
>
> - `http://localhost:5001/api/auth/google/callback`
> - `https://<prod-host>/api/auth/google/callback`

---

## 4️⃣ Forgot Password Flow

```
[Forgot Password Screen]
  - Enter registered Email
      │
      ▼
[POST /api/auth/password/forgot]
  - Generates OTP (type: "password_reset")
  - Sends email with link: /reset-password?token=XYZ
      │
      ▼
[User clicks link → /reset-password]
      │
      ▼
[User enters New Password]
      │
      ▼
[POST /api/auth/password/reset]
  - Verifies token hash in DB
  - Checks attempts count (brute-force protection)
  - Updates password_hash in PostgreSQL
  - Invalidates all existing sessions for user
      │
      ▼
[Redirect to Login]
```

---

## 5️⃣ Workspace Invite Flow

```
[Admin sends Invite]
  - POST /api/workspaces/:id/invites
  - Generates secure token (SHA-256 hashed)
  - Sends email: "Join [Workspace] on Class Mode"
      │
      ▼
[User clicks link → /accept-invite?token=XYZ]
      │
      ▼
[GET /api/invite/validate/:token]
  - Returns workspace name, invited email, role
      │
      ▼
[User completes Profile]
  - Sets Name & Password
      │
      ▼
[POST /api/auth/workspace-invite/signup]
  - Creates a user record (an email that already has an
    account is refused with 409 accountExists)
  - Creates WorkspaceMembership
  - Sets emailVerified: true
  - Logs user in (Issues tokens)
      │
      ▼
[Redirect to Workspace]
```

---

## 6️⃣ Session & Token Management

```
The system uses a hybrid Cookie + JWT approach for maximum security.

[Access Token]
- Scope: userId, sessionId
- TTL: 15 minutes
- Storage: HttpOnly, Secure, SameSite=Lax Cookie
- Purpose: Stateless authentication for every request

[Refresh Token]
- Scope: Opaque random string
- TTL: 30 days
- Storage: HttpOnly Cookie + PostgreSQL `sessions` table
- Purpose: Regenerate access tokens without re-login

[Refresh Flow]
- POST /api/auth/refresh (Middleware auto-calls when 401 is received or token near expiry)
- Rotates Refresh Token: Old token deleted, new one issued (prevents replay attacks)
```

---

## 7️⃣ Security Summary

| Feature              | Implementation                                    |
| -------------------- | ------------------------------------------------- |
| Password Hashing     | Bcrypt (12 rounds)                                |
| Session Storage      | PostgreSQL `sessions` table (Server-side)         |
| Authentication       | Dual-token JWT + HttpOnly Cookies                 |
| Google OAuth         | Server-side code flow (no popup, no JS tokens)    |
| RBAC                 | PostgreSQL `workspace_memberships` + Middleware   |
| Invite Security      | HMAC-SHA256 hashed tokens with 7-day expiry       |
| OTP Brute-Force      | `attempts` counter in `otps` table                |
| Email Verification   | Required for critical actions                     |
| Cross-Site Scripting | Mitigation via HttpOnly Cookies (No JS access)    |
| CSRF                 | Mitigation via SameSite=Lax + state param (OAuth) |

---

## 🔄 API Methods Reference

| Action                | Endpoint                         | Method |
| --------------------- | -------------------------------- | ------ |
| Signup                | `/api/auth/signup`               | POST   |
| Login                 | `/api/auth/login`                | POST   |
| Logout                | `/api/auth/logout`               | POST   |
| Refresh Token         | `/api/auth/refresh`              | POST   |
| Current User          | `/api/auth/me`                   | GET    |
| Forgot Password       | `/api/auth/password/forgot`      | POST   |
| Reset Password        | `/api/auth/password/reset`       | POST   |
| Verify Email Request  | `/api/auth/email/verify/request` | POST   |
| Verify Email Confirm  | `/api/auth/email/verify`         | POST   |
| Google OAuth Start    | `/api/auth/google/start`         | GET    |
| Google OAuth Callback | `/api/auth/google/callback`      | GET    |
| Invite Member         | `/api/workspaces/:id/invites`    | POST   |
| Validate Invite       | `/api/invite/validate/:token`    | GET    |
| Accept Invite         | `/api/auth/workspace-invite/signup` | POST   |

---

_This system replaces the legacy Firebase implementation with a more flexible, multi-tenant workspace architecture. Google OAuth is handled server-side for maximum browser compatibility._
