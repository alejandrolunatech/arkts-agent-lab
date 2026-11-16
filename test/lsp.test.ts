// Drives the language server as an editor does: a child process and JSON-RPC on its stdio.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import test from 'node:test';
import {
  createMessageConnection,
  DidChangeTextDocumentNotification,
  DidCloseTextDocumentNotification,
  DidOpenTextDocumentNotification,
  ExitNotification,
  InitializedNotification,
  InitializeRequest,
  PublishDiagnosticsNotification,
  ShutdownRequest,
  StreamMessageReader,
  StreamMessageWriter,
  TextDocumentSyncKind,
  type PublishDiagnosticsParams,
} from 'vscode-languageserver/node';
import { repoRoot } from '../src/tasks.ts';

const URI = 'file:///project/entry/src/main/ets/pages/Index.ets';
/** The span of `any` in `let x: any = 1`, 0-based as the protocol counts. */
const TYPE = { start: { line: 0, character: 7 }, end: { line: 0, character: 10 } };

test('the language server publishes the checker findings of the newest text only', { timeout: 60_000 }, async (t) => {
  const server = spawn(process.execPath, ['--import', 'tsx', 'src/cli.ts', 'lsp'], { cwd: repoRoot, stdio: ['pipe', 'pipe', 'inherit'] });
  t.after(() => server.kill());
  const exited = once(server, 'exit');

  // A line on stdout that is not protocol would surface here as a read error.
  const client = createMessageConnection(new StreamMessageReader(server.stdout), new StreamMessageWriter(server.stdin));
  const errors: unknown[] = [];
  client.onError((error) => errors.push(error));

  const published: PublishDiagnosticsParams[] = [];
  let wake = (): void => {};
  client.onNotification(PublishDiagnosticsNotification.type, (params) => {
    published.push(params);
    wake();
  });
  const nextPublished = async (): Promise<PublishDiagnosticsParams> => {
    while (published.length === 0) await new Promise<void>((resolve) => (wake = resolve));
    return published.shift()!;
  };
  client.listen();

  const { capabilities } = await client.sendRequest(InitializeRequest.type, { processId: process.pid, rootUri: null, capabilities: {} });
  assert.equal(capabilities.textDocumentSync, TextDocumentSyncKind.Incremental);
  await client.sendNotification(InitializedNotification.type, {});

  await client.sendNotification(DidOpenTextDocumentNotification.type, {
    textDocument: { uri: URI, languageId: 'arkts', version: 1, text: 'let x: any = 1\n' },
  });
  const opened = await nextPublished();
  assert.equal(opened.uri, URI);
  assert.equal(opened.version, 1);
  assert.equal(opened.diagnostics.length, 1);
  const [diagnostic] = opened.diagnostics;
  assert.equal(diagnostic!.code, 'arkts-no-any-unknown');
  assert.equal(diagnostic!.source, 'arkts-lab');
  assert.equal(diagnostic!.severity, 1);
  assert.deepEqual(diagnostic!.range, TYPE);

  // Version 2 is still wrong. Version 3 arrives while version 2 is being checked, so the result for 2 is stale.
  await client.sendNotification(DidChangeTextDocumentNotification.type, {
    textDocument: { uri: URI, version: 2 },
    contentChanges: [{ range: TYPE, text: 'unknown' }],
  });
  await new Promise((resolve) => setTimeout(resolve, 450));
  await client.sendNotification(DidChangeTextDocumentNotification.type, {
    textDocument: { uri: URI, version: 3 },
    contentChanges: [{ range: { start: TYPE.start, end: { line: 0, character: 14 } }, text: 'number' }],
  });
  assert.deepEqual(await nextPublished(), { uri: URI, version: 3, diagnostics: [] });

  await client.sendNotification(DidCloseTextDocumentNotification.type, { textDocument: { uri: URI } });
  assert.deepEqual(await nextPublished(), { uri: URI, diagnostics: [] });

  assert.equal(await client.sendRequest(ShutdownRequest.type), null);
  await client.sendNotification(ExitNotification.type);
  const [code] = await exited;
  assert.equal(code, 0);
  client.dispose();
  assert.deepEqual(errors, []);
  assert.deepEqual(published, []);
});
