// The servers' stdout carries only protocol: this checks the guard that keeps everything else off it.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { repoRoot } from '../src/tasks.ts';

test('after reserveStdout, only its stream reaches stdout; console and library writes go to stderr', () => {
  const script = `
    import { reserveStdout } from './src/stdio.ts';
    const protocol = reserveStdout();
    console.log('console');
    process.stdout.write('library\\n');
    protocol.write('protocol\\n');
  `;
  const run = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', script], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout, 'protocol\n');
  assert.equal(run.stderr, 'console\nlibrary\n');
});
