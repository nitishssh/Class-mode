import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { auth } from '../lib/firebase';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    if (!auth) {
      router.replace('/(auth)/login');
      return;
    }

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)/login');
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <View className="flex-1 justify-center items-center bg-white">
      <ActivityIndicator size="large" color="#3B82F6" />
    </View>
  );
}
