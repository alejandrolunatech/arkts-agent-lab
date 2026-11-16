import test from 'node:test';
import assert from 'node:assert/strict';
import { Stack } from './solution.mjs';

test('pops in last-in, first-out order', () => {
  const stack = new Stack(5);
  assert.equal(stack.push('a'), true);
  assert.equal(stack.push('b'), true);
  assert.equal(stack.push('c'), true);
  assert.equal(stack.size(), 3);
  assert.equal(stack.pop(), 'c');
  assert.equal(stack.pop(), 'b');
  assert.equal(stack.size(), 1);
  assert.equal(stack.pop(), 'a');
  assert.equal(stack.size(), 0);
});

test('an empty stack pops and peeks undefined', () => {
  const stack = new Stack(2);
  assert.equal(stack.isEmpty(), true);
  assert.equal(stack.pop(), undefined);
  assert.equal(stack.peek(), undefined);
  assert.equal(stack.size(), 0);
  stack.push(1);
  assert.equal(stack.isEmpty(), false);
});

test('peek returns the top item and leaves it there', () => {
  const stack = new Stack(3);
  stack.push(10);
  stack.push(20);
  assert.equal(stack.peek(), 20);
  assert.equal(stack.peek(), 20);
  assert.equal(stack.size(), 2);
});

test('a full stack refuses a push and accepts one again after a pop', () => {
  const stack = new Stack(2);
  assert.equal(stack.isFull(), false);
  assert.equal(stack.push(1), true);
  assert.equal(stack.push(2), true);
  assert.equal(stack.isFull(), true);
  assert.equal(stack.push(3), false);
  assert.equal(stack.size(), 2);
  assert.equal(stack.peek(), 2);
  assert.equal(stack.pop(), 2);
  assert.equal(stack.isFull(), false);
  assert.equal(stack.push(4), true);
  assert.deepEqual(stack.toArray(), [1, 4]);
});

test('toArray lists bottom to top and is a copy', () => {
  const stack = new Stack(4);
  stack.push('x');
  stack.push('y');
  const items = stack.toArray();
  assert.deepEqual(items, ['x', 'y']);
  items.push('z');
  items[0] = 'changed';
  assert.deepEqual(stack.toArray(), ['x', 'y']);
  assert.equal(stack.size(), 2);
});

test('clear empties the stack and it can be used again', () => {
  const stack = new Stack(2);
  stack.push(1);
  stack.push(2);
  const before = stack.toArray();
  stack.clear();
  assert.equal(stack.size(), 0);
  assert.equal(stack.isEmpty(), true);
  assert.equal(stack.pop(), undefined);
  assert.deepEqual(before, [1, 2]);
  assert.equal(stack.push(7), true);
  assert.equal(stack.peek(), 7);
});
