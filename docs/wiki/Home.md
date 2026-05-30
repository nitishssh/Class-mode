# EduAI Platform — Wiki

Welcome to the EduAI (PersonalLearningPro) platform wiki. This wiki covers architecture, features, and operational guidance for the v1.5+ codebase.

## Table of Contents

1. [Authentication & Onboarding](Authentication.md)
2. [Study Arena (Classroom Engine)](StudyArena.md)
3. [IniClaw (AI Gateway & Integrations)](IniClaw.md)
4. [Messaging & Live Classes](Messaging.md)
5. [Database & Storage Layer](Storage.md)

## Platform Summary (v1.5)

EduAI is a multi-tenant AI-powered learning platform built on:

- **Backend**: Node.js 18 + Express + TypeScript, single process (`tsx server/index.ts`)
- **Frontend**: React 18 + Vite + Tailwind CSS + shadcn/ui + wouter
- **Primary DB**: PostgreSQL (all transactional data — users, workspaces, sessions, tests, SIS)
- **AI**: Google Gemini 2.0 Flash (primary) + OpenAI GPT-4o (fallback)
- **Auth**: Self-hosted JWT + cookies + Google OAuth 2.0 (server-side)
- **Real-time**: WebSockets (chat + MessagePal) + Daily.co (video)
- **Deployment**: GCP Cloud Run via Cloud Build CI/CD

## Key Architectural Decisions

- **No Firebase on the hot path** — Auth is fully self-hosted. Firebase compat endpoint exists for backward compatibility only (`ENABLE_FIREBASE_AUTH_COMPAT`).
- **PostgreSQL as the single source of truth** — MongoDB is optional (legacy). All new features use PostgreSQL.
- **Server-side Google OAuth** — Avoids all browser popup/redirect issues. Same OAuth client reused for Google Classroom.
- **Dynamic SIS** — Flexible student information system built on PostgreSQL with JSONB fields, no separate NoSQL store needed.
- **Gemini-first AI** — All AI features (tutoring, grading, study plans, classroom generation) use Gemini 2.0 Flash. OpenAI is a fallback only.
