# Mobile App Quick Reference

## 🚀 Common Commands

```bash
# Start development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Clear cache and restart
npx expo start --clear

# Type check
npm run type-check

# Install new package (use Expo's installer)
npx expo install package-name
```

## 📁 Project Structure

```
mobile/
├── app/              # Expo Router pages (file-based routing)
├── components/       # Reusable components
├── lib/             # Services and utilities
├── hooks/           # Custom React hooks
├── constants/       # Configuration and constants
└── types/           # TypeScript type definitions
```

## 🎨 Styling with NativeWind

```tsx
// Use Tailwind classes just like web
<View className="flex-1 bg-white p-4">
  <Text className="text-2xl font-bold text-gray-900">
    Hello World
  </Text>
</View>

// For horizontal flex, use flex-row
<View className="flex-row items-center justify-between">
  {/* content */}
</View>
```

## 🧭 Navigation with Expo Router

```tsx
import { useRouter, Link } from 'expo-router';

// Programmatic navigation
const router = useRouter();
router.push('/profile');
router.replace('/(auth)/login');
router.back();

// Link component
<Link href="/profile">Go to Profile</Link>
```

## 🔐 Authentication

```tsx
import { loginWithEmail, logoutUser, auth } from '../lib/firebase';

// Login
await loginWithEmail(email, password);

// Logout
await logoutUser();

// Get current user
const user = auth?.currentUser;
```

## 🌐 API Calls

```tsx
import api from '../lib/api';

// GET request
const response = await api.get('/tasks');

// POST request
const response = await api.post('/tasks', { title: 'New Task' });

// Auth token is automatically added via interceptor
```

## 📦 Data Fetching with React Query

```tsx
import { useQuery, useMutation } from '@tanstack/react-query';

// Fetch data
const { data, isLoading, error } = useQuery({
  queryKey: ['tasks'],
  queryFn: () => api.get('/tasks').then(res => res.data),
});

// Mutate data
const mutation = useMutation({
  mutationFn: (newTask) => api.post('/tasks', newTask),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  },
});
```

## 🎯 Common Components

### Button
```tsx
<Pressable
  className="bg-primary-600 rounded-lg py-4 px-6"
  onPress={() => console.log('Pressed')}
>
  <Text className="text-white text-center font-semibold">
    Click Me
  </Text>
</Pressable>
```

### Input
```tsx
<TextInput
  className="border border-gray-300 rounded-lg px-4 py-3"
  placeholder="Enter text"
  value={value}
  onChangeText={setValue}
/>
```

### List (Optimized)
```tsx
<FlatList
  data={items}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <ItemCard item={item} />}
/>
```

### Loading Spinner
```tsx
<ActivityIndicator size="large" color="#3B82F6" />
```

### Alert
```tsx
import { Alert } from 'react-native';

Alert.alert('Title', 'Message', [
  { text: 'Cancel', style: 'cancel' },
  { text: 'OK', onPress: () => console.log('OK') },
]);
```

## 🔧 Environment Variables

```tsx
// Access env variables
const apiUrl = process.env.EXPO_PUBLIC_API_URL;

// All env vars must start with EXPO_PUBLIC_
```

## 🐛 Debugging

```tsx
// Console logs appear in terminal
console.log('Debug:', data);

// React DevTools
// Run: npx react-devtools

// Expo DevTools
// Opens automatically in browser when you run npm start

// Device dev menu
// iOS: Cmd+D in simulator, shake device
// Android: Cmd+M in emulator, shake device
```

## 📱 Platform-Specific Code

```tsx
import { Platform } from 'react-native';

// Check platform
if (Platform.OS === 'ios') {
  // iOS-specific code
}

// Platform-specific values
const padding = Platform.select({
  ios: 20,
  android: 16,
  default: 16,
});
```

## 🎨 Icons

```tsx
import { Ionicons } from '@expo/vector-icons';

<Ionicons name="home" size={24} color="black" />

// Common icon names:
// home, person, settings, search, add, close
// checkmark-circle, alert-circle, information-circle
// chevron-forward, chevron-back, arrow-forward
```

## 🔄 Async Storage

```tsx
import * as SecureStore from 'expo-secure-store';

// Save
await SecureStore.setItemAsync('key', 'value');

// Get
const value = await SecureStore.getItemAsync('key');

// Delete
await SecureStore.deleteItemAsync('key');
```

## 📸 Common Patterns

### Safe Area
```tsx
import { SafeAreaView } from 'react-native-safe-area-context';

<SafeAreaView className="flex-1">
  {/* content */}
</SafeAreaView>
```

### Keyboard Avoiding
```tsx
<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  className="flex-1"
>
  {/* content */}
</KeyboardAvoidingView>
```

### Pull to Refresh
```tsx
const [refreshing, setRefreshing] = useState(false);

<ScrollView
  refreshControl={
    <RefreshControl
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
      }}
    />
  }
>
  {/* content */}
</ScrollView>
```

## 🚨 Common Errors

### "Unable to resolve module"
```bash
npx expo start --clear
```

### "Network request failed"
- Check backend is running
- Check API_URL in .env
- For physical device, use computer's IP address

### "Firebase not configured"
- Check all EXPO_PUBLIC_FIREBASE_* vars in .env
- Restart Expo dev server

### Changes not reflecting
- Shake device for dev menu → Reload
- Or restart with: npx expo start --clear

## 📚 Useful Links

- [Expo Docs](https://docs.expo.dev/)
- [React Native Docs](https://reactnative.dev/)
- [NativeWind Docs](https://www.nativewind.dev/)
- [Expo Router Docs](https://docs.expo.dev/router/introduction/)
- [React Native Paper](https://callstack.github.io/react-native-paper/)

## 💡 Tips

1. **Use FlatList for long lists** - Better performance than ScrollView + map
2. **Test on real device early** - Some features work differently
3. **Use Expo Go for quick testing** - No need to build for development
4. **Keep components small** - Easier to maintain and test
5. **Use TypeScript** - Catch errors early
6. **Follow React Native best practices** - Check official docs
