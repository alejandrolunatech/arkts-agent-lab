// Runs the grid: every task with every model under every condition.
// Results are appended to a JSON Lines file one attempt at a time, so a run can be
// stopped and resumed, and a spending cap stops it before it costs more than agreed.

import fs from 'node:fs';
import path from 'node:path';
import { runAttempt, type Attempt } from '../agent/attempt.ts';
import { condition, type ConditionId } from '../agent/conditions.ts';
import { docSearch } from '../agent/docs.ts';
import { DEFAULT_MAX_OUTPUT_TOKENS, type Model } from '../agent/model.ts';
import { JUDGE_VERSION } from '../judge/judge.ts';
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
  /**
   * Make attempts that are already in the file again, for these reasons (see `redoReasons`).
   * The earlier attempt stays in the file; the new one is marked and counted in its place.
   */
  redo?: string[];
  log?: (line: string) => void;
}

export interface RunSummary {
  planned: number;
  skipped: number;
  done: number;
  passed: number;
  modelErrors: number;
  /** Attempts in the file that this invocation made again, by reason. */
  madeAgain: Record<string, number>;
  /** Models given up on after too many provider errors in a row; their other attempts were left for later. */
  stoppedModels: string[];
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

/**
 * The attempts that a report counts. Provider errors are out. Where an attempt was made again
 * (`redo`), the attempts of that cell from before are out too: they are in the file to be read,
 * and the one made again stands in their place.
 */
export function counted(all: Attempt[]): Attempt[] {
  const lastRedo = new Map<string, number>();
  all.forEach((a, index) => {
    if (a.failedAt !== 'model-error' && a.redo) lastRedo.set(keyOf(a), index);
  });
  return all.filter((a, index) => a.failedAt !== 'model-error' && index >= (lastRedo.get(keyOf(a)) ?? 0));
}

/** The output limit of the calls behind records that do not say theirs: the first full evaluation. */
const OLD_OUTPUT_LIMIT = DEFAULT_MAX_OUTPUT_TOKENS;

const CUT_OFF = 'cut-off';
const CODE = 'code:';

/** Checks the values of `--redo` and returns them without repeats. */
export function parseRedo(values: string[]): string[] {
  for (const value of values) {
    if (value !== CUT_OFF && !(value.startsWith(CODE) && value.length > CODE.length)) {
      throw new Error(`--redo does not know "${value}": use ${CUT_OFF} or ${CODE}<checker code>, for example ${CODE}arkui-only-ui-syntax`);
    }
  }
  return [...new Set(values)];
}

/**
 * Which of the wanted reasons hold for an attempt, given the model that would make it again.
 * Each reason names something that was wrong with the harness when the attempt was made, never
 * with the answer, and it stops holding for the attempt made again, so the same command can be
 * run twice.
 *
 *   cut-off      the attempt failed because its last answer was cut off, at an output limit lower
 *                than the model has now. The limit was the harness's choice, not the model's.
 *   code:<code>  some answer of the attempt got this checker code from an earlier judge than the
 *                current one. For when a fix to the judge changes what that code is reported for:
 *                in a condition with the loop the model was shown the finding, so the attempt
 *                cannot be judged again, only made again.
 */
export function redoReasons(a: Attempt, wanted: string[], model: Pick<Model, 'maxOutputTokens'>): string[] {
  return wanted.filter((reason) => {
    if (reason === CUT_OFF) return a.failedAt === 'truncated' && (a.maxOutputTokens ?? OLD_OUTPUT_LIMIT) < (model.maxOutputTokens ?? 0);
    const code = reason.slice(CODE.length);
    return (a.judge ?? 1) < JUDGE_VERSION && a.turns.some((turn) => turn.errorCodes.includes(code));
  });
}

export interface Job {
  task: Task;
  model: Model;
  conditionId: ConditionId;
  /** Present when the file holds an attempt of this cell that is being made again. */
  redo?: string[];
}

/**
 * What a run still has to do, given what its results file holds. An attempt that ended in a
 * provider error is not done. With repeats, only the missing attempts of a cell are left.
 */
export function jobsOf(plan: Pick<RunPlan, 'tasks' | 'models' | 'conditions' | 'repeats' | 'redo'>, existing: Attempt[]): { jobs: Job[]; skipped: number } {
  const inFile = new Map<string, Attempt[]>();
  for (const a of counted(existing)) inFile.set(keyOf(a), [...(inFile.get(keyOf(a)) ?? []), a]);

  const repeats = Math.max(1, plan.repeats ?? 1);
  const redo = plan.redo ?? [];
  if (redo.length > 0 && repeats > 1) throw new Error('--redo and --repeats do not go together: an attempt made again stands for one earlier attempt');

  const jobs: Job[] = [];
  let skipped = 0;
  for (let repeat = 1; repeat <= repeats; repeat += 1) {
    for (const model of plan.models) {
      for (const conditionId of plan.conditions) {
        for (const task of plan.tasks) {
          const mine = inFile.get(keyOf({ task: task.id, model: model.id, condition: conditionId })) ?? [];
          if (repeat > mine.length) {
            jobs.push({ task, model, conditionId });
            continue;
          }
          const reasons = redo.length > 0 ? redoReasons(mine[mine.length - 1]!, redo, model) : [];
          if (reasons.length === 0) {
            skipped += 1;
            continue;
          }
          if (mine.length > 1) throw new Error(`--redo needs one attempt per cell, and the file holds ${mine.length} of ${task.id} for ${model.id} under ${conditionId}`);
          jobs.push({ task, model, conditionId, redo: reasons });
        }
      }
    }
  }
  return { jobs, skipped };
}

/** How many of the jobs make an earlier attempt again, by reason. A job with two reasons counts under both. */
export function madeAgainBy(jobs: Job[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const job of jobs) for (const reason of job.redo ?? []) counts[reason] = (counts[reason] ?? 0) + 1;
  return counts;
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

/** The same bound for the jobs that are left. */
export function countCallsOf(jobs: Job[]): number {
  return jobs.reduce((calls, job) => calls + countCalls(1, 1, [job.conditionId]), 0);
}

export async function runPlan(plan: RunPlan): Promise<RunSummary> {
  const log = plan.log ?? (() => {});
  fs.mkdirSync(path.dirname(plan.outFile), { recursive: true });

  const existing = readAttempts(plan.outFile);
  const spentBeforeUsd = existing.reduce((usd, a) => usd + a.costUsd, 0);
  const { jobs, skipped } = jobsOf(plan, existing);

  const summary: RunSummary = {
    planned: jobs.length + skipped,
    skipped,
    done: 0,
    passed: 0,
    modelErrors: 0,
    madeAgain: {},
    stoppedModels: [],
    spentUsd: 0,
    spentBeforeUsd,
    stoppedAtBudget: false,
  };
  const search = docSearch();
  let next = 0;
  const errorsInARow = new Map<string, number>();

  const worker = async (): Promise<void> => {
    for (;;) {
      const job = jobs[next];
      next += 1;
      if (!job) return;
      // A wrong model id or a dead key fails every call of that model: leave the rest of its
      // attempts for another day instead of burning through them. The other models carry on.
      if (summary.stoppedModels.includes(job.model.id)) continue;
      if (summary.spentBeforeUsd + summary.spentUsd >= plan.maxUsd) {
        summary.stoppedAtBudget = true;
        return;
      }
      const attempt = await runAttempt(job.task, job.model, condition(job.conditionId), search, job.redo);
      fs.appendFileSync(plan.outFile, `${JSON.stringify(attempt)}\n`);
      summary.done += 1;
      summary.spentUsd += attempt.costUsd;
      if (attempt.passed) summary.passed += 1;
      if (attempt.failedAt === 'model-error') {
        summary.modelErrors += 1;
        const inARow = (errorsInARow.get(attempt.model) ?? 0) + 1;
        errorsInARow.set(attempt.model, inARow);
        if (inARow >= MAX_CONSECUTIVE_ERRORS && !summary.stoppedModels.includes(attempt.model)) {
          summary.stoppedModels.push(attempt.model);
          log(`stopped    ${attempt.model}: ${inARow} provider errors in a row`);
        }
      } else {
        errorsInARow.set(attempt.model, 0);
        for (const reason of attempt.redo ?? []) summary.madeAgain[reason] = (summary.madeAgain[reason] ?? 0) + 1;
      }
      const outcome = attempt.passed ? 'pass' : attempt.failedAt;
      const again = attempt.redo ? `  again (${attempt.redo.join(', ')})` : '';
      log(`${outcome.padEnd(11)} ${attempt.model}  ${attempt.condition.padEnd(5)}  ${attempt.task}  turns=${attempt.turns.length}  $${(summary.spentBeforeUsd + summary.spentUsd).toFixed(4)}${again}${attempt.failedAt === 'model-error' ? `  ${attempt.detail}` : ''}`);
    }
  };

  await Promise.all(Array.from({ length: Math.max(1, plan.concurrency) }, worker));
  return summary;
}
