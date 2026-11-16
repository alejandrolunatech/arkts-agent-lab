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
  /**
   * Stop starting new attempts once the results file holds this much spending. What earlier
   * invocations wrote to the file counts, so resuming a run cannot spend the cap twice.
   */
  maxUsd: number;
  concurrency: number;
  /** How many times each task is attempted in each cell. Default 1. */
  repeats?: number;
  log?: (line: string) => void;
}

export interface RunSummary {
  planned: number;
  skipped: number;
  done: number;
  passed: number;
  modelErrors: number;
  /** Spent by this invocation. */
  spentUsd: number;
  /** Spent by earlier invocations, as recorded in the results file. */
  spentBeforeUsd: number;
  stoppedAtBudget: boolean;
}

const MAX_CONSECUTIVE_ERRORS = 6;

const keyOf = (a: Pick<Attempt, 'task' | 'model' | 'condition'>): string => `${a.model}|${a.condition}|${a.task}`;

/** The time limit of a call in the client that wrote records before format 2. */
const OLD_TIMEOUT_MS = 120_000;

/**
 * True for a record from before format 2 in which a call ran out of time and was taken for an
 * empty reply. Either the answer itself was lost (nothing to judge, and not because the output
 * limit cut it off), or the lookup plan was (a docs condition that ran with no API reference).
 * Neither says anything about the model.
 */
export function lostACall(a: Attempt): boolean {
  if (a.format !== undefined || a.simulated || a.failedAt === 'model-error') return false;
  const noAnswer = a.finalCode.trim() === '' && !a.turns[a.turns.length - 1]?.truncated;
  const noPlan = condition(a.condition).docs && a.queries.length === 0 && a.latencyMs >= OLD_TIMEOUT_MS;
  return noAnswer || noPlan;
}

/**
 * Reads a results file. The file is never rewritten: a record that lost a call is handed on as
 * the provider error it was, so a report leaves it out and a resumed run makes the attempt again.
 */
export function readAttempts(file: string): Attempt[] {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Attempt)
    .map((a) =>
      lostACall(a)
        ? { ...a, passed: false, failedAt: 'model-error' as const, detail: `a call ran out of time and was recorded as an empty reply (was: ${a.passed ? 'pass' : a.failedAt})` }
        : a,
    );
}

/** Upper bound on model calls for a plan: one per turn, plus the lookup plan in docs conditions. */
export function countCalls(tasks: number, models: number, conditions: ConditionId[], repeats = 1): number {
  let perTask = 0;
  for (const id of conditions) {
    const c = condition(id);
    perTask += 1 + c.maxRepairs + (c.docs ? 1 : 0);
  }
  return tasks * models * perTask * repeats;
}

export async function runPlan(plan: RunPlan): Promise<RunSummary> {
  const log = plan.log ?? (() => {});
  fs.mkdirSync(path.dirname(plan.outFile), { recursive: true });

  // An attempt that ended in a provider error is not "done": it is tried again on resume.
  // With repeats, the file may already hold some of a cell's attempts: only the missing ones run.
  const done = new Map<string, number>();
  let spentBeforeUsd = 0;
  for (const a of readAttempts(plan.outFile)) {
    spentBeforeUsd += a.costUsd;
    if (a.failedAt !== 'model-error') done.set(keyOf(a), (done.get(keyOf(a)) ?? 0) + 1);
  }

  const repeats = Math.max(1, plan.repeats ?? 1);
  const queue: { task: Task; model: Model; conditionId: ConditionId; repeat: number }[] = [];
  for (let repeat = 1; repeat <= repeats; repeat += 1) {
    for (const model of plan.models) {
      for (const conditionId of plan.conditions) {
        for (const task of plan.tasks) queue.push({ task, model, conditionId, repeat });
      }
    }
  }

  const summary: RunSummary = { planned: queue.length, skipped: 0, done: 0, passed: 0, modelErrors: 0, spentUsd: 0, spentBeforeUsd, stoppedAtBudget: false };
  const search = docSearch();
  let next = 0;
  let consecutiveErrors = 0;

  const worker = async (): Promise<void> => {
    for (;;) {
      const job = queue[next];
      next += 1;
      if (!job) return;
      if (job.repeat <= (done.get(keyOf({ task: job.task.id, model: job.model.id, condition: job.conditionId })) ?? 0)) {
        summary.skipped += 1;
        continue;
      }
      if (summary.spentBeforeUsd + summary.spentUsd >= plan.maxUsd) {
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
      log(`${outcome.padEnd(11)} ${attempt.model}  ${attempt.condition.padEnd(5)}  ${attempt.task}  turns=${attempt.turns.length}  $${(summary.spentBeforeUsd + summary.spentUsd).toFixed(4)}${attempt.failedAt === 'model-error' ? `  ${attempt.detail}` : ''}`);
    }
  };

  await Promise.all(Array.from({ length: Math.max(1, plan.concurrency) }, worker));
  return summary;
}
