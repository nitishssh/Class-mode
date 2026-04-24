import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { testsApi } from '../lib/tests-api';
import { auth } from '../lib/firebase';

export default function TestDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const queryClient = useQueryClient();
  const testId = parseInt(id as string);

  const { data: test, isLoading } = useQuery({
    queryKey: ['test', testId],
    queryFn: () => testsApi.getTest(testId),
  });

  const { data: questions = [] } = useQuery({
    queryKey: ['questions', testId],
    queryFn: () => testsApi.getQuestions(testId),
    enabled: !!testId,
  });

  const startTestMutation = useMutation({
    mutationFn: () => {
      const userId = auth?.currentUser?.uid;
      if (!userId) throw new Error('Not authenticated');
      // Convert Firebase UID to numeric ID (you may need to adjust this)
      return testsApi.startAttempt(testId, parseInt(userId) || 0);
    },
    onSuccess: (attempt) => {
      router.push(`/test-taking?attemptId=${attempt.id}&testId=${testId}`);
    },
    onError: (error) => {
      Alert.alert('Error', 'Failed to start test. Please try again.');
      console.error('Start test error:', error);
    },
  });

  const handleStartTest = () => {
    Alert.alert(
      'Start Test',
      `You have ${test?.duration} minutes to complete this test. Are you ready?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: () => startTestMutation.mutate(),
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <Text className="text-gray-600">Loading test details...</Text>
      </View>
    );
  }

  if (!test) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <Text className="text-gray-600">Test not found</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-6 py-4 border-b border-gray-200">
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#374151" />
          </Pressable>
          <Text className="text-xl font-bold text-gray-900 ml-4">
            Test Details
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1">
        <View className="p-6">
          {/* Test Info Card */}
          <View className="bg-white rounded-xl p-6 shadow-sm mb-6">
            <Text className="text-2xl font-bold text-gray-900 mb-2">
              {test.title}
            </Text>
            {test.description && (
              <Text className="text-gray-600 mb-4">{test.description}</Text>
            )}

            <View className="space-y-3">
              <View className="flex-row items-center">
                <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3">
                  <Ionicons name="book" size={20} color="#3B82F6" />
                </View>
                <View>
                  <Text className="text-xs text-gray-500">Subject</Text>
                  <Text className="text-base font-semibold text-gray-900">
                    {test.subject}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center">
                <View className="w-10 h-10 rounded-full bg-green-100 items-center justify-center mr-3">
                  <Ionicons name="time" size={20} color="#10B981" />
                </View>
                <View>
                  <Text className="text-xs text-gray-500">Duration</Text>
                  <Text className="text-base font-semibold text-gray-900">
                    {test.duration} minutes
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center">
                <View className="w-10 h-10 rounded-full bg-yellow-100 items-center justify-center mr-3">
                  <Ionicons name="trophy" size={20} color="#F59E0B" />
                </View>
                <View>
                  <Text className="text-xs text-gray-500">Total Marks</Text>
                  <Text className="text-base font-semibold text-gray-900">
                    {test.totalMarks}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center">
                <View className="w-10 h-10 rounded-full bg-purple-100 items-center justify-center mr-3">
                  <Ionicons name="help-circle" size={20} color="#8B5CF6" />
                </View>
                <View>
                  <Text className="text-xs text-gray-500">Questions</Text>
                  <Text className="text-base font-semibold text-gray-900">
                    {questions.length} questions
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Instructions Card */}
          <View className="bg-blue-50 rounded-xl p-6 mb-6 border border-blue-200">
            <View className="flex-row items-center mb-3">
              <Ionicons name="information-circle" size={24} color="#3B82F6" />
              <Text className="text-lg font-bold text-blue-900 ml-2">
                Instructions
              </Text>
            </View>
            <View className="space-y-2">
              <Text className="text-blue-800">
                • Read each question carefully before answering
              </Text>
              <Text className="text-blue-800">
                • You have {test.duration} minutes to complete the test
              </Text>
              <Text className="text-blue-800">
                • Once started, the timer cannot be paused
              </Text>
              <Text className="text-blue-800">
                • Submit your test before time runs out
              </Text>
              <Text className="text-blue-800">
                • You can review and change answers before submitting
              </Text>
            </View>
          </View>

          {/* Question Types */}
          {test.questionTypes && test.questionTypes.length > 0 && (
            <View className="bg-white rounded-xl p-6 shadow-sm mb-6">
              <Text className="text-lg font-bold text-gray-900 mb-3">
                Question Types
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {test.questionTypes.map((type, index) => (
                  <View
                    key={index}
                    className="bg-gray-100 px-3 py-2 rounded-lg"
                  >
                    <Text className="text-sm text-gray-700 capitalize">
                      {type.replace('_', ' ')}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Start Button */}
          <Pressable
            className="bg-primary-600 rounded-xl py-4 shadow-lg"
            onPress={handleStartTest}
            disabled={startTestMutation.isPending}
          >
            <Text className="text-white text-center font-bold text-lg">
              {startTestMutation.isPending ? 'Starting...' : 'Start Test'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
