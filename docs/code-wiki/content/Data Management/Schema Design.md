# Schema Design

<cite>
**Referenced Files in This Document**
- [pg-schema.sql](file://scripts/pg-schema.sql)
- [shared/schema.ts](file://shared/schema.ts)
- [shared/mongo-schema.ts](file://shared/mongo-schema.ts)
- [shared/cassandra-schema.ts](file://shared/cassandra-schema.ts)
</cite>

## Table of Contents

1. [Introduction](#introduction)
2. [Multi-Database Architecture](#multi-database-architecture)
3. [PostgreSQL Schema (Primary)](#postgresql-schema-primary)
4. [MongoDB Schema (Specialized)](#mongodb-schema-specialized)
5. [Cassandra Schema (Messaging)](#cassandra-schema-messaging)
6. [Schema Evolution & Migration](#schema-evolution--migration)
7. [Conclusion](#conclusion)

## Introduction

PersonalLearningPro uses a multi-database strategy to handle diverse workloads: relational business logic (PostgreSQL), flexible document storage (MongoDB), and high-throughput messaging (Cassandra).

## Multi-Database Architecture

| Storage        | Purpose                                  | Tech Stack                     |
| -------------- | ---------------------------------------- | ------------------------------ |
| **PostgreSQL** | Transactions, Tenancy, Sessions, Billing | SQL / Drizzle-style Relational |
| **MongoDB**    | Tests, Questions, Analytics, State       | NoSQL Document Store           |
| **Cassandra**  | Real-time Chat, Activity Streams         | Time-series Wide Column        |

## PostgreSQL Schema (Primary)

The source of truth for all "Identity" and "Tenancy" data.

### `users` (Transactional)

Relational user data replacing the legacy Firebase-only model.

- `id`: `bigserial`
- `email`: `citext` (Hashed/Indexed)
- `password_hash`: `text` (Bcrypt)
- `email_verified`: `boolean`

### `workspaces` (Multi-Tenancy)

Containers for organizational data.

- `id`: `bigserial`
- `slug`: `text` (Unique, indexed for URL lookup)
- `owner_id`: `bigint` (FK to `users.id`)

### `workspace_memberships` (RBAC)

Maps users to workspaces with roles (`owner`, `admin`, `member`).

### `sessions` (Auth Lifecycle)

Server-side session tracking for secure logout and token rotation.

## MongoDB Schema (Specialized)

Used for data that is deeply nested or requires frequent schema updates without migrations.

- **`Tests`**: Contains metadata about an assessment.
- **`Questions`**: Stores rich content (MCQs, text, rubrics).
- **`Analytics`**: Stores complex JSON insights from AI evaluations.

## Cassandra Schema (Messaging)

Optimized for "Write-once, Read-often" chat data.

- **`messages`**: Partitioned by `channel_id`, clustered by `message_id` (Snowflake).
- **`read_by`**: Tracked via set/list column types for high concurrency.

## Schema Evolution & Migration

1. **PostgreSQL**: Managed via `scripts/pg-schema.sql` and `pg-migrate.ts`.
2. **MongoDB**: Schema-less but validated via Zod at the application layer.
3. **Cassandra**: Evolution via `ALTER TABLE` commands in the deployment pipeline.

## Conclusion

By segregating data into three distinct layers, PersonalLearningPro ensures that identity management is robustly relational, content is flexible and document-oriented, and communication is highly performant and scalable.
