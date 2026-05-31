# Database Architecture

## Overview

PersonalLearningPro uses a multi-database architecture optimized for different data access patterns:

- **PostgreSQL**: Primary transactional data store for users, workspaces, tenancy, sessions, tests, SIS, billing, and all critical business logic.
- **MongoDB**: Optional legacy store for non-relational content (tests, questions, analytics). Not required for core functionality.
- **Cassandra (Astra DB)**: High-performance message storage for MessagePal, with automatic fallback to MongoDB.
- **Redis (BullMQ)**: Persistent job queue for AI tutor tasks, whiteboard orchestration, and long-running generation jobs.

---

## 🐘 PostgreSQL Schema (Primary Store)

PostgreSQL is the source of truth for all critical business logic and multi-tenancy. Schema is in `scripts/pg-schema.sql`.

### Tables

#### `users`

Core identity and profile data.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial` | Primary Key |
| `auth_provider` | `text` | Default `'firebase'`; `'local'` for password auth, `'google'` for OAuth |
| `auth_subject` | `text` | Provider-specific user ID |
| `email` | `citext` | Unique, case-insensitive |
| `username` | `text` | Unique |
| `password_hash` | `text` | bcrypt hash (null for OAuth users) |
| `name` | `text` | |
| `display_name` | `text` | |
| `avatar` | `text` | URL |
| `email_verified` | `boolean` | Default `false` |
| `role` | `text` | `student\|teacher\|parent\|principal\|school_admin\|admin` |
| `status` | `text` | `active\|pending\|suspended\|rejected` |
| `school_code` | `text` | |
| `school_id` | `bigint` | References `schools.id` |
| `parent_id` | `bigint` | References `users.id` |
| `grade` | `text` | |
| `board` | `text` | |
| `subjects` | `text[]` | |
| `district` | `text` | |
| `class_name` | `text` | |
| `subject` | `text` | |
| `onboarding_complete` | `boolean` | Default `false` |
| `study_plan` | `jsonb` | Default `{}` |
| `created_at` | `timestamptz` | |
| `last_login_at` | `timestamptz` | |

#### `schools`

School/institution records.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial` | Primary Key |
| `code` | `text` | Unique |
| `name` | `text` | |
| `city` | `text` | |
| `district` | `text` | |
| `board` | `text` | |
| `logo` | `text` | |
| `grades_offered` | `text[]` | |
| `created_by_uid` | `text` | |
| `onboarding_complete` | `boolean` | |
| `created_at` | `timestamptz` | |

#### `workspaces`

Core multi-tenancy containers.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial` | Primary Key |
| `name` | `text` | |
| `slug` | `text` | Unique, URL-friendly |
| `type` | `text` | `business\|school\|personal` |
| `description` | `text` | |
| `owner_id` | `bigint` | References `users.id` |
| `members` | `bigint[]` | Array of user IDs for fast filtering |
| `created_at` | `timestamptz` | |

#### `workspace_memberships`

Join table linking users to workspaces with specific roles.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial` | Primary Key |
| `workspace_id` | `bigint` | References `workspaces.id` |
| `user_id` | `bigint` | References `users.id` |
| `role` | `text` | `owner\|admin\|member` |
| `status` | `text` | `active\|pending\|suspended` |
| `created_at` | `timestamptz` | |

#### `workspace_invites`

Secure invitation tokens for joining workspaces.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial` | Primary Key |
| `workspace_id` | `bigint` | References `workspaces.id` |
| `email` | `citext` | |
| `name` | `text` | |
| `role` | `text` | |
| `kind` | `text` | `business_member\|student` |
| `token_hash` | `text` | Unique, SHA-256 hash of random token |
| `status` | `text` | `pending\|accepted\|expired` |
| `expires_at` | `timestamptz` | |

#### `sessions`

Server-side session management for local auth (refresh tokens).

| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial` | Primary Key |
| `user_id` | `bigint` | References `users.id` ON DELETE CASCADE |
| `refresh_token_hash` | `text` | Unique |
| `device_info` | `text` | |
| `ip_address` | `text` | |
| `created_at` | `timestamptz` | |
| `expires_at` | `timestamptz` | |

#### `subscriptions`

Billing and subscription tier data.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial` | Primary Key |
| `user_id` | `bigint` | References `users.id` ON DELETE CASCADE |
| `workspace_id` | `bigint` | References `workspaces.id` ON DELETE CASCADE |
| `tier` | `text` | `free\|pro\|educator\|institution` |
| `stripe_customer_id` | `text` | |
| `stripe_subscription_id` | `text` | |
| `status` | `text` | `active\|canceled\|past_due\|trialing` |
| `current_period_end` | `timestamptz` | |
| `cancel_at_period_end` | `boolean` | |

#### `otps`

One-time passwords for registration, password reset, and 2FA.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial` | Primary Key |
| `user_id` | `bigint` | References `users.id` ON DELETE CASCADE |
| `otp_hash` | `text` | |
| `type` | `text` | `registration\|password_reset\|2fa` |
| `expires_at` | `timestamptz` | |
| `used` | `boolean` | Default `false` |
| `attempts` | `int` | Default `0` |
| `created_at` | `timestamptz` | |

#### `tests`

Test definitions created by teachers.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial` | Primary Key |
| `title` | `text` | |
| `description` | `text` | |
| `subject` | `text` | |
| `class_name` | `text` | |
| `teacher_id` | `bigint` | References `users.id` |
| `total_marks` | `int` | Default `100` |
| `duration` | `int` | Minutes, default `60` |
| `test_date` | `timestamptz` | |
| `question_types` | `text[]` | |
| `status` | `text` | `draft\|published\|completed` |
| `created_at` | `timestamptz` | |

#### `questions`

Individual questions belonging to tests.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial` | Primary Key |
| `test_id` | `bigint` | References `tests.id` ON DELETE CASCADE |
| `type` | `text` | `mcq\|short\|long\|numerical` |
| `text` | `text` | |
| `options` | `jsonb` | MCQ options |
| `correct_answer` | `text` | |
| `marks` | `int` | Default `1` |
| `ord` | `int` | Display order |
| `ai_rubric` | `text` | |

#### `test_attempts`

Student test submissions.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial` | Primary Key |
| `test_id` | `bigint` | References `tests.id` |
| `student_id` | `bigint` | References `users.id` |
| `start_time` | `timestamptz` | |
| `end_time` | `timestamptz` | |
| `score` | `numeric` | |
| `status` | `text` | `in_progress\|completed\|evaluated` |

#### `answers`

Individual answers within a test attempt.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial` | Primary Key |
| `attempt_id` | `bigint` | References `test_attempts.id` ON DELETE CASCADE |
| `question_id` | `bigint` | References `questions.id` |
| `text` | `text` | |
| `selected_option` | `int` | MCQ selection |
| `image_url` | `text` | |
| `ocr_text` | `text` | |
| `score` | `numeric` | |
| `ai_confidence` | `numeric` | |
| `ai_feedback` | `text` | |
| `is_correct` | `boolean` | |

#### `analytics`

Per-student per-test AI insights.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial` | Primary Key |
| `user_id` | `bigint` | References `users.id` |
| `test_id` | `bigint` | References `tests.id` |
| `weak_topics` | `text[]` | |
| `strong_topics` | `text[]` | |
| `recommended_resources` | `text[]` | |
| `insight_date` | `timestamptz` | |

#### `test_assignments`

Test distribution to students.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial` | Primary Key |
| `test_id` | `bigint` | References `tests.id` |
| `student_id` | `bigint` | References `users.id` |
| `assigned_by` | `bigint` | References `users.id` |
| `assigned_date` | `timestamptz` | |
| `due_date` | `timestamptz` | |
| `status` | `text` | `pending\|started\|completed\|overdue` |
| `notification_sent` | `boolean` | |

#### `audit_events`

Immutable audit log.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial` | Primary Key |
| `actor_user_id` | `bigint` | References `users.id` |
| `target_user_id` | `bigint` | References `users.id` |
| `school_code` | `text` | |
| `event_type` | `text` | |
| `payload` | `jsonb` | |
| `created_at` | `timestamptz` | |

#### `invites`

School-level invitations (legacy, pre-workspace).

| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial` | Primary Key |
| `email` | `citext` | |
| `name` | `text` | |
| `role` | `text` | |
| `school_id` | `bigint` | References `schools.id` |
| `class_id` | `text` | |
| `grades` | `text[]` | |
| `token` | `text` | Unique |
| `status` | `text` | `pending\|accepted\|expired` |
| `invited_by` | `text` | |
| `expires_at` | `timestamptz` | |
| `created_at` | `timestamptz` | |

#### `school_classes`

Class/section records within a school.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial` | Primary Key |
| `name` | `text` | |
| `grade` | `text` | |
| `teacher_firebase_uid` | `text` | |
| `school_id` | `bigint` | References `schools.id` |
| `students` | `text[]` | |
| `created_at` | `timestamptz` | |

#### RBAC tables

`roles`, `permissions`, `memberships`, `role_permissions`, `membership_roles` — fine-grained permission system for school-level RBAC.

#### Dynamic SIS tables

`dynamic_bases`, `dynamic_tables`, `dynamic_fields`, `dynamic_records`, `dynamic_views` — workspace-scoped flexible student information system. See `server/lib/pg-dynamic-sis.ts`.

#### LMS tables

`lms_connections` — stores OAuth tokens for Google Classroom connections per user.

---

## 🍃 MongoDB Schema (Optional Legacy)

MongoDB is optional. If `MONGODB_URL` is not set, the server starts without it. Used for legacy test/question content that hasn't been migrated to PostgreSQL.

### Collections

#### Tests / Questions

Legacy test definitions and questions (same shape as PostgreSQL `tests`/`questions` tables).

---

## ⚡ Cassandra Schema (MessagePal)

High-performance message storage partitioned by channel. Falls back to MongoDB if Cassandra is unavailable.

```cql
CREATE TABLE messages (
  channel_id      text,
  message_id      text,
  author_id       bigint,
  content         text,
  type            text,
  file_url        text,
  is_pinned       boolean,
  created_at      timestamp,
  PRIMARY KEY (channel_id, message_id)
) WITH CLUSTERING ORDER BY (message_id DESC);
```

---

## ⚡ Redis (Job Queue)

Used for stateful AI operations and long-running background tasks via **BullMQ**.

| Queue Name | Purpose |
|---|---|
| `ai-tutor` | Manages AI tutor chat sessions and context preservation. |
| `whiteboard` | Orchestrates real-time whiteboard updates and scene generation. |
| `whatsapp` | Handles outbound parent notification delivery. |

---

## 🔄 Data Strategy

| Data Type | Store | Rationale |
|---|---|---|
| Users, auth, sessions | PostgreSQL | ACID, relational, critical path |
| Workspaces, memberships, invites | PostgreSQL | Multi-tenancy, RBAC |
| Tests, questions, attempts, answers | PostgreSQL | Relational integrity |
| Dynamic SIS | PostgreSQL | Flexible schema via JSONB |
| Chat messages | Cassandra → MongoDB fallback | High-throughput append-only |
| Legacy content | MongoDB | Optional, non-critical |

## Maintenance

### Backup Strategy

1. **PostgreSQL**: Standard WAL-based backups (Point-in-time recovery).
2. **MongoDB**: Atlas automated snapshots (if used).
3. **Cassandra**: Astra DB built-in backups (if used).

### Running Migrations

```bash
psql -d eduai_pg -f scripts/pg-schema.sql
```

All DDL statements are idempotent (`IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`).
