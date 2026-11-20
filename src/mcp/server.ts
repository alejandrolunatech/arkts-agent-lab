// MCP server over stdio: the lab's checker, API search and rule sheet as tools for a coding agent.
//
// The tools take text and return text. None of them takes a path, so an agent cannot
// use them to read or write files of its choosing.
//
// A fourth tool, the real build, exists only where the person who starts the server has named a
// DevEco Studio project for it in the environment. It writes the one page of that project.

import fs from 'node:fs';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { lookUp, rulesSheet } from '../agent/conditions.ts';
import { docSearch } from '../agent/docs.ts';
import { buildPage, buildSetup, formatBuild } from '../build/deveco.ts';
import { checkSource, etsFileName, formatFindings } from '../judge/check.ts';
import { reserveStdout } from '../stdio.ts';
import { repoRoot } from '../tasks.ts';

const finding = z.object({
  layer: z.enum(['syntax', 'type', 'arkts', 'arkui']),
  code: z.string(),
  severity: z.enum(['error', 'warning']),
  file: z.string(),
  line: z.number(),
  column: z.number(),
  endLine: z.number(),
  endColumn: z.number(),
  message: z.string(),
});

const buildFinding = z.object({
  code: z.string(),
  severity: z.enum(['error', 'warning']),
  line: z.number(),
  column: z.number(),
  message: z.string(),
});

const readOnly = { readOnlyHint: true, openWorldHint: false };

export function createMcpServer(): McpServer {
  const { version } = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as { version: string };
  const server = new McpServer({ name: 'arkts-lab', version });

  server.registerTool(
    'arkts_check',
    {
      description:
        'Checks one ArkTS (.ets) file given as text: syntax, types against the HarmonyOS SDK declarations, ArkTS linter rules, and UI-only syntax in build(). ' +
        'Returns one line per finding (file:line:column severity [code] message), then the number of errors. ' +
        'The file is checked alone: an import of another project file is reported as not found.',
      inputSchema: {
        source: z.string().describe('The complete source of the file.'),
        filename: z.string().optional().describe('Name shown in the findings, ending in .ets. Default: solution.ets. A name only, not a path.'),
      },
      outputSchema: { findings: z.array(finding) },
      annotations: readOnly,
    },
    ({ source, filename }) => {
      const { findings } = checkSource(source, etsFileName(filename));
      return { content: [{ type: 'text', text: formatFindings(findings) }], structuredContent: { findings } };
    },
  );

  server.registerTool(
    'arkts_api_search',
    {
      description:
        'Keyword search over the HarmonyOS SDK declarations. Returns the signatures of the best matches, each with the import to use. ' +
        'Query with names, for example "router pushUrl" or "TextInput type".',
      inputSchema: { query: z.string().describe('Names of components, modules, functions, attributes or enums.') },
      annotations: readOnly,
    },
    ({ query }) => {
      const text = lookUp(docSearch(), [query]);
      return { content: [{ type: 'text', text: text || `No declaration matches "${query}".` }] };
    },
  );

  server.registerTool(
    'arkts_rules',
    {
      description: 'Returns a one-page list of what ArkTS forbids compared with TypeScript, with the rule name the checker reports for each.',
      annotations: readOnly,
    },
    () => ({ content: [{ type: 'text', text: rulesSheet() }] }),
  );

  const setup = buildSetup();
  if (typeof setup !== 'string') {
    server.registerTool(
      'arkts_build',
      {
        description:
          'Builds one complete ArkTS page (a file with one @Entry struct) with the real build of DevEco Studio and the SDK of its project. ' +
          'Returns one line per error or warning of the build (Index.ets:line:column severity [code] message), then BUILD SUCCESSFUL or BUILD FAILED. ' +
          'It takes seconds, so use arkts_check first. It reports what only the build step refuses, such as a @Link with a default value or a child created without a required property. ' +
          'The page is built alone, in a project kept for this.',
        inputSchema: { source: z.string().describe('The complete source of the page.') },
        outputSchema: { outcome: z.enum(['successful', 'failed', 'not-run']), findings: z.array(buildFinding) },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      ({ source }) => {
        const result = buildPage(source, setup);
        return {
          content: [{ type: 'text', text: formatBuild(result) }],
          structuredContent: { outcome: result.outcome, findings: result.findings },
          isError: result.outcome === 'not-run',
        };
      },
    );
  }

  return server;
}

/** Serves until the client closes stdin. */
export async function runMcpServer(): Promise<void> {
  const server = createMcpServer();
  await server.connect(new StdioServerTransport(process.stdin, reserveStdout()));
  await new Promise((resolve) => process.stdin.once('end', resolve));
  await server.close();
}
