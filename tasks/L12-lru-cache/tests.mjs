import test from 'node:test';
import assert from 'node:assert/strict';
import { LruCache } from './solution.mjs';

test('stores and reads values', () => {
  const cache = new LruCache(3);
  assert.equal(cache.size, 0);
  cache.set('a', 1);
  cache.set('b', 2);
  assert.equal(cache.get('a'), 1);
  assert.equal(cache.get('b'), 2);
  assert.equal(cache.get('zzz'), undefined);
  assert.equal(cache.has('a'), true);
  assert.equal(cache.has('zzz'), false);
  assert.equal(cache.size, 2);
});

test('drops the least recently used key when full', () => {
  const cache = new LruCache(2);
  cache.set('a', 1);
  cache.set('b', 2);
  cache.set('c', 3);
  assert.equal(cache.has('a'), false);
  assert.equal(cache.get('a'), undefined);
  assert.equal(cache.get('b'), 2);
  assert.equal(cache.get('c'), 3);
  assert.equal(cache.size, 2);
});

test('get makes a key the most recently used', () => {
  const cache = new LruCache(2);
  cache.set('a', 1);
  cache.set('b', 2);
  assert.equal(cache.get('a'), 1);
  cache.set('c', 3);
  assert.deepEqual(cache.keys(), ['a', 'c']);
  assert.equal(cache.has('b'), false);
});

test('setting a stored key replaces the value and counts as a use', () => {
  const cache = new LruCache(2);
  cache.set('a', 1);
  cache.set('b', 2);
  cache.set('a', 10);
  assert.equal(cache.size, 2);
  assert.deepEqual(cache.keys(), ['b', 'a']);
  cache.set('c', 3);
  assert.deepEqual(cache.keys(), ['a', 'c']);
  assert.equal(cache.get('a'), 10);
});

test('has and keys do not count as a use', () => {
  const cache = new LruCache(2);
  cache.set('a', 1);
  cache.set('b', 2);
  assert.equal(cache.has('a'), true);
  const listed = cache.keys();
  listed.reverse();
  assert.deepEqual(cache.keys(), ['a', 'b']);
  cache.set('c', 3);
  assert.deepEqual(cache.keys(), ['b', 'c']);
});

test('keys of any type stay distinct', () => {
  const cache = new LruCache(3);
  const first = { id: 1 };
  const second = { id: 1 };
  cache.set(1, 'number');
  cache.set('1', 'string');
  assert.equal(cache.size, 2);
  assert.equal(cache.get(1), 'number');
  assert.equal(cache.get('1'), 'string');

  const byObject = new LruCache(1);
  byObject.set(first, 'first');
  assert.equal(byObject.get(second), undefined);
  byObject.set(second, 'second');
  assert.equal(byObject.has(first), false);
  assert.equal(byObject.get(second), 'second');
  assert.equal(byObject.size, 1);
});
