/**
 * API Testing Script for Mobile App
 * 
 * This script tests all critical API endpoints to ensure
 * the mobile app can communicate with the backend properly.
 * 
 * Run with: npx ts-node scripts/test-api.ts
 */

import axios from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'password123';

let authToken: string | null = null;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

interface TestResult {
  endpoint: string;
  method: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  statusCode?: number;
  error?: string;
}

const results: TestResult[] = [];

function logTest(result: TestResult) {
  results.push(result);
  const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${icon} ${result.method} ${result.endpoint} - ${result.status}${result.statusCode ? ` (${result.statusCode})` : ''}`);
  if (result.error) {
    console.log(`   Error: ${result.error}`);
  }
}

async function testEndpoint(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  endpoint: string,
  data?: any,
  expectedStatus: number = 200
): Promise<any> {
  try {
    const response = await api.request({
      method,
      url: endpoint,
      data,
    });

    if (response.status === expectedStatus) {
      logTest({ endpoint, method, status: 'PASS', statusCode: response.status });
      return response.data;
    } else {
      logTest({
        endpoint,
        method,
        status: 'FAIL',
        statusCode: response.status,
        error: `Expected ${expectedStatus}, got ${response.status}`,
      });
      return null;
    }
  } catch (error: any) {
    logTest({
      endpoint,
      method,
      status: 'FAIL',
      statusCode: error.response?.status,
      error: error.message,
    });
    return null;
  }
}

async function runTests() {
  console.log('\n🚀 Starting API Tests for Mobile App\n');
  console.log(`API Base URL: ${API_BASE_URL}\n`);

  // Test 1: Health Check
  console.log('📋 Testing Health Endpoints...');
  await testEndpoint('GET', '/api/health');

  // Test 2: Authentication (Mock - requires Firebase)
  console.log('\n🔐 Testing Authentication...');
  console.log('⏭️ Skipping Firebase auth (requires real credentials)');
  logTest({ endpoint: '/api/auth/login', method: 'POST', status: 'SKIP' });

  // For testing purposes, we'll use a mock token
  // In real scenario, this would come from Firebase
  authToken = 'mock-token-for-testing';

  // Test 3: User Profile
  console.log('\n👤 Testing User Endpoints...');
  await testEndpoint('GET', '/api/users/me', undefined, 401); // Should fail without real auth

  // Test 4: Tasks
  console.log('\n📝 Testing Task Endpoints...');
  await testEndpoint('GET', '/api/tasks', undefined, 401);
  await testEndpoint('POST', '/api/tasks', {
    title: 'Test Task',
    status: 'todo',
    priority: 'medium',
  }, 401);

  // Test 5: Tests
  console.log('\n📚 Testing Test Endpoints...');
  await testEndpoint('GET', '/api/tests', undefined, 401);

  // Test 6: Notifications
  console.log('\n🔔 Testing Notification Endpoints...');
  await testEndpoint('GET', '/api/notifications', undefined, 401);

  // Test 7: Push Tokens
  console.log('\n📱 Testing Push Token Endpoints...');
  await testEndpoint('POST', '/api/push-tokens', {
    token: 'ExponentPushToken[test-token]',
    deviceType: 'mobile',
  }, 401);

  // Test 8: OCR
  console.log('\n📷 Testing OCR Endpoints...');
  await testEndpoint('POST', '/api/ocr/extract', {
    image: 'base64-encoded-image-data',
  }, 401);

  // Test 9: AI Chat
  console.log('\n🤖 Testing AI Chat Endpoints...');
  await testEndpoint('POST', '/api/ai-chat', {
    messages: [
      { role: 'user', content: 'Hello' },
    ],
  }, 401);

  // Test 10: Study Plans
  console.log('\n📖 Testing Study Plan Endpoints...');
  await testEndpoint('POST', '/api/ai/study-plan', {}, 401);

  // Test 11: Analytics
  console.log('\n📊 Testing Analytics Endpoints...');
  await testEndpoint('GET', '/api/dashboards/student', undefined, 401);

  // Test 12: Messages
  console.log('\n💬 Testing Message Endpoints...');
  await testEndpoint('GET', '/api/workspaces', undefined, 401);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  const total = results.length;

  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`\nSuccess Rate: ${((passed / (total - skipped)) * 100).toFixed(1)}%`);

  console.log('\n💡 Notes:');
  console.log('- Most endpoints require authentication (401 expected)');
  console.log('- To test authenticated endpoints, use real Firebase credentials');
  console.log('- WebSocket connections are not tested in this script');
  console.log('- Run the backend server before running these tests');

  console.log('\n✨ API testing complete!\n');
}

// Run tests
runTests().catch(console.error);
