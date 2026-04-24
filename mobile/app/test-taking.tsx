import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { testsApi } from '../lib/tests-api';
import { Question } from '../types/test';

export default function TestTakingScreen() {
  const router = useRouter();
  const { attemptId, testId } = useLocalSearchParams();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const queryClient = useQueryClient();

  const { data: test } = useQuery({
    queryKey: ['test', testId],
    queryFn: () => testsApi.getTest(parseInt(testId as string)),
  });

  const { data: questions = [] } = useQuery({
    queryKey: ['questions', testId],
    queryFn: () => testsApi.getQuestions(parseInt(testId as string)),
  });

  // Timer
  useEffect(() => {
    if (test) {
      setTimeRemaining(test.duration * 60); // Convert to seconds
    }
  }, [test]);

  useEffect(() => {
    if (timeRemaining <= 0) {
      handleSubmit();
      return;
    }

    const timer = setInterval(() => {
      setTimeRemaining((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      // Submit all answers
      const attemptIdNum = parseInt(attemptId as string);
      for (const [questionId, answer] of Object.entries(answers)) {
        await testsApi.submitAnswer(attemptIdNum, parseInt(questionId), answer);
      }
      // Submit attempt
      return testsApi.submitAttempt(attemptIdNum);
    },
    onSuccess: () => {
      Alert.alert('Success', 'Test submitted successfully!', [
        { text: 'OK', onPress: () => router.replace('/tests') },
      ]);
    },
  });

  const handleSubmit = () => {
    const unanswered = questions.length - Object.keys(answers).length;
    const message =
      unanswered > 0
        ? `You have ${unanswered} unanswered questions. Submit anyway?`
        : 'Submit your test?';

    Alert.alert('Submit Test', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Submit', onPress: () => submitMutation.mutate() },
    ]);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentQuestion = questions[currentQuestionIndex];

  if (!currentQuestion) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <Text className="text-gray-600">Loading questions...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header with Timer */}
      <View className="bg-white px-6 py-4 border-b border-gray-200">
        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-bold text-gray-900">
            Question {currentQuestionIndex + 1}/{questions.length}
          </Text>
          <View
            className={`px-4 py-2 rounded-full ${
              timeRemaining < 300 ? 'bg-red-100' : 'bg-blue-100'
            }`}
          >
            <Text
              className={`font-bold ${
                timeRemaining < 300 ? 'text-red-600' : 'text-blue-600'
              }`}
            >
              {formatTime(timeRemaining)}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 p-6">
        {/* Question Card */}
        <View className="bg-white rounded-xl p-6 shadow-sm mb-6">
          <View className="flex-row items-center justify-between mb-4">
            <View className="bg-primary-100 px-3 py-1 rounded-full">
              <Text className="text-primary-700 font-semibold text-xs uppercase">
                {currentQuestion.type}
              </Text>
            </View>
            <Text className="text-gray-600 font-semibold">
              {currentQuestion.marks} marks
            </Text>
          </View>

          <Text className="text-lg text-gray-900 leading-relaxed mb-6">
            {currentQuestion.text}
          </Text>

          {/* Answer Input */}
          {currentQuestion.type === 'mcq' && currentQuestion.options ? (
            <View className="space-y-3">
              {Object.entries(currentQuestion.options).map(([key, value]) => (
                <Pressable
                  key={key}
                  className={`p-4 rounded-lg border-2 ${
                    answers[currentQuestion.id] === key
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-gray-200 bg-white'
                  }`}
                  onPress={() =>
                    setAnswers({ ...answers, [currentQuestion.id]: key })
                  }
                >
                  <Text
                    className={`${
                      answers[currentQuestion.id] === key
                        ? 'text-primary-700 font-semibold'
                        : 'text-gray-700'
                    }`}
                  >
                    {key}. {value as string}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <TextInput
              className="border-2 border-gray-200 rounded-lg p-4 text-base min-h-32"
              placeholder="Type your answer here..."
              value={answers[currentQuestion.id] || ''}
              onChangeText={(text) =>
                setAnswers({ ...answers, [currentQuestion.id]: text })
              }
              multiline
              textAlignVertical="top"
            />
          )}
        </View>

        {/* Navigation Buttons */}
        <View className="flex-row gap-3 mb-6">
          <Pressable
            className={`flex-1 py-4 rounded-lg ${
              currentQuestionIndex === 0
                ? 'bg-gray-200'
                : 'bg-white border-2 border-gray-300'
            }`}
            onPress={() => setCurrentQuestionIndex(currentQuestionIndex - 1)}
            disabled={currentQuestionIndex === 0}
          >
            <Text
              className={`text-center font-semibold ${
                currentQuestionIndex === 0 ? 'text-gray-400' : 'text-gray-700'
              }`}
            >
              Previous
            </Text>
          </Pressable>

          {currentQuestionIndex < questions.length - 1 ? (
            <Pressable
              className="flex-1 bg-primary-600 py-4 rounded-lg"
              onPress={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
            >
              <Text className="text-white text-center font-semibold">
                Next
              </Text>
            </Pressable>
          ) : (
            <Pressable
              className="flex-1 bg-green-600 py-4 rounded-lg"
              onPress={handleSubmit}
              disabled={submitMutation.isPending}
            >
              <Text className="text-white text-center font-semibold">
                {submitMutation.isPending ? 'Submitting...' : 'Submit Test'}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Question Navigator */}
        <View className="bg-white rounded-xl p-6 shadow-sm">
          <Text className="text-base font-bold text-gray-900 mb-4">
            Question Navigator
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {questions.map((q, index) => (
              <Pressable
                key={q.id}
                className={`w-12 h-12 rounded-lg items-center justify-center ${
                  index === currentQuestionIndex
                    ? 'bg-primary-600'
                    : answers[q.id]
                    ? 'bg-green-100 border-2 border-green-600'
                    : 'bg-gray-100 border-2 border-gray-300'
                }`}
                onPress={() => setCurrentQuestionIndex(index)}
              >
                <Text
                  className={`font-semibold ${
                    index === currentQuestionIndex
                      ? 'text-white'
                      : answers[q.id]
                      ? 'text-green-700'
                      : 'text-gray-600'
                  }`}
                >
                  {index + 1}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
