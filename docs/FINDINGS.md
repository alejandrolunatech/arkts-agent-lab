# Findings

Six coding models, 40 ArkTS tasks, five conditions: 1200 attempts, each judged without a model. Run on 16, 17
and 19 November 2026 through OpenRouter at temperature 0, for USD 8.24. The table and the rates are copied from
[`results/eval-full.md`](../results/eval-full.md), which `npm run lab -- report` writes from
[`results/eval-full.jsonl`](../results/eval-full.jsonl); the other counts come from reading the attempts in
that file. The conditions and the judge are described in the [README](../README.md).

![Pass rate by model and condition, with 95 % intervals](../results/eval-full.svg)

Tasks passed, of 40:

| Model | bare | rules | docs | loop | full |
| --- | --- | --- | --- | --- | --- |
| z-ai/glm-5.1 | 31 | 33 | 33 | 40 | 39 |
| deepseek/deepseek-v4.1-flash-1017 | 34 | 38 | 36 | 38 | 40 |
| z-ai/glm-5.3-flash | 31 | 31 | 34 | 38 | 35 |
| qwen/qwen3-coder-next | 8 | 10 | 7 | 19 | 17 |
| qwen/qwen3-coder-30b-a3b-instruct | 7 | 9 | 8 | 15 | 12 |
| qwen/qwen3.5-9b | 7 | 7 | 5 | 9 | 11 |
| All six, of 240 | 118 (49 %) | 128 (53 %) | 123 (51 %) | 159 (66 %) | 154 (64 %) |

## What the numbers say

**1. The checker in the loop is what closes the gap.** Showing a model the checker's errors on its own answer,
up to three times, took the six models together from 118 to 159 tasks passed. GLM-5.1 went from 31 to all 40
and GLM-5.3 Flash from 31 to 38; the two Qwen coder models about doubled, from 8 to 19 and from 7 to 15. Task
by task, the loop fixed 46 tasks across the six models and broke 5. This is what an IDE already computes:
diagnostics with a line and a rule name.

**2. A page of rules or the API reference, given once, changes little.** `rules` (128) and `docs` (123) are
within the noise of `bare` (118). Each fixes some tasks and breaks others: for GLM-5.1, `docs` fixed 7 tasks
and broke 5. Context that the model must apply by itself helped less than feedback on what it wrote.

**3. Everything together is not better than the loop alone.** `full` passed 154 tasks and `loop` 159, and it
cost more: for GLM-5.1, USD 1.73 against USD 0.57 for the same 40 tasks.

**4. The gap is the platform more than the language.** On a first answer the most common errors are names that
do not exist (`TS2304` in 143 attempts, `TS2339` in 137): invented components, attributes and imports. The
ArkTS rules come after (`arkts-no-any-unknown`, 127). The harder ArkUI and logic tasks separate the models
most: with no help, the three strong models passed 14 of 30 of them, and the three Qwen models none.

**5. A checker gets code to compile. It does not make it right.** From `bare` to `loop`, failures at the
checker fell from 102 to 55, and failures at the hidden tests rose from 9 to 17: more answers got far enough to
be wrong. Of the 45 attempts of the two Qwen coder models that failed there, 25 are one mistake the checker
cannot see: the class or function the task asks for is declared without `export`.

**6. Small models carry habits from other UI frameworks.** 20 failed attempts of the Qwen models end with
ordinary statements where only UI may stand. In 12 of them the click handler is written as the body of the
button (`Button('Add') { this.count++ }`), and 11 of the 20 are final answers after three repairs. The
smallest model passed no ArkUI task under any condition except two under `full`.

**7. Some answers never end.** With a limit of 48 000 output tokens (40 960 for one model), 42 attempts were
still cut off: 23 of Qwen3.5 9B, 12 of GLM-5.3 Flash and 7 of DeepSeek V4.1 Flash. They are reasoning that
does not converge or one line repeated until the limit. An agent that calls these models needs a budget and a
stop of its own.

## What running it taught

The failures were read one by one before any number was written down, and that found seven defects in the
harness and the judge. Most of them counted a right answer as wrong: an output limit that cut answers off, and
a higher one that still did; a UI check that was too strict; a time limit that recorded a slow call as an empty
answer; a memory leak; a judge that rejected a top-level `@Builder` function; and a checker that ran out of
stack on two runaway answers. 144 of the 1200 attempts were made again for these reasons, and the earlier ones
stay in the file. `npm run lab -- rejudge` reproduced all 1200 recorded verdicts with judge version 2, which
wrote the last of them.

An eighth was found on 19 November 2026, after these tables: the judge reported a strict type error that the
official linter drops. Judge version 3 fixes it and judges one of the 1200 final answers differently
(`z-ai/glm-5.1`, `rules`, H06, from failed to passed). The tables above count the verdicts as recorded and were
not changed; [`JUDGE-GAPS.md`](JUDGE-GAPS.md) says what is and is not known about the attempts with the loop.

## Limits

- One attempt per cell and 40 tasks: the 95 % interval of a single rate is wide (31 of 40 is 62 to 88 %).
  Differences of two or three tasks between models or conditions are not findings.
- The judge checks against SDK declarations up to API 13 and never runs a page on a device. Four counted
  failures of the GLM models rested only on points where the judge might be stricter than a real build
  (`flushSync` twice, a field named `offset`, a navigation builder). A DevEco Studio build on 20 November 2026
  settled the three points ([`docs/JUDGE-GAPS.md`](JUDGE-GAPS.md)): a field named like a common attribute is
  an error on a build too (tried with `size`); the navigation builder is not, and judge version 3 passes that
  answer; `flushSync` builds on SDK level 24 and does not exist at level 13. The four answers themselves were
  not built, only the points. Counting the three that a newer build would take as passes moves no conclusion
  above.
- That build also confirmed four mistakes the judge does not see, because it does not run the build step: a
  `@Link` with a default value, a child created without its `@Link`, a `@CustomDialog` with no controller and
  a `@Watch` on a method that does not exist. No task or trap depends on them, and the recorded answers were
  not searched for them.
- Qwen3.5 9B wrote no lookup plan in 62 of its 80 `docs` and `full` attempts, so for that model those two
  conditions measure little.
- The tasks, the rules page and the judge have one author. The rules page was not changed after the first
  result existed.
- Model ids, prices and behaviour are those of OpenRouter in November 2026.

Not affiliated with Huawei.
