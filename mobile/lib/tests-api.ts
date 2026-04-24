import api from './api';
import { Test, Question, TestAttempt, Answer } from '../types/test';

export const testsApi = {
  // Get all tests
  getTests: async (teacherId?: number, status?: string): Promise<Test[]> => {
    const params = new URLSearchParams();
    if (teacherId) params.append('teacherId', teacherId.toString());
    if (status) params.append('status', status);
    
    const response = await api.get(`/api/tests?${params.toString()}`);
    return response.data;
  },

  // Get a single test
  getTest: async (id: number): Promise<Test> => {
    const response = await api.get(`/api/tests/${id}`);
    return response.data;
  },

  // Get questions for a test
  getQuestions: async (testId: number): Promise<Question[]> => {
    const response = await api.get(`/api/tests/${testId}/questions`);
    return response.data;
  },

  // Start a test attempt
  startAttempt: async (testId: number, studentId: number): Promise<TestAttempt> => {
    const response = await api.post('/api/test-attempts', {
      testId,
      studentId,
      status: 'in_progress',
    });
    return response.data;
  },

  // Submit an answer
  submitAnswer: async (attemptId: number, questionId: number, answer: string): Promise<Answer> => {
    const response = await api.post('/api/answers', {
      attemptId,
      questionId,
      answer,
    });
    return response.data;
  },

  // Submit test attempt
  submitAttempt: async (attemptId: number): Promise<TestAttempt> => {
    const response = await api.patch(`/api/test-attempts/${attemptId}`, {
      status: 'submitted',
      endTime: new Date().toISOString(),
    });
    return response.data;
  },

  // Get test attempt
  getAttempt: async (attemptId: number): Promise<TestAttempt> => {
    const response = await api.get(`/api/test-attempts/${attemptId}`);
    return response.data;
  },
};
