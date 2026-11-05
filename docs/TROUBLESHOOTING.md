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

## QR image returns HTTP 500

Inspect API logs. Earlier builds exposed a startup migration-order bug: a newly introduced table could be queried before migration 005 completed. Confirm startup migrations run before handling requests and that the schema is current.

## TypeScript build errors

Check public controller return types, especially types exported from services. Run `npm run typecheck` before deploying.

## Guest ticket or TV stops updating

Confirm API health, reconnect the device and refresh. Socket.IO is intended to reconnect automatically; polling is a fallback. Check browser console and API logs for connection failures.

## Data appears missing after restart

Stop and inspect the Compose volume mapping before making further changes. Do not run `down -v`. Verify you are connected to the same database volume and game ID. Restore only from a verified backup to a safe target.

## Test fails with HTTP 201

NestJS POST handlers commonly return `201 Created`. Integration tests should accept the documented success status, not hardcode `200` for all operations.
