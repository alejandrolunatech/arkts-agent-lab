// The experiment's independent variable: what the agent is given besides the task.
//
//   bare   the task and nothing else
//   rules  + a one-page sheet of what ArkTS forbids (context/arkts-rules.md)
//   docs   + API signatures the model asks for, found in the HarmonyOS declarations
//   loop   + the checker's findings fed back, up to three repair turns
//   full   rules + docs + loop
//
// Each condition adds exactly one thing over `bare`, so its effect can be read alone.

import fs from 'node:fs';
import path from 'node:path';
import type { Finding } from '../judge/check.ts';
import { repoRoot, type Task } from '../tasks.ts';
import type { DocSearch } from './docs.ts';

export const CONDITION_IDS = ['bare', 'rules', 'docs', 'loop', 'full'] as const;
export type ConditionId = (typeof CONDITION_IDS)[number];

export interface Condition {
  id: ConditionId;
  rules: boolean;
  docs: boolean;
  /** How many times the checker's findings may be sent back. */
  maxRepairs: number;
}

export const MAX_REPAIRS = 3;

export function condition(id: ConditionId): Condition {
  return {
    id,
    rules: id === 'rules' || id === 'full',
    docs: id === 'docs' || id === 'full',
    maxRepairs: id === 'loop' || id === 'full' ? MAX_REPAIRS : 0,
  };
}

export function isConditionId(value: string): value is ConditionId {
  return (CONDITION_IDS as readonly string[]).includes(value);
}

const BASE = `You are an expert HarmonyOS developer. You write ArkTS for the stage model (HarmonyOS NEXT, API 12 or later).
Reply with the complete contents of the file solution.ets in one fenced code block and nothing after it.`;

let cachedRules: string | undefined;

/** The one-page sheet of what ArkTS forbids, as the rules conditions show it. */
export function rulesSheet(): string {
  cachedRules ??= fs.readFileSync(path.join(repoRoot, 'context', 'arkts-rules.md'), 'utf8').trim();
  return cachedRules;
}

export function systemPrompt(c: Condition): string {
  return c.rules ? `${BASE}\n\n${rulesSheet()}` : BASE;
}

/** First message of the docs conditions: the model says what it wants to look up. */
export function planPrompt(task: Task): string {
  return `${taskPrompt(task, '')}

Before writing the file, list what you want to look up in the HarmonyOS API reference.
Reply with at most 6 lines. Each line is one search: the name of a component, module, function, attribute or enum you plan to use (for example "router pushUrl" or "TextInput type"). No other text.`;
}

/** Turns the model's plan into search queries: one per line, bullets and numbering removed. */
export function parseQueries(planText: string): string[] {
  return planText
    .split('\n')
    .map((line) => line.replace(/^[\s\-*\d.)`]+/, '').replace(/[`"]/g, '').trim())
    .filter((line) => line.length > 1 && line.length < 80)
    .slice(0, 6);
}

const DOCS_BUDGET_CHARS = 6000;

export function lookUp(search: DocSearch, queries: string[]): string {
  if (queries.length === 0) return '';
  const perQuery = Math.floor(DOCS_BUDGET_CHARS / queries.length);
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const query of queries) {
    const hits = search.search(query, perQuery, 4).filter((h) => !seen.has(h.text));
    for (const h of hits) seen.add(h.text);
    if (hits.length > 0) parts.push(search.format(hits));
  }
  return parts.join('\n\n');
}

/** Logic tasks are judged by running the code off-device, so they cannot import a HarmonyOS kit. */
const SELF_CONTAINED = 'The file must be self-contained: it must not import anything.';

export function taskPrompt(task: Task, apiReference: string): string {
  const prompt = task.kind === 'logic' ? `${task.prompt}\n\n${SELF_CONTAINED}` : task.prompt;
  if (!apiReference) return prompt;
  return `${prompt}\n\nAPI reference (signatures from the HarmonyOS SDK that may be relevant):\n\n\`\`\`ts\n${apiReference}\n\`\`\``;
}

const MAX_FINDINGS_SHOWN = 15;

/**
 * What the loop sends back: the checker's errors, as an IDE would list them.
 * Never the hidden tests and never the reference solution.
 */
export function feedbackPrompt(errors: Finding[], apiReference: string): string {
  const shown = errors.slice(0, MAX_FINDINGS_SHOWN).map((f) => `line ${f.line}, column ${f.column}: [${f.code}] ${f.message}`);
  const more = errors.length > shown.length ? `\n(and ${errors.length - shown.length} more)` : '';
  const reference = apiReference ? `\n\nAPI reference for the names in these errors:\n\n\`\`\`ts\n${apiReference}\n\`\`\`` : '';
  return `The ArkTS checker reports ${errors.length} error(s) in solution.ets:\n\n${shown.join('\n')}${more}${reference}\n\nFix them and reply with the complete corrected file in one fenced code block.`;
}

/** Names the checker quotes in its messages (`'notAThing'`, `'TextAttribute'`): what to look up after a failure. */
export function queriesFromFindings(errors: Finding[]): string[] {
  const queries = new Set<string>();
  for (const f of errors) {
    const names = [...f.message.matchAll(/'([A-Za-z_][\w.]*)'/g)].map((m) => m[1]!);
    if (names.length > 0) queries.add(names.join(' '));
  }
  return [...queries].slice(0, 4);
}

/** The code inside the first fenced block; the whole reply if there is no fence. */
export function extractCode(replyText: string): { code: string; fenced: boolean } {
  const match = /```[a-zA-Z]*\s*\n([\s\S]*?)```/.exec(replyText);
  if (match) return { code: `${match[1]!.trim()}\n`, fenced: true };
  // A reply cut off by the output limit has an opening fence and no closing one.
  const open = /```[a-zA-Z]*\s*\n([\s\S]*)$/.exec(replyText);
  if (open) return { code: `${open[1]!.trim()}\n`, fenced: false };
  return { code: `${replyText.trim()}\n`, fenced: false };
}
