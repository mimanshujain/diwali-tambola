# Milestone 4B — Second Full House and sudden-death mini-rounds

## Rules

- Full House is the first 15-number completion. A second-house prize is available only **after** the first Full House has been awarded (including completion of any sudden death). Any player who received the first-house prize is excluded from the second-house prize.
- A second-house contender who already completed their ticket when the first prize was awarded becomes eligible at the later of their completion sequence and the first-house outcome sequence. Future full-house completions are included by the same logic.
- For ordinary category ties on the same main-game draw, the default remains `SHARED_PRIZE`. If category policy is `SUDDEN_DEATH` and there are at least two tied eligible players, resolving the prize creates a paused mini-round; no winner is declared yet.
- A mini-round gives each tied player a separate random 5-number mini-ticket (configurable size 1–15). It draws from its **own shuffled set of numbers 1–90**, once per configured interval (default 10 s). The first draw that completes one or more players' entire mini-tickets awards the prize to **all** players completed on that same draw.
- The admin must explicitly start/resume the mini-round. The main game must remain paused or completed during a running mini-round. After API restart, any running mini-round is converted to PAUSED, restoring a conservative countdown of at most one full draw interval (a restart never catches up missed draws). Resume requires admin intervention.
- All mini-round draws, participant tickets and completed winners are persisted atomically. Rows are locked under the game record to serialize admin pause/resume and scheduled mini-round calls.
- Prize outcome's original tie-break policy is immutable after resolution. A tie-break cannot be started more than once, and resolved outcomes cannot be resolved again.

## API (admin `x-admin-key` header required)

- `GET /games/:gameId/admin/categories/:categoryId/sudden-death`
- `POST /games/:gameId/admin/categories/:categoryId/sudden-death/start`
- `POST /games/:gameId/admin/categories/:categoryId/sudden-death/pause`

Use existing `POST /games/:gameId/admin/categories/:categoryId/resolve` after pausing the main game to initiate a tie-break, if the category is configured with `tieBreakPolicy: SUDDEN_DEATH` before game start.

## Operational caveats

- The existing Milestone 2 game start/pause/manual-number API lacks admin authentication; **do not expose the Pi beyond your trusted LAN**. Complete admin authorization before party use.
- Do not operate more than one API process while using this single-node restart-freeze scheduler. Use a single Docker API replica on the Pi.
- Do not run `docker compose down -v`: that deletes the persistent PostgreSQL volume.
- For PostgreSQL reliability on microSD, back up the database periodically and use an external SSD for sustained use.
- This milestone does not include TV presentation of mini-tickets, claims UI, or superpower priority semantics.
