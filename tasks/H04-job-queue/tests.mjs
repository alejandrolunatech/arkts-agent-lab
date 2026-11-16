import test from 'node:test';
import assert from 'node:assert/strict';
import { JobQueue } from './solution.mjs';

/** Lets every promise callback that is already due run, without a clock. */
async function flush() {
  for (let i = 0; i < 30; i++) await Promise.resolve();
}

/** A job that writes its name to `log` when it is called and settles when the test says so. */
function gated(log, name) {
  const gate = {};
  const promise = new Promise((resolve, reject) => {
    gate.finish = resolve;
    gate.fail = reject;
  });
  gate.job = () => {
    log.push(name);
    return promise;
  };
  return gate;
}

test('runs the jobs in order, never more than the limit, the first ones before add returns', async () => {
  const queue = new JobQueue(2);
  const log = [];
  const [a, b, c, d] = ['a', 'b', 'c', 'd'].map((name) => gated(log, name));

  const first = queue.add(a.job);
  assert.deepEqual(log, ['a']);
  const second = queue.add(b.job);
  const third = queue.add(c.job);
  const fourth = queue.add(d.job);
  assert.deepEqual(log, ['a', 'b']);
  assert.equal(queue.running, 2);
  assert.equal(queue.waiting, 2);

  b.finish('B');
  assert.equal(await second, 'B');
  await flush();
  assert.deepEqual(log, ['a', 'b', 'c']);
  assert.equal(queue.running, 2);
  assert.equal(queue.waiting, 1);

  a.finish('A');
  c.finish('C');
  assert.equal(await first, 'A');
  assert.equal(await third, 'C');
  await flush();
  assert.deepEqual(log, ['a', 'b', 'c', 'd']);
  assert.equal(queue.running, 1);
  assert.equal(queue.waiting, 0);

  d.finish('D');
  assert.equal(await fourth, 'D');
  await flush();
  assert.equal(queue.running, 0);
  assert.equal(queue.completed, 4);
  assert.equal(queue.failed, 0);
});

test('a failed job rejects with its own error and frees its place', async () => {
  const queue = new JobQueue(1);
  const log = [];
  const bad = gated(log, 'bad');
  const good = gated(log, 'good');
  const failing = queue.add(bad.job);
  failing.catch(() => {});
  const working = queue.add(good.job);
  assert.deepEqual(log, ['bad']);

  const error = new Error('disk full');
  bad.fail(error);
  await assert.rejects(failing, (caught) => caught === error);
  await flush();
  assert.deepEqual(log, ['bad', 'good']);
  assert.equal(queue.failed, 1);
  assert.equal(queue.completed, 0);
  assert.equal(queue.running, 1);

  good.finish(7);
  assert.equal(await working, 7);
  await flush();
  assert.equal(queue.completed, 1);
  assert.equal(queue.failed, 1);
  assert.equal(queue.running, 0);
});

test('a paused queue starts nothing until resume', async () => {
  const queue = new JobQueue(1);
  const log = [];
  const [a, b, c] = ['a', 'b', 'c'].map((name) => gated(log, name));
  const first = queue.add(a.job);
  queue.pause();
  const second = queue.add(b.job);
  const third = queue.add(c.job);

  a.finish(1);
  assert.equal(await first, 1);
  await flush();
  assert.deepEqual(log, ['a']);
  assert.equal(queue.running, 0);
  assert.equal(queue.waiting, 2);

  queue.resume();
  assert.deepEqual(log, ['a', 'b']);
  assert.equal(queue.running, 1);
  assert.equal(queue.waiting, 1);

  b.finish(2);
  c.finish(3);
  assert.equal(await second, 2);
  assert.equal(await third, 3);
  assert.deepEqual(log, ['a', 'b', 'c']);
});

test('clear cancels the waiting jobs and leaves the running one alone', async () => {
  const queue = new JobQueue(1);
  const log = [];
  const [a, b, c] = ['a', 'b', 'c'].map((name) => gated(log, name));
  const first = queue.add(a.job);
  const second = queue.add(b.job);
  const third = queue.add(c.job);
  second.catch(() => {});
  third.catch(() => {});

  assert.equal(queue.clear(), 2);
  assert.equal(queue.waiting, 0);
  assert.equal(queue.running, 1);
  assert.equal(queue.clear(), 0);
  const isCancelled = (error) => error instanceof Error && error.message === 'Job was cancelled';
  await assert.rejects(second, isCancelled);
  await assert.rejects(third, isCancelled);

  a.finish('kept');
  assert.equal(await first, 'kept');
  await flush();
  assert.deepEqual(log, ['a']);
  assert.equal(queue.completed, 1);
  assert.equal(queue.failed, 0);
  assert.equal(queue.running, 0);
});

test('whenIdle waits until nothing is running and nothing is waiting', async () => {
  const queue = new JobQueue(1);
  await queue.whenIdle();

  const log = [];
  const a = gated(log, 'a');
  const b = gated(log, 'b');
  const first = queue.add(a.job);
  const second = queue.add(b.job);
  second.catch(() => {});
  let idle = 0;
  queue.whenIdle().then(() => {
    idle += 1;
  });
  queue.whenIdle().then(() => {
    idle += 1;
  });
  await flush();
  assert.equal(idle, 0);

  a.finish(1);
  await first;
  await flush();
  assert.equal(idle, 0);

  b.fail(new Error('late'));
  await assert.rejects(second);
  await flush();
  assert.equal(idle, 2);
  await queue.whenIdle();

  const paused = new JobQueue(3);
  paused.pause();
  const never = paused.add(gated(log, 'never').job);
  never.catch(() => {});
  let emptied = false;
  paused.whenIdle().then(() => {
    emptied = true;
  });
  await flush();
  assert.equal(emptied, false);
  assert.equal(paused.clear(), 1);
  await assert.rejects(never, (error) => error instanceof Error && error.message === 'Job was cancelled');
  await flush();
  assert.equal(emptied, true);
  assert.deepEqual(log, ['a', 'b']);
});

test('runAll reports one outcome per job, in order, and keeps the limit', async () => {
  const queue = new JobQueue(2);
  let active = 0;
  let most = 0;
  const broken = new Error('job 2 broke');
  const jobs = [0, 1, 2, 3, 4].map((n) => async () => {
    active += 1;
    most = Math.max(most, active);
    for (let i = 0; i < 5 - n; i++) await Promise.resolve();
    active -= 1;
    if (n === 2) throw broken;
    return n * 10;
  });

  const pending = queue.runAll(jobs);
  assert.equal(queue.running, 2);
  assert.equal(queue.waiting, 3);
  const outcomes = await pending;
  assert.deepEqual(outcomes.map((outcome) => [outcome.ok, outcome.value]), [
    [true, 0],
    [true, 10],
    [false, undefined],
    [true, 30],
    [true, 40],
  ]);
  assert.deepEqual(outcomes.map((outcome) => outcome.error), [undefined, undefined, broken, undefined, undefined]);
  assert.equal(outcomes[2].error, broken);
  assert.equal(most, 2);
  assert.equal(queue.completed, 4);
  assert.equal(queue.failed, 1);
  assert.deepEqual(await queue.runAll([]), []);

  const single = new JobQueue(1);
  const log = [];
  const slow = gated(log, 'slow');
  const all = single.runAll([slow.job, async () => 'skipped']);
  assert.equal(single.clear(), 1);
  slow.finish('done');
  const [kept, removed] = await all;
  assert.deepEqual([kept.ok, kept.value, kept.error], [true, 'done', undefined]);
  assert.equal(removed.ok, false);
  assert.equal(removed.value, undefined);
  assert.ok(removed.error instanceof Error);
  assert.equal(removed.error.message, 'Job was cancelled');
});
