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
- Verify guest Wi-Fi does not enable client/AP isolation: phones and the TV must reach the Pi.
- Avoid rebuilding or restarting while a game is active.
- If Wi-Fi drops, reconnect and verify that the ticket/call sequence catches up.
- Enable host alert sounds; claims and Lucky Strike requests pause play. Use **Review claim** to show a ticket on the TV, then confirm or cancel; approve or reject Lucky Strike and resume when ready.
- If a guest changes browsers, use their private recovery code or **Release phone / reset access** after verifying their identity.
- For a smartphone-free player, approve and submit a ticket and print it in the browser. Automatic printing requires a separately configured CUPS queue; the app does not set one up.

Run `python3 tests/m7-party-rehearsal.py` on the Pi before the party. It creates a separate, persistent 30-player rehearsal game and does not delete existing games. Confirm the TV's audio, Hindi voice, Spotify playback and physical printer separately.

## Upgrades

Use a feature branch, pass all automated tests, take a backup, deploy, then verify health and a disposable game before merging to main.
