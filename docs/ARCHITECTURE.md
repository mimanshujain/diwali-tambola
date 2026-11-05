# Architecture (initial baseline)

## Deployment

The Raspberry Pi is the single local host. Docker Compose runs the API and PostgreSQL. The TV and mobile browsers will connect to the Pi over the same trusted LAN.

## Initial components

- `apps/server`: NestJS HTTP API, TypeScript, PostgreSQL connectivity.
- `db`: PostgreSQL container with a named persistent volume.
- `compose.yaml`: local deployment and health dependencies.

## Design principles

1. PostgreSQL is the authoritative durable state store.
2. The API owns all game state transitions; browser clients never write directly to the database.
3. Real-time events (to be added) are notifications. Reconnected clients must be able to reload authoritative state from the API.
4. Number calls, pause/resume, claims, and prize resolution will be transactional and audited.
5. The game must recover from a process/container restart using persisted state rather than an in-memory timer.
6. The Pi is reachable only on a trusted LAN; no public port forwarding is required.

## Health endpoints

- `GET /health/live`: process liveness.
- `GET /health/ready`: API-to-PostgreSQL readiness.

## Next architecture increment

Add Prisma schema and migrations, shared domain types, and the deterministic Tambola ticket/number engine. Keep the database as the source of truth.
