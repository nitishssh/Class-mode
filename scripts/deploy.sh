#!/usr/bin/env bash
# Manual deploy to GCP Cloud Run (asia-south1 — serves classmode.inmodel.in).
# Use this when GitHub Actions CD is unavailable (e.g. Actions credits exhausted).
#
# Prereqs (one-time):
#   - Docker Desktop running
#   - gcloud auth login
#   - gcloud config set project plp-prod-2026

set -euo pipefail

PROJECT=plp-prod-2026
REGION=asia-south1
SERVICE=personallearningpro
REPO=plp-repo
REGISTRY_REGION=us-central1
IMG="${REGISTRY_REGION}-docker.pkg.dev/${PROJECT}/${REPO}/${SERVICE}"

SHA=$(git rev-parse HEAD)
SHORT=$(git rev-parse --short HEAD)

echo "▶ Deploying ${SHORT} to ${SERVICE} in ${REGION}"

if ! docker info >/dev/null 2>&1; then
  echo "✗ Docker daemon not running. Start Docker Desktop and retry." >&2
  exit 1
fi

echo "▶ Configuring docker auth for Artifact Registry"
gcloud auth configure-docker "${REGISTRY_REGION}-docker.pkg.dev" --quiet

echo "▶ Building linux/amd64 image and pushing (this takes ~6–10 min on Apple Silicon)"
docker buildx build \
  --platform linux/amd64 \
  --target production \
  --tag "${IMG}:${SHA}" \
  --tag "${IMG}:main" \
  --push \
  .

echo "▶ Deploying revision to Cloud Run"
gcloud run deploy "${SERVICE}" \
  --project="${PROJECT}" \
  --region="${REGION}" \
  --image="${IMG}:${SHA}" \
  --quiet

echo "▶ Smoke test"
curl -fsS -o /dev/null -w "classmode.inmodel.in/api/health → HTTP %{http_code} in %{time_total}s\n" \
  https://classmode.inmodel.in/api/health

echo "✓ Deploy of ${SHORT} complete"
