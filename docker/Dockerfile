# check=skip=SecretsUsedInArgOrEnv
# ══════════════════════════════════════════════════════════════════
#  PersonalLearningPro — Multi-stage Dockerfile
#  Stages: deps → development | deps → build → production
#  Base: Node 22 LTS (Alpine)
# ══════════════════════════════════════════════════════════════════

ARG NODE_VERSION=22-alpine

# ── Stage 1: Shared dependency layer ──────────────────────────────
FROM node:${NODE_VERSION} AS deps

LABEL org.opencontainers.image.title="PersonalLearningPro"
LABEL org.opencontainers.image.description="AI-powered personal learning platform"
LABEL org.opencontainers.image.source="https://github.com/NitishKumar-ai/PersonalLearningPro"

RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --prefer-offline --legacy-peer-deps

# ── Stage 2: Development ──────────────────────────────────────────
FROM node:${NODE_VERSION} AS development

RUN apk add --no-cache libc6-compat

RUN addgroup --system --gid 1001 nodejs \
    && adduser  --system --uid 1001 appuser

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN chown -R appuser:nodejs /app

USER appuser

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget -qO- http://localhost:5001/api/health || exit 1

CMD ["npm", "run", "dev"]

# ── Stage 3: Build ────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS build

RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ── Stage 4: Production ───────────────────────────────────────────
FROM node:${NODE_VERSION} AS production

RUN apk add --no-cache libc6-compat wget \
    && apk upgrade --no-cache

RUN addgroup --system --gid 1001 nodejs \
    && adduser  --system --uid 1001 appuser

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --prefer-offline --legacy-peer-deps \
    && npm cache clean --force

COPY --from=build /app/dist ./dist
# Schema file for the opt-in boot migration (AUTO_MIGRATE) — idempotent DDL.
COPY --from=build /app/scripts/pg-schema.sql ./scripts/pg-schema.sql

RUN chown -R appuser:nodejs /app

USER appuser

ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=768" \
    AUTO_MIGRATE=true

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD wget -qO- http://localhost:5001/api/health || exit 1

CMD ["node", "dist/index.js"]
