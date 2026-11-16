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
  complete(messages: ChatMessage[], task: Task): Promise<ModelReply>;
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Output limit per call. A model that reasons before it answers spends this on the reasoning
 * too: with 4000, the first real run had answers that ended before any code was written.
 */
export const DEFAULT_MAX_OUTPUT_TOKENS = 16_000;

interface OpenRouterResponse {
  choices?: { message?: { content?: string | null }; finish_reason?: string | null }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
  error?: { message?: string; code?: number | string };
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
 * How long one call may take. A reasoning model needs about two minutes to write 16 000 tokens,
 * so the first limit of 120 s cut real answers off at the edge.
 */
export const DEFAULT_TIMEOUT_MS = 300_000;

/** A failure of the provider or the network, not of the model: the same call may work a moment later. */
class RetryableError extends Error {}

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504, 520, 522, 524, 529]);

/** A real model. Temperature 0 so that a rerun is as close to the first run as the provider allows. */
export function openRouterModel(id: string, options: OpenRouterOptions): Model {
  const doFetch = options.fetchImpl ?? fetch;
  const tries = Math.max(1, options.tries ?? 2);

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
          max_tokens: options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
          usage: { include: true },
        }),
        signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      });
      // The provider answers 200 at once and sends the body when the model is done, so a call
      // that runs out of time fails here, while the body is read. That is no answer: taking it
      // for an empty one made the first full run record timeouts as wrong answers.
      raw = await response.text();
    } catch (error) {
      const name = error instanceof Error ? error.name : 'Error';
      const reason = name === 'TimeoutError' || name === 'AbortError' ? 'no complete answer in time' : 'the network call failed';
      throw new RetryableError(`OpenRouter call for ${id} failed: ${reason} (${name})`);
    }
    let body: OpenRouterResponse | undefined;
    try {
      body = JSON.parse(raw) as OpenRouterResponse;
    } catch {
      body = undefined;
    }
    if (!response.ok || body?.error) {
      // The message comes from the provider and names the problem; the key is never in it.
      const message = `OpenRouter ${response.status} for ${id}: ${body?.error?.message ?? 'no error message'}`;
      // An error inside a 200 is the upstream provider failing mid-answer.
      throw RETRYABLE_STATUS.has(response.status) || response.ok ? new RetryableError(message) : new Error(message);
    }
    if (!body) throw new RetryableError(`OpenRouter call for ${id} failed: the answer was not JSON`);
    const text = body.choices?.[0]?.message?.content ?? '';
    const truncated = body.choices?.[0]?.finish_reason === 'length';
    // Cut off before the first word of the answer is a result (the limit went on reasoning). Nothing at all is not.
    if (text.trim() === '' && !truncated) throw new RetryableError(`OpenRouter call for ${id} failed: the reply was empty`);
    return {
      text,
      inputTokens: body.usage?.prompt_tokens ?? 0,
      outputTokens: body.usage?.completion_tokens ?? 0,
      costUsd: body.usage?.cost ?? 0,
      latencyMs: Date.now() - started,
      truncated,
    };
  };

  return {
    id,
    simulated: false,
    async complete(messages) {
      for (let n = 1; ; n += 1) {
        try {
          return await once(messages);
        } catch (error) {
          if (!(error instanceof RetryableError) || n >= tries) throw error;
          await new Promise((resolve) => setTimeout(resolve, options.retryDelayMs ?? 2000));
        }
      }
    },
  };
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
