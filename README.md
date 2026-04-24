<div align="center">

<img src="assets/generated-icon.png" alt="EduAI Logo" width="96" />

# EduAI — AI-Powered School Management Platform

**The complete school operating system.** AI tutoring, live classes, real-time messaging, OCR grading, and role-based dashboards — all in one open-source platform.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)](docs/CHANGELOG.md)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-green.svg)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](Dockerfile)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg)](https://www.typescriptlang.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](docs/CONTRIBUTING.md)

[**Live Demo**](https://eduai.app) · [**Docs**](docs/) · [**Report Bug**](https://github.com/StarkNitish/PersonalLearningPro/issues) · [**Request Feature**](https://github.com/StarkNitish/PersonalLearningPro/issues)

</div>

---

## 📽️ Demo

> **Video walkthrough coming soon** — star the repo to get notified.

<!-- Replace the src below with your actual demo GIF or video thumbnail + link -->
<div align="center">
  <a href="https://youtu.be/your-demo-link">
    <img src="https://img.shields.io/badge/▶_Watch_Demo-FF0000?style=for-the-badge&logo=youtube&logoColor=white" alt="Watch Demo" />
  </a>
</div>

| 🎓 Student Dashboard | 🧑‍🏫 Teacher Dashboard | 💬 MessagePal  |
| -------------------- | -------------------- | -------------- |
| _(screenshot)_       | _(screenshot)_       | _(screenshot)_ |

> Drop screenshots into `assets/screenshots/` and update the table above.

---

## ✨ What makes this different?

Most school platforms are either too simple or too expensive. EduAI is **open-source**, **AI-first**, and designed for the realities of modern schools — from Nursery to Grade 12, across CBSE, ICSE, IB, and State boards.

---

## 🚀 Features at a Glance

### 🤖 AI-Powered Learning

| Feature                  | What it does                                                        |
| ------------------------ | ------------------------------------------------------------------- |
| **AI Tutor**             | Subject-aware chat tutor with markdown & LaTeX math rendering       |
| **Test Generation**      | Auto-generate MCQ, short-answer, and essay questions from any topic |
| **Answer Evaluation**    | AI grades subjective answers with detailed feedback                 |
| **Performance Analysis** | Identifies weak topics and recommends resources per student         |
| **Study Plan Generator** | Builds a personalized weekly study schedule                         |

### 💬 Real-Time Messaging — MessagePal

- ⚡ WebSocket-based live chat with typing indicators and read receipts
- 🗄️ Message history persisted in **Apache Cassandra** for scale
- 📎 File & image attachments via `multer`
- 🔐 Firebase Auth token verified on every message
- 🌐 REST fallback API for history and uploads

### 🏫 School Management

- **👥 Role-Based Access** — Student, Teacher, Principal, School Admin, Platform Admin, Parent
- **🧭 Onboarding Wizard** — School setup → invite teachers → invite students, fully guided
- **📋 Test Management** — Create, distribute, auto-grade, and review tests
- **📷 OCR Scanning** — Digitize physical answer sheets via Tesseract.js
- **📂 Student Directory** — Browse and filter by grade (Nursery → Grade 12)
- **📊 Analytics Dashboard** — Class-wide and per-student performance charts
- **📅 Academic Calendar** — Schedule and track school events
- **🎯 Focus Mode** — Distraction-free study timer for students
- **🏆 Achievements** — XP, streaks, and badges to keep students motivated
- **🌓 Dark Mode** — Full dark/light theme with system preference detection

### 🎥 Live Classrooms

- Video sessions powered by **Daily.co** / **BigBlueButton**
- In-session chat panel, participant list, and screen sharing
- Session recording and replay support

### 📱 Mobile App (iOS & Android) - ✅ COMPLETE
- **Native mobile experience** built with React Native + Expo
- **Full feature parity** with web app
- **Offline support** with automatic sync when online
- **Push notifications** for messages, tests, and announcements
- **OCR scanning** with camera integration
- **Real-time messaging** with WebSocket support
- **Optimized performance** with FlatList and memoization
- **Dark mode ready** (coming soon)

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend (Web)** | React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion |
| **Frontend (Mobile)** | React Native 0.81, Expo SDK 54, TypeScript, NativeWind, React Native Paper |
| **Backend** | Node.js, Express, TypeScript |
| **Auth** | Firebase Authentication (Google + email/password) |
| **Primary DB** | MongoDB Atlas + Mongoose |
| **Message Store** | Apache Cassandra |
| **Mobile Storage** | AsyncStorage (offline caching) |
| **AI** | OpenAI GPT-4o |
| **OCR** | Tesseract.js (web), Expo Camera + backend OCR (mobile) |
| **Real-time** | WebSockets (ws) |
| **Push Notifications** | Expo Notifications |
| **Email** | Nodemailer (SMTP) |
| **Video** | Daily.co / BigBlueButton |
| **DevOps** | Docker, Kubernetes, Terraform, GitHub Actions |

---

## ⚡ Quick Start

### 🐳 Option 1: Docker (Recommended — no Node.js needed)

```bash
git clone https://github.com/StarkNitish/PersonalLearningPro.git
cd PersonalLearningPro
cp .env.example .env        # fill in your credentials
docker compose up
```

Open [http://localhost:5001](http://localhost:5001)

### 💻 Option 2: Local Development

**Prerequisites:** Node.js ≥ 18, MongoDB, (optional) Cassandra

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
# MongoDB (Required)
MONGODB_URL=mongodb+srv://...

# Firebase (Required for authentication)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_MEASUREMENT_ID=
FIREBASE_SERVICE_ACCOUNT_JSON=   # base64-encoded service account

# OpenAI (Required for AI features)
OPENAI_API_KEY=

# Email (Required for invite system)
SMTP_HOST=smtp.gmail.com
SMTP_USER=
SMTP_PASS=
APP_URL=http://localhost:5001

# Cassandra (Optional - for MessagePal chat history)
CASSANDRA_CONTACT_POINTS=
CASSANDRA_LOCAL_DATA_CENTER=
CASSANDRA_KEYSPACE=chat_db
CASSANDRA_USERNAME=
CASSANDRA_PASSWORD=

# Session (Auto-generated in dev, set in production)
SESSION_SECRET=your_random_session_secret

# Mobile App (mobile/.env)
EXPO_PUBLIC_API_URL=http://localhost:5001
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
```

See [`.env.example`](.env.example) and [`mobile/.env.example`](mobile/.env.example) for the full list.

---

## 🗺️ Onboarding Flow

```
Super Admin creates school account
         ↓
School Admin completes school setup wizard  →  /onboarding/school
         ↓
Admin invites teachers via email            →  /onboarding/invite-teachers
         ↓
Teachers accept invite → set password       →  /accept-invite?token=...
         ↓
Teachers create their classes               →  /onboarding/teacher
         ↓
Teachers invite students (or bulk CSV)      →  /onboarding/invite-students
         ↓
Students accept invite → enrolled           →  Dashboard ✅
```

Every role sees their onboarding wizard until their stage is complete — then lands directly on their dashboard.

---

## 👥 Role Dashboards

| Role                  | Dashboard                 | Key Capabilities                                            |
| --------------------- | ------------------------- | ----------------------------------------------------------- |
| 🎓 **Student**        | `/student-dashboard`      | AI Tutor, Tests, Progress, Achievements, Focus Mode         |
| 🧑‍🏫 **Teacher**        | `/dashboard`              | Create Tests, OCR Scan, Analytics, Live Classes, MessagePal |
| 🏫 **Principal**      | `/principal-dashboard`    | School-wide analytics, Student Directory, Staff overview    |
| 🔧 **School Admin**   | `/school-admin-dashboard` | School setup, Teacher/Student management, Reports           |
| ⚙️ **Platform Admin** | `/admin-dashboard`        | All-school oversight, User management                       |
| 👨‍👩‍👧 **Parent**         | `/parent-dashboard`       | Child progress, Teacher messages, Calendar                  |

---

## 📂 Project Structure

```
├── client/          # React + Vite frontend (web)
│   └── src/
│       ├── pages/       # Route-level page components
│       ├── components/  # Reusable UI components (shadcn/ui)
│       ├── contexts/    # React context providers (auth, theme, chat)
│       ├── hooks/       # Custom hooks
│       └── lib/         # API client, Firebase, utilities
├── mobile/          # React Native + Expo mobile app ✅ COMPLETE
│   ├── app/         # Expo Router pages (auth, tabs, modals)
│   ├── components/  # Mobile UI components
│   ├── lib/         # API client, Firebase, offline storage, notifications
│   ├── hooks/       # Custom hooks (network status, etc.)
│   └── types/       # TypeScript type definitions
├── server/          # Node.js + Express backend
│   ├── routes/      # Express route handlers
│   ├── lib/         # Firebase Admin, OpenAI, mailer, upload
│   ├── message/     # MessagePal WebSocket + Cassandra layer
│   ├── services/    # Business logic services
│   └── tests/       # Backend tests
├── shared/          # Zod schemas + Mongoose models (shared by web, mobile, server)
│   ├── schema.ts    # Main Zod schemas
│   ├── mongo-schema.ts  # Mongoose models
│   └── cassandra-schema.ts  # Cassandra schemas
├── .agent/          # AI agent context and workflows
│   ├── spec/        # Feature specifications
│   ├── prompts/     # Agent workflow templates
│   ├── wiki/        # Architecture documentation
│   └── rules/       # Coding policies
├── docs/            # Documentation
│   ├── DATABASE.md  # Complete database schema & best practices
│   ├── DATABASE_IMPROVEMENTS.md  # Recent performance optimizations
│   ├── LOCAL_SETUP.md  # Local development guide
│   └── CONTRIBUTING.md  # Contribution guidelines
├── k8s/             # Kubernetes manifests
├── terraform/       # Infrastructure as Code
└── scripts/         # Seed scripts, CI utilities
```

---

## 📚 Documentation

- **[Local Setup Guide](docs/LOCAL_SETUP.md)** - Get started in 5 minutes (web + mobile)
- **[Mobile App README](mobile/README.md)** - Mobile-specific setup and features
- **[Mobile Migration Status](MOBILE_MIGRATION_STATUS.md)** - Mobile app completion status (100%)
- **[Database Architecture](docs/DATABASE.md)** - Schema, indexes, and best practices
- **[Database Improvements](docs/DATABASE_IMPROVEMENTS.md)** - Recent performance optimizations
- **[Contributing Guide](docs/CONTRIBUTING.md)** - How to contribute
- **[API Reference](docs/)** - REST API documentation
- **[Changelog](docs/CHANGELOG.md)** - Version history
- **[Agent Instructions](AGENTS.md)** - For AI coding agents

---

## 🧪 Development Commands

### Web App
```bash
npm run dev          # Start frontend + backend (Vite + Express on port 5001)
npm run check        # TypeScript type check
npm test             # Run Vitest test suite
npm run lint         # ESLint
npm run lint:fix     # ESLint with auto-fix
npm run format       # Prettier format
npm run format:check # Prettier check
npm run build        # Production build
npm start            # Run production build
```

### Mobile App
```bash
cd mobile
npm start            # Start Expo development server
npm run android      # Run on Android
npm run ios          # Run on iOS
npm run web          # Run on web
npm run type-check   # TypeScript type check
```

---

## 🤝 Contributing

Contributions from humans and AI agents are welcome! 🌍

1. Fork the repo
2. Create a branch: `git checkout -b feature/your-feature`
3. Sign the CLA on your first PR (one-time, automated)
4. Commit: `git commit -m "feat: your feature"`
5. Push & open a Pull Request

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for full guidelines, coding conventions, and the spec-first development workflow.

**Using an AI agent?** Initialize your `.agent` workspace and follow the `AGENTS.md` format for structured spec → design → implementation workflows.

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">

Made with ❤️ for schools everywhere · [⭐ Star this repo](https://github.com/StarkNitish/PersonalLearningPro) if it helped you!

</div>
