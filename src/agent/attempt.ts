// One attempt: one model, one task, one condition, from first prompt to verdict.
// This is the whole "agent": plan a lookup, write, read the checker, repair.

import { errorsOf, type Finding } from '../judge/check.ts';
import { judge, staticCheck } from '../judge/judge.ts';
import type { Task } from '../tasks.ts';
import {
  extractCode,
  feedbackPrompt,
  lookUp,
  parseQueries,
  planPrompt,
  queriesFromFindings,
  systemPrompt,
  taskPrompt,
  type Condition,
} from './conditions.ts';
import type { DocSearch } from './docs.ts';
import type { ChatMessage, Model, ModelReply } from './model.ts';

export interface Turn {
  /** Checker error codes after this turn's answer, one entry per error. */
  errorCodes: string[];
  /** False when the reply had no complete fenced block (often a cut-off answer). */
  fenced: boolean;
}

export interface Attempt {
  task: string;
  kind: Task['kind'];
  model: string;
  condition: Condition['id'];
  simulated: boolean;
  startedAt: string;
  passed: boolean;
  failedAt: 'none' | 'static' | 'behaviour' | 'structure' | 'model-error';
  detail: string;
  /** Turn 0 is the first answer; later turns are repairs. */
  turns: Turn[];
  /** Search queries the model asked for (docs conditions). */
  queries: string[];
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  /** The last answer, kept so that failures can be read afterwards. */
  finalCode: string;
}

export async function runAttempt(task: Task, model: Model, c: Condition, search: DocSearch): Promise<Attempt> {
  const attempt: Attempt = {
    task: task.id,
    kind: task.kind,
    model: model.id,
    condition: c.id,
    simulated: model.simulated,
    startedAt: new Date().toISOString(),
    passed: false,
    failedAt: 'none',
    detail: '',
    turns: [],
    queries: [],
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    latencyMs: 0,
    finalCode: '',
  };

  const call = async (messages: ChatMessage[]): Promise<ModelReply> => {
    const reply = await model.complete(messages, task);
    attempt.calls += 1;
    attempt.inputTokens += reply.inputTokens;
    attempt.outputTokens += reply.outputTokens;
    attempt.costUsd += reply.costUsd;
    attempt.latencyMs += reply.latencyMs;
    return reply;
  };

  try {
    const system: ChatMessage = { role: 'system', content: systemPrompt(c) };

    let apiReference = '';
    if (c.docs) {
      const plan = await call([system, { role: 'user', content: planPrompt(task) }]);
      attempt.queries = parseQueries(plan.text);
      apiReference = lookUp(search, attempt.queries);
    }

    const messages: ChatMessage[] = [system, { role: 'user', content: taskPrompt(task, apiReference) }];

    for (let turn = 0; ; turn += 1) {
      const reply = await call(messages);
      const { code, fenced } = extractCode(reply.text);
      attempt.finalCode = code;

      const errors: Finding[] = errorsOf(staticCheck(code));
      attempt.turns.push({ errorCodes: errors.map((e) => e.code), fenced });

      if (errors.length === 0 || turn >= c.maxRepairs) break;

      const reference = c.docs ? lookUp(search, queriesFromFindings(errors)) : '';
      messages.push({ role: 'assistant', content: reply.text });
      messages.push({ role: 'user', content: feedbackPrompt(errors, reference) });
    }

    const verdict = judge(task, attempt.finalCode);
    attempt.passed = verdict.passed;
    attempt.failedAt = verdict.failedAt;
    attempt.detail = verdict.detail;
  } catch (error) {
    // A provider failure is not a wrong answer. It is recorded apart and can be rerun.
    attempt.failedAt = 'model-error';
    attempt.detail = error instanceof Error ? error.message : String(error);
  }

  return attempt;
}
