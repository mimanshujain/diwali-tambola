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
  const options = { type: 'svg', margin: 2, width: 280, errorCorrectionLevel: 'M' };
  assert.equal(await response.text(), await QRCode.toString(origin + '/tv/' + code, options));
  const controller = new DisplayController(display);
  assert.equal(await controller.tvQr(id, 'pi.example.test', { protocol: 'https' }),
    await QRCode.toString('https://pi.example.test/tv/' + code, options));
  await assert.rejects(controller.tvQr(id, 'example.test/path', { protocol: 'http' }));
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

test('admin exposes a QR and the short clickable TV URL without an admin key', async () => {
  const html = await (await fetch(origin + '/admin/' + id)).text();
  const elements = new Map([...html.matchAll(/id="([^"]+)"/g)].map(([, key]) => [key, { replaceChildren() {} }]));
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], {
    location: { pathname: '/admin/' + id, origin },
    document: { querySelector: s => elements.get(s.slice(1)), querySelectorAll: () => [] },
    sessionStorage: { getItem: () => '' },
    window: { addEventListener() {} }, setInterval() {},
    fetch: async () => ({ ok: true, json: async () => ({ game, guestOrigin, calls: [], winners: [] }) }),
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(elements.get('tvQr').src, '/admin/' + id + '/tv-qr.svg');
  assert.equal(elements.get('tvLink').href, origin + '/tv/' + code);
  assert.equal(elements.get('tvUrl').href, origin + '/tv/' + code);
  assert.equal(elements.get('tvUrl').textContent, origin + '/tv/' + code);
  assert.equal(elements.get('joinLink').href, guestOrigin + '/g/' + code);
});
