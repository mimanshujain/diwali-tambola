// Run after npm run build with node --test tests/tv-access.mjs.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import vm from 'node:vm';
import { Module, NotFoundException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import QRCode from 'qrcode';
import { DisplayController } from '../apps/server/dist/display/display.controller.js';
import { DisplayService } from '../apps/server/dist/display/display.service.js';
import { LIVE_CLIENT_JS } from '../apps/server/dist/live/live-client.js';

const id = 'aabbccdd-eeff-4111-8111-001122334455';
const code = 'ABC234';
const guestOrigin = 'https://guests.example.test';
const qrOptions = { type: 'svg', margin: 2, width: 280, errorCorrectionLevel: 'M' };
process.env.PUBLIC_GUEST_ORIGIN = guestOrigin;
const game = { id, joinCode: code, name: 'Test game', status: 'CREATED' };
const display = new DisplayService({
  query: async (_sql, [value]) => ({ rows: value === code ? [{ id }] : [] }),
}, {
  getGame: async value => { if (value !== id) throw new NotFoundException(); return game; },
  listCalls: async () => [],
});
class TestApp {}
Module({ controllers: [DisplayController], providers: [{ provide: DisplayService, useValue: display }] })(TestApp);
let app, origin;
before(async () => {
  app = await NestFactory.create(TestApp, { logger: false });
  await app.listen(0, '127.0.0.1');
  origin = await app.getUrl();
});
after(async () => { await app?.close(); });

test('short and legacy TV routes render the canonical ID for API and live updates', async () => {
  for (const reference of [code, code.toLowerCase(), id]) {
    const response = await fetch(origin + '/tv/' + reference);
    assert.equal(response.status, 200);
    assert.equal(new URL(response.url).pathname, '/tv/' + reference);
    assert.ok((await response.text()).includes('data-game-id="' + id + '"'));
  }
  assert.equal((await fetch(origin + '/tv/ZZZ999')).status, 404);
  assert.equal((await fetch(origin + '/tv/invalid')).status, 404);
});

test('admin QR encodes the short TV URL and preserves the request scheme', async () => {
  const response = await fetch(origin + '/admin/' + id + '/tv-qr.svg');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /image\/svg\+xml/);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal(await response.text(), await QRCode.toString(origin + '/tv/' + code, qrOptions));
  const controller = new DisplayController(display);
  assert.equal(await controller.tvQr(id, 'pi.example.test', { protocol: 'https' }),
    await QRCode.toString('https://pi.example.test/tv/' + code, qrOptions));
  await assert.rejects(controller.tvQr(id, 'example.test/path', { protocol: 'http' }));
});

test('TV display and guest QR use the configured public origin', async () => {
  const displayResponse = await fetch(origin + '/games/' + id + '/display');
  assert.equal(displayResponse.status, 200);
  assert.equal((await displayResponse.json()).guestOrigin, guestOrigin);
  const qrResponse = await fetch(origin + '/tv/' + id + '/qr.svg');
  assert.equal(qrResponse.status, 200);
  assert.match(qrResponse.headers.get('cache-control'), /no-store/);
  assert.equal(await qrResponse.text(), await QRCode.toString(guestOrigin + '/g/' + code, qrOptions));
});

test('TV display and guest QR fall back to the LAN origin when unconfigured', async () => {
  const configured = process.env.PUBLIC_GUEST_ORIGIN;
  delete process.env.PUBLIC_GUEST_ORIGIN;
  try {
    const displayResponse = await fetch(origin + '/games/' + id + '/display');
    assert.equal(displayResponse.status, 200);
    assert.equal((await displayResponse.json()).guestOrigin, null);
    const qrResponse = await fetch(origin + '/tv/' + id + '/qr.svg');
    assert.equal(qrResponse.status, 200);
    assert.equal(await qrResponse.text(), await QRCode.toString(origin + '/g/' + code, qrOptions));
  } finally {
    if (configured === undefined) delete process.env.PUBLIC_GUEST_ORIGIN;
    else process.env.PUBLIC_GUEST_ORIGIN = configured;
  }
});

test('short TV URL joins the UUID socket room', () => {
  for (const route of ['/tv/' + code, '/tv/' + id, '/admin/' + id, '/join/' + id]) {
    const handlers = {}, emitted = [];
    vm.runInNewContext(LIVE_CLIENT_JS, {
      location: { pathname: route },
      document: {
        querySelector: () => ({ dataset: { gameId: id } }),
        createElement: () => ({ style: {}, setAttribute() {} }),
        body: { append() {} }, addEventListener() {},
      },
      window: { addEventListener() {} },
      io: () => ({ on: (name, handler) => { handlers[name] = handler; }, emit: (...args) => emitted.push(args) }),
    });
    handlers.connect();
    assert.equal(emitted[0][0], 'game:join');
    assert.equal(emitted[0][1].gameId, id);
  }
});

test('admin provides the TV access section and local print script', async () => {
  const html = await (await fetch(origin + '/admin/' + id)).text();
  assert.match(html, /id="tvQr"/);
  assert.match(html, /id="tvUrl"/);
  assert.match(html, /src="\/print\/client.js"/);
  // Actual URL hydration and navigation are exercised by party-browser.mjs.
});
