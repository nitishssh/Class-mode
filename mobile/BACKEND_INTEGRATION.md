# Backend Integration Guide

## Overview
This document describes how the React Native mobile app integrates with the Express backend server.

## Authentication

### Firebase Authentication
The mobile app uses Firebase Authentication for user management:

1. **Login/Register**: Users authenticate through Firebase
2. **Token Generation**: Firebase provides an ID token
3. **Backend Verification**: Server verifies the token using Firebase Admin SDK
4. **Session Creation**: Server creates a session with user data

### Token Flow
```typescript
// Mobile app sends token in Authorization header
headers: {
  'Authorization': `Bearer ${firebaseIdToken}`
}

// Server verifies token in authenticateToken middleware
const token = req.headers.authorization?.split(" ")[1];
const decodedToken = await verifyFirebaseToken(token);
```

### API Client Configuration
```typescript
// mobile/lib/api.ts
import axios from 'axios';
import { auth } from './firebase';

export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to all requests
api.interceptors.request.use(async (config) => {
  const user = auth?.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

## CORS Configuration

### Server Setup
The backend is configured to accept requests from mobile apps:

```typescript
// server/index.ts
const mobileOrigins = [
  'exp://localhost:8081',      // Expo Go development
  'exp://192.168.*',           // Expo Go on local network
  'capacitor://localhost',     // Capacitor iOS
  'http://localhost',          // Capacitor Android
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // Allow mobile apps
    // ... check allowed origins
  },
  credentials: true,
}));
```

### Environment Variables
```bash
# .env
CORS_ORIGIN=http://localhost:5001,exp://localhost:8081
```

## API Endpoints

### Authentication
- `POST /api/auth/sync-profile` - Sync Firebase user to MongoDB

### User Management
- `GET /api/users/me` - Get current user profile
- `PATCH /api/users/:id` - Update user profile

### Tasks
- `GET /api/tasks` - List user tasks
- `POST /api/tasks` - Create new task
- `PATCH /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Tests & Assessments
- `GET /api/tests` - List available tests
- `GET /api/tests/:id` - Get test details
- `GET /api/tests/:testId/questions` - Get test questions
- `POST /api/test-attempts` - Start test attempt
- `PATCH /api/test-attempts/:id` - Submit test
- `POST /api/answers` - Submit answer

### AI Features
- `POST /api/ai-chat` - Chat with AI tutor
- `POST /api/ai/study-plan` - Generate study plan
- `POST /api/ai/performance-analysis` - Analyze performance
- `POST /api/ai/generate-test` - Generate test questions

### Notifications
- `GET /api/notifications` - List notifications
- `PATCH /api/notifications/:id/read` - Mark as read
- `PATCH /api/notifications/read-all` - Mark all as read
- `DELETE /api/notifications/:id` - Delete notification

### Push Notifications
- `POST /api/push-tokens` - Register push token
- `DELETE /api/push-tokens` - Remove push token

### OCR
- `POST /api/ocr/extract` - Extract text from image

### Messages
- `GET /api/workspaces` - List workspaces
- `GET /api/channels` - List channels
- `GET /api/channels/:id/messages` - Get messages

### Analytics
- `GET /api/dashboards/student` - Student dashboard data
- `GET /api/dashboards/teacher` - Teacher dashboard data

### Study Plans
- `GET /api/study-plans` - List study plans
- `POST /api/study-plans` - Create study plan

## WebSocket Integration

### Chat WebSocket
```typescript
// Connection
const ws = new WebSocket('ws://localhost:5000/chat');

// Authentication
ws.send(JSON.stringify({
  type: 'auth',
  token: firebaseIdToken
}));

// Send message
ws.send(JSON.stringify({
  type: 'message',
  channelId: 123,
  content: 'Hello'
}));
```

### Message Events
- `auth` - Authenticate connection
- `message` - Send/receive messages
- `typing` - Typing indicators
- `read` - Mark messages as read

## Error Handling

### Standard Error Responses
```json
{
  "message": "Error description",
  "code": "ERROR_CODE"
}
```

### Common Status Codes
- `200` - Success
- `201` - Created
- `204` - No Content (successful deletion)
- `400` - Bad Request (validation error)
- `401` - Unauthorized (not authenticated)
- `403` - Forbidden (not authorized)
- `404` - Not Found
- `500` - Internal Server Error

### Mobile Error Handling
```typescript
try {
  const response = await api.get('/api/tasks');
  return response.data;
} catch (error) {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) {
      // Redirect to login
      router.replace('/(auth)/login');
    } else {
      // Show error message
      Alert.alert('Error', error.response?.data?.message);
    }
  }
}
```

## Offline Support

### Data Caching
```typescript
// Fetch with offline fallback
const { data, fromCache } = await fetchTasksOffline();

if (fromCache) {
  // Show offline indicator
  console.log('Using cached data');
}
```

### Offline Queue
```typescript
// Queue mutation when offline
await addToOfflineQueue({
  type: 'CREATE',
  endpoint: '/api/tasks',
  data: taskData,
});

// Sync when back online
await syncOfflineQueue();
```

## Rate Limiting

### Limits
- AI endpoints: 20 requests/minute
- Auth endpoints: 10 requests/minute
- Other endpoints: No limit (general rate limiting applies)

### Handling Rate Limits
```typescript
if (error.response?.status === 429) {
  // Too many requests
  Alert.alert('Slow Down', 'Please wait a moment before trying again');
}
```

## Testing

### Running API Tests
```bash
cd mobile
npx ts-node scripts/test-api.ts
```

### Manual Testing with Postman
1. Get Firebase ID token from mobile app
2. Add to Authorization header: `Bearer <token>`
3. Test endpoints

### Testing WebSocket
```javascript
// Use wscat or similar tool
wscat -c ws://localhost:5000/chat
> {"type":"auth","token":"<firebase-token>"}
```

## Environment Configuration

### Mobile App (.env)
```bash
EXPO_PUBLIC_API_URL=http://localhost:5000
EXPO_PUBLIC_WS_URL=ws://localhost:5000
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
```

### Backend (.env)
```bash
PORT=5000
CORS_ORIGIN=http://localhost:5001,exp://localhost:8081
SESSION_SECRET=your-secret-key
FIREBASE_PROJECT_ID=...
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...
```

## Deployment Considerations

### Production URLs
```bash
# Mobile app
EXPO_PUBLIC_API_URL=https://api.yourapp.com
EXPO_PUBLIC_WS_URL=wss://api.yourapp.com

# Backend
CORS_ORIGIN=https://yourapp.com,https://www.yourapp.com
```

### SSL/TLS
- Use HTTPS for API in production
- Use WSS for WebSocket in production
- Configure SSL certificates on server

### Load Balancing
- WebSocket sticky sessions required
- Session store must be shared (Redis recommended)
- Consider using Socket.IO for better mobile support

## Troubleshooting

### Common Issues

#### 1. CORS Errors
```
Access to XMLHttpRequest has been blocked by CORS policy
```
**Solution**: Add mobile origin to CORS_ORIGIN environment variable

#### 2. Authentication Failures
```
401 Unauthorized
```
**Solution**: 
- Check Firebase token is valid
- Verify token is sent in Authorization header
- Ensure Firebase Admin SDK is configured

#### 3. WebSocket Connection Fails
```
WebSocket connection failed
```
**Solution**:
- Check WebSocket URL (ws:// not http://)
- Verify server is running
- Check firewall/network settings

#### 4. Offline Sync Issues
```
Failed to sync offline queue
```
**Solution**:
- Check network connectivity
- Verify API endpoints are accessible
- Clear offline queue if corrupted

## Performance Optimization

### Request Batching
```typescript
// Batch multiple requests
const [tasks, tests, notifications] = await Promise.all([
  api.get('/api/tasks'),
  api.get('/api/tests'),
  api.get('/api/notifications'),
]);
```

### Response Caching
```typescript
// Use React Query for automatic caching
const { data, isLoading } = useQuery({
  queryKey: ['tasks'],
  queryFn: () => api.get('/api/tasks'),
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

### Image Optimization
```typescript
// Compress images before upload
const compressedImage = await ImageManipulator.manipulateAsync(
  imageUri,
  [{ resize: { width: 1024 } }],
  { compress: 0.7, format: SaveFormat.JPEG }
);
```

## Security Best Practices

1. **Never store sensitive data in AsyncStorage**
2. **Always use HTTPS in production**
3. **Validate all user input**
4. **Implement request signing for critical operations**
5. **Use secure token storage (Expo SecureStore)**
6. **Implement certificate pinning for production**
7. **Add request timeout limits**
8. **Sanitize error messages (don't expose internals)**

## Monitoring & Logging

### Client-Side Logging
```typescript
// Log API errors
api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.message,
    });
    return Promise.reject(error);
  }
);
```

### Server-Side Logging
```typescript
// Already implemented in server/index.ts
app.use(logger.requestLogger);
```

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [Axios Documentation](https://axios-http.com/)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Express CORS](https://expressjs.com/en/resources/middleware/cors.html)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
