import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration, parseDuration } from './solution.mjs';

test('formats seconds only below one minute', () => {
  assert.equal(formatDuration(0), '0s');
  assert.equal(formatDuration(7), '7s');
  assert.equal(formatDuration(59), '59s');
});

test('formats minutes and padded seconds below one hour', () => {
  assert.equal(formatDuration(60), '1m 00s');
  assert.equal(formatDuration(69), '1m 09s');
  assert.equal(formatDuration(754), '12m 34s');
  assert.equal(formatDuration(3599), '59m 59s');
});

test('formats hours with padded minutes and seconds', () => {
  assert.equal(formatDuration(3600), '1h 00m 00s');
  assert.equal(formatDuration(3909), '1h 05m 09s');
  assert.equal(formatDuration(45296), '12h 34m 56s');
  assert.equal(formatDuration(360000), '100h 00m 00s');
});

test('formats negative values with a leading minus', () => {
  assert.equal(formatDuration(-5), '-5s');
  assert.equal(formatDuration(-90), '-1m 30s');
  assert.equal(formatDuration(-3909), '-1h 05m 09s');
});

test('parses texts back to seconds', () => {
  assert.equal(parseDuration('1h 05m 09s'), 3909);
  assert.equal(parseDuration('90s'), 90);
  assert.equal(parseDuration('30s 2m'), 150);
  assert.equal(parseDuration('2h'), 7200);
  assert.equal(parseDuration('-1m 30s'), -90);
  for (const seconds of [1, 61, 3600, 86399, -754]) {
    assert.equal(parseDuration(formatDuration(seconds)), seconds);
  }
});

test('gives NaN for texts that are not a duration', () => {
  for (const text of ['', '-', 'abc', '12', 'm', '5x', '1.5h', '1h  5m', ' 5s', '5s ', '1h-5m']) {
    assert.ok(Number.isNaN(parseDuration(text)), `expected NaN for "${text}"`);
  }
});
