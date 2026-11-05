# Public HTTPS guest access (Cloudflare Tunnel)

**Status:** Opt-in; no tunnel or DNS record is created automatically by this
repository. Only switch on after the test checklist passes. Requires the
six-character join-code feature (`feature/short-game-codes`, PR #8).

## Security architecture

```text
Guests (mobile data / Wi-Fi) --HTTPS--> Cloudflare Tunnel
                                         |
                                         v
                                   cloudflared
                                  (guest_edge only)
                                         |
                                         v
                                 Nginx guest-gateway
                               (allowlisted paths only)
                                         |
                                         v
                                 NestJS API -- PostgreSQL

TV + Admin (same trusted LAN): http://PI_IP:3000
```

**Never configure the tunnel's Service URL as `http://api:3000`,
`http://localhost:3000`, or `http://192.168.1.236:3000`.**
Always use `http://guest-gateway:8080`, from the `cloudflared` Docker
container in this Compose project. The gateway has no published host port.

Only the following guest capabilities are forwarded: short-code redirect,
join page, game status/calls/categories (without rosters), token-authenticated
player recovery, registration, ticket submission/regeneration, claims,
Lucky Strike requests, and Socket.IO. All admin/TV/full-display/game-creation/
manual-call routes are denied by default.

The existing LAN endpoint :3000 remains reachable on the private network
to operate the game. Don't forward port 3000 on your router.

## Prerequisites

1. A domain using Cloudflare DNS; example `play.example.com` is a placeholder.
2. Cloudflare account access to Networking > Tunnels.
3. Pi with Docker Compose, current code merged, and a database backup.
4. Strong random `ADMIN_TOKEN` in the local .env (never commit).
5. Internet service during the party. If Internet goes down, guests need a
   LAN fallback and possibly Chrome local-network permission.

## Setup on Pi

On the Pi, update the source on your selected deployment branch and check
working-tree status first.

In your existing `.env` add exactly:

```dotenv
PUBLIC_GUEST_ORIGIN=https://play.example.com
CLOUDFLARE_TUNNEL_TOKEN=<token from Cloudflare Dashboard>
```

Keep the token private. Cloudflare says anyone holding a tunnel token can run
a connector. Ensure `.env` is gitignored and file permissions are restrictive
(`chmod 600 .env`). Do not paste it in issue reports or chat.

Create a remotely-managed tunnel in Cloudflare Dashboard > Networking >
Tunnels. In the tunnel's Routes tab add a **Published application** route:

- Hostname: `play.example.com` (use your actual DNS name).
- Service type: HTTP.
- Service URL: `http://guest-gateway:8080`.
- Keep all other hostnames unconfigured on this tunnel.
- No Cloudflare Access login for guests (it would interrupt QR joining).

Before enabling the public hostname, start and test the gateway *without*
starting cloudflared:

```bash
cd ~/projects/diwali-tambola
sudo docker compose -f compose.yaml -f compose.public.yaml config >/dev/null
sudo docker compose -f compose.yaml -f compose.public.yaml up -d --build --wait db api guest-gateway
sudo docker compose -f compose.yaml -f compose.public.yaml exec -T api node --input-type=module - < tests/public-gateway-smoke.mjs
```

The test intentionally creates one disposable game and test player. It must
finish `PASS — guest-only gateway` before enabling the tunnel.

Then start the connector:

```bash
sudo docker compose -f compose.yaml -f compose.public.yaml up -d cloudflared
sudo docker compose -f compose.yaml -f compose.public.yaml logs --tail=50 cloudflared
```

A healthy tunnel alone does not prove the HTTP route works. From a phone on
mobile data, visit `https://play.example.com/g/<your real code>`.

## Public smoke tests

From a machine outside the LAN:

```bash
PUBLIC_BASE=https://play.example.com
curl -i "$PUBLIC_BASE/admin"                      # 404
curl -i "$PUBLIC_BASE/g/AAAAAA"                   # 404 if unknown
curl -i "$PUBLIC_BASE/health/live"                # 200
curl -i -X POST "$PUBLIC_BASE/games"              # 404
```

Also test a real code, join and submit a test ticket, and verify the original
LAN admin/TV screens still work. TV QR and join link use
`PUBLIC_GUEST_ORIGIN`, so guests scan public HTTPS even when TV uses LAN HTTP.

Verify on the public hostname that
`/games/<UUID>/display`, `/admin`, `/tv/<UUID>` and
`/games/<UUID>/admin/players` all return 404. Test WebSocket reconnect over
mobile data. Browser developer tools can inspect response bodies for leaked
player names; public `guest-display` must not include any.

## Abuse and privacy controls

- The Nginx gateway only forwards exact guest routes. Registration is throttled
  to 60 requests per minute per trusted Cloudflare client IP, with a burst of 60
  to accommodate many guests behind one Wi-Fi NAT address.
  Player actions are similarly limited, and request bodies are capped at 4 KB.
- Configure Cloudflare WAF/rate limiting/bot defenses appropriate for your plan,
  especially at the registration endpoint; do not enable a CAPTCHA challenge
  directly on XHR/POST endpoints without updating the browser client.
- Registration currently relies on self-reported phone numbers; **no SMS
  verification**. Treat public registration as susceptible to automated abuse.
- Do not reuse real phone numbers for testing. Use only a limited test game.
- The guest page stores a bearer token in browser localStorage. Avoid
  untrusted third-party scripts and monitor XSS risks.
- The tunnel is encrypted to cloudflared; the API behind it is reached over a
  private Docker network. Admin on LAN remains HTTP (not publicly exposed),
  so treat home Wi-Fi as trusted.
- Game codes are public identifiers, not authentication credentials. Anyone
  with a game code can access the public registration page.
- Never forward the database port, publish the Nginx gateway port, or create
  a second Cloudflare route directly to the API.

## Stop public access

```bash
sudo docker compose -f compose.yaml -f compose.public.yaml stop cloudflared
```

This stops the tunnel connector but keeps local admin/game service running.
Remove the public hostname route from Cloudflare Dashboard if not needed,
and revoke/rotate the token if compromised. Simply stopping the API is not
necessary.

## Troubleshooting

- Public 502/1033: inspect `docker compose logs cloudflared guest-gateway`
  and confirm route target `http://guest-gateway:8080`.
- Public 404 for all pages: verify the allowed routes and exact path spelling.
- Browser shows no live updates: check `/socket.io/socket.io.js`, WebSocket
  upgrades, and client retry. Polling remains the fallback.
- QR still shows LAN IP: check `PUBLIC_GUEST_ORIGIN` in `docker compose
  config` (do not paste the output because it includes secrets), rebuild API
  using both Compose files, and reload the TV.
- Admin should *never* be reachable via the public hostname, even if the admin
  key is known. Stop the tunnel immediately if the admin screen or controls
  are reachable.

Cloudflare reference: https://developers.cloudflare.com/tunnel/get-started/
