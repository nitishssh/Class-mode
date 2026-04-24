# 🤖 AGENTS.md

Welcome, AI agent! 🧠 This file provides the essential context and instructions you need to work effectively on **PersonalLearningPro**. 🎓

## 🚀 Build & Test

- **📦 Install Dependencies:** `npm install`
- **💻 Development Server:** `npm run dev` (Vite frontend + Express backend)
- **🧪 Run Tests:** `npm test` (Vitest)
- **🧹 Linting:** `npm run lint`
- **⚙️ Type Checking:** `npm run check`

## 📂 Project Structure

- `client/`: 🎨 React + Vite + Tailwind frontend.
- `server/`: 🖥️ Express backend with Firebase, Cassandra, and MongoDB integration.
- `shared/`: 🧩 Shared schemas and types.
- `.agent/`: 🛠️ Modular agent-specific context and workflows.
  - `spec/`: 📋 Requirements, designs, and tasks.
  - `prompts/`: 📜 Specialized workflows (e.g., `spec-workflow.md`).
  - `wiki/`: 📖 Architecture and deep-dive documentation.
  - `rules/`: ⚖️ Coding and behavioral policies.

## 🛠️ Workflow: Spec-First Development

We follow a structured **Spec -> Design -> Implementation** workflow. 🔄
For any non-trivial feature or bugfix, use the `spec-workflow` agent:

1. **🏁 Initialize:** Create a new spec directory in `.agent/spec/{feature-name}/`.
2. **📝 Draft:** Define requirements (`requirements.md`) and technical design (`design.md`).
3. **📅 Plan:** Break down into granular tasks (`tasks.md`).
4. **🚀 Execute:** Implement tasks one by one, updating status as you go.

Refer to `.agent/prompts/spec-workflow.md` for the full instruction set. 📜

## ⚖️ Coding Conventions

- **🎨 Frontend:** React (TypeScript), Tailwind CSS, Lucide icons, Shadcn UI components.
- **🖥️ Backend:** Express (TypeScript), Zod for validation, ESR (Error-Success-Response) patterns.
- **🧪 Testing:** Unit tests with Vitest, property-based tests with fast-check.
- **💾 Persistence:**
  - 🔥 Firebase Auth for authentication.
  - ⚡ Cassandra for message storage.
  - 🍃 MongoDB for structured application data.

## 🔐 Security & Secrets

- **🚫 NEVER** commit or log secrets, API keys, or `.env` files.
- **🛡️ Protect** `.git`, `.agent`, and other sensitive system folders.

---

_✨ This file is machine-readable and designed to be the primary entry point for AI context. ✨_
