// Command line of the lab. `npm run lab -- <command>`.

import fs from 'node:fs';
import path from 'node:path';
import { CONDITION_IDS, isConditionId, type ConditionId } from './agent/conditions.ts';
import { DEFAULT_MAX_OUTPUT_TOKENS, isSimulatedId, openRouterModel, outputLimits, simulatedModel, type ListedModel, type Model } from './agent/model.ts';
import { passRateChart } from './eval/chart.ts';
import { rejudge } from './eval/rejudge.ts';
import { report } from './eval/report.ts';
import { countCalls, countCallsOf, jobsOf, madeAgainBy, parseRedo, readAttempts, runPlan } from './eval/run.ts';
import { DEFAULT_STUDIO, buildPage, buildSetup, formatBuild } from './build/deveco.ts';
import { JUDGE_VERSION, judge } from './judge/judge.ts';
import { checkFiles, checkSource, errorsOf, etsFileName, formatFindings } from './judge/check.ts';
import { loadTasks, repoRoot } from './tasks.ts';
import { verifyTasks } from './verify.ts';

const HELP = `arkts-agent-lab

  check <file.ets>...        run the ArkTS checker on files and print what it finds
  lsp                        language server on stdio: the checker as editor diagnostics
  mcp                        MCP server on stdio: the checker, API search and rule sheet as tools
  verify-tasks [id...]       prove every task: its reference passes, its trap fails
  judge <task-id> <file.ets> judge your own answer to a task, as the evaluation would; no model
  build <file.ets>           build one page with DevEco Studio's own build, where it is installed
  plan  [options]            show what a run would do and how many model calls it needs
  run   [options]            run models on tasks and append the attempts to a results file
  report <results.jsonl>...  print the result tables as Markdown
  chart <results.jsonl>... <out.svg>  draw the pass rates as one SVG file
  rejudge <results.jsonl>... judge the recorded answers again with the judge as it is now; no model
  models [word...]           list OpenRouter model ids and prices that contain any of the words

Options for check:
  --json              print one JSON object, {"findings":[...]}, instead of lines
  --stdin             read the source from stdin instead of from files
  --filename name     with --stdin: the name shown in the findings (default: solution.ets)

For build, in the environment:
  ARKTS_LAB_DEVECO_PROJECT   a DevEco Studio project kept for this; its entry/src/main/ets/pages/Index.ets is overwritten
  ARKTS_LAB_DEVECO_HOME      the Contents folder of DevEco Studio (default: ${DEFAULT_STUDIO})

Options for plan and run:
  --models a,b        OpenRouter model ids, or stand-ins: sim:reference, sim:trap, sim:learner
  --conditions a,b    any of ${CONDITION_IDS.join(', ')} (default: all)
  --tasks a,b         task ids or prefixes such as L or U01 (default: all)
  --out file          results file (default: results/<name>.jsonl, or .tmp/ for stand-ins)
  --name text         name of the run, used for the default results file (default: run)
  --max-usd n         spending cap for the results file, earlier invocations included; required for real models
  --concurrency n     attempts in parallel (default: 4)
  --repeats n         attempts per task in each cell (default: 1)
  --max-output-tokens n  output limit per model call, reasoning included (default: ${DEFAULT_MAX_OUTPUT_TOKENS})
  --redo a,b          make attempts that are in the results file again and count them in place of the old ones:
                      cut-off        attempts whose answer was cut off at a lower output limit than this one
                      code:<code>    attempts where a judge older than the current one reported this checker code

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

const MODELS_URL = 'https://openrouter.ai/api/v1/models';

async function buildModels(ids: string[], maxOutputTokens: number): Promise<Model[]> {
  if (ids.every(isSimulatedId)) return ids.map(simulatedModel);
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set. Run through: op run --env-file=op.env -- npm run lab -- run ...');
  let listed: ListedModel[] | undefined;
  try {
    listed = await fetchModelList();
  } catch (error) {
    console.log(`OpenRouter's model list could not be read (${error instanceof Error ? error.message : error}): every model is asked for ${maxOutputTokens} output tokens.`);
  }
  const limits = outputLimits(ids, maxOutputTokens, listed);
  for (const [id, limit] of limits) {
    if (limit < maxOutputTokens) console.log(`output limit for ${id}: ${limit}, the most OpenRouter lists for it (${maxOutputTokens} was asked for)`);
  }
  return ids.map((id) => openRouterModel(id, { apiKey, maxOutputTokens: limits.get(id) ?? maxOutputTokens }));
}

/** For `plan`: the models as far as counting needs them. No key, no call. */
function modelsToCount(ids: string[], maxOutputTokens: number): Model[] {
  if (ids.every(isSimulatedId)) return ids.map(simulatedModel);
  return ids.map((id) => ({
    id,
    simulated: false,
    maxOutputTokens,
    complete: async () => {
      throw new Error('plan makes no model call');
    },
  }));
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

  const repeats = Number(options.get('repeats') ?? 1);
  if (!Number.isInteger(repeats) || repeats < 1) throw new Error('--repeats must be a whole number, 1 or more');

  const maxOutputTokens = Number(options.get('max-output-tokens') ?? DEFAULT_MAX_OUTPUT_TOKENS);
  if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 1) throw new Error('--max-output-tokens must be a whole number, 1 or more');

  const redo = parseRedo(list(options.get('redo')));

  console.log(`tasks: ${tasks.length}   models: ${modelIds.join(', ')}   conditions: ${conditionIds.join(', ')}${repeats > 1 ? `   repeats: ${repeats}` : ''}`);
  console.log(
    `attempts: ${tasks.length * modelIds.length * conditionIds.length * repeats}   model calls: at most ${countCalls(tasks.length, modelIds.length, conditionIds, repeats)}`,
  );
  console.log(`results file: ${path.relative(process.cwd(), outFile)}`);
  if (fs.existsSync(outFile)) {
    // What the file holds decides what is left. For `plan` the output limit is the one asked for; `run` may lower it per model.
    const { jobs, skipped } = jobsOf({ tasks, models: modelsToCount(modelIds, maxOutputTokens), conditions: conditionIds, repeats, redo }, readAttempts(outFile));
    const again = Object.entries(madeAgainBy(jobs)).map(([reason, count]) => `${count} for ${reason}`);
    console.log(
      `already in the file: ${skipped}   left to do: ${jobs.length}${again.length > 0 ? ` (made again: ${again.join(', ')})` : ''}   model calls: at most ${countCallsOf(jobs)}`,
    );
  }
  if (command === 'plan') return 0;

  let maxUsd = Number.POSITIVE_INFINITY;
  if (!simulated) {
    maxUsd = Number(options.get('max-usd'));
    if (!Number.isFinite(maxUsd) || maxUsd <= 0) throw new Error('--max-usd is required for real models, for example --max-usd 1');
  }

  const summary = await runPlan({
    tasks,
    models: await buildModels(modelIds, maxOutputTokens),
    conditions: conditionIds,
    outFile,
    maxUsd,
    concurrency: Number(options.get('concurrency') ?? 4),
    repeats,
    redo,
    log: (line) => console.log(line),
  });

  console.log(
    `done: ${summary.done}   passed: ${summary.passed}   already in file: ${summary.skipped}   provider errors: ${summary.modelErrors}   spent: $${summary.spentUsd.toFixed(4)}` +
      (summary.spentBeforeUsd > 0 ? `   in the file before: $${summary.spentBeforeUsd.toFixed(4)}` : ''),
  );
  if (summary.stoppedAtBudget) {
    console.log(`Stopped at the spending cap of $${maxUsd}, which counts everything in the results file. To continue, run the same command with a higher --max-usd.`);
  }
  const again = Object.entries(summary.madeAgain).map(([reason, count]) => `${count} for ${reason}`);
  if (again.length > 0) console.log(`Made again and counted in place of the earlier attempt: ${again.join(', ')}.`);
  if (summary.stoppedModels.length > 0) console.log(`Given up on after provider errors in a row, with attempts left to do: ${summary.stoppedModels.join(', ')}.`);
  if (summary.modelErrors > 0) console.log('Attempts with provider errors are tried again when you run the same command again.');
  return summary.modelErrors > 0 || summary.stoppedAtBudget ? 1 : 0;
}

async function fetchModelList(): Promise<ListedModel[]> {
  const response = await fetch(MODELS_URL, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`OpenRouter ${response.status} while listing models`);
  return ((await response.json()) as { data: ListedModel[] }).data;
}

/** Model ids change often. This reads them from OpenRouter's public list instead of trusting memory. */
async function listModels(words: string[]): Promise<number> {
  const data = await fetchModelList();
  const wanted = words.map((w) => w.toLowerCase());
  const perMillion = (price: string | undefined): string => (price === undefined ? '?' : (Number(price) * 1_000_000).toFixed(2));
  const rows = data
    .filter((m) => wanted.length === 0 || wanted.some((w) => m.id.toLowerCase().includes(w)))
    .sort((a, b) => a.id.localeCompare(b.id));
  for (const m of rows) {
    console.log(
      `${m.id.padEnd(48)} in $${perMillion(m.pricing?.prompt)}/M  out $${perMillion(m.pricing?.completion)}/M  context ${m.context_length ?? '?'}  max output ${m.top_provider?.max_completion_tokens ?? '?'}`,
    );
  }
  console.log(`${rows.length} model(s).`);
  return 0;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

async function check(args: string[]): Promise<number> {
  const files: string[] = [];
  let json = false;
  let stdin = false;
  let fileName: string | undefined;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]!;
    if (arg === '--json') json = true;
    else if (arg === '--stdin') stdin = true;
    else if (arg === '--filename') {
      fileName = args[(i += 1)];
      if (fileName === undefined || fileName.startsWith('--')) throw new Error('--filename needs a value');
    } else if (arg.startsWith('--')) throw new Error(`check does not know "${arg}"`);
    else files.push(path.resolve(arg));
  }

  if (stdin && files.length > 0) throw new Error('check takes files or --stdin, not both');
  if (!stdin && fileName !== undefined) throw new Error('--filename only goes with --stdin');
  if (!stdin && files.length === 0) throw new Error('check needs at least one file, or --stdin');
  for (const f of files) if (!fs.existsSync(f)) throw new Error(`no such file: ${f}`);

  const { findings } = stdin ? checkSource(await readStdin(), etsFileName(fileName)) : checkFiles(files, process.cwd());
  const output = json ? JSON.stringify({ findings }) : formatFindings(findings);
  // Waits for the write: the caller may be reading a pipe, and the process exits right after.
  await new Promise((resolve) => process.stdout.write(`${output}\n`, resolve));
  return errorsOf(findings).length === 0 ? 0 : 1;
}

/** One page through the real build. 0 when it builds, 1 when the build refuses it, 2 when there is no build to run. */
function buildFile(args: string[]): number {
  const [file, ...extra] = args;
  if (file === undefined || extra.length > 0 || file.startsWith('--')) throw new Error('build needs one file: build Page.ets');
  const source = path.resolve(file);
  if (!fs.existsSync(source)) throw new Error(`no such file: ${file}`);
  const setup = buildSetup();
  if (typeof setup === 'string') throw new Error(setup);
  const result = buildPage(fs.readFileSync(source, 'utf8'), setup);
  console.log(formatBuild(result, path.basename(source)));
  return result.outcome === 'successful' ? 0 : result.outcome === 'failed' ? 1 : 2;
}

/**
 * The verdict the evaluation would give to an answer written by hand or by an agent outside the harness.
 * Prints the checker's findings, then one line: the layer that stopped the answer and why.
 */
function judgeFile(args: string[]): number {
  const [taskId, file, ...extra] = args;
  if (taskId === undefined || file === undefined || extra.length > 0 || taskId.startsWith('--') || file.startsWith('--')) {
    throw new Error('judge needs a task id and one file: judge H02-editor-store solution.ets');
  }
  const tasks = loadTasks([taskId]);
  if (tasks.length === 0) throw new Error(`no task "${taskId}": the ids are the folder names under tasks/`);
  if (tasks.length > 1) throw new Error(`"${taskId}" matches ${tasks.length} tasks (${tasks.map((t) => t.id).join(', ')}): give one id`);
  const source = path.resolve(file);
  if (!fs.existsSync(source)) throw new Error(`no such file: ${file}`);

  const task = tasks[0]!;
  const verdict = judge(task, fs.readFileSync(source, 'utf8'));
  if (verdict.findings.length > 0) console.log(formatFindings(verdict.findings));
  console.log(
    verdict.passed
      ? `${task.id}: passed (judge version ${JUDGE_VERSION})`
      : `${task.id}: failed at ${verdict.failedAt}${verdict.detail ? `: ${verdict.detail}` : ''} (judge version ${JUDGE_VERSION})`,
  );
  return verdict.passed ? 0 : 1;
}

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  switch (command) {
    case 'check':
      return check(rest);
    // The servers load their protocol libraries only when asked for.
    case 'lsp':
      (await import('./lsp/server.ts')).runLanguageServer();
      return new Promise<never>(() => {}); // the connection ends the process itself, on `exit` or closed stdin
    case 'mcp':
      await (await import('./mcp/server.ts')).runMcpServer();
      return 0;
    case 'verify-tasks':
      return verifyTasks(rest) ? 0 : 1;
    case 'judge':
      return judgeFile(rest);
    case 'build':
      return buildFile(rest);
    case 'plan':
    case 'run':
      return planOrRun(command, rest);
    case 'report': {
      if (rest.length === 0) throw new Error('report needs at least one results file');
      // A file that is not there is a mistake to name, not an empty result to print tables for.
      const missing = rest.filter((f) => !fs.existsSync(path.resolve(f)));
      if (missing.length > 0) throw new Error(`no results file at ${missing.join(', ')}: \`run\` writes it`);
      process.stdout.write(report(rest.flatMap((f) => readAttempts(path.resolve(f)))));
      return 0;
    }
    case 'chart': {
      const outFile = rest[rest.length - 1];
      const inputs = rest.slice(0, -1);
      if (!outFile?.endsWith('.svg') || inputs.length === 0) throw new Error('chart needs at least one results file, and then the .svg file to write');
      const missing = inputs.filter((f) => !fs.existsSync(path.resolve(f)));
      if (missing.length > 0) throw new Error(`no results file at ${missing.join(', ')}`);
      fs.writeFileSync(path.resolve(outFile), passRateChart(inputs.flatMap((f) => readAttempts(path.resolve(f)))));
      console.log(`wrote ${outFile}`);
      return 0;
    }
    case 'rejudge': {
      if (rest.length === 0) throw new Error('rejudge needs at least one results file');
      const missing = rest.filter((f) => !fs.existsSync(path.resolve(f)));
      if (missing.length > 0) throw new Error(`no results file at ${missing.join(', ')}`);
      const { checked, differences } = rejudge(rest.flatMap((f) => readAttempts(path.resolve(f))), loadTasks([]));
      for (const line of differences) console.log(line);
      console.log(`${checked} recorded answer(s) judged again with judge version ${JUDGE_VERSION}: ${differences.length} verdict(s) differ from the record.`);
      return differences.length === 0 ? 0 : 1;
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
