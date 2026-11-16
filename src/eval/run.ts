// Runs the grid: every task with every model under every condition.
// Results are appended to a JSON Lines file one attempt at a time, so a run can be
// stopped and resumed, and a spending cap stops it before it costs more than agreed.

import fs from 'node:fs';
import path from 'node:path';
import { runAttempt, type Attempt } from '../agent/attempt.ts';
import { condition, type ConditionId } from '../agent/conditions.ts';
import { docSearch } from '../agent/docs.ts';
import type { Model } from '../agent/model.ts';
import type { Task } from '../tasks.ts';

export interface RunPlan {
  tasks: Task[];
  models: Model[];
  conditions: ConditionId[];
  outFile: string;
  /** Stop starting new attempts once this much has been spent in this invocation. */
  maxUsd: number;
  concurrency: number;
  log?: (line: string) => void;
}

export interface RunSummary {
  planned: number;
  skipped: number;
  done: number;
  passed: number;
  modelErrors: number;
  spentUsd: number;
  stoppedAtBudget: boolean;
}

const MAX_CONSECUTIVE_ERRORS = 6;

const keyOf = (a: Pick<Attempt, 'task' | 'model' | 'condition'>): string => `${a.model}|${a.condition}|${a.task}`;

export function readAttempts(file: string): Attempt[] {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Attempt);
}

/** Upper bound on model calls for a plan: one per turn, plus the lookup plan in docs conditions. */
export function countCalls(tasks: number, models: number, conditions: ConditionId[]): number {
  let perTask = 0;
  for (const id of conditions) {
    const c = condition(id);
    perTask += 1 + c.maxRepairs + (c.docs ? 1 : 0);
  }
  return tasks * models * perTask;
}

export async function runPlan(plan: RunPlan): Promise<RunSummary> {
  const log = plan.log ?? (() => {});
  fs.mkdirSync(path.dirname(plan.outFile), { recursive: true });

  // An attempt that ended in a provider error is not "done": it is tried again on resume.
  const done = new Set(readAttempts(plan.outFile).filter((a) => a.failedAt !== 'model-error').map(keyOf));

  const queue: { task: Task; model: Model; conditionId: ConditionId }[] = [];
  for (const model of plan.models) {
    for (const conditionId of plan.conditions) {
      for (const task of plan.tasks) queue.push({ task, model, conditionId });
    }
  }

  const summary: RunSummary = { planned: queue.length, skipped: 0, done: 0, passed: 0, modelErrors: 0, spentUsd: 0, stoppedAtBudget: false };
  const search = docSearch();
  let next = 0;
  let consecutiveErrors = 0;

  const worker = async (): Promise<void> => {
    for (;;) {
      const job = queue[next];
      next += 1;
      if (!job) return;
      if (done.has(keyOf({ task: job.task.id, model: job.model.id, condition: job.conditionId }))) {
        summary.skipped += 1;
        continue;
      }
      if (summary.spentUsd >= plan.maxUsd) {
        summary.stoppedAtBudget = true;
        return;
      }
      const attempt = await runAttempt(job.task, job.model, condition(job.conditionId), search);
      fs.appendFileSync(plan.outFile, `${JSON.stringify(attempt)}\n`);
      summary.done += 1;
      summary.spentUsd += attempt.costUsd;
      if (attempt.passed) summary.passed += 1;
      if (attempt.failedAt === 'model-error') {
        summary.modelErrors += 1;
        consecutiveErrors += 1;
        // A wrong model id or a dead key fails every call: stop instead of burning through the grid.
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) next = queue.length;
      } else {
        consecutiveErrors = 0;
      }
      const outcome = attempt.passed ? 'pass' : attempt.failedAt;
      log(`${outcome.padEnd(11)} ${attempt.model}  ${attempt.condition.padEnd(5)}  ${attempt.task}  turns=${attempt.turns.length}  $${summary.spentUsd.toFixed(4)}${attempt.failedAt === 'model-error' ? `  ${attempt.detail}` : ''}`);
    }
  };

  await Promise.all(Array.from({ length: Math.max(1, plan.concurrency) }, worker));
  return summary;
}
