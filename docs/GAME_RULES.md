# Tambola engine rules (Milestone 2)

## Ticket layout

A ticket is a 3-row x 9-column grid with exactly 15 numbers. Every row has exactly five numbers. Every column has one to three numbers and uses its fixed range:

| Column | Range |
|---:|---:|
| 1 | 1-9 |
| 2 | 10-19 |
| 3 | 20-29 |
| 4 | 30-39 |
| 5 | 40-49 |
| 6 | 50-59 |
| 7 | 60-69 |
| 8 | 70-79 |
| 9 | 80-90 |

Numbers increase from top to bottom within a column. Empty cells are represented as JSON `null`. Generation uses `node:crypto` secure random integers and is validated before storage.

## Number draw

Each game receives a cryptographically shuffled permutation of 1-90 at creation. The remaining order is persisted in PostgreSQL. A call transaction locks the game row, removes exactly one number, appends one `called_numbers` row, increments the sequence, and advances the next-call deadline. A game-level row lock serializes scheduler and manual calls.

Manual calls must be between 1 and 90 and must not have been called already. A successful manual call resets the interval timer.

## Scheduling and recovery

The database `next_call_at` timestamp is the runtime scheduling authority. The API checks for due calls once per second. It checkpoints the seconds remaining every five seconds. On graceful shutdown the game is paused with the current remaining delay. After an ungraceful restart, the game is also restored as PAUSED using the last checkpoint (at most about five seconds of timer drift); downtime is not counted as game time. An admin must resume the game.

## Current boundary

Tickets are persisted as AVAILABLE but are not yet assigned to players. Player identity, submission/immutability, winning categories, claims, tie-breaks, superpower, and admin authentication are later milestones. Keep this API on a trusted LAN and do not expose it to the internet.
