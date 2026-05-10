# 🤖 AGENTS.md

Welcome, AI agent! 🧠 This file provides the essential context and instructions you need to work effectively on **PersonalLearningPro (EduAI)**. 🎓

## 🚀 Build & Test

### Web App

- **📦 Install Dependencies:** `npm install`
- **💻 Development Server:** `npm run dev` (Vite frontend + Express backend on port 5001)
- **🧪 Run Tests:** `npm test` (Vitest)
- **🧹 Linting:** `npm run lint` (ESLint)
- **🎨 Format:** `npm run format` (Prettier)
- **⚙️ Type Checking:** `npm run check` (TypeScript)
- **🏗️ Build:** `npm run build` (Production build)
- **🚀 Start Production:** `npm start`

### Mobile App (React Native + Expo) - ✅ COMPLETE

- **📦 Install Dependencies:** `cd mobile && npm install`
- **📱 Start Expo:** `npm start` (then press 'i' for iOS or 'a' for Android)
- **🤖 Android:** `npm run android`
- **🍎 iOS:** `npm run ios`
- **🌐 Web:** `npm run web`
- **⚙️ Type Check:** `npm run type-check`
- **📖 Status:** See `MOBILE_MIGRATION_STATUS.md` for completion details

## 📂 Project Structure

- `client/`: 🎨 React + Vite + Tailwind frontend (web)
  - `src/pages/`: Route-level page components
  - `src/components/`: Reusable UI components (shadcn/ui)
  - `src/contexts/`: React context providers (auth, theme, chat)
  - `src/hooks/`: Custom React hooks
  - `src/lib/`: API client, Firebase, utilities
- `mobile/`: 📱 React Native + Expo mobile app (iOS/Android) - **✅ COMPLETE (100%)**
  - `app/`: Expo Router pages (auth, tabs, modals)
  - `components/`: Reusable mobile components
  - `lib/`: API client, Firebase, offline storage, notifications
  - `hooks/`: Custom hooks (network status, etc.)
  - Features: Auth, AI Tutor, Tasks, Messages, Tests, Analytics, OCR, Push Notifications, Offline Support
- `server/`: 🖥️ Express backend with Firebase, Cassandra, and MongoDB
  - `routes/`: API route handlers
  - `lib/`: Firebase Admin, OpenAI, mailer, upload
  - `message/`: MessagePal WebSocket + Cassandra layer
  - `services/`: Business logic services
- `shared/`: 🧩 Shared schemas and types (Zod + Mongoose)
  - `schema.ts`: Main Zod schemas
  - `mongo-schema.ts`: Mongoose models
  - `cassandra-schema.ts`: Cassandra schemas
- `.agent/`: 🛠️ Modular agent-specific context and workflows
  - `core/`: 🧠 Core cognition, identity, principles, and workflows
  - `hooks/`: 🪝 Deterministic lifecycle automation (e.g., PreCommit, SessionStart)
  - `agents/`: 🤖 Specialized subagents (e.g., frontend-engineer, security-auditor)
  - `skills/`: ⚡ Auto-loadable capabilities (e.g., react-system, database-design)
  - `commands/`: ⌨️ Slash-style reusable commands (e.g., ship, refactor, generate-tests)
  - `rules/`: ⚖️ Hard constraints and scoped coding policies
  - `memory/`: 💾 Long-term contextual storage (decisions, architecture, roadmap)
  - `plugins/`: 🔌 Packaged external integrations
  - `templates/`: 📝 Reusable scaffolds for PRDs, RFCs, etc.
  - `datasets/`: 📊 Structured local knowledge
  - `evals/`: 🧪 Agent evaluation framework and benchmarks
  - `output-styles/`: 🎨 Response formatting modes
  - `orchestration/`: 🎼 Multi-agent coordination (planner, swarm)
  - `telemetry/`: 📈 Runtime logging and analytics
- `docs/`: 📚 Documentation
  - `DATABASE.md`: Database schema and best practices
  - `LOCAL_SETUP.md`: Local development guide
  - `CONTRIBUTING.md`: Contribution guidelines
- `k8s/`: ☸️ Kubernetes manifests
- `terraform/`: 🏗️ Infrastructure as Code
- `scripts/`: 🔧 Utility scripts (seed data, testing)

## 🛠️ Workflow: Spec-First Development

We follow a structured **Spec -> Design -> Implementation** workflow. 🔄
For any non-trivial feature or bugfix, use the `planner` orchestration agent:

1. **🏁 Initialize:** Create a new feature directory in `.agent/memory/roadmap/{feature-name}/`.
2. **📝 Draft:** Define requirements (`requirements.md`) and technical design (`design.md`) using `templates/prd.md`.
3. **📅 Plan:** Break down into granular tasks (`tasks.md`).
4. **🚀 Execute:** Implement tasks one by one, updating status as you go.

Refer to `.agent/orchestration/planner.md` for the full instruction set. 📜

## ⚖️ Coding Conventions

- **🎨 Frontend (Web):** React 18 (TypeScript), Tailwind CSS, Lucide icons, Shadcn UI components, Framer Motion
- **📱 Frontend (Mobile):** React Native 0.81 (TypeScript), NativeWind, Expo Router, React Native Paper, Expo SDK 54
- **🖥️ Backend:** Express (TypeScript), Zod for validation, ESR (Error-Success-Response) patterns
- **🧪 Testing:** Unit tests with Vitest, property-based tests with fast-check
- **🎨 Code Style:** ESLint + Prettier configured, run `npm run lint` and `npm run format`
- **💾 Persistence:**
  - 🔥 Firebase Auth for authentication (web + mobile)
  - ⚡ Cassandra for message storage (MessagePal)
  - 🍃 MongoDB for structured application data
  - 📱 AsyncStorage for mobile offline caching
- **🔄 Real-time:** WebSockets (ws) for MessagePal chat
- **🤖 AI Integration:** OpenAI GPT-4o for AI Tutor, test generation, grading
- **📸 OCR:** Tesseract.js (web), Expo Camera + backend OCR (mobile)

## 🔐 Security & Secrets

- **🚫 NEVER** commit or log secrets, API keys, or `.env` files.
- **🛡️ Protect** `.git`, `.agent`, and other sensitive system folders.

---

_✨ This file is machine-readable and designed to be the primary entry point for AI context. ✨_
