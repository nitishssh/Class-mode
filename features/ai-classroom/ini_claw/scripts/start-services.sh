#!/usr/bin/env bash
# Start / stop / status the IniClaw gateway (port 7070).
#
# Usage:
#   ./scripts/start-services.sh                  # start
#   ./scripts/start-services.sh --stop           # stop
#   ./scripts/start-services.sh --status         # status

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PIDDIR="/tmp/nemoclaw-gateway"
PIDFILE="$PIDDIR/gateway.pid"
LOGFILE="$PIDDIR/gateway.log"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${GREEN}[gateway]${NC} $1"; }
warn() { echo -e "${YELLOW}[gateway]${NC} $1"; }
fail() { echo -e "${RED}[gateway]${NC} $1"; exit 1; }

ACTION="start"
while [ $# -gt 0 ]; do
  case "$1" in
    --stop)   ACTION="stop";   shift ;;
    --status) ACTION="status"; shift ;;
    *)        shift ;;
  esac
done

is_running() {
  [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null
}

do_start() {
  [ -n "${BRIDGE_SECRET:-}" ] || fail "BRIDGE_SECRET is required"
  command -v node > /dev/null || fail "node not found"
  mkdir -p "$PIDDIR"

  if is_running; then
    info "Gateway already running (PID $(cat "$PIDFILE"))"
    return 0
  fi

  nohup node "$REPO_DIR/gateway.js" > "$LOGFILE" 2>&1 &
  echo $! > "$PIDFILE"
  info "Gateway started (PID $!, port ${INICLAW_PORT:-7070})"
}

do_stop() {
  if is_running; then
    kill "$(cat "$PIDFILE")" 2>/dev/null || true
    rm -f "$PIDFILE"
    info "Gateway stopped"
  else
    info "Gateway was not running"
  fi
}

do_status() {
  echo ""
  if is_running; then
    echo -e "  ${GREEN}●${NC} iniclaw-gateway  (PID $(cat "$PIDFILE"), port ${INICLAW_PORT:-7070})"
  else
    echo -e "  ${RED}●${NC} iniclaw-gateway  (stopped)"
  fi
  echo ""
}

case "$ACTION" in
  start)  do_start ;;
  stop)   do_stop ;;
  status) do_status ;;
esac
