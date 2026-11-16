import test from 'node:test';
import assert from 'node:assert/strict';
import { totalByCategory } from './solution.mjs';

test('sums amounts per category', () => {
  const totals = totalByCategory([
    { category: 'food', amount: 10 },
    { category: 'rent', amount: 700 },
    { category: 'food', amount: 2.5 },
  ]);
  assert.ok(totals instanceof Map);
  assert.equal(totals.get('food'), 12.5);
  assert.equal(totals.get('rent'), 700);
  assert.equal(totals.size, 2);
});

test('keeps the order of first appearance', () => {
  const totals = totalByCategory([
    { category: 'b', amount: 1 },
    { category: 'a', amount: 1 },
    { category: 'b', amount: 1 },
  ]);
  assert.deepEqual([...totals.keys()], ['b', 'a']);
});

test('an empty input gives an empty map', () => {
  assert.equal(totalByCategory([]).size, 0);
});
