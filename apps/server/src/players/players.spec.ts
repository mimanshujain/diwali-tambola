import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { normalizeMobile, normalizeName } from './players.service.js';

test('normalizes a mobile number with country code', () => {
  assert.equal(normalizeMobile('+1 (555) 123-4567'), '15551234567');
  assert.equal(normalizeMobile('919876543210'), '919876543210');
});
test('rejects invalid phone numbers and blank names', () => {
  assert.throws(() => normalizeMobile('123'), BadRequestException);
  assert.throws(() => normalizeMobile('555-abc-1212'), BadRequestException);
  assert.throws(() => normalizeName('  '), BadRequestException);
});
test('normalizes player display names', () => {
  assert.equal(normalizeName('  Diwali   Guest  '), 'Diwali Guest');
});
