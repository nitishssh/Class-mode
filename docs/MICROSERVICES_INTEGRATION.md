# PersonalLearningPro Microservices Integration Guide

## Overview

PersonalLearningPro now uses a unified microservices architecture that consolidates:

- **EduAI** (main web app + backend)
- **OpenMAIC** (studyArena AI classroom)
- **IniClaw** (agent gateway runtime)

All services are orchestrated via Docker Compose and communicate through REST APIs, WebSockets, and webhooks.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Nginx Reverse Proxy                      │
│  (Routes: / → EduAI, /arena/* → OpenMAIC, /gateway/* → IniClaw)
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
    ┌───▼────┐          ┌────▼────┐          ┌────▼────┐
    │ EduAI  │          │ OpenMAIC │          │ IniClaw │
    │ (5001) │          │  (3000)  │          │ (4000)  │
    └───┬────┘          └────┬────┘          └────┬────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
    ┌───▼────┐          ┌───▼────┐          ┌───▼────┐
    │ MongoDB │          │Cassandra│          │ Redis  │
    │ (27017) │          │ (9042)  │          │(6379)  │
    └────────┘          └────────┘          └────────┘
```

## Phase 1: Repository Merge

### Step 1: Create Service Directories

```bash
# Run the setup script
bash scripts/setup-services.sh

# This creates:
# - services/openmaic/
# - services/iniclaw/
# - Placeholder Dockerfiles and package.json files
```

### Step 2: Move Your Code

```bash
# Copy OpenMAIC (studyArena) code
cp -r /path/to/studyArena/* services/openmaic/

# Copy IniClaw code
cp -r /path/to/ini_claw/* services/iniclaw/

# Update package.json files with actual dependencies
```

### Step 3: Update Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
# OpenMAIC Integration
OPENMAIC_INTERNAL_URL=http://openmaic-web:3000
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
│   (Generates OpenMAIC session token)│
└──────┬──────────────────────────────┘
       │ 3. OpenMAIC session token
       │
       ▼
┌─────────────────────────────────────┐
│   OpenMAIC                          │
│   (Validates session token)         │
│   (Personalizes AI teacher)         │
└─────────────────────────────────────┘
```

### Implementation

The authentication bridge is implemented in `server/lib/openmaic-auth-bridge.ts`:

```typescript
// Generate OpenMAIC session token
const token = await generateOpenMAICSessionToken(firebaseUid);

// Verify OpenMAIC session token
const decoded = verifyOpenMAICSessionToken(token);

// Generate classroom URL with embedded token
const url = generateOpenMAICClassroomUrl(classroomId, token);
```

### API Endpoints

**Create OpenMAIC Session:**
```bash
POST /api/openmaic/classroom/create
Authorization: Bearer <firebase-jwt>
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
    "url": "http://localhost:3000/classroom/classroom-123?token=...",
    "topic": "Calculus"
  }
}
```

**Get Classroom Details:**
```bash
GET /api/openmaic/classroom/:classroomId
Authorization: Bearer <firebase-jwt>
```

**Generate Classroom Embed:**
```bash
POST /api/openmaic/classroom/:classroomId/embed
Authorization: Bearer <firebase-jwt>
Content-Type: application/json

{
  "width": "100%",
  "height": "600px"
}

Response:
{
  "success": true,
  "embed": "<iframe src=\"...\" ...></iframe>"
}
```

## Phase 3: Backend & Data Synchronization

### Webhook Events

OpenMAIC sends webhooks to EduAI when:

1. **Lesson Completed**
   ```
   POST /api/webhooks/openmaic/lesson-completed
   X-OpenMAIC-Signature: <hmac-sha256>
   
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
   POST /api/webhooks/openmaic/quiz-completed
   
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
   POST /api/webhooks/openmaic/session-ended
   
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

- **Analytics Collection**: Records all OpenMAIC events
- **Test Attempts**: Quiz results stored as test attempts
- **User Profile**: Weaknesses and strengths tracked for study plan generation

### Webhook Verification

All webhooks are signed with HMAC-SHA256:

```typescript
// OpenMAIC signs the payload
const signature = crypto
  .createHmac('sha256', BRIDGE_SECRET)
  .update(JSON.stringify(payload))
  .digest('hex');

// EduAI verifies the signature
const isValid = verifyOpenMAICWebhookSignature(payload, signature);
```

## Phase 4: UI/UX Harmonization

### Design System Alignment

Both EduAI and OpenMAIC use Tailwind CSS. Ensure consistency:

**EduAI Theme:**
- Colors: Radix UI palette
- Typography: Inter font
- Components: shadcn/ui

**OpenMAIC Theme:**
- Colors: Tailwind v4 (align with EduAI)
- Typography: Inter font
- Components: Custom or shadcn/ui

### Navigation Integration

Add "Back to Dashboard" button in OpenMAIC:

```tsx
// In OpenMAIC classroom component
<button
  onClick={() => window.location.href = '/'}
  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"
>
  <ArrowLeft size={18} />
  Back to Dashboard
</button>
```

### Deep Linking

EduAI can create deep links to OpenMAIC classrooms:

```tsx
// In EduAI Study Plan component
const handleEnterClassroom = async (topic: string) => {
  const response = await fetch('/api/openmaic/classroom/create', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ topic })
  });
  
  const { classroom } = await response.json();
  window.location.href = classroom.url;
};
```

## Phase 5: Feature Mapping

### Study Plan Generator → OpenMAIC Classrooms

```
EduAI Study Plan
    ↓
Identifies weak topics
    ↓
Creates OpenMAIC classroom for each topic
    ↓
Generates deep links
    ↓
Student clicks → Enters AI classroom
    ↓
AI teacher personalizes based on weaknesses
    ↓
Lesson completion → Webhook to EduAI
    ↓
Analytics updated → Study plan adjusted
```

### MessagePal → IniClaw Integration

```
EduAI Chat Interface
    ↓
Student asks question
    ↓
Routes to IniClaw gateway
    ↓
IniClaw routes to appropriate agent
    ↓
Agent responds
    ↓
Response sent back to EduAI chat
```

## Running the Services

### Development (with Docker)

```bash
# Start all services
docker compose up

# Services will be available at:
# - EduAI: http://localhost:5001
# - OpenMAIC: http://localhost:3000 (or http://localhost:5001/arena)
# - IniClaw: http://localhost:4000 (or http://localhost:5001/gateway)
# - Nginx: http://localhost:80
```

### Development (without Docker)

```bash
# Terminal 1: EduAI main app
npm run dev

# Terminal 2: OpenMAIC
cd services/openmaic
npm run dev

# Terminal 3: IniClaw
cd services/iniclaw
npm run dev
```

### Production

```bash
# Build and start production services
docker compose --profile prod up

# Services will be behind Nginx reverse proxy
# - http://yourdomain.com → EduAI
# - http://yourdomain.com/arena → OpenMAIC
# - http://yourdomain.com/gateway → IniClaw
```

## Monitoring & Debugging

### Health Checks

```bash
# EduAI
curl http://localhost:5001/api/health

# OpenMAIC
curl http://localhost:3000/api/health

# IniClaw
curl http://localhost:4000/api/health

# OpenMAIC API
curl http://localhost:5001/api/openmaic/health
```

### Logs

```bash
# View all service logs
docker compose logs -f

# View specific service logs
docker compose logs -f eduai-app
docker compose logs -f openmaic-web
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

### OpenMAIC Service Unavailable

```bash
# Check if service is running
docker compose ps openmaic-web

# Check logs
docker compose logs openmaic-web

# Restart service
docker compose restart openmaic-web
```

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
   CORS_ORIGIN=https://yourdomain.com,https://arena.yourdomain.com
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
2. ✅ Create authentication bridge (done)
3. ✅ Implement webhook handlers (done)
4. ⏳ Move OpenMAIC code to `services/openmaic/`
5. ⏳ Move IniClaw code to `services/iniclaw/`
6. ⏳ Update service package.json files
7. ⏳ Test end-to-end integration
8. ⏳ Deploy to production

## References

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [Webhook Security](https://docs.github.com/en/developers/webhooks-and-events/webhooks/securing-your-webhooks)
