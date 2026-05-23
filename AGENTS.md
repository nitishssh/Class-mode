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
- `server/` — Express (entry: `server/index.ts`, routes: `server/routes.ts`)
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

- **Auth**: Firebase Client (browser) → exchange for server JWT (cookie). Dual fallback: JWT verify → session lookup.
- **DB**: MongoDB (mongoose, primary). Cassandra (MessagePal only, optional — falls back to MongoDB).
- **AI**: Google Gemini (`server/lib/gemini.ts`) primary; OpenAI GPT-4o (`server/lib/openai.ts`) optional fallback.
- **Real-time**: Two WebSocket servers (chat + MessagePal) attached to HTTP server after `registerRoutes()`.
- **Routing**: `wouter` (not react-router). Pages in `client/src/pages/`.
- **Validation**: Zod schemas in `shared/schema.ts`. Mongoose models in `shared/mongo-schema.ts`.
- **Rate limiting**: `/api/ai` 20/min, `/api/auth` 10/min, `/api/upload` 10/15min, `/api/ocr` 5/min.

## Repo conventions

- Commit format: `<type>: <subject>` — types: `feat|fix|docs|style|refactor|test|chore` (see `.gitmessage`).
- ESLint uses `unused-imports` plugin (not the built-in TS rule). Use `npm run lint:fix` for auto-fix.
- Server uses singleton `storage` object (`server/storage.ts`). Mount new routes in `server/routes.ts` `registerRoutes()`.
- Use `@shared/schema` Zod schemas for API input validation; `@shared/mongo-schema` for DB operations.

## Deployment

- **Production**: GCP Cloud Run via Cloud Build (`cloudbuild.yaml`). Secrets from Secret Manager.
- **Docker**: Multi-stage (`deps → development → build → production`). See `docker-compose.yml`.
- **CI/CD**: `.github/workflows/cd.yml` builds the image on push to `main`, pushes to Artifact Registry, and deploys to Cloud Run. Firebase (Firestore + Auth) is used for data/auth only — not for hosting.

## Gotchas

- `npm run dev` is a single process (`tsx server/index.ts`), not separate frontend/backend servers.
- Server sets global DNS to `8.8.8.8` and honors `DNS_IPV4_FIRST` env (IPv6 workaround).
- `SESSION_SECRET` must be set in production — server throws on startup if missing/weak.
- `.env.test` is gitignored. CI test env vars fall back to defaults in `vitest.config.ts`.
- `package.json` has `overrides` for `sucrase`, `@tootallnate/once`, `picomatch`.
- Prettier sorts Tailwind classes via `prettier-plugin-tailwindcss`.
