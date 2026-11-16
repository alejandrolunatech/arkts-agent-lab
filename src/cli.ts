// Command line of the lab. `npm run lab -- <command>`.

import fs from 'node:fs';
import path from 'node:path';
import { CONDITION_IDS, isConditionId, type ConditionId } from './agent/conditions.ts';
import { isSimulatedId, openRouterModel, simulatedModel, type Model } from './agent/model.ts';
import { report } from './eval/report.ts';
import { countCalls, readAttempts, runPlan } from './eval/run.ts';
import { checkFiles, errorsOf, formatFinding } from './judge/check.ts';
import { loadTasks, repoRoot } from './tasks.ts';
import { verifyTasks } from './verify.ts';

const HELP = `arkts-agent-lab

  check <file.ets>...        run the ArkTS checker on files and print what it finds
  verify-tasks [id...]       prove every task: its reference passes, its trap fails
  plan  [options]            show what a run would do and how many model calls it needs
  run   [options]            run models on tasks and append the attempts to a results file
  report <results.jsonl>...  print the result tables as Markdown
  models [word...]           list OpenRouter model ids and prices that contain any of the words

Options for plan and run:
  --models a,b        OpenRouter model ids, or stand-ins: sim:reference, sim:trap, sim:learner
  --conditions a,b    any of ${CONDITION_IDS.join(', ')} (default: all)
  --tasks a,b         task ids or prefixes such as L or U01 (default: all)
  --out file          results file (default: results/<name>.jsonl, or .tmp/ for stand-ins)
  --name text         name of the run, used for the default results file (default: run)
  --max-usd n         spending cap for this invocation; required for real models
  --concurrency n     attempts in parallel (default: 4)

Real models need OPENROUTER_API_KEY in the environment:
  op run --env-file=op.env -- npm run lab -- run --models <id> --max-usd 1
`;

function parseOptions(args: string[]): Map<string, string> {
  const options = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i]!;
    const value = args[i + 1];
    if (!name.startsWith('--')) throw new Error(`unexpected "${name}"`);
    if (value === undefined || value.startsWith('--')) throw new Error(`${name} needs a value`);
    options.set(name.slice(2), value);
  }
  return options;
}

const list = (value: string | undefined): string[] =>
  value
    ? value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

function buildModels(ids: string[]): Model[] {
  if (ids.every(isSimulatedId)) return ids.map(simulatedModel);
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set. Run through: op run --env-file=op.env -- npm run lab -- run ...');
  return ids.map((id) => openRouterModel(id, { apiKey }));
}

async function planOrRun(command: 'plan' | 'run', args: string[]): Promise<number> {
  const options = parseOptions(args);
  const modelIds = list(options.get('models'));
  if (modelIds.length === 0) throw new Error('--models is required');
  const simulated = modelIds.every(isSimulatedId);
  if (!simulated && modelIds.some(isSimulatedId)) {
    throw new Error('stand-ins and real models cannot share a run: their results must never share a file');
  }

  const wanted = list(options.get('conditions'));
  for (const c of wanted) if (!isConditionId(c)) throw new Error(`unknown condition "${c}"`);
  const conditionIds: ConditionId[] = wanted.length > 0 ? (wanted as ConditionId[]) : [...CONDITION_IDS];

  const tasks = loadTasks(list(options.get('tasks')));
  if (tasks.length === 0) throw new Error('no task matches --tasks');

  const name = options.get('name') ?? 'run';
  const scratch = path.join(repoRoot, '.tmp');
  const outFile = path.resolve(options.get('out') ?? path.join(simulated ? scratch : path.join(repoRoot, 'results'), `${name}.jsonl`));
  const inScratch = !path.relative(scratch, outFile).startsWith('..');
  if (simulated !== inScratch) {
    throw new Error(simulated ? 'stand-in results belong in .tmp/, never in results/' : 'real results do not go in .tmp/');
  }

  console.log(`tasks: ${tasks.length}   models: ${modelIds.join(', ')}   conditions: ${conditionIds.join(', ')}`);
  console.log(
    `attempts: ${tasks.length * modelIds.length * conditionIds.length}   model calls: at most ${countCalls(tasks.length, modelIds.length, conditionIds)}`,
  );
  console.log(`results file: ${path.relative(process.cwd(), outFile)}`);
  if (command === 'plan') return 0;

  let maxUsd = Number.POSITIVE_INFINITY;
  if (!simulated) {
    maxUsd = Number(options.get('max-usd'));
    if (!Number.isFinite(maxUsd) || maxUsd <= 0) throw new Error('--max-usd is required for real models, for example --max-usd 1');
  }

  const summary = await runPlan({
    tasks,
    models: buildModels(modelIds),
    conditions: conditionIds,
    outFile,
    maxUsd,
    concurrency: Number(options.get('concurrency') ?? 4),
    log: (line) => console.log(line),
  });

  console.log(
    `done: ${summary.done}   passed: ${summary.passed}   already in file: ${summary.skipped}   provider errors: ${summary.modelErrors}   spent: $${summary.spentUsd.toFixed(4)}`,
  );
  if (summary.stoppedAtBudget) console.log(`Stopped at the spending cap of $${maxUsd}. Run again with the same --out to continue.`);
  if (summary.modelErrors > 0) console.log('Attempts with provider errors are tried again when you rerun with the same --out.');
  return summary.modelErrors > 0 || summary.stoppedAtBudget ? 1 : 0;
}

interface ListedModel {
  id: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
}

/** Model ids change often. This reads them from OpenRouter's public list instead of trusting memory. */
async function listModels(words: string[]): Promise<number> {
  const response = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`OpenRouter ${response.status} while listing models`);
  const { data } = (await response.json()) as { data: ListedModel[] };
  const wanted = words.map((w) => w.toLowerCase());
  const perMillion = (price: string | undefined): string => (price === undefined ? '?' : (Number(price) * 1_000_000).toFixed(2));
  const rows = data
    .filter((m) => wanted.length === 0 || wanted.some((w) => m.id.toLowerCase().includes(w)))
    .sort((a, b) => a.id.localeCompare(b.id));
  for (const m of rows) {
    console.log(`${m.id.padEnd(48)} in $${perMillion(m.pricing?.prompt)}/M  out $${perMillion(m.pricing?.completion)}/M  context ${m.context_length ?? '?'}`);
  }
  console.log(`${rows.length} model(s).`);
  return 0;
}

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  switch (command) {
    case 'check': {
      if (rest.length === 0) throw new Error('check needs at least one file');
      const files = rest.map((f) => path.resolve(f));
      for (const f of files) if (!fs.existsSync(f)) throw new Error(`no such file: ${f}`);
      const { findings } = checkFiles(files, process.cwd());
      for (const finding of findings) console.log(formatFinding(finding));
      const errors = errorsOf(findings).length;
      console.log(errors === 0 ? 'No errors.' : `${errors} error(s).`);
      return errors === 0 ? 0 : 1;
    }
    case 'verify-tasks':
      return verifyTasks(rest) ? 0 : 1;
    case 'plan':
    case 'run':
      return planOrRun(command, rest);
    case 'report': {
      if (rest.length === 0) throw new Error('report needs at least one results file');
      process.stdout.write(report(rest.flatMap((f) => readAttempts(path.resolve(f)))));
      return 0;
    }
    case 'models':
      return listModels(rest);
    default:
      console.log(HELP);
      return command && command !== 'help' ? 2 : 0;
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(2);
  },
);
