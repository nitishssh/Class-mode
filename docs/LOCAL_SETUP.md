# Master Plan — Local Development Setup

This guide walks through setting up the project locally **without Docker**. For the quickest setup, see the [Docker instructions in README.md](README.md#-quick-start).

## Prerequisites

- **Node.js** v18 or later
- **npm** (comes with Node.js)
- **Git**
- **PostgreSQL** (for structured data)
- **MongoDB** (for analytics data)

## 1. Clone the Repository

```bash
git clone https://github.com/StarkNitish/PersonalLearningPro.git
cd PersonalLearningPro
```

## 2. Install Dependencies

```bash
npm install
```

## 3. Environment Variables

Create a `.env` file by copying the example:

```bash
cp .env.example .env
```

Then edit `.env` and fill in your values:

```env
# Firebase (optional — app runs without it, auth disabled)
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
VITE_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
VITE_FIREBASE_MEASUREMENT_ID=your_firebase_measurement_id

# Databases
DATABASE_URL=postgresql://user:password@localhost:5432/personal_learning_pro
MONGODB_URI=mongodb://localhost:27017/personal_learning_pro

# OpenAI (optional — AI features disabled without it)
OPENAI_API_KEY=your_openai_api_key

# Session secret (optional — auto-generated in dev, set in production)
SESSION_SECRET=your_random_session_secret
```

### Obtaining Credentials

#### Firebase

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use an existing one
3. Add a new **Web** application
4. Enable **Google** as a Sign-in method under **Authentication → Sign-in method**
5. Copy the config values into your `.env` file

#### Databases

1. **PostgreSQL**: Install locally or use a managed service like [Neon](https://neon.tech/). Provide the connection string in `DATABASE_URL`.
2. **MongoDB**: Install locally or use [MongoDB Atlas](https://www.mongodb.com/cloud/atlas). Provide the connection string in `MONGODB_URI`.

#### OpenAI

1. Go to the [OpenAI API platform](https://platform.openai.com/)
2. Create an API key and add it to `OPENAI_API_KEY` in your `.env`

## 4. Start the Development Server

```bash
npm run dev
```

This starts a single Express server that serves both the API and the Vite-powered React frontend.

The application will be available at: **[http://localhost:5001](http://localhost:5001)**

> **Note:** Both the frontend and backend run on port 5001 — there is no separate Vite dev server.

## 5. Available Scripts

| Command         | Description                            |
| --------------- | -------------------------------------- |
| `npm run dev`   | Start the full app in development mode |
| `npm run build` | Build for production (client + server) |
| `npm run start` | Run the production build               |
| `npm run check` | Type-check TypeScript                  |

## Project Structure

```
client/src/     → React frontend code
server/         → Express backend code
shared/         → Shared types and schema
```

| Directory                | Description                              |
| ------------------------ | ---------------------------------------- |
| `client/src/components/` | React UI components (shadcn/ui based)    |
| `client/src/contexts/`   | React context providers (auth, theme)    |
| `client/src/pages/`      | Page-level components                    |
| `client/src/lib/`        | Utilities, Firebase config, API helpers  |
| `server/lib/`            | Server utilities (OpenAI integration)    |
| `server/routes.ts`       | All API route definitions                |
| `server/storage.ts`      | Hybrid data storage (Postgres + MongoDB) |
| `shared/schema.ts`       | Zod schema and type definitions          |

## Troubleshooting

### Port 5001 in use

Change the port in `server/index.ts` (line with `const port = 5001`).

### Firebase authentication not working

- Ensure you've enabled **Google Authentication** in your Firebase project settings
- Verify all `VITE_FIREBASE_*` variables are set in `.env`
- The API key must start with `AIza` — double-check for typos

### Environment variables not loading

- Confirm `.env` is in the **project root** (not inside `client/` or `server/`)
- Restart the dev server after changing `.env`

### npm install fails

Try a clean install:

```bash
rm -rf node_modules package-lock.json
npm install
```

### Database connection errors

- Verify that PostgreSQL and MongoDB are running locally or that your remote connection strings are correct.
- Double-check the usernames, passwords, and database names in your connection strings.
