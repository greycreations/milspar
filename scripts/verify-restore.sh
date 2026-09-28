#!/usr/bin/env bash
set -euo pipefail
# Run only against the isolated CI stack. Never point this script at a user installation.
node tests/service-book-smoke.mjs create
docker compose stop web api
mkdir -p "$RUNNER_TEMP/milspar-backup"
docker compose exec -T db pg_dump -U milspar -d milspar -Fc > "$RUNNER_TEMP/milspar-backup/database.dump"
docker compose run --rm --no-deps -T api tar -C /data/uploads -cf - . > "$RUNNER_TEMP/milspar-backup/uploads.tar"
docker compose down
docker compose -p milspar-restore up -d db --wait
docker compose -p milspar-restore exec -T db pg_restore -U milspar -d milspar --exit-on-error < "$RUNNER_TEMP/milspar-backup/database.dump"
docker compose -p milspar-restore up -d --build --wait
docker compose -p milspar-restore cp "$RUNNER_TEMP/milspar-backup/uploads.tar" api:/tmp/uploads.tar
docker compose -p milspar-restore exec -T api tar -C /data/uploads -xf /tmp/uploads.tar
node tests/service-book-smoke.mjs verify
docker compose -p milspar-restore down
docker compose up -d --wait
node tests/service-book-smoke.mjs verify
