<div align="center">

<img src="assets/generated-icon.png" alt="EduAI Logo" width="96" />

# EduAI — AI-Powered Multi-Tenant Learning Platform

**The complete school & business operating system.** AI tutoring, multi-tenant workspaces, live classes, real-time messaging, and role-based dashboards — all in one open-source platform.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.4.0-blue.svg)](docs/CHANGELOG.md)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-green.svg)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](Dockerfile)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg)](https://www.typescriptlang.org)

[**Docs**](docs/) · [**Report Bug**](https://github.com/StarkNitish/PersonalLearningPro/issues) · [**Request Feature**](https://github.com/StarkNitish/PersonalLearningPro/issues)

</div>

---

## ✨ Workspace-Based Multi-Tenancy

EduAI has evolved into a robust multi-tenant platform. Whether you're a school, a coaching center, or a business, you can create isolated **Workspaces** to manage your members, content, and collaboration securely.

---

## 🚀 Features at a Glance

### 🔐 Local & Workspace Auth

- **Self-Hosted Identity**: No external dependency on Firebase for the hot path.
- **Secure Sessions**: Dual-token JWT + PostgreSQL session management with rotation.
- **Invitation System**: Onboard members and students via secure email invites.
- **RBAC**: Granular permissions (Owner, Admin, Member) per workspace.

### 🤖 AI-Powered Learning

- **AI Tutor**: Subject-aware chat tutor with markdown & LaTeX rendering.
- **Test Generation**: Auto-generate assessments from any topic or document.
- **Answer Evaluation**: AI-driven grading with detailed qualitative feedback.
- **Study Plan Generator**: Personalized weekly schedules based on performance.

### 💬 Real-Time Messaging — MessagePal

- ⚡ WebSocket-based live chat with typing indicators and read receipts.
- 🗄️ Scalable history persisted in **Apache Cassandra**.
- 🔐 Secure, session-verified communication.

---

## 🛠️ Tech Stack

| Layer                          | Technology                                          |
| ------------------------------ | --------------------------------------------------- |
| **Frontend**                   | React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui |
| **Backend**                    | Node.js, Express, TypeScript                        |
| **Primary DB (Transactional)** | **PostgreSQL** (Users, Workspaces, Sessions)        |
| **Specialized DB (Content)**   | **MongoDB Atlas** (Tests, Questions, Analytics)     |
| **Message Store**              | **Apache Cassandra** (Astra DB)                     |
| **AI Engine**                  | **Google Gemini 2.0 Flash** · OpenAI GPT-4o         |
| **Real-time**                  | WebSockets (ws)                                     |
| **Infrastructure**             | Docker, GCP Cloud Run, Cloud Build, Terraform       |

---

## ⚡ Quick Start

### 💻 Local Development

**Prerequisites:** Node.js ≥ 18, PostgreSQL, MongoDB

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

# MongoDB (Required)
MONGODB_URL=mongodb://localhost:27017/eduai

# Session & JWT (Required)
SESSION_SECRET=your-secret
JWT_SECRET=your-secret

# Gemini (Required for AI)
GOOGLE_API_KEY=your-gemini-key
```

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
- **[Login Flow Design](docs/LOGIN_FLOW_SYSTEM_DESIGN.md)** - Detailed auth architecture.
- **[Changelog](docs/CHANGELOG.md)** - Version history and v1.4.0 details.

---

<div align="center">

Made with ❤️ for learners everywhere · [⭐ Star this repo](https://github.com/StarkNitish/PersonalLearningPro) if it helped you!

</div>
