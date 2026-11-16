import test from 'node:test';
import assert from 'node:assert/strict';
import { BuildPlan, CycleError, MissingDependencyError } from './solution.mjs';

function site() {
  return new BuildPlan({
    deploy: ['bundle', 'docs'],
    bundle: ['compile', 'assets'],
    docs: ['compile'],
    lint: [],
    compile: ['fetch'],
    assets: ['fetch'],
    fetch: [],
  });
}

/** Runs `action` and returns what it throws. */
function thrown(action) {
  try {
    action();
  } catch (error) {
    return error;
  }
  return assert.fail('expected an error');
}

test('order places dependencies first, in the order they are listed', () => {
  const plan = site();
  assert.deepEqual(plan.order(), ['fetch', 'compile', 'assets', 'bundle', 'docs', 'deploy', 'lint']);

  const again = plan.order();
  again.reverse();
  assert.deepEqual(plan.order(), ['fetch', 'compile', 'assets', 'bundle', 'docs', 'deploy', 'lint']);

  const repeated = new BuildPlan({ a: ['c', 'b', 'c'], b: ['c'], c: [] });
  assert.deepEqual(repeated.order(), ['c', 'b', 'a']);
  assert.deepEqual(new BuildPlan({}).order(), []);
});

test('layers put every task right after its deepest dependency, in key order', () => {
  assert.deepEqual(site().layers(), [
    ['lint', 'fetch'],
    ['compile', 'assets'],
    ['bundle', 'docs'],
    ['deploy'],
  ]);
  assert.deepEqual(new BuildPlan({ z: [], y: [], x: ['y'] }).layers(), [['z', 'y'], ['x']]);
  assert.deepEqual(new BuildPlan({ top: ['mid', 'base'], mid: ['base'], base: [] }).layers(), [['base'], ['mid'], ['top']]);
  assert.deepEqual(new BuildPlan({}).layers(), []);
});

test('dependentsOf follows dependencies through other tasks', () => {
  const plan = site();
  assert.deepEqual(plan.dependentsOf('fetch'), ['compile', 'assets', 'bundle', 'docs', 'deploy']);
  assert.deepEqual(plan.dependentsOf('assets'), ['bundle', 'deploy']);
  assert.deepEqual(plan.dependentsOf('compile'), ['bundle', 'docs', 'deploy']);
  assert.deepEqual(plan.dependentsOf('deploy'), []);
  assert.deepEqual(plan.dependentsOf('lint'), []);
  assert.deepEqual(plan.dependentsOf('nowhere'), []);
});

test('a dependency that is not a task is reported first', () => {
  const error = thrown(() => new BuildPlan({ app: ['lib'], lib: ['core', 'log'], tool: ['gone'] }));
  assert.ok(error instanceof MissingDependencyError);
  assert.ok(error instanceof Error);
  assert.equal(error.task, 'lib');
  assert.equal(error.dependency, 'core');
  assert.equal(error.message, "Task 'lib' depends on unknown task 'core'");

  const mixed = thrown(() => new BuildPlan({ a: ['b'], b: ['a'], c: ['ghost'] }));
  assert.ok(mixed instanceof MissingDependencyError);
  assert.equal(mixed.task, 'c');
  assert.equal(mixed.dependency, 'ghost');
});

test('a cycle is reported with the path that closes it', () => {
  const error = thrown(() => new BuildPlan({ app: ['lib'], lib: ['core'], core: ['lib'] }));
  assert.ok(error instanceof CycleError);
  assert.ok(error instanceof Error);
  assert.deepEqual(error.path, ['lib', 'core', 'lib']);
  assert.equal(error.message, 'Dependency cycle: lib -> core -> lib');

  const whole = thrown(() => new BuildPlan({ a: ['b'], b: ['c'], c: ['a'] }));
  assert.deepEqual(whole.path, ['a', 'b', 'c', 'a']);

  const own = thrown(() => new BuildPlan({ ok: [], x: ['ok', 'x'] }));
  assert.ok(own instanceof CycleError);
  assert.deepEqual(own.path, ['x', 'x']);
  assert.equal(own.message, 'Dependency cycle: x -> x');
});

test('a task reached twice without a cycle is not an error, and the errors can be built directly', () => {
  const diamond = new BuildPlan({ top: ['left', 'right'], left: ['base'], right: ['base'], base: [] });
  assert.deepEqual(diamond.order(), ['base', 'left', 'right', 'top']);
  assert.deepEqual(diamond.layers(), [['base'], ['left', 'right'], ['top']]);
  assert.deepEqual(diamond.dependentsOf('base'), ['left', 'right', 'top']);

  const cycle = new CycleError(['p', 'q', 'p']);
  assert.deepEqual(cycle.path, ['p', 'q', 'p']);
  assert.equal(cycle.message, 'Dependency cycle: p -> q -> p');
  const missing = new MissingDependencyError('p', 'q');
  assert.equal(missing.task, 'p');
  assert.equal(missing.dependency, 'q');
  assert.equal(missing.message, "Task 'p' depends on unknown task 'q'");
});
