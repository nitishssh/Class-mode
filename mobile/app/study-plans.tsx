import { View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

interface StudyPlan {
  id: string;
  subject: string;
  title: string;
  progress: number;
  totalTopics: number;
  completedTopics: number;
  dueDate: string;
  color: string[];
  icon: string;
}

export default function StudyPlansScreen() {
  const router = useRouter();

  const studyPlans: StudyPlan[] = [
    {
      id: '1',
      subject: 'Mathematics',
      title: 'Calculus Mastery',
      progress: 65,
      totalTopics: 12,
      completedTopics: 8,
      dueDate: '2026-05-15',
      color: ['#3B82F6', '#2563EB'],
      icon: 'calculator',
    },
    {
      id: '2',
      subject: 'Physics',
      title: 'Mechanics & Motion',
      progress: 40,
      totalTopics: 10,
      completedTopics: 4,
      dueDate: '2026-05-20',
      color: ['#10B981', '#059669'],
      icon: 'planet',
    },
    {
      id: '3',
      subject: 'Chemistry',
      title: 'Organic Chemistry',
      progress: 80,
      totalTopics: 8,
      completedTopics: 6,
      dueDate: '2026-05-10',
      color: ['#F59E0B', '#D97706'],
      icon: 'flask',
    },
  ];

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return '#10B981';
    if (progress >= 50) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-6 py-4 border-b border-gray-200">
        <View className="flex-row items-center justify-between">
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#374151" />
          </Pressable>
          <Text className="text-xl font-bold text-gray-900">Study Plans</Text>
          <Pressable>
            <Ionicons name="add-circle-outline" size={24} color="#3B82F6" />
          </Pressable>
        </View>
      </View>

      <ScrollView className="flex-1 p-6">
        {/* Overview Card */}
        <View className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-6 mb-6 shadow-lg">
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-white/80 text-sm">Overall Progress</Text>
              <Text className="text-white text-3xl font-bold mt-1">62%</Text>
            </View>
            <View className="w-16 h-16 rounded-full bg-white/20 items-center justify-center">
              <Ionicons name="trending-up" size={32} color="white" />
            </View>
          </View>
          <View className="flex-row items-center gap-4">
            <View>
              <Text className="text-white/80 text-xs">Active Plans</Text>
              <Text className="text-white text-lg font-semibold">{studyPlans.length}</Text>
            </View>
            <View>
              <Text className="text-white/80 text-xs">Topics Completed</Text>
              <Text className="text-white text-lg font-semibold">
                {studyPlans.reduce((sum, plan) => sum + plan.completedTopics, 0)}
              </Text>
            </View>
            <View>
              <Text className="text-white/80 text-xs">Total Topics</Text>
              <Text className="text-white text-lg font-semibold">
                {studyPlans.reduce((sum, plan) => sum + plan.totalTopics, 0)}
              </Text>
            </View>
          </View>
        </View>

        {/* Study Plans List */}
        <Text className="text-lg font-bold text-gray-900 mb-4">
          Active Study Plans
        </Text>

        <View className="space-y-4">
          {studyPlans.map((plan) => (
            <Pressable
              key={plan.id}
              className="bg-white rounded-xl shadow-sm overflow-hidden"
            >
              {/* Header with gradient */}
              <View className="bg-gradient-to-r p-4" style={{ backgroundColor: plan.color[0] }}>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <View className="w-10 h-10 rounded-full bg-white/20 items-center justify-center">
                      <Ionicons name={plan.icon as any} size={20} color="white" />
                    </View>
                    <View>
                      <Text className="text-white/80 text-xs">{plan.subject}</Text>
                      <Text className="text-white font-semibold text-base">
                        {plan.title}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="white" />
                </View>
              </View>

              {/* Content */}
              <View className="p-4">
                {/* Progress Bar */}
                <View className="mb-3">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-gray-600 text-sm">Progress</Text>
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: getProgressColor(plan.progress) }}
                    >
                      {plan.progress}%
                    </Text>
                  </View>
                  <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <View
                      className="h-full rounded-full"
                      style={{
                        width: `${plan.progress}%`,
                        backgroundColor: getProgressColor(plan.progress),
                      }}
                    />
                  </View>
                </View>

                {/* Stats */}
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-4">
                    <View className="flex-row items-center">
                      <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                      <Text className="text-gray-600 text-sm ml-1">
                        {plan.completedTopics}/{plan.totalTopics} topics
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <Ionicons name="calendar-outline" size={16} color="#9CA3AF" />
                      <Text className="text-gray-600 text-sm ml-1">
                        {new Date(plan.dueDate).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </Pressable>
          ))}
        </View>

        {/* Empty State for No Plans */}
        {studyPlans.length === 0 && (
          <View className="bg-white rounded-xl p-8 items-center">
            <Ionicons name="book-outline" size={64} color="#D1D5DB" />
            <Text className="text-gray-900 font-semibold text-lg mt-4">
              No Study Plans Yet
            </Text>
            <Text className="text-gray-600 text-center mt-2">
              Create your first study plan to start learning
            </Text>
            <Pressable className="bg-primary-600 rounded-lg px-6 py-3 mt-4">
              <Text className="text-white font-semibold">Create Study Plan</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
