# Database Architecture

## Overview

PersonalLearningPro uses a multi-database architecture optimized for different data access patterns:

- **PostgreSQL**: Primary transactional data store for users, workspaces, tenancy, billing, and sessions.
- **MongoDB**: Specialized store for tests, questions, and non-relational application state.
- **Cassandra (Astra DB)**: High-performance message storage with automatic fallback to MongoDB.

---

## 🐘 PostgreSQL Schema (Primary Store)

PostgreSQL is the source of truth for all critical business logic and multi-tenancy.

### Tables

#### `users`
Stores core identity and profile data.
- `id`: `bigserial` (Primary Key)
- `email`: `citext` (Unique, case-insensitive)
- `username`: `text` (Unique)
- `password_hash`: `text`
- `name`: `text`
- `display_name`: `text`
- `avatar`: `text`
- `email_verified`: `boolean` (Default: `false`)
- `role`: `text` (student, teacher, admin, etc.)
- `status`: `text` (active, pending, suspended, rejected)
- `onboarding_complete`: `boolean`
- `created_at`: `timestamptz`
- `last_login_at`: `timestamptz`

#### `workspaces`
Core multi-tenancy containers.
- `id`: `bigserial` (Primary Key)
- `name`: `text`
- `slug`: `text` (Unique, URL-friendly)
- `type`: `text` (business, school, personal)
- `description`: `text`
- `owner_id`: `bigint` (References `users.id`)
- `members`: `bigint[]` (Array of user IDs for fast filtering)
- `created_at`: `timestamptz`

#### `workspace_memberships`
Join table linking users to workspaces with specific roles.
- `id`: `bigserial` (Primary Key)
- `workspace_id`: `bigint` (References `workspaces.id`)
- `user_id`: `bigint` (References `users.id`)
- `role`: `text` (owner, admin, member)
- `status`: `text` (active, pending, suspended)
- `created_at`: `timestamptz`

#### `workspace_invites`
Secure invitation tokens for joining workspaces.
- `id`: `bigserial` (Primary Key)
- `workspace_id`: `bigint` (References `workspaces.id`)
- `email`: `citext`
- `name`: `text`
- `role`: `text`
- `kind`: `text` (business_member, student)
- `token_hash`: `text` (Unique, SHA-256 hash of random token)
- `status`: `text` (pending, accepted, expired)
- `expires_at`: `timestamptz`

#### `sessions`
Server-side session management for local auth.
- `id`: `bigserial` (Primary Key)
- `user_id`: `bigint` (References `users.id`)
- `refresh_token_hash`: `text` (Unique)
- `device_info`: `text`
- `ip_address`: `inet`
- `expires_at`: `timestamptz`

---

## 🍃 MongoDB Schema

### Collections

#### Tests
Test definitions created by teachers.
```typescript
{
  id: number,
  title: string,
  description: string,
  subject: string,
  class: string,
  teacherId: number,
  totalMarks: number,
  duration: number,
  testDate: Date,
  status: enum, // draft | published | completed
  createdAt: Date
}
```

#### Questions
Individual questions belonging to tests.
```typescript
{
  id: number,
  testId: number,
  type: enum, // mcq | short | long | numerical
  text: string,
  options: mixed,
  correctAnswer: string,
  marks: number,
  order: number,
  aiRubric: string
}
```

---

## ⚡ Cassandra Schema

### Messages Table
High-performance message storage partitioned by channel.
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

## 🔄 Data Synchronization

1. **Auth Bridge**: All authentication now happens via PostgreSQL. The `firebaseUid` field is deprecated and kept only for backward compatibility.
2. **Search**: Critical entities (Users, Workspaces) are stored in PostgreSQL for relational queries, while flexible content (Tests, Questions) remains in MongoDB.
3. **Caching**: Frequently accessed session data is cached in memory, but backed by the PostgreSQL `sessions` table.

## Maintenance

### Backup Strategy
1. **PostgreSQL**: Standard WAL-based backups (Point-in-time recovery).
2. **MongoDB**: Atlas automated snapshots.
3. **Cassandra**: Astra DB built-in backups.
