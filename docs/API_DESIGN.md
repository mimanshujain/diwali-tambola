# API design (Milestone 2)

All routes are under the API root (`http://<pi-ip>:3000`). IDs are UUIDs.

| Method | Route | Purpose |
|---|---|---|
| POST | `/games` | Create a game. Body: `{ "name": "Diwali 2026", "intervalSeconds": 300 }` |
| GET | `/games/:gameId` | Read game state without exposing the remaining draw order |
| POST | `/games/:gameId/start` | Start a CREATED game |
| POST | `/games/:gameId/pause` | Pause a RUNNING game and preserve remaining delay |
| POST | `/games/:gameId/resume` | Resume a PAUSED game |
| GET | `/games/:gameId/calls` | List called numbers in sequence order |
| POST | `/games/:gameId/calls/manual` | Call a chosen uncalled number. Body: `{ "number": 47 }` |
| POST | `/games/:gameId/tickets` | Generate and persist one AVAILABLE Tambola ticket |
| GET | `/health/live` | API process liveness |
| GET | `/health/ready` | API and PostgreSQL readiness |

M2 endpoints do not yet have player/admin authentication. Restrict port 3000 to the trusted local network until the authentication milestone is implemented.
