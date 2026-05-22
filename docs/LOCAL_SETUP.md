# Local Development Setup Guide

This guide walks through setting up the project locally **without Docker**. For the quickest setup, see the [Docker instructions in README.md](../README.md#-quick-start).

## Prerequisites

- **Node.js** v18 or later
- **npm** (comes with Node.js)
- **Git**
- **PostgreSQL** (Mandatory for core identity and workspaces)
- **MongoDB** (Required for assessment data)
- **Apache Cassandra** (optional - for MessagePal chat history)

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

### PostgreSQL (Transactional Store)
1. Create a database named `eduai_pg`.
2. Provide the connection string in your `.env` as `DATABASE_URL`.
3. Run the schema script: `psql -d eduai_pg -f scripts/pg-schema.sql`.

### MongoDB (Assessment Store)
1. Install locally or use MongoDB Atlas.
2. Provide the connection string as `MONGODB_URL`.

## 4. Environment Variables

Create a `.env` file:

```bash
cp .env.example .env
```

Required variables for local development:

```env
# PostgreSQL (Required)
DATABASE_URL=postgres://user:pass@localhost:5432/eduai_pg

# MongoDB (Required)
MONGODB_URL=mongodb://localhost:27017/eduai

# Session secrets (Required)
SESSION_SECRET=your-session-secret
JWT_SECRET=your-jwt-secret

# Gemini (Required for AI features)
GOOGLE_API_KEY=your-gemini-key

# SMTP (Required for invites and verification)
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

## 5. Start the Development Server

```bash
npm run dev
```

The application will be available at: **[http://localhost:5001](http://localhost:5001)**

> **Note:** Access and Refresh tokens are delivered via HttpOnly cookies. Ensure your browser allows cookies for localhost.

## Project Structure

| Directory                | Description                                       |
| ------------------------ | ------------------------------------------------- |
| `client/src/`            | React frontend (Vite)                             |
| `server/routes/auth.ts`  | Local and Workspace Auth logic                    |
| `server/lib/pg-queries.ts`| PostgreSQL data access layer                      |
| `server/storage.ts`      | Legacy/MongoDB storage abstraction                |
| `scripts/pg-schema.sql`  | PostgreSQL database schema                        |

## Troubleshooting

### PostgreSQL Connection Errors
Verify that your `DATABASE_URL` is correct and the PostgreSQL service is running. Use `psql -l` to check if your database exists.

### Invitation Emails Not Sending
Ensure your SMTP settings in `.env` are valid. If using Gmail, you must use an **App Password**.

### Cookies Not Setting
If you are testing on `127.0.0.1` instead of `localhost`, some browsers may block HttpOnly cookies. Use `localhost:5001` consistently.
