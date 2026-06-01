# Database & Storage Layer

## Architecture

| Store                    | Role                                                     | Required?                           |
| ------------------------ | -------------------------------------------------------- | ----------------------------------- |
| **PostgreSQL**           | Primary — users, workspaces, sessions, tests, SIS, audit | ✅ Required                         |
| **MongoDB**              | Legacy content fallback                                  | ❌ Optional                         |
| **Cassandra (Astra DB)** | MessagePal chat history                                  | ❌ Optional (falls back to MongoDB) |

## PostgreSQL (Primary)

All critical data lives in PostgreSQL. Schema: `scripts/pg-schema.sql` (idempotent, safe to re-run).

Key tables: `users`, `workspaces`, `workspace_memberships`, `workspace_invites`, `sessions`, `otps`, `tests`, `questions`, `test_attempts`, `answers`, `analytics`, `test_assignments`, `audit_events`, `schools`, `invites`, `dynamic_bases/tables/fields/records/views`, `lms_connections`.

Query layer: `server/lib/pg-queries.ts` (general) + `server/lib/pg-dynamic-sis.ts` (SIS).

## MongoDB (Optional)

Set `MONGODB_URL` to enable. Used only for legacy test/question content. Server starts without it — MongoDB errors are non-fatal.

## Cassandra / Astra DB (Optional)

Used by MessagePal for high-throughput chat message storage. Falls back to MongoDB if unavailable. Client: `server/lib/cassandra.ts`. Message store: `server/lib/cassandra-message-store.ts`.

## Dynamic SIS

A flexible, workspace-scoped Student Information System built entirely on PostgreSQL. Teachers create custom bases (like Airtable), tables, fields (text, number, date, select, etc.), records, and views. No separate NoSQL store needed.

- Routes: `server/routes/dynamic-sis.ts`
- Queries: `server/lib/pg-dynamic-sis.ts`
- AI enrichment: `server/services/dynamic-enrichment.ts`
