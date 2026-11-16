# Results

Only files produced by a real run go here: one JSON Lines file per run, written by `npm run lab -- run`,
one line per attempt with the date, the model id, the condition, every turn's checker errors, tokens, cost
and the final answer. Stand-in runs are written to `.tmp/` and are never committed.

No number in this repository is typed by hand. The tables in a report come from
`npm run lab -- report results/<file>.jsonl`.
