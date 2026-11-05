# Diwali Tambola

A festive, self-hosted Tambola game for a Raspberry Pi, with phone tickets, a TV board and a private host console. NestJS 12, TypeScript, PostgreSQL 17, Node 26 and Docker Compose.

## Host a game

```bash
sudo docker compose up -d --build --wait
curl -fsS http://localhost:3000/health/ready
```

Open `http://PI_IP:3000/admin` on your trusted Wi-Fi and enter the configured admin key. Create or select a game, approve guests, configure prizes and start once all active tickets are submitted. The console provides a QR code and a short game-code TV URL such as `/tv/ABC234`.

- Search and switch games; collapse console sections.
- Name-only guest registration, host approval, draft recreation, confirmation before submission and private recovery codes.
- Unique active ticket number sets within each game; submitted tickets stay fixed.
- Scheduled and manual draws, one-click timing overrides, emergency stop and confirmed end-game control.
- Custom prize categories, claims, shared prizes, sudden-death rounds and Lucky Strike.
- A viewport-fitted TV board with optional sound and live updates.
- One ticket per landscape 4 × 6 printed sheet.
- Restart recovery to paused play, activity records and database backup/restore scripts.

## Public guests and private hosting

For HTTPS guest access through Cloudflare Tunnel, use the opt-in `compose.public.yaml` configuration and the [public access guide](docs/PUBLIC_GUEST_ACCESS.md). Only the guest gateway should be published. Admin, TV, player rosters and host operations remain on the private LAN. Never expose port 3000 directly to the internet.

The API applies migrations at startup and keeps data in the PostgreSQL volume. Back up before upgrades. Restarting containers preserves the volume; deleting it does not.

## Documentation

- [Party console, recovery, prizes, printing and deployment](docs/PARTY_UPGRADE.md)
- [Getting started](docs/GETTING_STARTED.md)
- [Gameplay and rules](docs/GAME_RULES.md)
- [Operator guide](docs/OPERATIONS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Development and verification](docs/DEVELOPMENT.md)
- [Security](docs/SECURITY.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

The party upgrade guide describes current behavior where older milestone notes differ.
