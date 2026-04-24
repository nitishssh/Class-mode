import '../global.css';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import * as Notifications from 'expo-notifications';
import { registerForPushNotifications, setCurrentPushToken } from '../lib/notifications';
import { api } from '../lib/api';
import { setupAutoSync } from '../lib/offline-api';
import { OfflineIndicator } from '../components/offline-indicator';
import { ErrorBoundary } from '../components/error-boundary';
import { errorTracker, setUserContext, clearUserContext } from '../lib/error-tracking';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

export default function RootLayout() {
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  useEffect(() => {
    // Initialize error tracking
    errorTracker.initialize();

    // Setup offline sync
    setupAutoSync();

    if (!auth) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsLoading(false);
      
      if (user) {
        // Set user context for error tracking
        setUserContext(user.uid, user.email || undefined, user.displayName || undefined);

        // Register for push notifications
        const token = await registerForPushNotifications();
        if (token) {
          try {
            await api.post('/api/push-tokens', {
              token,
              deviceType: 'mobile',
            });
            setCurrentPushToken(token);
          } catch (error) {
            if (__DEV__) {
              console.error('Failed to register push token with backend:', error);
            }
          }
        }
      } else {
        // Clear user context on logout
        clearUserContext();
        setCurrentPushToken(null);
      }
    });

    // Setup notification listeners
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        if (__DEV__) {
          console.log('Notification received:', notification);
        }
      }
    );

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        if (__DEV__) {
          console.log('Notification tapped:', response);
        }
        
        // Handle notification routing
        const data = response.notification.request.content.data;
        if (data?.screen) {
          router.push(data.screen as any);
        } else if (data?.type === 'test') {
          router.push('/tests');
        } else if (data?.type === 'message') {
          router.push('/(tabs)/messages');
        } else if (data?.type === 'announcement') {
          router.push('/(tabs)/index');
        }
      }
    );

    return () => {
      unsubscribe();
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  if (isLoading) {
    return null; // Or a loading screen
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <PaperProvider>
          <StatusBar style="auto" />
          <OfflineIndicator />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
          </Stack>
        </PaperProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
