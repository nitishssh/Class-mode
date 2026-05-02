# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EduAI is an AI-powered school management platform (Nursery–Grade 12, CBSE/ICSE/IB/State boards). It combines AI tutoring, live classes, real-time messaging (MessagePal), OCR grading, and role-based dashboards in a monorepo.

## Commands

```bash
npm install          # install all dependencies
npm run dev          # start dev server (Vite frontend + Express backend on port 5001)
npm run build        # production build (Vite client → dist/public, esbuild server → dist/index.js)
npm start            # run production build (NODE_ENV=production node dist/index.js)
npm run check        # TypeScript type-checking (tsc --noEmit)
npm test             # run all tests (vitest run --root .)
npm run lint         # ESLint
npm run lint:fix     # ESLint with auto-fix
npm run format       # Prettier write
npm run format:check # Prettier check
```

Server tests live in `server/tests/` and use a separate vitest config at `server/vitest.config.ts` with `server/tests/setup.ts` as the setup file. The test environment expects `MONGODB_URL` pointing to a test database (see `.env.test`).

## Architecture

### Monorepo Layout

- **`client/`** — React 18 + Vite + TypeScript frontend. Uses wouter for routing, TanStack Query for data fetching, shadcn/ui + Tailwind CSS for UI, Framer Motion for animations.
- **`server/`** — Express + TypeScript backend. Single entry point at `server/index.ts` which wires up HTTP routes (`server/routes.ts`), two WebSocket servers (chat-ws and MessagePal), and connects to MongoDB/Cassandra.
- **`shared/`** — Zod schemas (`schema.ts`), Mongoose models (`mongo-schema.ts`), and Cassandra schemas (`cassandra-schema.ts`). Imported by both client and server via `@shared/*` alias.
- **`mobile/`** — React Native + Expo SDK 54 mobile app with Expo Router.
- **`features/ai-classroom/`** — Standalone AI classroom subsystem (ini_claw/nemoclaw orchestrator, studyArena).
- **`k8s/`, `terraform/`** — Kubernetes manifests and IaC.
- **`scripts/`** — Seed data, DB testing, and utility scripts.

### Path Aliases (in tsconfig.json and vite.config.ts)

- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`

### Backend Architecture

`server/index.ts` boots: Express app → MongoDB connection → Cassandra init → HTTP server → two WebSocket servers:

1. **Chat WS** (`server/chat-ws.ts`) — general real-time chat with AI Tutor integration, authenticates via Firebase ID token or session cookie at `ws://host/ws/chat?token=<token>`.
2. **MessagePal WS** (`server/message/index.ts`) — dedicated messaging system on a separate port (default 5002), with Cassandra-backed message storage (`server/message/cassandra-message-store.ts`).

Route registration is in `server/routes.ts` (main API) plus modular routers in `server/routes/` (health, live classes, ai-classroom, onboarding, openmaic).

Key server libraries in `server/lib/`: `firebase-admin.ts` (auth verification), `openai.ts` (AI tutor/evaluation), `gemini.ts` (Google AI), `cassandra.ts` (Cassandra client), `tesseract.ts` (OCR), `mailer.ts` (SMTP via nodemailer), `upload.ts` (multer file uploads), `logger.ts`.

### Frontend Architecture

`client/src/App.tsx` defines all routes and the sidebar layout. Context providers: `FirebaseAuthProvider` (auth state), `ThemeProvider` (dark/light), `ChatRoleContext`. Data fetching uses TanStack Query with Firebase token auto-attached in `client/src/lib/queryClient.ts`.

### Auth Flow

Firebase Authentication (Google + email/password) on the client. Backend verifies Firebase ID tokens via `server/lib/firebase-admin.ts`, falls back to JWT/session for backward compat. User records are in MongoDB (`MongoUser`). Roles: `student`, `teacher`, `parent`, `principal`, `school_admin`, `admin`.

### Data Layer

- **MongoDB** (primary) — users, tests, questions, workspaces, channels, tasks, live classes. Mongoose models in `shared/mongo-schema.ts`. Storage interface in `server/storage.ts`.
- **Apache Cassandra** (optional) — MessagePal chat history for scale. Schemas in `shared/cassandra-schema.ts`.
- Auto-incrementing IDs via `getNextSequenceValue()` from `shared/mongo-schema.ts`.

## Environment Variables

Required: `MONGODB_URL`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_SERVICE_ACCOUNT_JSON`.

Optional: `OPENAI_API_KEY` (AI features), `CASSANDRA_*` (MessagePal persistence), `SESSION_SECRET`, `CORS_ORIGIN`, `MESSAGEPAL_PORT` (default 5002).

## Conventions

- Commit format: `<type>: <subject>` (types: feat, fix, docs, style, refactor, test, chore)
- Validation: Zod schemas in `shared/` are the source of truth for both client and server
- Prettier: double quotes, semicolons, 2-space indent, 100 char width, trailing commas es5, tailwindcss plugin
- CI runs on PRs to main: type-check → build → test → Docker build verification
