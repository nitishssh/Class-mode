#!/bin/bash
# ─── setup-azure-secrets.sh ────────────────────────────────────────────────
# Populate Azure Container App secrets + secretref env vars from .env.
# Azure counterpart of setup-gcp-secrets.sh (values never touch Terraform state).
#
# Run after: az login && az account set --subscription classmode-prod
#   ./scripts/setup-azure-secrets.sh [path-to-env-file]   (default: .env)
# ────────────────────────────────────────────────────────────────────────────

set -euo pipefail

RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-classmode-rg}"
APP_NAME="${AZURE_CONTAINERAPP:-classmode-app}"
ENV_FILE="${1:-.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found. Copy .env.example and fill in values." >&2
  exit 1
fi

# Secrets consumed by the app in production (mirrors cloudbuild.yaml's
# --set-secrets list). ACA secret names must be lowercase alphanumeric + '-'.
SECRET_VARS=(
  POSTGRESQL_URL
  REDIS_URL
  SESSION_SECRET
  JWT_SECRET
  REFRESH_SECRET
  BRIDGE_SECRET
  GOOGLE_API_KEY
  OPENAI_API_KEY
  SMTP_HOST
  SMTP_USER
  SMTP_PASS
  SMTP_FROM
  DAILY_API_KEY
  APP_URL
  CORS_ORIGIN
  ASTRA_DB_APPLICATION_TOKEN
  ASTRA_DB_KEYSPACE
  ASTRA_DB_SECURE_BUNDLE_B64
  GOOGLE_CLASSROOM_CLIENT_ID
  GOOGLE_CLASSROOM_CLIENT_SECRET
  GOOGLE_SIGNIN_CLIENT_ID
  GOOGLE_SIGNIN_CLIENT_SECRET
)

# Auto-generate these when absent from the env file.
AUTOGEN=(SESSION_SECRET JWT_SECRET REFRESH_SECRET BRIDGE_SECRET)

# Read a KEY=value from the env file without exporting everything.
read_env() {
  grep -E "^${1}=" "$ENV_FILE" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' || true
}

secret_args=()
env_args=()
missing=()

for VAR in "${SECRET_VARS[@]}"; do
  VALUE="$(read_env "$VAR")"

  if [ -z "$VALUE" ]; then
    for GEN in "${AUTOGEN[@]}"; do
      if [ "$VAR" = "$GEN" ]; then
        VALUE="$(openssl rand -hex 32)"
        echo "  ↻ $VAR: auto-generated"
        break
      fi
    done
  fi

  if [ -z "$VALUE" ]; then
    missing+=("$VAR")
    continue
  fi

  # POSTGRESQL_URL=... -> secret name postgresql-url
  NAME="$(echo "$VAR" | tr '[:upper:]_' '[:lower:]-')"
  secret_args+=("${NAME}=${VALUE}")
  env_args+=("${VAR}=secretref:${NAME}")
done

if [ ${#missing[@]} -gt 0 ]; then
  echo "⚠ Skipped (not set in $ENV_FILE): ${missing[*]}" >&2
fi

echo "Setting ${#secret_args[@]} secrets on $APP_NAME ($RESOURCE_GROUP)…"
az containerapp secret set \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --secrets "${secret_args[@]}" \
  --output none

echo "Wiring secretref env vars…"
az containerapp update \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --set-env-vars "${env_args[@]}" \
  --output none

echo "✅ Done. New revision provisioning — verify with:"
echo "   az containerapp revision list -n $APP_NAME -g $RESOURCE_GROUP -o table"
