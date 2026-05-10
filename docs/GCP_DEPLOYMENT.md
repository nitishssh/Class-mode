# GCP Deployment Guide

This guide documents the **live, executed** deployment of PersonalLearningPro to Google Cloud Platform using Cloud Run, Secret Manager, and Cloud Build. All commands here were run and verified on **2026-05-09**.

## Live Service

| Property | Value |
|---|---|
| **URL** | `https://personallearningpro-wuo7arhpla-uc.a.run.app` |
| **Project** | `plp-prod-2026` |
| **Region** | `us-central1` |
| **Active revision** | `personallearningpro-00008-vbp` |
| **Health** | `GET /api/health` → `{ status: "healthy" }` |

---

## Architecture

```
GitHub push → Cloud Build trigger
                   │
                   ▼
         Docker multi-stage build
         (node:20-alpine → deps → build → production)
                   │
                   ▼
         Artifact Registry (plp-repo)
         us-central1-docker.pkg.dev/plp-prod-2026/plp-repo/personallearningpro
                   │
                   ▼
         Cloud Run (personallearningpro)
         port 5001 | 1Gi RAM | 2 CPU | min 1 instance
                   │
              ┌────┴────┐
              ▼         ▼
         MongoDB      Secret Manager
         Atlas        (13 secrets)
```

**AI stack:** Google Gemini 2.0 Flash (`@google/generative-ai`) — all AI features including grading, study plans, and AI classroom generation.

---

## Prerequisites

- GCP project `plp-prod-2026` with billing enabled
- `gcloud` CLI authenticated: `gcloud auth login && gcloud config set project plp-prod-2026`
- APIs already enabled: `run`, `cloudbuild`, `artifactregistry`, `secretmanager`

---

## Cloud Run Service Configuration

| Setting | Value |
|---|---|
| Port | 5001 |
| Memory | 1Gi |
| CPU | 2 |
| Min instances | 1 (no cold starts) |
| Max instances | 10 |
| Access | Public (`allUsers` invoker) |
| Health check | `GET /api/health` |

---

## Secret Manager — All 13 Secrets

All secrets live in `plp-prod-2026`. The Cloud Run compute SA (`114646596478-compute@developer.gserviceaccount.com`) has `roles/secretmanager.secretAccessor` on each.

### Required — app will not start without these

```bash
# MongoDB Atlas connection string (must include database name)
echo -n "mongodb+srv://user:pass@cluster.mongodb.net/eduai?retryWrites=true&w=majority&appName=Cluster0" \
  | gcloud secrets versions add MONGODB_URL --project=plp-prod-2026 --data-file=-

# Firebase service account (raw JSON from Firebase Console → Service Accounts)
cat your-service-account.json \
  | gcloud secrets versions add FIREBASE_SERVICE_ACCOUNT_JSON --project=plp-prod-2026 --data-file=-

# Gemini API key (Google AI Studio → API Keys)
echo -n "AIza..." \
  | gcloud secrets versions add GOOGLE_API_KEY --project=plp-prod-2026 --data-file=-

# Random secrets (generate with: openssl rand -hex 32)
openssl rand -hex 32 | gcloud secrets versions add SESSION_SECRET --project=plp-prod-2026 --data-file=-
openssl rand -hex 32 | gcloud secrets versions add JWT_SECRET --project=plp-prod-2026 --data-file=-
openssl rand -hex 32 | gcloud secrets versions add REFRESH_SECRET --project=plp-prod-2026 --data-file=-
```

### Feature secrets — app starts without these, features degrade gracefully

```bash
# Stripe (billing — returns 503 until a real sk_live_/sk_test_ key is set)
echo -n "sk_live_..." | gcloud secrets versions add STRIPE_SECRET_KEY --project=plp-prod-2026 --data-file=-

# OpenAI (optional fallback for AI features — Gemini is primary)
echo -n "sk-..." | gcloud secrets versions add OPENAI_API_KEY --project=plp-prod-2026 --data-file=-

# Daily.co (video calls)
echo -n "..." | gcloud secrets versions add DAILY_API_KEY --project=plp-prod-2026 --data-file=-

# SMTP (email / invites)
echo -n "smtp.yourprovider.com" | gcloud secrets versions add SMTP_HOST --project=plp-prod-2026 --data-file=-
echo -n "user@example.com"       | gcloud secrets versions add SMTP_USER --project=plp-prod-2026 --data-file=-
echo -n "yourpassword"           | gcloud secrets versions add SMTP_PASS --project=plp-prod-2026 --data-file=-

# IniClaw gateway auth (internal microservice bridge)
openssl rand -hex 32 | gcloud secrets versions add BRIDGE_SECRET --project=plp-prod-2026 --data-file=-
```

### Grant access to a new secret

```bash
gcloud secrets add-iam-policy-binding SECRET_NAME \
  --project=plp-prod-2026 \
  --member="serviceAccount:114646596478-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## Static Environment Variables (in Cloud Run service)

These are set directly on the service (not via Secret Manager):

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DNS_IPV4_FIRST` | `true` |
| `CORS_ORIGIN` | `https://inmodel.in,https://personallearningpro-wuo7arhpla-uc.a.run.app,https://personallearningpro-114646596478.us-central1.run.app` |
| `APP_URL` | `https://inmodel.in` |
| `FIREBASE_PROJECT_ID` | `presonallp` |

> **CORS note:** The app code also allows `*.run.app` and `*.inmodel.in` hostnames in production, so adding new Cloud Run revisions with different URL formats will work automatically.

---

## CI/CD — Cloud Build

### Trigger (GitHub → Cloud Build)

Set these **Substitution Variables** in the Cloud Build trigger UI:

| Variable | Value |
|---|---|
| `_VITE_FIREBASE_API_KEY` | `YOUR_FIREBASE_API_KEY` |
| `_VITE_FIREBASE_APP_ID` | `YOUR_FIREBASE_APP_ID` |
| `_VITE_FIREBASE_MESSAGING_SENDER_ID` | `YOUR_FIREBASE_SENDER_ID` |
| `_VITE_FIREBASE_MEASUREMENT_ID` | `` |

`_VITE_FIREBASE_PROJECT_ID` is automatically set to `$PROJECT_ID` in `cloudbuild.yaml`.

### Manual build from CLI

```bash
cd PersonalLearningPro

SHORT_SHA=$(git rev-parse --short HEAD)

gcloud builds submit \
  --project=your-project-id \
  --config=cloudbuild.yaml \
  --substitutions="SHORT_SHA=${SHORT_SHA},\
_VITE_FIREBASE_API_KEY=YOUR_FIREBASE_API_KEY,\
_VITE_FIREBASE_APP_ID=YOUR_FIREBASE_APP_ID,\
_VITE_FIREBASE_MESSAGING_SENDER_ID=YOUR_FIREBASE_SENDER_ID"
```

Or use the npm shortcut (requires the trigger substitution variables to be set):

```bash
npm run deploy:gcp
```

### What the pipeline does

1. **Build** — Multi-stage Docker build (node:20-alpine), injects Firebase keys as build-args for Vite
2. **Push** — Tags image with `${SHORT_SHA}` and `:latest`, pushes both to Artifact Registry
3. **Deploy** — `gcloud run deploy` with `--platform managed --port 5001 --allow-unauthenticated`

> Cloud Run preserves existing secrets, env vars, memory, and CPU settings across deployments triggered by Cloud Build (only the image changes).

---

## Manual Deploy (without Cloud Build)

To deploy an already-built image directly:

```bash
gcloud run deploy personallearningpro \
  --project=plp-prod-2026 \
  --image=us-central1-docker.pkg.dev/plp-prod-2026/plp-repo/personallearningpro:latest \
  --region=us-central1 \
  --platform=managed \
  --port=5001 \
  --memory=1Gi \
  --cpu=2 \
  --min-instances=1 \
  --max-instances=10 \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production,DNS_IPV4_FIRST=true,CORS_ORIGIN=https://inmodel.in,APP_URL=https://inmodel.in,FIREBASE_PROJECT_ID=presonallp" \
  --set-secrets="MONGODB_URL=MONGODB_URL:latest,GOOGLE_API_KEY=GOOGLE_API_KEY:latest,FIREBASE_SERVICE_ACCOUNT_JSON=FIREBASE_SERVICE_ACCOUNT_JSON:latest,SESSION_SECRET=SESSION_SECRET:latest,JWT_SECRET=JWT_SECRET:latest,REFRESH_SECRET=REFRESH_SECRET:latest,STRIPE_SECRET_KEY=STRIPE_SECRET_KEY:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,DAILY_API_KEY=DAILY_API_KEY:latest,SMTP_HOST=SMTP_HOST:latest,SMTP_USER=SMTP_USER:latest,SMTP_PASS=SMTP_PASS:latest,BRIDGE_SECRET=BRIDGE_SECRET:latest"
```

---

## Updating a Single Secret

```bash
# Example: update SMTP password
echo -n "new-password" | gcloud secrets versions add SMTP_PASS --project=plp-prod-2026 --data-file=-

# Cloud Run will pick up the new version on the next cold start.
# To force an immediate rollout:
gcloud run deploy personallearningpro \
  --project=plp-prod-2026 \
  --region=us-central1 \
  --image=us-central1-docker.pkg.dev/plp-prod-2026/plp-repo/personallearningpro:latest
```

---

## Enabling Stripe (when ready)

1. Add a real key to Secret Manager:
   ```bash
   echo -n "sk_live_REAL_KEY" | gcloud secrets versions add STRIPE_SECRET_KEY --project=plp-prod-2026 --data-file=-
   ```
2. Trigger a new deploy (the billing routes auto-activate when the key starts with `sk_live_` or `sk_test_`).

---

## Firebase Hosting (Optional CDN layer)

To put Firebase Hosting in front of Cloud Run (for CDN caching and custom domain):

```json
// firebase.json
"rewrites": [
  {
    "source": "**",
    "run": {
      "serviceId": "personallearningpro",
      "region": "us-central1"
    }
  }
]
```

```bash
firebase deploy --only hosting
```

---

## Troubleshooting

### Blank white page / assets returning 500

The CORS middleware rejects origins not in the allowlist. Add your domain:

```bash
gcloud run services update personallearningpro \
  --region=us-central1 \
  --project=plp-prod-2026 \
  "--update-env-vars=^;^CORS_ORIGIN=https://inmodel.in,https://your-new-domain.com"
```

> Use `^;^` prefix so gcloud uses `;` as the delimiter — the value itself contains commas.

### Container fails to start

Check Cloud Run logs:
```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="personallearningpro"' \
  --project=plp-prod-2026 --limit=30 --order=asc \
  --format="value(timestamp,textPayload)"
```

Common causes:
- `SESSION_SECRET environment variable is required` → secret not mounted or no version exists
- `bad auth: authentication failed` → MongoDB URL missing database name (add `/eduai?retryWrites=true&w=majority`)
- `Gemini service not initialized` → `GOOGLE_API_KEY` secret is empty

### Check health endpoint

```bash
curl https://personallearningpro-wuo7arhpla-uc.a.run.app/api/health
# Expected: { "status": "healthy", "databases": { "mongodb": { "connected": true } } }
```
