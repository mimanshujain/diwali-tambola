#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
backup_file=${1:?Usage: bash scripts/restore.sh /path/to/backup.dump}
test -r "$backup_file"
if [[ ${CONFIRM_RESTORE:-} != RESTORE ]]; then
  printf 'This replaces the current database with the supplied backup. Set CONFIRM_RESTORE=RESTORE to proceed.\n' >&2
  exit 1
fi
# Validate the archive before stopping the application.
docker compose exec -T db pg_restore --list < "$backup_file" > /dev/null
docker compose stop api
# A failed restore rolls back as one transaction. Leave the API stopped for inspection.
docker compose exec -T db sh -c 'pg_restore --clean --if-exists --single-transaction --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$backup_file"
docker compose start api
printf 'Restore completed. Check readiness and review recovered games before resuming.\n'
