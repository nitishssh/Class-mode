#!/bin/bash

# OpenMAIC Integration Setup Script
# This script helps set up the arena-learning infrastructure for PersonalLearningPro

set -e

echo "🚀 OpenMAIC Integration Setup"
echo "=============================="
echo ""

# Check if arena-learning exists
ARENA_PATH="$HOME/Downloads/arena-learning"

if [ ! -d "$ARENA_PATH" ]; then
  echo "❌ arena-learning not found at $ARENA_PATH"
  echo ""
  echo "Please clone the repository first:"
  echo "  cd ~/Downloads"
  echo "  git clone https://github.com/NitishKumar-ai/arena-learning"
  exit 1
fi

echo "✅ Found arena-learning at $ARENA_PATH"
echo ""

# Check for .env file
if [ ! -f "$ARENA_PATH/.env" ]; then
  echo "📝 Creating .env file from template..."
  cp "$ARENA_PATH/.env.example" "$ARENA_PATH/.env"
  
  # Generate bridge secret
  BRIDGE_SECRET=$(openssl rand -hex 16)
  
  # Update .env with generated secret
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/changeme_replace_with_output_of_openssl_rand_hex_16/$BRIDGE_SECRET/" "$ARENA_PATH/.env"
  else
    sed -i "s/changeme_replace_with_output_of_openssl_rand_hex_16/$BRIDGE_SECRET/" "$ARENA_PATH/.env"
  fi
  
  echo "✅ Created .env with bridge secret: $BRIDGE_SECRET"
  echo ""
  echo "⚠️  IMPORTANT: You need to add at least one LLM API key to $ARENA_PATH/.env"
  echo "   Options:"
  echo "   - OPENAI_API_KEY=sk-..."
  echo "   - ANTHROPIC_API_KEY=sk-ant-..."
  echo "   - GOOGLE_API_KEY=..."
  echo ""
else
  echo "✅ .env file already exists"
  BRIDGE_SECRET=$(grep BRIDGE_SECRET "$ARENA_PATH/.env" | cut -d '=' -f2)
  echo ""
fi

# Update PersonalLearningPro .env
PLPRO_ENV=".env"

if [ ! -f "$PLPRO_ENV" ]; then
  echo "📝 Creating PersonalLearningPro .env from template..."
  cp .env.example "$PLPRO_ENV"
fi

# Check if OpenMAIC config already exists
if grep -q "OPENMAIC_INTERNAL_URL" "$PLPRO_ENV"; then
  echo "✅ OpenMAIC configuration already exists in .env"
else
  echo "📝 Adding OpenMAIC configuration to PersonalLearningPro .env..."
  cat >> "$PLPRO_ENV" << EOF

# OpenMAIC AI Classroom Integration (added by setup script)
OPENMAIC_INTERNAL_URL=http://localhost:3000
BRIDGE_SECRET=$BRIDGE_SECRET
USE_INICLAW=true
EOF
  echo "✅ Added OpenMAIC configuration"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Add an LLM API key to $ARENA_PATH/.env"
echo "2. Start the services:"
echo ""
echo "   Option A - Docker (recommended):"
echo "     cd $ARENA_PATH"
echo "     docker-compose up -d"
echo ""
echo "   Option B - Manual:"
echo "     Terminal 1: cd features/ai-classroom/ini_claw && BRIDGE_SECRET=$BRIDGE_SECRET INICLAW_PORT=7070 node gateway.js"
echo "     Terminal 2: cd $ARENA_PATH/studyArena && pnpm install && pnpm dev"
echo ""
echo "3. Start PersonalLearningPro:"
echo "     npm run dev"
echo ""
echo "4. Visit http://localhost:5001/ai-classroom"
echo ""
echo "📚 For more details, see docs/OPENMAIC_INTEGRATION.md"
