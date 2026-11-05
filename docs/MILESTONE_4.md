# Milestone 4A — Prize qualification, claims and shared winners

This is the first portion of Milestone 4. Sudden-death mini-round execution is **not implemented** yet. It is a separate follow-up before party use. A category configured as SUDDEN_DEATH will enter `SUDDEN_DEATH_PENDING` if multiple players qualify on the same call; **no winner is declared** until that mini-round implementation is added.

## Winner semantics

- All submitted tickets are evaluated atomically immediately after each number call (manual or scheduled) while the game row is locked.
- `category_eligibility.first_eligible_sequence` is immutable: network latency and claim tapping do not determine who was first.
- Four Corners = leftmost and rightmost **occupied** cells in top and bottom ticket rows.
- Early Five = any five ticket numbers called; each row = its five numbers; Full House = all fifteen.
- Only the first Full House category is resolved in this phase. Second Full House category exists in schema but is withheld until the first-house outcome and distinct-winner semantics are implemented.
- A valid player claim requires a submitted active ticket and prior qualification. An administrator resolves while PAUSED (or COMPLETED). The earliest eligibility draw wins; players with equal earliest draw share the prize by default even if one hasn't tapped Claim yet.
- Claim verification and resolution are separate; resolution is idempotency-protected with a unique category outcome. Admin key required for administrative endpoints.
- Reissue of submitted tickets mid-game can invalidate eligibility; avoid reissuing after play starts until claim/reissue rules are finalized.

## API

| Method | Endpoint | Auth |
|---|---|---|
| GET | `/games/:gameId/categories` | Public |
| PATCH | `/games/:gameId/admin/categories/:categoryId` | Admin `x-admin-key` (before game starts) |
| POST | `/games/:gameId/players/me/claims` `{categoryId}` | Player Bearer token |
| GET | `/games/:gameId/admin/claims` | Admin |
| GET | `/games/:gameId/admin/eligible-winners` | Admin |
| POST | `/games/:gameId/admin/categories/:categoryId/resolve` | Admin, game paused |

## Safety and remaining work

- M2 start/pause/manual-number endpoints still lack admin authentication. **Do not expose the Pi to an untrusted network or the public internet.** Hardening is needed before party use.
- Sudden death and Second Full House settlement are not ready. UI, superpower, and printing remain upcoming milestones.
- No destructive migrations; PostgreSQL data remains intact. Never run `docker compose down -v`.
