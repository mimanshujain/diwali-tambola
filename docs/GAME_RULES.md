# Game rules and prize adjudication

## Standard Tambola

Tickets contain 15 numbers in a 3-row by 9-column grid. The caller draws numbers 1–90 without repetition. A submitted ticket is immutable unless an admin explicitly reissues it.

## Prize categories

| Category | Qualifying condition |
|---|---|
| Early Five | Five ticket numbers called |
| Early Seven / Early Ten | Seven / ten ticket numbers called |
| Four Corners | First and last occupied positions in the top and bottom rows called |
| Top / Middle / Bottom Line | Every occupied number in that row called |
| Any Two Lines | Every occupied number in any two rows called |
| All Odd / All Even | Every odd / even ticket number called; an empty set does not qualify |
| Full House | All 15 ticket numbers called |
| Second Full House | Full-house eligibility excluding the actual first-house winner(s) |

A tied category normally shares the prize unless configured for sudden death. **Sudden-death losers remain eligible for Second Full House** under the implemented rule; only actual first-house winners are excluded.

The server evaluates active rules in the same transaction as each draw and announces the earliest eligible tickets on the TV and host console. A player can also press **Claim** to alert the host and automatically pause play, but a claim is not required: the host resolves the prize using the earliest qualifying draw, including all same-draw ties. A running tie-break also pauses when a claim arrives. Lucky Strike priority windows retain their special claimant rule.

Late registrations are submitted immediately but need host approval. They become eligible on the **next call after approval**, never retroactively ahead of existing contenders. Approved lobby drafts are submitted automatically at the first start.

The host can add or rename a category before starting by selecting an existing rule. A genuinely new winning pattern requires a code change: add the rule and evaluator in [rules.ts](../apps/server/src/winners/domain/rules.ts), update the database rule constraint in a new migration, and add tests. Categories cannot be added or changed after play starts; the current engine does not accept arbitrary rule expressions.

## Sudden death

When enabled for a category, tied contenders receive a mini-ticket (default five numbers). The mini-round has its own draw sequence (default every ten seconds). Contenders finishing on the same draw share the result. Admins can start, pause and resume rounds. Persistent state is intended to support restart recovery; verify this with a rehearsal.

## Lucky Strike

A player may request one uncalled number as a one-time superpower. A successful request pauses play; the host may approve or reject it. Approval calls the number without resuming an already-paused game, and the host resumes when ready. When that call qualifies the power user for a prize, other eligible players receive the configured priority window (implemented default: 30 seconds). Test the exact eligibility/claim handling before the party.

## Operational policy

Define prizes and tie-sharing rules before starting. Resolve disputed claims against the persisted call sequence and server-calculated eligibility, not handwritten markings alone.
