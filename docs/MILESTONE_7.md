# M7 / Phase A — Live synchronization and reconnect safety

This is **Phase A** of M7. It introduces Socket.IO game-room invalidations,
PostgreSQL transaction-committed NOTIFY triggers, and resilient clients. It does
**not** implement direct CUPS print queues, TV animation/audio, role-based
admin sessions, or the final 50-player end-to-end rehearsal yet.

## Architecture

- The game engine, winner evaluation, draw scheduler and Lucky Strike decisions
  remain unchanged. PostgreSQL stays authoritative.
- Migration `006_live_updates` creates a trigger on every main-game table with
  a direct `game_id`. Transactions emit only the affected game UUID on
  `tambola_game_changed` after commit. No personal data travels in NOTIFY.
- A dedicated PostgreSQL listener reconnects after unexpected disconnections.
- Socket.IO clients may join **one public game room** after game-existence
  verification. Only `{gameId}` invalidation messages are emitted.
- TV, guest, and admin UIs fetch their existing API snapshots when notified.
  They refetch on Socket.IO connection/reconnection and browser focus.
- HTTP polling continues every 30 seconds if the socket or database listener
  is unavailable. The display countdown remains updated locally.
- Socket.IO and client scripts use the same LAN port 3000; no CDN or new port.

## Deploy

Only apply this to a clean, committed M5/M6 checkout **including the migration
005 startup fix**. The installer checks compatibility before creating a new
branch, and **never** force-applies patches or destroys the existing DB volume.

```sh
cd ~/projects/diwali-tambola
bash ~/apply-m7a.sh 2>&1 | tee ~/tambola-m7a-install.log
```

If an installer step fails, **do not rerun it**. Inspect the reported step and
resume verification manually from the commands below. A failed acceptance test
does not mean the code can be committed.

## Validation on Pi

```sh
sudo docker compose ps
curl -fsS http://127.0.0.1:3000/health/ready
sudo docker compose exec -T api node --input-type=module - < tests/m7-live.mjs
# Simulate 25 simultaneously connected watchers; uses a fresh isolated game:
sudo docker compose exec -T -e M7_TEST_CLIENTS=25 api node --input-type=module - < tests/m7-live.mjs
sudo docker compose logs --tail=80 api
```

## Manual rehearsal

1. Create one disposable game in admin; open TV on a laptop and player page on
   phone connected to the same LAN. Look for **Live connected** on each screen.
2. Register and submit a ticket. The player list should update almost at once.
3. Start game and call a number. The TV board and phone mark it without waiting
   for the 30-second polling interval.
4. Approve a Lucky Strike and verify the number and power announcement update.
5. Disable Wi-Fi on one phone, then reconnect: within seconds, the phone should
   resubscribe and fetch the latest full state.
6. Restart the API while a game is running. Existing recovery policy pauses it;
   after reconnect, TV and admin should show PAUSED until admin resumes.
7. Confirm an unauthenticated call to an admin action still receives HTTP 401.
8. Do not expose TCP port 3000 outside the trusted LAN.

## Rollback

The migration adds only a function and triggers. Its presence is safe with the
previous application version, but reverting a migration requires DBA review.
To revert application behavior, redeploy the previous tested `main` commit and
leave the PostgreSQL volume untouched. Existing tickets and calls remain intact.

## Later M7 work

Phase B: admin access and printing hardening; Phase C: TV celebration and
accessible layout; Phase D: 20–50 simulated guests, network interruptions,
restart/recovery rehearsal and performance profiling.
