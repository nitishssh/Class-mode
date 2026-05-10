# Workflows

## Standard Development Workflow

1. Understand task requirements
2. Search codebase for relevant patterns (existing implementations, schemas, routes)
3. Run `npm run check && npm run lint && npm run format:check` before edits
4. Implement changes
5. Run verification: `npm run check && npm run lint && npm run format:check && npm test`
6. Verify the build: `npm run build`
7. Update STATUS.md if feature is complete

## Feature Development — Fluent Agentic Workflow (FAW)

For any non-trivial feature, use the **5-phase Fluent Agentic Workflow** defined in `fluent-workflow.md`:

| Phase       | What                                                 | When                                            |
| ----------- | ---------------------------------------------------- | ----------------------------------------------- |
| **SPECIFY** | Write `requirements.md`, `design.md`, `tasks.md`     | Large features (5+ files), architecture changes |
| **PLAN**    | Generate `IMPLEMENTATION_PLAN.md` from specs         | All features (1+ files)                         |
| **EXECUTE** | Autonomous loop: read → edit → verify (backpressure) | Per task, max 3 retries                         |
| **VERIFY**  | Full integration: check + lint + test + build        | After all tasks done                            |
| **REVIEW**  | Human-in-the-loop at merge point                     | Before every merge                              |

### Workflow selection by task type

- **Bug fix (1-2 files):** EXECUTE → VERIFY → REVIEW (skip SPECIFY + PLAN)
- **Small feature (1-3 files):** PLAN → EXECUTE → VERIFY → REVIEW
- **Large feature (5+ files):** SPECIFY → PLAN → EXECUTE → VERIFY → REVIEW
- **Emergency fix:** EXECUTE → VERIFY → REVIEW (document root cause in commit)

### Backpressure chain (blocks execution if fails)

```
npm run check  →  npm run lint  →  npm run format:check  →  npm test  →  npm run build
```

Each command must pass before moving to the next. After 3 consecutive failures on the same task, flag for human review.

## Bug Fix Workflow

1. Reproduce the issue
2. Search codebase for root cause
3. Write a failing test first (if feasible)
4. Apply the fix
5. Verify: `npm run check && npm run lint && npm test`
6. Run full test suite to ensure no regressions

## Code Review Workflow

1. Run `npm run check` to verify type safety
2. Verify input validation (Zod schemas in `shared/`)
3. Confirm role-based access guards (`requireRole(...)`) are in place
4. Check for hardcoded values that should be config/env
5. Ensure proper error handling and fallback logic (Cassandra → MongoDB, OpenAI → Gemini)
6. Verify no secrets are exposed
7. Run `npm run build` to confirm production build succeeds

## Deployment Workflow

1. Ensure CI passes (type check, lint, test, build)
2. Merge to `main`
3. `cd.yml` auto-deploys to staging via GHCR + SSH
4. For production: `gcloud builds submit` via `npm run deploy:gcp`

## Context Freshness Rule

Each EXECUTE iteration starts with a **fresh context**. State lives on disk:

- `IMPLEMENTATION_PLAN.md` — task queue and progress
- `STATUS.md` — overall feature completion
- File system — actual code changes
- Never carry conversation context across iterations
