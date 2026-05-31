<div align="center">

<img src="assets/generated-icon.png" alt="EduAI Logo" width="96" />

# EduAI — AI-Powered Multi-Tenant Learning Platform

**The complete school & business operating system.** AI tutoring, multi-tenant workspaces, live classes, real-time messaging, Google OAuth, LMS integrations, and role-based dashboards — all in one open-source platform.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.5.0-blue.svg)](docs/CHANGELOG.md)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-green.svg)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](Dockerfile)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg)](https://www.typescriptlang.org)

[**Docs**](docs/) · [**Report Bug**](https://github.com/StarkNitish/PersonalLearningPro/issues) · [**Request Feature**](https://github.com/StarkNitish/PersonalLearningPro/issues)

</div>

---

## ✨ Workspace-Based Multi-Tenancy

EduAI is a robust multi-tenant platform. Whether you're a school, a coaching center, or a business, you can create isolated **Workspaces** to manage your members, content, and collaboration securely.

---

## 🚀 Features at a Glance

### 🔐 Auth & Identity

- **Self-Hosted Identity**: PostgreSQL-backed auth — no Firebase dependency on the hot path.
- **Google OAuth**: Server-side OAuth 2.0 flow (`/api/auth/google/start` → callback) — works in all browsers, bypasses popup blockers and mobile in-app browser restrictions.
- **Secure Sessions**: Dual-token JWT + PostgreSQL session management with rotation.
- **Invitation System**: Onboard members and students via secure email invites.
- **RBAC**: Granular permissions (Owner, Admin, Member) per workspace.

### 🤖 AI-Powered Learning

- **AI Tutor**: Subject-aware chat tutor with markdown & LaTeX rendering.
- **Test Generation**: Auto-generate assessments from any topic or document.
- **Answer Evaluation**: AI-driven grading with detailed qualitative feedback.
- **Study Plan Generator**: Personalized weekly schedules based on performance.
- **Study Arena (AI Classroom)**: Real-time interactive lesson playback with whiteboard, TTS, Whisper ASR, and PBL support.
- **Persistent AI Jobs**: Redis-backed BullMQ integration for state-resilient AI tutor and whiteboard orchestration.

### 💳 Billing & Quota Management

- **Stripe Integration**: Complete billing lifecycle with checkout sessions and customer portal.
- **AI Quota Guard**: Tiered monthly usage limits (Free, Pro, Enterprise) for AI features.

### 💬 Real-Time Messaging — MessagePal

- ⚡ WebSocket-based live chat with typing indicators and read receipts.
- 🗄️ Scalable history persisted in **Apache Cassandra** (Astra DB), with MongoDB fallback.
- 🔐 Secure, session-verified communication.

### 🏫 LMS & SIS Integrations

- **Google Classroom**: OAuth-based connection to import courses and students.
- **Dynamic SIS**: Flexible, workspace-scoped student information system with custom bases, tables, fields, records, and views.
- **WhatsApp Notifications**: Outbound messaging via WhatsApp service integration.

### 📹 Live Classes

- **Daily.co Video**: Real-time video classes via `@daily-co/daily-react`.
- **Live Route**: `/api/live` manages room creation and participant tokens.

---

## 🛠️ Tech Stack

| Layer                          | Technology                                                    |
| ------------------------------ | ------------------------------------------------------------- |
| **Frontend**                   | React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui           |
| **Backend**                    | Node.js 18+, Express, TypeScript                              |
| **Primary DB (Transactional)** | **PostgreSQL** (Users, Workspaces, Sessions, Tests, SIS, Billing) |
| **Message Store**              | **Apache Cassandra** (Astra DB) · MongoDB fallback            |
| **Job Queue**                  | **Redis** (BullMQ) · AI Job persistence                       |
| **AI Engine**                  | **Google Gemini 2.0 Flash** · OpenAI GPT-4o (fallback)        |
| **Auth**                       | Local JWT + Cookies · Google OAuth 2.0 (server-side)          |
| **Real-time**                  | WebSockets (ws) · Daily.co (video)                            |
| **LMS**                        | Google Classroom API                                          |
| **Infrastructure**             | Docker, GCP Cloud Run, Cloud Build, Terraform, Secret Manager |

---

## ⚡ Quick Start

### 💻 Local Development

**Prerequisites:** Node.js ≥ 18, PostgreSQL, MongoDB (optional)

```bash
git clone https://github.com/StarkNitish/PersonalLearningPro.git
cd PersonalLearningPro
cp .env.example .env        # fill in your credentials
npm install
npm run dev
```

Open [http://localhost:5001](http://localhost:5001)

### 🔑 Required Environment Variables

```env
# PostgreSQL (Required)
DATABASE_URL=postgres://user:pass@localhost:5432/eduai_pg

# MongoDB (Optional — for legacy content storage)
MONGODB_URL=mongodb://localhost:27017/eduai

# Session & JWT (Required)
SESSION_SECRET=your-secret
JWT_SECRET=your-secret
REFRESH_SECRET=your-refresh-secret

# Gemini (Required for AI)
GOOGLE_API_KEY=your-gemini-key

# Google OAuth (Required for "Continue with Google")
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# SMTP (Required for invites and email verification)
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

See [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md) for the full variable reference.

---

## 👥 Workspace Roles

| Role          | Dashboard            | Capabilities                                   |
| ------------- | -------------------- | ---------------------------------------------- |
| 👑 **Owner**  | `/dashboard`         | Billing, Workspace Settings, Global Management |
| 🧑‍🏫 **Admin**  | `/dashboard`         | Invites, Member Management, Analytics          |
| 🎓 **Member** | `/student-dashboard` | AI Tutor, Tests, Chat, Personalized Plans      |

---

## 📚 Documentation

- **[Local Setup Guide](docs/LOCAL_SETUP.md)** - Get started in 5 minutes.
- **[Database Architecture](docs/DATABASE.md)** - Schema, indexes, and multi-DB strategy.
- **[Login Flow Design](docs/LOGIN_FLOW_SYSTEM_DESIGN.md)** - Detailed auth architecture including Google OAuth.
- **[Changelog](docs/CHANGELOG.md)** - Version history and v1.5.0 details.

---

<div align="center">

Made with ❤️ for learners everywhere · [⭐ Star this repo](https://github.com/StarkNitish/PersonalLearningPro) if it helped you!

</div>
