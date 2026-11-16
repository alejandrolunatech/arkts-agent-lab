# arkts-agent-lab

How well do coding models write ArkTS, the language of HarmonyOS apps, and what closes the gap:
a page of rules, the API reference, or a checker in the loop?

ArkTS looks like TypeScript, so a model trained mostly on TypeScript and web code writes answers that
look right and do not compile: `any`, destructuring, object spread, `fetch`, a `.map()` inside `build()`.
This lab measures that, with a judge that needs no model and no device.

> Status: the judge, 30 tasks and the evaluation harness are built and tested. **No model has been run yet,
> so there are no results in this repository.** The editor integration (language server, IntelliJ plugin) is next.

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

## The tasks

30 tasks, written for this repository: 15 logic tasks (`L01` to `L15`) and 15 ArkUI tasks (`U01` to `U15`).
Each is built around a habit that is fine in TypeScript, React or the web and wrong on HarmonyOS, and ships with
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
- **30 tasks is a small sample.** Every pass rate in a report comes with its 95 % interval.
- **One file per task.** No multi-file projects, no resources, no build configuration.
- **One answer per attempt, temperature 0.** No measure of run-to-run variation.

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
ended in a provider error are tried again; everything else is skipped.

## Layout

```
src/judge/      the checker and the three ways a solution is judged
src/agent/      conditions, API search, the attempt loop, the model clients
src/eval/       the run grid and the report
tasks/          30 tasks: prompt, reference, trap, hidden tests
context/        the rule sheet used by the rules conditions
docs/           task format, known judge gaps
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

## Licence

MIT. See [`LICENSE`](LICENSE).
