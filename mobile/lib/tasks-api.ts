import api from './api';
import { Task, CreateTaskInput, UpdateTaskInput } from '../types/task';

export const tasksApi = {
  // Get all tasks for current user
  getTasks: async (): Promise<Task[]> => {
    const response = await api.get('/api/tasks');
    return response.data;
  },

  // Create a new task
  createTask: async (input: CreateTaskInput): Promise<Task> => {
    const response = await api.post('/api/tasks', input);
    return response.data;
  },

  // Update a task
  updateTask: async (id: number, input: UpdateTaskInput): Promise<Task> => {
    const response = await api.patch(`/api/tasks/${id}`, input);
    return response.data;
  },

  // Delete a task
  deleteTask: async (id: number): Promise<void> => {
    await api.delete(`/api/tasks/${id}`);
  },
};
