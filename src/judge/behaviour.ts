// Behaviour check for logic tasks: turn the ArkTS file into JavaScript and run the
// task's hidden tests against it in a separate, locked-down Node process.
//
// The agent never sees these tests. They decide the score, not the feedback.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ts } from './program.ts';

export interface BehaviourResult {
  passed: boolean;
  /** Short reason when it did not pass: failed assertions, a crash or a timeout. */
  detail: string;
}

const TIMEOUT_MS = 10_000;

/** ArkTS without UI is erasable to JavaScript: drop the types, keep the code. */
export function toJavaScript(source: string): string {
  return ts.transpileModule(source, {
    fileName: 'solution.ts',
    compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.ESNext },
  }).outputText;
}

/** Node's permission model: the child may read its own folder and nothing else. */
function permissionFlags(dir: string): string[] {
  const [major = 0, minor = 0] = process.versions.node.split('.').map(Number);
  const stable = major > 22 || (major === 22 && minor >= 13);
  return [stable ? '--permission' : '--experimental-permission', `--allow-fs-read=${dir}`];
}

/**
 * `testsFile` is a plain `node:test` module that imports `./solution.mjs`.
 * Model output is untrusted code, so it runs with no network of its own making,
 * no file writes, no child processes and a time limit.
 */
export function runBehaviourTests(source: string, testsFile: string): BehaviourResult {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'arkts-run-')));
  try {
    fs.writeFileSync(path.join(dir, 'solution.mjs'), toJavaScript(source));
    fs.copyFileSync(testsFile, path.join(dir, 'tests.mjs'));
    const run = spawnSync(process.execPath, [...permissionFlags(dir), path.join(dir, 'tests.mjs')], {
      cwd: dir,
      encoding: 'utf8',
      timeout: TIMEOUT_MS,
      env: { PATH: process.env.PATH ?? '', NODE_NO_WARNINGS: '1' },
    });
    if (run.error) {
      const timedOut = (run.error as NodeJS.ErrnoException).code === 'ETIMEDOUT';
      return { passed: false, detail: timedOut ? `timed out after ${TIMEOUT_MS} ms` : run.error.message };
    }
    if (run.status === 0) return { passed: true, detail: '' };
    return { passed: false, detail: failureSummary(`${run.stdout}\n${run.stderr}`) };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Keeps the names of failing tests and the first error line; drops the rest of the report. */
function failureSummary(output: string): string {
  const failing = [...output.matchAll(/^\s*(?:✖|not ok \d+ -)\s*(.+)$/gm)].map((m) => m[1]!.trim());
  if (failing.length > 0) return `failed: ${[...new Set(failing)].slice(0, 5).join('; ')}`;
  const firstError = output.split('\n').find((line) => /Error/.test(line));
  return (firstError ?? output.trim().split('\n')[0] ?? 'tests failed').trim().slice(0, 300);
}
