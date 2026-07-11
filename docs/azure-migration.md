# GCP → Azure Migration Runbook

Status: **in progress** (branch `azure-migration`). GCP keeps serving
classmode.inmodel.in until the Phase 5 cutover; nothing on GCP is touched
except a temporary Cloud SQL firewall change during data migration.

## Target architecture

Everything in resource group `classmode-rg`, region Central India:

| GCP (today) | Azure (target) |
|---|---|
| Cloud Run `personallearningpro` | Container Apps `classmode-app` (Consumption, min 1 / max 3, 0.5 vCPU/1Gi) |
| Cloud SQL Postgres 16 HA | PG Flexible Server `classmode-pg` (B1ms, 32 GiB, PITR 7d, pgvector) |
| Memorystore Redis | Azure Managed Redis `classmode-redis` (Balanced_B0, Redis 7.x — **CLI-managed**, see `scripts/setup-azure-redis.sh`) |
| Secret Manager | ACA native secrets (`scripts/setup-azure-secrets.sh`) |
| Artifact Registry | GHCR (unchanged; ACA pulls with fine-grained `read:packages` PAT) |
| Uploads on ephemeral disk | Azure Files share mounted at `/app/public/uploads` |
| Workload Identity Federation | user-assigned identity `github-actions-deployer` + OIDC federated credentials |
| Cloud Monitoring | Log Analytics + App Insights availability test → alerts@inmodel.in |
| Cloud Armor | dropped in v1 (documented risk; app has rate limiting + JWT) |

Why min replicas = 1: BullMQ workers and Redis Streams consumers run inside the
web process; scale-to-zero silently stalls them (a latent defect on Cloud Run
today). One warm replica fixes it.

Why bullmq forces Azure **Managed** Redis: bullmq 5.x requires Redis ≥ 6.2;
classic Azure Cache for Redis Basic/Standard runs 6.0.

## Code changes on this branch

- `server/db-pg.ts` — Pool gains `ssl: … PG_SSL === "true" …` (Azure PG requires TLS).
- `server/lib/redis.ts` — `keepAlive: 15_000, connectTimeout: 10_000` (Azure idle-drop); TLS comes from the `rediss://` scheme.
- `.github/workflows/cd.yml` — `deploy-gcp` job replaced by `deploy-azure` (azure/login OIDC + `az containerapp update`). Build/Trivy job unchanged.
- New: `terraform-azure/`, `scripts/setup-azure-secrets.sh`, `scripts/setup-azure-redis.sh`.

GitHub repo secrets needed before merging: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`,
`AZURE_SUBSCRIPTION_ID` (values from `terraform output`). Remove `GCP_*` secrets
after decommission.

## Phase 0 — subscription (one-time, manual)

The billing profile on the Microsoft account was found Disabled
(`NoAzurePlanFound`), so subscription creation must go through signup:
https://azure.microsoft.com/free → sign in as the outlook.com account → add
payment method. Then:

```sh
az account list --refresh -o table
az account set --subscription <new-subscription>
for ns in Microsoft.App Microsoft.OperationalInsights Microsoft.DBforPostgreSQL \
          Microsoft.Cache Microsoft.Storage Microsoft.ManagedIdentity Microsoft.Insights; do
  az provider register --namespace $ns
done
az extension add --name containerapp --upgrade
```

Set a budget alert (Cost Management → Budgets, e.g. $100/mo @ 80% email) immediately.

## Phase 1 — infrastructure

```sh
# One-time state-store bootstrap (chicken-and-egg with the backend)
az group create -n classmode-rg -l centralindia
az storage account create -n classmodetfstate -g classmode-rg -l centralindia \
  --sku Standard_LRS --min-tls-version TLS1_2 --allow-blob-public-access false
az storage container create --account-name classmodetfstate -n tfstate --auth-mode login

cd terraform-azure
export TF_VAR_ghcr_token=<fine-grained PAT, read:packages, 1y expiry>
export TF_VAR_admin_client_ip=$(curl -s ifconfig.me)
terraform init
terraform apply

# Redis (CLI-managed — azurerm 4.x can't express Balanced_B0)
../scripts/setup-azure-redis.sh
```

## Phase 3 — secrets + deploy + smoke test

1. Pull current values from GCP: `gcloud secrets versions access latest --secret=NAME`
   into a local `.env` (never commit). `POSTGRESQL_URL` must end `?sslmode=require`;
   `REDIS_URL` comes from `setup-azure-redis.sh` output.
2. `./scripts/setup-azure-secrets.sh` — sets ACA secrets + `secretref:` env vars.
3. Deploy an image: `az containerapp update -n classmode-app -g classmode-rg --image ghcr.io/nitishkumar-ai/class-mode/personallearningpro:sha-<sha>`
4. Smoke test on the ACA default hostname (`terraform output container_app_fqdn`):
   - `GET /api/health` → 200, reports pg/redis connected
   - JWT login + Google OAuth (temporarily add the ACA hostname to the OAuth
     client's authorized redirect URIs in Google Cloud Console)
   - RAG/vector query (proves pgvector), file upload + `/uploads/...` fetch
     (proves the Azure Files mount), a classroom-generation job end-to-end
     (proves BullMQ on Managed Redis)
   - Logs visible in Log Analytics (`ContainerAppConsoleLogs_CL`)

## Phase 4 — data migration (rehearse once, repeat at cutover)

```sh
# 1. open Cloud SQL to this workstation (reversible)
gcloud sql instances patch plp-pg --project=plp-prod-2026 \
  --assign-ip --authorized-networks=$(curl -s ifconfig.me)/32

# 2. dump
pg_dump "host=<cloudsql-ip> dbname=eduai user=plpapp sslmode=require" \
  -Fc --no-owner --no-privileges -f eduai-$(date +%Y%m%d).dump

# 3. prepare target (admin creds: terraform output postgres_admin_*)
psql "host=classmode-pg.postgres.database.azure.com user=plpadmin dbname=postgres sslmode=require" \
  -c "CREATE ROLE plpapp WITH LOGIN PASSWORD '<generate>';" \
  -c "GRANT ALL ON DATABASE eduai TO plpapp;"
psql "... dbname=eduai ..." -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 4. restore (safe against AUTO_MIGRATE-created tables)
pg_restore -h classmode-pg.postgres.database.azure.com -U plpadmin -d eduai \
  --clean --if-exists --no-owner --no-privileges eduai-*.dump
psql "... dbname=eduai ..." \
  -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO plpapp;" \
  -c "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO plpapp;" \
  -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO plpapp;"

# 5. verify: row counts (pg_stat_user_tables) match; \dx shows vector;
#    spot-check one similarity query

# 6. close the door
gcloud sql instances patch plp-pg --project=plp-prod-2026 --no-assign-ip
```

Redis: nothing to migrate — drain BullMQ queues on GCP before the freeze, cache rebuilds.

## Phase 5 — cutover

- T–24h: DNS TTL for `classmode.inmodel.in` → 300s. Add the `asuid.classmode`
  TXT record (`az containerapp hostname add` prints the verification id) so the
  domain pre-validates while GCP still serves.
- Freeze: `gcloud run services update personallearningpro --region=asia-south1 --max-instances=0`
  (brief hard downtime; pick a low-traffic window). Confirm queues empty.
- Final dump/restore (Phase 4 steps 2–6).
- Flip CNAME `classmode` → `<container_app_fqdn>`; then
  `az containerapp hostname bind --hostname classmode.inmodel.in -n classmode-app -g classmode-rg`
  with managed certificate (5–15 min issuance; brief TLS-warning window accepted).
- Flip `APP_URL`/`CORS_ORIGIN` secrets to `https://classmode.inmodel.in`; remove
  the temporary ACA-hostname OAuth redirect URI.
- Verify: health, login, OAuth, upload, RAG, background job, and the Expo
  mobile app end-to-end from a real device.

**Rollback:** CNAME back to Cloud Run, `--max-instances=5`. Keep GCP warm and
untouched for **2 weeks**. Writes that landed on Azure during a failed window
need manual reconciliation — keep the window short.

## Phase 7 — decommission (T+2 weeks stable)

Archive a final `pg_dump` (local + Azure Blob cool tier) → `terraform destroy`
in `terraform-gcp/` → delete the WIF pool + `GCP_*` GitHub secrets → delete GCP
project `plp-prod-2026` (30-day pending-deletion window is the last-resort net).
Then land the cleanup commit: remove `cloudbuild.yaml`, `firebase.json`,
`firestore.rules`, stale `terraform/` (AWS), `VITE_FIREBASE_*` Dockerfile args,
and finally `terraform-gcp/`.

## Deliberately not in v1

Front Door/WAF, Azure OpenAI, VNet/private endpoints, Key Vault, ACR,
zone-redundant HA, Blob-storage upload rewrite, separate KEDA-scaled worker app.

## Cost (approx, USD/mo, Central India)

ACA min-1 ~$30 · PG B1ms ~$25 · Managed Redis B0 ~$14 · Files ~$1 ·
monitoring ~$5 → **~$70–85** (vs GCP where Memorystore STANDARD_HA alone was ~$70+).
Cheap variant (~$25–35): min 0 replicas + skip Redis (`REDIS_URL` unset — the
code no-ops queues/cache cleanly) — not recommended for production traffic.
