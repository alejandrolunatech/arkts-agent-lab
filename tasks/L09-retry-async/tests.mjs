import test from 'node:test';
import assert from 'node:assert/strict';
import { retry, RetryError } from './solution.mjs';

/** An action that fails with the given errors, one per call, and then succeeds with `value`. */
function flaky(errors, value) {
  const state = { calls: 0 };
  const action = async () => {
    state.calls += 1;
    if (state.calls <= errors.length) throw errors[state.calls - 1];
    return value;
  };
  return { state, action };
}

test('returns the value of a first success and stops', async () => {
  const { state, action } = flaky([], 42);
  assert.equal(await retry(action, 5), 42);
  assert.equal(state.calls, 1);
});

test('calls again after a failure until it succeeds', async () => {
  const { state, action } = flaky([new Error('one'), new Error('two')], 'done');
  assert.equal(await retry(action, 5), 'done');
  assert.equal(state.calls, 3);
});

test('rejects with a RetryError carrying the count and the last error', async () => {
  const errors = [new Error('one'), new Error('two'), new Error('three')];
  const { state, action } = flaky(errors, 'never');
  let caught;
  try {
    await retry(action, 3);
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof RetryError);
  assert.ok(caught instanceof Error);
  assert.equal(caught.attempts, 3);
  assert.equal(caught.lastError, errors[2]);
  assert.equal(caught.message, 'Failed after 3 attempts: three');
  assert.equal(state.calls, 3);
});

test('an attempts value below 1 means one call', async () => {
  const failing = flaky([new Error('nope')], 'never');
  await assert.rejects(retry(failing.action, 0), (error) => error instanceof RetryError && error.attempts === 1);
  assert.equal(failing.state.calls, 1);

  const working = flaky([], 'ok');
  assert.equal(await retry(working.action, -2), 'ok');
  assert.equal(working.state.calls, 1);
});

test('never runs two calls at the same time', async () => {
  let running = 0;
  let overlap = false;
  let calls = 0;
  const action = async () => {
    running += 1;
    if (running > 1) overlap = true;
    calls += 1;
    await Promise.resolve();
    running -= 1;
    if (calls < 3) throw new Error(`call ${calls}`);
    return calls;
  };
  assert.equal(await retry(action, 4), 3);
  assert.equal(overlap, false);
});

test('RetryError can be built directly', () => {
  const cause = new Error('timeout');
  const error = new RetryError(2, cause);
  assert.equal(error.attempts, 2);
  assert.equal(error.lastError, cause);
  assert.equal(error.message, 'Failed after 2 attempts: timeout');
});
