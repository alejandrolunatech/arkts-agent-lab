// Turns a results file into the tables of the findings report.
// Only counts what is in the file: no number here is typed by hand.

import type { Attempt } from '../agent/attempt.ts';
import { CONDITION_IDS, type ConditionId } from '../agent/conditions.ts';

/** 95 % Wilson interval for a proportion, as whole percentages. Honest about small samples. */
export function wilson(passed: number, total: number): { low: number; high: number } {
  if (total === 0) return { low: 0, high: 0 };
  const z = 1.96;
  const p = passed / total;
  const denominator = 1 + (z * z) / total;
  const centre = p + (z * z) / (2 * total);
  const margin = z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total));
  return {
    low: Math.round(Math.max(0, (centre - margin) / denominator) * 100),
    high: Math.round(Math.min(1, (centre + margin) / denominator) * 100),
  };
}

function rate(attempts: Attempt[]): string {
  if (attempts.length === 0) return '-';
  const passed = attempts.filter((a) => a.passed).length;
  const { low, high } = wilson(passed, attempts.length);
  return `${Math.round((passed / attempts.length) * 100)}% (${passed}/${attempts.length}, ${low}-${high})`;
}

function table(header: string[], rows: string[][]): string {
  const line = (cells: string[]): string => `| ${cells.join(' | ')} |`;
  return [line(header), line(header.map(() => '---')), ...rows.map(line)].join('\n');
}

const unique = <T>(values: T[]): T[] => [...new Set(values)];
const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);

export function report(all: Attempt[]): string {
  const simulated = all.some((a) => a.simulated);
  const errors = all.filter((a) => a.failedAt === 'model-error');
  const attempts = all.filter((a) => a.failedAt !== 'model-error');
  const models = unique(attempts.map((a) => a.model));
  const conditions = CONDITION_IDS.filter((c) => attempts.some((a) => a.condition === c));
  const of = (model: string, c: ConditionId): Attempt[] => attempts.filter((a) => a.model === model && a.condition === c);
  const dates = unique(attempts.map((a) => a.startedAt.slice(0, 10))).sort();

  const out: string[] = [];
  out.push('# Results');
  if (simulated) out.push('> **Simulated run.** These rows come from scripted stand-ins, not from models. They test the harness and say nothing about any model.');
  out.push(
    `${attempts.length} attempts, ${unique(attempts.map((a) => a.task)).length} tasks, ${models.length} model(s), run on ${dates.join(', ') || 'no date'}.` +
      (errors.length > 0 ? ` ${errors.length} attempt(s) ended in a provider error and are not counted.` : ''),
  );
  out.push('Each cell: pass rate (passed/attempts, 95 % interval in %).');

  out.push('## Pass rate by model and condition');
  out.push(table(['Model', ...conditions], models.map((m) => [m, ...conditions.map((c) => rate(of(m, c)))])));

  out.push('## Pass rate by kind of task');
  out.push(
    table(
      ['Kind', ...conditions],
      (['logic', 'ui'] as const).map((kind) => [kind, ...conditions.map((c) => rate(attempts.filter((a) => a.kind === kind && a.condition === c)))]),
    ),
  );

  const looped = attempts.filter((a) => a.condition === 'loop' || a.condition === 'full');
  if (looped.length > 0) {
    out.push('## What the verification loop does');
    out.push(
      table(
        ['Model', 'Condition', 'Clean on first answer', 'Clean after repairs', 'Passed', 'Mean answers'],
        models.flatMap((m) =>
          (['loop', 'full'] as const)
            .filter((c) => of(m, c).length > 0)
            .map((c) => {
              const rows = of(m, c);
              const first = rows.filter((a) => a.turns[0]?.errorCodes.length === 0).length;
              const last = rows.filter((a) => a.turns[a.turns.length - 1]?.errorCodes.length === 0).length;
              return [m, c, `${first}/${rows.length}`, `${last}/${rows.length}`, rate(rows), (sum(rows.map((a) => a.turns.length)) / rows.length).toFixed(2)];
            }),
        ),
      ),
    );
  }

  out.push('## Where failures stop');
  out.push(
    table(
      ['Condition', 'static (checker errors)', 'behaviour (hidden tests)', 'structure (UI blocks)'],
      conditions.map((c) => {
        const rows = attempts.filter((a) => a.condition === c);
        const count = (where: Attempt['failedAt']): string => String(rows.filter((a) => a.failedAt === where).length);
        return [c, count('static'), count('behaviour'), count('structure')];
      }),
    ),
  );

  out.push('## Most common checker errors on the first answer');
  const codeCounts = new Map<string, Set<string>>();
  for (const a of attempts) {
    for (const code of new Set(a.turns[0]?.errorCodes ?? [])) {
      if (!codeCounts.has(code)) codeCounts.set(code, new Set());
      codeCounts.get(code)!.add(`${a.model}|${a.condition}|${a.task}`);
    }
  }
  const top = [...codeCounts.entries()].sort((x, y) => y[1].size - x[1].size).slice(0, 12);
  out.push(top.length > 0 ? table(['Code', 'Attempts with this error'], top.map(([code, set]) => [code, String(set.size)])) : 'None.');

  // Money is counted over every attempt in the file. A provider error can come after calls
  // that were already paid for, and a retried attempt was paid for twice.
  const spent = (model: string, c: ConditionId): Attempt[] => all.filter((a) => a.model === model && a.condition === c);
  out.push('## Cost');
  if (errors.length > 0) out.push('Calls, tokens and USD include the attempts that ended in a provider error: they are not in the pass rates, but what they spent was spent.');
  out.push(
    table(
      ['Model', 'Condition', 'Calls', 'Input tokens', 'Output tokens', 'USD', 'USD per passed task'],
      unique(all.map((a) => a.model)).flatMap((m) =>
        CONDITION_IDS.filter((c) => spent(m, c).length > 0).map((c) => {
          const rows = spent(m, c);
          const usd = sum(rows.map((a) => a.costUsd));
          const passed = rows.filter((a) => a.passed).length;
          return [
            m,
            c,
            String(sum(rows.map((a) => a.calls))),
            String(sum(rows.map((a) => a.inputTokens))),
            String(sum(rows.map((a) => a.outputTokens))),
            usd.toFixed(4),
            passed > 0 ? (usd / passed).toFixed(4) : '-',
          ];
        }),
      ),
    ),
  );

  return `${out.join('\n\n')}\n`;
}
