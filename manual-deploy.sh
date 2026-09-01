#!/bin/bash
set -e
export DOCKER_HOST="ssh://wednesday"
export SHA=$(git rev-parse HEAD)
# Manual deploy path. Exists because GitHub Actions cannot run: the account's
# billing is lapsed, so cd.yml's deploy-azure job never starts. Builds on the
# remote `wednesday` docker host (DOCKER_HOST above), pushes to GHCR, then
# points the Azure Container App at the new SHA.
#
# The image path MUST match cd.yml's IMAGE_NAME. It drifted once, to a
# namespace that does not exist (nitishkumar-ai/class-mode/...), and because
# `az containerapp update` only SETS an image reference without checking it is
# pullable, the script still printed "Deployment successful!" while the new
# revision failed to provision. If you change one, change both.
docker build -t ghcr.io/nitishssh/personallearningpro/personallearningpro:sha-$SHA -t ghcr.io/nitishssh/personallearningpro/personallearningpro:main -f docker/Dockerfile --target production .
echo "Pushing images..."
docker push ghcr.io/nitishssh/personallearningpro/personallearningpro:sha-$SHA
docker push ghcr.io/nitishssh/personallearningpro/personallearningpro:main
# Autoplan T7: migrations are now ordered and one-shot, and there is no generic
# down migration. Take a snapshot you have actually restored from before a
# deploy that carries schema changes. `docs/dashboard/README.md` lists "tested
# restore" as still 0% done — until that changes, treat this as mandatory.
#
#   pg_dump "$POSTGRESQL_URL" -Fc -f "backup-$(date +%Y%m%d-%H%M%S).dump"
#   # restore:  pg_restore --clean --if-exists -d "$POSTGRESQL_URL" <file>
#
if [ -z "${SKIP_BACKUP_CHECK:-}" ]; then
  read -r -p "Have you taken (and can you restore) a database backup? [y/N] " ack
  case "$ack" in
    [yY]*) ;;
    *) echo "Aborting. Take a backup first, or set SKIP_BACKUP_CHECK=1 to override."; exit 1 ;;
  esac
fi

echo "Deploying to Azure Container Apps..."
az containerapp update \
  --name classmode-app \
  --resource-group classmode-rg \
  --image ghcr.io/nitishssh/personallearningpro/personallearningpro:sha-$SHA
echo "Deployment successful!"
