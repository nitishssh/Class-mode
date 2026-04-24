#!/bin/bash
# Deploy IniClaw + OpenMAIC using Docker Compose

set -e

# Generate BRIDGE_SECRET if not provided
if [ -z "$BRIDGE_SECRET" ]; then
  export BRIDGE_SECRET=$(openssl rand -hex 16)
  echo "--- Generated new BRIDGE_SECRET: $BRIDGE_SECRET ---"
  echo "Save this in your .env if you want it to persist."
fi

echo "--- 1. Building services ---"
docker-compose build

echo "--- 2. Starting services ---"
docker-compose up -d

echo "--- 3. Waiting for health ---"
sleep 5

echo "--- Deployment Complete ---"
echo "OpenMAIC: http://localhost:3000"
echo "IniClaw: http://localhost:7070"
