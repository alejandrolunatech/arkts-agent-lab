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

No number in this repository is typed by hand. The tables in a report come from
`npm run lab -- report results/<file>.jsonl`, and `npm run lab -- rejudge results/<file>.jsonl` checks the
recorded verdicts against the judge as it is now.
