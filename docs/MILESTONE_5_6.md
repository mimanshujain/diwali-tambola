# Milestones 5 + 6 — Lucky Strike and first complete LAN interfaces

This patch assumes M4B is committed and merged into `main`. It adds:

- One Lucky Strike request per player, only after ticket submission and while game RUNNING.
- Admin approval calls the selected uncalled number atomically using the same game lock, draw sequence, and winner snapshot as manual/scheduled calls.
- One active pending request per player; a rejection returns the power to AVAILABLE; approval consumes it irreversibly.
- A **30-second** priority window when the powered player's *new* eligibility ties with other players on the same call. During the window, admin resolution returns HTTP 409. After the window, other eligible players who actually claimed take precedence; otherwise the powered player wins. Ordinary categories retain the configured SHARED_PRIZE / SUDDEN_DEATH policy.
- A public TV at `/tv/<game-id>` with 90-ball grid, timer, join QR, player names, winners, and power call announcements.
- A responsive player page at `/join/<game-id>` with called-number marking, prize claims, and Lucky Strike request status.
- An admin page at `/admin` to create games; `/admin/<game-id>` to control draws, inspect winners, approve/reject Lucky Strikes, configure prize policy, reissue and print tickets, and run sudden death.
- An authenticated JSON endpoint for printable player tickets and a deliberately public privacy-filtered `/games/<id>/display` endpoint.

## Safety and compatibility

- **Breaking security change:** all main-game mutating routes (`POST /games`, start, pause, resume, manual call, generate ticket) now require `x-admin-key: <ADMIN_TOKEN>`. Update any old test scripts accordingly. Player routes retain bearer-token auth, as before.
- The QR code is generated locally using `qrcode` on the Pi. No third-party QR service or remote CDN.
- Browser UI uses modest HTTP polling (TV 2.5s; player 3.5s; admin 4.5s) rather than introducing WebSocket infrastructure in this release. Source of truth remains PostgreSQL. This is a functional, single-port UI, not yet the originally envisioned React/Vite component refactor.
- Admin credential is kept in browser **sessionStorage**, never in a URL. Use only on trusted home Wi-Fi; do not forward port 3000 to the public internet.
- Admin printing uses the browser print dialog. The printer must be available to the admin browser; a headless Pi CUPS print queue is not implemented yet.
- Existing PostgreSQL volume remains unchanged; migration 005 adds new tables and a nullable call reference.
- Existing games and players remain intact, but direct control URLs require the admin key.
- The UI uses ASCII/standard HTML, no external web dependencies. It works offline after containers are built.

## Installation

From the Pi (after copying `apply-m5m6.sh` to the Pi):

```sh
cd ~/projects/diwali-tambola
bash ~/apply-m5m6.sh 2>&1 | tee ~/tambola-m5m6-install.log
```

The installer requires a clean `main` at the M4B baseline. It creates `feature/m5-m6-lucky-strike-ui`, applies the patch, updates npm lock as your UID, runs tests/typecheck/build, then optionally redeploys Docker only after validation passes. If a step fails, fix the checked-out code and resume from the documented commands; **do not rerun the installer**.

## Pi verification

```sh
sudo docker compose ps
curl -fsS http://127.0.0.1:3000/health/ready
python3 tests/m5m6-integration.py
# Extra 30-second priority-window test (runs the basic suite first):
python3 tests/m5m6-integration.py --priority
```

The Python script creates its own isolated game and fictional players; it doesn't modify earlier games. It reads `ADMIN_TOKEN` from `.env` locally and never prints the credential. It accepts the documented HTTP 201 status for successful POSTs.

Obtain Pi IP: `hostname -I`. Open `http://PI_IP:3000/admin` to create a game, `http://PI_IP:3000/tv/GAME_ID` on your TV and `http://PI_IP:3000/join/GAME_ID` on guests' phones.

## Manual acceptance (essential)

1. Start a fresh game from the admin page; open TV and player page on other devices.
2. Register/submit two tickets; confirm names appear on the TV, and the QR scans on a second phone.
3. Request number 47 on player A; approve from admin; confirm exactly one draw and power becomes USED. Repeat request must fail.
4. Request from B and reject; verify B can request again. Approve a different uncalled number.
5. Verify the ticket marks previously called numbers when a late guest joins, and winner claims appear on admin.
6. Pause/resume manually and force a valid prize tie in a disposable game to verify category resolution/priority window.
7. Print a ticket using the browser print dialog, with a network printer configured on the admin's device.
8. Restart the API and verify ongoing games and sudden-death rounds freeze as PAUSED until manually resumed.

## Not in scope yet

- React/Vite refactor and websocket-based push updates
- Server-side CUPS automatic print jobs
- Remote access outside LAN
- SMS phone ownership verification
- A polished login/session backend or multi-admin roles
