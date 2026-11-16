# Writing a task

A task asks a model to write one ArkTS file, `solution.ets`, and lets the judge decide
without a model whether the answer is right. Every task is built around a habit that is
fine in TypeScript, React or the web and wrong in ArkTS or HarmonyOS.

## Files

```
tasks/<id>/
  task.json       id, kind, title, traps, structure
  prompt.md       what the model reads
  reference.ets   a correct, idiomatic solution
  trap.ets        how a TypeScript or web programmer would plausibly write it
  tests.mjs       hidden behaviour tests (logic tasks only)
```

`<id>` is `L<nn>-<slug>` for logic tasks and `U<nn>-<slug>` for UI tasks.

```json
{
  "id": "U01-counter-page",
  "kind": "ui",
  "title": "A counter page with local state",
  "traps": ["TS28006", "arkts-no-func-expressions"],
  "structure": {
    "decorators": ["Entry", "Component", "State"],
    "components": ["Column", "Text", "Button"],
    "calls": ["onClick"],
    "forEachKeyed": false,
    "minStructs": 1
  }
}
```

- `kind`: `logic` (pure code, judged by hidden tests) or `ui` (an ArkUI component, judged by structure).
- `traps`: one to three checker codes that `trap.ets` triggers and that name the lesson of the task.
  A code is an ArkTS rule (`arkts-no-any-unknown`) or a compiler code (`TS2339`).
- `structure` (UI only): the building blocks the prompt explicitly asks for. See `src/judge/structure.ts`.

## Rules

1. **Written fresh.** No code, prompt or test copied from documentation, courses, samples or other benchmarks.
2. **The prompt says what, never how.** It must not mention ArkTS rules, the trap, or what to avoid.
   A model with no ArkTS knowledge should be able to understand the request and get it wrong.
3. **Logic prompts fix the contract.** Name every exported function, class, interface and field the tests use,
   with types. Tests only use what the prompt names.
4. **Tests are deterministic.** Three to six `node:test` cases importing from `./solution.mjs`. No clock, no
   randomness, no network, no files. They run on JavaScript made by erasing the types, so they cannot
   observe types, only behaviour.
5. **The reference is what a good HarmonyOS developer would write.** It passes with zero errors.
6. **The trap is plausible, not a strawman.** It is the answer a capable model that knows TypeScript or web
   development would give. It should be correct in spirit and fail only because of ArkTS or the HarmonyOS API:
   a forbidden TypeScript feature, or an API that does not exist (a hallucinated method, a web API, a wrong
   import, a string where an enum is required).
7. **Do not over-constrain UI structure.** List only what the prompt asks for in words. A different correct
   layout must still pass. Use `forEachKeyed` only when the prompt asks for stable keys.
8. **One file.** The solution is a single `solution.ets` with no imports from other project files. Imports from
   HarmonyOS kits (`@kit.ArkUI`, `@kit.NetworkKit`...) are fine when the task needs them.
9. **Component names.** A `struct` cannot be named like a built-in component (`Counter`, `Search`, `Menu`...).

## Proving a task

```
npm run lab -- verify-tasks <id>
npm run lab -- check tasks/<id>/trap.ets
```

`verify-tasks` must print `ok` for the task: the reference passes every layer, the trap fails, and the trap
triggers every code listed in `traps`. Pick the codes for `traps` from what `check` really prints, never from memory.

If the checker rejects code that real ArkTS accepts, or accepts code that real ArkTS rejects, do not bend the
task around it. Write it down in `docs/JUDGE-GAPS.md` with the smallest example, and choose another angle for the task.
