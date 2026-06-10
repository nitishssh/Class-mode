# Getting Started

<cite>
**Referenced Files in This Document**
- [README.md](file://README.md)
- [LOCAL_SETUP.md](file://LOCAL_SETUP.md)
- [.env.example](file://.env.example)
- [Dockerfile](file://Dockerfile)
- [docker-compose.yml](file://docker-compose.yml)
- [package.json](file://package.json)
- [server/index.ts](file://server/index.ts)
- [server/db.ts](file://server/db.ts)
- [server/storage.ts](file://server/storage.ts)
- [vite.config.ts](file://vite.config.ts)
- [client/src/env.d.ts](file://client/src/env.d.ts)
- [client/src/config.ts](file://client/src/config.ts)
- [client/src/contexts/firebase-auth-context.tsx](file://client/src/contexts/firebase-auth-context.tsx)
- [client/src/components/auth/firebase-auth-dialog.tsx](file://client/src/components/auth/firebase-auth-dialog.tsx)
- [client/src/lib/firebase.ts](file://client/src/lib/firebase.ts)
- [server/routes.ts](file://server/routes.ts)
</cite>

## Table of Contents

1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction

PersonalLearningPro is an AI-powered personalized learning platform with integrated chat, test creation, OCR scanning, analytics, and role-based access control. This guide helps you install, configure, and run the project quickly using either Docker (recommended) or a manual setup with Node.js and local databases.

Key highlights:

- Single development port 5001 serving both API and frontend
- Multi-provider AI features (Gemini, Anthropic, DeepSeek, Qwen, OpenRouter, OpenAI, etc.)
- Mandatory local PostgreSQL-backed multi-tenant workspace authentication system
- Hybrid data storage using PostgreSQL (auth/tenancy), MongoDB (content/assessments), and optional Cassandra/Astra DB for messaging
- **Gamified Onboarding**: Integrated quest system to guide new teachers through workspace activation.
- **Pilot Seeding**: Instant environment setup for demonstrations and testing via `server/scripts/seed-pilot.ts`.

## Project Structure

High-level structure relevant to setup and operation:

- Frontend (React + Vite): client/
- Backend (Express): server/
- Shared code: shared/
- Docker and Compose: Dockerfile, docker-compose.yml
- Environment variables: .env, .env.example
- Scripts and tooling: package.json, vite.config.ts

```mermaid
graph TB
subgraph "Application"
FE["client/ (React + Vite)"]
BE["server/ (Express)"]
SH["shared/ (schemas, types)"]
end
subgraph "Runtime"
CFG["vite.config.ts"]
ENV[".env / .env.example"]
DK["Dockerfile"]
DC["docker-compose.yml"]
end
FE --> CFG
BE --> ENV
BE --> SH
DK --> BE
DK --> FE
DC --> DK
```

**Diagram sources**

- [Dockerfile](file://Dockerfile#L1-L58)
- [docker-compose.yml](file://docker-compose.yml#L1-L24)
- [vite.config.ts](file://vite.config.ts#L1-L35)
- [server/index.ts](file://server/index.ts#L1-L114)

**Section sources**

- [README.md](file://README.md#L70-L102)
- [Dockerfile](file://Dockerfile#L1-L58)
- [docker-compose.yml](file://docker-compose.yml#L1-L24)
- [vite.config.ts](file://vite.config.ts#L1-L35)

## Core Components

- Backend server: Express app with JWT session middleware, static uploads, WebSocket support, and hybrid storage (PostgreSQL + MongoDB + optional Cassandra/Astra DB)
- Frontend: React SPA served by Vite in development; built assets served in production
- Environment configuration: .env and .env.example define required and optional integrations
- Docker: Multi-stage build with development and production targets

What you need installed:

- Docker (recommended) or Node.js v18+ with npm
- PostgreSQL (mandatory for identity & tenancy) and MongoDB for data persistence (manual setup)
- Optional: OpenAI, Gemini, and other LLM API keys for AI capabilities; Cassandra/Astra DB secure connect bundle for real-time messaging

**Section sources**

- [README.md](file://README.md#L21-L51)
- [LOCAL_SETUP.md](file://LOCAL_SETUP.md#L5-L12)
- [server/index.ts](file://server/index.ts#L1-L114)
- [server/db.ts](file://server/db.ts#L1-L21)
- [server/storage.ts](file://server/storage.ts#L1-L519)
- [.env.example](file://.env.example#L1-L36)
- [Dockerfile](file://Dockerfile#L1-L58)

## Architecture Overview

The application runs on a single port (5001) in development and production. The backend serves:

- REST API routes
- Static frontend assets (in production)
- WebSocket endpoints for real-time chat
- Optional MessagePal HTTP server

```mermaid
graph TB
Browser["Browser (port 5001)"]
subgraph "Server"
Express["Express App<br/>server/index.ts"]
Routes["Routes<br/>server/routes.ts"]
Storage["Storage (PostgreSQL + MongoDB + optional Cassandra)<br/>server/storage.ts"]
DB_PG["PostgreSQL Connection<br/>server/db-pg.ts"]
DB_Mongo["MongoDB Connection<br/>server/db.ts"]
WS["WebSocket Servers<br/>chat-ws.ts, messagepal/index.ts"]
end
Browser --> Express
Express --> Routes
Express --> Storage
Storage --> DB_PG
Storage --> DB_Mongo
Express --> WS
```

**Diagram sources**

- [server/index.ts](file://server/index.ts#L1-L114)
- [server/routes.ts](file://server/routes.ts#L1-L800)
- [server/storage.ts](file://server/storage.ts#L1-L519)
- [server/db.ts](file://server/db.ts#L1-L21)

## Detailed Component Analysis

### Installation & Deployment Methods

#### Option 1: Docker (Recommended for Local)

- Prerequisites: Docker Engine
- Steps: Build and start with `docker compose up`
- Access: http://localhost:5001

#### Option 2: Google Cloud Platform (Recommended for Production)

- Prerequisites: GCP Account, `gcloud` CLI
- Steps: Use the provided Terraform and Cloud Build automation
- Guide: See [GCP Deployment Guide](docs/GCP_DEPLOYMENT.md)

#### Option 3: Manual Setup (Node.js)

- Prerequisites: Node.js v18+, npm
- Steps: `npm install` and `npm run dev`

### Environment Configuration (.env and .env.example)

- Copy the example to .env and configure the required settings:
  - PostgreSQL: `POSTGRESQL_URL` (mandatory for auth/tenancy)
  - MongoDB: `MONGODB_URL` (mandatory for content/assessments)
  - JWT: `JWT_SECRET` (required to sign cookies/tokens)
  - Session: `SESSION_SECRET` (required in production)
  - OpenAI/Gemini: `OPENAI_API_KEY`, `GOOGLE_API_KEY`, etc. (optional, enables AI features)
  - Cassandra/Astra DB: `ASTRA_DB_*` (optional, for scalable message store)
- Notes:
  - Without PostgreSQL, the application will fail to start.
  - Without LLM API keys, Study Arena generation and AI tutoring features are disabled.

**Section sources**

- [.env.example](file://.env.example#L1-L36)
- [README.md](file://README.md#L53-L69)

### Ports and Services

- Port 5001 is used for both development and production
  - API endpoints
  - Frontend (Vite in dev, built assets in prod)
  - WebSocket servers
- Docker Compose exposes port 5001 from the container to the host

**Section sources**

- [server/index.ts](file://server/index.ts#L103-L112)
- [docker-compose.yml](file://docker-compose.yml#L6-L7)
- [README.md](file://README.md#L35-L35)

### Initial Setup Verification

After starting the app:

- Visit http://localhost:5001
- Expected behavior:
  - Application loads and displays the local authentication dialog.
  - Users can register as a new teacher (creating a new workspace) or log in.
  - If PostgreSQL and MongoDB are running properly, features like dashboards, tests, chat, and analytics become fully functional.

**Section sources**

- [README.md](file://README.md#L35-L35)
- [LOCAL_SETUP.md](file://LOCAL_SETUP.md#L72-L82)

### Authentication and First-Time User Setup

- **Local Self-Hosted Identity**: Authentication is backed by PostgreSQL, using bcrypt for password hashing and JWT cookies for session security.
- **Tenant Workspace Creation**: First-time users register (e.g., as a Teacher) and automatically initialize a new Workspace of which they become the Owner.
- **Gamified Onboarding (Quests)**: Upon first login, new teachers are presented with a "Get Started" quest panel. This system tracks key activation milestones:
  1. **Create a Test**: Guides the user through the AI test generation or manual creation flow.
  2. **Set up a Class**: Encourages organizing students into classes.
  3. **Invite a Student**: Onboards the first member to the workspace.
  Completion of these quests triggers a celebratory confetti effect and ensures the workspace is fully functional.
- **Invite-Only Students**: Students are onboarded via workspace-specific invite links (`/api/workspaces/:id/invites`) which generate unique tokenized signup links.

```mermaid
sequenceDiagram
participant U as "User"
participant FE as "Frontend (React)"
participant API as "Backend Routes"
participant PG as "PostgreSQL Database"
U->>FE : Open app (not logged in)
FE->>FE : Redirect/Show local login/signup dialog
U->>FE : Fill out email, password, and name
FE->>API : POST /api/auth/signup {email, password, name}
API->>PG : Create User, Workspace, and WorkspaceMembership (Owner)
PG-->>API : Success
API->>API : Sign JWT access_token & generate refresh_token
API-->>FE : Return profile info & set HTTP cookies
FE-->>U : Redirect to '/' dashboard
```

**Diagram sources**

- [client/src/contexts/firebase-auth-context.tsx](file://client/src/contexts/firebase-auth-context.tsx#L43-L78)
- [client/src/components/auth/firebase-auth-dialog.tsx](file://client/src/components/auth/firebase-auth-dialog.tsx#L1-L276)
- [client/src/lib/firebase.ts](file://client/src/lib/firebase.ts#L80-L177)
- [server/routes.ts](file://server/routes.ts#L13-L85)

**Section sources**

- [client/src/contexts/firebase-auth-context.tsx](file://client/src/contexts/firebase-auth-context.tsx#L43-L78)
- [client/src/components/auth/firebase-auth-dialog.tsx](file://client/src/components/auth/firebase-auth-dialog.tsx#L1-L276)
- [client/src/lib/firebase.ts](file://client/src/lib/firebase.ts#L80-L177)
- [server/routes.ts](file://server/routes.ts#L13-L85)

### Data Storage and Dependencies

- **PostgreSQL**: Mandatory transactional database for identity, workspace tenancy, audits, and invites.
- **MongoDB**: Used for tests, questions, test attempts, answer submissions, and focus/learning sessions.
- **Cassandra (Optional)**: Partitioned high-throughput message store for chat. If unconfigured, messages fall back to MongoDB.

```mermaid
classDiagram
class PGStorage {
+connectPostgres()
+pgFindUserById(id)
+pgFindFirstWorkspaceMembership(userId)
+pgCreateWorkspaceInvite(invite)
}
class MongoStorage {
+getTest(id)
+createTestAttempt(attempt)
+createAnswer(answer)
}
class Cassandra {
+client
+createMessage(msg)
+getMessagesByChannel(channelId)
}
MongoStorage --> Cassandra : "optional fallback"
```

**Diagram sources**

- [server/storage.ts](file://server/storage.ts#L110-L519)
- [server/db.ts](file://server/db.ts#L1-L21)

**Section sources**

- [server/storage.ts](file://server/storage.ts#L1-L519)
- [server/db.ts](file://server/db.ts#L1-L21)
- [LOCAL_SETUP.md](file://LOCAL_SETUP.md#L10-L11)

## Dependency Analysis

- Node.js and npm are required for manual setup
- Docker simplifies dependency isolation and avoids local database setup
- Frontend and backend share aliases and build configuration via Vite

```mermaid
graph LR
Pkg["package.json scripts"] --> Dev["npm run dev"]
Pkg --> Build["npm run build"]
Pkg --> Start["npm run start"]
Vite["vite.config.ts"] --> FE["client/"]
FE --> Aliases["@, @shared, @assets"]
Docker["Dockerfile"] --> Node["node:20-slim"]
Docker --> App["App code"]
Compose["docker-compose.yml"] --> Port["5001:5001"]
```

**Diagram sources**

- [package.json](file://package.json#L6-L11)
- [vite.config.ts](file://vite.config.ts#L1-L35)
- [Dockerfile](file://Dockerfile#L1-L58)
- [docker-compose.yml](file://docker-compose.yml#L1-L24)

**Section sources**

- [package.json](file://package.json#L6-L11)
- [vite.config.ts](file://vite.config.ts#L1-L35)
- [Dockerfile](file://Dockerfile#L1-L58)
- [docker-compose.yml](file://docker-compose.yml#L1-L24)

## Performance Considerations

- Development uses hot module replacement and bind-mounted source directories for fast iteration
- Production builds optimize frontend assets and runs a single Node.js process
- WebSocket servers enable real-time chat; ensure adequate memory for concurrent connections

[No sources needed since this section provides general guidance]

## Troubleshooting Guide

Common issues and resolutions:

- Port 5001 in use
  - Change the port in the server entry point and update Docker Compose if needed
- Firebase authentication not working
  - Ensure Google authentication is enabled in Firebase
  - Verify all VITE*FIREBASE*\* variables are set
  - Confirm the API key format and spelling
- Environment variables not loading
  - Ensure .env is at the project root
  - Restart the development server after edits
- npm install failures
  - Clean install by removing node_modules and package-lock.json, then reinstall
- Database connection errors
  - Verify PostgreSQL and MongoDB are running
  - Check connection strings for correctness and credentials

**Section sources**

- [LOCAL_SETUP.md](file://LOCAL_SETUP.md#L112-L136)

## Conclusion

You can get PersonalLearningPro running quickly with Docker or manually with Node.js. Configure .env for optional integrations, ensure databases are available, and access the app at http://localhost:501. Authentication and first-time user flows are handled via Firebase when configured, while the backend remains functional without it.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Quick Start Examples

- Docker
  - Build and run: docker compose build; docker compose up
  - Access: http://localhost:5001
- Manual
  - Install dependencies: npm install
  - Start development: npm run dev
  - Access: http://localhost:5001

**Section sources**

- [README.md](file://README.md#L23-L49)
- [docker-compose.yml](file://docker-compose.yml#L1-L24)
- [package.json](file://package.json#L6-L11)

### System Requirements and Supported Operating Systems

- Recommended: Docker (cross-platform)
- Manual setup: Node.js v18+ on Linux/macOS/Windows
- Databases: PostgreSQL and MongoDB (manual setup)
- Hardware: Sufficient RAM for Node.js processes and database instances; Docker resources can be tuned via Compose

**Section sources**

- [README.md](file://README.md#L23-L49)
- [LOCAL_SETUP.md](file://LOCAL_SETUP.md#L5-L12)
