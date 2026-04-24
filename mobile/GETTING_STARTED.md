# Getting Started with PersonalLearningPro Mobile

## ✅ What's Been Done

Your React Native mobile app is now fully set up and ready to run! Here's what's been created:

### 1. Project Foundation ✅
- Expo project with TypeScript
- NativeWind (Tailwind CSS for React Native)
- Expo Router (file-based navigation)
- React Native Paper (UI components)
- All dependencies installed

### 2. Authentication System ✅
- Firebase integration
- Login screen
- Registration screen
- JWT token management
- Secure storage

### 3. Main App Screens ✅
- **Dashboard** - Overview with stats and quick actions
- **Tasks** - Task management interface
- **Messages** - Chat and messaging
- **Profile** - User settings and logout

### 4. Navigation ✅
- Tab-based navigation
- Auth flow (login → dashboard)
- Protected routes

## 🚀 Run the App Now

### Step 1: Configure Environment

```bash
cd mobile
cp .env.example .env
```

Edit `mobile/.env` and add your Firebase credentials. You can copy them from your web app's `.env` file:

```bash
# Copy Firebase config from web app
cat .env | grep VITE_FIREBASE
```

Then update `mobile/.env` (replace `VITE_` with `EXPO_PUBLIC_`):

```env
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_WS_URL=ws://localhost:3000
EXPO_PUBLIC_FIREBASE_API_KEY=your_key_here
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain_here
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_bucket_here
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### Step 2: Start the App

```bash
npm start
```

### Step 3: Open on Device

You have 3 options:

#### Option A: Physical Device (Easiest!)
1. Install "Expo Go" from App Store (iOS) or Play Store (Android)
2. Scan the QR code shown in your terminal
3. App opens on your device!

#### Option B: iOS Simulator (macOS only)
```bash
# Press 'i' in the terminal
# Or run:
npm run ios
```

#### Option C: Android Emulator
```bash
# Make sure Android Studio emulator is running
# Press 'a' in the terminal
# Or run:
npm run android
```

## 🎯 Test the App

1. **Login Screen** - You should see a beautiful login screen
2. **Create Account** - Tap "Sign Up" to create a new account
3. **Dashboard** - After login, see your dashboard with stats
4. **Navigation** - Tap the tabs at the bottom to navigate
5. **Profile** - Go to Profile tab and try logging out

## 📱 What You'll See

### Login Screen
- Email and password fields
- Sign in button
- Link to registration

### Dashboard
- Welcome message with your name
- 4 stat cards (Tasks, Messages, Progress, Streak)
- Quick action buttons (AI Tutor, Take Test, Study Plan)
- Recent activity section

### Tasks Screen
- List of tasks with status
- Due dates
- Status indicators (pending, in progress, completed)
- Add new task button

### Messages Screen
- Conversation list
- Search bar
- Unread message badges
- New message button

### Profile Screen
- User info and avatar
- Settings options
- Logout button

## 🔧 Development

### Make Changes
1. Edit any file in `mobile/app/` or `mobile/components/`
2. Save the file
3. App automatically reloads on your device!

### Debug
- Console logs appear in your terminal
- Shake device or press Cmd+D (iOS) / Cmd+M (Android) for dev menu

### Common Commands
```bash
# Start dev server
npm start

# Clear cache
npx expo start --clear

# Type check
npm run type-check

# Run on specific platform
npm run ios
npm run android
```

## 📚 Project Structure

```
mobile/
├── app/                    # Your screens (Expo Router)
│   ├── (auth)/            # Login, Register
│   ├── (tabs)/            # Dashboard, Tasks, Messages, Profile
│   ├── _layout.tsx        # Root layout
│   └── index.tsx          # Entry point
├── components/            # Reusable components
├── lib/                   # Firebase, API, utilities
├── constants/             # Configuration
└── [config files]         # Setup files
```

## 🎨 Styling

We use NativeWind (Tailwind CSS for React Native):

```tsx
<View className="flex-1 bg-white p-4">
  <Text className="text-2xl font-bold text-gray-900">
    Hello World
  </Text>
</View>
```

Same Tailwind classes you know from web!

## 🐛 Troubleshooting

### "Unable to resolve module"
```bash
npx expo start --clear
```

### "Network request failed"
- Make sure backend is running: `npm run dev` (in project root)
- Check `EXPO_PUBLIC_API_URL` in `.env`

### "Firebase not configured"
- Check all `EXPO_PUBLIC_FIREBASE_*` variables in `.env`
- Restart Expo: `npx expo start --clear`

### App not updating
- Shake device → Reload
- Or: `npx expo start --clear`

## 📖 Learn More

- **Quick Reference**: See `QUICK_REFERENCE.md` for common patterns
- **Setup Guide**: See `SETUP.md` for detailed setup instructions
- **Migration Docs**: See `.agent/spec/react-native-migration/` for full specs

## 🎉 Next Steps

Now that the foundation is ready, you can:

1. **Test authentication** - Create an account and log in
2. **Explore the screens** - Navigate through all tabs
3. **Start building features** - Add AI Tutor, Tests, etc.
4. **Customize the UI** - Update colors, layouts, components

## 💡 Tips

- Use Expo Go app for fastest development
- Test on real device early and often
- Check terminal for console logs
- Use TypeScript for better code quality
- Follow React Native best practices

## 🚀 You're All Set!

The mobile app is ready to run. Just:
1. Configure `.env`
2. Run `npm start`
3. Scan QR code with Expo Go

Happy coding! 🎊
