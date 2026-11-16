import test from 'node:test';
import assert from 'node:assert/strict';
import { area, circle, rectangle, totalArea, triangle } from './solution.mjs';

const close = (actual, expected) => {
  assert.equal(typeof actual, 'number');
  assert.ok(Math.abs(actual - expected) < 1e-9, `expected ${expected}, got ${actual}`);
};

test('area of a circle', () => {
  close(area(circle(1)), Math.PI);
  close(area(circle(2.5)), Math.PI * 6.25);
});

test('area of a rectangle', () => {
  close(area(rectangle(2, 3)), 6);
  close(area(rectangle(0.5, 8)), 4);
});

test('area of a triangle', () => {
  close(area(triangle(4, 3)), 6);
  close(area(triangle(5, 5)), 12.5);
});

test('two shapes with the same numbers but a different kind differ', () => {
  close(area(rectangle(6, 4)), 24);
  close(area(triangle(6, 4)), 12);
});

test('totalArea adds the areas of mixed shapes', () => {
  const shapes = [rectangle(2, 3), triangle(4, 3), circle(1), rectangle(1, 1)];
  close(totalArea(shapes), 13 + Math.PI);
  close(totalArea([circle(2), circle(2)]), 8 * Math.PI);
});

test('totalArea of an empty list is 0', () => {
  assert.equal(totalArea([]), 0);
});
