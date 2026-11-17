import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { Attempt } from '../src/agent/attempt.ts';
import { simulatedModel, type Model } from '../src/agent/model.ts';
import { passRateChart } from '../src/eval/chart.ts';
import { report, wilson } from '../src/eval/report.ts';
import { rejudge } from '../src/eval/rejudge.ts';
import { countCalls, countCallsOf, counted, jobsOf, lostACall, madeAgainBy, parseRedo, readAttempts, redoReasons, runPlan } from '../src/eval/run.ts';
import { loadTask, loadTasks, readSolution, tasksDir } from '../src/tasks.ts';
import { JUDGE_VERSION } from '../src/judge/judge.ts';
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

test('the spending cap counts what the results file already holds', async () => {
  const outFile = tempFile();
  const plan = { tasks, models: [priced], conditions: ['bare' as const, 'rules' as const, 'loop' as const], outFile, concurrency: 1 };
  const first = await runPlan({ ...plan, maxUsd: 0.25 });
  assert.equal(first.done, 3);

  const again = await runPlan({ ...plan, maxUsd: 0.25 });
  assert.deepEqual({ done: again.done, stopped: again.stoppedAtBudget }, { done: 0, stopped: true });
  assert.ok(Math.abs(again.spentBeforeUsd - 0.3) < 1e-9);

  const more = await runPlan({ ...plan, maxUsd: 0.45 });
  assert.deepEqual({ done: more.done, skipped: more.skipped, stopped: more.stoppedAtBudget }, { done: 2, skipped: 3, stopped: true });
});

test('an old record that lost a call to the time limit is read as a provider error and attempted again', async () => {
  const outFile = tempFile();
  const old = (over: Partial<Attempt>): Attempt => ({
    task: 'L01-total-by-category',
    kind: 'logic',
    model: 'priced',
    condition: 'bare',
    simulated: false,
    startedAt: '2026-11-16T16:44:49.000Z',
    passed: false,
    failedAt: 'behaviour',
    detail: "SyntaxError: The requested module './solution.mjs' does not provide an export named 'totalByCategory'",
    turns: [{ errorCodes: [], fenced: false }],
    queries: [],
    calls: 1,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    latencyMs: 120010,
    finalCode: '\n',
    ...over,
  });
  const answered = { passed: true, failedAt: 'none' as const, detail: '', finalCode: 'export const x: number = 1;\n' };
  const lines = [
    old({}), // the answer never arrived
    old({ condition: 'rules', failedAt: 'truncated', turns: [{ errorCodes: [], fenced: false, truncated: true }], outputTokens: 16000, latencyMs: 50000 }), // cut off: a result
    old({ condition: 'docs', ...answered, calls: 2, latencyMs: 201081 }), // the lookup plan never arrived
    old({ condition: 'full', ...answered, calls: 2, latencyMs: 6508 }), // the model asked for nothing: a result
    old({ condition: 'loop', format: 2 }), // written by the client that refuses an empty reply
  ];
  fs.writeFileSync(outFile, lines.map((a) => `${JSON.stringify(a)}\n`).join(''));

  assert.deepEqual(lines.map(lostACall), [true, false, true, false, false]);
  const read = readAttempts(outFile);
  assert.deepEqual(read.map((a) => a.failedAt), ['model-error', 'truncated', 'model-error', 'none', 'behaviour']);
  assert.match(read[2]!.detail, /was: pass/);
  assert.match(report(read), /3 attempts, .* 2 attempt\(s\) ended in a provider error and are not counted\./);

  const logic = [tasks[0]!];
  const resumed = await runPlan({ tasks: logic, models: [priced], conditions: ['bare', 'rules', 'docs', 'full', 'loop'], outFile, maxUsd: 100, concurrency: 1 });
  assert.deepEqual({ done: resumed.done, skipped: resumed.skipped }, { done: 2, skipped: 3 });
  assert.equal(readAttempts(outFile).filter((a) => a.format === 2 && a.passed).length, 2);
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

  assert.deepEqual(failed.stoppedModels, ['flaky']);

  healthy = true;
  const retried = await runPlan({ tasks, models: [flaky], conditions: ['bare'], outFile, maxUsd: 100, concurrency: 1 });
  assert.equal(retried.done, 2);
  assert.equal(retried.passed, 2);
});

test('a model that keeps failing is given up on, and the other models carry on', async () => {
  const dead: Model = {
    id: 'dead',
    simulated: false,
    complete: async () => {
      throw new Error('OpenRouter 404 for dead: No endpoints found');
    },
  };
  const many = Array.from({ length: 5 }, () => tasks).flat();
  const summary = await runPlan({ tasks: many, models: [dead, priced], conditions: ['bare'], outFile: tempFile(), maxUsd: 100, concurrency: 1 });
  assert.deepEqual(summary.stoppedModels, ['dead']);
  assert.deepEqual({ errors: summary.modelErrors, passed: summary.passed, done: summary.done }, { errors: 6, passed: 10, done: 16 });
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

test('the cost table counts what attempts that ended in a provider error spent', () => {
  const text = report([
    attempt({}),
    attempt({ task: 'L02-x', passed: false, failedAt: 'model-error', detail: 'OpenRouter 503', calls: 2, inputTokens: 300, outputTokens: 20, costUsd: 0.03 }),
    attempt({ model: 'vendor/down', passed: false, failedAt: 'model-error', detail: 'OpenRouter 503', calls: 1, inputTokens: 40, outputTokens: 0, costUsd: 0.002 }),
  ]);
  // The pass rate still leaves the errors out...
  assert.match(text, /\| vendor\/model \| 100% \(1\/1, 21-100\) \|/);
  // ...and the money does not: 1 + 2 calls, 0.01 + 0.03 USD, all of it carried by the one passed task.
  assert.match(text, /\| vendor\/model \| bare \| 3 \| 400 \| 70 \| 0\.0400 \| 0\.0400 \|/);
  // A model with nothing but errors has no pass rate, and still has a cost.
  assert.match(text, /\| vendor\/down \| bare \| 1 \| 40 \| 0 \| 0\.0020 \| - \|/);
  assert.match(text, /include the attempts that ended in a provider error/);
});

test('repeats run each cell several times, and a second run adds only what is missing', async () => {
  const outFile = tempFile();
  const plan = { tasks, models: [simulatedModel('sim:reference')], conditions: ['bare' as const], outFile, maxUsd: 100, concurrency: 2 };
  const once = await runPlan(plan);
  assert.equal(once.done, 2);
  const thrice = await runPlan({ ...plan, repeats: 3 });
  assert.equal(thrice.skipped, 2);
  assert.equal(thrice.done, 4);
  assert.equal(readAttempts(outFile).length, 6);
  assert.equal((await runPlan({ ...plan, repeats: 3 })).done, 0);
  assert.equal(countCalls(2, 1, ['bare'], 3), 6);
});

test('the report compares each condition with bare task by task', () => {
  const text = report([
    attempt({ task: 'L01-a', passed: false, failedAt: 'static' }),
    attempt({ task: 'L02-b' }),
    attempt({ task: 'L03-c' }),
    attempt({ task: 'L01-a', condition: 'loop' }),
    attempt({ task: 'L02-b', condition: 'loop', passed: false, failedAt: 'behaviour' }),
    attempt({ task: 'L03-c', condition: 'loop' }),
  ]);
  // Both cells are 2 of 3, and the table shows that they are not the same 2.
  assert.match(text, /\| vendor\/model \| loop \| 3 \| 1 \| 1 \| 1 \|/);
});

test('the report shows cut-off answers in their own column and keeps their errors out of the error table', () => {
  const text = report([
    attempt({}),
    attempt({ task: 'L02-x', passed: false, failedAt: 'truncated', turns: [{ errorCodes: ['TS1005'], fenced: false, truncated: true }] }),
  ]);
  assert.match(text, /1 attempt\(s\) were cut off at the output limit/);
  assert.match(text, /\| bare \| 0 \| 0 \| 0 \| 1 \|/);
  assert.match(text, /50% \(1\/2/);
  assert.doesNotMatch(text, /TS1005/);
});

test('--redo takes cut-off and code:<code>, and nothing else', () => {
  assert.deepEqual(parseRedo(['cut-off', 'code:arkui-only-ui-syntax', 'cut-off']), ['cut-off', 'code:arkui-only-ui-syntax']);
  assert.deepEqual(parseRedo([]), []);
  assert.throws(() => parseRedo(['everything']), /does not know "everything"/);
  assert.throws(() => parseRedo(['code:']), /does not know/);
});

test('an attempt is made again only for what was wrong with the harness when it was made', () => {
  const cut = attempt({ passed: false, failedAt: 'truncated', turns: [{ errorCodes: [], fenced: false, truncated: true }] });
  const at = (maxOutputTokens: number) => ({ maxOutputTokens });
  // Records of the first full evaluation do not say their limit: it was 16000.
  assert.deepEqual(redoReasons(cut, ['cut-off'], at(48_000)), ['cut-off']);
  assert.deepEqual(redoReasons(cut, ['cut-off'], at(16_000)), []);
  // Cut off again at the higher limit: that is the model's answer to it, and it stands.
  assert.deepEqual(redoReasons({ ...cut, maxOutputTokens: 48_000 }, ['cut-off'], at(48_000)), []);
  assert.deepEqual(redoReasons({ ...cut, maxOutputTokens: 32_768 }, ['cut-off'], at(48_000)), ['cut-off']);
  // A stand-in has no limit to raise.
  assert.deepEqual(redoReasons(cut, ['cut-off'], {}), []);
  // An earlier answer was cut off and the last one was whole: the verdict is about the whole one.
  const repaired = attempt({ condition: 'loop', turns: [{ errorCodes: [], fenced: false, truncated: true }, { errorCodes: [], fenced: true }] });
  assert.deepEqual(redoReasons(repaired, ['cut-off'], at(48_000)), []);

  const flagged = attempt({ condition: 'loop', turns: [{ errorCodes: ['arkui-only-ui-syntax', 'TS2339'], fenced: true }, { errorCodes: [], fenced: true }] });
  const wanted = ['cut-off', 'code:arkui-only-ui-syntax'];
  assert.deepEqual(redoReasons(flagged, wanted, at(48_000)), ['code:arkui-only-ui-syntax']);
  assert.deepEqual(redoReasons(flagged, ['code:TS9999'], at(48_000)), []);
  // The current judge reported it: there is nothing to take back.
  assert.deepEqual(redoReasons({ ...flagged, judge: JUDGE_VERSION }, wanted, at(48_000)), []);
});

test('a redo run makes the affected attempts again, marks them, and a second run has nothing left to do', async () => {
  const outFile = tempFile();
  const [logic, page] = tasks as [(typeof tasks)[number], (typeof tasks)[number]];
  const earlier = (over: Partial<Attempt>): Attempt => attempt({ model: 'limited', startedAt: '2026-11-16T17:00:00.000Z', finalCode: 'let n: number = 1;\n', ...over });
  const lines = [
    earlier({ task: logic.id, passed: false, failedAt: 'truncated', turns: [{ errorCodes: [], fenced: false, truncated: true }], outputTokens: 16000, costUsd: 0.2 }),
    earlier({ task: page.id, kind: 'ui', passed: false, failedAt: 'static', turns: [{ errorCodes: ['arkui-only-ui-syntax'], fenced: true }], costUsd: 0.1 }),
    earlier({ task: logic.id, condition: 'rules', costUsd: 0.1 }), // nothing wrong with this one
    earlier({ task: page.id, kind: 'ui', condition: 'rules', passed: false, failedAt: 'model-error', detail: 'OpenRouter 503', costUsd: 0 }), // never done
  ];
  fs.writeFileSync(outFile, lines.map((a) => `${JSON.stringify(a)}\n`).join(''));

  const limited: Model = { ...priced, id: 'limited', maxOutputTokens: 48_000 };
  const plan = { tasks, models: [limited], conditions: ['bare' as const, 'rules' as const], outFile, maxUsd: 100, concurrency: 1, redo: ['cut-off', 'code:arkui-only-ui-syntax'] };

  const { jobs, skipped } = jobsOf(plan, readAttempts(outFile));
  assert.deepEqual(jobs.map((j) => [j.conditionId, j.task.id, j.redo]), [
    ['bare', logic.id, ['cut-off']],
    ['bare', page.id, ['code:arkui-only-ui-syntax']],
    ['rules', page.id, undefined],
  ]);
  assert.equal(skipped, 1);
  assert.deepEqual(madeAgainBy(jobs), { 'cut-off': 1, 'code:arkui-only-ui-syntax': 1 });
  assert.equal(countCallsOf(jobs), 3);

  const first = await runPlan(plan);
  assert.deepEqual({ done: first.done, passed: first.passed, skipped: first.skipped, again: first.madeAgain }, { done: 3, passed: 3, skipped: 1, again: { 'cut-off': 1, 'code:arkui-only-ui-syntax': 1 } });
  // The cap saw what the file already held.
  assert.ok(Math.abs(first.spentBeforeUsd - 0.4) < 1e-9);

  // Nothing was rewritten: the old lines are there, and the new ones say what they stand in for.
  const all = readAttempts(outFile);
  assert.equal(all.length, 7);
  assert.deepEqual(all.slice(0, 4).map((a) => a.startedAt), lines.map((a) => a.startedAt));
  assert.deepEqual(all.slice(4).map((a) => a.redo), [['cut-off'], ['code:arkui-only-ui-syntax'], undefined]);
  assert.deepEqual(all.slice(4).map((a) => a.maxOutputTokens), [48_000, 48_000, 48_000]);

  // A report counts one attempt per cell: the one made again, not the one it stands in for.
  assert.equal(counted(all).length, 4);
  const text = report(all);
  assert.match(text, /4 attempts, 2 tasks, 1 model\(s\)/);
  assert.match(text, /2 attempt\(s\) were made again and are counted in place of 2 earlier one\(s\), which stay in the file: 1 for `code:arkui-only-ui-syntax`, 1 for `cut-off`\./);
  assert.match(text, /\| limited \| 100% \(2\/2, 34-100\) \| 100% \(2\/2, 34-100\) \|/);
  assert.doesNotMatch(text, /were cut off at the output limit/);
  assert.match(text, /Output limit per call, in tokens: 48000 \(3 attempt\(s\)\), not recorded \(1 attempt\(s\)\)\./);
  // The money of the attempts that no longer count was still spent: 0.4 in the file before, 0.3 now.
  assert.match(text, /\| limited \| bare \| 4 \| .* \| 0\.5000 \| 0\.2500 \|/);
  assert.match(text, /include the attempts that ended in a provider error or were made again later/);

  const second = await runPlan(plan);
  assert.deepEqual({ done: second.done, skipped: second.skipped }, { done: 0, skipped: 4 });
});

test('a redo stands in for an attempt of its own file, whichever order the files are reported in', () => {
  const write = (lines: Attempt[]): string => {
    const file = tempFile();
    fs.writeFileSync(file, lines.map((a) => `${JSON.stringify(a)}\n`).join(''));
    return file;
  };
  const answered = { finalCode: 'let n: number = 1;\n' };
  const cut = attempt({ ...answered, passed: false, failedAt: 'truncated', turns: [{ errorCodes: [], fenced: false, truncated: true }] });
  // Two runs of the same cell: one attempt in the first file, an attempt and its redo in the second.
  const one = write([attempt({ ...answered, format: 2 })]);
  const two = write([{ ...cut, format: 2 }, attempt({ ...answered, format: 2, redo: ['cut-off'], maxOutputTokens: 48_000 })]);

  assert.deepEqual(readAttempts(two).map((a) => a.replaced), [true, undefined]);
  for (const files of [[one, two], [two, one]]) {
    const all = files.flatMap(readAttempts);
    assert.equal(counted(all).length, 2);
    assert.match(report(all), /\| vendor\/model \| 100% \(2\/2, 34-100\) \|/);
    assert.match(report(all), /1 attempt\(s\) were made again and are counted in place of 1 earlier one\(s\)/);
  }
});

test('a redo and repeats do not go together', async () => {
  const outFile = tempFile();
  const base = { tasks, models: [{ ...priced, maxOutputTokens: 48_000 }], conditions: ['bare' as const], outFile, maxUsd: 100, concurrency: 1 };
  await assert.rejects(runPlan({ ...base, repeats: 2, redo: ['cut-off'] }), /--redo and --repeats do not go together/);

  // A file that already holds repeats has no single attempt for a new one to stand in for.
  const cut = attempt({ model: 'priced', passed: false, failedAt: 'truncated', turns: [{ errorCodes: [], fenced: false, truncated: true }] });
  fs.writeFileSync(outFile, `${JSON.stringify(cut)}\n${JSON.stringify(cut)}\n`);
  await assert.rejects(runPlan({ ...base, redo: ['cut-off'] }), /needs one attempt per cell/);
});

test('the loop table does not call a cut-off answer clean', () => {
  const text = report([
    attempt({ condition: 'loop', passed: false, failedAt: 'truncated', turns: [{ errorCodes: [], fenced: false, truncated: true }] }),
    attempt({ task: 'L02-x', condition: 'loop' }),
  ]);
  // Half a file with no checker errors in it was counted as clean before.
  assert.match(text, /\| vendor\/model \| loop \| 1\/2 \| 1\/2 \| 50% \(1\/2/);
});

test('judging the recorded answers again reproduces the verdicts, and says which do not hold', () => {
  const [logic, page] = tasks as [(typeof tasks)[number], (typeof tasks)[number]];
  const right = readSolution(logic, 'reference');
  const wrong = readSolution(logic, 'trap');
  const recorded = [
    attempt({ task: logic.id, finalCode: right }),
    attempt({ task: logic.id, condition: 'rules', passed: false, failedAt: 'static', finalCode: wrong }),
    attempt({ task: logic.id, condition: 'docs', passed: false, failedAt: 'truncated', finalCode: right.slice(0, 40) }),
    attempt({ task: page.id, kind: 'ui', condition: 'loop', passed: false, failedAt: 'model-error', finalCode: '' }), // not counted, not judged
  ];
  assert.deepEqual(rejudge(recorded, tasks), { checked: 3, differences: [] });

  // An earlier judge failed this answer, and the record says so: the judge of today disagrees.
  const stale = [attempt({ task: logic.id, passed: false, failedAt: 'static', finalCode: right }), attempt({ task: 'L99-gone', finalCode: right })];
  const { checked, differences } = rejudge(stale, tasks);
  assert.equal(checked, 2);
  assert.match(differences[0]!, /vendor\/model {2}bare {2}L01-total-by-category: was static, now pass/);
  assert.match(differences[1]!, /L99-gone: no task with this id any more/);
});

test('the chart draws one bar per cell from the same counts as the report', () => {
  const rows = [
    attempt({ task: 'L01-a' }),
    attempt({ task: 'L02-b', passed: false, failedAt: 'static' }),
    attempt({ task: 'L01-a', condition: 'loop' }),
    attempt({ task: 'L02-b', condition: 'loop' }),
    attempt({ task: 'L03-c', condition: 'loop', passed: false, failedAt: 'model-error' }), // not counted
    attempt({ task: 'L01-a', model: 'vendor/<other>', passed: false, failedAt: 'behaviour' }),
  ];
  const svg = passRateChart(rows);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /5 attempts on 2 tasks/);
  // The label of each bar is the cell of the report's table.
  assert.match(svg, /<title>vendor\/model, bare: 50% \(1\/2\), 95 % interval 9-91%<\/title>/);
  assert.match(svg, /<title>vendor\/model, loop: 100% \(2\/2\), 95 % interval 34-100%<\/title>/);
  assert.match(svg, /<title>vendor\/&lt;other&gt;, bare: 0% \(0\/1\), 95 % interval 0-79%<\/title>/);
  // A rate of zero has an interval and no bar; a cell with no attempts has neither.
  assert.equal(svg.match(/<path d="M[^"]*Z" fill=/g)?.length, 2);
  assert.equal(svg.match(/<title>vendor/g)?.length, 3);
  assert.equal(passRateChart(rows), svg);
  assert.match(passRateChart([attempt({ simulated: true, model: 'sim:reference' })]), /Simulated run/);
});

test('harder tasks get their own rows, and a file without them has no such table', () => {
  const mixed = report([attempt({}), attempt({ task: 'H01-x', passed: false, failedAt: 'static' })]);
  assert.match(mixed, /\| L \(core logic\) \| 100% \(1\/1/);
  assert.match(mixed, /\| H \(harder, added later\) \| 0% \(0\/1/);
  assert.doesNotMatch(report([attempt({})]), /Pass rate by task set/);
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
