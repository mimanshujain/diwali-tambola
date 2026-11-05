# Architecture (Milestone 2)

## Deployment

The Raspberry Pi is the single local host. Docker Compose runs the API and PostgreSQL. The TV and mobile browsers will connect to the Pi over the same trusted LAN.

## Components

- `apps/server`: NestJS HTTP API and game services, written in TypeScript.
- `apps/server/src/tambola/domain`: side-effect-free ticket and number-sequence logic.
- `apps/server/src/database`: PostgreSQL pool, transaction helper, and versioned SQL migrations.
- `db`: PostgreSQL container with a named persistent volume.
- `compose.yaml`: ARM64-compatible local deployment.

## Persistence and concurrency

PostgreSQL is the source of truth. The shuffled remaining-number permutation is stored on each game. Each number call runs in a transaction and locks its game row with `SELECT ... FOR UPDATE`. That serializes scheduled calls and admin manual calls, preventing duplicate numbers and duplicate sequence positions. Called numbers are separately persisted with sequence, source, and timestamp.

Database migrations are tracked in `schema_migrations` and applied by the API at startup. The existing `pg` driver is retained instead of adding an ORM to the critical call path; explicit SQL makes the locking and transaction boundaries visible. The migration boundary remains independent of the application services.

## Scheduler and restart recovery

`next_call_at` is the timer's durable deadline while a game is RUNNING. The scheduler checks for due games every second and checkpoints remaining delay every five seconds. A graceful shutdown pauses active games using the current remaining delay. After an ungraceful restart, active games are restored as PAUSED using the last checkpoint, so downtime is not counted as playing time (up to approximately five seconds of checkpoint drift). An admin must explicitly resume.

## Ticket rules

Tickets are generated with cryptographic random integers. A validator enforces 3x9 shape, 15 unique numbers, five numbers per row, one to three numbers per column, valid column ranges, and ascending vertical order. Tickets are persisted as AVAILABLE until a later milestone associates them with a player.

## Security boundary

M2 routes do not yet implement authentication. Keep port 3000 on a trusted local network and do not forward it from the internet. Admin/player authentication is a required later milestone before broader deployment.
