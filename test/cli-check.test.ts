// `check --json` is a contract other tools read: these tests run the command as they would.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import type { Finding } from '../src/judge/check.ts';
import { loadTask, repoRoot, tasksDir } from '../src/tasks.ts';

const KEYS = ['layer', 'code', 'severity', 'file', 'line', 'column', 'endLine', 'endColumn', 'message'];

function check(args: string[], input = ''): { status: number | null; stdout: string } {
  return spawnSync(process.execPath, ['--import', 'tsx', 'src/cli.ts', 'check', ...args], { cwd: repoRoot, input, encoding: 'utf8' });
}

/** Parses stdout as the one JSON object it must be, and checks the shape of every finding. */
function findingsOf(stdout: string): Required<Finding>[] {
  const parsed = JSON.parse(stdout) as { findings: Required<Finding>[] };
  assert.deepEqual(Object.keys(parsed), ['findings']);
  for (const f of parsed.findings) {
    assert.deepEqual(Object.keys(f), KEYS);
    assert.ok(f.endLine > f.line || (f.endLine === f.line && f.endColumn > f.column), `${f.code} ends before it starts`);
  }
  return parsed.findings;
}

const task = loadTask(path.join(tasksDir, 'L01-total-by-category'));
const file = (which: string): string => path.join('tasks', task.id, `${which}.ets`);

test('check --json on a clean file prints an empty list and exits 0', () => {
  const run = check(['--json', file('reference')]);
  assert.equal(run.stdout, '{"findings":[]}\n');
  assert.equal(run.status, 0);
});

test('check --json on a file with errors prints them and exits 1', () => {
  const run = check(['--json', file('trap')]);
  const findings = findingsOf(run.stdout);
  assert.equal(run.status, 1);
  for (const code of task.traps) assert.ok(findings.some((f) => f.code === code), `missing ${code}`);
  assert.ok(findings.every((f) => f.file === file('trap')));
});

test('check --stdin --json reads the source from stdin', () => {
  const run = check(['--stdin', '--json'], 'export function double(x: number): number {\n  return x * 2;\n}\n');
  assert.equal(run.stdout, '{"findings":[]}\n');
  assert.equal(run.status, 0);
});

test('check --stdin --json reports where a finding starts and ends, under the given name', () => {
  const run = check(['--stdin', '--json', '--filename', 'pages/Index.ets'], 'let x: any = 1\n');
  assert.equal(run.status, 1);
  assert.deepEqual(findingsOf(run.stdout), [
    {
      layer: 'arkts',
      code: 'arkts-no-any-unknown',
      severity: 'error',
      file: 'Index.ets',
      line: 1,
      column: 8,
      endLine: 1,
      endColumn: 11,
      message: 'Use explicit types instead of "any", "unknown" (arkts-no-any-unknown)',
    },
  ]);
});

test('a usage problem exits 2 and prints nothing on stdout', () => {
  for (const args of [['--json'], ['--stdin', '--json', file('trap')], ['--filename', 'a.ets', file('trap')], ['--jsno', file('trap')]]) {
    const run = check(args);
    assert.equal(run.status, 2, args.join(' '));
    assert.equal(run.stdout, '');
  }
});

test('report on a file that does not exist says so and exits 2, instead of printing empty tables', () => {
  const run = spawnSync(process.execPath, ['--import', 'tsx', 'src/cli.ts', 'report', '.tmp/no-such-run.jsonl'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(run.status, 2);
  assert.equal(run.stdout, '');
  assert.match(run.stderr, /no results file at \.tmp\/no-such-run\.jsonl/);
});
