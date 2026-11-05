import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { publicGuestOrigin } from '../../display/guest-origin.js';

test('guest origin unset means private LAN URLs', () => {
  const before=process.env.PUBLIC_GUEST_ORIGIN;
  try { delete process.env.PUBLIC_GUEST_ORIGIN; assert.equal(publicGuestOrigin(),null); }
  finally { if(before===undefined)delete process.env.PUBLIC_GUEST_ORIGIN; else process.env.PUBLIC_GUEST_ORIGIN=before; }
});

test('guest origin requires HTTPS without path, credentials or query', () => {
  const before=process.env.PUBLIC_GUEST_ORIGIN;
  try {
    for(const bad of ['http://example.com','https://example.com/path','https://u:p@example.com','https://example.com?x=1']) {
      process.env.PUBLIC_GUEST_ORIGIN=bad;
      assert.throws(()=>publicGuestOrigin());
    }
    process.env.PUBLIC_GUEST_ORIGIN='https://play.example.com';
    assert.equal(publicGuestOrigin(),'https://play.example.com');
  } finally { if(before===undefined)delete process.env.PUBLIC_GUEST_ORIGIN; else process.env.PUBLIC_GUEST_ORIGIN=before; }
});
