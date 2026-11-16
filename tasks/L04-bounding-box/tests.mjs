import test from 'node:test';
import assert from 'node:assert/strict';
import { boundingBox } from './solution.mjs';

const plain = (box) => ({
  min: { x: box.min.x, y: box.min.y },
  max: { x: box.max.x, y: box.max.y },
  width: box.width,
  height: box.height,
});

test('finds the corners and the size', () => {
  const box = boundingBox([
    { x: 3, y: 7 },
    { x: -2, y: 4 },
    { x: 5, y: -1 },
    { x: 0, y: 0 },
  ]);
  assert.deepEqual(plain(box), { min: { x: -2, y: -1 }, max: { x: 5, y: 7 }, width: 7, height: 8 });
});

test('the corners need not be input points', () => {
  const box = boundingBox([
    { x: 1, y: 10 },
    { x: 4, y: 2 },
  ]);
  assert.deepEqual(plain(box), { min: { x: 1, y: 2 }, max: { x: 4, y: 10 }, width: 3, height: 8 });
});

test('a single point gives a box of size zero', () => {
  const box = boundingBox([{ x: 2.5, y: -3 }]);
  assert.deepEqual(plain(box), { min: { x: 2.5, y: -3 }, max: { x: 2.5, y: -3 }, width: 0, height: 0 });
});

test('works when every coordinate is negative', () => {
  const box = boundingBox([
    { x: -5, y: -9 },
    { x: -8, y: -1 },
    { x: -6, y: -4 },
  ]);
  assert.deepEqual(plain(box), { min: { x: -8, y: -9 }, max: { x: -5, y: -1 }, width: 3, height: 8 });
});

test('an empty input gives undefined', () => {
  assert.equal(boundingBox([]), undefined);
});

test('returns new corner objects and leaves the input alone', () => {
  const only = { x: 1, y: 1 };
  const points = [only];
  const box = boundingBox(points);
  assert.notEqual(box.min, only);
  assert.notEqual(box.max, only);
  assert.notEqual(box.min, box.max);
  box.min.x = 99;
  assert.deepEqual(points, [{ x: 1, y: 1 }]);
});
