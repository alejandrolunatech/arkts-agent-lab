import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { Attempt } from '../src/agent/attempt.ts';
import { simulatedModel, type Model } from '../src/agent/model.ts';
import { report, wilson } from '../src/eval/report.ts';
import { countCalls, readAttempts, runPlan } from '../src/eval/run.ts';
import { loadTask, loadTasks, readSolution, tasksDir } from '../src/tasks.ts';
import { verifyTask } from '../src/verify.ts';

const tasks = [loadTask(path.join(tasksDir, 'L01-total-by-category')), loadTask(path.join(tasksDir, 'U01-counter-page'))];
const tempFile = (): string => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'arkts-eval-')), 'out.jsonl');

/** Answers correctly and says each call cost ten cents. */
const priced: Model = {
  id: 'priced',
  simulated: false,
  complete: async (_messages, task) => ({
    text: `\`\`\`ets\n${readSolution(task, 'reference')}\n\`\`\``,
    inputTokens: 100,
    outputTokens: 50,
    costUsd: 0.1,
    latencyMs: 1,
  }),
};

test('the call count is an upper bound: repairs and lookup plans included', () => {
  assert.equal(countCalls(1, 1, ['bare']), 1);
  assert.equal(countCalls(1, 1, ['docs']), 2);
  assert.equal(countCalls(1, 1, ['loop']), 4);
  assert.equal(countCalls(30, 5, ['bare', 'rules', 'docs', 'loop', 'full']), 30 * 5 * 13);
});

test('a run appends one line per attempt and a second run skips what is done', async () => {
  const outFile = tempFile();
  const plan = { tasks, models: [simulatedModel('sim:reference')], conditions: ['bare', 'loop'] as const, outFile, maxUsd: Infinity, concurrency: 2 };
  const first = await runPlan({ ...plan, conditions: [...plan.conditions] });
  assert.deepEqual({ planned: first.planned, done: first.done, passed: first.passed, skipped: first.skipped }, { planned: 4, done: 4, passed: 4, skipped: 0 });
  assert.equal(readAttempts(outFile).length, 4);

  const second = await runPlan({ ...plan, conditions: [...plan.conditions] });
  assert.deepEqual({ done: second.done, skipped: second.skipped }, { done: 0, skipped: 4 });
  assert.equal(readAttempts(outFile).length, 4);
});

test('the spending cap stops the run before the grid is finished', async () => {
  const summary = await runPlan({ tasks, models: [priced], conditions: ['bare', 'rules', 'loop'], outFile: tempFile(), maxUsd: 0.25, concurrency: 1 });
  assert.equal(summary.stoppedAtBudget, true);
  assert.equal(summary.done, 3);
  assert.ok(summary.spentUsd < 0.35);
});

test('a model that always errors stops the run early, and its attempts are retried later', async () => {
  const outFile = tempFile();
  let healthy = false;
  const flaky: Model = {
    id: 'flaky',
    simulated: false,
    complete: async (messages, task) => {
      if (!healthy) throw new Error('OpenRouter 401 for flaky: bad key');
      return priced.complete(messages, task);
    },
  };
  const many = Array.from({ length: 6 }, () => tasks).flat();
  const failed = await runPlan({ tasks: many, models: [flaky], conditions: ['bare'], outFile, maxUsd: 100, concurrency: 1 });
  assert.equal(failed.modelErrors, 6);
  assert.equal(failed.done, 6);

  healthy = true;
  const retried = await runPlan({ tasks, models: [flaky], conditions: ['bare'], outFile, maxUsd: 100, concurrency: 1 });
  assert.equal(retried.done, 2);
  assert.equal(retried.passed, 2);
});

test('the Wilson interval is wide for small samples and never leaves 0 to 100', () => {
  assert.deepEqual(wilson(0, 0), { low: 0, high: 0 });
  assert.deepEqual(wilson(15, 30), { low: 33, high: 67 });
  assert.deepEqual(wilson(30, 30), { low: 89, high: 100 });
  assert.deepEqual(wilson(0, 30), { low: 0, high: 11 });
});

const attempt = (over: Partial<Attempt>): Attempt => ({
  task: 'L01-total-by-category',
  kind: 'logic',
  model: 'vendor/model',
  condition: 'bare',
  simulated: false,
  startedAt: '2026-11-17T10:00:00.000Z',
  passed: true,
  failedAt: 'none',
  detail: '',
  turns: [{ errorCodes: [], fenced: true }],
  queries: [],
  calls: 1,
  inputTokens: 100,
  outputTokens: 50,
  costUsd: 0.01,
  latencyMs: 10,
  finalCode: '',
  ...over,
});

test('the report counts only what is in the file and leaves provider errors out', () => {
  const text = report([
    attempt({}),
    attempt({ task: 'U01-counter-page', kind: 'ui', passed: false, failedAt: 'static', turns: [{ errorCodes: ['TS2339', 'TS2339'], fenced: true }] }),
    attempt({ condition: 'loop', turns: [{ errorCodes: ['arkts-no-var'], fenced: true }, { errorCodes: [], fenced: true }], calls: 2 }),
    attempt({ task: 'L02-x', passed: false, failedAt: 'model-error', detail: 'OpenRouter 503' }),
  ]);
  assert.match(text, /3 attempts, 2 tasks, 1 model\(s\), run on 2026-11-17\. 1 attempt\(s\) ended in a provider error/);
  assert.match(text, /\| vendor\/model \| 50% \(1\/2, 9-91\) \| 100% \(1\/1, 21-100\) \|/);
  assert.match(text, /\| vendor\/model \| loop \| 0\/1 \| 1\/1 \|/);
  assert.match(text, /\| TS2339 \| 1 \|/);
  assert.doesNotMatch(text, /Simulated run/);
});

test('a report with stand-in rows says so at the top', () => {
  assert.match(report([attempt({ simulated: true, model: 'sim:reference' })]), /Simulated run/);
});

test('every task on disk is sound: its reference passes and its trap fails for the stated reason', () => {
  const all = loadTasks();
  assert.ok(all.length >= 2);
  const problems = all.flatMap(verifyTask);
  assert.deepEqual(problems, []);
});
