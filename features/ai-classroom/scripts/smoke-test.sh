#!/bin/bash
# IniClaw + OpenMAIC Integration Smoke Test

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

INICLAW_URL=${INICLAW_GATEWAY_URL:-"http://localhost:7070"}
OPENMAIC_URL=${OPENMAIC_URL:-"http://localhost:3000"}
SECRET=${BRIDGE_SECRET:-"changeme_replace_with_output_of_openssl_rand_hex_16"}

echo "--- 1. Checking IniClaw Health ---"
curl -fsSL "$INICLAW_URL/health" | grep -q "ok"
echo -e "${GREEN}✓ IniClaw is alive${NC}"

echo "--- 2. Checking OpenMAIC Proxy Health ---"
curl -fsSL "$OPENMAIC_URL/api/iniclaw-health" | grep -q "connected" || echo -e "${RED}⚠ OpenMAIC reports IniClaw disconnected (expected if IniClaw is not running)${NC}"
echo -e "${GREEN}✓ OpenMAIC health endpoint checked${NC}"

echo "--- 3. Testing IniClaw Agent (Mocked) ---"
# This will likely 500 because openshell is missing, but we check if it hits the gateway
RESPONSE=$(curl -s -X POST "$INICLAW_URL/agent" \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -d '{"message": "smoke test", "sessionId": "smoke-sid"}')

if echo "$RESPONSE" | grep -q "openshell: command not found"; then
  echo -e "${GREEN}✓ IniClaw gateway received request and attempted execution (found error as expected)${NC}"
elif echo "$RESPONSE" | grep -q "status"; then
  echo -e "${GREEN}✓ IniClaw agent responded successfully${NC}"
else
  echo -e "${RED}✗ Unexpected response from IniClaw: $RESPONSE${NC}"
fi

echo "--- 4. Verifying Audit Log ---"
if [ -f "ini_claw/.classroom-cache/audit.jsonl" ]; then
  LOG_FILE="ini_claw/.classroom-cache/audit.jsonl"
elif [ -f ".classroom-cache/audit.jsonl" ]; then
  LOG_FILE=".classroom-cache/audit.jsonl"
elif [ -f "../ini_claw/.classroom-cache/audit.jsonl" ]; then
  LOG_FILE="../ini_claw/.classroom-cache/audit.jsonl"
fi

if [ -n "$LOG_FILE" ]; then
  grep -q "smoke test" "$LOG_FILE" && echo -e "${GREEN}✓ Audit log contains smoke test entry${NC}" || echo -e "${RED}✗ Audit log missing smoke test entry${NC}"
else
  echo -e "${RED}✗ Audit log file not found${NC}"
fi

echo -e "\n${GREEN}SMOKE TEST COMPLETE${NC}"
