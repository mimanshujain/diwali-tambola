# Hosted Tambola implementation and environment guide

[PR #14](https://github.com/mimanshujain/diwali-tambola/pull/14) lets invited organizers run their own games on one shared HTTPS website. The app and database run on Render. Each organizer signs in with Google and manages their games from `/admin`. Guests join with a game code and their name. A TV connects to one game through a pairing code or QR link.

| Setup | How the host signs in | Where to configure it |
| --- | --- | --- |
| Raspberry Pi on your network | `ADMIN_TOKEN` on the Pi's `/admin` page | The Pi's private `.env` and `compose.yaml`. LAN mode is the default. |
| Raspberry Pi with a public guest link | Same admin key on the private network | The Pi's `.env`, plus `compose.public.yaml` for the guest gateway and Cloudflare Tunnel. |
| Shared website on Render | An invited Google account | `render.yaml` and the Render web service's **Environment** settings. |

## What happens when you host a game

1. **The service owner invites a host.** Add the host's Google email to `HOST_ALLOWED_EMAILS`. When the OAuth app uses Google's Testing audience, also add the account as a test user in Google Cloud. The host opens `/admin`, chooses **Continue with Google**, and signs in with the invited account. Tambola verifies the Google identity and issues its own seven-day session cookie.
2. **The host creates a game.** Tambola saves the host's ID on the game and checks ownership when someone requests its console, tickets, claims or controls. Each host has a separate game list. The pilot allows five unfinished games and 100 saved games per host, plus 200 registrations per game.
3. **Guests join.** Share the game link `/g/ABC234` or have guests enter the six-character game code on the homepage. Guests register with their name and get private access to their ticket. Their public game view omits the roster and other players' identities.
4. **The host pairs a TV.** In **TV display & guest access → Pair a TV**, generate a code. On the TV, open `/screen` and enter it, or open the QR pairing link on the display device. The one-use code expires after ten minutes. The TV then opens `/tv/ABC234` with a read-only session for that game lasting up to 24 hours. The host can revoke paired displays from the console.

The six-character **game code** is for joining as a player. The ten-character **pairing code** grants temporary read access to the game board. The host manages the game through the Google session on their own device.

## What changed in the app

| Area | Implementation |
| --- | --- |
| Google sign-in and access checks | `apps/server/src/hosting/` handles sign-in, the email allowlist, cookie sessions, TV pairing and route authorization. The cloud access checks run before the game routes. |
| Game ownership and storage | Migration `010_hosted_accounts` adds `games.host_id`, host accounts, sessions, sign-in attempts, TV access and scheduler leases to PostgreSQL. Pi games migrate with no owner and stay outside the hosted game lists. Start the hosted pilot with a separate database. |
| Restart and deployment recovery | PostgreSQL stores the game, tickets and draw history. Scheduler leases prevent two overlapping app processes from drawing for the same game during a deploy. After the active process crashes, recovery pauses running games for the host to review and resume. |
| Host and TV screens | The host desk adds Google sign-in and TV pairing. The public homepage adds guest join by code. TV roster pagination adjusts to the space on screen, and the game board and QR stay usable across tested screen sizes. |
| Deployment | `render.yaml` defines a Docker web service and a managed PostgreSQL database. The hosted app, guest links, Google callback and paired TV all use the same HTTPS origin. |

## New environment variables in PR #14

These five variables select and configure cloud mode. Set them on the Render **web service**.

| Variable | What it does | Where the value comes from |
| --- | --- | --- |
| `HOSTING_MODE` | Selects how the app authorizes hosts. Defaults to `lan` when unset. | The Blueprint sets `cloud`. For a manually created hosted service, set `cloud` yourself. |
| `PUBLIC_APP_ORIGIN` | Sets the public address for guest links, TV pairing, same-origin checks and the Google callback. | Enter the site's HTTPS origin, such as `https://tambola-example.onrender.com`. Use the hostname without a path, query or fragment. |
| `GOOGLE_CLIENT_ID` | Identifies the Google OAuth web application and the intended audience of Google's ID token. | Copy the **Client ID** from a **Web application** OAuth client in Google Cloud Console. |
| `GOOGLE_CLIENT_SECRET` | Authenticates the server when it exchanges Google's authorization code for tokens. | Copy the matching **Client secret** from the same OAuth client. Store it in Render. |
| `HOST_ALLOWED_EMAILS` | Defines which verified Google accounts may host. | Enter comma-separated email addresses, such as `host1@example.com,host2@example.com`. The server trims spaces and compares addresses case-insensitively. |

`DATABASE_URL` already existed. Compose constructs it using the Pi's `POSTGRES_*` settings. Render's Blueprint instead obtains it from the managed database's internal connection string. The Blueprint also sets the existing `NODE_ENV` to `production`.

In Google Cloud Console, register the full callback URL as an **Authorized redirect URI**. For example, if `PUBLIC_APP_ORIGIN` is `https://tambola-example.onrender.com`, register `https://tambola-example.onrender.com/auth/callback`. Use the same HTTPS hostname to open `/admin`. If you move to a custom domain, update both settings together.

## Why the Pi's `.env` does not list the hosted variables

- **`.env.example` is the Pi setup template.** The private `.env` beside `compose.yaml` supplies values for Docker Compose to substitute. Compose passes the values declared in the service's `environment` block to the container. That block is configured for the Pi. Adding a cloud setting to the Pi's `.env` alone will leave the container in LAN mode. [Docker Compose interpolation](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)
- **`render.yaml` is the hosted setup template.** It declares the names of the four settings you supply. `sync: false` tells Render to ask for their values when creating a Blueprint. For an existing service, open **Environment**, add or update those values there, and deploy with the updated environment. This keeps the OAuth secret and deployment-specific values out of Git. [Render Blueprint environment variables](https://render.com/docs/blueprint-spec#prompting-for-secret-values)
- **The two deployments use different credentials and links.** `ADMIN_TOKEN` is the Pi's host key. `PUBLIC_GUEST_ORIGIN` and `CLOUDFLARE_TUNNEL_TOKEN` are for the Pi's optional public guest gateway. On Render, Google sessions authorize hosts and `PUBLIC_APP_ORIGIN` supplies the shared website address for all three roles.

## Check your hosted setup

| What you see | What to check |
| --- | --- |
| The app asks for an admin key | Verify that the deployed code includes PR #14 and the Render web service has `HOSTING_MODE=cloud`. |
| Google reports a redirect URI mismatch | Compare the Google OAuth redirect URI with `PUBLIC_APP_ORIGIN` plus `/auth/callback`. |
| An invited Google account cannot sign in | Check the email in the Render allowlist and Google's test-user list if the OAuth app is in Testing. Check that the client ID and secret come from the same OAuth client. |
| The TV redirects to `/screen` | Pair it from the game's host console. Generate a new code if the previous one was used, expired or revoked. |

For deployment steps, backups and a real sign-in rehearsal, see the [hosted pilot runbook](HOSTED_PILOT.md).
