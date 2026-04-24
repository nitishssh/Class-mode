# Push Notifications Implementation

## Overview
Push notifications have been fully implemented for the mobile app using Expo Notifications. Users can receive notifications for tests, messages, announcements, and other important events.

## Features Implemented

### 1. Notification Registration
- Automatic registration when user logs in
- Permission handling for iOS and Android
- Expo push token generation
- Token sent to backend for storage

### 2. Backend Integration
- **POST /api/push-tokens** - Register or update push token
- **DELETE /api/push-tokens** - Remove push token on logout
- MongoDB storage using `FcmToken` collection
- User-specific token management

### 3. Notification Handling
- Foreground notifications (shown while app is open)
- Background notifications (shown when app is closed)
- Notification tap handling with routing
- Custom notification channels for Android

### 4. Notification Routing
When a notification is tapped, the app automatically navigates to the relevant screen:
- `type: 'test'` → Tests screen
- `type: 'message'` → Messages tab
- `type: 'announcement'` → Dashboard
- `screen: '/path'` → Custom screen path

### 5. Settings Screen
- User-friendly notification preferences UI
- Toggle notifications by category:
  - Test Reminders
  - Test Results
  - Announcements
  - Messages
  - Achievements
  - Study Reminders
- Accessible from Profile → Notifications

### 6. Token Cleanup
- Push token automatically removed from backend on logout
- Prevents notifications to logged-out users
- Clean session management

## Files Created/Modified

### New Files
- `mobile/lib/notifications.ts` - Notification utility functions
- `mobile/app/notification-settings.tsx` - Settings screen
- `mobile/PUSH_NOTIFICATIONS.md` - This documentation

### Modified Files
- `mobile/app/_layout.tsx` - Notification setup and listeners
- `mobile/app/(tabs)/profile.tsx` - Added settings link and logout cleanup
- `server/routes.ts` - Added push token endpoints
- `server/storage.ts` - Added push token storage methods

## Usage

### Sending Notifications from Backend
```typescript
import { Expo } from 'expo-server-sdk';

const expo = new Expo();

// Get user's push tokens from database
const tokens = await storage.getFcmTokensByUser(userId);

// Create messages
const messages = tokens.map(tokenData => ({
  to: tokenData.token,
  sound: 'default',
  title: 'Test Reminder',
  body: 'Your test starts in 30 minutes',
  data: { type: 'test', testId: 123 },
}));

// Send notifications
const chunks = expo.chunkPushNotifications(messages);
for (const chunk of chunks) {
  await expo.sendPushNotificationsAsync(chunk);
}
```

### Testing Notifications
```typescript
import { schedulePushNotification } from '../lib/notifications';

// Schedule a test notification
await schedulePushNotification(
  'Test Title',
  'Test message body',
  { type: 'test', testId: 123 },
  { seconds: 5 } // Trigger after 5 seconds
);
```

## Configuration

### Android
Notification channels are automatically configured with:
- Channel name: "default"
- Importance: MAX
- Vibration pattern: [0, 250, 250, 250]
- Light color: Blue (#3B82F6)

### iOS
- Permissions requested on first app launch
- Badge count support
- Sound enabled by default

## Environment Variables
No additional environment variables needed. Uses Expo's built-in push notification service.

## Next Steps
1. Implement backend notification sending logic
2. Add notification history/list screen
3. Add badge count updates
4. Test on physical devices (iOS and Android)
5. Setup notification scheduling for reminders

## Testing Checklist
- [ ] Test notification permissions on iOS
- [ ] Test notification permissions on Android
- [ ] Verify token registration with backend
- [ ] Test foreground notifications
- [ ] Test background notifications
- [ ] Test notification tap routing
- [ ] Test settings screen toggles
- [ ] Test token cleanup on logout
- [ ] Test on physical iOS device
- [ ] Test on physical Android device

## Known Limitations
- Push notifications only work on physical devices (not simulators)
- Requires Expo Go app or custom development build
- iOS requires Apple Developer account for production
- Android requires Firebase Cloud Messaging setup for production

## Resources
- [Expo Notifications Docs](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Expo Push Notifications Guide](https://docs.expo.dev/push-notifications/overview/)
- [expo-server-sdk](https://github.com/expo/expo-server-sdk-node)
