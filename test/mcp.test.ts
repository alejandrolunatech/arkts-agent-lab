// Drives the MCP server as a coding agent's host does: a child process and the SDK's own client.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { errorsOf, formatFinding, type Finding } from '../src/judge/check.ts';
import { loadTask, readSolution, repoRoot, tasksDir } from '../src/tasks.ts';

interface ToolResult {
  isError?: boolean;
  content: { type: string; text: string }[];
  structuredContent?: { findings: Finding[] };
}

test('the MCP server offers the checker, the API search and the rule sheet as tools', { timeout: 60_000 }, async (t) => {
  const client = new Client({ name: 'arkts-agent-lab-test', version: '0.0.0' });
  t.after(() => client.close());
  await client.connect(new StdioClientTransport({ command: process.execPath, args: ['--import', 'tsx', 'src/cli.ts', 'mcp'], cwd: repoRoot }));

  const call = async (name: string, args: Record<string, string>): Promise<ToolResult> => {
    const result = (await client.callTool({ name, arguments: args })) as ToolResult;
    assert.ok(!result.isError, result.content[0]?.text);
    return result;
  };

  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((tool) => tool.name).sort(), ['arkts_api_search', 'arkts_check', 'arkts_rules']);
  for (const tool of tools) assert.ok(tool.description);

  const task = loadTask(path.join(tasksDir, 'U02-todo-list'));

  // The name is a label: a path in it reaches no folder.
  const trap = await call('arkts_check', { source: readSolution(task, 'trap'), filename: '../../outside/TodoPage.ets' });
  const findings = trap.structuredContent!.findings;
  for (const code of task.traps) assert.ok(findings.some((f) => f.code === code), `missing ${code}`);
  assert.ok(findings.every((f) => f.file === 'TodoPage.ets'));
  assert.equal(trap.content[0]!.text, [...findings.map(formatFinding), `${errorsOf(findings).length} error(s).`].join('\n'));

  const reference = await call('arkts_check', { source: readSolution(task, 'reference') });
  assert.deepEqual(errorsOf(reference.structuredContent!.findings), []);
  assert.match(reference.content[0]!.text, /No errors\.$/);

  const api = await call('arkts_api_search', { query: 'router pushUrl' });
  assert.match(api.content[0]!.text, /pushUrl\(/);
  assert.match(api.content[0]!.text, /import \{ router \} from '@kit\.ArkUI'/);

  const rules = await call('arkts_rules', {});
  assert.equal(rules.content[0]!.text, fs.readFileSync(path.join(repoRoot, 'context', 'arkts-rules.md'), 'utf8').trim());
});
