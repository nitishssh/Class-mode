# Mobile App Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
cd mobile
npm install
```

### 2. Configure Environment
```bash
# Copy the example env file
cp .env.example .env

# Edit .env and add your Firebase credentials
# You can copy these from ../client/.env (web app)
```

### 3. Start Development Server
```bash
npm start
```

### 4. Run on Device/Simulator

#### Option A: Physical Device (Easiest)
1. Install "Expo Go" app from App Store (iOS) or Play Store (Android)
2. Scan the QR code shown in terminal
3. App will load on your device

#### Option B: iOS Simulator (macOS only)
1. Press `i` in the terminal
2. Simulator will open automatically

#### Option C: Android Emulator
1. Open Android Studio
2. Start an emulator (AVD Manager)
3. Press `a` in the terminal

## Firebase Configuration

The mobile app uses the same Firebase project as the web app. Copy your Firebase config from the web app:

```bash
# From project root
cat client/.env | grep VITE_FIREBASE
```

Then update `mobile/.env` with these values (replace `VITE_` with `EXPO_PUBLIC_`):

```
EXPO_PUBLIC_FIREBASE_API_KEY=AIza...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

## Backend Configuration

Make sure your backend is running and accessible:

```bash
# In mobile/.env
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_WS_URL=ws://localhost:3000
```

**Note for iOS Simulator:** Use `http://localhost:3000`
**Note for Android Emulator:** Use `http://10.0.2.2:3000`
**Note for Physical Device:** Use your computer's IP address (e.g., `http://192.168.1.100:3000`)

## Testing the App

### 1. Test Authentication
- Open the app
- You should see the login screen
- Try logging in with existing credentials from the web app
- Or create a new account

### 2. Test Navigation
- After login, you should see 4 tabs: Dashboard, Tasks, Messages, Profile
- Navigate between tabs
- Check that data loads correctly

### 3. Test Logout
- Go to Profile tab
- Tap "Logout"
- You should be redirected to login screen

## Common Issues

### "Unable to resolve module"
```bash
# Clear cache and reinstall
rm -rf node_modules
npm install
npx expo start --clear
```

### "Network request failed"
- Check that backend is running (`npm run dev` in project root)
- Check API_URL in `.env` is correct
- For physical device, make sure you're on the same WiFi network

### "Firebase not configured"
- Make sure all `EXPO_PUBLIC_FIREBASE_*` variables are set in `.env`
- Restart the Expo dev server after changing `.env`

### iOS Simulator not opening
```bash
# Open manually
open -a Simulator

# Then press 'i' in Expo terminal
```

### Android Emulator not detected
```bash
# List available emulators
emulator -list-avds

# Start specific emulator
emulator -avd Pixel_5_API_31 &

# Then press 'a' in Expo terminal
```

## Next Steps

Once the basic app is running:

1. ✅ Authentication works
2. ✅ Navigation works
3. ✅ Can view dashboard
4. 🚧 Implement AI Tutor chat
5. 🚧 Implement test taking
6. 🚧 Add push notifications
7. 🚧 Implement live classes

See `.agent/spec/react-native-migration/tasks.md` for the full implementation roadmap.

## Development Tips

### Hot Reload
- Changes to code will automatically reload the app
- Shake device or press `Cmd+D` (iOS) / `Cmd+M` (Android) for dev menu

### Debugging
- Use `console.log()` - output appears in terminal
- Use React DevTools: `npx react-devtools`
- Use Expo DevTools: Opens in browser when you run `npm start`

### Testing on Multiple Devices
- Run `npm start`
- Scan QR code on multiple devices
- All will connect to the same dev server

## Building for Production

When ready to build for production:

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure build
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

See [Expo EAS Build docs](https://docs.expo.dev/build/introduction/) for more details.
