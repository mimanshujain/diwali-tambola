import assert from 'node:assert/strict';
import test from 'node:test';
import { eligibleAtSequence, isEligible, requiredNumbers, type Grid } from './rules.js';
const grid: Grid = [[1,null,22,null,42,null,62,null,82],[null,13,null,34,45,56,null,78,null],[6,null,26,36,null,58,68,null,null]];
// Five numbers per row, only the rule evaluator is under test here.
test('evaluates line and early five using the actual drawn set', () => {
  assert.equal(isEligible(grid,'TOP_LINE', new Set([1,22,42,62,82])),true);
  assert.equal(isEligible(grid,'TOP_LINE', new Set([1,22,42,62])),false);
  assert.equal(isEligible(grid,'EARLY_FIVE', new Set([1,13,22,34,42])),true);
  assert.equal(isEligible(grid,'EARLY_FIVE', new Set([1,13,22,34])),false);
});
test('corners are first and last occupied cells in top and bottom rows', () => {
  assert.deepEqual(requiredNumbers(grid,'FOUR_CORNERS'),[1,82,6,68]);
  assert.equal(isEligible(grid,'FOUR_CORNERS',new Set([1,82,6,68])),true);
});
test('first eligibility sequence is stable despite later calls', () => {
  assert.equal(eligibleAtSequence(grid,'TOP_LINE',[82,1,13,22,42,62,90]),6);
  assert.equal(eligibleAtSequence(grid,'TOP_LINE',[82,1,13,22,42]),null);
});
test('early seven and ten ignore unrelated calls and require their exact threshold', () => {
  const ticket=grid.flat().filter((n):n is number=>n!==null);
  for(const [rule,count] of [['EARLY_SEVEN',7],['EARLY_TEN',10]] as const){
    assert.equal(isEligible(grid,rule,new Set([90,...ticket.slice(0,count-1)])),false);
    assert.equal(isEligible(grid,rule,new Set(ticket.slice(0,count))),true);
    assert.equal(eligibleAtSequence(grid,rule,[90,...ticket]),count+1);
  }
});
test('two lines means complete rows, not any ten ticket numbers', () => {
  const numbers=(rows:Grid)=>rows.flat().filter((n):n is number=>n!==null);
  assert.equal(isEligible(grid,'TWO_LINES',new Set(numbers(grid.slice(0,2)))),true);
  assert.equal(isEligible(grid,'TWO_LINES',new Set(numbers(grid).slice(3,13))),false);
});
test('parity prizes need every matching number and never award an empty set', () => {
  const ticket=grid.flat().filter((n):n is number=>n!==null);
  for(const [rule,parity] of [['ALL_ODD',1],['ALL_EVEN',0]] as const){
    const required=ticket.filter(n=>n%2===parity);
    assert.equal(isEligible(grid,rule,new Set(required)),true);
    assert.equal(isEligible(grid,rule,new Set(required.slice(1))),false);
    const absent=grid.map(row=>row.map(n=>n===null?null:n%2===parity?n+1:n));
    assert.equal(isEligible(absent,rule,new Set(ticket)),false);
  }
});
