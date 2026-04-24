import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { testsApi } from '../lib/tests-api';
import { Test } from '../types/test';
import { useState } from 'react';

export default function TestsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const { data: tests = [], isLoading, error, refetch } = useQuery({
    queryKey: ['tests'],
    queryFn: () => testsApi.getTests(undefined, 'published'),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return { bg: '#DBEAFE', text: '#1E40AF' };
      case 'completed':
        return { bg: '#D1FAE5', text: '#065F46' };
      default:
        return { bg: '#F3F4F6', text: '#374151' };
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <Text className="text-gray-600">Loading tests...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50 p-6">
        <Ionicons name="alert-circle" size={48} color="#EF4444" />
        <Text className="text-gray-900 font-semibold text-lg mt-4">
          Failed to load tests
        </Text>
        <Pressable
          className="bg-primary-600 rounded-lg px-6 py-3 mt-4"
          onPress={() => refetch()}
        >
          <Text className="text-white font-semibold">Try Again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-6 py-4 border-b border-gray-200">
        <View className="flex-row items-center justify-between">
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#374151" />
          </Pressable>
          <Text className="text-xl font-bold text-gray-900">Tests</Text>
          <View className="w-6" />
        </View>
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View className="p-6">
          {tests.length === 0 ? (
            <View className="bg-white rounded-xl p-8 items-center">
              <Ionicons name="document-text-outline" size={64} color="#D1D5DB" />
              <Text className="text-gray-900 font-semibold text-lg mt-4">
                No Tests Available
              </Text>
              <Text className="text-gray-600 text-center mt-2">
                Check back later for new tests
              </Text>
            </View>
          ) : (
            <View className="space-y-4">
              {tests.map((test: Test) => (
                <Pressable
                  key={test.id}
                  className="bg-white rounded-xl shadow-sm overflow-hidden"
                  onPress={() => router.push(`/test-detail?id=${test.id}`)}
                >
                  {/* Header */}
                  <View className="p-4 border-b border-gray-100">
                    <View className="flex-row items-start justify-between mb-2">
                      <View className="flex-1">
                        <Text className="text-lg font-bold text-gray-900 mb-1">
                          {test.title}
                        </Text>
                        {test.description && (
                          <Text className="text-sm text-gray-600" numberOfLines={2}>
                            {test.description}
                          </Text>
                        )}
                      </View>
                      <View
                        className="px-3 py-1 rounded-full ml-2"
                        style={{ backgroundColor: getStatusColor(test.status).bg }}
                      >
                        <Text
                          className="text-xs font-semibold capitalize"
                          style={{ color: getStatusColor(test.status).text }}
                        >
                          {test.status}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Details */}
                  <View className="p-4">
                    <View className="flex-row flex-wrap gap-4">
                      <View className="flex-row items-center">
                        <Ionicons name="book-outline" size={16} color="#9CA3AF" />
                        <Text className="text-sm text-gray-600 ml-1">
                          {test.subject}
                        </Text>
                      </View>
                      <View className="flex-row items-center">
                        <Ionicons name="time-outline" size={16} color="#9CA3AF" />
                        <Text className="text-sm text-gray-600 ml-1">
                          {test.duration} min
                        </Text>
                      </View>
                      <View className="flex-row items-center">
                        <Ionicons name="trophy-outline" size={16} color="#9CA3AF" />
                        <Text className="text-sm text-gray-600 ml-1">
                          {test.totalMarks} marks
                        </Text>
                      </View>
                      <View className="flex-row items-center">
                        <Ionicons name="calendar-outline" size={16} color="#9CA3AF" />
                        <Text className="text-sm text-gray-600 ml-1">
                          {formatDate(test.testDate)}
                        </Text>
                      </View>
                    </View>

                    {/* Action Button */}
                    <View className="mt-4 pt-4 border-t border-gray-100">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-sm text-gray-600">
                          Class: {test.class}
                        </Text>
                        <View className="flex-row items-center">
                          <Text className="text-primary-600 font-semibold mr-1">
                            Start Test
                          </Text>
                          <Ionicons name="arrow-forward" size={16} color="#3B82F6" />
                        </View>
                      </View>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
