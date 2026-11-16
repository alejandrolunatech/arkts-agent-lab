import test from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from './solution.mjs';

test('emit calls the listeners of that event in registration order', () => {
  const bus = new EventBus();
  const calls = [];
  bus.on('saved', (payload) => calls.push(`first:${payload}`));
  bus.on('saved', (payload) => calls.push(`second:${payload}`));
  bus.on('closed', (payload) => calls.push(`closed:${payload}`));
  assert.equal(bus.emit('saved', 'a.txt'), 2);
  assert.deepEqual(calls, ['first:a.txt', 'second:a.txt']);
  assert.equal(bus.emit('closed', 'b.txt'), 1);
  assert.deepEqual(calls, ['first:a.txt', 'second:a.txt', 'closed:b.txt']);
});

test('an event without listeners returns 0', () => {
  const bus = new EventBus();
  assert.equal(bus.emit('nothing', 1), 0);
  assert.equal(bus.listenerCount('nothing'), 0);
});

test('off removes one listener and ignores unknown ones', () => {
  const bus = new EventBus();
  const seen = [];
  const keep = (payload) => seen.push(['keep', payload]);
  const drop = (payload) => seen.push(['drop', payload]);
  bus.on('tick', drop);
  bus.on('tick', keep);
  bus.off('tick', drop);
  bus.off('tick', () => {});
  bus.off('never-used', keep);
  assert.equal(bus.listenerCount('tick'), 1);
  assert.equal(bus.emit('tick', 7), 1);
  assert.deepEqual(seen, [['keep', 7]]);
  bus.off('tick', keep);
  assert.equal(bus.listenerCount('tick'), 0);
  assert.equal(bus.emit('tick', 8), 0);
  assert.deepEqual(seen, [['keep', 7]]);
});

test('registering the same function twice for an event counts once', () => {
  const bus = new EventBus();
  let count = 0;
  const listener = () => {
    count += 1;
  };
  bus.on('ping', listener);
  bus.on('ping', listener);
  assert.equal(bus.listenerCount('ping'), 1);
  assert.equal(bus.emit('ping', null), 1);
  assert.equal(count, 1);
});

test('events are independent', () => {
  const bus = new EventBus();
  const got = [];
  const listener = (payload) => got.push(payload);
  bus.on('open', listener);
  bus.on('close', listener);
  bus.off('open', listener);
  assert.equal(bus.emit('open', 'o'), 0);
  assert.equal(bus.emit('close', 'c'), 1);
  assert.deepEqual(got, ['c']);
});

test('on and off during an emit only change later emits', () => {
  const bus = new EventBus();
  const calls = [];
  const late = () => calls.push('late');
  const second = () => calls.push('second');
  const first = () => {
    calls.push('first');
    bus.off('go', second);
    bus.on('go', late);
  };
  bus.on('go', first);
  bus.on('go', second);
  assert.equal(bus.emit('go', 0), 2);
  assert.deepEqual(calls, ['first', 'second']);
  assert.equal(bus.emit('go', 0), 2);
  assert.deepEqual(calls, ['first', 'second', 'first', 'late']);
});
