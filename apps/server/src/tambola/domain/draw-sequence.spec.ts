import assert from 'node:assert/strict';
import test from 'node:test';
import { createShuffledNumbers } from './draw-sequence.js';

test('creates a shuffled draw containing every number from 1 through 90 once', () => {
  for (let sample = 0; sample < 25; sample += 1) {
    const numbers = createShuffledNumbers();
    assert.equal(numbers.length, 90);
    assert.equal(new Set(numbers).size, 90);
    assert.deepEqual([...numbers].sort((left, right) => left - right),
      Array.from({ length: 90 }, (_, index) => index + 1));
  }
});
