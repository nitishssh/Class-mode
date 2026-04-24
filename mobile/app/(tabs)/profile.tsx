import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { auth, logoutUser, getUserProfile } from '../../lib/firebase';
import { useEffect, useState } from 'react';
import { UserProfile } from '../../lib/firebase';
import { getCurrentPushToken } from '../../lib/notifications';
import { api } from '../../lib/api';

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const router = useRouter();

  useEffect(() => {
    const loadProfile = async () => {
      if (auth?.currentUser) {
        const userProfile = await getUserProfile(auth.currentUser.uid);
        setProfile(userProfile);
      }
    };
    loadProfile();
  }, []);

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              // Remove push token from backend before logout
              const pushToken = getCurrentPushToken();
              if (pushToken) {
                try {
                  await api.delete('/api/push-tokens', {
                    data: { token: pushToken },
                  });
                } catch (error) {
                  console.error('Failed to remove push token:', error);
                  // Continue with logout even if token removal fails
                }
              }
              
              await logoutUser();
              router.replace('/(auth)/login');
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-6">
        {/* Profile Header */}
        <View className="bg-white rounded-lg p-6 shadow-sm mb-6 items-center">
          <View className="w-24 h-24 rounded-full bg-primary-100 items-center justify-center mb-4">
            <Text className="text-4xl">
              {profile?.displayName?.charAt(0).toUpperCase() || '👤'}
            </Text>
          </View>
          <Text className="text-2xl font-bold text-gray-900 mb-1">
            {profile?.displayName || 'User'}
          </Text>
          <Text className="text-gray-600 mb-1">
            {profile?.email || auth?.currentUser?.email}
          </Text>
          <View className="bg-primary-100 px-3 py-1 rounded-full mt-2">
            <Text className="text-primary-700 font-medium capitalize">
              {profile?.role || 'Student'}
            </Text>
          </View>
        </View>

        {/* Settings Sections */}
        <View className="bg-white rounded-lg shadow-sm mb-6">
          <Pressable className="flex-row items-center justify-between p-4 border-b border-gray-100">
            <View className="flex-row items-center">
              <Ionicons name="person-outline" size={24} color="#3B82F6" />
              <Text className="text-gray-900 ml-3 font-medium">
                Edit Profile
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>

          <Pressable 
            className="flex-row items-center justify-between p-4 border-b border-gray-100"
            onPress={() => router.push('/notification-settings')}
          >
            <View className="flex-row items-center">
              <Ionicons name="notifications-outline" size={24} color="#3B82F6" />
              <Text className="text-gray-900 ml-3 font-medium">
                Notifications
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>

          <Pressable className="flex-row items-center justify-between p-4 border-b border-gray-100">
            <View className="flex-row items-center">
              <Ionicons name="moon-outline" size={24} color="#3B82F6" />
              <Text className="text-gray-900 ml-3 font-medium">
                Dark Mode
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>

          <Pressable className="flex-row items-center justify-between p-4">
            <View className="flex-row items-center">
              <Ionicons name="language-outline" size={24} color="#3B82F6" />
              <Text className="text-gray-900 ml-3 font-medium">
                Language
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>
        </View>

        {/* About Section */}
        <View className="bg-white rounded-lg shadow-sm mb-6">
          <Pressable className="flex-row items-center justify-between p-4 border-b border-gray-100">
            <View className="flex-row items-center">
              <Ionicons name="help-circle-outline" size={24} color="#3B82F6" />
              <Text className="text-gray-900 ml-3 font-medium">
                Help & Support
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>

          <Pressable className="flex-row items-center justify-between p-4 border-b border-gray-100">
            <View className="flex-row items-center">
              <Ionicons name="shield-outline" size={24} color="#3B82F6" />
              <Text className="text-gray-900 ml-3 font-medium">
                Privacy Policy
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>

          <Pressable className="flex-row items-center justify-between p-4">
            <View className="flex-row items-center">
              <Ionicons name="information-circle-outline" size={24} color="#3B82F6" />
              <Text className="text-gray-900 ml-3 font-medium">
                About
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>
        </View>

        {/* Logout Button */}
        <Pressable
          className="bg-red-600 rounded-lg py-4"
          onPress={handleLogout}
        >
          <View className="flex-row items-center justify-center">
            <Ionicons name="log-out-outline" size={20} color="white" />
            <Text className="text-white font-semibold ml-2">
              Logout
            </Text>
          </View>
        </Pressable>

        {/* Version */}
        <Text className="text-center text-gray-500 text-sm mt-6">
          Version 1.0.0
        </Text>
      </View>
    </ScrollView>
  );
}
