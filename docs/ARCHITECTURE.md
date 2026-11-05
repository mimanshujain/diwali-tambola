# Architecture

```text
TV browser ───────────┐
Player browsers ──────┼── LAN HTTP / Socket.IO ── NestJS API ── PostgreSQL
Admin browser ────────┘                         │
                                               └── Draw, ticket, prize,
                                                   power and scheduler logic
```

## Components

- **NestJS / TypeScript API:** registration, ticket issuance, number calling, winner evaluation, admin actions and UI routes.
- **PostgreSQL:** durable games, players, tickets, draw sequence, claims, sudden-death and Lucky Strike state.
- **Docker Compose:** runs the API and database containers on the Pi.
- **Browser views:** TV display, guest ticket interface and admin control panel, served on port 3000.
- **Socket.IO (M7-A):** live change notifications; clients refresh authoritative API state and retain polling as a fallback.

## Reliability model

The database is authoritative. Clients should treat push notifications as invalidation signals rather than as a separate source of truth. Verify transaction boundaries and recovery behavior against the current code when changing the scheduler or winner logic.

## Source discovery

To locate actual routes and migration files in the checkout:

```bash
find apps/server/src -name '*controller.ts' -o -path '*/migrations/*' | sort
rg '@(Get|Post|Patch|Delete)\(' apps/server/src
```

API routes are implementation-specific and may change; use source inspection rather than assuming these guides enumerate every endpoint.
