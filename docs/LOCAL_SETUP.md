# Local Development Setup Guide

This guide walks through setting up the project locally **without Docker**. For the quickest setup, see the [Docker instructions in README.md](../README.md#-quick-start).

## Prerequisites

- **Node.js** v18 or later
- **npm** (comes with Node.js)
- **Git**
- **PostgreSQL** (Required — primary data store)
- **MongoDB** (Optional — legacy content only)
- **Apache Cassandra** (Optional — MessagePal chat history; falls back to MongoDB)

## 1. Clone the Repository

```bash
git clone https://github.com/StarkNitish/PersonalLearningPro.git
cd PersonalLearningPro
```

## 2. Install Dependencies

```bash
npm install
```

## 3. Database Initialization

### PostgreSQL (Required)

1. Create a database named `eduai_pg` (or any name you prefer).
2. Provide the connection string in your `.env` as `POSTGRESQL_URL`.
3. Run the schema script:

```bash
psql -d eduai_pg -f scripts/pg-schema.sql
```

All DDL is idempotent — safe to re-run.

### MongoDB (Optional)

1. Install locally or use MongoDB Atlas.
2. Provide the connection string as `MONGODB_URL` in `.env`.
3. If omitted, the server starts without MongoDB (legacy test features will be unavailable).

## 4. Environment Variables

```bash
cp .env.example .env
```

### Required Variables

```env
# PostgreSQL
POSTGRESQL_URL=postgres://user:pass@localhost:5432/eduai_pg

# Session & JWT secrets (generate with: openssl rand -hex 32)
SESSION_SECRET=your-session-secret
JWT_SECRET=your-jwt-secret
REFRESH_SECRET=your-refresh-secret

# Gemini (primary AI provider)
GOOGLE_API_KEY=your-gemini-key
```

### Required for Email Features (Invites, Verification, Password Reset)

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=EduAI <no-reply@yourdomain.com>
```

> If using Gmail, generate an **App Password** at myaccount.google.com/apppasswords.

### Required for Google OAuth ("Continue with Google")

```env
GOOGLE_CLIENT_ID=your-oauth-client-id
GOOGLE_CLIENT_SECRET=your-oauth-client-secret
```

Register redirect URIs in GCP Console:

- `http://localhost:5001/api/auth/google/callback` (local)
- `https://<your-prod-host>/api/auth/google/callback` (production)

### Optional Variables

```env
# MongoDB (legacy content)
MONGODB_URL=mongodb://localhost:27017/eduai

# OpenAI (fallback AI provider)
OPENAI_API_KEY=your-openai-key

# Google Classroom LMS integration
GOOGLE_CLASSROOM_CLIENT_ID=
GOOGLE_CLASSROOM_CLIENT_SECRET=
GOOGLE_CLASSROOM_REDIRECT_URI=http://localhost:5001/api/lms/google/callback

# Daily.co video calls
DAILY_API_KEY=

# Stripe billing (routes return 503 until a real key is set)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Cassandra / Astra DB (MessagePal — falls back to MongoDB)
ASTRA_DB_SECURE_BUNDLE_PATH=./config/secure-connect-chat-db.zip
ASTRA_DB_APPLICATION_TOKEN=
ASTRA_DB_KEYSPACE=chat

# IniClaw AI gateway (Study Arena)
INICLAW_GATEWAY_URL=http://localhost:7070
BRIDGE_SECRET=
USE_INICLAW=false

# Firebase compat (backward compat only)
ENABLE_FIREBASE_AUTH_COMPAT=true

# WhatsApp Business Cloud API (outbound messaging; without creds, sends are
# simulated in dev/test and fail loud in production)
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=
# ALL automated WhatsApp to parents is OFF unless this is "true" —
# credentials alone never enable it. Gates absence alerts at marking time,
# the hourly at-risk nudge scheduler, and queued jobs at delivery time.
WHATSAPP_ALERTS_ENABLED=false
```

## 5. Start the Development Server

```bash
npm run dev
```

The application will be available at: **[http://localhost:5001](http://localhost:5001)**

> Access and Refresh tokens are delivered via HttpOnly cookies. Use `localhost:5001` (not `127.0.0.1`) to avoid cookie issues.

## 6. Seeding Pilot Data (Optional)

For demonstration or testing, you can seed a complete institutional environment:

```bash
npx tsx server/scripts/seed-pilot.ts
```

This creates:

- An admin user (`nitish_admin` / `PilotPassword123!`)
- A workspace ("Pilot Headquarters")
- A general chat channel
- Sample tests, tasks, and notifications
- Scheduled live classes and focus sessions

## Project Structure

| Directory                     | Description                               |
| ----------------------------- | ----------------------------------------- |
| `client/src/`                 | React frontend (Vite)                     |
| `server/routes/auth.ts`       | Auth routes (login, signup, Google OAuth) |
| `server/routes/workspace.ts`  | Workspace CRUD and membership             |
| `server/lib/pg-queries.ts`    | PostgreSQL data access layer              |
| `server/lib/google-signin.ts` | Server-side Google OAuth 2.0 flow         |
| `server/storage.ts`           | Legacy/MongoDB storage abstraction        |
| `scripts/pg-schema.sql`       | PostgreSQL database schema                |

## Useful Commands

```bash
npm run dev          # Start dev server (port 5001)
npm run check        # TypeScript type check
npm test             # Run tests (vitest)
npm run lint         # ESLint
npm run lint:fix     # ESLint with auto-fix
npm run format       # Prettier
npm run build        # Production build
npm run metrics:weekly  # Compute weekly adoption metrics
npm run report:weekly   # Weekly metrics in report form
```

## Troubleshooting

### PostgreSQL Connection Errors

Verify `POSTGRESQL_URL` is correct and PostgreSQL is running. Use `psql -l` to list databases.

### Invitation Emails Not Sending

Ensure SMTP settings are valid. Gmail requires an **App Password**, not your account password.

### Cookies Not Setting

Use `localhost:5001` consistently — some browsers block HttpOnly cookies on `127.0.0.1`.

### Google OAuth Not Working

Ensure both redirect URIs are registered in GCP Console under your OAuth 2.0 Web client. The same client is used for both Google Sign-In and Google Classroom.

### AI Features Not Working

Set `GOOGLE_API_KEY` with a valid Gemini API key from [aistudio.google.com](https://aistudio.google.com/app/apikey).
