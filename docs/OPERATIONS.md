# Operations runbook

## Everyday commands

```bash
cd ~/projects/diwali-tambola
sudo docker compose ps
sudo docker compose logs --tail=100 api
curl -fsS http://localhost:3000/health/ready
```

Restart only the API: `sudo docker compose restart api`.

Rebuild changed code: `sudo docker compose up -d --build --wait`.

## Persistence and backups

A rebuild or normal restart does not intentionally clear committed PostgreSQL data **if the database data directory is mounted persistently**. Verify the effective configuration with `sudo docker compose config` and inspect the `db` volume mount.

Before upgrades, back up the database. One standard approach, assuming the Compose database service is named `db` and `pg_dumpall` is available:

```bash
mkdir -p "$HOME/tambola-backups"
sudo docker compose exec -T db sh -c 'pg_dumpall -U "${POSTGRES_USER:-postgres}"' > "$HOME/tambola-backups/all-$(date +%Y%m%d-%H%M%S).sql"
```

Check the backup file is nonempty and test restoration on a **separate disposable database** before relying on it. Never restore over an active party database. The command may need adaptation if the database uses different credentials.

**Never run `docker compose down -v` unless you deliberately intend to delete Compose-managed database volumes.**

## During a party

- Keep admin token private and the admin screen on a trusted device.
- Avoid rebuilding or restarting while a game is active.
- If Wi-Fi drops, reconnect and verify that the ticket/call sequence catches up.
- If a number is disputed, pause calling, inspect the admin state, and resolve before resuming.

## Upgrades

Use a feature branch, pass all automated tests, take a backup, deploy, then verify health and a disposable game before merging to main.
