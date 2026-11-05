# Diwali Tambola

A self-hosted Tambola game for a local gathering. The Raspberry Pi runs the application and database; phones and the TV connect over the same trusted local network.

## Current implementation

- NestJS 12 + TypeScript API
- PostgreSQL 17 with versioned SQL migrations
- Docker Compose deployment for ARM64 Raspberry Pi OS
- Health endpoints (`/health/live`, `/health/ready`)
- Standard 3x9 Tambola ticket generation (15 numbers, column ranges enforced)
- Cryptographically shuffled 1-90 draw order persisted in PostgreSQL
- Transactional scheduled/manual calls with game-row locking
- Pause/resume and restart recovery (a restarted game returns PAUSED)
- Node test-runner tests for tickets and draw permutations

## Prerequisites

- Raspberry Pi OS 64-bit (Debian 13 / ARM64)
- Docker Engine and Docker Compose plugin
- Git

Node.js and PostgreSQL are intentionally not installed on the Pi host; they run in containers.

## Start or update

```bash
sudo docker compose up -d --build --wait
sudo docker compose ps
```

The API applies database migrations at startup. Existing PostgreSQL data is kept in the `postgres_data` volume.

## Verify

```bash
curl -fsS http://127.0.0.1:3000/health/live
curl -fsS http://127.0.0.1:3000/health/ready
```

## Game API quick test

Create a game:

```bash
curl -fsS -X POST http://127.0.0.1:3000/games \
  -H 'Content-Type: application/json' \
  -d '{"name":"Diwali Tambola","intervalSeconds":300}'
```

Copy the returned `id` and use it below:

```bash
GAME_ID='<returned-uuid>'

# Generate one stored, currently unassigned ticket.
curl -fsS -X POST "http://127.0.0.1:3000/games/$GAME_ID/tickets"

# Start, inspect, pause, and resume.
curl -fsS -X POST "http://127.0.0.1:3000/games/$GAME_ID/start"
curl -fsS "http://127.0.0.1:3000/games/$GAME_ID"
curl -fsS "http://127.0.0.1:3000/games/$GAME_ID/calls"
curl -fsS -X POST "http://127.0.0.1:3000/games/$GAME_ID/pause"
curl -fsS -X POST "http://127.0.0.1:3000/games/$GAME_ID/resume"

# Call a specific uncalled number (resets the timer).
curl -fsS -X POST "http://127.0.0.1:3000/games/$GAME_ID/calls/manual" \
  -H 'Content-Type: application/json' -d '{"number":47}'
```

Scheduled calls are automatic at the configured interval. For safe testing, set `intervalSeconds` to 10 when creating a test game. The allowed range is 10-86400 seconds.

## Operations

```bash
sudo docker compose logs -f api
sudo docker compose logs -f db
sudo docker compose restart api
sudo docker compose down                 # Stops containers; keeps database volume
sudo docker compose down -v              # DESTRUCTIVE: also deletes database data
```

## Important security boundary

M2 endpoints do not yet have player/admin authentication. Restrict access to your trusted home LAN and do not forward port 3000 from the internet. Authentication is part of a later milestone.

## Current implementation boundary

Tickets are saved as AVAILABLE and are not yet attached to players. Registration, ticket submission/reissue, winning categories, claims, tie-breaks, superpower, WebSockets, and printing are later milestones.


## Milestone 3
Guest registration, mobile/device duplicate controls, private player tickets, draft submission, and audited admin reissue. See `docs/MILESTONE_3.md`.


## Milestone 4A
Prize eligibility, player claims, admin review, shared-prize settlement. See docs/MILESTONE_4.md.


## Milestone 4B
Sudden-death mini-rounds and Second Full House. See docs/MILESTONE_4B.md.

## Milestones 5 and 6

Lucky Strike, the TV screen, player UI, and admin UI are documented in [docs/MILESTONE_5_6.md](docs/MILESTONE_5_6.md).
# Diwali Tambola — Documentation Guide

A LAN-hosted Indian Tambola experience running on a Raspberry Pi with a NestJS API, PostgreSQL and browser-based TV, player and admin views.

## Start in two commands

```bash
cd ~/projects/diwali-tambola
sudo docker compose up -d --build --wait
curl -fsS http://localhost:3000/health/ready
```

Find the Pi's address with `hostname -I`. On the same trusted Wi-Fi, open `http://PI_IP:3000/admin`, create a game, and use the game ID at `http://PI_IP:3000/tv/GAME_ID` and `http://PI_IP:3000/join/GAME_ID`.

## Documentation

- [Getting started](docs/GETTING_STARTED.md)
- [Gameplay and rules](docs/GAME_RULES.md)
- [Operator guide](docs/OPERATIONS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Development and tests](docs/DEVELOPMENT.md)
- [Security](docs/SECURITY.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

> These guides document the project as developed through M7. Confirm any endpoint or configuration against the deployed source before treating it as a stable public contract.
