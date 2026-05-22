# Auth + Database Upgrade Plan

## Target

Move auth and authorization toward a production-company pattern:

- Identity provider owns login, MFA, password reset, account recovery, and token issuance.
- Application database owns user profile, tenant membership, role assignments, approvals, and audit history.
- Server authorization checks use a single role and permission policy, not scattered string checks.
- High-privilege roles are never self-assigned from the browser.

## Recommended Infrastructure

For this app, keep Firebase Authentication or migrate later to a managed OIDC provider such as Auth0, Clerk, WorkOS, Cognito, or Google Identity Platform. Do not build password/session infrastructure from scratch unless there is a compliance reason.

For the application database upgrade, the production-friendly target is:

- PostgreSQL for core relational data: users, schools, classes, enrollments, roles, permissions, invitations, tests, attempts, billing, audit logs.
- Redis for short-lived server sessions, rate-limit counters, OTP state, and websocket presence.
- Object storage for uploads and generated assets.
- MongoDB can stay temporarily for chat or flexible content during migration, but it should not be the authority for auth roles long term.

## Role Model

Current roles:

- `student`
- `teacher`
- `parent`
- `principal`
- `school_admin`
- `admin`

Production model:

- `users`: identity-linked user profile.
- `schools`: tenant boundary.
- `memberships`: user belongs to a school with status.
- `roles`: named role records.
- `permissions`: atomic capabilities.
- `role_permissions`: role to permission mapping.
- `membership_roles`: role assignment per user per school.
- `invites`: controlled onboarding for teachers, principals, school admins, parents, and students.
- `audit_events`: all role/status changes, invite sends, approval decisions, login/security events.

## Role Assignment Rules

- Students and parents may self-register only into low-privilege roles.
- Teachers may self-register as `pending` only when tied to a valid school code, or preferably through an invite.
- Principals, school admins, and platform admins must be invited or assigned by an existing authorized admin.
- `role` and `status` must not be accepted from profile sync or general profile update forms.
- Firebase custom claims should mirror DB role state only after the server authorizes the assignment.

## Migration Phases

1. Centralize role constants and permission helpers.
2. Stop browser-controlled privilege writes.
3. Add audit logging for role/status changes.
4. Add invite-first onboarding for staff/admin roles.
5. Introduce PostgreSQL schema beside MongoDB.
6. Dual-write identity/profile/membership updates.
7. Backfill existing users into PostgreSQL memberships.
8. Move auth lookups and route guards to PostgreSQL.
9. Move remaining relational data to PostgreSQL by domain.
10. Retire MongoDB as the role authority.

## Minimum PostgreSQL Schema Sketch

```sql
create table users (
  id bigserial primary key,
  auth_provider text not null,
  auth_subject text not null,
  email citext not null unique,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  unique (auth_provider, auth_subject)
);

create table schools (
  id bigserial primary key,
  code text not null unique,
  name text not null,
  district text,
  created_at timestamptz not null default now()
);

create table memberships (
  id bigserial primary key,
  user_id bigint not null references users(id),
  school_id bigint references schools(id),
  status text not null check (status in ('active', 'pending', 'suspended', 'rejected')),
  created_at timestamptz not null default now(),
  unique (user_id, school_id)
);

create table roles (
  id bigserial primary key,
  key text not null unique
);

create table permissions (
  id bigserial primary key,
  key text not null unique
);

create table role_permissions (
  role_id bigint not null references roles(id),
  permission_id bigint not null references permissions(id),
  primary key (role_id, permission_id)
);

create table membership_roles (
  membership_id bigint not null references memberships(id),
  role_id bigint not null references roles(id),
  assigned_by bigint references users(id),
  assigned_at timestamptz not null default now(),
  primary key (membership_id, role_id)
);

create table audit_events (
  id bigserial primary key,
  actor_user_id bigint references users(id),
  target_user_id bigint references users(id),
  school_id bigint references schools(id),
  event_type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
```

## Prep Already Started

- Shared role/status constants live in `shared/authz.ts`.
- Auth registration now normalizes self-registerable roles.
- Profile sync ignores browser-supplied `role` and `status`.
- Shared Zod and Mongoose schemas now read role/status enums from the same policy module.
