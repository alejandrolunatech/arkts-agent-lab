import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { runAttempt } from '../src/agent/attempt.ts';
import {
  condition,
  CONDITION_IDS,
  extractCode,
  feedbackPrompt,
  lookUp,
  parseQueries,
  queriesFromFindings,
  systemPrompt,
  taskPrompt,
} from '../src/agent/conditions.ts';
import { DocSearch, docSearch, tokenize } from '../src/agent/docs.ts';
import { DEFAULT_MAX_OUTPUT_TOKENS, DEFAULT_TIMEOUT_MS, openRouterModel, outputLimits, readStream, simulatedModel, spentBy, timeoutFor, type Model } from '../src/agent/model.ts';
import type { Finding } from '../src/judge/check.ts';
import { JUDGE_VERSION } from '../src/judge/judge.ts';
import { loadTask, readSolution, tasksDir } from '../src/tasks.ts';

const logic = loadTask(path.join(tasksDir, 'L01-total-by-category'));
const ui = loadTask(path.join(tasksDir, 'U01-counter-page'));

const finding = (code: string, message: string): Finding => ({ layer: 'type', code, severity: 'error', file: 'solution.ets', line: 3, column: 5, message });

test('each condition adds exactly one thing over bare, and full adds all', () => {
  assert.deepEqual(condition('bare'), { id: 'bare', rules: false, docs: false, maxRepairs: 0 });
  assert.deepEqual(condition('rules'), { id: 'rules', rules: true, docs: false, maxRepairs: 0 });
  assert.deepEqual(condition('docs'), { id: 'docs', rules: false, docs: true, maxRepairs: 0 });
  assert.deepEqual(condition('loop'), { id: 'loop', rules: false, docs: false, maxRepairs: 3 });
  assert.deepEqual(condition('full'), { id: 'full', rules: true, docs: true, maxRepairs: 3 });
  assert.equal(CONDITION_IDS.length, 5);
});

test('only the rules conditions put the rule sheet in the system prompt', () => {
  assert.doesNotMatch(systemPrompt(condition('bare')), /arkts-no-any-unknown/);
  assert.match(systemPrompt(condition('rules')), /arkts-no-any-unknown/);
});

test('logic prompts say the file must be self-contained; UI prompts do not', () => {
  assert.match(taskPrompt(logic, ''), /must not import anything/);
  assert.doesNotMatch(taskPrompt(ui, ''), /must not import anything/);
  assert.match(taskPrompt(ui, 'function pushUrl(): void;'), /API reference[\s\S]*pushUrl/);
});

test('code is taken from the first fenced block, even when the reply is cut off', () => {
  assert.deepEqual(extractCode('Sure.\n```ets\nlet a = 1;\n```\nDone.'), { code: 'let a = 1;\n', fenced: true });
  assert.deepEqual(extractCode('```typescript\nlet a = 1;\n```\n```\nother\n```'), { code: 'let a = 1;\n', fenced: true });
  assert.deepEqual(extractCode('```ets\nlet a = 1;\nlet b ='), { code: 'let a = 1;\nlet b =\n', fenced: false });
  assert.deepEqual(extractCode('let a = 1;'), { code: 'let a = 1;\n', fenced: false });
});

test('the lookup plan becomes at most six clean queries', () => {
  assert.deepEqual(parseQueries('1. router pushUrl\n- `TextInput type`\n\n* "promptAction showToast"\n'), [
    'router pushUrl',
    'TextInput type',
    'promptAction showToast',
  ]);
  assert.equal(parseQueries(Array.from({ length: 9 }, (_, i) => `query ${i}`).join('\n')).length, 6);
});

test('feedback lists checker errors and nothing about the hidden tests', () => {
  const text = feedbackPrompt([finding('TS2339', "Property 'fontColour' does not exist on type 'TextAttribute'.")], '');
  assert.match(text, /line 3, column 5: \[TS2339\]/);
  assert.doesNotMatch(text, /test/i);
  assert.deepEqual(queriesFromFindings([finding('TS2339', "Property 'fontColour' does not exist on type 'TextAttribute'.")]), [
    'fontColour TextAttribute',
  ]);
});

test('identifiers are split so that pushUrl matches push and url', () => {
  assert.deepEqual(tokenize('router.pushUrl'), ['router', 'push', 'url', 'pushurl']);
});

test('search ranks a symbol-name hit first and respects the budget', () => {
  const search = new DocSearch([
    { module: '@ohos.router', symbol: 'router.pushUrl', text: 'function pushUrl(options: RouterOptions): Promise<void>;' },
    { module: '@ohos.usb', symbol: 'usb.USBDevice', text: 'interface USBDevice { productId: number; url: string }' },
    { module: '@kit.ArkUI', symbol: '@kit.ArkUI', text: "import { router, promptAction } from '@kit.ArkUI';" },
  ]);
  const hits = search.search('router pushUrl');
  assert.equal(hits[0]?.symbol, 'router.pushUrl');
  assert.match(search.format([hits[0]!]), /import \{ router \} from '@kit.ArkUI'/);
  assert.equal(search.search('router pushUrl', 10).length, 0);
});

test('the real SDK index finds the navigation API from a query a model would write', () => {
  const text = lookUp(docSearch(), ['router pushUrl']);
  assert.match(text, /pushUrl\(options: RouterOptions/);
  assert.match(text, /@kit\.ArkUI/);
});

test('a stand-in that learns from feedback fails without the loop and passes with it', async () => {
  const search = docSearch();
  const bare = await runAttempt(logic, simulatedModel('sim:learner'), condition('bare'), search);
  assert.equal(bare.passed, false);
  assert.equal(bare.failedAt, 'static');
  assert.equal(bare.turns.length, 1);
  assert.equal(bare.simulated, true);

  const loop = await runAttempt(logic, simulatedModel('sim:learner'), condition('loop'), search);
  assert.equal(loop.passed, true);
  assert.equal(loop.turns.length, 2);
  assert.ok(loop.turns[0]!.errorCodes.length > 0);
  assert.deepEqual(loop.turns[1]!.errorCodes, []);
  assert.equal(loop.calls, 2);
});

test('the loop stops after three repairs and a docs condition makes one extra call', async () => {
  const stuck = await runAttempt(ui, simulatedModel('sim:trap'), condition('full'), docSearch());
  assert.equal(stuck.passed, false);
  assert.equal(stuck.turns.length, 4);
  assert.equal(stuck.calls, 5);
});

test('a provider failure is recorded apart from a wrong answer', async () => {
  const broken: Model = {
    id: 'broken',
    simulated: false,
    complete: async () => {
      throw new Error('OpenRouter 503 for broken: overloaded');
    },
  };
  const attempt = await runAttempt(logic, broken, condition('bare'), docSearch());
  assert.equal(attempt.failedAt, 'model-error');
  assert.equal(attempt.passed, false);
  assert.match(attempt.detail, /503/);
});

test('an answer cut off at the output limit fails under its own name, not as an ArkTS error', async () => {
  const half = readSolution(logic, 'reference').slice(0, 60);
  const cut: Model = {
    id: 'cut',
    simulated: false,
    complete: async () => ({ text: `\`\`\`ets\n${half}`, inputTokens: 10, outputTokens: 16000, costUsd: 0.01, latencyMs: 1, truncated: true }),
  };
  const attempt = await runAttempt(logic, cut, condition('bare'), docSearch());
  assert.equal(attempt.passed, false);
  assert.equal(attempt.failedAt, 'truncated');
  assert.equal(attempt.turns[0]?.truncated, true);
  assert.match(attempt.detail, /cut off at the output limit/);

  // A complete answer is judged as usual, and its turn carries no flag.
  const whole = await runAttempt(logic, simulatedModel('sim:reference'), condition('bare'), docSearch());
  assert.equal(whole.passed, true);
  assert.equal('truncated' in whole.turns[0]!, false);
});

test('the OpenRouter client reports an answer that stopped at the output limit', async () => {
  let sent: { max_tokens: number } | undefined;
  const respond = (finish: string) =>
    (async (_url: string | URL | Request, init?: RequestInit) => {
      sent = JSON.parse(String(init?.body));
      const content = finish === 'length' ? '' : 'done';
      return new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: finish }], usage: { completion_tokens: 16000, cost: 0.01 } }));
    }) as typeof fetch;
  const ask = (finish: string) => openRouterModel('vendor/model', { apiKey: 'sk-secret', fetchImpl: respond(finish) }).complete([{ role: 'user', content: 'x' }], logic);
  assert.equal((await ask('length')).truncated, true);
  assert.equal(sent?.max_tokens, 16000);
  assert.equal((await ask('stop')).truncated, false);
});

test('a call that times out, cannot be read or comes back empty is a provider failure, tried twice', async () => {
  const ask = (fetchImpl: typeof fetch) =>
    openRouterModel('vendor/model', { apiKey: 'sk-secret', fetchImpl, retryDelayMs: 0 }).complete([{ role: 'user', content: 'x' }], logic);
  const good = JSON.stringify({ choices: [{ message: { content: 'hi' }, finish_reason: 'stop' }], usage: { cost: 0.001 } });

  // The provider sends 200 first and the body later: running out of time shows up while the body is read.
  let calls = 0;
  const stalls = (async () => {
    calls += 1;
    const body = new ReadableStream({ start: (c) => c.error(new DOMException('The operation timed out.', 'TimeoutError')) });
    return new Response(body);
  }) as typeof fetch;
  await assert.rejects(ask(stalls), /no complete answer in time/);
  assert.equal(calls, 2);

  calls = 0;
  const emptyThenGood = (async () => {
    calls += 1;
    return new Response(calls === 1 ? JSON.stringify({ choices: [{ message: { content: '' }, finish_reason: 'stop' }] }) : good);
  }) as typeof fetch;
  assert.equal((await ask(emptyThenGood)).text, 'hi');
  assert.equal(calls, 2);

  calls = 0;
  const notJson = (async () => {
    calls += 1;
    return new Response('   ');
  }) as typeof fetch;
  await assert.rejects(ask(notJson), /not JSON/);
  assert.equal(calls, 2);

  calls = 0;
  const busyThenGood = (async () => {
    calls += 1;
    return calls === 1 ? new Response(JSON.stringify({ error: { message: 'overloaded' } }), { status: 503 }) : new Response(good);
  }) as typeof fetch;
  assert.equal((await ask(busyThenGood)).text, 'hi');

  // A wrong model id or a dead key will not get better: one call, no retry.
  calls = 0;
  const denied = (async () => {
    calls += 1;
    return new Response(JSON.stringify({ error: { message: 'No endpoints found' } }), { status: 404 });
  }) as typeof fetch;
  await assert.rejects(ask(denied), /404/);
  assert.equal(calls, 1);
});

const sse = (...chunks: (object | string)[]): string => chunks.map((c) => (typeof c === 'string' ? `${c}\n\n` : `data: ${JSON.stringify(c)}\n\n`)).join('');
const piece = (content: string | null, finish: string | null = null): object => ({ choices: [{ delta: { content }, finish_reason: finish }] });
const usageChunk = (finish: string, cost = 0.002): object => ({ choices: [{ delta: { content: '' }, finish_reason: finish }], usage: { prompt_tokens: 12, completion_tokens: 3, cost } });

test('a streamed answer is put together from its pieces, with its usage, and the keep-alive comments are skipped', async () => {
  let sent: { stream?: boolean } | undefined;
  const streams = (async (_url: string | URL | Request, init?: RequestInit) => {
    sent = JSON.parse(String(init?.body));
    return new Response(sse(': OPENROUTER PROCESSING', piece(null), piece('```ets\n'), ': OPENROUTER PROCESSING', piece('let n: number = 1;\n```', 'stop'), usageChunk('stop'), 'data: [DONE]'));
  }) as typeof fetch;
  const reply = await openRouterModel('vendor/model', { apiKey: 'sk-secret', fetchImpl: streams }).complete([{ role: 'user', content: 'x' }], logic);
  assert.equal(sent?.stream, true);
  assert.equal(reply.text, '```ets\nlet n: number = 1;\n```');
  assert.deepEqual({ in: reply.inputTokens, out: reply.outputTokens, usd: reply.costUsd, truncated: reply.truncated }, { in: 12, out: 3, usd: 0.002, truncated: false });

  // All of the limit went on reasoning: no text at all, and that is a result, not a failure.
  assert.deepEqual(readStream(sse(piece(null), usageChunk('length'), 'data: [DONE]'))?.choices?.[0], { message: { content: '' }, finish_reason: 'length' });
  // Not a stream at all.
  assert.equal(readStream('<html>busy</html>'), undefined);
  assert.equal(readStream('data: {half'), undefined);
});

test('a stream that stops halfway or carries an error is a provider failure, never half an answer', async () => {
  const ask = (body: string) => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return new Response(body);
    }) as typeof fetch;
    const reply = openRouterModel('vendor/model', { apiKey: 'sk-secret', fetchImpl, retryDelayMs: 0 }).complete([{ role: 'user', content: 'x' }], logic);
    return { reply, calls: () => calls };
  };

  // The connection dropped: text so far, no finish reason, no [DONE].
  const dropped = ask(sse(piece('```ets\nlet n: num')));
  await assert.rejects(dropped.reply, /the stream ended before the answer did/);
  assert.equal(dropped.calls(), 2);

  // The upstream provider failed mid-answer: the status is still 200 and the last chunk says so.
  const failed = ask(sse(piece('```ets\n'), { error: { code: 502, message: 'upstream overloaded' }, choices: [{ delta: { content: '' }, finish_reason: 'error' }] }));
  await assert.rejects(failed.reply, /upstream overloaded/);
  assert.equal(failed.calls(), 2);
});

test('an answer that does not say what it cost stops the attempt: the spending cap cannot count it', async () => {
  let calls = 0;
  const silent = (async () => {
    calls += 1;
    return new Response(sse(piece('hi', 'stop'), { choices: [], usage: { prompt_tokens: 5, completion_tokens: 1 } }, 'data: [DONE]'));
  }) as typeof fetch;
  await assert.rejects(
    openRouterModel('vendor/model', { apiKey: 'sk-secret', fetchImpl: silent, retryDelayMs: 0 }).complete([{ role: 'user', content: 'x' }], logic),
    /without its cost/,
  );
  assert.equal(calls, 1);
});

test('what a failed call cost is kept: with the answer that follows, or in the record of the provider error', async () => {
  const empty = JSON.stringify({ choices: [{ message: { content: '' }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 40, cost: 0.03 } });
  const good = JSON.stringify({ choices: [{ message: { content: 'hi' }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 2, cost: 0.01 } });

  let calls = 0;
  const emptyThenGood = (async () => new Response((calls += 1) === 1 ? empty : good)) as typeof fetch;
  const reply = await openRouterModel('vendor/model', { apiKey: 'sk-secret', fetchImpl: emptyThenGood, retryDelayMs: 0 }).complete([{ role: 'user', content: 'x' }], logic);
  assert.deepEqual({ in: reply.inputTokens, out: reply.outputTokens, usd: reply.costUsd }, { in: 200, out: 42, usd: 0.04 });

  const alwaysEmpty = (async () => new Response(empty)) as typeof fetch;
  const model = openRouterModel('vendor/model', { apiKey: 'sk-secret', fetchImpl: alwaysEmpty, retryDelayMs: 0 });
  const error = await model.complete([{ role: 'user', content: 'x' }], logic).then(
    () => undefined,
    (e: unknown) => e,
  );
  assert.deepEqual(spentBy(error), { inputTokens: 200, outputTokens: 80, costUsd: 0.06 });
  assert.deepEqual(spentBy(new Error('something else')), { inputTokens: 0, outputTokens: 0, costUsd: 0 });

  const attempt = await runAttempt(logic, model, condition('bare'), docSearch());
  assert.equal(attempt.failedAt, 'model-error');
  assert.deepEqual({ in: attempt.inputTokens, out: attempt.outputTokens, usd: attempt.costUsd, calls: attempt.calls }, { in: 200, out: 80, usd: 0.06, calls: 0 });
});

test('a higher output limit gets a longer time limit, and no model is asked for more than it can write', () => {
  assert.equal(timeoutFor(DEFAULT_MAX_OUTPUT_TOKENS), DEFAULT_TIMEOUT_MS);
  assert.equal(timeoutFor(48_000), 3 * DEFAULT_TIMEOUT_MS);
  assert.equal(timeoutFor(4_000), DEFAULT_TIMEOUT_MS);

  const listed = [
    { id: 'vendor/small', top_provider: { max_completion_tokens: 32_768 } },
    { id: 'vendor/large', top_provider: { max_completion_tokens: 131_072 } },
    { id: 'vendor/unsaid', top_provider: { max_completion_tokens: null } },
  ];
  const limits = outputLimits(['vendor/small', 'vendor/large', 'vendor/unsaid', 'vendor/unlisted'], 48_000, listed);
  assert.deepEqual([...limits.values()], [32_768, 48_000, 48_000, 48_000]);
  assert.deepEqual([...outputLimits(['vendor/small'], 48_000, undefined).values()], [48_000]);
  assert.equal(openRouterModel('vendor/small', { apiKey: 'sk-secret', maxOutputTokens: 32_768 }).maxOutputTokens, 32_768);
});

test('the attempt record says which judge checked it and what the output limit was', async () => {
  const limited: Model = { ...simulatedModel('sim:reference'), id: 'limited', simulated: false, maxOutputTokens: 48_000 };
  const attempt = await runAttempt(logic, limited, condition('bare'), docSearch(), ['cut-off']);
  assert.deepEqual({ judge: attempt.judge, limit: attempt.maxOutputTokens, redo: attempt.redo }, { judge: JUDGE_VERSION, limit: 48_000, redo: ['cut-off'] });
  const plain = await runAttempt(logic, simulatedModel('sim:reference'), condition('bare'), docSearch());
  assert.equal('maxOutputTokens' in plain || 'redo' in plain || 'planTruncated' in plain, false);

  // A lookup plan that was cut off is marked: the attempt then ran without the API reference it was meant to have.
  let calls = 0;
  const cutPlan: Model = {
    id: 'cut-plan',
    simulated: false,
    complete: async (messages, task) => {
      calls += 1;
      if (calls === 1) return { text: '', inputTokens: 1, outputTokens: 16000, costUsd: 0, latencyMs: 1, truncated: true };
      return simulatedModel('sim:reference').complete(messages, task);
    },
  };
  const noPlan = await runAttempt(logic, cutPlan, condition('docs'), docSearch());
  assert.deepEqual({ planTruncated: noPlan.planTruncated, queries: noPlan.queries, passed: noPlan.passed }, { planTruncated: true, queries: [], passed: true });
});

test('the OpenRouter client sends temperature 0, reads usage and never leaks the key', async () => {
  let sent: { model: string; temperature: number } | undefined;
  const ok = (async (_url: string | URL | Request, init?: RequestInit) => {
    sent = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ choices: [{ message: { content: 'hi' } }], usage: { prompt_tokens: 10, completion_tokens: 2, cost: 0.0003 } }));
  }) as typeof fetch;
  const reply = await openRouterModel('vendor/model', { apiKey: 'sk-secret', fetchImpl: ok }).complete([{ role: 'user', content: 'x' }], logic);
  assert.equal(sent?.model, 'vendor/model');
  assert.equal(sent?.temperature, 0);
  assert.equal(reply.text, 'hi');
  assert.equal(reply.inputTokens, 10);
  assert.equal(reply.costUsd, 0.0003);

  const denied = (async () => new Response(JSON.stringify({ error: { message: 'No endpoints found' } }), { status: 404 })) as typeof fetch;
  await assert.rejects(
    openRouterModel('vendor/missing', { apiKey: 'sk-secret', fetchImpl: denied }).complete([{ role: 'user', content: 'x' }], logic),
    (error: Error) => /404/.test(error.message) && /No endpoints found/.test(error.message) && !error.message.includes('sk-secret'),
  );
});
