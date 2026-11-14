# Tambola

Want to let other organizers host without a Raspberry Pi? Read the [hosted implementation and environment guide](docs/HOSTED_IMPLEMENTATION.md) to understand how host accounts, guest links and TV pairing work. Use the [hosted pilot runbook](docs/HOSTED_PILOT.md) to deploy on Render. The Raspberry Pi setup below uses LAN mode by default.

A festive, self-hosted Tambola game for a Raspberry Pi, with phone tickets, a TV board and a private host console. NestJS 12, TypeScript, PostgreSQL 17, Node 26 and Docker Compose.

## Host a game

```bash
sudo docker compose up -d --build --wait
curl -fsS http://localhost:3000/health/ready
```

Open `http://PI_IP:3000/admin` on your trusted Wi-Fi and enter the configured admin key. Create or select a game, approve guests, configure prizes and start; approved draft tickets are submitted automatically. The console provides a short game-code TV URL such as `/tv/ABC234`.

- Search and switch games; collapse console sections.
- Name-only registration, host approval, up to three draft recreations, late joins and private recovery codes.
- Unique active ticket number sets within each game; submitted tickets stay fixed.
- Scheduled and manual draws, one-click timing overrides, emergency stop and confirmed end-game control.
- Configurable prize categories, automatic eligibility announcements, claim review, shared prizes, sudden death and Lucky Strike.
- TV lobby and live roster, vertical call order, claim review and results, with optional Hindi commentary and Spotify player.
- Selectable ticket printing on A4, with up to three tickets per page.
- Restart recovery to paused play, activity records and database backup/restore scripts.

## Public guests and private hosting

For HTTPS guest access through Cloudflare Tunnel, use the opt-in `compose.public.yaml` configuration and the [public access guide](docs/PUBLIC_GUEST_ACCESS.md). Only the guest gateway should be published. Admin, TV, player rosters and host operations remain on the private LAN. Never expose port 3000 directly to the internet.

The API applies migrations at startup and keeps data in the PostgreSQL volume. Back up before upgrades. Restarting containers preserves the volume; deleting it does not.

Before hosting, replace the example `ADMIN_TOKEN` in `.env` with a private random value (for example, generate one with `openssl rand -hex 32`). Recreate the API container to apply it. Never share or commit the token.

## Documentation

- [Occasion presets, custom colors and print previews](docs/OCCASION_THEMES.md)
- [Party console, recovery, prizes, printing and deployment](docs/PARTY_UPGRADE.md)
- [Getting started](docs/GETTING_STARTED.md)
- [Gameplay and rules](docs/GAME_RULES.md)
- [Operator guide](docs/OPERATIONS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Development and verification](docs/DEVELOPMENT.md)
- [Security](docs/SECURITY.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

The party upgrade guide describes current behavior where older milestone notes differ.
