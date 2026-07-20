# Study Arena (AI Classroom) Integration Guide

> **⚠️ Historical (W30, 2026-07).** This document describes the vendored `features/ai-classroom/studyArena` microservice, which was removed. The live implementation is native under `server/services/study-arena/` (see [study-arena-inspired-by-openmaic.md](study-arena-inspired-by-openmaic.md)) and attribution is at [OpenMAIC-ATTRIBUTION.md](OpenMAIC-ATTRIBUTION.md). Kept for historical reference only.

This document describes the AI Classroom feature in PersonalLearningPro, powered by the native Study Arena engine and the IniClaw LLM gateway.

## Overview

The Study Arena generates immersive, multi-agent AI classroom experiences entirely within the PersonalLearningPro server stack. No external process or Docker container is required for classroom generation.

Features:

- Interactive slides with AI teacher and assistant agents
- Quizzes with real-time feedback
- Sandboxed HTML/JS simulations
- Project-based learning (PBL) activities
- Multi-agent real-time chat (`/api/ai-classroom/chat`)

## Architecture

```
Browser (React)
    ↓ REST / SSE
PersonalLearningPro Express Server
    ↓ internal service call
server/services/study-arena/
    ├─ generator.ts      (lesson plan + scene generation)
    ├─ orchestrator.ts   (multi-agent chat)
    └─ internal-service.ts (job queue + MongoDB persistence)
    ↓ LLM calls
IniClaw Gateway (optional, port 7070)   ←── or direct
    ↓
LLM Providers (Gemini → OpenAI → Anthropic)
```

The main server calls LLMs **directly** for classroom generation. IniClaw is an optional standalone proxy for environments that want rate-limiting, concurrency control, and audit logging at the gateway level.

## API Endpoints

All endpoints require a valid session or `Authorization: Bearer <jwt>` header.

### Health Check

```http
GET /api/ai-classroom/health
```

No authentication required. Returns:

```json
{ "available": true, "status": "healthy", "service": "study-arena-native" }
```

### Create Classroom (async)

```http
POST /api/ai-classroom/create
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "topic": "Quantum Physics",
  "sceneTypes": ["slides", "quiz"],
  "language": "en"
}
```

Returns `202 Accepted` immediately:

```json
{ "jobId": "abc123", "status": "generating", "message": "Classroom generation started (Native)" }
```

### Poll Job Status

```http
GET /api/ai-classroom/status/:jobId
Authorization: Bearer <jwt>
```

```json
{
  "jobId": "abc123",
  "status": "running",
  "step": "generating_scenes",
  "progress": 45,
  "message": "Generating scene 3 of 6",
  "done": false
}
```

### Stream Progress (SSE)

```http
GET /api/ai-classroom/status/:jobId/stream
Authorization: Bearer <jwt>
```

Server-Sent Events stream — each event is a JSON `JobStatus` object. Closes automatically when `done: true`.

### List My Classrooms

```http
GET /api/ai-classroom/my-classrooms?limit=20&offset=0
Authorization: Bearer <jwt>
```

```json
{
  "classrooms": [{ "id": 1, "topic": "Quantum Physics", "status": "ready", "createdAt": "..." }],
  "total": 1
}
```

### Get Classroom Content

```http
GET /api/ai-classroom/classroom/:classroomId
Authorization: Bearer <jwt>
```

### Delete Classroom

```http
DELETE /api/ai-classroom/classroom/:classroomId
Authorization: Bearer <jwt>
```

### Cancel Job

```http
DELETE /api/ai-classroom/status/:jobId
Authorization: Bearer <jwt>
```

### Multi-Agent Chat (SSE)

```http
POST /api/ai-classroom/chat
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "config": {
    "agentIds": ["teacher", "assistant"],
    "discussionTopic": "Photosynthesis",
    "triggerAgentId": "teacher"
  },
  "messages": [{ "role": "user", "content": "Explain step 2" }],
  "storeState": { "whiteboardOpen": false }
}
```

Streams `text/event-stream` events with agent dialogue.

## IniClaw Gateway (Optional)

IniClaw (`features/ai-classroom/ini_claw/`) is a **lightweight Node.js LLM proxy** — zero npm dependencies, pure built-in modules.

It provides:

- Bearer token auth (`BRIDGE_SECRET`)
- Concurrency semaphore (`INICLAW_MAX_CONCURRENT`, default 3)
- Rotating audit log (`.classroom-cache/audit.jsonl`)
- LLM provider fallback: Gemini → OpenAI → Anthropic

### Gateway Routes

| Route                      | Purpose                | Timeout |
| -------------------------- | ---------------------- | ------- |
| `GET /health`              | Health check           | —       |
| `POST /classroom/generate` | Full lesson generation | 5 min   |
| `POST /classroom/quiz`     | Quiz-only generation   | 2 min   |
| `POST /classroom/slides`   | Slides-only generation | 2 min   |
| `POST /tutor/chat`         | Real-time tutor chat   | 1 min   |

### Running Locally

```bash
cd features/ai-classroom/ini_claw
BRIDGE_SECRET=<your-secret> INICLAW_PORT=7070 node gateway.js
```

### Environment Variables

| Variable                 | Default      | Description                   |
| ------------------------ | ------------ | ----------------------------- |
| `BRIDGE_SECRET`          | _(required)_ | Bearer token for auth         |
| `INICLAW_PORT`           | `7070`       | Port to listen on             |
| `INICLAW_MAX_CONCURRENT` | `3`          | Max simultaneous LLM calls    |
| `INICLAW_MAX_BODY_MB`    | `4`          | Max request body size         |
| `INICLAW_MAX_OUTPUT_MB`  | `32`         | Max LLM response size         |
| `OPENAI_API_KEY`         | —            | OpenAI provider               |
| `GOOGLE_API_KEY`         | —            | Gemini provider (tried first) |
| `ANTHROPIC_API_KEY`      | —            | Anthropic provider (fallback) |

At least one LLM API key must be set.

### Docker (AI Classroom feature compose)

The `iniclaw` service in `docker-compose.yml` builds from `features/ai-classroom/ini_claw/`:

```yaml
iniclaw:
  build:
    context: ./features/ai-classroom/ini_claw
    dockerfile: Dockerfile
  ports:
    - "7070:7070"
  environment:
    - BRIDGE_SECRET=${BRIDGE_SECRET}
    - INICLAW_PORT=7070
```

### Security Policies

Network access for IniClaw agents is defined in `features/ai-classroom/ini_claw/policies/study-arena.yaml`:

```yaml
network_policies:
  - host: api.openai.com # OpenAI
  - host: generativelanguage.googleapis.com # Gemini
  - host: api.anthropic.com # Anthropic

filesystem_policies:
  - path: .classroom-cache # audit log + artifacts
    mode: rw
```

## PersonalLearningPro Environment Variables

Add to your `.env`:

```env
# IniClaw Gateway (optional — main app works without it)
INICLAW_GATEWAY_URL=http://localhost:7070
BRIDGE_SECRET=<generate with: openssl rand -hex 32>
USE_INICLAW=false  # set to true to route through IniClaw

# LLM Providers (at least one required for AI classroom)
GOOGLE_API_KEY=...
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
```

## Frontend

Navigate to `/ai-classroom` in the app to access the AI Classroom interface.

Features:

- Create full classroom experiences
- Real-time generation progress bar
- Interactive quizzes with AI feedback
- Whiteboard collaboration
- Cancel in-progress jobs

## Testing

```bash
# Health check (no auth)
curl http://localhost:5001/api/ai-classroom/health

# Test gateway (if running)
curl http://localhost:7070/health

# Create classroom (requires auth token)
curl -X POST http://localhost:5001/api/ai-classroom/create \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"topic": "Photosynthesis", "sceneTypes": ["slides", "quiz"]}'
```

## Troubleshooting

### Generation fails immediately

- Ensure at least one LLM API key is set (`GOOGLE_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY`)
- Check server logs for `[StudyArena]` entries

### GDPR export fails

- Confirmed fixed: `archiver` v8 breaking change (factory → `new ZipArchive()`) has been resolved in `server/routes/gdpr.ts`

### IniClaw gateway unreachable

- Check `INICLAW_GATEWAY_URL` and `BRIDGE_SECRET` in `.env`
- Verify gateway is running: `curl http://localhost:7070/health`
- Gateway is optional — app functions without it

## Development

### Adding New Scene Types

1. Add the type to `SceneType` in `shared/study-arena.ts`
2. Add generation logic in `server/services/study-arena/generator.ts`
3. Add rendering in `client/src/components/ai-classroom/`

### Extending the Gateway

Add a new route to `ROUTE_MAP` in `features/ai-classroom/ini_claw/gateway.js`:

```js
"/my-route": { timeout: 60_000, logType: "my_route" }
```

## Resources

- [Arena Learning Repository](https://github.com/NitishKumar-ai/arena-learning) (studyArena Next.js frontend — optional companion)
- Study Arena types: `shared/study-arena.ts`
- Internal service: `server/services/study-arena/internal-service.ts`
- Gateway: `features/ai-classroom/ini_claw/gateway.js`
