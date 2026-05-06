import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text } from 'react-native';

export default function EducatorTabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#3B82F6' }}>
      <Tabs.Screen name="dashboard" options={{
        title: 'Dashboard',
        tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart" size={size} color={color} />,
      }} />
      <Tabs.Screen name="students" options={{
        title: 'Students',
        tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
      }} />
      <Tabs.Screen name="grading" options={{
        title: 'Grading',
        tabBarIcon: ({ color, size }) => <Ionicons name="checkmark-circle" size={size} color={color} />,
      }} />
    </Tabs>
  );
}
