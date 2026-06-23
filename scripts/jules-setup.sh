#!/usr/bin/env bash
# scripts/jules-setup.sh
#
# Initial Setup script for the Jules coding agent (https://jules.google).
# Paste this into the Jules repo Configuration → "Initial Setup" window,
# then click "Run and Snapshot" to bake an environment snapshot.
#
# It is also safe to run locally: `bash scripts/jules-setup.sh`
#
# IMPORTANT: Jules runs in an ephemeral VM with NO Postgres / MongoDB / Redis.
# So this script installs deps and runs only the DB-independent checks
# (type-check + lint). The full `npm test` suite needs live databases and is
# intentionally NOT run here — see the "Async agents (Jules)" section in
# AGENTS.md for how Jules should validate changes.

set -euo pipefail

echo "▶ Node / npm versions"
node -v
npm -v

# The repo pins Node 22.x (see .github/workflows/ci.yml).
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "⚠  Expected Node 22.x — found $(node -v). Continuing, but build may differ from CI."
fi

echo "▶ Installing dependencies (npm ci, honours .npmrc legacy-peer-deps)"
# Use npm ci for a clean, lockfile-exact install. Fall back to npm install
# if the lockfile and package.json have drifted.
npm ci || npm install

echo "▶ Type-check (npm run check)"
npm run check

echo "▶ Lint (npm run lint)"
npm run lint

echo "✅ Jules environment ready."
echo "   Validate changes with: npm run check && npm run lint && npm run build"
echo "   (npm test requires Postgres/Mongo/Redis and won't run in this VM.)"
