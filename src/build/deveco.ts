// The real build as a second, slower check: DevEco Studio's own build (hvigor) run on one page.
//
// The lab's checker is the parser, the type checker and the linter without the build step, so it
// does not see what only that step refuses (docs/JUDGE-GAPS.md). Where DevEco Studio is installed,
// this puts a page into a project kept for the purpose, runs the build the IDE runs, and reads the
// errors back. Nothing in the evaluation uses it: the judge needs no IDE.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export interface BuildFinding {
  /** The error code the build prints (`10905304`); `ArkTS:WARN` for a warning, which has none. */
  code: string;
  severity: 'error' | 'warning';
  /** 1-based. */
  line: number;
  /** 1-based. */
  column: number;
  message: string;
}

export interface BuildResult {
  /** `successful` and `failed` are what the build said. `not-run` means it said neither. */
  outcome: 'successful' | 'failed' | 'not-run';
  findings: BuildFinding[];
  /** What the build printed, for when `outcome` is `not-run` or it failed with no finding. */
  output: string;
}

const ERROR = /^\d+ ERROR: (\d+) ArkTS Compiler Error\r?\nError Message: ([\s\S]*?) At File: (.+):(\d+):(\d+)\s*$/gm;
const WARNING = /^\d+ WARN: ArkTS:WARN File: (.+):(\d+):(\d+)\r?\n\s*(.*\S)\s*$/gm;

/** Reads the errors and warnings about files out of what a build printed, in the order of the page. */
export function readBuildOutput(output: string): BuildFinding[] {
  const findings: BuildFinding[] = [];
  for (const m of output.matchAll(ERROR)) {
    findings.push({ code: m[1]!, severity: 'error', line: Number(m[4]), column: Number(m[5]), message: m[2]!.trim() });
  }
  for (const m of output.matchAll(WARNING)) {
    findings.push({ code: 'ArkTS:WARN', severity: 'warning', line: Number(m[2]), column: Number(m[3]), message: m[4]! });
  }
  return findings.sort((a, b) => a.line - b.line || a.column - b.column);
}

export function buildOutcome(output: string): BuildResult['outcome'] {
  if (/BUILD SUCCESSFUL/.test(output)) return 'successful';
  if (/BUILD FAILED/.test(output)) return 'failed';
  return 'not-run';
}

export interface BuildSetup {
  /** A DevEco Studio project kept for this: its `entry/src/main/ets/pages/Index.ets` is overwritten. */
  project: string;
  /** The `Contents` folder of DevEco Studio. */
  studio: string;
}

export const DEFAULT_STUDIO = '/Applications/DevEco-Studio.app/Contents';

/** Where the page goes: the page a new Empty Ability project starts with. */
export function pageOf(project: string): string {
  return path.join(project, 'entry', 'src', 'main', 'ets', 'pages', 'Index.ets');
}

/**
 * The setup from the environment, or a sentence that says what is missing.
 * `ARKTS_LAB_DEVECO_PROJECT` names the project; `ARKTS_LAB_DEVECO_HOME` the IDE, when it is not in /Applications.
 */
export function buildSetup(env: NodeJS.ProcessEnv = process.env): BuildSetup | string {
  const project = env.ARKTS_LAB_DEVECO_PROJECT;
  if (!project) return 'ARKTS_LAB_DEVECO_PROJECT is not set: it names a DevEco Studio project kept for these builds';
  const studio = env.ARKTS_LAB_DEVECO_HOME || DEFAULT_STUDIO;
  if (!fs.existsSync(pageOf(project))) return `${project} has no entry/src/main/ets/pages/Index.ets: make an Empty Ability project in DevEco Studio`;
  if (!fs.existsSync(hvigor(studio))) return `no DevEco Studio at ${studio}: set ARKTS_LAB_DEVECO_HOME to its Contents folder`;
  return { project: path.resolve(project), studio };
}

function hvigor(studio: string): string {
  return path.join(studio, 'tools', 'hvigor', 'bin', 'hvigorw.js');
}

/** The command DevEco Studio 6.1.1 runs for Build > Build Hap(s), as its Build panel prints it. */
export function buildCommand(studio: string): { command: string; args: string[] } {
  return {
    command: path.join(studio, 'tools', 'node', 'bin', 'node'),
    args: [hvigor(studio), '--mode', 'module', '-p', 'product=default', 'assembleHap', '--analyze=normal', '--parallel', '--incremental', '--daemon'],
  };
}

const BUILD_TIMEOUT_MS = 5 * 60 * 1000;

/** Writes `source` over the page of the project and builds it. The page stays as written. */
export function buildPage(source: string, setup: BuildSetup): BuildResult {
  fs.writeFileSync(pageOf(setup.project), source);
  const { command, args } = buildCommand(setup.studio);
  const run = spawnSync(command, args, { cwd: setup.project, encoding: 'utf8', timeout: BUILD_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 });
  const output = `${run.stdout ?? ''}${run.stderr ?? ''}${run.error ? `\n${run.error.message}` : ''}`;
  return { outcome: buildOutcome(output), findings: readBuildOutput(output), output };
}

/** A build result as an agent or a terminal reads it: one line per finding, then what the build said. */
export function formatBuild(result: BuildResult, fileName = 'Index.ets'): string {
  const lines = result.findings.map((f) => `${fileName}:${f.line}:${f.column} ${f.severity} [${f.code}] ${f.message}`);
  if (result.outcome === 'not-run') return ['The build did not run to an end. What it printed:', result.output.trim().slice(-4000)].join('\n');
  if (result.outcome === 'failed' && !result.findings.some((f) => f.severity === 'error')) {
    lines.push('The build failed without an error about the page. The end of what it printed:', result.output.trim().slice(-4000));
  }
  lines.push(result.outcome === 'successful' ? 'BUILD SUCCESSFUL' : 'BUILD FAILED');
  return lines.join('\n');
}
