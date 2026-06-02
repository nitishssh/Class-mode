# AGENTS.md — PersonalLearningPro (EduAI)

## Build & Test

```bash
npm run dev        # Express (tsx) + Vite middleware on port 5001
npm run check      # tsc --noEmit — excludes **/*.test.ts
npm test           # vitest run --root . — runs server/tests/**/*.test.ts
npm run lint       # ESLint (flat config: eslint.config.js)
npm run format     # Prettier (includes prettier-plugin-tailwindcss)
npm run build      # vite build (client/) + esbuild (server/index.ts)
npm start          # node dist/index.js (production)
npm run deploy:gcp # gcloud builds submit --config cloudbuild.yaml
```

CI order (`.github/workflows/ci.yml`): `check → lint → build → test`.

## Test quirks

- `.env.test` is gitignored; `vitest.config.ts` provides fallback defaults for CI.
- Two vitest configs: `vitest.config.ts` (root, CI) and `server/vitest.config.ts` (standalone server tests).
- Test setup: `server/tests/setup.ts` — loads `.env.test`.
- `server/tests/microservices-integration.test.ts` is excluded from server vitest config.
- Excluded from root test glob: `e2e/`, `features/`, `mobile/`.
- MongoDB required for meaningful tests (`MONGODB_URL` env var).

## Monorepo layout

Single `package.json` (no monorepo tool). Key directories:

- `client/` — Vite + React 18 (`root: client/`, entry: `client/src/main.tsx`)
- `server/` — Express (entry: `server/index.ts`, routes: `server/routes/*.ts`)
- `shared/` — Zod schemas + Mongoose models, imported via `@shared/*`
- `mobile/` — Expo Router (`cd mobile && npm start`)
- `features/ai-classroom/` — Study Arena + IniClaw (separate Docker services)
- `services/iniclaw/` — IniClaw agent gateway (Docker compose profile)

## Path aliases

| Alias       | Resolves to         | Configured in          |
| ----------- | ------------------- | ---------------------- |
| `@/*`       | `client/src/*`      | tsconfig, vite, vitest |
| `@shared/*` | `shared/*`          | tsconfig, vite, vitest |
| `@assets/*` | `attached_assets/*` | vite only              |

## Architecture

- **Auth**: Self-hosted PostgreSQL-backed identity. Dual fallback: JWT verify → session lookup. Google OAuth 2.0 server-side flow via `server/lib/google-signin.ts` (`/api/auth/google/start` → `/api/auth/google/callback`). Firebase token-exchange endpoint kept for backward compat (`ENABLE_FIREBASE_AUTH_COMPAT`).
- **DB**: PostgreSQL primary (all transactional data — users, workspaces, sessions, tests, SIS, billing). MongoDB optional (legacy content). Cassandra (MessagePal only, optional — falls back to MongoDB). Redis (BullMQ for AI Job persistence).
- **AI**: Google Gemini 2.0 Flash (`server/lib/gemini.ts`) primary; OpenAI GPT-4o (`server/lib/openai.ts`) optional fallback.
- **Real-time**: Two WebSocket servers (chat + MessagePal) attached to HTTP server after `registerRoutes()`.
- **Routing**: `wouter` (not react-router). Pages in `client/src/pages/`.
- **Validation**: Zod schemas in `shared/schema.ts`. Mongoose models in `shared/mongo-schema.ts`.
- **Rate limiting**: `/api/ai` 20/min, `/api/auth` 10/min, `/api/upload` 10/15min, `/api/ocr` 5/min.

## Server route files

| File                            | Responsibility                                     |
| ------------------------------- | -------------------------------------------------- |
| `server/routes/auth.ts`         | Signup, login, logout, refresh, Google OAuth, OTPs |
| `server/routes/workspace.ts`    | Workspace CRUD, membership, invites                |
| `server/routes/onboarding.ts`   | Teacher/student invite flows                       |
| `server/routes/lms.ts`          | Google Classroom OAuth + course/student import     |
| `server/routes/dynamic-sis.ts`  | Dynamic SIS bases, tables, fields, records, views  |
| `server/routes/ai-classroom.ts` | Study Arena classroom generation + job management  |
| `server/routes/grading.ts`      | AI-powered answer grading                          |
| `server/routes/live.ts`         | Daily.co room creation + participant tokens        |
| `server/routes/educator.ts`     | Educator-specific endpoints                        |
| `server/routes/parent.ts`       | Parent-specific endpoints                          |
| `server/routes/billing.ts`      | Stripe billing lifecycle and Customer Portal       |
| `server/routes/gdpr.ts`         | GDPR data export                                   |
| `server/routes/health.ts`       | Health check + readiness probe                     |
| `server/routes/analytics.ts`    | Domain router for analytics                        |
| `server/routes/tests.ts`        | Domain router for test generation/management       |
| `server/routes/users.ts`        | Domain router for user management                  |
| `server/routes/chat.ts`         | Domain router for chat endpoints                   |
| `server/routes/timetable.ts`    | Native period-based timetable                      |
| `server/message/routes.ts`      | MessagePal WebSocket + REST                        |

## Key client files

| File                                        | Responsibility                                                 |
| ------------------------------------------- | -------------------------------------------------------------- |
| `client/src/lib/quest-config.ts`            | Quest definitions (ids, labels, CTA paths, XP rewards)        |
| `client/src/hooks/use-quest-progress.ts`    | Quest state hook — localStorage read/write, expiry, confetti   |
| `client/src/components/quest/QuestPanel.tsx`| Slide-in quest panel (shown to new teachers)                   |
| `client/src/components/quest/QuestButton.tsx`| Floating "Get Started" trigger button                         |
| `client/src/components/quest/QuestItem.tsx` | Individual quest row with completion state                     |

## Key lib files

| File                                    | Responsibility                                     |
| --------------------------------------- | -------------------------------------------------- |
| `server/lib/pg-queries.ts`              | All PostgreSQL queries (primary data access layer) |
| `server/lib/pg-dynamic-sis.ts`          | Dynamic SIS PostgreSQL queries                     |
| `server/lib/auth-workspace.ts`          | JWT helpers, workspace permission checks           |
| `server/lib/google-signin.ts`           | Server-side Google OAuth 2.0 flow                  |
| `server/lib/gemini.ts`                  | Gemini 2.0 Flash wrapper                           |
| `server/lib/openai.ts`                  | OpenAI GPT-4o wrapper (fallback)                   |
| `server/lib/mailer.ts`                  | Nodemailer SMTP (invites, verification, reset)     |
| `server/lib/cassandra.ts`               | Cassandra/Astra DB client                          |
| `server/lib/cassandra-message-store.ts` | Message persistence (Cassandra → MongoDB fallback) |
| `server/lib/audit.ts`                   | Audit event recording                              |
| `server/lib/upload.ts`                  | Multer file upload handler                         |
| `server/lib/tesseract.ts`               | OCR processing                                     |
| `server/lib/rubricParser.ts`            | Grading rubric parsing                             |
| `server/lib/lms/googleClassroom.ts`     | Google Classroom API integration                   |

## Services

| File                                    | Responsibility                             |
| --------------------------------------- | ------------------------------------------ |
| `server/services/dynamic-enrichment.ts` | AI enrichment for SIS records              |
| `server/services/whatsapp.ts`           | WhatsApp outbound notifications            |
| `server/services/gradingService.ts`     | Gemini-powered grading engine              |
| `server/services/daily.ts`              | Daily.co room/token management             |
| `server/services/study-arena/`          | Study Arena orchestration + job management |

## Repo conventions

- Commit format: `<type>: <subject>` — types: `feat|fix|docs|style|refactor|test|chore` (see `.gitmessage`).
- ESLint uses `unused-imports` plugin (not the built-in TS rule). Use `npm run lint:fix` for auto-fix.
- Server uses singleton `storage` object (`server/storage.ts`). Mount new routes in `server/routes/*.ts` and register in `server/index.ts`.
- Use `@shared/schema` Zod schemas for API input validation; `@shared/mongo-schema` for DB operations.

## Deployment

- **Production**: GCP Cloud Run via Cloud Build (`cloudbuild.yaml`). Secrets from Secret Manager.
- **Docker**: Multi-stage (`deps → development → build → production`). See `docker-compose.yml`.
- **CI/CD**: `.github/workflows/cd.yml` builds the image on push to `main`, pushes to Artifact Registry, and deploys to Cloud Run.
- **Terraform**: `terraform-gcp/` manages Cloud Run service, IAM, and Secret Manager bindings.

## Gotchas

- `npm run dev` is a single process (`tsx server/index.ts`), not separate frontend/backend servers.
- Server sets global DNS to `8.8.8.8` and honors `DNS_IPV4_FIRST` env (IPv6 workaround).
- `SESSION_SECRET` must be set in production — server throws on startup if missing/weak.
- `.env.test` is gitignored. CI test env vars fall back to defaults in `vitest.config.ts`.
- `package.json` has `overrides` for `sucrase`, `@tootallnate/once`, `picomatch`.
- Prettier sorts Tailwind classes via `prettier-plugin-tailwindcss`.
- Google OAuth reuses the same OAuth Web client as Google Classroom. Both redirect URIs must be registered in GCP Console.
- Stripe billing routes return `503` until `STRIPE_SECRET_KEY` is a real `sk_live_`/`sk_test_` key.
