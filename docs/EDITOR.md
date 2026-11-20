# The checker in an editor and in an agent

The lab's checker is the judge of the evaluation. The same checker can also run in two other places:

- in an editor, as a language server that underlines what the checker finds;
- in a coding agent, as an MCP server whose tools the agent can call.

Both are prototypes. Both run the code in `src/judge/` unchanged, so they accept and reject exactly what the
judge does, including the known gaps in [`JUDGE-GAPS.md`](JUDGE-GAPS.md).

Nothing here calls a model or a network.

## Starting them

Run `npm ci` once. Both servers talk over stdio: the client starts the process and owns its stdin and stdout.

From the repository folder:

```
node_modules/.bin/tsx src/cli.ts lsp
node_modules/.bin/tsx src/cli.ts mcp
```

From any folder, with absolute paths:

```
/path/to/arkts-agent-lab/node_modules/.bin/tsx /path/to/arkts-agent-lab/src/cli.ts lsp
/path/to/arkts-agent-lab/node_modules/.bin/tsx /path/to/arkts-agent-lab/src/cli.ts mcp
```

Through npm, the `--silent` flag is required:

```
npm run --silent lab -- lsp
npm run --silent lab -- mcp
```

Without `--silent`, npm prints two lines of its own on stdout before the server starts. They are not protocol,
and they are not JSON: the same holds for `check --json`.

stdout carries only protocol messages. Logs and library output go to stderr.

## Connecting a client

Any client that can start a stdio server with a command and arguments can use the commands above.

What the tests cover: the language server with the `vscode-jsonrpc` client (`test/lsp.test.ts`), and the MCP
server with the client of `@modelcontextprotocol/sdk` (`test/mcp.test.ts`).

What was tried by hand, once each, on 19 November 2026:

- **`check --stdin --json` in IntelliJ IDEA**, through the plugin prototype in
  [`ide/intellij`](../ide/intellij/README.md), which starts that command and not the language server: the
  findings of a task's `trap.ets` showed in the editor.
- **The MCP server in Claude Code** (2.1.328, macOS). Registered for one folder with:

  ```
  claude mcp add arkts-lab -- /path/to/arkts-agent-lab/node_modules/.bin/tsx /path/to/arkts-agent-lab/src/cli.ts mcp
  ```

  The agent called `arkts_check` on its own answer when the prompt told it to check until no error was left.
  See "An agent session" below for what it did.

The language server was not tried in an editor, and no other agent product was tried. For those, use the
client's own documentation for how to register a stdio command.

## `check --json`

The contract for tools that do not speak either protocol.

```
node_modules/.bin/tsx src/cli.ts check --json <file.ets>...
node_modules/.bin/tsx src/cli.ts check --stdin --json [--filename name.ets]
```

With `--stdin`, the source is read from stdin. `--filename` is the name shown in the findings. Only its last
path segment is used and it must end in `.ets`; otherwise the name is `solution.ets`.

stdout is one line: one JSON object.

```json
{"findings":[{"layer":"arkts","code":"arkts-no-any-unknown","severity":"error","file":"Index.ets","line":1,"column":8,"endLine":1,"endColumn":11,"message":"Use explicit types instead of \"any\", \"unknown\" (arkts-no-any-unknown)"}]}
```

| Field | Meaning |
|---|---|
| `layer` | `syntax`, `type`, `arkts` or `arkui`: which check found it |
| `code` | `TS2339` for the compiler, the rule name (`arkts-no-any-unknown`) for the ArkTS linter, `arkui-only-ui-syntax` for the lab's own check, `lab-checker-overflow` (layer `syntax`, at 1:1, the only finding of its file) when the file is nested too deeply to be checked |
| `severity` | `error` or `warning` |
| `file` | The path relative to the current folder; with `--stdin`, the file name |
| `line`, `column` | Where the finding starts. 1-based |
| `endLine`, `endColumn` | Just after where it ends. 1-based, end exclusive |
| `message` | The checker's text |

- Findings are sorted by file, line and column. A clean source gives `{"findings":[]}`.
- Columns count UTF-16 code units, as TypeScript does.
- The end is never before the start. It equals the start for a finding with no width, such as a missing `}` at
  the end of the file.
- Exit code: 0 with no errors, 1 with at least one error, 2 for a usage problem. With exit code 2 the message
  is on stderr and stdout is empty.
- Without `--json` the output is the same lines as before: one per finding, then the number of errors.

## The language server

`lsp` implements these parts of the Language Server Protocol:

- Text document sync, incremental: open, change, close.
- `textDocument/publishDiagnostics`: one diagnostic per finding. `range` comes from the finding's start and
  end, `code` is the finding's code, `source` is `arkts-lab`, and `version` is the document version that was
  checked.

How it behaves:

- A document is checked 300 ms after it was opened or last changed.
- Checks run one at a time. A result is dropped when the document changed or closed while it was computed;
  the change gets its own check.
- Closing a document clears its diagnostics.
- The file name comes from the last segment of the document URI when it ends in `.ets`. The server reads the
  text the client sends and never opens the file itself.
- It ends on `exit`, or when the client closes stdin.

There is no hover, completion or go-to-definition. Hover was left out on purpose: the checker returns findings
and a syntax tree, not the program, so a hover would have to build a second whole program for each request.

## The MCP server

`mcp` offers three tools. All take text and return text. None takes a path.

| Tool | Arguments | Returns |
|---|---|---|
| `arkts_check` | `source` (string), `filename` (string, optional) | One line per finding, `file:line:column severity [code] message`, then the number of errors. Also as structured content, `{"findings":[...]}`, in the shape of `check --json` |
| `arkts_api_search` | `query` (string) | Signatures from the HarmonyOS SDK declarations that match the query, each with the import to use. The same search and format as the `docs` condition of the evaluation |
| `arkts_rules` | none | The rule sheet [`context/arkts-rules.md`](../context/arkts-rules.md), as the `rules` condition shows it |

- `filename` follows the rule of `--filename` above: a name, never a path.
- The first `arkts_api_search` builds an index of the declarations and keeps it in `.tmp/` inside the
  repository. Later searches read that file.
- The server uses `@modelcontextprotocol/sdk` 1.x and the stdio transport only.

## An agent session

One manual session, not a measurement: one attempt per case, with an agent that was not part of the
evaluation. It is written down for what it shows about a checker in an agent's loop.

The agent (Claude Code with Opus 5.5) was given the prompt of `H06-address-picker-result` in an empty folder,
once with no tools and once with the MCP server. Each answer was then judged with
`npm run lab -- judge H06-address-picker-result solution.ets`.

- Both first drafts wrote the navigation builder with a typed second parameter,
  `(name: string, param: Object)`.
- With no tools, that was the final answer. The judge reports one error, `TS2345`, and the answer fails at the
  static layer.
- With the tools, `arkts_check` returned the same `TS2345`. The agent rewrote the second screen as a component
  of its own that reads the parameter when it opens, checked again, got no errors and stopped. The judge passes
  that answer.

The session ran with judge version 2. Reading the official linter afterwards showed that it drops this
`TS2345`, and a DevEco Studio build of the first draft succeeded the next day
([`JUDGE-GAPS.md`](JUDGE-GAPS.md), the `TS2345` entry). Judge version 3 no longer reports it, and passes both
answers. So the session shows that the loop closes with a real agent, and it shows the cost of a checker that
is wrong: the agent changed valid code to satisfy the tool.

## Limits

- **A whole program per check.** Every check builds and type-checks a new program. The HarmonyOS declarations
  are parsed once per process and shared by the checks that follow: on the machine this was measured on, the
  first check took about 1.3 seconds and later ones about 0.1. `check` starts a process for every call, so it
  pays the first-check cost each time.
- **Memory grows slowly in a long-lived server.** The linter in the TypeScript fork keeps the tree of every
  file it has checked and offers no way to release it: about 0.15 MB per check, measured over 280 checks.
  A server that has made tens of thousands of checks should be restarted.
- **The server is busy during a check.** The check is synchronous, so a message that arrives meanwhile is read
  after it.
- **One file.** The file is checked alone. An import of another file of the project is reported as not found
  (`TS2307`).
- **No project resources.** Names in `$r('app.string.title')` are not looked up, so a missing resource is not
  reported. There is no `module.json5` and no build configuration.
- **Not the real build.** It is the same parser, type checker and linter, without the build step. See
  [`JUDGE-GAPS.md`](JUDGE-GAPS.md).
- **Files on disk.** `arkts_check`, the language server and `check --stdin` write the source to a private
  folder in the system temp directory for the check and remove it afterwards.
