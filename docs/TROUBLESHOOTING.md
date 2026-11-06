# Troubleshooting

## App not reachable

```bash
cd ~/projects/diwali-tambola
sudo docker compose ps
sudo docker compose logs --tail=100 api
curl -v http://localhost:3000/health/ready
hostname -I
```

Confirm TV/phone and Pi are on the same network and use the Pi's actual IP address.
Disable guest Wi-Fi client/AP isolation if it prevents devices on the same network from reaching the Pi.

## QR image returns HTTP 500

Inspect API logs. Earlier builds exposed a startup migration-order bug: a newly introduced table could be queried before migration 005 completed. Confirm startup migrations run before handling requests and that the schema is current.

## TypeScript build errors

Check public controller return types, especially types exported from services. Run `npm run typecheck` before deploying.

## Guest ticket or TV stops updating

Confirm API health, reconnect the device and refresh. Socket.IO is intended to reconnect automatically; polling is a fallback. Check browser console and API logs for connection failures.

Registration stays open during a running or normally paused game, but closes during emergency stop or after completion. A new ticket is visible immediately; the host must approve the guest before they can win. Approved lobby drafts submit automatically when the host starts. If a browser session was lost, restore the private recovery code or ask the host to use **Release phone / reset access**.

Open the TV with `?sound=1` to request audio and press OK/click once if the browser blocks autoplay. Hindi commentary requires a Hindi speech voice installed in the TV browser or operating system. Spotify needs internet and an accepted Spotify link; playback and account restrictions are controlled by Spotify.

On Raspberry Pi OS, if Chromium has no Hindi voice, try `sudo apt install speech-dispatcher speech-dispatcher-espeak-ng espeak-ng`, restart Chromium and test speech on the TV. Voice and audio-device availability depend on the browser and operating system.

## Data appears missing after restart

Stop and inspect the Compose volume mapping before making further changes. Do not run `down -v`. Verify you are connected to the same database volume and game ID. Restore only from a verified backup to a safe target.

## Test fails with HTTP 201

NestJS POST handlers commonly return `201 Created`. Integration tests should accept the documented success status, not hardcode `200` for all operations.
