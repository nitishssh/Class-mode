#!/usr/bin/env bash
# Bootstrap Google Classroom OAuth: creates Secret Manager entries,
# grants Cloud Run access, and writes local .env entries.
#
# Usage:
#   ./scripts/setup-google-classroom.sh <CLIENT_ID> <CLIENT_SECRET>
#
# Idempotent — re-runs simply add a new secret version.

set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: $0 <CLIENT_ID> <CLIENT_SECRET>"
  exit 1
fi

CLIENT_ID="$1"
CLIENT_SECRET="$2"
PROJECT="${GCP_PROJECT:-plp-prod-2026}"
SERVICE_ACCOUNT="personallearningpro-sa@${PROJECT}.iam.gserviceaccount.com"

cd "$(dirname "$0")/.."

create_or_add_version() {
  local name="$1"
  local value="$2"
  if gcloud secrets describe "$name" --project="$PROJECT" >/dev/null 2>&1; then
    echo "→ Adding new version to existing secret $name"
    printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=- --project="$PROJECT"
  else
    echo "→ Creating secret $name"
    printf '%s' "$value" | gcloud secrets create "$name" --data-file=- --replication-policy=automatic --project="$PROJECT"
  fi
}

grant_access() {
  local name="$1"
  gcloud secrets add-iam-policy-binding "$name" \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/secretmanager.secretAccessor" \
    --project="$PROJECT" \
    --condition=None \
    --quiet >/dev/null
  echo "  ✓ Cloud Run service account can read $name"
}

echo "── 1/3 Secret Manager ──"
create_or_add_version GOOGLE_CLASSROOM_CLIENT_ID "$CLIENT_ID"
grant_access GOOGLE_CLASSROOM_CLIENT_ID
create_or_add_version GOOGLE_CLASSROOM_CLIENT_SECRET "$CLIENT_SECRET"
grant_access GOOGLE_CLASSROOM_CLIENT_SECRET

echo ""
echo "── 2/3 Local .env ──"
if [ -f .env ]; then
  # Remove any existing CLASSROOM_* lines, then append fresh ones
  sed -i.bak '/^GOOGLE_CLASSROOM_/d' .env
  cat >> .env <<EOF
GOOGLE_CLASSROOM_CLIENT_ID=${CLIENT_ID}
GOOGLE_CLASSROOM_CLIENT_SECRET=${CLIENT_SECRET}
GOOGLE_CLASSROOM_REDIRECT_URI=http://localhost:5001/api/lms/google/callback
EOF
  rm -f .env.bak
  echo "  ✓ Wrote 3 GOOGLE_CLASSROOM_* lines to .env"
else
  echo "  ⚠ .env not found — skipping local wiring"
fi

echo ""
echo "── 3/3 Reminder ──"
echo "Cloud Run will pick up the new secrets on next deploy:"
echo "  npm run deploy:gcp"
echo ""
echo "For local dev, restart the server so dotenv re-loads:"
echo "  pkill -f 'tsx server/index.ts'; npm run dev"
echo ""
echo "✅ Done."
