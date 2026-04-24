import { View, Text, ScrollView, Switch } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';

export default function NotificationSettings() {
  const router = useRouter();
  const [settings, setSettings] = useState({
    testReminders: true,
    resultNotifications: true,
    announcements: true,
    messages: true,
    achievements: true,
    studyReminders: true,
  });

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
    // TODO: Save to backend or AsyncStorage
  };

  const settingsItems = [
    {
      key: 'testReminders' as const,
      title: 'Test Reminders',
      description: 'Get notified about upcoming tests',
      icon: 'calendar-outline',
    },
    {
      key: 'resultNotifications' as const,
      title: 'Test Results',
      description: 'Receive notifications when results are published',
      icon: 'trophy-outline',
    },
    {
      key: 'announcements' as const,
      title: 'Announcements',
      description: 'Important updates from teachers and school',
      icon: 'megaphone-outline',
    },
    {
      key: 'messages' as const,
      title: 'Messages',
      description: 'New messages from teachers and classmates',
      icon: 'chatbubble-outline',
    },
    {
      key: 'achievements' as const,
      title: 'Achievements',
      description: 'Celebrate your milestones and badges',
      icon: 'star-outline',
    },
    {
      key: 'studyReminders' as const,
      title: 'Study Reminders',
      description: 'Reminders for study sessions and tasks',
      icon: 'alarm-outline',
    },
  ];

  return (
    <View className="flex-1 bg-gray-50">
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Notification Settings',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView className="flex-1">
        <View className="p-4">
          <Text className="text-sm text-gray-600 mb-4">
            Manage your notification preferences to stay updated on what matters most to you.
          </Text>

          {settingsItems.map((item) => (
            <View
              key={item.key}
              className="bg-white rounded-lg p-4 mb-3 flex-row items-center justify-between"
            >
              <View className="flex-row items-center flex-1">
                <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mr-3">
                  <Ionicons name={item.icon as any} size={20} color="#3B82F6" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-gray-900">
                    {item.title}
                  </Text>
                  <Text className="text-sm text-gray-600 mt-1">
                    {item.description}
                  </Text>
                </View>
              </View>
              <Switch
                value={settings[item.key]}
                onValueChange={() => toggleSetting(item.key)}
                trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                thumbColor={settings[item.key] ? '#3B82F6' : '#F3F4F6'}
              />
            </View>
          ))}

          <View className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
            <View className="flex-row items-start">
              <Ionicons name="information-circle" size={20} color="#F59E0B" />
              <Text className="text-sm text-yellow-800 ml-2 flex-1">
                Make sure notifications are enabled in your device settings for the best experience.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
