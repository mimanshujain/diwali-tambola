# Milestone 3 — Guest registration and tickets

## Guest flow

1. Open `http://<pi-lan-ip>:3000/join/<game-uuid>` from a trusted local network.
2. Enter name and mobile (include country code).
3. Server atomically creates one player and an assigned Tambola ticket; player receives a random bearer token stored in this browser's localStorage.
4. Player may regenerate a draft ticket while the game is CREATED, then submit (locks ticket).
5. Reloading or reopening from the same browser restores the ticket with the token.
6. Admin can list registrations and reissue an active ticket with a mandatory reason. All old tickets remain REVOKED in the database.

## API

| Method | Route | Authentication |
| --- | --- | --- |
| GET | `/join/:gameId` | Public HTML (guests) |
| POST | `/games/:gameId/players/register` | Public; JSON `{name,mobile,deviceId}` |
| GET | `/games/:gameId/players/me` | `Authorization: Bearer <player-token>` |
| POST | `/games/:gameId/players/me/submit` | Player bearer token |
| POST | `/games/:gameId/players/me/regenerate` | Player bearer token; only before game starts |
| GET | `/games/:gameId/admin/players` | `x-admin-key: <ADMIN_TOKEN>` |
| POST | `/games/:gameId/admin/players/:playerId/reissue` | Admin key; JSON `{reason}` |

## Controls and limitations

- One registration per `(game,mobile)` and `(game,deviceId)` enforced through database constraints; simultaneous requests are serialized/uniqueness checked.
- Device IDs and phone numbers are **not verified**. Private browsing, clearing storage, and entering someone else's mobile can bypass or interfere with identity. OTP would be necessary for stronger verification.
- There is **no account recovery** in this milestone; if a player loses their browser token, admin must help. Admin reissue does not create a new token.
- Player bearer tokens are stored only as SHA-256 hashes in PostgreSQL; the raw token is returned once on registration.
- Registration generates new tickets through the existing ticket generator. Submitted tickets cannot be regenerated; admin reissue revokes and replaces them with an audit row.
- Admin key is for the M3 admin routes only. **Legacy M2 game-control routes are still unauthenticated**; protect the Pi LAN and do not port-forward. Harden all game-control endpoints before real party deployment.
- The guest URL can be shared now. QR visualization and TV display are reserved for the upcoming UI milestone.
- Any person on the trusted LAN can access the join page; use no public port forwarding. HTTP over Wi-Fi is not encrypted. For a home-party LAN only.

## Smoke-test procedure

1. Create a game through `POST /games`; save `GAME_ID`.
2. Visit `http://<pi-ip>:3000/join/<GAME_ID>` and register.
3. Refresh the page: ticket should be restored; submit: status changes to SUBMITTED.
4. Try registering with the same phone from another browser: API returns 409 Conflict.
5. `GET /games/<GAME_ID>/admin/players` without admin key returns 401.
6. With the key, list players, select an ID, and POST a reissue reason; browser reload should show the replacement draft ticket.

## Operational notes

- `.env` contains `ADMIN_TOKEN`; never commit or paste it into chat/logs.
- Do **not** run `docker compose down -v`—it deletes the game database volume.
- Run `docker compose up -d --build --wait` to apply migrations on startup.
- M3 migration is additive and tracked in `schema_migrations`; it should apply once.
