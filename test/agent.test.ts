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
import { openRouterModel, simulatedModel, type Model } from '../src/agent/model.ts';
import type { Finding } from '../src/judge/check.ts';
import { loadTask, tasksDir } from '../src/tasks.ts';

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
