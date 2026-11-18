#!/usr/bin/env bash
# Sync API contract types from the Class-mode server repo into this app.
#
# The server repo's shared/ folder (zod schemas, roles, authz constants) is the
# single source of truth for the API contract. This app keeps a read-only copy
# in src/shared/ — never edit those files here; edit them in Class-mode and
# re-run:  npm run sync-shared
set -euo pipefail

SOURCE="${CLASSMODE_REPO:-$(dirname "$0")/../../Class-mode}/shared"
DEST="$(dirname "$0")/../src/shared"

if [ ! -d "$SOURCE" ]; then
  echo "error: Class-mode repo not found at $SOURCE" >&2
  echo "       set CLASSMODE_REPO to the repo path and retry" >&2
  exit 1
fi

mkdir -p "$DEST"
rsync -a --delete --exclude '__mocks__' "$SOURCE/" "$DEST/"

cat > "$DEST/README.md" <<'EOF'
# ⚠️ Generated — do not edit

Synced from the Class-mode repo's `shared/` folder (the API contract source
of truth). Edit there, then run `npm run sync-shared` here.
EOF

echo "Synced $(ls "$DEST" | grep -c '\.ts$') files from $SOURCE -> src/shared/"
