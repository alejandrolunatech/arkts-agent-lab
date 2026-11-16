import test from 'node:test';
import assert from 'node:assert/strict';
import { chunk, zip } from './solution.mjs';

/** Pairs as plain two-element arrays, so the test does not depend on how a pair object is built. */
function flat(pairs) {
  return pairs.map((pair) => [pair.first, pair.second]);
}

test('chunk splits into groups and keeps a shorter last group', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5, 6, 7], 3), [[1, 2, 3], [4, 5, 6], [7]]);
  assert.deepEqual(chunk(['a', 'b', 'c', 'd'], 2), [['a', 'b'], ['c', 'd']]);
  assert.deepEqual(chunk([1, 2, 3], 1), [[1], [2], [3]]);
  assert.deepEqual(chunk([1, 2, 3], 10), [[1, 2, 3]]);
});

test('chunk gives an empty array for an empty input or a size below 1', () => {
  assert.deepEqual(chunk([], 3), []);
  assert.deepEqual(chunk([1, 2, 3], 0), []);
  assert.deepEqual(chunk([1, 2, 3], -2), []);
});

test('chunk does not modify or reuse its input', () => {
  const items = [1, 2, 3];
  const groups = chunk(items, 5);
  assert.notEqual(groups[0], items);
  groups[0].push(99);
  assert.deepEqual(items, [1, 2, 3]);
});

test('zip pairs elements by position', () => {
  const pairs = zip([1, 2, 3], ['one', 'two', 'three']);
  assert.equal(pairs.length, 3);
  assert.deepEqual(flat(pairs), [[1, 'one'], [2, 'two'], [3, 'three']]);
  assert.deepEqual(Object.keys(pairs[0]).sort(), ['first', 'second']);
});

test('zip stops at the shorter input', () => {
  assert.deepEqual(flat(zip([1, 2, 3], ['a'])), [[1, 'a']]);
  assert.deepEqual(flat(zip(['x'], [true, false, true])), [['x', true]]);
  assert.deepEqual(zip([], [1, 2]), []);
  assert.deepEqual(zip([1, 2], []), []);
});

test('zip does not modify its inputs', () => {
  const a = [1, 2, 3];
  const b = ['a', 'b'];
  zip(a, b);
  assert.deepEqual(a, [1, 2, 3]);
  assert.deepEqual(b, ['a', 'b']);
});
