# Getting started

## Prerequisites

- Raspberry Pi 5 with 64-bit Raspberry Pi OS
- Docker Engine and Docker Compose plugin
- A trusted local network with TV, phones and Pi on the same LAN
- Project checkout in `~/projects/diwali-tambola`

## Configure

Check for a root `.env` file with `ls -la .env`. Keep admin credentials private. Compare with any `.env.example` supplied in your checkout; do not commit `.env`.

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
2. Create a new game and retain its game ID.
3. Show `http://PI_IP:3000/tv/GAME_ID` on the television.
4. Guests scan the QR code or visit `http://PI_IP:3000/join/GAME_ID`.
5. Guests register, generate their tickets and submit them before the game starts.
6. Start the game from the admin view. For rehearsal, use manual number calls.
7. Verify claims and handle any sudden-death round through the admin controls.

For party use, test one complete rehearsal game before guests arrive.
