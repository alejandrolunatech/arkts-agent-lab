# Working in this repo

A portfolio repo: an evaluation of how well coding models write ArkTS (the HarmonyOS language) and what closes the gap, with a judge that needs no model. Read `README.md` first, then `docs/TASKS.md` and `docs/JUDGE-GAPS.md`.

- Tasks, prompts, tests and code are written fresh for this repo. Never copy from documentation, courses, samples, other benchmarks, an employer or a client.
- Never write a model result that a real run did not produce. `results/` holds only files written by `npm run lab -- run` against real models; stand-in runs go to `.tmp/`. Tables come from `npm run lab -- report`.
- Running real models spends the owner's money: only when he asks, with his key through `op run --env-file=op.env`, and always with `--max-usd`. Tests and CI never reach a network or a model.
- Secrets: only `op://` references in `op.env`. No key in any file, test, log or commit.
- The judge must not be bent to make a task or a model pass. When the checker and real ArkTS disagree, write the smallest example in `docs/JUDGE-GAPS.md`; fix the judge in `src/judge/` with a test, or leave the entry open.
- `context/arkts-rules.md` is part of the experiment. Do not tune it to the tasks after results exist; a change to it starts a new run.
- A new or changed task must pass `npm run lab -- verify-tasks <id>`: the reference passes, the trap fails for the stated codes. Prompts say what to build, never which ArkTS rule to respect.
- Run `npm run check` (types, tests, task proofs) before every push.
- Not affiliated with Huawei. Describe DevEco, HarmonyOS and ArkTS only with facts that have a source.
- Claude works on a feature branch and opens a pull request. Never push to `main`, never merge.
- Commands for the owner: one per code block, no `#` comment lines, and say whether it runs inside the repo folder or anywhere.
