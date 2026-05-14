# PersonalLearningPro Microservices Integration Guide

## Overview

PersonalLearningPro uses a unified microservices architecture that consolidates:

- **EduAI** (main web app + backend — includes native Study Arena)
- **IniClaw** (lightweight LLM proxy gateway — zero npm dependencies)

All services are orchestrated via Docker Compose and communicate through REST APIs, WebSockets, and webhooks.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Nginx Reverse Proxy                      │
│  (Routes: / → EduAI, /gateway/* → IniClaw)
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
    ┌───▼────┐          ┌────▼────┐          
    │ EduAI  │          │ IniClaw │          
    │ (5001) │          │ (4000)  │          
    └───┬────┘          └────┬────┘          
        │                    │                    
        └────────────────────┼────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
    ┌───▼────┐          ┌───▼────┐          ┌───▼────┐
    │ MongoDB │          │Cassandra│          │ Redis  │
    │ (27017) │          │ (9042)  │          │(6379)  │
    └────────┘          └────────┘          └────────┘
```

## Phase 1: Service Directories

### Step 1: Create Service Directories

```bash
# Run the setup script
bash scripts/setup-services.sh

# This creates:
# - services/iniclaw/
# - Placeholder Dockerfiles and package.json files
```

### Step 2: Move Your Code

```bash
# Copy IniClaw code
cp -r /path/to/ini_claw/* services/iniclaw/

# Update package.json files with actual dependencies
```

### Step 3: Update Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
# IniClaw Gateway
INICLAW_GATEWAY_URL=http://iniclaw-gateway:4000
BRIDGE_SECRET=<generate-with-openssl-rand-hex-32>

# MongoDB (Docker)
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=<secure-password>

# Firebase (shared across all services)
VITE_FIREBASE_API_KEY=<your-key>
VITE_FIREBASE_PROJECT_ID=<your-project>
FIREBASE_SERVICE_ACCOUNT_JSON=<base64-encoded-json>

# OpenAI
OPENAI_API_KEY=<your-key>
```

## Phase 2: Authentication & Identity Bridging

### Firebase JWT Token Flow

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │ 1. Sign in with Firebase
       │
       ▼
┌─────────────────────────────────────┐
│   Firebase Auth                     │
│   (Issues JWT token)                │
└──────┬──────────────────────────────┘
       │ 2. JWT token
       │
       ▼
┌─────────────────────────────────────┐
│   EduAI Backend                     │
│   (Verifies Firebase JWT)           │
│   (Proxies to Study Arena API)      │
└─────────────────────────────────────┘
```

### API Endpoints

**Create AI Classroom (native Study Arena):**

```bash
POST /api/ai-classroom/create
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "topic": "Calculus",
  "materials": ["textbook.pdf"],
  "sceneTypes": ["slides", "quiz"],
  "difficulty": "intermediate"
}

Response:
{
  "success": true,
  "classroom": {
    "id": "classroom-123",
    "status": "ready",
    "topic": "Calculus"
  }
}
```

**Get Classroom Details:**

```bash
GET /api/ai-classroom/classroom/:classroomId
Authorization: Bearer <firebase-jwt>
```

## Phase 3: Data Synchronization

### Webhook Events

IniClaw gateway can send webhooks to EduAI when:

1. **Lesson Completed**

   ```
   POST /api/webhooks/lesson-completed
   X-Signature: <hmac-sha256>

   {
     "event": "lesson_completed",
     "classroomId": "classroom-123",
     "userId": "user-456",
     "firebaseUid": "firebase-uid",
     "timestamp": 1234567890,
     "data": {
       "lessonId": "lesson-789",
       "duration": 3600,
       "weaknesses": ["topic-1", "topic-2"],
       "strengths": ["topic-3"],
       "nextTopics": ["topic-4"]
     }
   }
   ```

2. **Quiz Completed**

   ```
   POST /api/webhooks/quiz-completed

   {
     "event": "quiz_completed",
     "classroomId": "classroom-123",
     "userId": "user-456",
     "firebaseUid": "firebase-uid",
     "timestamp": 1234567890,
     "data": {
       "quizId": "quiz-123",
       "score": 85,
       "duration": 1800,
       "weaknesses": ["topic-1"],
       "strengths": ["topic-2", "topic-3"]
     }
   }
   ```

3. **Session Ended**

   ```
   POST /api/webhooks/session-ended

   {
     "event": "session_ended",
     "classroomId": "classroom-123",
     "userId": "user-456",
     "firebaseUid": "firebase-uid",
     "timestamp": 1234567890,
     "data": {
       "duration": 5400,
       "nextTopics": ["topic-4", "topic-5"]
     }
   }
   ```

### Data Storage

Webhook data is stored in MongoDB:

- **Analytics Collection**: Records all events
- **Test Attempts**: Quiz results stored as test attempts
- **User Profile**: Weaknesses and strengths tracked for study plan generation

### Webhook Verification

All webhooks are signed with HMAC-SHA256:

```typescript
const signature = crypto
  .createHmac("sha256", BRIDGE_SECRET)
  .update(JSON.stringify(payload))
  .digest("hex");

const isValid = verifySignature(payload, signature);
```

## Running the Services

### Development (with Docker)

```bash
# Start all services
docker compose up

# Services will be available at:
# - EduAI: http://localhost:5001
# - IniClaw: http://localhost:4000 (or http://localhost:5001/gateway)
# - Nginx: http://localhost:80
```

### Development (without Docker)

```bash
# Terminal 1: EduAI main app (includes native Study Arena)
npm run dev

# Terminal 2: IniClaw gateway (optional LLM proxy)
cd features/ai-classroom/ini_claw
BRIDGE_SECRET=<your-secret> INICLAW_PORT=7070 node gateway.js
```

### Production

```bash
# Build and start production services
docker compose --profile prod up

# Services will be behind Nginx reverse proxy
# - http://yourdomain.com → EduAI
# - http://yourdomain.com/gateway → IniClaw
```

## Monitoring & Debugging

### Health Checks

```bash
# EduAI
curl http://localhost:5001/api/health

# IniClaw
curl http://localhost:4000/api/health
curl http://localhost:7070/health
```

### Logs

```bash
# View all service logs
docker compose logs -f

# View specific service logs
docker compose logs -f eduai-app
docker compose logs -f iniclaw-gateway
```

### Database Access

```bash
# MongoDB
mongosh mongodb://admin:password@localhost:27017/eduai

# Cassandra
cqlsh localhost 9042

# Redis
redis-cli -h localhost -p 6379
```

## Troubleshooting

### Webhook Signature Verification Failed

```bash
# Verify BRIDGE_SECRET matches in both services
echo $BRIDGE_SECRET

# Check webhook payload in logs
docker compose logs iniclaw-gateway | grep webhook
```

### Authentication Issues

```bash
# Verify Firebase credentials
echo $FIREBASE_SERVICE_ACCOUNT_JSON | base64 -d | jq .

# Check token verification
curl -H "Authorization: Bearer <token>" http://localhost:5001/api/auth/me
```

## Security Considerations

1. **BRIDGE_SECRET**: Generate a strong random string

   ```bash
   openssl rand -hex 32
   ```

2. **Webhook Signatures**: Always verify HMAC-SHA256 signatures

3. **CORS**: Configure allowed origins in `.env`

   ```
   CORS_ORIGIN=https://yourdomain.com
   ```

4. **SSL/TLS**: Use HTTPS in production
   - Place certificates in `./nginx-ssl/`
   - Update `nginx.conf` with certificate paths

5. **Rate Limiting**: Configured per endpoint
   - `/api/ai`: 20 req/s
   - `/api/auth`: 10 req/s
   - `/gateway`: 30 req/s

## Next Steps

1. ✅ Set up Docker Compose (done)
2. ✅ Native Study Arena replaces external dependency for core classroom generation
3. ✅ IniClaw rewritten as lightweight LLM proxy (zero npm deps, no Docker/sandbox required)
4. ✅ All 25 API integration tests passing
5. ⏳ Deploy to production

## References

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [Webhook Security](https://docs.github.com/en/developers/webhooks-and-events/webhooks/securing-your-webhooks)
