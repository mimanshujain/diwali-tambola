# Getting started

## Prerequisites

- Raspberry Pi 5 with 64-bit Raspberry Pi OS
- Docker Engine and Docker Compose plugin
- A trusted local network with TV, phones and Pi on the same LAN
- Project checkout in `~/projects/diwali-tambola`

## Configure

Check for a root `.env` file with `ls -la .env`. Set a private random `ADMIN_TOKEN` of at least 32 characters; `openssl rand -hex 32` generates one. Keep credentials private, restrict `.env` with `chmod 600 .env`, and never commit it.

## Start

```bash
cd ~/projects/diwali-tambola
sudo docker compose up -d --build --wait --wait-timeout 180
sudo docker compose ps
curl -fsS http://localhost:3000/health/ready
hostname -I
```

## Host a game

1. On an admin device, visit `http://PI_IP:3000/admin` and authenticate with your configured admin token.
2. Create a game, configure prizes and note its six-character game code.
3. Show `http://PI_IP:3000/tv/GAME_CODE` on the television. Add `?sound=1` to request audio.
4. Guests scan the large QR code or visit `http://PI_IP:3000/g/GAME_CODE`.
5. Guests register and review their tickets. Approve their identities in the host console.
6. Start the game; approved drafts are automatically submitted. For rehearsal, use manual number calls.
7. Review claim alerts and handle any sudden-death round through the admin controls. Late guests can join and be approved during play.

Do not open the TV page via `localhost` or `127.0.0.1`: its QR code would point to each guest's own phone. Use the Pi's LAN IP as shown above, unless a public guest origin is configured.

For party use, test one complete rehearsal game before guests arrive.
