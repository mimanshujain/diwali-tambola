#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
backup_dir=${1:-./backups}
mkdir -p "$backup_dir"
backup_file="$backup_dir/tambola-$(date -u +%Y%m%dT%H%M%SZ)-$$.dump"
trap 'rm -f "$backup_file.tmp"' EXIT
docker compose exec -T db sh -c 'pg_dump --format=custom --no-owner --no-acl -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$backup_file.tmp"
test -s "$backup_file.tmp"
mv "$backup_file.tmp" "$backup_file"
printf 'Backup saved to %s\n' "$backup_file"
