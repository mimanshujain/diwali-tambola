import test from 'node:test';
import assert from 'node:assert/strict';
import { completedParticipants, miniTicket, shuffledPool } from './sudden-death.js';

test('sudden-death shuffled pool contains each 1–90 number once', () => {
  for (let i = 0; i < 20; i++) {
    const pool = shuffledPool();
    assert.equal(pool.length, 90);
    assert.deepEqual([...pool].sort((a,b) => a-b), Array.from({ length: 90 }, (_, n) => n+1));
  }
});
test('mini tickets are 5 distinct valid numbers', () => {
  for (let i = 0; i < 100; i++) {
    const ticket = miniTicket(5);
    assert.equal(ticket.length, 5);
    assert.equal(new Set(ticket).size, 5);
    assert.ok(ticket.every(n => n >= 1 && n <= 90));
  }
});
test('same-draw completions share the sudden-death prize', () => {
  const entries = [
    {playerId:'a',numbers:[1,2,3,4,5]},
    {playerId:'b',numbers:[1,2,3,4,5]},
    {playerId:'c',numbers:[1,2,3,4,6]},
  ];
  assert.deepEqual(completedParticipants(entries,new Set([1,2,3,4])), []);
  assert.deepEqual(completedParticipants(entries,new Set([1,2,3,4,5])), ['a','b']);
});

