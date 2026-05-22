# Authentication Endpoints

<cite>
**Referenced Files in This Document**
- [auth.ts](file://server/routes/auth.ts)
- [routes.ts](file://server/routes.ts)
- [auth-workspace.ts](file://server/lib/auth-workspace.ts)
- [schema.ts](file://shared/schema.ts)
- [pg-queries.ts](file://server/lib/pg-queries.ts)
</cite>

## Table of Contents

1. [Introduction](#introduction)
2. [Core Endpoints](#core-endpoints)
3. [Password Management](#password-management)
4. [Email Verification](#email-verification)
5. [Workspace Invitations](#workspace-invitations)
6. [Security & Session Management](#security-session-management)
7. [Conclusion](#conclusion)

## Introduction

This document provides comprehensive API documentation for the workspace-based local authentication system. All authentication is handled via `HttpOnly` cookies and JWT tokens.

## Core Endpoints

### 1. Workspace Signup

- **Path**: `POST /api/auth/signup`
- **Purpose**: Creates a new user and an associated workspace.
- **Request Body**:
  - `name`: string (Full name)
  - `email`: string (Unique email)
  - `password`: string (min 6 chars)
  - `workspaceName`: string (The name of the initial workspace)
- **Response**: `201 Created` with User + Active Workspace payload.

### 2. Login

- **Path**: `POST /api/auth/login`
- **Purpose**: Authenticates a user and issues session cookies.
- **Request Body**:
  - `email`: string
  - `password`: string
- **Response**: `200 OK` with User + Active Workspace payload.

### 3. Refresh Session

- **Path**: `POST /api/auth/refresh`
- **Purpose**: Regenerates a short-lived access token using a long-lived refresh token.
- **Security**: Requires a valid `refresh_token` cookie. Issues a rotated refresh token to prevent replay attacks.

### 4. Logout

- **Path**: `POST /api/auth/logout`
- **Purpose**: Invalidates the current session and clears cookies.

### 5. Current User (Me)

- **Path**: `GET /api/auth/me`
- **Purpose**: Returns the currently authenticated user's profile and workspace context.

---

## Password Management

### 1. Forgot Password

- **Path**: `POST /api/auth/password/forgot`
- **Body**: `{ "email": "user@example.com" }`
- **Action**: Sends a password reset link to the user's email.

### 2. Reset Password

- **Path**: `POST /api/auth/password/reset`
- **Body**: `{ "token": "...", "password": "..." }`
- **Action**: Updates the password and invalidates all active sessions.

---

## Email Verification

### 1. Request Verification

- **Path**: `POST /api/auth/email/verify/request`
- **Action**: Sends a verification link to the logged-in user's email.

### 2. Confirm Verification

- **Path**: `POST /api/auth/email/verify`
- **Body**: `{ "token": "..." }`
- **Action**: Marks the user's email as verified in the database.

---

## Workspace Invitations

### 1. Send Invite

- **Path**: `POST /api/workspaces/:id/invites`
- **Body**: `{ "email": "...", "role": "admin|member", "kind": "business_member|student" }`
- **Auth**: Requires "owner" or "admin" role in the target workspace.

### 2. Validate Invite

- **Path**: `GET /api/invite/validate/:token`
- **Action**: Checks if an invite token is valid and returns workspace metadata.

### 3. Accept Invite

- **Path**: `POST /api/invite/accept`
- **Body**: `{ "token": "...", "password": "...", "name": "..." }`
- **Action**: Creates a user (if needed) and joins them to the workspace.

---

## Security & Session Management

### Session Cookies

All session data is delivered via secure, HttpOnly cookies:

- `access_token`: JWT containing `userId` and `sessionId`. Expires in 15m.
- `refresh_token`: Opaque string mapped to a database session. Expires in 30d.

### Password Hashing

Passwords are never stored in plain text. The system uses **BcryptJS** with 12 salt rounds.

### Rate Limiting

Authentication endpoints are protected by rate limiters to prevent brute-force attacks.

---

## Conclusion

The API has transitioned from a Firebase-managed model to a self-hosted, secure, and multi-tenant transactional system. Developers should ensure that all requests include the `credentials: 'include'` flag (for Fetch/XHR) to correctly transmit session cookies.
