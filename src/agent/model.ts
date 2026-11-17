// A model is anything that turns a conversation into a reply.
// Two kinds live here: real models through OpenRouter, and scripted stand-ins
// that make the harness testable without a key, a network or money.

import { readSolution, type Task } from '../tasks.ts';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ModelReply {
  text: string;
  inputTokens: number;
  outputTokens: number;
  /** As reported by the provider; 0 for stand-ins. */
  costUsd: number;
  latencyMs: number;
  /** True when the provider stopped the answer at the output limit. */
  truncated?: boolean;
}

export interface Model {
  id: string;
  /** True for stand-ins. Their results are never reported as model results. */
  simulated: boolean;
  /** Output limit of each call, for the attempt record. Absent for stand-ins, which have none. */
  maxOutputTokens?: number;
  complete(messages: ChatMessage[], task: Task): Promise<ModelReply>;
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Output limit per call. A model that reasons before it answers spends this on the reasoning
 * too: with 4000, the first real run had answers that ended before any code was written.
 */
export const DEFAULT_MAX_OUTPUT_TOKENS = 16_000;

interface OpenRouterUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  cost?: number;
}

interface OpenRouterError {
  message?: string;
  code?: number | string;
}

interface OpenRouterResponse {
  choices?: { message?: { content?: string | null }; finish_reason?: string | null }[];
  usage?: OpenRouterUsage;
  error?: OpenRouterError;
}

interface OpenRouterChunk {
  choices?: { delta?: { content?: string | null }; finish_reason?: string | null }[];
  usage?: OpenRouterUsage;
  error?: OpenRouterError;
}

/**
 * Puts a streamed answer together, in the shape of an answer that came in one piece. The stream
 * is server-sent events: `data: {json}` lines with a piece of text each, comment lines that keep
 * the connection open (`: OPENROUTER PROCESSING`), the usage in a last chunk and `data: [DONE]`.
 *
 * Returns undefined when the text is not such a stream, and an `error` when it stopped before
 * the answer did: half an answer must never be taken for a whole one.
 */
export function readStream(raw: string): OpenRouterResponse | undefined {
  let text = '';
  let finish: string | null | undefined;
  let usage: OpenRouterUsage | undefined;
  let error: OpenRouterError | undefined;
  let chunks = 0;
  let ended = false;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    const payload = line.slice('data:'.length).trim();
    if (payload === '[DONE]') {
      ended = true;
      continue;
    }
    let chunk: OpenRouterChunk;
    try {
      chunk = JSON.parse(payload) as OpenRouterChunk;
    } catch {
      return undefined;
    }
    chunks += 1;
    const choice = chunk.choices?.[0];
    if (typeof choice?.delta?.content === 'string') text += choice.delta.content;
    if (choice?.finish_reason) finish = choice.finish_reason;
    if (chunk.usage) usage = chunk.usage;
    if (chunk.error) error = chunk.error;
  }
  if (chunks === 0) return undefined;
  if (!error && !ended && !finish) error = { message: 'the stream ended before the answer did' };
  return { choices: [{ message: { content: text }, finish_reason: finish ?? null }], ...(usage ? { usage } : {}), ...(error ? { error } : {}) };
}

export interface OpenRouterOptions {
  apiKey: string;
  maxOutputTokens?: number;
  /** Injected in tests. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** How many times a call is made before a provider or network failure is given up on. Default 2. */
  tries?: number;
  retryDelayMs?: number;
}

/**
 * How long one call may take at the default output limit. The slowest answers of the first full
 * evaluation came at about 35 tokens a second, which is 16 000 tokens in under eight minutes;
 * the limits before this one, 120 s and then 300 s, both cut real answers off.
 */
export const DEFAULT_TIMEOUT_MS = 480_000;

/** The time limit grows with the output limit: a call allowed three times the tokens gets three times as long. */
export function timeoutFor(maxOutputTokens: number): number {
  return Math.round(DEFAULT_TIMEOUT_MS * Math.max(1, maxOutputTokens / DEFAULT_MAX_OUTPUT_TOKENS));
}

/** What a call cost, whether or not it gave an answer. */
export interface Spent {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

const NOTHING_SPENT: Spent = { inputTokens: 0, outputTokens: 0, costUsd: 0 };

const add = (a: Spent, b: Spent): Spent => ({
  inputTokens: a.inputTokens + b.inputTokens,
  outputTokens: a.outputTokens + b.outputTokens,
  costUsd: a.costUsd + b.costUsd,
});

/**
 * A call that gave no usable answer. The provider can still have charged for it: an empty reply
 * arrives with its usage, and that money is part of what the run spent.
 */
export class CallError extends Error {
  /** A failure of the provider or the network, not of the request: the same call may work a moment later. */
  readonly retryable: boolean;
  spent: Spent;

  constructor(message: string, retryable: boolean, spent: Spent = NOTHING_SPENT) {
    super(message);
    this.retryable = retryable;
    this.spent = spent;
  }
}

/** What the failed calls behind an error cost; nothing for an error that is not from a call. */
export function spentBy(error: unknown): Spent {
  return error instanceof CallError ? error.spent : NOTHING_SPENT;
}

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504, 520, 522, 524, 529]);

/** A real model. Temperature 0 so that a rerun is as close to the first run as the provider allows. */
export function openRouterModel(id: string, options: OpenRouterOptions): Model {
  const doFetch = options.fetchImpl ?? fetch;
  const tries = Math.max(1, options.tries ?? 2);
  const maxOutputTokens = options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;

  const once = async (messages: ChatMessage[]): Promise<ModelReply> => {
    const started = Date.now();
    let response: Response;
    let raw: string;
    try {
      response = await doFetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
          'X-Title': 'arkts-agent-lab',
        },
        body: JSON.stringify({
          model: id,
          messages,
          temperature: 0,
          max_tokens: maxOutputTokens,
          usage: { include: true },
          // Streamed, for two reasons in OpenRouter's reference (api/reference/streaming): a
          // long answer keeps the connection alive with comment lines, and giving up on a call
          // stops the charge at the providers that support it, where a call that is not
          // streamed is written and charged to the end.
          stream: true,
        }),
        signal: AbortSignal.timeout(options.timeoutMs ?? timeoutFor(maxOutputTokens)),
      });
      // The provider answers 200 as soon as it accepts the request and the answer follows, so a
      // call that runs out of time fails here, while the body is read. That is no answer: taking
      // it for an empty one made the first full run record timeouts as wrong answers.
      raw = await response.text();
    } catch (error) {
      const name = error instanceof Error ? error.name : 'Error';
      const reason = name === 'TimeoutError' || name === 'AbortError' ? 'no complete answer in time' : 'the network call failed';
      throw new CallError(`OpenRouter call for ${id} failed: ${reason} (${name})`, true);
    }
    // A refusal (a wrong model id, a dead key) comes as one JSON object; an answer comes as a stream.
    let body: OpenRouterResponse | undefined;
    try {
      body = JSON.parse(raw) as OpenRouterResponse;
    } catch {
      body = readStream(raw);
    }
    const spent: Spent = {
      inputTokens: body?.usage?.prompt_tokens ?? 0,
      outputTokens: body?.usage?.completion_tokens ?? 0,
      costUsd: body?.usage?.cost ?? 0,
    };
    if (!response.ok || body?.error) {
      // The message comes from the provider and names the problem; the key is never in it.
      const message = `OpenRouter ${response.status} for ${id}: ${body?.error?.message ?? 'no error message'}`;
      // An error inside a 200 is the upstream provider failing mid-answer.
      throw new CallError(message, RETRYABLE_STATUS.has(response.status) || response.ok, spent);
    }
    if (!body) throw new CallError(`OpenRouter call for ${id} failed: the answer was not JSON`, true);
    const text = body.choices?.[0]?.message?.content ?? '';
    const truncated = body.choices?.[0]?.finish_reason === 'length';
    // Cut off before the first word of the answer is a result (the limit went on reasoning). Nothing at all is not.
    if (text.trim() === '' && !truncated) throw new CallError(`OpenRouter call for ${id} failed: the reply was empty`, true, spent);
    // The spending cap counts what the answers say they cost. An answer that does not say is
    // money the cap cannot see, so the attempt stops here, and a model that never says is given up on.
    if (typeof body.usage?.cost !== 'number') throw new CallError(`OpenRouter call for ${id} failed: the answer came without its cost`, false, spent);
    return { text, ...spent, latencyMs: Date.now() - started, truncated };
  };

  return {
    id,
    simulated: false,
    maxOutputTokens,
    async complete(messages) {
      // What the tries that gave no answer cost is kept: it goes with the answer that follows, or with the error.
      let wasted = NOTHING_SPENT;
      for (let n = 1; ; n += 1) {
        try {
          const reply = await once(messages);
          return { ...reply, ...add(reply, wasted) };
        } catch (error) {
          if (error instanceof CallError) {
            wasted = add(wasted, error.spent);
            error.spent = wasted;
          }
          if (!(error instanceof CallError) || !error.retryable || n >= tries) throw error;
          await new Promise((resolve) => setTimeout(resolve, options.retryDelayMs ?? 2000));
        }
      }
    },
  };
}

/** A row of OpenRouter's public model list, as far as the lab reads it. */
export interface ListedModel {
  id: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
  top_provider?: { max_completion_tokens?: number | null };
}

/**
 * The output limit to ask each model for: what was wanted, or less when OpenRouter's public list
 * says the model cannot write that much. Asking for more than a model has is refused, not cut down.
 * Without the list the wanted limit is used as it is.
 */
export function outputLimits(ids: string[], wanted: number, listed: ListedModel[] | undefined): Map<string, number> {
  const limits = new Map<string, number>();
  for (const id of ids) {
    const own = listed?.find((m) => m.id === id)?.top_provider?.max_completion_tokens;
    limits.set(id, typeof own === 'number' && own > 0 ? Math.min(wanted, own) : wanted);
  }
  return limits;
}

function reply(text: string): ModelReply {
  return { text, inputTokens: 0, outputTokens: 0, costUsd: 0, latencyMs: 0 };
}

function fenced(code: string): string {
  return `Here is the file.\n\n\`\`\`ets\n${code.trim()}\n\`\`\`\n`;
}

/**
 * Stand-ins, named by what they do:
 *
 *   sim:reference  always answers with the task's reference solution
 *   sim:trap       always answers with the trap solution
 *   sim:learner    answers with the trap, and with the reference once it has been shown checker feedback
 */
export function simulatedModel(id: string): Model {
  const behaviour = id.replace(/^sim:/, '');
  if (!['reference', 'trap', 'learner'].includes(behaviour)) throw new Error(`unknown stand-in "${id}"`);
  return {
    id,
    simulated: true,
    async complete(messages, task) {
      const sawFeedback = messages.filter((m) => m.role === 'user').length > 1;
      const useReference = behaviour === 'reference' || (behaviour === 'learner' && sawFeedback);
      return reply(fenced(readSolution(task, useReference ? 'reference' : 'trap')));
    },
  };
}

export function isSimulatedId(id: string): boolean {
  return id.startsWith('sim:');
}
