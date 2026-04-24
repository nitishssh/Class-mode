# OpenMAIC Integration - Quick Start

This guide helps you quickly integrate the OpenMAIC AI Classroom system with PersonalLearningPro.

## What is OpenMAIC?

OpenMAIC creates immersive, multi-agent AI classrooms with:

- 🎓 AI teachers that lecture and explain concepts
- 👥 AI classmates for discussions
- 📊 Auto-generated slides and presentations
- 📝 Interactive quizzes with real-time feedback
- 🧪 HTML simulations and experiments
- 🎨 Whiteboard collaboration
- 🔊 Text-to-speech for all agents

## Quick Setup (5 minutes)

### 1. Run the setup script

```bash
./scripts/setup-openmaic.sh
```

### 2. Add your LLM API key

Edit `~/Downloads/arena-learning/.env` and add at least one:

```env
OPENAI_API_KEY=sk-...
# OR
ANTHROPIC_API_KEY=sk-ant-...
# OR
GOOGLE_API_KEY=...
```

### 3. Start the services

**Option A - Docker (easiest):**

```bash
cd ~/Downloads/arena-learning
docker-compose up -d
```

**Option B - Manual:**

```bash
# Terminal 1
cd ~/Downloads/arena-learning/ini_claw
npm install
npm run dev:gateway

# Terminal 2
cd ~/Downloads/arena-learning/studyArena
pnpm install
pnpm dev
```

### 4. Start PersonalLearningPro

```bash
npm run dev
```

### 5. Access AI Classroom

Visit: http://localhost:5001/ai-classroom

## Features

### Create Classroom

Generate a complete AI classroom experience:

- Enter any topic (e.g., "Quantum Physics", "Ancient Rome")
- Choose scene type (slides, quiz, simulation, or project-based learning)
- AI generates interactive content with multiple agents

### Quick Quiz Generator

- Enter a topic
- Get 5 interactive questions with AI feedback
- Instant grading and explanations

### Integration Points

- `/api/ai-classroom/create` - Create new classroom
- `/api/ai-classroom/quiz/generate` - Generate quiz
- `/api/ai-classroom/slides/generate` - Generate slides
- `/api/ai-classroom/health` - Check service status

## Architecture

```
┌─────────────────────────────┐
│  PersonalLearningPro        │
│  (Express + React)          │
│  Port: 5001                 │
└──────────┬──────────────────┘
           │ HTTP API
           ↓
┌─────────────────────────────┐
│  IniClaw Gateway            │
│  (Sandboxed Agent Runtime)  │
│  Port: 7070                 │
└──────────┬──────────────────┘
           │ Secure Bridge
           ↓
┌─────────────────────────────┐
│  OpenMAIC Engine            │
│  (Multi-Agent Classroom)    │
│  Port: 3000                 │
└──────────┬──────────────────┘
           │
           ↓
┌─────────────────────────────┐
│  LLM Providers              │
│  (OpenAI/Anthropic/Google)  │
└─────────────────────────────┘
```

## Troubleshooting

### "AI Classroom Not Available"

- Check if services are running: `docker-compose ps`
- Verify environment variables in `.env`
- Check logs: `docker-compose logs`

### Classroom creation fails

- Ensure LLM API key is set and valid
- Check IniClaw logs for errors
- Verify `BRIDGE_SECRET` matches in both `.env` files

### Connection refused

- Ensure all services are running
- Check ports 3000 and 7070 are not in use
- Verify `OPENMAIC_INTERNAL_URL=http://localhost:3000`

## Next Steps

- 📚 Read full documentation: `docs/OPENMAIC_INTEGRATION.md`
- 🔧 Customize agent behavior in `ini_claw/policies/openmaic.yaml`
- 🎨 Modify UI in `client/src/pages/ai-classroom.tsx`
- 🔌 Add new API endpoints in `server/routes/ai-classroom.ts`

## Resources

- [OpenMAIC GitHub](https://github.com/THU-MAIC/OpenMAIC)
- [OpenMAIC Live Demo](https://open.maic.chat/)
- [IniClaw Documentation](https://github.com/openclaw/iniclaw)
- [Arena Learning Repo](https://github.com/NitishKumar-ai/arena-learning)

## Support

For issues or questions:

1. Check `docs/OPENMAIC_INTEGRATION.md`
2. Review OpenMAIC documentation
3. Check service logs for errors
4. Verify all environment variables are set correctly

---

**Happy Teaching! 🎓✨**
