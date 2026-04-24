import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '../lib/tasks-api';
import { TaskStatus, TaskPriority } from '../types/task';

export default function CreateTaskScreen() {
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const router = useRouter();
  const queryClient = useQueryClient();

  const createTaskMutation = useMutation({
    mutationFn: tasksApi.createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      router.back();
    },
    onError: (error) => {
      Alert.alert('Error', 'Failed to create task. Please try again.');
      console.error('Create task error:', error);
    },
  });

  const handleCreate = () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a task title');
      return;
    }

    createTaskMutation.mutate({
      title: title.trim(),
      status,
      priority,
      dueDate: dueDate || null,
    });
  };

  const statusOptions: { value: TaskStatus; label: string; icon: string }[] = [
    { value: 'todo', label: 'To Do', icon: 'ellipse-outline' },
    { value: 'in-progress', label: 'In Progress', icon: 'time' },
    { value: 'review', label: 'Review', icon: 'eye' },
    { value: 'done', label: 'Done', icon: 'checkmark-circle' },
  ];

  const priorityOptions: { value: TaskPriority; label: string; color: string }[] = [
    { value: 'low', label: 'Low', color: '#10B981' },
    { value: 'medium', label: 'Medium', color: '#F59E0B' },
    { value: 'high', label: 'High', color: '#EF4444' },
    { value: 'urgent', label: 'Urgent', color: '#DC2626' },
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 py-4 border-b border-gray-200">
          <Pressable onPress={() => router.back()}>
            <Ionicons name="close" size={28} color="#374151" />
          </Pressable>
          <Text className="text-xl font-bold text-gray-900">New Task</Text>
          <Pressable
            onPress={handleCreate}
            disabled={createTaskMutation.isPending}
          >
            <Text
              className={`text-lg font-semibold ${
                createTaskMutation.isPending ? 'text-gray-400' : 'text-primary-600'
              }`}
            >
              {createTaskMutation.isPending ? 'Creating...' : 'Create'}
            </Text>
          </Pressable>
        </View>

        <View className="p-6 space-y-6">
          {/* Title */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Task Title
            </Text>
            <TextInput
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-base"
              placeholder="Enter task title..."
              value={title}
              onChangeText={setTitle}
              autoFocus
            />
          </View>

          {/* Status */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-3">
              Status
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {statusOptions.map((option) => (
                <Pressable
                  key={option.value}
                  className={`flex-row items-center px-4 py-2 rounded-lg border ${
                    status === option.value
                      ? 'bg-primary-50 border-primary-600'
                      : 'bg-white border-gray-300'
                  }`}
                  onPress={() => setStatus(option.value)}
                >
                  <Ionicons
                    name={option.icon as any}
                    size={18}
                    color={status === option.value ? '#3B82F6' : '#9CA3AF'}
                  />
                  <Text
                    className={`ml-2 ${
                      status === option.value
                        ? 'text-primary-600 font-semibold'
                        : 'text-gray-700'
                    }`}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Priority */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-3">
              Priority
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {priorityOptions.map((option) => (
                <Pressable
                  key={option.value}
                  className={`flex-row items-center px-4 py-2 rounded-lg border ${
                    priority === option.value
                      ? 'bg-primary-50 border-primary-600'
                      : 'bg-white border-gray-300'
                  }`}
                  onPress={() => setPriority(option.value)}
                >
                  <Ionicons
                    name="flag"
                    size={18}
                    color={priority === option.value ? option.color : '#9CA3AF'}
                  />
                  <Text
                    className={`ml-2 ${
                      priority === option.value
                        ? 'text-primary-600 font-semibold'
                        : 'text-gray-700'
                    }`}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Due Date */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Due Date (Optional)
            </Text>
            <TextInput
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-base"
              placeholder="YYYY-MM-DD"
              value={dueDate}
              onChangeText={setDueDate}
              keyboardType="numbers-and-punctuation"
            />
            <Text className="text-xs text-gray-500 mt-1">
              Format: YYYY-MM-DD (e.g., 2026-04-15)
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
