// Language server over stdio: the lab's checker as diagnostics in an editor.
//
// Each open document is checked alone, as `checkSource` does it: one whole program per check,
// no project around the file. The check blocks the server while it runs, so checks go one
// at a time and each result is compared with the document before it is published.

import { createConnection, DiagnosticSeverity, TextDocuments, TextDocumentSyncKind, type Diagnostic } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { checkSource, etsFileName, type Finding } from '../judge/check.ts';
import { reserveStdout } from '../stdio.ts';

/** Quiet time after the last change before a document is checked. */
const DEBOUNCE_MS = 300;

/**
 * A change sent while a check runs is read only after it. The result waits this long
 * before the comparison, so that the change is in by then.
 */
const SETTLE_MS = 20;

export function toDiagnostic(f: Finding): Diagnostic {
  return {
    range: {
      start: { line: f.line - 1, character: f.column - 1 },
      end: { line: (f.endLine ?? f.line) - 1, character: (f.endColumn ?? f.column) - 1 },
    },
    severity: f.severity === 'warning' ? DiagnosticSeverity.Warning : DiagnosticSeverity.Error,
    code: f.code,
    source: 'arkts-lab',
    message: f.message,
  };
}

/** `file:///project/pages/Index.ets` → `Index.ets`. The checker only needs a name, never the path. */
function fileNameOf(uri: string): string {
  try {
    return etsFileName(decodeURIComponent(new URL(uri).pathname));
  } catch {
    return etsFileName(undefined);
  }
}

/** Serves until the client sends `exit` or closes stdin; the connection ends the process itself. */
export function runLanguageServer(): void {
  const connection = createConnection(process.stdin, reserveStdout());
  const documents = new TextDocuments(TextDocument);
  const debounce = new Map<string, NodeJS.Timeout>();
  const due = new Set<string>();
  let checking = false;

  const checkDue = async (): Promise<void> => {
    if (checking) return;
    checking = true;
    try {
      for (const uri of due) {
        due.delete(uri);
        const document = documents.get(uri);
        if (!document) continue;
        const { version } = document;
        let diagnostics: Diagnostic[];
        try {
          diagnostics = checkSource(document.getText(), fileNameOf(uri)).findings.map(toDiagnostic);
        } catch (error) {
          connection.console.error(`check failed: ${error instanceof Error ? error.name : 'error'}`);
          continue;
        }
        await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
        // Changed, closed or reopened meanwhile: this result is stale, and a change has its own check on the way.
        if (documents.get(uri) !== document || document.version !== version) continue;
        void connection.sendDiagnostics({ uri, version, diagnostics });
      }
    } finally {
      checking = false;
    }
  };

  const forget = (uri: string): void => {
    clearTimeout(debounce.get(uri));
    debounce.delete(uri);
    due.delete(uri);
  };

  connection.onInitialize(() => ({
    capabilities: { textDocumentSync: TextDocumentSyncKind.Incremental },
    serverInfo: { name: 'arkts-lab' },
  }));

  // Fires on open and on every change.
  documents.onDidChangeContent(({ document }) => {
    forget(document.uri);
    debounce.set(
      document.uri,
      setTimeout(() => {
        debounce.delete(document.uri);
        due.add(document.uri);
        void checkDue();
      }, DEBOUNCE_MS),
    );
  });

  documents.onDidClose(({ document }) => {
    forget(document.uri);
    void connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
  });

  documents.listen(connection);
  connection.listen();
}
