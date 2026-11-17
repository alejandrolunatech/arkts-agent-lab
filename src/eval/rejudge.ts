// Judges the recorded answers of a results file again, with the judge as it is now.
// The judge needs no model, so anyone can check every verdict of a run for free.

import type { Attempt } from '../agent/attempt.ts';
import { judge } from '../judge/judge.ts';
import type { Task } from '../tasks.ts';
import { counted } from './run.ts';

export interface Rejudged {
  /** Attempts judged again: the ones a report counts. */
  checked: number;
  /** One line per attempt whose verdict is not the recorded one. */
  differences: string[];
}

/** `truncated` is a failure of whichever layer, recorded under its own name: it is compared as a failure. */
const outcome = (passed: boolean, failedAt: string): string => (passed ? 'pass' : failedAt === 'truncated' ? 'fail' : failedAt);

/**
 * Only the final answer of an attempt is kept, so only the final verdict can be checked. What the
 * judge said about the earlier answers of a loop went to the model and cannot be taken back.
 */
export function rejudge(all: Attempt[], tasks: Task[]): Rejudged {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const differences: string[] = [];
  const attempts = counted(all);
  for (const a of attempts) {
    const where = `${a.model}  ${a.condition}  ${a.task}`;
    const task = byId.get(a.task);
    if (!task) {
      differences.push(`${where}: no task with this id any more`);
      continue;
    }
    const now = judge(task, a.finalCode);
    const before = outcome(a.passed, a.failedAt);
    // A cut-off answer that still fails is the same verdict, whichever layer stops it now.
    const after = a.failedAt === 'truncated' && !now.passed ? 'fail' : outcome(now.passed, now.failedAt);
    if (before !== after) differences.push(`${where}: was ${before}, now ${after}${now.detail ? ` (${now.detail})` : ''}`);
  }
  return { checked: attempts.length, differences };
}
