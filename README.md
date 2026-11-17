# arkts-agent-lab

How well do coding models write ArkTS, the language of HarmonyOS apps, and what closes the gap:
a page of rules, the API reference, or a checker in the loop?

ArkTS looks like TypeScript, so a model trained mostly on TypeScript and web code writes answers that
look right and do not compile: `any`, destructuring, object spread, `fetch`, a `.map()` inside `build()`.
This lab measures that, with a judge that needs no model and no device.

> Status: the judge, 40 tasks and the evaluation harness are built and tested. **The full evaluation is not
> finished, so there are no results in this repository.** The runs against real models so far tested the
> harness more than the models. The early ones exposed an output limit that cut answers off, a UI check that
> was too strict, a time limit that recorded a slow call as an empty answer, and a memory leak that stopped a
> long run. The first complete run was then read failure by failure, and that showed two more: about one
> attempt in twelve was still cut off at the output limit, and the judge rejected a top-level `@Builder`
> function, which is correct ArkUI. All six are fixed and tested. The attempts those two touched are being
> made again (`run --redo`), and no number is reported before that. The checker also runs as a language
> server, as an MCP server ([`docs/EDITOR.md`](docs/EDITOR.md)) and inside an IntelliJ plugin
> ([`ide/intellij`](ide/intellij/README.md)); all three are prototypes.

Not affiliated with Huawei. HarmonyOS, ArkTS and DevEco are Huawei's names for their products.

## The experiment

Every task asks for one file, `solution.ets`. Each model answers each task under five conditions.
Each condition adds one thing to the first, so its effect can be read on its own.

| Condition | What the model gets besides the task |
|---|---|
| `bare` | Nothing |
| `rules` | A one-page sheet of what ArkTS forbids ([`context/arkts-rules.md`](context/arkts-rules.md)) |
| `docs` | The API signatures it asks to look up, found in the HarmonyOS SDK declarations |
| `loop` | The checker's errors on its answer, up to three times, to repair it |
| `full` | Rules, docs and loop together |

The loop shows the model what an IDE would show: checker errors with line and rule. It never shows
the hidden tests or the reference solution.

## The judge

A solution passes only if every layer that applies to it passes. No layer uses a model.

| Layer | Question | How |
|---|---|---|
| Syntax | Does it parse as ArkTS? | The OpenHarmony fork of TypeScript, which parses `struct` and ArkUI blocks |
| Types | Do the names, methods and arguments exist? | Type check against the HarmonyOS SDK declarations |
| ArkTS rules | Is it TypeScript that ArkTS forbids? | The official ArkTS linter that ships inside that fork |
| ArkUI rules | Are there ordinary statements where only UI may stand? | A small, cautious check of our own ([`src/judge/arkui.ts`](src/judge/arkui.ts)) |
| Behaviour (logic tasks) | Does it compute the right thing? | Hidden tests run on the type-erased code, in a locked-down process |
| Structure (UI tasks) | Did it use what the task asked for? | Facts read from the syntax tree |

Try it on any file:

```
npm run lab -- check tasks/U02-todo-list/trap.ets
```

## The checker in an editor and in an agent

The same checker, unchanged, is exposed in two more ways, both over stdio:

```
npm run --silent lab -- lsp
npm run --silent lab -- mcp
```

`lsp` is a language server: it publishes the checker's findings as diagnostics for the open `.ets` files.
`mcp` is an MCP server with three tools: `arkts_check` (check a source text), `arkts_api_search` (look up
signatures in the HarmonyOS SDK declarations) and `arkts_rules` (the rule sheet). For other tools,
`check --json` prints the findings as JSON, from files or from stdin.

Each check builds a whole program for one file, without the project around it. The commands, the JSON
contract and the limits are in [`docs/EDITOR.md`](docs/EDITOR.md).

## The tasks

40 tasks, written for this repository. The core set is 15 logic tasks (`L01` to `L15`) and 15 ArkUI tasks
(`U01` to `U15`). The harder set (`H01` to `H05` logic, `H06` to `H10` ArkUI) was added after the first real
run showed that strong models pass almost every core task with no help; a report gives it its own rows.
Each task is built around a habit that is fine in TypeScript, React or the web and wrong on HarmonyOS, and ships with
two solutions: a `reference.ets` that must pass and a `trap.ets`, the answer a good TypeScript programmer would
plausibly write, that must fail for a stated reason. `npm run verify-tasks` proves both for every task, so the
tasks themselves are tested. Prompts say what to build and never which rule to respect.

See [`docs/TASKS.md`](docs/TASKS.md) for the format.

## What this does not measure

- **It never runs a page.** A UI answer that compiles and uses the right building blocks passes, even if the
  screen would not update. That needs the emulator.
- **The checker is not the real build.** It is the same parser, type checker and linter, without the build
  step. Where they are known to differ is written down in [`docs/JUDGE-GAPS.md`](docs/JUDGE-GAPS.md), open
  items included.
- **The SDK declarations stop at API 13.** They are the latest release of `@arkts/declarations`. An answer
  that uses an API HarmonyOS added later fails the type layer, although it would build on a newer SDK.
- **40 tasks is a small sample.** Every pass rate in a report comes with its 95 % interval.
- **One file per task.** No multi-file projects, no resources, no build configuration.
- **Temperature 0, one attempt per task by default.** `--repeats n` attempts each task `n` times. At
  temperature 0 the repeats are not independent samples: they show how stable an answer is, and they do
  not make the interval of a pass rate any narrower in truth. The report's task-by-task table is the
  comparison to read.

## Run it

Needs Node 20.11 or later. Everything below works offline except `models` and a run against real models.

```
npm ci
npm run check
```

`npm run check` runs the type check, the tests and the proof of every task. No network, no model.

To see the whole pipeline without a key, use the scripted stand-ins. Their results go to `.tmp/` and are
labelled as simulated in every report:

```
npm run lab -- run --models sim:reference,sim:trap,sim:learner --name demo
npm run lab -- report .tmp/demo.jsonl
```

Real models go through OpenRouter. The key is read from the environment and the spending cap is mandatory:

```
npm run lab -- models glm deepseek qwen
npm run lab -- plan --models <id>,<id>
op run --env-file=op.env -- npm run lab -- run --models <id>,<id> --name <run-name> --max-usd 5
npm run lab -- report results/<run-name>.jsonl
```

A run appends one line per attempt, so it can be stopped and started again with the same name. Attempts that
ended in a provider error are tried again; everything else is skipped. The spending cap counts what the
results file already holds, so starting again cannot spend it twice. It is checked before each attempt
starts, so the attempts already under way when it is reached still finish.

A call that runs out of time, fails at the provider or comes back empty is made once more. If it fails
again, the attempt is recorded as a provider error and left out of every pass rate: it says nothing about
the model. The time limit is eight minutes at the default output limit of 16 000 tokens and grows with a
higher one. Answers are streamed, which keeps a long call alive and, at the providers that support it, stops
the charge for a call that is given up on. What a failed call did cost is kept in the record. A model with
six provider errors in a row is given up on for that invocation; the other models carry on.

### Making attempts again

When a run shows that the harness was wrong, the attempts it touched are made again in the same file. The
earlier attempt is never edited or removed: the new line says which reasons it stands in for, and a report
counts it in place of the old one and says how many were made again and why.

```
op run --env-file=op.env -- npm run lab -- run --models <id>,<id> --name <run-name> --redo cut-off,code:arkui-only-ui-syntax --max-output-tokens 48000 --max-usd 5
```

- `cut-off`: attempts that failed because the answer was cut off, at an output limit lower than the one given
  now. A model that reasons before it answers spends the limit on the reasoning, and the limit is the
  harness's choice. `run` never asks a model for more than OpenRouter lists as its maximum.
- `code:<checker code>`: attempts in which a judge older than the current one reported that code. For a fix
  to the judge: where the loop showed the model a wrong finding, the attempt cannot be judged again, only
  made again.

Neither reason looks at whether the attempt passed for any other cause, and neither holds for an attempt once
it has been made again, so the same command can be run twice. `plan` with the same options shows how many
attempts would be made again, without a call.

### Checking the verdicts yourself

```
npm run lab -- rejudge results/<run-name>.jsonl
```

This judges every recorded final answer again with the judge as it is now and lists the verdicts that differ
from the record. It needs no model, no key and no network.

## Layout

```
src/judge/      the checker and the three ways a solution is judged
src/agent/      conditions, API search, the attempt loop, the model clients
src/eval/       the run grid and the report
src/lsp/        the checker as a language server
src/mcp/        the checker, the API search and the rule sheet as MCP tools
tasks/          40 tasks: prompt, reference, trap, hidden tests
context/        the rule sheet used by the rules conditions
docs/           task format, known judge gaps, editor and agent integration
results/        files from real runs only
test/           the suite that runs in CI
```

## How this was built

I designed the experiment, the judge's layers and the task rules, and I review every pull request. Most of the
code and the tasks were written by AI coding agents (Claude Code) working to that design, which is the way of
working this repository is about. Four agents wrote the tasks in parallel against the judge; they found seven
places where the judge and real ArkTS disagreed, and those findings are in `docs/JUDGE-GAPS.md` with what was
done about each.

## Third-party pieces

- [`ohos-typescript`](https://www.npmjs.com/package/ohos-typescript): the OpenHarmony fork of TypeScript with the ArkTS linter, Apache-2.0.
- [`@arkts/declarations`](https://www.npmjs.com/package/@arkts/declarations): community packaging of the HarmonyOS SDK declarations, MIT.
- [`vscode-languageserver`](https://www.npmjs.com/package/vscode-languageserver) and [`vscode-languageserver-textdocument`](https://www.npmjs.com/package/vscode-languageserver-textdocument): the Language Server Protocol for Node, MIT.
- [`@modelcontextprotocol/sdk`](https://www.npmjs.com/package/@modelcontextprotocol/sdk) with [`zod`](https://www.npmjs.com/package/zod): the Model Context Protocol server and its schemas, MIT.

## Licence

MIT. See [`LICENSE`](LICENSE).
