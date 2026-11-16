// A task is a folder under `tasks/`:
//
//   task.json      id, kind, title, the trap this task is built around, structure spec
//   prompt.md      what the model is asked to write
//   reference.ets  a correct solution (must pass the judge)
//   trap.ets       the way a TypeScript programmer would write it (must fail the judge)
//   tests.mjs      hidden behaviour tests, logic tasks only

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StructureSpec } from './judge/structure.ts';

export const repoRoot: string = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const tasksDir: string = path.join(repoRoot, 'tasks');

export type TaskKind = 'logic' | 'ui';

export interface Task {
  id: string;
  kind: TaskKind;
  title: string;
  /** Checker codes the trap solution must trigger, e.g. `arkts-no-any-unknown` or `TS2339`. */
  traps: string[];
  /** UI tasks only. */
  structure?: StructureSpec;
  prompt: string;
  dir: string;
  /** Absolute path of the hidden tests, logic tasks only. */
  testsFile?: string;
}

export function loadTask(dir: string): Task {
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'task.json'), 'utf8')) as Omit<Task, 'prompt' | 'dir'>;
  const id = path.basename(dir);
  if (meta.id !== id) throw new Error(`${id}: task.json says id "${meta.id}"`);
  if (meta.kind !== 'logic' && meta.kind !== 'ui') throw new Error(`${id}: kind must be "logic" or "ui"`);
  const testsFile = path.join(dir, 'tests.mjs');
  if (meta.kind === 'logic' && !fs.existsSync(testsFile)) throw new Error(`${id}: a logic task needs tests.mjs`);
  if (meta.kind === 'ui' && !meta.structure) throw new Error(`${id}: a ui task needs "structure" in task.json`);
  return {
    ...meta,
    prompt: fs.readFileSync(path.join(dir, 'prompt.md'), 'utf8').trim(),
    dir,
    testsFile: meta.kind === 'logic' ? testsFile : undefined,
  };
}

/** All tasks, sorted by id. `only` filters by exact id or by prefix (`L`, `U0`). */
export function loadTasks(only?: string[]): Task[] {
  const ids = fs
    .readdirSync(tasksDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const selected = only && only.length > 0 ? ids.filter((id) => only.some((want) => id === want || id.startsWith(want))) : ids;
  return selected.map((id) => loadTask(path.join(tasksDir, id)));
}

export function readSolution(task: Task, which: 'reference' | 'trap'): string {
  return fs.readFileSync(path.join(task.dir, `${which}.ets`), 'utf8');
}
