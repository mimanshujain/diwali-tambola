import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectPriorityCandidates, assertChosenNumber } from './priority.js';
const candidates = [
  {playerId:'powered',ticketId:'a',sequence:25,claimed:true},
  {playerId:'other',ticketId:'b',sequence:25,claimed:true},
  {playerId:'silent',ticketId:'c',sequence:25,claimed:false},
];
test('an eligible non-power claimant gets first priority', () => {
  assert.deepEqual(selectPriorityCandidates(candidates,'powered',25).map(v=>v.playerId), ['other']);
});
test('powered player receives prize if nobody else claims during window', () => {
  assert.deepEqual(selectPriorityCandidates(candidates.filter(v=>v.playerId!=='other'),'powered',25).map(v=>v.playerId), ['powered']);
});
test('nonparticipants and later eligibility cannot displace priority', () => {
  const late = {...candidates[1],sequence:26};
  assert.deepEqual(selectPriorityCandidates([candidates[0],late],'powered',25).map(v=>v.playerId), ['powered']);
});
test('validates the chosen number strictly', () => {
  assert.equal(assertChosenNumber(90),90);
  for (const value of [0, 91, 12.5, '47', null]) assert.throws(()=>assertChosenNumber(value));
});
