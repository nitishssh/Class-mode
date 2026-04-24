import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { auth, getUserProfile } from '../../lib/firebase';
import { useEffect, useState } from 'react';
import { UserProfile } from '../../lib/firebase';
import { Ionicons } from '@expo/vector-icons';

export default function DashboardScreen() {
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

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-6">
        {/* Welcome Section */}
        <View className="mb-6">
          <Text className="text-3xl font-bold text-gray-900">
            Welcome back{profile?.displayName ? `, ${profile.displayName}` : ''}!
          </Text>
          <Text className="text-gray-600 mt-1">
            {profile?.role ? `${profile.role.charAt(0).toUpperCase() + profile.role.slice(1)} Dashboard` : 'Dashboard'}
          </Text>
        </View>

        {/* Quick Stats */}
        <View className="flex-row flex-wrap gap-4 mb-6">
          <View className="flex-1 min-w-[45%] bg-white rounded-lg p-4 shadow-sm">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-gray-600 text-sm">Tasks</Text>
                <Text className="text-2xl font-bold text-gray-900 mt-1">12</Text>
              </View>
              <Ionicons name="checkmark-circle" size={32} color="#3B82F6" />
            </View>
          </View>

          <View className="flex-1 min-w-[45%] bg-white rounded-lg p-4 shadow-sm">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-gray-600 text-sm">Messages</Text>
                <Text className="text-2xl font-bold text-gray-900 mt-1">5</Text>
              </View>
              <Ionicons name="chatbubbles" size={32} color="#10B981" />
            </View>
          </View>

          <View className="flex-1 min-w-[45%] bg-white rounded-lg p-4 shadow-sm">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-gray-600 text-sm">Progress</Text>
                <Text className="text-2xl font-bold text-gray-900 mt-1">78%</Text>
              </View>
              <Ionicons name="trending-up" size={32} color="#F59E0B" />
            </View>
          </View>

          <View className="flex-1 min-w-[45%] bg-white rounded-lg p-4 shadow-sm">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-gray-600 text-sm">Streak</Text>
                <Text className="text-2xl font-bold text-gray-900 mt-1">7 days</Text>
              </View>
              <Ionicons name="flame" size={32} color="#EF4444" />
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="mb-6">
          <Text className="text-xl font-bold text-gray-900 mb-4">
            Quick Actions
          </Text>
          <View className="space-y-3">
            <Pressable
              className="bg-white rounded-lg p-4 shadow-sm flex-row items-center justify-between"
              onPress={() => router.push('/analytics')}
            >
              <View className="flex-row items-center">
                <View className="bg-blue-100 rounded-full p-2 mr-3">
                  <Ionicons name="bar-chart" size={24} color="#3B82F6" />
                </View>
                <Text className="text-gray-900 font-medium">Analytics</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </Pressable>

            <Pressable className="bg-white rounded-lg p-4 shadow-sm flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View className="bg-blue-100 rounded-full p-2 mr-3">
                  <Ionicons name="book" size={24} color="#3B82F6" />
                </View>
                <Text className="text-gray-900 font-medium">AI Tutor</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </Pressable>

            <Pressable
              className="bg-white rounded-lg p-4 shadow-sm flex-row items-center justify-between"
              onPress={() => router.push('/tests')}
            >
              <View className="flex-row items-center">
                <View className="bg-green-100 rounded-full p-2 mr-3">
                  <Ionicons name="document-text" size={24} color="#10B981" />
                </View>
                <Text className="text-gray-900 font-medium">Take a Test</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </Pressable>

            <Pressable
              className="bg-white rounded-lg p-4 shadow-sm flex-row items-center justify-between"
              onPress={() => router.push('/study-plans')}
            >
              <View className="flex-row items-center">
                <View className="bg-purple-100 rounded-full p-2 mr-3">
                  <Ionicons name="calendar" size={24} color="#8B5CF6" />
                </View>
                <Text className="text-gray-900 font-medium">Study Plan</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </Pressable>

            <Pressable
              className="bg-white rounded-lg p-4 shadow-sm flex-row items-center justify-between"
              onPress={() => router.push('/ocr-scanner')}
            >
              <View className="flex-row items-center">
                <View className="bg-orange-100 rounded-full p-2 mr-3">
                  <Ionicons name="scan" size={24} color="#F97316" />
                </View>
                <Text className="text-gray-900 font-medium">Scan Document</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </Pressable>
          </View>
        </View>

        {/* Recent Activity */}
        <View>
          <Text className="text-xl font-bold text-gray-900 mb-4">
            Recent Activity
          </Text>
          <View className="bg-white rounded-lg p-4 shadow-sm">
            <Text className="text-gray-600 text-center py-4">
              No recent activity
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
