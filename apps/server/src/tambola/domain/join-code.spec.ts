import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { generateJoinCode, JOIN_CODE_ALPHABET } from './join-code.js';

test('join code is six uppercase, unambiguous characters', () => {
  assert.equal(JOIN_CODE_ALPHABET.length, 32);
  for (let i = 0; i < 1000; i++) {
    assert.match(generateJoinCode(), /^[A-HJ-NP-Z2-9]{6}$/);
  }
});

test('generator produces varying codes', () => {
  const codes = new Set(Array.from({ length: 100 }, generateJoinCode));
  assert.ok(codes.size > 95);
});
