# Database & Storage Layer

## Features

*   **Hybrid Database Architecture:** The platform uses a mix of databases.
    *   **PostgreSQL:** Used for structured, relational data (entities, auth). Seen in `db-pg.ts` and `pg` dependency.
    *   **Cassandra (Optional/Historical):** There are references to Cassandra (e.g., `cassandra-schema.ts`, `cassandra-driver` in `package.json` optional dependencies), typically used for high-volume data like messages.
*   **ORM/Query Builder:** Likely using Drizzle or raw queries given `pg` usage and `schema.ts`.

## Simplification Recommendations

*   **Drop Cassandra:** Unless this application is currently processing tens of thousands of messages a second, Cassandra is massive overkill. It requires significant operational overhead, complex schema migrations, and makes local development harder.
*   **Move Everything to PostgreSQL:** PostgreSQL can easily handle millions of rows of messages and typical school application workloads. Consolidating to a single database will drastically simplify deployments, backups, and developer onboarding.
*   **Storage.ts Cleanup:** `server/storage.ts` is quite large (54KB). This usually indicates it's acting as a monolithic "God object" for all database operations. Break this down into domain-specific repositories (e.g., `user.repository.ts`, `class.repository.ts`).
