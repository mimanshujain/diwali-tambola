import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const tempDir = mkdtempSync(join(tmpdir(), 'tambola-compose-'));
const envFile = join(tempDir, '.env');
const envFileValues = [
  'POSTGRES_USER=tambola',
  'POSTGRES_PASSWORD=test-password',
  'POSTGRES_DB=tambola',
  'ADMIN_TOKEN=test-token',
  'CLOUDFLARE_TUNNEL_TOKEN=test-tunnel-token',
];
after(() => rmSync(tempDir, { recursive: true, force: true }));

function composeConfig(publicAccess, guestOrigin) {
  const values = [...envFileValues];
  if (guestOrigin !== undefined) values.push('PUBLIC_GUEST_ORIGIN=' + guestOrigin);
  writeFileSync(envFile, [...values, ''].join('\n'));
  const env = { ...process.env };
  for (const name of ['POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB', 'ADMIN_TOKEN',
    'CLOUDFLARE_TUNNEL_TOKEN', 'PUBLIC_GUEST_ORIGIN']) delete env[name];
  const files = ['-f', 'compose.yaml'];
  if (publicAccess) files.push('-f', 'compose.public.yaml');
  const output = execFileSync('docker', [
    'compose', '--env-file', envFile, ...files, 'config', '--format', 'json',
  ], { cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(output);
}

test('base Compose forwards a configured public guest origin', () => {
  const config = composeConfig(false, 'https://guests.example.test');
  assert.equal(config.services.api.environment.PUBLIC_GUEST_ORIGIN, 'https://guests.example.test');
});

test('base Compose supports a LAN-only deployment without a guest origin', () => {
  const config = composeConfig(false);
  assert.equal(config.services.api.environment.PUBLIC_GUEST_ORIGIN, '');
});

test('public Compose forwards and requires the guest origin', () => {
  const config = composeConfig(true, 'https://guests.example.test');
  assert.equal(config.services.api.environment.PUBLIC_GUEST_ORIGIN, 'https://guests.example.test');
  assert.throws(() => composeConfig(true), /PUBLIC_GUEST_ORIGIN/);
});
