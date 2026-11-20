// The real build as a check: the reader runs on what DevEco Studio printed, and the runner on a stand-in
// for the IDE, since no test may need one.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js';
import { buildOutcome, buildPage, buildSetup, formatBuild, pageOf, readBuildOutput, type BuildFinding } from '../src/build/deveco.ts';
import { repoRoot } from '../src/tasks.ts';

const fixtures = path.join(repoRoot, 'test', 'fixtures', 'deveco');
const printed = (name: string): string => fs.readFileSync(path.join(fixtures, `${name}.txt`), 'utf8');
const probe = (letter: string): string => fs.readFileSync(path.join(repoRoot, 'docs', 'deveco-probes', `probe-${letter}.ets`), 'utf8');
const places = (findings: BuildFinding[], severity: string): string[] => findings.filter((f) => f.severity === severity).map((f) => `${f.line}:${f.column}`);

test('the errors and warnings of a build are read with their code, place and whole message', () => {
  const a = readBuildOutput(printed('probe-a'));
  assert.equal(buildOutcome(printed('probe-a')), 'failed');
  assert.deepEqual(places(a, 'error'), ['28:16', '32:31', '42:9', '43:17', '53:10']);
  assert.deepEqual(places(a, 'warning'), ['47:3', '48:3']);
  assert.equal(a[2]!.code, '10605030');
  assert.equal(a[2]!.message, 'Structural typing is not supported (arkts-no-structural-typing)');
  assert.equal(a[4]!.message, 'Function may throw exceptions. Special handling is required.');
  // A message of two lines stays whole.
  assert.match(a[6]!.message, /^Property 'size' in type 'SizeControls'.*\n\s+Type 'number' is not assignable/);

  const c = readBuildOutput(printed('probe-c'));
  assert.deepEqual(places(c, 'error'), ['11:9', '19:7', '27:17', '52:12', '58:7', '59:7', '60:7', '61:7', '62:7', '63:7', '64:7']);
  assert.equal(c[0]!.message, "The '@Link' property cannot be specified a default value.");
  // The build quotes the code it refuses, over several lines.
  assert.match(c[10]!.message, /^'\['a', 'b'\]\.forEach[\s\S]*does not meet UI component syntax\.$/);

  assert.equal(buildOutcome(printed('success')), 'successful');
  assert.deepEqual(readBuildOutput(printed('success')), []);
});

test('the colour codes a build prints outside the IDE do not hide its errors', (t) => {
  // Where the build puts the codes was not recorded: here every line starts with one and ends with one.
  const coloured = printed('probe-c').split('\n').map((line) => `\u001b[31m${line}\u001b[39m`).join('\n');
  assert.deepEqual(readBuildOutput(coloured), readBuildOutput(printed('probe-c')));
  assert.equal(buildOutcome(coloured), 'failed');

  const { project, studio } = standIn(t, true);
  const result = buildPage(probe('c'), { project, studio });
  assert.equal(result.findings.length, 11);
  assert.doesNotMatch(result.output, /\u001b/);
});

test('a build that printed neither result did not run, and its output is shown instead of a verdict', () => {
  const output = 'node: command not found';
  assert.equal(buildOutcome(output), 'not-run');
  assert.match(formatBuild({ outcome: 'not-run', findings: [], output }), /did not run to an end[\s\S]*command not found/);
  assert.doesNotMatch(formatBuild({ outcome: 'not-run', findings: [], output }), /BUILD/);
});

/** A project and something in the place of DevEco Studio that prints what the real build printed for the probes. */
function standIn(t: { after: (fn: () => void) => void }, coloured = false): { project: string; studio: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arkts-build-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const project = path.join(dir, 'project');
  const studio = path.join(dir, 'studio');
  fs.mkdirSync(path.dirname(pageOf(project)), { recursive: true });
  fs.writeFileSync(pageOf(project), '// the page a new project starts with\n');
  fs.mkdirSync(path.join(studio, 'tools', 'node', 'bin'), { recursive: true });
  fs.mkdirSync(path.join(studio, 'tools', 'hvigor', 'bin'), { recursive: true });
  fs.symlinkSync(process.execPath, path.join(studio, 'tools', 'node', 'bin', 'node'));
  fs.writeFileSync(
    path.join(studio, 'tools', 'hvigor', 'bin', 'hvigorw.js'),
    `const fs = require('node:fs');
const page = fs.readFileSync('entry/src/main/ets/pages/Index.ets', 'utf8');
const name = page.includes('Probe A') ? 'probe-a' : page.includes('Probe C') ? 'probe-c' : 'success';
const printed = fs.readFileSync(${JSON.stringify(fixtures)} + '/' + name + '.txt', 'utf8');
process.stdout.write(${coloured} ? printed.split('\\n').map((line) => '\\u001b[31m' + line + '\\u001b[39m').join('\\n') : printed);
process.exit(name === 'success' ? 0 : 1);
`,
  );
  return { project, studio };
}

test('the setup comes from the environment, and what is missing is said in a sentence', (t) => {
  const { project, studio } = standIn(t);
  assert.match(buildSetup({}) as string, /ARKTS_LAB_DEVECO_PROJECT is not set/);
  assert.match(buildSetup({ ARKTS_LAB_DEVECO_PROJECT: studio, ARKTS_LAB_DEVECO_HOME: studio }) as string, /has no entry\/src\/main\/ets\/pages\/Index\.ets/);
  assert.match(buildSetup({ ARKTS_LAB_DEVECO_PROJECT: project, ARKTS_LAB_DEVECO_HOME: project }) as string, /no DevEco Studio at/);
  assert.deepEqual(buildSetup({ ARKTS_LAB_DEVECO_PROJECT: project, ARKTS_LAB_DEVECO_HOME: studio }), { project, studio });
});

test('a page is written into the project, built there, and the result read back', (t) => {
  const setup = standIn(t);

  const refused = buildPage(probe('c'), setup);
  assert.equal(fs.readFileSync(pageOf(setup.project), 'utf8'), probe('c'));
  assert.equal(refused.outcome, 'failed');
  assert.equal(places(refused.findings, 'error').length, 11);
  const text = formatBuild(refused).split('\n');
  assert.equal(text[0], "Index.ets:11:9 error [10905304] The '@Link' property cannot be specified a default value.");
  assert.equal(text.at(-1), 'BUILD FAILED');

  const built = buildPage(probe('d'), setup);
  assert.equal(built.outcome, 'successful');
  assert.equal(formatBuild(built), 'BUILD SUCCESSFUL');
});

test('the build command says with its exit code whether the page builds', (t) => {
  const { project, studio } = standIn(t);
  const run = (file: string, env: Record<string, string>) =>
    spawnSync(process.execPath, ['--import', 'tsx', 'src/cli.ts', 'build', file], { cwd: repoRoot, encoding: 'utf8', env: { ...process.env, ...env } });
  const env = { ARKTS_LAB_DEVECO_PROJECT: project, ARKTS_LAB_DEVECO_HOME: studio };

  const built = run('docs/deveco-probes/probe-b.ets', env);
  assert.equal(built.status, 0, built.stderr);
  assert.equal(built.stdout.trim(), 'BUILD SUCCESSFUL');

  const refused = run('docs/deveco-probes/probe-a.ets', env);
  assert.equal(refused.status, 1, refused.stderr);
  assert.match(refused.stdout, /^probe-a\.ets:28:16 error \[10505001\] Property 'at' does not exist/);
  assert.match(refused.stdout, /BUILD FAILED\n$/);

  const noSetup = run('docs/deveco-probes/probe-a.ets', { ARKTS_LAB_DEVECO_PROJECT: '' });
  assert.equal(noSetup.status, 2);
  assert.match(noSetup.stderr, /ARKTS_LAB_DEVECO_PROJECT is not set/);
});

test('the MCP server offers the build as a fourth tool only where a project is named for it', { timeout: 60_000 }, async (t) => {
  const { project, studio } = standIn(t);
  const client = new Client({ name: 'arkts-agent-lab-test', version: '0.0.0' });
  t.after(() => client.close());
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: ['--import', 'tsx', 'src/cli.ts', 'mcp'],
      cwd: repoRoot,
      env: { ...getDefaultEnvironment(), ARKTS_LAB_DEVECO_PROJECT: project, ARKTS_LAB_DEVECO_HOME: studio },
    }),
  );

  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((tool) => tool.name).sort(), ['arkts_api_search', 'arkts_build', 'arkts_check', 'arkts_rules']);

  const result = (await client.callTool({ name: 'arkts_build', arguments: { source: probe('c') } })) as unknown as {
    isError?: boolean;
    content: { text: string }[];
    structuredContent: { outcome: string; findings: BuildFinding[] };
  };
  assert.ok(!result.isError, result.content[0]?.text);
  assert.equal(result.structuredContent.outcome, 'failed');
  assert.equal(result.structuredContent.findings.length, 11);
  assert.match(result.content[0]!.text, /BUILD FAILED$/);
});
