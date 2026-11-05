# Diwali Tambola

A self-hosted Tambola game for a local gathering. The Raspberry Pi runs the application and database; phones and the TV connect over the same trusted local network.

## Milestone 1: application foundation

- TypeScript API using NestJS 12
- PostgreSQL 17, persisted in a Docker volume
- Docker Compose deployment for ARM64 Raspberry Pi OS
- Liveness and database-readiness endpoints

## Prerequisites

- Raspberry Pi OS 64-bit (Debian 13 / ARM64)
- Docker Engine and Docker Compose plugin
- Git

Node.js and PostgreSQL are intentionally not installed on the Pi host; they run in containers.

## Start

```bash
# Create .env once; do not commit it.
cp .env.example .env
# Replace POSTGRES_PASSWORD with a long random value if you create .env manually.

sudo docker compose up -d --build --wait
sudo docker compose ps
```

The bootstrap script generates `.env` automatically when it is missing.

## Verify

```bash
curl -fsS http://127.0.0.1:3000/health/live
curl -fsS http://127.0.0.1:3000/health/ready
```

- `GET /health/live` confirms that the API process is running.
- `GET /health/ready` confirms that the API can query PostgreSQL.

The API is exposed on port `3000` for devices on the LAN. Keep the Pi on a trusted network and do not forward this port from the internet.

## Operations

```bash
sudo docker compose logs -f api
sudo docker compose logs -f db
sudo docker compose restart api
sudo docker compose down                 # Stops containers; keeps database volume
sudo docker compose down -v              # DESTRUCTIVE: also deletes database data
```

## Current implementation boundary

This milestone only establishes the deployable API/database foundation. It does not yet implement player registration, ticket generation, number calling, admin authentication, WebSockets, winning categories, superpower, or printing. Those will be added in subsequent milestones with tests and database migrations.
