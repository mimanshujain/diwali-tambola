# Game rules and prize adjudication

## Standard Tambola

Tickets contain 15 numbers in a 3-row by 9-column grid. The caller draws numbers 1–90 without repetition. A submitted ticket is immutable unless an admin explicitly reissues it.

## Prize categories

| Category | Qualifying condition |
|---|---|
| Early Five | Five ticket numbers called |
| Four Corners | First and last occupied positions in the top and bottom rows called |
| Top / Middle / Bottom Line | Every occupied number in that row called |
| Full House | All 15 ticket numbers called |
| Second Full House | Full-house eligibility excluding the actual first-house winner(s) |

A tied category normally shares the prize unless configured for sudden death. **Sudden-death losers remain eligible for Second Full House** under the implemented rule; only actual first-house winners are excluded.

## Sudden death

When enabled for a category, tied contenders receive a mini-ticket (default five numbers). The mini-round has its own draw sequence (default every ten seconds). Contenders finishing on the same draw share the result. Admins can start, pause and resume rounds. Persistent state is intended to support restart recovery; verify this with a rehearsal.

## Lucky Strike

A player may request one uncalled number as a one-time superpower. The admin may approve or reject. On approval, the number is called through the game engine. When that call qualifies the power user for a prize, other eligible players receive the configured priority window (implemented default: 30 seconds). Test the exact eligibility/claim handling before the party.

## Operational policy

Define prizes and tie-sharing rules before starting. Resolve disputed claims against the persisted call sequence and server-calculated eligibility, not handwritten markings alone.
