# Results

Only files produced by a real run go here: one JSON Lines file per run, written by `npm run lab -- run`,
one line per attempt with the date, the model id, the condition, every turn's checker errors, tokens, cost
and the final answer. Stand-in runs are written to `.tmp/` and are never committed.

A line is never edited or removed. When an attempt had to be made again, because its answer was cut off at
too low an output limit or because a fix to the judge changed a finding it was shown, the new attempt is a
new line with a `redo` field that names the reason. A report counts it in place of the earlier line, which
stays in the file to be read.

Each line also says which version of the judge checked it (`judge`; absent for the first) and the output
limit of its calls (`maxOutputTokens`; absent in lines of the first full evaluation, where it was 16 000).

No table in this repository is typed by hand. The tables in a report come from
`npm run lab -- report results/<file>.jsonl`, and `npm run lab -- rejudge results/<file>.jsonl` checks the
recorded verdicts against the judge as it is now.

## The full evaluation

| File | What it is | Written by |
| --- | --- | --- |
| [`eval-full.jsonl`](eval-full.jsonl) | 1398 attempts of six models on 40 tasks under five conditions, run on 16, 17 and 19 November 2026 | `npm run lab -- run --name eval-full`, in several invocations |
| [`eval-full.md`](eval-full.md) | The report | `npm run lab -- report results/eval-full.jsonl` |
| [`eval-full.svg`](eval-full.svg) | The pass rates as a chart | `npm run lab -- chart results/eval-full.jsonl results/eval-full.svg` |

What the numbers say, and what they do not, is in [`docs/FINDINGS.md`](../docs/FINDINGS.md).

Of the 1398 lines, 1200 are counted, one per model, task and condition. 144 are earlier attempts that were made
again. 54 are not attempts a model can be judged on, and a report calls all of them provider errors: 28 calls
that OpenRouter refused when the key's credit ran out, 21 answers that an early time limit recorded as empty,
3 other failed calls, and 2 that are a defect of this lab and not of a provider, where the checker ran out of
stack on an answer that never ended. Both of those were made again after the fix.

`npm run lab -- rejudge results/eval-full.jsonl` judges the 1200 counted answers again. With judge version 2,
which wrote the last of them, no verdict differed. With version 3 one does: `z-ai/glm-5.1`, `rules`,
`H06-address-picker-result`, recorded as failed at static, now passes. The file and the tables were not
changed for it; [`docs/JUDGE-GAPS.md`](../docs/JUDGE-GAPS.md) has the reason under `TS2345`.
