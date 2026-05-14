#!/bin/bash

# ══════════════════════════════════════════════════════════════════
#  setup-services.sh — Initialize microservices structure
#
# This script sets up the services/ directory with
#  IniClaw as independent services within PersonalLearningPro
# ══════════════════════════════════════════════════════════════════

set -e

echo "🚀 Setting up PersonalLearningPro microservices..."

# Create services directory structure
mkdir -p services/iniclaw

echo "✅ Created services directory structure"

# Create placeholder Dockerfiles for services
cat > services/iniclaw/Dockerfile << 'EOF'
# ── IniClaw Gateway Dockerfile ────────────────────────────────────
# Agent runtime and gateway service

ARG NODE_VERSION=20-alpine

# ── Development stage ─────────────────────────────────────────────
FROM node:${NODE_VERSION} AS development

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Expose port
EXPOSE 4000

# Start development server
CMD ["npm", "run", "dev"]

# ── Production build stage ────────────────────────────────────────
FROM node:${NODE_VERSION} AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build TypeScript
RUN npm run build

# ── Production stage ──────────────────────────────────────────────
FROM node:${NODE_VERSION} AS production

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm install --production

# Copy built app from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

EXPOSE 4000

# Start production server
CMD ["npm", "start"]
EOF

echo "✅ Created Dockerfiles for services"

# Create placeholder package.json files
cat > services/iniclaw/package.json << 'EOF'
{
  "name": "iniclaw-gateway",
  "version": "1.0.0",
  "description": "IniClaw Agent Gateway - Multi-Agent Runtime",
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "express": "^4.21.0",
    "axios": "^1.13.6",
    "firebase-admin": "^13.7.0",
    "openai": "^4.91.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.0",
    "tsx": "^4.0.0"
  }
}
EOF

echo "✅ Created package.json files for services"

# Create .gitkeep files to preserve directory structure
touch services/iniclaw/.gitkeep

echo "✅ Created service directories"

# Create README for services
cat > services/README.md << 'EOF'
# PersonalLearningPro Microservices

This directory contains independent microservices that integrate with the main EduAI platform.

## Services

### IniClaw (`./iniclaw`)
Agent gateway and runtime for orchestrating multi-agent systems.

**Features:**
- Agent orchestration
- Webhook handling
- Real-time communication
- Integration with OpenAI

**Setup:**
```bash
cd iniclaw
npm install
npm run dev
```

**Port:** 4000

## Integration

All services communicate through:
- **REST APIs** for synchronous operations
- **WebSockets** for real-time updates
- **Webhooks** for event-driven updates
- **Firebase Auth** for unified authentication

See the main README.md for full integration details.
EOF

echo "✅ Created services README"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✨ Microservices setup complete!"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "1. Copy your IniClaw code to ./services/iniclaw"
echo "2. Update package.json files with actual dependencies"
echo "3. Run: docker compose up"
echo ""
echo "For development without Docker:"
echo "  Terminal 1: npm run dev (EduAI main app)"
echo "  Terminal 2: cd services/iniclaw && npm run dev"
echo ""
