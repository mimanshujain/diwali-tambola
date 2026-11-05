# Development and verification

## Working agreement

Work in feature branches. Do not merge a milestone until its unit tests, typecheck, build, integration tests and relevant manual UI checks pass.

## Standard validation

```bash
cd ~/projects/diwali-tambola
sudo docker run --rm \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp -e npm_config_cache=/tmp/npm-cache \
  -v "$PWD:/workspace" -w /workspace \
  node:26-bookworm-slim \
  sh -lc 'npm test && npm run typecheck && npm run build'
```

## Integration suites

Run suites **only if present** and against a disposable test game:

```bash
python3 tests/m5m6-integration.py
python3 tests/m5m6-integration.py --priority
sudo docker compose exec -T -e M7_TEST_CLIENTS=25 api node --input-type=module - < tests/m7-live.mjs
```

M7 release may include additional rehearsal tests; inspect `tests/` and the release documentation. Some integration tests create persistent disposable game records.

## Regression checklist

- HTTP 201 is success for create endpoints (do not assert only 200).
- Validate exported TypeScript types used by public NestJS controllers.
- Apply schema migrations before handlers query newly introduced tables.
- Verify the QR SVG endpoint on a newly created game.
- Confirm First/Second Full House exclusion uses actual winners, not all sudden-death participants.
- Verify one-time Lucky Strike and concurrent number calls.
- Test restart and reconnection without deleting persisted data.

## Git workflow

```bash
git status --short
git diff --check
git add README.md docs/
git commit -m 'docs: add operating and developer guides'
git push origin HEAD
```

## Party upgrade acceptance

Build first, then run the HTTP checks against a disposable running instance:

```bash
npm run build
node --test tests/tv-access.mjs
ADMIN_TOKEN=YOUR_TEST_KEY TAMBOLA_URL=http://localhost:3000 node tests/party-operations.mjs
```

For a self-contained Linux rehearsal with an isolated database, API process and headless browser, install the test tools outside the project. These are not production dependencies:

```bash
npm install --prefix /tmp/tambola-test-tools \
  embedded-postgres@18.6.0-beta.19 @sparticuz/chromium@153.0.0 playwright-core@1.64.1
TAMBOLA_TEST_TOOLS=/tmp/tambola-test-tools TAMBOLA_LEGACY_TESTS=1 node tests/party-rehearsal.mjs
```

This tests the legacy schema upgrade, concurrent ticket conflicts, identity approval/recovery, timer overrides, emergency stop, terminal end, prize configuration, phone confirmations, game navigation, TV fitting at 960×540/720p/1080p/4K, PDF page size, forced API termination, tie-break recovery, persisted winners/powers and graceful restart. It saves screenshots, a print PDF and server logs in a temporary directory printed at completion. The optional legacy suites add the 30-player, 25-live-client and Lucky Strike priority rehearsals.

The public guest workflow also tests the real Docker gateway, host operations and `tests/backup-rehearsal.mjs` against PostgreSQL 17. The backup rehearsal replaces its database: run it only in the disposable CI Compose stack.
