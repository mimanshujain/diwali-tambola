# Diwali party console

## Host the evening

Open `http://PI_IP:3000/admin` on the private Wi-Fi and enter the existing admin key. The host desk lists active games, player/submission counts and called-number counts. Search by name/code, show completed games, or switch games from any console. Each console section can be collapsed; the browser remembers the preference.

The plum, gold and teal theme is shared by the host, guest and TV screens. The TV uses the available landscape viewport for all 90 numbers, current call, countdown, guest QR and rotating prizes. Fullscreen and optional sound remain available. Physical TV overscan should be disabled in the TV's picture settings if the screen crops the browser itself.

The **TV display & guest access** section contains a scannable TV link such as `/tv/ABC234`. Short codes select the game; UUIDs remain internal database/API identifiers. Existing UUID TV bookmarks still work. Scan the TV QR using a phone on the same LAN. The separate guest link uses `PUBLIC_GUEST_ORIGIN` when configured; admin and TV routes remain private behind the guest-only gateway.

## Players and ticket integrity

1. Guests enter a recognizable name. No phone number is requested or stored for new registrations.
2. The host verifies the person and selects **Approve identity**. Names and device IDs must be unique within that game; use a distinguishing name when two guests share a name.
3. Guests can **Recreate ticket** while it is a draft. **Confirm & submit** asks for confirmation and submits that exact ticket ID. If another session changed the ticket, submission is rejected until the guest reviews it again.
4. Submission locks the ticket. All active registrations must submit before starting. Remove absent players from the lobby or reissue a ticket there when necessary. Registration, regeneration, reissue and first submission close when play starts.

Different tickets naturally share some numbers. A conflict means the same complete 15-number set in the same game. A database trigger serializes and rejects duplicate active sets, and the generator retries collisions. Revoked tickets are excluded. Existing duplicates are preserved by the migration, reported in the console and block starting/resuming; resolve lobby conflicts before play. Never change an already-running game's tickets to fix a fairness issue; stop it and arrange a new game if necessary.

Host approval confirms an in-person identity; a display name or browser identifier is not proof of legal identity. Existing registrations are grandfathered as approved so an upgrade does not invalidate an underway game. Historical phone values are retained in the database, but are no longer returned in the host player list or requested by the UI.

## Recover a guest session

Each registration receives a private 32-character recovery code. Save it privately. **Already joined? Restore your ticket** restores the same player, submitted ticket and game progress on another device. Recovery replaces the previous bearer token, so the old browser loses access. The code stays usable until the host resets access; a retry can recover a lost response.

If a player loses the code, verify them in person and use **Reset access**. Give the new code privately to that person. This invalidates the old code/session without changing the ticket. Recovery and access resets are recorded without recording the secrets.

## Control the pace

- **Call next now** consumes the next saved shuffled number and resets the countdown. An expected draw sequence prevents a repeated tap/retry from consuming a second number.
- **+30 seconds**, **Reset countdown**, and **Set interval & reset** override timing in one click, including a paused game's delay. Manual number selection asks for confirmation.
- **Emergency stop** immediately freezes the main draw and all running tie-breaks once the stop transaction commits. Records remain intact. **Release stop** clears the lock but does not start play; resume the main game or relevant tie-break explicitly.
- **End game** requires typing its game code. It permanently closes play and retains tickets, calls and winners. It cannot be released or resumed.
- **Activity & recovery** shows host state changes, player approvals, withdrawals and access recovery. Draw history, prize outcomes and reissues also remain in their existing database tables.

## Prizes

Add named prizes, descriptions and a shared-prize or sudden-death tie policy before starting. Available rules: Early Five, Early Seven, Early Ten, Four Corners, Top/Middle/Bottom Line, Any Two Lines, All Odd Numbers, All Even Numbers, Full House and Second Full House. A game may have multiple differently named prizes for a rule except the two house rules, which remain unique to preserve their ordering.

All Odd/Even means every odd/even number present on the ticket; an empty matching set never wins. Any Two Lines requires two complete rows. Winners are evaluated from committed draw sequences. Changing prize rules or descriptions after play starts is blocked.

## Print on 4 × 6 paper

Print an individual submitted ticket or all submitted tickets from the console. Each ticket occupies one **6-inch-wide × 4-inch-high landscape** page, with player name, game code, ticket number and the 3×9 grid. Drafts cannot be printed as final tickets.

In the print dialog select **4 × 6 paper**, **landscape**, **100% scale**, and turn browser headers/footers off. The document uses 0.2-inch page margins. Reprints keep the same ticket number. Test one sheet on your printer before printing a batch; printer drivers can override browser page size.

## Restart, backup and restore

Committed state lives in PostgreSQL, including shuffled remaining numbers, tickets, calls, prize outcomes, powers and tie-break entries. Running main games and tie-breaks return paused after an API restart; the host reviews and resumes. Timer checkpoints occur every five seconds, so a hard crash may restore a few extra countdown seconds. A graceful shutdown saves the remaining delay. Run only one API instance for this single-host scheduler.

A database volume survives container restarts. It does not protect against a failed SD card or deleting the volume. Make a backup before deploying this migration, and copy backups to separate storage. Backups include player credentials and must remain private.

```bash
# From the repository; prefix with sudo if your Docker setup requires it.
bash scripts/backup.sh /path/to/private-backups

# Restore REPLACES the current database with the selected snapshot.
CONFIRM_RESTORE=RESTORE bash scripts/restore.sh /path/to/private-backups/tambola-TIMESTAMP.dump
curl -fsS http://localhost:3000/health/ready
```

Backup streams a consistent PostgreSQL custom-format dump into a private temporary file, then renames it only after success. Restore validates the archive, stops the API, restores in one database transaction and restarts the API only after success. If restore fails, inspect it while the API remains stopped. Keep the existing `.env` separately; the database dump does not include Docker configuration or Cloudflare credentials.

## Deploy

After merging and pulling this branch, back up before rebuilding. For the public guest setup:

```bash
bash scripts/backup.sh
sudo docker compose -f compose.yaml -f compose.public.yaml up -d --build --wait
curl -fsS http://localhost:3000/health/ready
```

For LAN-only deployment omit `-f compose.public.yaml`. Migration `008_party_operations` runs transactionally at startup, keeps old tickets and adds the new protections. Refresh open browser tabs after deploying. Never use `docker compose down -v` during an update.

## Verification

Use disposable databases/games for acceptance tests. See [DEVELOPMENT.md](DEVELOPMENT.md). The upgrade adds HTTP operations, concurrent duplicate-write, legacy migration, browser/print, forced-crash and backup/restore acceptance coverage. The Docker workflow runs on PostgreSQL 17; the optional local rehearsal uses an isolated embedded PostgreSQL 18 instance. Physical TV remote/browser behavior and printer-driver output still require a device rehearsal.
