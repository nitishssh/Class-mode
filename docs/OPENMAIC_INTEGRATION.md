# OpenMAIC Integration Guide

This document describes the integration between PersonalLearningPro and the OpenMAIC multi-agent AI classroom system.

## Overview

OpenMAIC (Open Multi-Agent Interactive Classroom) is an AI-powered platform that creates immersive, interactive learning experiences. It uses multi-agent orchestration to generate:

- Interactive slides with AI teachers
- Quizzes with real-time feedback
- Interactive HTML simulations
- Project-based learning activities
- AI classmates for discussions

The integration is powered by:

- **OpenMAIC**: The multi-agent classroom engine (Next.js)
- **IniClaw**: NVIDIA NemoClaw-based sandboxed agent runtime

## Architecture

```
PersonalLearningPro (Express + React)
    ↓ HTTP API calls
IniClaw Gateway (Port 7070)
    ↓ Sandboxed execution
OpenMAIC Engine (Port 3000)
    ↓ Multi-agent orchestration
LLM Providers (OpenAI, Anthropic, Google)
```

## Setup Instructions

### Prerequisites

1. Clone the arena-learning repository:

   ```bash
   cd ~/Downloads
   git clone https://github.com/NitishKumar-ai/arena-learning
   cd arena-learning
   ```

2. Install dependencies:

   ```bash
   # Install IniClaw dependencies
   cd ini_claw
   npm install

   # Install OpenMAIC dependencies
   cd ../studyArena
   pnpm install
   ```

3. Configure environment variables:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set:

   ```env
   # Generate a secure bridge secret
   BRIDGE_SECRET=$(openssl rand -hex 16)

   # Set at least one LLM provider
   OPENAI_API_KEY=sk-...
   # OR
   ANTHROPIC_API_KEY=sk-ant-...
   # OR
   GOOGLE_API_KEY=...
   ```

### Running with Docker (Recommended)

```bash
cd ~/Downloads/arena-learning
docker-compose up -d
```

This starts:

- IniClaw Gateway on `http://localhost:7070`
- OpenMAIC on `http://localhost:3000`

### Running Manually (Development)

Terminal 1 - Start IniClaw:

```bash
cd ~/Downloads/arena-learning/ini_claw
npm run dev:gateway
```

Terminal 2 - Start OpenMAIC:

```bash
cd ~/Downloads/arena-learning/studyArena
pnpm dev
```

### Configure PersonalLearningPro

Add to your `.env` file:

```env
# OpenMAIC AI Classroom Integration
OPENMAIC_INTERNAL_URL=http://localhost:3000
BRIDGE_SECRET=<same_value_as_arena_learning>
USE_INICLAW=true
```

## API Endpoints

### Health Check

```http
GET /api/ai-classroom/health
```

Returns the availability status of the OpenMAIC service.

### Create Classroom

```http
POST /api/ai-classroom/create
Content-Type: application/json

{
  "topic": "Quantum Physics",
  "sceneTypes": ["slides", "quiz"],
  "duration": 30
}
```

Creates a new AI classroom session with the specified topic and scene types.

### Get Classroom

```http
GET /api/ai-classroom/:classroomId
```

Retrieves the status and details of a classroom session.

### Generate Quiz

```http
POST /api/ai-classroom/quiz/generate
Content-Type: application/json

{
  "topic": "World War II",
  "questionCount": 5
}
```

Generates an interactive quiz on the specified topic.

### Generate Slides

```http
POST /api/ai-classroom/slides/generate
Content-Type: application/json

{
  "content": "Explain photosynthesis",
  "title": "Photosynthesis 101"
}
```

Generates presentation slides from content.

## Frontend Usage

Navigate to `/ai-classroom` in the application to access the AI Classroom interface.

Features:

- Create full classroom experiences
- Generate quick quizzes
- View classroom status
- Open generated classrooms in new tabs

## Security

- All agent LLM calls are routed through the IniClaw sandbox
- Security policies are defined in `ini_claw/policies/openmaic.yaml`
- Audit logs are stored in `ini_claw/.classroom-cache/audit.jsonl`
- Bridge secret authentication between services

## Troubleshooting

### OpenMAIC not available

- Check if services are running: `docker-compose ps` or check terminal outputs
- Verify `OPENMAIC_INTERNAL_URL` is set correctly
- Check `BRIDGE_SECRET` matches between services

### Classroom creation fails

- Ensure at least one LLM provider API key is configured
- Check IniClaw gateway logs for errors
- Verify network connectivity between services

### Authentication errors

- Ensure `BRIDGE_SECRET` is identical in both `.env` files
- Regenerate secret if needed: `openssl rand -hex 16`

## Development

### Adding New Features

1. Update `server/services/openmaic-client.ts` with new methods
2. Add corresponding routes in `server/routes/ai-classroom.ts`
3. Update frontend components in `client/src/pages/ai-classroom.tsx`

### Testing

```bash
# Test OpenMAIC health
curl http://localhost:3000/api/health

# Test IniClaw gateway
curl http://localhost:7070/health

# Test PersonalLearningPro integration
curl http://localhost:5001/api/ai-classroom/health
```

## Resources

- [OpenMAIC GitHub](https://github.com/THU-MAIC/OpenMAIC)
- [IniClaw Documentation](https://github.com/openclaw/iniclaw)
- [OpenMAIC Live Demo](https://open.maic.chat/)
- [Arena Learning Repository](https://github.com/NitishKumar-ai/arena-learning)

## Future Enhancements

- [ ] Embed classroom iframes directly in PersonalLearningPro
- [ ] Save classroom sessions to MongoDB
- [ ] Link classrooms to specific tests/courses
- [ ] Student progress tracking across classrooms
- [ ] Teacher analytics for classroom engagement
- [ ] Custom agent personalities and teaching styles
- [ ] Integration with existing test system
- [ ] Whiteboard collaboration features
