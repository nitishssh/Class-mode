# Student Authentication System Design

## Goal

Give students a single, safe entry into the universal Class-mode client across
web, Android, and iOS while keeping authorization server-owned. The client may
remember a session, but it must never decide that a user is a student or infer
school scope from local state.

## Scope and assumptions

- Passkeys are the preferred login method; email + password remains a recovery
  fallback during rollout.
- The Class-mode server remains the identity and authorization authority.
- The universal Expo client uses the existing `/api/auth` endpoints.
- `users.role === "student"` is the authoritative role.
- `school_code === null` is fail-closed: the student sees a blocked state and
  no school-scoped request is made.
- Refresh tokens are stored in SecureStore on native and the platform-safe
  token adapter on web.

## Architecture

```text
Student
  |
  v
Universal client (Expo + Web)
  LoginScreen -> SessionProvider -> API client
                         |              |
                 token adapter          | Bearer access token
                         |              v
                   SecureStore     Class-mode API
                                      |
                         JWT/session verification + role/school checks
                                      |
                          PostgreSQL identity/session store
```

The client owns presentation and session orchestration only. The server owns
credential verification, token rotation, role claims, school scope, and every
student resource authorization check.

## Passkey-first, role-based entry

The entry screen presents the requested role, but the selection is only a UX
hint. The server remains authoritative:

```text
Student role selected -> passkey challenge -> server verifies credential
                                      -> role + school scope -> session
```

If an account has multiple roles, the server returns the allowed role set and
the user chooses one. A route parameter or client-side role choice can never
grant a different role.

### Passkey endpoints

- `POST /api/auth/passkey/register/options`
- `POST /api/auth/passkey/register/verify`
- `POST /api/auth/passkey/login/options`
- `POST /api/auth/passkey/login/verify`

Challenges are single-use, short-lived, origin/RP-bound, and server-validated.
Native uses the platform passkey provider; browser uses WebAuthn. Both produce
the same access/refresh session contract.

## Session state machine

```text
SIGNED_OUT
   | login success
   v
AUTHENTICATING -> AUTHENTICATED(student, schoolCode)
   |                  |
   | failure           | access 401
   v                  v
SIGNED_OUT       REFRESHING --success--> AUTHENTICATED
                      |
                      +--401--> SIGNED_OUT
                      +--5xx/429--> AUTHENTICATED (retry later)

AUTHENTICATED(student, null schoolCode) -> BLOCKED_SCOPE
```

Concurrent 401 responses share one refresh promise. Only a definitive refresh
401 clears tokens; transient refresh failures preserve the session and surface
retryable UI.

## API contracts

### Password fallback login

`POST /api/auth/login`

```json
{
  "email": "student@example.test",
  "password": "..."
}
```

### Passkey login response

`POST /api/auth/passkey/login/verify` returns the same token shape as password
login and may include `availableRoles` for multi-role accounts:

```json
{
  "token": "access-token",
  "refreshToken": "refresh-token",
  "user": { "id": "...", "role": "student", "school_code": "SCHOOL123" },
  "availableRoles": ["student"]
}
```

Headers: `X-Client: mobile` for the universal client contract.

Response contains `token`, `refreshToken`, and the wire-format user payload:

```json
{
  "token": "access-token",
  "refreshToken": "refresh-token",
  "user": {
    "id": "...",
    "role": "student",
    "school_code": "SCHOOL123",
    "name": "..."
  }
}
```

### Session bootstrap

`GET /api/auth/me`

The client calls this on cold start after loading tokens. A 401 triggers the
single-flight refresh path. The response is normalized once from `school_code`
to `schoolCode`; screens never read the wire field directly.

### Refresh

`POST /api/auth/refresh`

```json
{ "refreshToken": "..." }
```

The server rotates the refresh token and invalidates the previous token. The
client replaces both stored values atomically.

### Logout

`POST /api/auth/logout`

Logout is best-effort remotely and definitive locally: clear both tokens and
the cached identity even when the network is unavailable.

## Student authorization boundary

Every student endpoint must enforce all of the following server-side:

1. Valid access token.
2. `role === "student"` where the endpoint is student-only.
3. Resource ownership or an explicit enrollment relationship.
4. Tenant/school scope from the authenticated identity, never from a client
   query parameter.

The client hides staff tabs using `getTabsForRole`, but that is only a UX
optimization. It is not an authorization control.

## Client screen flow

- Login: role selection, passkey prompt, and named errors for cancellation,
  unsupported device, inactive account, rate limit, offline, and server failure.
- Recovery: password login or account-recovery flow when passkey is unavailable.
- Loading: show a bootstrap state while restoring or refreshing the session.
- Student home: only student tabs and school-scoped content.
- Missing school scope: explain that the account is not linked to a school and
  provide support/logout actions; do not issue school-scoped fetches.
- Expired session: return to login with a non-alarming “Session expired” copy.

## Security requirements

- Never log passwords, access tokens, refresh tokens, or raw authorization
  headers.
- Never log WebAuthn challenges, assertions, client data, or authenticator data.
- Use SecureStore/keychain on native; do not put refresh tokens in URLs.
- Cache only non-sensitive identity hints needed for offline shell rendering:
  role, display name, and school code. Treat the cache as untrusted and
  revalidate with `/api/auth/me`.
- Rate-limit login and refresh endpoints.
- Use generic login failure copy to avoid account enumeration.
- Bind passkeys to the correct RP ID/origin and reject replayed challenges and
  invalid signature counters.
- Clear cached identity on definitive logout or refresh invalidation.

## Required tests

- Student login success and normalized identity.
- Passkey registration, assertion verification, origin validation, and replay
  rejection.
- Requested-role mismatch rejection and multi-role selection.
- Invalid credentials, inactive account, 429, offline, and 5xx error copy.
- Five concurrent 401s produce exactly one refresh request.
- Refresh 401 clears the session; refresh 5xx/429 preserves it.
- Student role receives only student navigation.
- Null `school_code` blocks school-scoped fetches.
- A student cannot read another student’s lesson or attempt by changing an ID.
- Web and native token adapters share the same session behavior.

## Decisions and trade-offs

- Passkey first: phishing-resistant and lower credential-support burden, but
  requires recovery UX and platform compatibility testing.
- Password fallback: improves adoption and recovery, but carries phishing and
  credential-reuse risk.
- Context + hooks: enough for the current screen count; avoid a global state
  library until server-state caching becomes a measured problem.
- Server-owned authorization: slightly more API work, but prevents a modified
  client from crossing student or school boundaries.
- Cached identity for shell rendering: improves cold-start UX, but it is never
  trusted for data access.

## Exit criteria for Phase 2 student auth

- Student can register/sign in with a passkey, cold-start, refresh, log out,
  and recover from network interruption on web and native.
- Role selection is server-validated and never grants authority by itself.
- All student routes are fail-closed and school-scoped on the server.
- The contract and state-machine tests pass in root CI and the mobile suite.
- No screen reads raw token storage or implements its own refresh logic.
