import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetworkStatus } from '../hooks/use-network-status';

export function OfflineIndicator() {
  const { isOnline } = useNetworkStatus();

  if (isOnline) return null;

  return (
    <View className="bg-yellow-500 px-4 py-2">
      <View className="flex-row items-center justify-center">
        <Ionicons name="cloud-offline" size={16} color="white" />
        <Text className="text-white font-medium ml-2 text-sm">
          You're offline. Changes will sync when reconnected.
        </Text>
      </View>
    </View>
  );
}
