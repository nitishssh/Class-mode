#!/usr/bin/env bash
# Verify src/shared is still an exact generated copy of Class-mode/shared.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="${CLASSMODE_REPO:-"$ROOT/../Class-mode"}/shared"
DEST="$ROOT/src/shared"

if [ ! -d "$SOURCE" ]; then
  echo "error: Class-mode shared folder not found at $SOURCE" >&2
  echo "       set CLASSMODE_REPO to the Class-mode repo path and retry" >&2
  exit 1
fi

if [ ! -d "$DEST" ]; then
  echo "error: generated shared folder not found at $DEST" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

EXPECTED="$TMP_DIR/shared"
mkdir -p "$EXPECTED"

rsync -a --delete --exclude '__mocks__' "$SOURCE/" "$EXPECTED/"

cat > "$EXPECTED/README.md" <<'EOF'
# ⚠️ Generated — do not edit

Synced from the Class-mode repo's `shared/` folder (the API contract source
of truth). Edit there, then run `npm run sync-shared` here.
EOF

if diff -ru "$EXPECTED" "$DEST"; then
  echo "src/shared is in sync with Class-mode/shared."
else
  echo "::error::src/shared has drifted from Class-mode/shared. Run npm run sync-shared and commit the result." >&2
  exit 1
fi
