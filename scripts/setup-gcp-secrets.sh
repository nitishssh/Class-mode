#!/bin/bash
# ─── setup-gcp-secrets.sh ──────────────────────────────────────────────────
# Helper script to populate Google Secret Manager with values from .env
# ────────────────────────────────────────────────────────────────────────────

set -e

# Load current .env if it exists
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

PROJECT_ID=$(gcloud config get-value project)
REGION="us-central1"

echo "Using GCP Project: $PROJECT_ID"

SECRETS=(
  "MONGODB_URL"
  "GOOGLE_API_KEY"
  "FIREBASE_SERVICE_ACCOUNT_JSON"
  "SESSION_SECRET"
  "JWT_SECRET"
  "REFRESH_SECRET"
)

for SECRET in "${SECRETS[@]}"; do
  VALUE="${!SECRET}"
  
  if [ -z "$VALUE" ]; then
    echo "Warning: $SECRET is not set in environment. Skipping."
    continue
  fi

  echo "Setting secret: $SECRET..."
  
  # Create secret if it doesn't exist (ignore error if it does)
  gcloud secrets create "$SECRET" --replication-policy="user-managed" --replicas="$REGION" 2>/dev/null || true
  
  # Add the version
  echo -n "$VALUE" | gcloud secrets versions add "$SECRET" --data-file=-
done

echo "Done! Secrets populated in $PROJECT_ID."
