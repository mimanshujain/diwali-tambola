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
