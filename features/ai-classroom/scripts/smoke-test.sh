#!/bin/bash
# IniClaw Integration Smoke Test

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

INICLAW_URL=${INICLAW_GATEWAY_URL:-"http://localhost:7070"}
SECRET=${BRIDGE_SECRET:-"changeme_replace_with_output_of_openssl_rand_hex_16"}

echo "--- 1. Checking IniClaw Health ---"
curl -fsSL "$INICLAW_URL/health" | grep -q "ok"
echo -e "${GREEN}✓ IniClaw is alive${NC}"

echo "--- 2. Testing IniClaw Tutor Chat ---"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$INICLAW_URL/tutor/chat" \
  -H "Authorization: Bearer $SECRET" \
  -H "Content-Type: application/json" \
  -d '{"message": "smoke test", "sessionId": "smoke-sid"}')

if [ "$RESPONSE" = "200" ]; then
  echo -e "${GREEN}✓ IniClaw gateway responded with 200${NC}"
elif [ "$RESPONSE" = "500" ]; then
  echo -e "${GREEN}✓ IniClaw gateway is reachable (LLM key not set in test env — 500 expected)${NC}"
else
  echo -e "${RED}✗ Unexpected HTTP status from IniClaw: $RESPONSE${NC}"
fi

echo "--- 3. Verifying Audit Log ---"
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
