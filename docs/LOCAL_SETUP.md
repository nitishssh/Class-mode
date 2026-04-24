# Local Development Setup Guide

This guide walks through setting up the project locally **without Docker**. For the quickest setup, see the [Docker instructions in README.md](../README.md#-quick-start).

## Prerequisites

- **Node.js** v18 or later
- **npm** (comes with Node.js)
- **Git**
- **MongoDB** (for structured application data)
- **Apache Cassandra** (optional - for MessagePal chat history)
- **Expo CLI** (for mobile development): `npm install -g expo-cli`

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
1. **MongoDB**: Install locally or use [MongoDB Atlas](https://www.mongodb.com/cloud/atlas). Provide the connection string in `MONGODB_URL`.
2. **Cassandra** (optional): For MessagePal chat history. Install locally or use DataStax Astra. The app works without it (chat history disabled).

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

### Web App
| Command | Description |
|---------|-------------|
| `npm run dev` | Start the full app in development mode (port 5001) |
| `npm run build` | Build for production (client + server) |
| `npm run start` | Run the production build |
| `npm run check` | Type-check TypeScript |
| `npm test` | Run Vitest test suite |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |

### Mobile App
| Command | Description |
|---------|-------------|
| `cd mobile && npm start` | Start Expo development server |
| `cd mobile && npm run android` | Run on Android |
| `cd mobile && npm run ios` | Run on iOS |
| `cd mobile && npm run type-check` | Type-check TypeScript |

## 6. Mobile App Setup (Optional)

If you want to develop the mobile app:

1. **Navigate to mobile directory:**
   ```bash
   cd mobile
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

4. **Update mobile `.env`** with the same Firebase credentials and API URL

5. **Start Expo:**
   ```bash
   npm start
   ```

6. **Run on device:**
   - Press `i` for iOS simulator (macOS only)
   - Press `a` for Android emulator
   - Scan QR code with Expo Go app on physical device

See [mobile/README.md](../mobile/README.md) for detailed mobile setup instructions.

## Project Structure

```
client/src/     → React frontend code (web)
mobile/         → React Native mobile app
server/         → Express backend code
shared/         → Shared types and schemas
```

| Directory | Description |
|-----------|-------------|
| `client/src/components/` | React UI components (shadcn/ui based) |
| `client/src/contexts/` | React context providers (auth, theme, chat) |
| `client/src/pages/` | Page-level components |
| `client/src/lib/` | Utilities, Firebase config, API helpers |
| `mobile/app/` | Expo Router pages (auth, tabs, modals) |
| `mobile/components/` | Mobile UI components |
| `mobile/lib/` | Mobile utilities, API client, offline storage |
| `server/lib/` | Server utilities (OpenAI, Firebase Admin, mailer) |
| `server/routes.ts` | All API route definitions |
| `server/storage.ts` | Data storage (MongoDB + Cassandra) |
| `shared/schema.ts` | Zod schema and type definitions |
| `shared/mongo-schema.ts` | Mongoose models |

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
- Verify that MongoDB is running locally or that your remote connection string is correct
- Double-check the username, password, and database name in your connection string
- For Cassandra (optional): Ensure it's running if you want MessagePal chat history

### Mobile app not connecting to backend
- If testing on a physical device, use your computer's local IP instead of `localhost`
- Example: `EXPO_PUBLIC_API_URL=http://192.168.1.100:5001`
- Ensure your firewall allows connections on port 5001
