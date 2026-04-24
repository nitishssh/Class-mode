# Mobile App Launch Checklist

## ✅ Before First Run

- [ ] Navigate to mobile directory: `cd mobile`
- [ ] Copy environment file: `cp .env.example .env`
- [ ] Edit `.env` with Firebase credentials (copy from web app)
- [ ] Verify all `EXPO_PUBLIC_FIREBASE_*` variables are set
- [ ] Set `EXPO_PUBLIC_API_URL` to your backend URL

## ✅ First Run

- [ ] Run `npm start`
- [ ] Wait for QR code to appear
- [ ] Choose your platform:
  - [ ] iOS: Press `i` or scan with Expo Go
  - [ ] Android: Press `a` or scan with Expo Go
  - [ ] Physical device: Install Expo Go and scan QR

## ✅ Test Authentication

- [ ] App opens to login screen
- [ ] Can navigate to registration screen
- [ ] Can create a new account
- [ ] Can log in with existing account
- [ ] Redirects to dashboard after login
- [ ] User name appears on dashboard

## ✅ Test Navigation

- [ ] Dashboard tab works
- [ ] Tasks tab works
- [ ] Messages tab works
- [ ] Profile tab works
- [ ] Tab icons display correctly
- [ ] Active tab is highlighted

## ✅ Test Features

### Dashboard
- [ ] Welcome message shows user name
- [ ] 4 stat cards display
- [ ] Quick action buttons visible
- [ ] Icons render correctly

### Tasks
- [ ] Task list displays
- [ ] Status badges show correct colors
- [ ] Due dates visible
- [ ] Add task button present

### Messages
- [ ] Conversation list displays
- [ ] Search bar works
- [ ] Unread badges show
- [ ] New message button visible

### Profile
- [ ] User info displays
- [ ] Settings menu visible
- [ ] Logout button works
- [ ] Returns to login after logout

## ✅ Verify Backend Connection

- [ ] Backend is running (`npm run dev` in project root)
- [ ] API_URL in `.env` is correct
- [ ] Can make API calls (check console for errors)
- [ ] Firebase authentication works

## 🐛 Troubleshooting Checklist

If something doesn't work:

- [ ] Clear cache: `npx expo start --clear`
- [ ] Check terminal for errors
- [ ] Verify `.env` file exists and has all variables
- [ ] Restart Expo dev server
- [ ] Check backend is running
- [ ] Verify Firebase credentials are correct
- [ ] Check device/simulator is on same network (for physical device)

## 📱 Device-Specific Checks

### iOS
- [ ] Simulator opens correctly
- [ ] App loads without errors
- [ ] Keyboard appears when tapping inputs
- [ ] Navigation gestures work

### Android
- [ ] Emulator opens correctly
- [ ] App loads without errors
- [ ] Back button works
- [ ] Keyboard appears when tapping inputs

## 🎯 Ready for Development

Once all checks pass:

- [ ] Authentication works end-to-end
- [ ] All screens accessible
- [ ] No console errors
- [ ] UI looks good
- [ ] Ready to implement Phase 2 features

## 📝 Notes

- Use `console.log()` for debugging (appears in terminal)
- Shake device or Cmd+D (iOS) / Cmd+M (Android) for dev menu
- Changes auto-reload (hot reload enabled)
- Check `mobile/QUICK_REFERENCE.md` for common patterns

## 🚀 Next Steps After Verification

1. [ ] Read `mobile/QUICK_REFERENCE.md`
2. [ ] Review `.agent/spec/react-native-migration/tasks.md`
3. [ ] Start implementing Phase 2 features
4. [ ] Test on real device early and often

---

**Status**: [ ] All checks passed, ready for development!
