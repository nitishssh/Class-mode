# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.0] - 2026-05-09

### Changed

- **IniClaw rewritten as lightweight LLM proxy** — Replaced the NVIDIA NemoClaw / OpenShell sandbox runtime with a pure Node.js HTTP proxy (`features/ai-classroom/ini_claw/gateway.js`). Zero npm dependencies; uses only Node.js built-in modules. Deleted: `bin/` (nemoclaw CLI), `docs/` (Sphinx), `nemoclaw-blueprint/` (Python orchestration), `nemoclaw/` (compiled TS dist), `scripts/`, `Dockerfile` (old NVIDIA-based). Added: minimal `Dockerfile` for the new gateway, updated `policies/study-arena.yaml` (removed NVIDIA hosts, kept only OpenAI/Gemini/Anthropic).
- **IniClaw gateway LLM routing** — New gateway calls LLM providers directly (Gemini → OpenAI → Anthropic fallback chain) instead of shelling out to `openshell sandbox exec`. Keeps concurrency semaphore, body size limits, rotating audit log, CORS, and Bearer auth.
- **`authenticateToken` middleware** — Now sets `(req as any).user = { id, role, email }` in addition to `req.session`. Fixes `billing.ts`, `gdpr.ts`, `educator.ts`, `parent.ts`, and `grading.ts` routes which read `req.user.id` but previously received `undefined`, causing silent 401s on all authenticated billing/GDPR requests.
- **`archiver` v8 compatibility** (`server/routes/gdpr.ts`) — v8 removed the factory-function API (`archiver("zip")`) in favour of named classes. Fixed: `import archiver from "archiver"` → `createRequire` + `new ZipArchive()`. GDPR data export now works correctly.

### Fixed

- **Email validation on registration** (`POST /api/auth/register`) — Added RFC-style email regex check. Previously, strings like `"notanemail"` were accepted and stored; now returns `400 Invalid email address`.
- **`study-arena-integration.test.ts`** — `StudyArenaClient` import was broken (module didn't exist). Created `server/services/study-arena-client.ts` wrapping the `/api/ai-classroom/*` routes. Replaced silent `if (!client) return` guard with `describe.skipIf(!isConfigured)`.
- **`ai_classroom.test.ts`** — Mock targeted `study-arena-client` (unused by the route); route uses `studyArenaInternalService` directly. Replaced mock target, fixed poll URL (`/job/` → `/status/`), fixed `my-classrooms` response shape assertion (`res.body` → `res.body.classrooms`).
- **`microservices-integration.test.ts`** — `INICLAW_URL` renamed to `INICLAW_GATEWAY_URL` to match rest of codebase.
- **`gateway.test.js`** — Server was not closed after tests, leaving port 17071 occupied on re-runs. Exported `server` from `gateway.js`; added `after(() => server.close())`.
- **`smoke-test.sh`** — Removed check for `openshell: command not found` error (no longer applicable). Updated test route from `/agent` (deleted) to `/tutor/chat`.
- **`scripts/setup-openmaic.sh`** and **`docs/OPENMAIC_INTEGRATION.md`** — Updated manual IniClaw start command from `npm run dev:gateway` (in external `arena-learning` repo) to `BRIDGE_SECRET=<secret> INICLAW_PORT=7070 node gateway.js` (in `features/ai-classroom/ini_claw/`).

### Added

- **`server/services/study-arena-client.ts`** — HTTP client that wraps the native `/api/ai-classroom/*` routes. Used by integration tests.
- **`features/ai-classroom/ini_claw/Dockerfile`** — Minimal Alpine-based image for the new lightweight gateway (`node gateway.js`, exposes 7070).

## [1.2.0] - 2026-05-09

### Added

- **GCP Cloud Run deployment live** — Service running at `https://personallearningpro-wuo7arhpla-uc.a.run.app` (project `plp-prod-2026`, region `us-central1`).
- **Secret Manager** — 13 secrets provisioned and bound to the Cloud Run compute SA: `MONGODB_URL`, `GOOGLE_API_KEY`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `SESSION_SECRET`, `JWT_SECRET`, `REFRESH_SECRET`, `STRIPE_SECRET_KEY`, `OPENAI_API_KEY`, `DAILY_API_KEY`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `BRIDGE_SECRET`.
- **Cloud Build CI/CD pipeline** — `cloudbuild.yaml` triggers image build → Artifact Registry push → Cloud Run deploy on every `main` push.

### Changed

- **AI provider: Vertex AI → Gemini** — Removed `@google-cloud/vertexai` and `@anthropic-ai/vertex-sdk`. All AI features (study plans, tutor, classroom generation, answer evaluation) now use `@google/generative-ai` (Gemini 2.0 Flash) exclusively via `GOOGLE_API_KEY`. OpenAI remains an optional fallback for non-grading paths.
- **Grading engine: OpenAI GPT-4o → Gemini 2.0 Flash** — `gradingService.ts` migrated to `geminiChat()` with JSON mode (`responseMimeType: application/json`). Essay few-shot examples are now appended to the system prompt.
- **Stripe: disabled until configured** — Billing routes (`/checkout`, `/portal`, `/webhook`) return `503 Billing not yet configured` when `STRIPE_SECRET_KEY` is not a real `sk_live_`/`sk_test_` key. Routes auto-activate when a valid key is set in Secret Manager. Replaced broken CommonJS `require("stripe")` with conditional ESM `import`.
- **Cloud Run resource limits** — Memory upgraded from default 256Mi to **1Gi**, CPU from 1 to **2**. Min instances set to **1** (eliminates cold starts).
- **CORS** — `*.run.app` added to the production origin allowlist in `server/index.ts`. `CORS_ORIGIN` env var includes both Cloud Run URL variants so Vite's `crossorigin` asset tags resolve correctly.

### Fixed

- **`cloudbuild.yaml` deploy step** — Added `--platform managed`, `--port 5001`, `--allow-unauthenticated` to `gcloud run deploy`; without these the build hung and health checks failed on port 8080.
- **MongoDB URL** — Added `/eduai?retryWrites=true&w=majority` database path to the Atlas connection string stored in Secret Manager; bare SRV URIs caused `bad auth: authentication failed`.
- **`server/routes/gdpr.ts`** — Removed duplicate `import { Request }` that caused a TypeScript unused-import error during build.
- **Blank white page** — Static assets (JS/CSS) were returning `500 application/json` because Vite's `crossorigin` attributes caused browsers to send `Origin` on every asset fetch, which the CORS middleware rejected. Fixed by adding `*.run.app` to the allowlist and updating `CORS_ORIGIN`.

### Added

- **AI Classroom Features**: Enhanced classroom player with interactive quizzes, keyboard navigation, PBL (Project-Based Learning) support, and real-time SSE progress tracking.
- **Job Management**: Implemented job cancellation via API and UI, including AbortSignal support during classroom generation.
- **Whiteboard Integrations**: Added whiteboard clear/erase actions, limited ledger size, and incorporated UI controls for managing whiteboard state.
- **API Enhancements**: Added endpoints for deleting classrooms, cancelling jobs, and pagination support for classroom listings.

### Fixed

- **Memory Management**: Added maximum buffer size to the orchestrator chunk parser and limited whiteboard ledger size to prevent OOM errors.
- **Generation Pipeline**: Implemented parallel scene generation, LLM timeouts, and HTML sanitization for stability.
- **Background Tasks**: Implemented job cleanup and staleness tracking in the StudyArena service.
- **Security & Authorization**: Fixed classroom access authorization and enforced authentication checks on the `my-classrooms` route.

### Changed

- **Caching**: Implemented in-memory caching for study arena prompts and snippets.

## [1.1.0] - 2026-02-20

### Added

- **Dockerization**: Comprehensive Docker setup including `Dockerfile`, `docker-compose.yml`, and `.dockerignore` for easier environment setup and containerized deployment.
- **Project Documentation**: Added `CONTRIBUTING.md`, `LOCAL_SETUP.md`, `CLA.md`, and `CODE_OF_CONDUCT.md` to prepare for open-source contributions.
- **Environment Management**: Improved handling of environment variables with documented optional dependencies for Firebase and OpenAI.

### Fixed

- **Tailwind CSS Integration**: Resolved issues with `@tailwind` and `@apply` directives in `index.css`.
- **TypeScript Compliance**: Fixed numerous TypeScript errors across the codebase, particularly in `ocr-upload.tsx`, `create-test.tsx`, and `routes.ts`.
- **Frontend Hygiene**: Removed redundant layout components (`Sidebar`, `Header`, `MobileNav`) from individual pages now covered by `AppLayout`.

### Changed

- **UI Refinement**: Established a cohesive design system with updated color palettes, typography, and enhanced dark mode support.
- **Code Structure**: Refactored various frontend components and backend logic for better modularity and stability.
- **Dependencies**: Updated numerous library versions for better compatibility and security.

## [1.0.0] - 2026-02-17

### Added

- Initial release of the AI-Powered Personalized Learning Platform.
- Core features: AI Tutor, AI Test Generation, OCR Test Scanning, and Performance Analytics.
