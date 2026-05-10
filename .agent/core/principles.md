# Principles

## Code Quality

1. **TypeScript strictness** — always use proper types; avoid `any`. Run `npm run check` before committing.
2. **Validation-first** — all API inputs must be validated with Zod schemas from `shared/schema.ts`.
3. **ESR pattern** — follow Error-Success-Response pattern for all API responses: `{ error?: string, data?: T }`.
4. **No comments** — write self-documenting code. Prefer expressive names over explanatory comments.
5. **Graceful degradation** — every external dependency (Cassandra, OpenAI, Gemini) must have a fallback.

## Architecture

6. **Single source of truth** — shared types live in `shared/` and are imported by web, mobile, and server.
7. **DAO pattern** — all database operations go through `MongoStorage` (or `CassandraMessageStore` for messages).
8. **Separation of concerns** — routes handle HTTP, services handle business logic, lib handles external integrations.
9. **Role-based access** — every API endpoint must check user roles via `requireRole(...)` middleware.
10. **DB health guard** — `requireDb` middleware protects against requests when MongoDB is disconnected.

## Workflow

11. **Spec-first** — non-trivial features start with requirements → design → tasks (in `.agent/memory/roadmap/`).
12. **Ship small, ship often** — prefer small focused PRs over monolithic changes.
13. **Test your changes** — run `npm test` and manually verify the affected flow.
14. **Lint before commit** — run `npm run lint` and `npm run format:check` — no warnings.
15. **Never commit secrets** — `.env`, credentials, and API keys must never be committed.
