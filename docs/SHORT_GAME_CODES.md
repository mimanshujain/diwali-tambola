# Short game codes

Games retain their UUID as the authoritative ID for tickets, claims, winners, and
existing API routes. Each game also has a unique six-character `joinCode`
(e.g. `K7M4PX`) for people joining manually.

- Guest URL: `http://PI_IP:3000/g/K7M4PX`. Codes are case-insensitive.
- The server responds with an HTTP 302 redirect to `/join/<game UUID>`.
- TV displays the code and a short join URL. QR codes point to the short URL.
- Existing `/join/<UUID>` and `/tv/<UUID>` links still work.
- A missing, invalid, or unknown code returns HTTP 404.
- `GET /games/<UUID>` and `GET /games/<UUID>/display` include `joinCode`.

Database migration `007_short_game_codes` backfills preexisting games and
enforces unique non-null six-character codes. New codes use Node.js
`crypto.randomInt`; game creation retries on a database code collision.

The join code identifies a game and **does not authorize administrative actions**.

## Deployment and verification

```bash
cd ~/projects/diwali-tambola
sudo docker compose up -d --build --wait
curl -fsS http://localhost:3000/health/ready
```

Create a disposable game from `/admin` and confirm the returned game object has
`joinCode`. Visit `http://PI_IP:3000/g/<joinCode>`, open its TV page, and
scan the QR code. The redirect should land on the same game. Also test an
existing game's UUID URL to confirm backward compatibility.

Do not use `docker compose down -v`: it deletes persistent database volumes.
