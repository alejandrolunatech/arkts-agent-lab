import test from 'node:test';
import assert from 'node:assert/strict';
import { updateQuantity, applyChanges } from './solution.mjs';

function stock() {
  return [
    { id: 'apple', name: 'Apple', quantity: 5 },
    { id: 'pear', name: 'Pear', quantity: 2 },
    { id: 'plum', name: 'Plum', quantity: 9 },
  ];
}

test('changes the quantity of one item and keeps the order', () => {
  assert.deepEqual(updateQuantity(stock(), 'pear', 7), [
    { id: 'apple', name: 'Apple', quantity: 5 },
    { id: 'pear', name: 'Pear', quantity: 7 },
    { id: 'plum', name: 'Plum', quantity: 9 },
  ]);
});

test('leaves the item out when the quantity is zero or less', () => {
  assert.deepEqual(updateQuantity(stock(), 'apple', 0), [
    { id: 'pear', name: 'Pear', quantity: 2 },
    { id: 'plum', name: 'Plum', quantity: 9 },
  ]);
  assert.deepEqual(
    updateQuantity(stock(), 'plum', -3).map((item) => item.id),
    ['apple', 'pear'],
  );
});

test('an unknown id gives the same items', () => {
  assert.deepEqual(updateQuantity(stock(), 'kiwi', 4), stock());
  assert.deepEqual(updateQuantity([], 'kiwi', 4), []);
});

test('updateQuantity does not modify its input', () => {
  const items = stock();
  const originalPear = items[1];
  const result = updateQuantity(items, 'pear', 7);
  assert.notEqual(result, items);
  assert.deepEqual(items, stock());
  assert.equal(items[1], originalPear);
  assert.notEqual(result[1], originalPear);
  updateQuantity(items, 'apple', 0);
  assert.deepEqual(items, stock());
});

test('applies changes in order', () => {
  const result = applyChanges(stock(), [
    { id: 'apple', quantity: 1 },
    { id: 'pear', quantity: 0 },
    { id: 'apple', quantity: 3 },
    { id: 'pear', quantity: 8 },
    { id: 'kiwi', quantity: 2 },
  ]);
  assert.deepEqual(result, [
    { id: 'apple', name: 'Apple', quantity: 3 },
    { id: 'plum', name: 'Plum', quantity: 9 },
  ]);
});

test('applyChanges does not modify its input', () => {
  const items = stock();
  const changes = [
    { id: 'plum', quantity: 4 },
    { id: 'apple', quantity: -1 },
  ];
  const result = applyChanges(items, changes);
  assert.deepEqual(result, [
    { id: 'pear', name: 'Pear', quantity: 2 },
    { id: 'plum', name: 'Plum', quantity: 4 },
  ]);
  assert.deepEqual(items, stock());
  assert.deepEqual(changes, [
    { id: 'plum', quantity: 4 },
    { id: 'apple', quantity: -1 },
  ]);
  assert.deepEqual(applyChanges(items, []), stock());
});
