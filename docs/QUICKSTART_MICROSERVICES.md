# PersonalLearningPro Microservices — Quick Start

## 🚀 5-Minute Setup

### 1. Initialize Services

```bash
# Run setup script
bash scripts/setup-services.sh

# This creates:
# - services/openmaic/
# - services/iniclaw/
# - Dockerfiles and package.json files
```

### 2. Copy Your Code

```bash
# Copy OpenMAIC (studyArena)
cp -r /path/to/studyArena/* services/openmaic/

# Copy IniClaw
cp -r /path/to/ini_claw/* services/iniclaw/
```

### 3. Configure Environment

```bash
# Copy and edit .env
cp .env.example .env

# Generate BRIDGE_SECRET
openssl rand -hex 32  # Copy this value to BRIDGE_SECRET in .env

# Fill in Firebase credentials
# Fill in OpenAI API key
# Fill in MongoDB password
```

### 4. Start Services

```bash
# With Docker (recommended)
docker compose up

# Without Docker (3 terminals)
# Terminal 1:
npm run dev

# Terminal 2:
cd services/openmaic && npm run dev

# Terminal 3:
cd services/iniclaw && npm run dev
```

### 5. Verify

```bash
# Check all services are running
curl http://localhost:5001/api/health
curl http://localhost:3000/api/health
curl http://localhost:4000/api/health

# Access the apps
# - EduAI: http://localhost:5001
# - OpenMAIC: http://localhost:3000 (or http://localhost:5001/arena)
# - IniClaw: http://localhost:4000 (or http://localhost:5001/gateway)
```

## 📋 What Was Set Up

### Docker Compose
- **EduAI** (React + Express) on port 5001
- **OpenMAIC** (Next.js) on port 3000
- **IniClaw** (Node.js) on port 4000
- **MongoDB** on port 27017
- **Cassandra** on port 9042
- **Redis** on port 6379
- **Nginx** reverse proxy on port 80

### Authentication Bridge
- Firebase JWT tokens validated by EduAI
- OpenMAIC session tokens generated for secure classroom access
- Automatic user sync between Firebase and MongoDB

### Webhook Integration
- OpenMAIC sends lesson completion events to EduAI
- Quiz results stored in MongoDB
- Analytics tracked for study plan generation

### Reverse Proxy Routing
- `/` → EduAI main app
- `/api/*` → EduAI backend
- `/arena/*` → OpenMAIC classroom
- `/gateway/*` → IniClaw agent gateway

## 🔗 API Examples

### Create AI Classroom

```bash
curl -X POST http://localhost:5001/api/openmaic/classroom/create \
  -H "Authorization: Bearer <firebase-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Calculus",
    "sceneTypes": ["slides", "quiz"],
    "difficulty": "intermediate"
  }'
```

### Generate Quiz

```bash
curl -X POST http://localhost:5001/api/openmaic/quiz/generate \
  -H "Authorization: Bearer <firebase-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Algebra",
    "questionCount": 5
  }'
```

### Get Classroom Embed

```bash
curl -X POST http://localhost:5001/api/openmaic/classroom/classroom-123/embed \
  -H "Authorization: Bearer <firebase-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "width": "100%",
    "height": "600px"
  }'
```

## 🐛 Troubleshooting

### Services won't start

```bash
# Check Docker is running
docker ps

# Check logs
docker compose logs -f

# Rebuild images
docker compose build --no-cache
```

### Authentication fails

```bash
# Verify Firebase credentials in .env
echo $VITE_FIREBASE_PROJECT_ID

# Check token verification
curl -H "Authorization: Bearer <token>" http://localhost:5001/api/auth/me
```

### Webhook signature fails

```bash
# Verify BRIDGE_SECRET is set
echo $BRIDGE_SECRET

# Check webhook logs
docker compose logs iniclaw-gateway | grep webhook
```

### Port already in use

```bash
# Find process using port
lsof -i :5001

# Kill process
kill -9 <PID>

# Or change port in .env
PORT=5002 docker compose up
```

## 📚 Full Documentation

See `docs/MICROSERVICES_INTEGRATION.md` for:
- Complete architecture overview
- Phase-by-phase implementation guide
- API endpoint documentation
- Webhook event specifications
- Security best practices
- Production deployment guide

## 🎯 Next Steps

1. ✅ Services initialized
2. ✅ Docker Compose configured
3. ✅ Authentication bridge implemented
4. ⏳ Copy OpenMAIC code to `services/openmaic/`
5. ⏳ Copy IniClaw code to `services/iniclaw/`
6. ⏳ Update service package.json files
7. ⏳ Test end-to-end integration
8. ⏳ Deploy to production

## 💡 Tips

- Use `docker compose logs -f <service>` to debug specific services
- Services communicate via internal Docker network (no localhost needed)
- Nginx handles routing and SSL termination in production
- All services share Firebase authentication
- MongoDB stores all application data
- Cassandra stores high-volume message data

## 🆘 Need Help?

1. Check logs: `docker compose logs -f`
2. Verify environment: `cat .env | grep -E "FIREBASE|BRIDGE|MONGO"`
3. Test health endpoints: `curl http://localhost:5001/api/health`
4. Review integration guide: `docs/MICROSERVICES_INTEGRATION.md`

---

**Ready to go!** 🎉 Your microservices are now orchestrated and ready for development.
