#!/usr/bin/env bash
# Tiny wrapper around docker-compose.dev.yml for local Postgres.
#
# Usage:
#   ./scripts/dev-db.sh up      # start (creates volume + applies schema on first run)
#   ./scripts/dev-db.sh down    # stop, keep data
#   ./scripts/dev-db.sh reset   # nuke data + re-apply schema
#   ./scripts/dev-db.sh logs    # tail logs
#   ./scripts/dev-db.sh psql    # open a psql shell
#   ./scripts/dev-db.sh url     # print the POSTGRESQL_URL to use

set -euo pipefail

COMPOSE_FILE="docker-compose.dev.yml"
DB_URL="postgres://classmode:classmode@localhost:5432/classmode_dev"

cd "$(dirname "$0")/.."

cmd="${1:-up}"

case "$cmd" in
  up)
    if ! docker info >/dev/null 2>&1; then
      echo "❌ Docker daemon not running. Start Docker Desktop first."
      exit 1
    fi
    echo "→ Booting Postgres (max 384MB RAM, port 5432)…"
    docker-compose -f "$COMPOSE_FILE" up -d
    echo "→ Waiting for health…"
    for i in {1..30}; do
      if docker-compose -f "$COMPOSE_FILE" exec -T pg pg_isready -U classmode -d classmode_dev >/dev/null 2>&1; then
        echo "✓ Ready."
        echo ""
        echo "Connection string:"
        echo "  $DB_URL"
        echo ""
        echo "Add to your shell (or .env) so the dev server uses it:"
        echo "  export POSTGRESQL_URL='$DB_URL'"
        echo ""
        echo "Then in another terminal:"
        echo "  npm run dev"
        exit 0
      fi
      sleep 1
    done
    echo "❌ Postgres didn't come up in 30s. Check: $0 logs"
    exit 1
    ;;
  down)
    docker-compose -f "$COMPOSE_FILE" down
    ;;
  reset)
    echo "→ Removing volume + container…"
    docker-compose -f "$COMPOSE_FILE" down -v
    echo "→ Rebooting (schema will re-apply)…"
    exec "$0" up
    ;;
  logs)
    docker-compose -f "$COMPOSE_FILE" logs -f pg
    ;;
  psql)
    docker-compose -f "$COMPOSE_FILE" exec pg psql -U classmode -d classmode_dev
    ;;
  url)
    echo "$DB_URL"
    ;;
  *)
    echo "Usage: $0 {up|down|reset|logs|psql|url}"
    exit 2
    ;;
esac
