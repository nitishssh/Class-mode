#!/bin/bash
# ─── setup-gcp-secrets.sh ──────────────────────────────────────────────────
# Populate Google Secret Manager with values from .env for project plp-prod-2026.
# Run after: gcloud auth login && gcloud config set project plp-prod-2026
# ────────────────────────────────────────────────────────────────────────────

set -e

# Load .env
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
else
  echo "Error: .env file not found. Copy .env.example to .env and fill in values."
  exit 1
fi

PROJECT_ID=$(gcloud config get-value project)
echo "Using GCP Project: $PROJECT_ID"
echo ""

# ── Required secrets (app will not start without these) ──────────────────────
REQUIRED_SECRETS=(
  "MONGODB_URL"
  "GOOGLE_API_KEY"
  "FIREBASE_SERVICE_ACCOUNT_JSON"
)

# ── Secrets with auto-generated fallbacks ─────────────────────────────────────
declare -A AUTO_GENERATE=(
  ["SESSION_SECRET"]="openssl rand -hex 32"
  ["JWT_SECRET"]="openssl rand -hex 32"
  ["REFRESH_SECRET"]="openssl rand -hex 32"
  ["BRIDGE_SECRET"]="openssl rand -hex 32"
)

# ── Optional feature secrets ─────────────────────────────────────────────────
OPTIONAL_SECRETS=(
  "STRIPE_SECRET_KEY"
  "OPENAI_API_KEY"
  "DAILY_API_KEY"
  "SMTP_HOST"
  "SMTP_USER"
  "SMTP_PASS"
)

SA="serviceAccount:$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')-compute@developer.gserviceaccount.com"

push_secret() {
  local SECRET=$1
  local VALUE=$2

  # Create secret container if it doesn't exist
  gcloud secrets describe "$SECRET" --project="$PROJECT_ID" &>/dev/null \
    || gcloud secrets create "$SECRET" --project="$PROJECT_ID" --replication-policy="automatic" 2>/dev/null

  # Add new version
  echo -n "$VALUE" | gcloud secrets versions add "$SECRET" --project="$PROJECT_ID" --data-file=-

  # Grant Cloud Run SA access
  gcloud secrets add-iam-policy-binding "$SECRET" \
    --project="$PROJECT_ID" \
    --member="$SA" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet &>/dev/null

  echo "  ✓ $SECRET"
}

echo "── Required secrets ──────────────────────────────────────────────────────"
for SECRET in "${REQUIRED_SECRETS[@]}"; do
  VALUE="${!SECRET}"
  if [ -z "$VALUE" ]; then
    echo "  ✗ $SECRET — not set in .env. Set it and re-run."
  else
    push_secret "$SECRET" "$VALUE"
  fi
done

echo ""
echo "── Auto-generated secrets (generated if not in .env) ────────────────────"
for SECRET in "${!AUTO_GENERATE[@]}"; do
  VALUE="${!SECRET}"
  if [ -z "$VALUE" ]; then
    VALUE=$(eval "${AUTO_GENERATE[$SECRET]}")
    echo "  (generated) $SECRET"
  fi
  push_secret "$SECRET" "$VALUE"
done

echo ""
echo "── Optional feature secrets ─────────────────────────────────────────────"
for SECRET in "${OPTIONAL_SECRETS[@]}"; do
  VALUE="${!SECRET}"
  if [ -z "$VALUE" ]; then
    echo "  - $SECRET — skipped (not set in .env)"
  else
    push_secret "$SECRET" "$VALUE"
  fi
done

echo ""
echo "Done! Secrets configured in project $PROJECT_ID."
echo ""
echo "Next: trigger a Cloud Run deploy to pick up new secret versions:"
echo "  gcloud run deploy personallearningpro --region=us-central1 --project=$PROJECT_ID --image=us-central1-docker.pkg.dev/$PROJECT_ID/plp-repo/personallearningpro:latest"
