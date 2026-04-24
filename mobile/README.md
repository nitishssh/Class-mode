# PersonalLearningPro Mobile

React Native mobile application for PersonalLearningPro built with Expo.

## Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI: `npm install -g expo-cli`
- iOS Simulator (macOS) or Android Emulator

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Update `.env` with your Firebase credentials and API URL

## Development

Start the development server:
```bash
npm start
```

Then:
- Press `i` to open iOS simulator
- Press `a` to open Android emulator
- Scan QR code with Expo Go app on your physical device

## Project Structure

```
mobile/
├── app/                    # Expo Router pages
│   ├── (auth)/            # Authentication screens (login, register)
│   ├── (tabs)/            # Main tab navigation (dashboard, tasks, messages, profile)
│   ├── modals/            # Modal screens
│   ├── _layout.tsx        # Root layout with providers
│   ├── index.tsx          # Entry point / splash
│   ├── analytics.tsx      # Analytics dashboard
│   ├── create-task.tsx    # Task creation screen
│   ├── study-plans.tsx    # Study plans viewer
│   ├── tests.tsx          # Test list
│   ├── test-detail.tsx    # Test details
│   ├── test-taking.tsx    # Test taking interface
│   ├── ocr-scanner.tsx    # OCR camera scanner
│   └── notification-settings.tsx  # Push notification settings
├── components/            # Reusable components
│   ├── ui/               # Base UI components (Button, Card, Input, etc.)
│   ├── dashboard/        # Dashboard-specific components
│   ├── chat/             # Chat/messaging components
│   ├── auth/             # Authentication components
│   ├── error-boundary.tsx  # Error boundary wrapper
│   └── offline-indicator.tsx  # Offline status indicator
├── lib/                   # Utilities and services
│   ├── api.ts            # Main API client with JWT interceptors
│   ├── firebase.ts       # Firebase configuration
│   ├── utils.ts          # Helper functions
│   ├── websocket.ts      # WebSocket client for real-time messaging
│   ├── notifications.ts  # Push notification service
│   ├── offline-storage.ts  # AsyncStorage wrapper for offline data
│   ├── offline-api.ts    # Offline-aware API wrapper
│   ├── tasks-api.ts      # Task-specific API calls
│   ├── tests-api.ts      # Test-specific API calls
│   ├── validation.ts     # Input validation utilities
│   └── error-tracking.ts # Error tracking service
├── hooks/                 # Custom React hooks
│   └── use-network-status.ts  # Network connectivity hook
├── constants/             # App constants
│   ├── config.ts         # Configuration (API URL, etc.)
│   └── time.ts           # Time-related constants
├── types/                 # TypeScript types
│   ├── task.ts           # Task type definitions
│   └── test.ts           # Test type definitions
└── assets/                # Static assets (images, icons)
```

## Features

- ✅ Firebase Authentication (email/password + Google)
- ✅ Tab Navigation (Dashboard, Tasks, Messages, Profile)
- ✅ AI Tutor Chat with markdown and LaTeX support
- ✅ Task Management (create, edit, delete, complete)
- ✅ Real-time Messaging (WebSocket + MessagePal)
- ✅ Test Taking with timer and auto-submit
- ✅ Analytics Dashboard with charts
- ✅ Study Plans viewer with progress tracking
- ✅ Push Notifications (messages, tests, announcements)
- ✅ OCR Scanning with camera integration
- ✅ Offline Support with automatic sync
- ✅ NativeWind (Tailwind CSS for React Native)
- ✅ React Query for data fetching and caching
- ✅ Secure token storage with Expo Secure Store
- ✅ Error tracking and boundaries
- 🚧 Dark mode (coming soon)
- 🚧 Live classes with video (coming soon)

## Scripts

- `npm start` - Start Expo development server
- `npm run android` - Run on Android
- `npm run ios` - Run on iOS
- `npm run web` - Run on web
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## Environment Variables

See `.env.example` for required environment variables.

## Building for Production

### iOS
```bash
eas build --platform ios
```

### Android
```bash
eas build --platform android
```

## Troubleshooting

### Clear cache and reset
```bash
npx expo start --clear
```

### Reset Metro bundler
```bash
rm -rf node_modules
npm install
npx expo start --clear
```

### iOS simulator not opening
```bash
# Make sure Xcode is installed (macOS only)
xcode-select --install
```

### Android emulator not opening
```bash
# Make sure Android Studio is installed
# Open Android Studio → AVD Manager → Create/Start emulator
```

### Firebase authentication errors
- Verify all `EXPO_PUBLIC_FIREBASE_*` variables are set in `.env`
- Ensure Firebase project has iOS/Android apps configured
- Check that SHA-1/SHA-256 fingerprints are added (Android)

### API connection errors
- Verify `EXPO_PUBLIC_API_URL` points to your backend
- For physical devices, use your computer's local IP (not localhost)
- Example: `EXPO_PUBLIC_API_URL=http://192.168.1.100:5001`

### Push notifications not working
- Ensure physical device is used (notifications don't work in simulator)
- Check notification permissions in device settings
- Verify Expo project is configured for push notifications

### Offline mode issues
- Clear AsyncStorage: Settings → Clear app data
- Check network status indicator at top of screen
- Verify backend is running when coming back online

## Documentation

- **[MOBILE_MIGRATION_STATUS.md](../MOBILE_MIGRATION_STATUS.md)** - Complete migration status (100%)
- **[SETUP.md](SETUP.md)** - Detailed setup instructions
- **[GETTING_STARTED.md](GETTING_STARTED.md)** - Quick start guide
- **[BACKEND_INTEGRATION.md](BACKEND_INTEGRATION.md)** - Backend API integration details
- **[PUSH_NOTIFICATIONS.md](PUSH_NOTIFICATIONS.md)** - Push notification implementation
- **[OCR_SCANNER.md](OCR_SCANNER.md)** - OCR scanner implementation
- **[FINAL_REPORT.md](FINAL_REPORT.md)** - Final project report and quality metrics
- **[.agent/spec/react-native-migration/](../.agent/spec/react-native-migration/)** - Full migration specification
  - `requirements.md` - Feature requirements
  - `design.md` - Technical architecture
  - `tasks.md` - Implementation tasks

## License

MIT
