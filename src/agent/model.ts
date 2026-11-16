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
}

/** A real model. Temperature 0 so that a rerun is as close to the first run as the provider allows. */
export function openRouterModel(id: string, options: OpenRouterOptions): Model {
  const doFetch = options.fetchImpl ?? fetch;
  return {
    id,
    simulated: false,
    async complete(messages) {
      const started = Date.now();
      const response = await doFetch(OPENROUTER_URL, {
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
        signal: AbortSignal.timeout(options.timeoutMs ?? 120_000),
      });
      const body = (await response.json().catch(() => ({}))) as OpenRouterResponse;
      if (!response.ok || body.error) {
        // The message comes from the provider and names the problem; the key is never in it.
        throw new Error(`OpenRouter ${response.status} for ${id}: ${body.error?.message ?? 'no error message'}`);
      }
      return {
        text: body.choices?.[0]?.message?.content ?? '',
        inputTokens: body.usage?.prompt_tokens ?? 0,
        outputTokens: body.usage?.completion_tokens ?? 0,
        costUsd: body.usage?.cost ?? 0,
        latencyMs: Date.now() - started,
        truncated: body.choices?.[0]?.finish_reason === 'length',
      };
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
