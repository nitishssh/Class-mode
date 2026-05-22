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

> Roles and permissions are now managed locally in PostgreSQL and enforced via JWT session claims.

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

## 2️⃣ Login Flow

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

## 3️⃣ Forgot Password Flow

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
  - Updates password_hash in PostgreSQL
  - Invalidates all existing sessions for user
      │
      ▼
[Redirect to Login]
```

---

## 4️⃣ Workspace Invite Flow

```
[Admin sends Invite]
  - POST /api/workspaces/:id/invites
  - Generates secure token
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
[POST /api/invite/accept]
  - Creates/Updates user record
  - Creates WorkspaceMembership
  - Sets emailVerified: true
  - Logs user in (Issues tokens)
      │
      ▼
[Redirect to Workspace]
```

---

## 5️⃣ Session & Token Management

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

## 6️⃣ Security Summary

| Feature              | Implementation                                    |
| -------------------- | ------------------------------------------------- |
| Password Hashing     | Bcrypt (12 rounds)                                |
| Session Storage      | PostgreSQL `sessions` table (Server-side)         |
| Authentication       | Dual-token JWT + HttpOnly Cookies                 |
| RBAC                 | PostgreSQL `workspace_memberships` + Middleware   |
| Invite Security      | HMAC-SHA256 hashed tokens with 7-day expiry       |
| Email Verification   | Required for critical actions (Coming soon)       |
| Cross-Site Scripting | Mitigation via HttpOnly Cookies (No JS access)    |
| CSRF                 | Mitigation via SameSite=Lax + Custom Auth headers |

---

## 🔄 API Methods Reference

| Action               | Endpoint                         | Method |
| -------------------- | -------------------------------- | ------ |
| Signup               | `/api/auth/signup`               | POST   |
| Login                | `/api/auth/login`                | POST   |
| Logout               | `/api/auth/logout`               | POST   |
| Refresh Token        | `/api/auth/refresh`              | POST   |
| Current User         | `/api/auth/me`                   | GET    |
| Forgot Password      | `/api/auth/password/forgot`      | POST   |
| Reset Password       | `/api/auth/password/reset`       | POST   |
| Verify Email Request | `/api/auth/email/verify/request` | POST   |
| Verify Email Confirm | `/api/auth/email/verify`         | POST   |
| Invite Member        | `/api/workspaces/:id/invites`    | POST   |
| Validate Invite      | `/api/invite/validate/:token`    | GET    |
| Accept Invite        | `/api/invite/accept`             | POST   |

---

_This system replaces the legacy Firebase implementation with a more flexible, multi-tenant workspace architecture._
