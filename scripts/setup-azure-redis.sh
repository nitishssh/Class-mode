#!/bin/bash
# ─── setup-azure-redis.sh ──────────────────────────────────────────────────
# Provision Azure Managed Redis (Balanced_B0) for Class Mode.
#
# Managed here rather than in terraform-azure/ because azurerm 4.x cannot
# express the Balanced_B0 SKU (see terraform-azure/main.tf). Idempotent-ish:
# `create` fails harmlessly if the cluster already exists.
#
# Run after: az login && az account set --subscription classmode-prod
# ────────────────────────────────────────────────────────────────────────────

set -euo pipefail

RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-classmode-rg}"
CLUSTER_NAME="${AZURE_REDIS_CLUSTER:-classmode-redis}"
LOCATION="${AZURE_LOCATION:-centralindia}"

echo "Creating Azure Managed Redis cluster $CLUSTER_NAME (Balanced_B0, $LOCATION)…"
az redisenterprise create \
  --cluster-name "$CLUSTER_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --sku "Balanced_B0" \
  --public-network-access Enabled \
  --no-database

echo "Creating database (Redis Streams + BullMQ friendly: NoEviction)…"
az redisenterprise database create \
  --cluster-name "$CLUSTER_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --client-protocol Encrypted \
  --clustering-policy EnterpriseCluster \
  --eviction-policy NoEviction \
  --access-keys-auth Enabled \
  --port 10000

HOST=$(az redisenterprise show -g "$RESOURCE_GROUP" --cluster-name "$CLUSTER_NAME" --query hostName -o tsv)
KEY=$(az redisenterprise database list-keys -g "$RESOURCE_GROUP" --cluster-name "$CLUSTER_NAME" --query primaryKey -o tsv)

echo ""
echo "✅ Redis ready."
echo "   REDIS_URL=rediss://:${KEY}@${HOST}:10000"
echo "   Add it to your .env, then run scripts/setup-azure-secrets.sh"
