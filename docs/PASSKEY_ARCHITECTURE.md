# Class-mode Passkey Architecture

## 1. Objective

Allow an authenticated user to create and manage passkeys from **Settings →
Security**, then use the passkey for role-aware sign-in across:

- Browser WebAuthn
- Expo Android
- Expo iOS

Passkeys authenticate an identity. The server still decides the active role,
school scope, permissions, and session lifetime.

## 2. Design principles

1. The server is the source of truth for users, roles, schools, credentials,
   challenges, and sessions.
2. A role selected by the client is a request, never an authorization grant.
3. Private keys never leave the authenticator or device keychain.
4. Challenges are one-time, short-lived, origin-bound, and stored server-side.
5. Password/recovery remains available so students are not locked out.
6. Web and native clients share the same API contracts and `SessionProvider`.

## 3. High-level architecture

```text
 Browser WebAuthn API        Native passkey provider
          \                         /
           \                       /
            Universal Auth Client
          Settings | Login | SessionProvider
                         |
                 Class-mode Auth API
       options -> challenge store -> verify -> session issuer
                         |
              PostgreSQL identity database
      users | passkey_credentials | passkey_challenges | sessions
```

Recommended server library: `@simplewebauthn/server`. Browser support uses
`@simplewebauthn/browser` or the WebAuthn platform API. Native support should
use the Expo-compatible platform credential provider selected during device
spike; the native adapter must return the same registration/assertion payload
shape as the browser adapter.

## 4. User journeys

### 4.1 Add passkey after login

```text
Settings → Security → Add passkey
    → require fresh authenticated session
    → GET registration options
    → platform/browser passkey prompt
    → POST attestation response
    → server verifies + stores public key
    → show name/device + created time
```

The user may name the credential after verification, for example “Nitish’s
iPhone”. Naming is metadata only and never sent to the authenticator.

### 4.2 Role-aware login

```text
Login → choose Student/Teacher/Parent/Staff
      → request authentication options with requestedRole
      → passkey prompt
      → verify assertion
      → server resolves credential owner
      → validate requestedRole against allowed roles
      → issue scoped access + refresh tokens
```

For a multi-role account, the server returns `availableRoles`; the client
shows a role picker and requests a scoped session. For a mismatch, return 403
with generic role-not-available copy.

### 4.3 Manage passkeys

Settings lists only the authenticated user’s credentials:

- friendly name
- created at
- last used at
- device/platform label
- revoke action

Require recent authentication before adding, renaming, or revoking a key.
Prevent revoking the last credential unless a password/recovery method is
available or the user explicitly confirms a recovery warning.

## 5. Data model

### `passkey_credentials`

```sql
CREATE TABLE passkey_credentials (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id BYTEA NOT NULL UNIQUE,
  public_key BYTEA NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  transports TEXT[] NOT NULL DEFAULT '{}',
  aaguid UUID,
  device_type TEXT,
  backed_up BOOLEAN NOT NULL DEFAULT false,
  label TEXT NOT NULL DEFAULT 'Passkey',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX passkey_credentials_user_idx
  ON passkey_credentials(user_id) WHERE revoked_at IS NULL;
```

### `passkey_challenges`

```sql
CREATE TABLE passkey_challenges (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  challenge TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL CHECK (purpose IN ('registration', 'login')),
  requested_role TEXT,
  rp_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX passkey_challenges_expiry_idx ON passkey_challenges(expires_at);
```

For discoverable login, `user_id` may be null at challenge creation and is
resolved from the credential during assertion verification. For Settings
registration, it is always bound to the authenticated user.

## 6. API contracts

All endpoints live under `/api/auth/passkey` and return JSON. Use the existing
access/refresh session issuer after successful verification.

### Registration

`POST /register/options` — authenticated; require recent auth.

Request:

```json
{ "requestedRole": "student" }
```

Response is WebAuthn `PublicKeyCredentialCreationOptions` plus an opaque
`challengeId` if the implementation does not expose the raw challenge.

`POST /register/verify` — authenticated.

```json
{
  "response": {},
  "label": "Student phone"
}
```

The server verifies challenge, origin, RP ID, user handle, attestation
requirements, and credential uniqueness before inserting the public key.

### Authentication

`POST /login/options`

```json
{ "requestedRole": "student", "email": "optional@example.com" }
```

`POST /login/verify`

```json
{
  "requestedRole": "student",
  "response": {}
}
```

Response:

```json
{
  "token": "access-token",
  "refreshToken": "refresh-token",
  "user": {
    "id": "123",
    "role": "student",
    "school_code": "SCHOOL123"
  },
  "availableRoles": ["student"]
}
```

### Credential management

- `GET /credentials` — list active credentials for the current user.
- `PATCH /credentials/:id` — rename after recent auth.
- `DELETE /credentials/:id` — revoke after recent auth and recovery check.
- `POST /reauth/options` and `POST /reauth/verify` — recent-auth step-up.

## 7. Verification rules

Registration must validate:

- challenge exists, purpose is registration, not expired, not consumed
- authenticated user matches challenge user
- expected origin and RP ID
- user verification policy (`preferred` initially, `required` for sensitive
  actions if the device supports it)
- credential ID is not already registered

Login must validate:

- challenge exists, purpose is login, not expired, not consumed
- expected origin and RP ID
- credential exists and is not revoked
- signature is valid for the stored public key
- sign count is not a rollback, with documented handling for authenticators
  that always return zero
- user is active and requested role is authorized

On success, consume the challenge in the same transaction as the counter and
`last_used_at` update. Then create the normal rotated refresh session.

## 8. Origin and environment configuration

```text
PASSKEY_RP_ID=classmode.app
PASSKEY_RP_NAME=Class-mode
PASSKEY_ORIGINS=https://classmode.app,https://www.classmode.app
PASSKEY_CHALLENGE_TTL_SECONDS=300
PASSKEY_RECENT_AUTH_SECONDS=600
```

Development needs separate RP/origin values for localhost. Android/iOS need
the platform association files and app identifiers required by the selected
native provider. Never use a production RP ID in local development.

## 9. Error model

Use stable machine codes and safe human copy:

| Code | HTTP | Meaning |
| --- | ---: | --- |
| `PASSKEY_CANCELLED` | 400 | User cancelled the device prompt |
| `PASSKEY_UNSUPPORTED` | 400 | Device/browser cannot use passkeys |
| `PASSKEY_CHALLENGE_EXPIRED` | 401 | Challenge expired or was already consumed |
| `PASSKEY_INVALID` | 401 | Assertion/attestation failed |
| `PASSKEY_ROLE_FORBIDDEN` | 403 | Credential is valid but role is unavailable |
| `PASSKEY_REVOKED` | 401 | Credential was revoked |
| `PASSKEY_REAUTH_REQUIRED` | 428 | Sensitive Settings action needs fresh auth |
| `PASSKEY_RATE_LIMITED` | 429 | Challenge or verification limit exceeded |

Do not reveal whether an email, credential ID, or account exists during
unauthenticated login.

## 10. Security and abuse controls

- Rate-limit options and verify endpoints independently by IP and account.
- Store only credential public material; never store private keys.
- Hash or encrypt sensitive challenge metadata where operationally useful.
- Consume challenges atomically to prevent replay.
- Do not log assertion payloads, challenges, tokens, or credential IDs in full.
- Revoke all sessions after suspicious credential changes when policy requires.
- Audit registration, login, rename, revoke, failed verification, and role
  mismatch events.
- Require recent authentication for Settings changes and account recovery.
- Add cleanup for expired challenges.

## 11. Client boundaries

`SessionProvider` owns login, refresh, logout, and reauthentication. A new
`PasskeyService` owns only platform ceremony and API payload conversion.

```text
SettingsSecurityScreen
  └── PasskeyService.register()
        ├── apiPost('/options')
        ├── platform credential prompt
        └── apiPost('/verify')

LoginScreen
  └── PasskeyService.authenticate(requestedRole)
        └── SessionProvider.completeLogin(tokens, user)
```

No screen reads SecureStore directly, constructs a JWT, or decides role access.

## 12. Rollout plan

1. Add dependency and server tables behind `ENABLE_PASSKEYS=false`.
2. Implement registration options/verify and Settings list/add/revoke.
3. Test browser WebAuthn on localhost and production origin.
4. Add Android/iOS provider adapter and app association configuration.
5. Enable passkey login for internal users, then students by cohort.
6. Keep password recovery until passkey adoption and recovery success are
   measured.
7. Add admin support tooling for credential revocation and audit lookup.

## 13. Test matrix and exit criteria

- Registration succeeds for browser, Android, and iOS.
- Registration rejects replayed, expired, wrong-origin, and wrong-user data.
- Login rejects invalid signatures, revoked credentials, counter rollback, and
  unauthorized roles.
- Multi-role users can select only server-returned roles.
- Settings can add, list, rename, and revoke credentials.
- Last-credential recovery guard works.
- Concurrent login challenges do not interfere.
- Refresh/logout behavior matches existing `SessionProvider` semantics.
- No student can access another student’s resources after passkey login.
- Root server tests, mobile tests, web build, and native export pass.
