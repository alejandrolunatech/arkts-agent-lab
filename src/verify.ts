// "Tests for the tests": a task is only worth measuring with if its reference
// solution passes the judge and its trap solution fails it for the stated reason.

import { judge } from './judge/judge.ts';
import { loadTasks, readSolution, type Task } from './tasks.ts';

export interface TaskProblem {
  task: string;
  problem: string;
}

export function verifyTask(task: Task): TaskProblem[] {
  const problems: TaskProblem[] = [];
  const say = (problem: string): void => void problems.push({ task: task.id, problem });

  const reference = judge(task, readSolution(task, 'reference'));
  if (!reference.passed) {
    const errors = reference.findings.filter((f) => f.severity === 'error').map((f) => `${f.line}: [${f.code}] ${f.message}`);
    say(`reference fails at ${reference.failedAt}: ${[...errors, reference.detail].filter(Boolean).join(' | ')}`);
  }

  const trap = judge(task, readSolution(task, 'trap'));
  if (trap.passed) say('trap passes, so the task does not tell good from bad');
  const seen = new Set(trap.findings.map((f) => f.code));
  for (const code of task.traps) if (!seen.has(code)) say(`trap does not trigger ${code}; it triggers ${[...seen].join(', ') || 'nothing'}`);
  if (task.traps.length === 0) say('task.json lists no traps');

  return problems;
}

/** Prints one line per task and returns whether all of them are sound. */
export function verifyTasks(only: string[]): boolean {
  const tasks = loadTasks(only);
  let bad = 0;
  for (const task of tasks) {
    const problems = verifyTask(task);
    if (problems.length === 0) {
      console.log(`ok    ${task.id}`);
    } else {
      bad += 1;
      for (const p of problems) console.log(`FAIL  ${p.task}: ${p.problem}`);
    }
  }
  console.log(`${tasks.length - bad} of ${tasks.length} task(s) sound.`);
  return bad === 0 && tasks.length > 0;
}
