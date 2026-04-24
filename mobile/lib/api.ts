import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../constants/config';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Error getting auth token:', error);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - clear it
      await SecureStore.deleteItemAsync('authToken');
    }
    return Promise.reject(error);
  }
);

// Auth token management
export const setAuthToken = async (token: string) => {
  await SecureStore.setItemAsync('authToken', token);
};

export const getAuthToken = async () => {
  return await SecureStore.getItemAsync('authToken');
};

export const clearAuthToken = async () => {
  await SecureStore.deleteItemAsync('authToken');
};

export default api;
