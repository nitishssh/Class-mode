# Architecture

## High-Level Overview

```
User (Browser / Mobile App)
        │
        ▼
┌─────────────────┐     ┌──────────────┐
│  Nginx (Proxy)  │────▶│  Express App  │
└─────────────────┘     │  (Port 5001)  │
        │               └──────┬───────┘
        │                      │
        ▼                      ▼
┌──────────────┐      ┌───────────────┐
│  Vite Dev    │      │  WebSocket    │
│  (Dev only)  │      │  /ws/chat     │
└──────────────┘      │  MessagePal   │
                      │  (Port 5002)  │
                      └──────┬────────┘
                             │
                             ▼
┌─────────────┬──────────────┬──────────────┐
│  MongoDB    │  Cassandra   │  Firebase    │
│  (Mongoose) │  (Astra DB)  │  (Auth)      │
└─────────────┴──────────────┴──────────────┘
```

## Layer Breakdown

### Client Layer (`client/`)
- React 18 + Vite SPA with wouter routing
- TanStack Query for server state
- Firebase Auth for authentication
- Tailwind CSS + shadcn/ui for UI
- Framer Motion for animations
- Recharts for analytics dashboards

### Mobile Layer (`mobile/`)
- React Native 0.81 + Expo SDK 54
- Expo Router (file-based routing)
- NativeWind (Tailwind for RN) + React Native Paper
- Shared API client with web app
- AsyncStorage for offline caching
- Expo Notifications for push

### Server Layer (`server/`)
- Express.js with modular route registration (`routes.ts`)
- Middleware stack: Helmet → CORS → Rate Limit → Session → Logger → DB Health → Routes → Error Handler
- Auth via Firebase Admin SDK (primary) + JWT (legacy)
- DAO pattern via `IStorage` interface (`MongoStorage` implementation)
- WebSocket chat on `/ws/chat` and separate MessagePal port (5002)

### Shared Layer (`shared/`)
- Zod schemas (`schema.ts`) for validation across all layers
- Mongoose models (`mongo-schema.ts`) for MongoDB
- Cassandra schemas (`cassandra-schema.ts`)
- Domain-specific schemas (`grading-schema.ts`, `onboarding-schema.ts`, `study-arena.ts`)

### Microservices (`services/`)
- **OpenMAIC** — Next.js AI classroom service (port 3000)
- **IniClaw** — Agent runtime gateway (port 4000)

## Database Strategy
- **MongoDB** — primary store for structured data (users, tests, analytics, etc.)
- **Cassandra** — high-volume message storage (MessagePal), falls back to MongoDB if unavailable
- **Firebase Auth** — authentication only (user profiles still in MongoDB)

## AI Integration
- **Primary:** OpenAI GPT-4o (tutor, grading, test gen, study plans, analysis)
- **Fallback:** Google Gemini 2.0 Flash
- **Orchestration:** LangChain + LangGraph (Study Arena)
- **Prompt templates:** `server/lib/prompts/`

## Deployment
- **Dev:** `docker compose up` (full stack: app, MongoDB, Cassandra, Redis, nginx)
- **Staging:** GHCR → SSH → docker-compose
- **Production:** GCP Cloud Run + Secret Manager
- **K8s:** manifests in `k8s/` with NGINX ingress + cert-manager TLS
