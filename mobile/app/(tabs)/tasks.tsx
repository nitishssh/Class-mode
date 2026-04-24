import { View, Text, FlatList, Pressable, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '../../lib/tasks-api';
import { Task, TaskStatus } from '../../types/task';
import { useRouter } from 'expo-router';

export default function TasksScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();

  // Fetch tasks
  const { data: tasks = [], isLoading, error, refetch } = useQuery({
    queryKey: ['tasks'],
    queryFn: tasksApi.getTasks,
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: TaskStatus }) =>
      tasksApi.updateTask(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: tasksApi.deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleStatusChange = useCallback((task: Task) => {
    const statusOptions: TaskStatus[] = ['todo', 'in-progress', 'review', 'done'];
    const currentIndex = statusOptions.indexOf(task.status);
    const nextStatus = statusOptions[(currentIndex + 1) % statusOptions.length];
    
    updateTaskMutation.mutate({ id: task.id, status: nextStatus });
  }, [updateTaskMutation]);

  const handleDelete = useCallback((task: Task) => {
    Alert.alert(
      'Delete Task',
      `Are you sure you want to delete "${task.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteTaskMutation.mutate(task.id),
        },
      ]
    );
  }, [deleteTaskMutation]);

  const getStatusColor = useCallback((status: TaskStatus) => {
    switch (status) {
      case 'done':
        return 'bg-green-100 text-green-800';
      case 'in-progress':
        return 'bg-blue-100 text-blue-800';
      case 'review':
        return 'bg-purple-100 text-purple-800';
      case 'todo':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }, []);

  const getStatusIcon = useCallback((status: TaskStatus) => {
    switch (status) {
      case 'done':
        return 'checkmark-circle';
      case 'in-progress':
        return 'time';
      case 'review':
        return 'eye';
      default:
        return 'ellipse-outline';
    }
  }, []);

  const getPriorityColor = useCallback((priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'text-red-600';
      case 'high':
        return 'text-orange-600';
      case 'medium':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  }, []);

  const remainingTasks = useMemo(
    () => tasks.filter((t) => t.status !== 'done').length,
    [tasks]
  );

  const renderTask = useCallback(({ item: task }: { item: Task }) => (
    <Pressable
      className="bg-white rounded-lg p-4 shadow-sm mb-3"
      onLongPress={() => handleDelete(task)}
      accessibilityLabel={`Task: ${task.title}`}
      accessibilityHint="Long press to delete"
      accessibilityRole="button"
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-gray-900 font-medium text-base mb-2">
            {task.title}
          </Text>
          <View className="flex-row items-center flex-wrap gap-2">
            {task.dueDate && (
              <View className="flex-row items-center">
                <Ionicons name="calendar-outline" size={14} color="#9CA3AF" />
                <Text className="text-gray-500 text-sm ml-1">
                  {new Date(task.dueDate).toLocaleDateString()}
                </Text>
              </View>
            )}
            <View className="flex-row items-center">
              <Ionicons
                name="flag"
                size={14}
                className={getPriorityColor(task.priority)}
              />
              <Text className={`text-sm ml-1 capitalize ${getPriorityColor(task.priority)}`}>
                {task.priority}
              </Text>
            </View>
          </View>
        </View>
        <Pressable
          onPress={() => handleStatusChange(task)}
          accessibilityLabel={`Change status from ${task.status}`}
          accessibilityRole="button"
        >
          <Ionicons
            name={getStatusIcon(task.status) as any}
            size={28}
            color={task.status === 'done' ? '#10B981' : '#3B82F6'}
          />
        </Pressable>
      </View>
      <View className="mt-3 flex-row items-center justify-between">
        <View className={`px-3 py-1 rounded-full ${getStatusColor(task.status)}`}>
          <Text className="text-xs font-medium capitalize">
            {task.status.replace('-', ' ')}
          </Text>
        </View>
        {task.tags.length > 0 && (
          <View className="flex-row gap-1">
            {task.tags.slice(0, 2).map((tag, index) => (
              <View key={index} className="bg-gray-100 px-2 py-1 rounded">
                <Text className="text-xs text-gray-600">{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </Pressable>
  ), [handleDelete, handleStatusChange, getStatusColor, getStatusIcon, getPriorityColor]);

  const renderEmpty = useCallback(() => (
    <View className="bg-white rounded-lg p-8 items-center">
      <Ionicons name="checkmark-done-circle" size={64} color="#D1D5DB" />
      <Text className="text-gray-900 font-semibold text-lg mt-4">
        No tasks yet
      </Text>
      <Text className="text-gray-600 text-center mt-2">
        Create your first task to get started
      </Text>
    </View>
  ), []);

  const renderHeader = useCallback(() => (
    <View className="mb-6">
      <Text className="text-2xl font-bold text-gray-900">My Tasks</Text>
      <Text className="text-gray-600 mt-1">
        {remainingTasks} tasks remaining
      </Text>
    </View>
  ), [remainingTasks]);

  const renderFooter = useCallback(() => (
    <Pressable
      className="bg-primary-600 rounded-lg py-4 mt-6"
      onPress={() => router.push('/create-task')}
      accessibilityLabel="Add new task"
      accessibilityRole="button"
    >
      <Text className="text-white text-center font-semibold">
        Add New Task
      </Text>
    </Pressable>
  ), [router]);

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <Text className="text-gray-600">Loading tasks...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50 p-6">
        <Ionicons name="alert-circle" size={48} color="#EF4444" />
        <Text className="text-gray-900 font-semibold text-lg mt-4">
          Failed to load tasks
        </Text>
        <Text className="text-gray-600 text-center mt-2">
          {error instanceof Error ? error.message : 'Unknown error'}
        </Text>
        <Pressable
          className="bg-primary-600 rounded-lg px-6 py-3 mt-4"
          onPress={() => refetch()}
          accessibilityLabel="Try again"
          accessibilityRole="button"
        >
          <Text className="text-white font-semibold">Try Again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        data={tasks}
        renderItem={renderTask}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        contentContainerStyle={{ padding: 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={10}
      />
    </View>
  );
}
