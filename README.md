<div align="center">

<img src="assets/generated-icon.png" alt="ClassMode" width="96" />

# ClassMode — the school operating system

**Attendance, fees, and the evidence of who actually learned.** Multi-tenant
workspaces, AI tutoring and assessment, live classes, real-time messaging, and
role-based dashboards for schools and coaching centres.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.9.6.0-blue.svg)](CHANGELOG.md)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-green.svg)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](docker/Dockerfile)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg)](https://www.typescriptlang.org)

[**Docs**](docs/) · [**Report Bug**](https://github.com/NitishKumar-ai/Class-mode/issues) · [**Request Feature**](https://github.com/NitishKumar-ai/Class-mode/issues)

</div>

---

## One product, three surfaces

This repository is **ClassMode web** — the school operating system. It is one of
three codebases serving a single product:

| Surface                         | Repository                                                               | What it owns                                                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **ClassMode web** _(this repo)_ | `Class-mode`                                                             | Attendance, fees, billing, grading, auth, analytics, live classes, messaging, LMS and SIS integrations. Owns the API contract in `shared/`. |
| **ClassMode Studio**            | [`classmode-studio`](https://github.com/NitishKumar-ai/classmode-studio) | Authoring and running interactive AI lessons. Exposes the ClassMode AI v1 API that this app calls.                                          |
| **ClassMode Mobile**            | `classmode-mobile`                                                       | iOS + Android companion. One-tap teacher attendance, parent and principal views, fees.                                                      |

**Three contracts hold them together. Break one and the others fail quietly:**

1. **This app → Studio.** Lesson generation is delegated to ClassMode Studio over
   its `/api/v1` service contract (`server/routes/classmode-ai.ts`,
   `server/services/study-arena/generation.ts`). Configure
   `CLASSMODE_AI_BASE_URL` and `CLASSMODE_AI_SERVICE_SECRET`; the secret must match
   the value Studio is running with.
2. **This app → Mobile.** `shared/` (zod schemas, roles, authz constants) is the
   **single source of truth** for the API contract. The mobile app keeps a read-only
   copy in its `src/shared/`. Edit the contract _here_, then run `npm run sync-shared`
   in `classmode-mobile`. Its `check-shared-drift` fails the build when the two
   diverge.
3. **The palette is mirrored by hand** between this app's `client/src/index.css` and
   Studio's `app/globals.css`. Change one, change the other, and run
   `npm run check:design-tokens-drift` to find out when someone did not.

---

## Design system

The visual system is **Ruled Paper**. The canonical spec is `DESIGN.md` in the
**ClassMode Studio** repo — <https://github.com/NitishKumar-ai/classmode-studio>, or a
local sibling checkout (see `.classmode-studio-repo.example`). It governs this app and
Studio together: one system, two surfaces. **Read it before any visual or UI decision.**

Three rules are load-bearing, not preferences:

1. **Marigold `#f0a500` (`--energy`) means exactly one thing** in Studio: the lesson
   has stopped and the student owns the next move. Do not spend it on badges, charts,
   or decoration here.
2. **Terracotta `#cc785c` is the student's colour** — their answers, marks, progress.
   It is the _mark_, not the words: at body size it measures 3.15:1, so student answer
   text is set in ink with terracotta carrying the rule and label beside it.
3. **Registers are dense, not decorated.** Attendance and fees use row rules, sticky
   identifiers, and tabular numerals — never card mosaics.

> This pointer was broken for months, aimed at a path containing no `DESIGN.md`.
> Nobody here could read the spec they were told to follow, and the palette drifted:
> dark `--progress` and `--not-yet` both sat below the contrast floor, and
> `--verified` / `--overdue` were missing entirely, although the registers that need
> them live only in this repo. If this pointer breaks again, expect the same outcome.

---

## Features

### Auth & identity

- **Self-hosted identity** — PostgreSQL-backed auth, no Firebase on the hot path.
- **Google OAuth** — server-side OAuth 2.0 (`/api/auth/google/start` → callback), so it
  works in every browser and survives popup blockers and mobile in-app browsers.
- **Secure sessions** — dual-token JWT with PostgreSQL session management and rotation.
- **Invitations** — onboard members and students via secure email invites.
- **RBAC** — granular per-workspace permissions (Owner, Admin, Member).
- **Gamified onboarding** — new teachers get three activation quests (create a test, set
  up a class, invite a student). The panel auto-hides after 7 days or on completion, and
  never opens on the attendance or absentee screens so it cannot cover register controls.

### Admin & workspace management

- **Admin dashboard** — user and class management, reports, analytics, system settings,
  bulk actions, academic calendar, and permission tuning.
- **Pilot school seeding** — scripts that seed a complete environment (users, workspaces,
  channels, tests, tasks, live classes) for testing and demos.
- **SIS** — workspace-scoped student records, standards, and academic history.
- **Absentee call list** (`/absentees`) — the day's absent students grouped by class,
  with tap-to-call parent numbers and a printable view.
- **Data export** — attendance (`GET /api/export/attendance.csv`, optional date range)
  and fees (`GET /api/export/fees.csv`) as Excel-compatible CSV. Vernacular names render
  correctly and cells are hardened against formula injection.

### AI-powered learning

- **AI tutor** — subject-aware chat with markdown and LaTeX rendering.
- **Test generation** — assessments from any topic or document.
- **Answer evaluation** — grading with qualitative feedback.
- **Study plan generator** — weekly schedules based on performance.
- **Study Arena** — interactive lesson playback with whiteboard, TTS, and ASR.
  Generation is delegated to ClassMode Studio over the v1 API.
- **Persistent AI jobs** — Redis-backed BullMQ for state-resilient tutor and whiteboard
  orchestration.

### Billing & quota

- **Stripe** — full billing lifecycle with checkout sessions and the customer portal.
- **AI quota guard** — tiered monthly limits (Free, Pro, Enterprise).

### Real-time messaging — MessagePal

- WebSocket live chat with typing indicators and read receipts.
- History persisted in **Apache Cassandra** (Astra DB), with a MongoDB fallback.
- Session-verified on every connection.

### Integrations

- **Google Classroom** — OAuth connection to import courses and students.
- **Dynamic SIS** — workspace-scoped custom bases, tables, fields, records, and views.
- **WhatsApp notifications** — outbound parent messaging. **Automated messages are off by
  default:** `WHATSAPP_ALERTS_ENABLED=true` is required _in addition to_ Meta
  credentials, and it gates every automated path — absence alerts at marking time, the
  hourly at-risk nudge scheduler, and already-queued jobs at delivery time.

### Live classes

- **Daily.co video** via `@daily-co/daily-react`; `/api/live` manages rooms and tokens.

---

## Tech stack

| Layer                 | Technology                                                        |
| --------------------- | ----------------------------------------------------------------- |
| **Frontend**          | React 18, Vite 7, TypeScript 5.6, Tailwind CSS 3.4, shadcn/ui     |
| **Backend**           | Node.js 18+, Express 4, TypeScript                                |
| **Primary DB**        | **PostgreSQL** — users, workspaces, sessions, tests, SIS, billing |
| **Message store**     | **Apache Cassandra** (Astra DB) · MongoDB fallback                |
| **Job queue**         | **Redis** (BullMQ) — AI job persistence                           |
| **AI engines**        | **Sarvam** (primary) · Anthropic Claude · Google Gemini           |
| **Lesson generation** | Delegated to **ClassMode Studio** over its `/api/v1` contract     |
| **Auth**              | Local JWT + cookies · Google OAuth 2.0 (server-side)              |
| **Real-time**         | WebSockets (`ws`) · Daily.co (video)                              |
| **Payments**          | Stripe                                                            |
| **Infrastructure**    | Docker, GCP Cloud Run, Cloud Build, Terraform, Secret Manager     |

---

## Quick Start

**Prerequisites:** Node.js ≥ 18, Docker (for the local data layer).

```bash
git clone https://github.com/NitishKumar-ai/Class-mode.git
cd Class-mode
cp .env.example .env        # fill in your credentials
npm install
npm run db:up               # Postgres (5432) + Redis (6379) in the background
npm run migrate             # apply scripts/pg-schema.sql — idempotent
npm run dev                 # http://localhost:5001
```

| Service  | Image                    | Host port |
| -------- | ------------------------ | --------- |
| Postgres | `pgvector/pgvector:pg15` | `5432`    |
| Redis    | `redis:7-alpine`         | `6379`    |

Postgres ships as the **pgvector** image, so the `vector` extension is available for RAG
work (`CREATE EXTENSION IF NOT EXISTS vector;`). Credentials match `.env`: user
`classmode`, password `classmode`, database `classmode_dev`. Data persists in named
volumes across restarts.

```bash
npm run db:down    # stop the containers, keep the data
npm run db:reset   # wipe volumes and start fresh — drops all local data
```

### Commands

| Command                                    | What it does                                                 |
| ------------------------------------------ | ------------------------------------------------------------ |
| `npm run dev`                              | Dev server on port 5001                                      |
| `npm run check`                            | Type check                                                   |
| `npm run migrate`                          | Apply the DB schema — idempotent, safe on a drifted database |
| `npm test` · `npx playwright test`         | Unit and integration · E2E                                   |
| `npm run lint` · `npm run format`          | ESLint · Prettier                                            |
| `npm run check:design-tokens-drift`        | Compare the palette against ClassMode Studio                 |
| `npm run check:study-arena-drift`          | Compare the Study Arena contract against Studio              |
| `npm run metrics:weekly` · `report:weekly` | Adoption numbers, and persist a snapshot                     |

> **Always use `--dry-run` for metrics against a QA or local database.** A persisted
> snapshot joins the trend permanently, and afterwards there is no way to tell which rows
> produced it. The measurement rules are frozen and versioned in
> [`docs/METRIC-SEMANTICS.md`](docs/METRIC-SEMANTICS.md); changing one requires bumping
> `METRIC_VERSION`.

### Required environment variables

```env
# PostgreSQL (required) — prepend credentials as user:password@ before the host
POSTGRESQL_URL=postgres://localhost:5432/classmode_dev

# Session & JWT (required)
SESSION_SECRET=your-secret
JWT_SECRET=your-secret
REFRESH_SECRET=your-refresh-secret

# AI (required) — Sarvam is the primary provider
SARVAM_API_KEY=your-sarvam-key
GOOGLE_API_KEY=your-gemini-key

# ClassMode Studio (required for lesson generation)
CLASSMODE_AI_BASE_URL=http://localhost:3000
CLASSMODE_AI_SERVICE_SECRET=must-match-studio
CLASSMODE_AI_TIMEOUT_MS=15000

# Google OAuth (required for "Continue with Google")
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# SMTP (required for invites and email verification)
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

`SMTP_USER` and `SMTP_PASS` are genuinely required in production: without them the server
treats every send as a delivery failure rather than reporting success for a message it
never sent. Locally they are optional — mail falls back to a log-only transport that
prints verification codes to the console.

See [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md) for the full variable reference.

---

## Workspace roles

| Role          | Dashboard            | Capabilities                                   |
| ------------- | -------------------- | ---------------------------------------------- |
| 👑 **Owner**  | `/dashboard`         | Billing, workspace settings, global management |
| 🧑‍🏫 **Admin**  | `/dashboard`         | Invites, member management, analytics          |
| 🎓 **Member** | `/student-dashboard` | AI tutor, tests, chat, personalised plans      |

## Documentation

- **[Local setup](docs/LOCAL_SETUP.md)** — get started in 5 minutes
- **[Database architecture](docs/DATABASE.md)** — schema, indexes, multi-DB strategy
- **[Login flow design](docs/LOGIN_FLOW_SYSTEM_DESIGN.md)** — auth architecture including Google OAuth
- **[Metric semantics](docs/METRIC-SEMANTICS.md)** — frozen measurement rules
- **[Changelog](CHANGELOG.md)** — version history

## License

[MIT](LICENSE).
