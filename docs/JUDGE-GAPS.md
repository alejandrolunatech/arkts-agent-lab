# Judge gaps

Places where the checker and real ArkTS disagree. One entry per gap, with the smallest example.

## What a DevEco build says

On 20 November 2026 the entries that waited for a real build were tried on one: DevEco Studio 6.1.1 Release
(build 6.1.1.280) on macOS, a new Empty Ability project with compatible SDK 6.1.1(24), `Build Hap(s)`, with
the page under test in place of `entry/src/main/ets/pages/Index.ets`. The pages are in
[`deveco-probes/`](deveco-probes/); each marks the lines it asks about. An entry below says "confirmed on a
build" when the build did there what the checker does. The build checks against SDK level 24 and the lab
against the declarations of level 13, so a build says nothing about names the SDK added in between.

## Rejected, but real ArkTS accepts: struct properties that the parent initialises (TS2564)

**Fixed in src/judge/arkui.ts.** `TS2564` is dropped for fields with the decorators the linter exempts, and U11's
reference is the `@Observed` + `@ObjectLink` child component again. What follows is the gap as it was found.

Found while writing U11. The checker reported `TS2564` on every `struct` property without an initializer:

```ts
@Observed
class Item {
  label: string = '';
}

@Component
struct ChildRow {
  @ObjectLink item: Item;            // TS2564
  @Prop count: number;               // TS2564
  @Link total: number;               // TS2564
  @Consume shared: number;           // TS2564
  @BuilderParam content: () => void; // TS2564

  build() {
    Text(this.item.label)
  }
}
```

```
error [TS2564] Property 'item' has no initializer and is not definitely assigned in the constructor.
```

Real ArkTS accepts all five: they are the documented way to declare them, and `@Link`, `@ObjectLink` and
`@Consume` may not have a default value at all, so there is no spelling that passes both. The real linter
removes this diagnostic for these decorators (`NON_INITIALIZABLE_PROPERTY_DECORATORS` = `Link`, `Consume`,
`ObjectLink`, `Prop`, `BuilderParam` and `filterOutDecoratorsDiagnostics` in `ohos-typescript/lib/typescript.js`);
`src/judge/check.ts` prints the program's semantic diagnostics unfiltered, with `strict: true`.

Effect: any correct solution with a child component that takes `@Link`, `@ObjectLink`, `@Consume`, or a `@Prop`
or `@BuilderParam` without a default fails the static layer. U11's reference uses `@ObservedV2` / `@Trace` in one
component for this reason; the `@Observed` + `@ObjectLink` answer to U11 is right and is rejected.

## Accepted, but real ArkTS rejects: statements that are not UI syntax inside `build()`

**Fixed in src/judge/arkui.ts.** Each of the five lines below now gets the error `arkui-only-ui-syntax`, and U09's
trap lists that code. What follows is the gap as it was found.

Found while writing U09. The checker printed `No errors.` for:

```ts
@Entry
@Component
struct GapPage {
  @State active: number = 0;

  build() {
    Column() {
      this.active === 0 && Text('Welcome home')
      this.active === 1 ? Text('a') : Text('b')
      console.log('hi')
      let x: number = 1;
      ['a', 'b'].forEach((name: string) => {
        Text(name)
      })
    }
  }
}
```

The real toolchain rejects each of these lines ("Only UI component syntax can be written here"): that check lives
in the build step that transforms `build()` (ets-loader), which the lab does not run. Effect: React-style
conditional rendering (`cond && Component()`) and `array.map(...)` or `forEach` inside `build()` are not caught
on their own, so a trap cannot rely on them.

## Rejected, but real ArkTS accepts: a logic solution that imports a HarmonyOS kit

**Settled by contract.** Logic prompts now end with "The file must be self-contained: it must not import anything", and the judge reports an import in a logic task as a broken contract instead of a crash (`src/judge/judge.ts`).

Found while writing L03. Rule 8 allows kit imports, and the static layer accepts this answer to L03 with no
findings, but the behaviour layer fails it before any test runs:

```ts
import { url } from '@kit.ArkTS';

export function parseQuery(query: string): Map<string, string> {
  const result = new Map<string, string>();
  const params = new url.URLParams(query);
  params.forEach((value: string, key: string) => {
    result.set(key, value);
  });
  return result;
}
```

```
failedAt: behaviour
TypeError [ERR_INVALID_MODULE_SPECIFIER]: Invalid module "@kit.ArkTS" is not a valid package name imported from .../solution.mjs
```

`src/judge/behaviour.ts` erases the types and runs the file in Node, where `@kit.*` and `@ohos.*` do not exist.
Effect: in a logic task, any solution that uses a HarmonyOS module (`url.URLParams` for L03, `util`, the `JSON`
of `@kit.ArkTS`, `HashMap`, `Stack`...) scores as a behaviour failure whether or not it is right, and the detail
reads like a crash in the model's code. L03 is the most exposed, since `url.URLParams` is the platform's own
query parser; its reference parses by hand for this reason. The prompts do not say "no imports", because rule 2
keeps them from saying what to avoid.

## Rejected, but real ArkTS accepts: two-way binding with `$$this.x` (TS2304) and `$x` (TS2552)

**Fixed in src/judge/arkui.ts.** `$$this.x` is accepted, and `$x` / `this.$x` when `x` is a field of a struct in the file, the way the build step forgives them.

Found while writing U15 and U12. A built-in component bound in both directions to a state variable:

```ts
@Entry
@Component
struct BindingPage {
  @State name: string = '';
  @State isOn: boolean = false;

  build() {
    Column() {
      TextInput({ text: $$this.name })
      Toggle({ type: ToggleType.Switch, isOn: $$this.isOn })
      Text(this.name)
    }
  }
}
```

```
error [TS2304] Cannot find name '$$this'.
```

`$$` is ArkUI's documented two-way binding for built-in components (`TextInput`, `Toggle`, `Checkbox`, `Slider`...).
The type checker in `ohos-typescript` has no special case for it (no `$$` handling in `lib/typescript.js`), so in
the real toolchain it has to be the build step that lets it through, which the lab does not run. The older
`$name` shorthand for passing a `@Link` has the same problem:

```ts
Stars({ rating: $rating })   // error [TS2552] Cannot find name '$rating'. Did you mean 'Rating'?
```

(`Stars({ rating: this.rating })` is accepted, and so is the V2 form `TextInput({ text: this.name!! })`.)

Effect: a correct solution to any task with a `TextInput`, `Toggle`, `Checkbox` or `Slider` (U12, U15, and likely
U07-login-form) that binds with `$$` fails the static layer. The references of U12 and U15 use `onChange`
instead, and their `structure` does not require `onChange`, so that the `$$` answer passes once this is fixed.

## Probably rejected wrongly: reading a property of the `catch` variable (TS18046)

**Fixed in src/judge/program.ts, and confirmed on a build**: probe A builds `err.message` in a `catch` with no error (P1). The program now uses the four strict flags the linter's own checker uses instead of `strict: true`, so the catch variable is no longer `unknown`. Since judge version 3 the program sets no strict flag itself and the type errors come from the fork's strict check, which forces the same four (see the `TS2345` entry below).

Found while writing U14. To validate on a real DevEco build; the reasoning is from reading the fork only.

```ts
export function describe(run: () => void): string {
  try {
    run();
    return 'ok';
  } catch (err) {
    return `failed: ${err.message}`;
  }
}
```

```
error [TS18046] 'err' is of type 'unknown'.
```

The lab's program sets `strict: true`, which includes `useUnknownInCatchVariables`. The checker the real linter
builds for its strict diagnostics turns on only `strictNullChecks`, `strictFunctionTypes`,
`strictPropertyInitialization` and `noImplicitReturns` (`isTypeCheckerForLinter` in `ohos-typescript/lib/typescript.js`),
so there the catch variable stays `any`, and `err.message` / `err.code` in a `catch` is common in HarmonyOS code.
If that is right, `strict: true` in `src/judge/program.ts` is stricter than the platform here.

Effect: a solution that logs or shows `err.message` after a failed request or storage call (U14, U15, U06) fails
the static layer. U14's reference does not read the error, and its trap casts (`(e as Error).message`), so
neither depends on this.

## Accepted, but real ArkTS rejects: a `@Link` with a default value, and a child created without its `@Link`

**Open.** The lab does not run the build step that checks how a parent initialises a child.

Found while writing U03. To validate on a real DevEco build; the messages are from memory of the build step.

```ts
@Component
struct GapChild {
  @Link value: number = 0;   // real: The @Link property 'value' cannot be specified a default value.

  build() {
    Text(`${this.value}`)
  }
}

@Entry
@Component
struct GapPage {
  @State value: number = 1;

  build() {
    Column() {
      GapChild({ value: this.value })
      GapChild()             // real: 'value' must be initialised by the parent
    }
  }
}
```

The checker prints `No errors.` Both rules belong to the build step (ets-loader), not to the type checker or the
linter. Effect: a model that "fixes" a missing initializer by giving `@Link` (or `@ObjectLink`, `@Consume`) a
default passes the static layer of U03 and U11 with a component that does not build. No trap relies on it.

## Accepted, but real ArkTS probably rejects: a plain method that returns a component, called from `build()`

**Fixed in src/judge/arkui.ts.** A call to a method or function of the same file that has no `@Builder` or `@LocalBuilder` is now `arkui-only-ui-syntax`.

Found while writing U05 and U06. To validate on a real DevEco build.

```ts
@Entry
@Component
struct GapPage {
  @State label: string = 'a';

  title() {
    return Text(this.label);
  }

  build() {
    Column() {
      this.title()
    }
  }
}
```

The checker prints `No errors.`: `arkui-only-ui-syntax` lets every `this.name()` call through as if it were a
builder. In the real build only a `@Builder` / `@LocalBuilder` method or a `@BuilderParam` field may be called
there ("does not meet UI component syntax"). The check could look the name up among the struct's members and
their decorators. Effect: the React habit of a `renderX()` helper that returns a component (U05, U06) is caught
only when the helper's body uses a `{ }` child block, which then fails to parse (`TS1005`); with a single
`return Text(...)` it passes.

## Structure layer: a correct solution in state management V2 fails every UI task

**Fixed in src/judge/structure.ts.** A structure entry can list alternatives (`State|Local`, `Component|ComponentV2`), and the UI tasks use them.

Found while writing U03. Not a checker gap, but the judge fails a right answer.

```ts
@Entry
@ComponentV2
struct CounterPage {
  @Local count: number = 0;

  build() {
    Column() {
      Text(`${this.count}`)
      Button('Add').onClick(() => {
        this.count += 1;
      })
    }
  }
}
```

The static layer accepts it; the structure layer reports `missing: decorator @Component, decorator @State`,
because `structure.decorators` is a list where every name is required and the V2 spellings are different names
(`ComponentV2`, `Local`, `Param`, `Event`). This holds for U01 and for every UI task that lists `Component` or
`State`. `StructureSpec` would need a way to say "one of" (`State` or `Local`, `Component` or `ComponentV2`).
The tasks U02 to U08 keep `Component` and `State` in the list, as U01 does, because without `State` nothing in
the judge notices a page whose number never updates.

## Structure layer: a list built without `List`, a grid built without `Grid`

**Fixed in the tasks U10, U11 and U14.** Their `structure` no longer names a container the prompt does not name.

Found in the first real run (16 November 2026, `bare`, `z-ai/glm-5.1` on U11). The prompt of U11 asks for
"a list of three people". The answer was right ArkUI and the structure layer failed it with
`missing: component List`:

```ts
build() {
  Column() {
    ForEach(this.people, (person: Person) => {
      PersonRow({ person: person })
    }, (person: Person, index: number) => `${index}`)
  }
}
```

"A list" in a prompt is a word, not the `List` component: a `Column` with a `ForEach` shows a list too. This
broke rule 7 of [`TASKS.md`](TASKS.md), "list only what the prompt asks for in words". All 15 UI tasks were
read again for the same mistake, and two more had it:

- U10 asked for `Grid`, `GridItem` and `.columnsTemplate()` where the prompt says "a grid of twelve square
  tiles in three columns". It now accepts `Grid`, `GridRow`, `WaterFlow` or `Flex`.
- U14 asked for `List` where the prompt says "a list with one row per item", and for a call named `request`
  where the prompt says "sends an HTTP GET request". It now accepts a call named `request`, `get` or `fetch`.

Nothing else in those tasks changed: same prompts, same references, same traps. Results judged before this
fix keep the verdict they were written with; the one attempt above is the only one known to be affected.

## Probably rejected wrongly: assigning or rethrowing the `catch` variable (TS2322), same cause as TS18046 above

**Fixed with the entry above, and confirmed on a build**: probe A builds `lastError = e` with no error (P2).

Found while writing L09. To validate on a real DevEco build. Same cause as the `TS18046` entry: `strict: true`
makes the catch variable `unknown`, where the real linter's checker leaves it `any`.

```ts
export async function retry<T>(action: () => Promise<T>, attempts: number): Promise<T> {
  let lastError: Error = new Error('not called');
  for (let i = 0; i < attempts; i++) {
    try {
      return await action();
    } catch (e) {
      lastError = e;   // TS2322
    }
  }
  throw lastError;
}
```

```
error [TS2322] Type 'unknown' is not assignable to type 'Error'.
```

With an `any` catch variable this is plain ArkTS: the clause has no type annotation and nothing is declared as
`any`. Effect: in L09 an answer that keeps the caught error in an `Error` variable without a cast fails the
static layer; only `lastError = e as Error` passes. L09's reference casts, and its trap is caught by other
codes (`arkts-no-types-in-catch`, `arkts-no-any-unknown`), so neither depends on this.

## Rejected, but real ArkTS accepts: a call to a top-level `@Builder` function

**Fixed in src/judge/arkui.ts.** A decorator in front of a function is now read, so the call is UI and the body
of the function is held to the same rule as `build()`. What follows is the gap as it was found.

Found by reading the failures of the first full evaluation. The checker reported `arkui-only-ui-syntax` on the
call in `build()`:

```ts
@Builder
function LabelRow(text: string) {
  Row() {
    Text(text)
  }
}

@Entry
@Component
struct GapPage {
  build() {
    Column() {
      LabelRow('a')   // arkui-only-ui-syntax
    }
  }
}
```

This is the ordinary global builder of ArkUI. TypeScript has no decorators on functions, so the fork's parser
keeps `@Builder` there apart from the decorators that `getDecorators` returns, and the lab's check read only
those: it took `LabelRow` for an ordinary function. A `@Builder` method inside a struct was never affected.

Effect on the first full evaluation, where 44 of 1197 attempts had this code in some answer. Re-judging the
recorded final answers changed two verdicts from fail to pass. In the conditions with the verification loop the
harm is larger than the verdict: the false error was sent back to the model as something to repair. Those
attempts cannot be re-judged, only made again, which is what `run --redo code:arkui-only-ui-syntax` is for. No
reference or trap used a top-level builder, which is why `verify-tasks` did not see it. The test that now covers
it is in `test/judge.test.ts`.

## The checker's own limit: a file nested too deeply to be checked

**Fixed in src/judge/check.ts and src/judge/arkui.ts.** Found in the second run of the full evaluation. Two
answers of one model never ended: one repeated an import name about 3000 times until its output limit, the other
opened one `if` inside another until it was 815 KB long. The parser, the type checker and the linter of the
TypeScript fork walk the tree by recursion, and so did a lookup of this lab, so the check ran out of stack. The
harness took the exception for a provider failure and left both attempts out of every pass rate, which hid two
failures of the model.

Now a file the checker cannot get through gets one finding, `lab-checker-overflow`, in the syntax layer, and the
attempt fails the static layer. The lookup no longer recurses, so the first answer is checked to the end (several
thousand real findings). This is a limit and not a verdict on ArkTS: a file with a few thousand nested blocks, or
one expression of a few thousand operators, is rejected here whether or not the real build would take it. No
reference, no trap and no answer shorter than a runaway one comes near it. The tests are in `test/judge.test.ts`.

## Settled: the standard library level (`Array.prototype.at`, `Error` cause)

**No gap: confirmed on a build.** The program uses `lib.es2021`, so `items.at(-1)` is `TS2550` and
`new Error('x', { cause })` is `TS2554`. The build reports both, with the same messages at the same places
(probe A, P3 and P4). No reference or trap depends on either.

## Settled: a subclass of `Error` where an `Error` is expected (arkts-no-structural-typing)

**No gap: confirmed on a build.** The build reports `arkts-no-structural-typing` on both lines below (probe A,
P5 and P6). Found while writing H04.

```ts
class CancelledError extends Error {}

function report(problem: Error): string {
  return problem.message;
}

const first: Error = new CancelledError('stop');   // arkts-no-structural-typing
report(new CancelledError('stop'));                // arkts-no-structural-typing
```

The finding comes from the official linter in the pinned fork, not from the lab's code. Its inheritance test
follows an `extends` clause only when the base is a class, and the standard library declares `Error` as an
interface with a constructor variable, so the subclass is not seen as related to `Error`. `throw new
CancelledError('stop')` is not affected. No reference or trap depends on it: H04 was rewritten to reject with
a plain `Error`. It is what the platform does, however odd it reads, so an answer that fails with this code
where a subclass of `Error` meets `Error` is a wrong answer.

## Settled: a struct field named like a common attribute (TS2416)

**No gap: confirmed on a build.** The build reports the same error at the same place (probe A, P8). Found
while writing H09.

```ts
@Component
struct SizeControls {
  @State size: number = 18;

  build() {
    Text(this.size.toString())
  }
}
```

The checker reports `TS2416`: in the SDK declarations a `struct` extends `CustomComponent`, which extends
`CommonAttribute`, and `size()` is one of its attributes. The same holds for `width`, `height`, `padding`,
`opacity` and the other common attributes. The diagnostic comes from the fork's own type checker and the
official declarations. The trap of H09 has such a field, and `TS2416` was left out of that task's `traps`
while this was open. An answer that fails with `TS2416` is a wrong answer.

## Rejected, but real ArkTS accepts: a strict type error that the linter drops (TS2345)

**Fixed in src/judge/check.ts (judge version 3), and confirmed on a DevEco build** (below). Found while writing H06.

```ts
@Builder
routes(name: string, param: Object) {
  if (name === 'addresses') {
    AddressesScreen()
  }
}

// in build():  Navigation(this.stack) { ... }.navDestination(this.routes)
```

The checker reported `TS2345`: the declarations give the builder's second parameter the type `unknown`, and
`unknown` is not assignable to `Object`. A builder that takes only `name` passed, and so does the reference of
H06.

The fork checks a program twice: once plainly, and once for the linter with `strictNullChecks`,
`strictFunctionTypes`, `strictPropertyInitialization` and `noImplicitReturns` forced on
(`createTypeChecker(program, true)`). The linter takes the diagnostics that only the strict check reports,
deletes some of them, and returns the rest together with its own findings (`runArkTSLinter`). The build tool
prints what the linter returns
([`do_arkTS_linter.ts`](https://gitee.com/openharmony/developtools_ace_ets2bundle/blob/OpenHarmony_feature_20250328/compiler/src/do_arkTS_linter.ts)).
One thing it deletes is a diagnostic on the argument of a call whose message ends in
"Type '... unknown ...' is not assignable to type '...'" (`LibraryTypeCallDiagnosticChecker`), and the
diagnostic above is one. The judge used to turn the four flags on in its own program and report every
diagnostic of it, so it never asked the linter and kept what the linter deletes.

Now the judge takes the type errors from the fork's strict check and keeps one when the plain check reports it
too or the linter returns it. On a syntax error the linter does not run, and every strict error is reported
as before. Run on the example with a second, unrelated strict error next to it (`number | undefined` passed
where `number` is declared), the linter returns that one and not the one above; the test in
`test/judge.test.ts` holds both.

**Confirmed on a build, 20 November 2026.** DevEco Studio 6.1.1 Release (build 6.1.1.280) on macOS, a new
Empty Ability project with compatible SDK 6.1.1(24), `Build Hap(s)`. The page was a complete answer to H06
with the builder `pageMap(name: string, param: Object)` on line 98 and `.navDestination(this.pageMap)` on
line 135, where judge version 2 reported the `TS2345`.

- That page alone: `BUILD SUCCESSFUL`.
- The same page with a function appended that passes a `number | undefined` where `number` is declared:
  `BUILD FAILED` with one `ArkTS Compiler Error`, "Argument of type 'number | undefined' is not assignable to
  parameter of type 'number'", on the appended line. Nothing was reported for line 135.

So the build rejects a strict type error and lets this one through, as the linter's code says. The build
checked against SDK level 24 and the lab checks against the declarations of level 13; the declaration of
`navDestination` was not compared between the two. The options of the build's plain program were still not
read. A diagnostic that only the plain check reports is not reported by the judge.

**What it changes in the recorded results.** `results/eval-full.jsonl` was written by judge versions 1 and 2,
and no table was changed. Of the 1200 counted final answers, version 3 judges one differently:
`z-ai/glm-5.1`, `rules`, H06, failed at static with this one error and now passes (`rejudge` names it). One
more loses a `TS2345` and still fails (`qwen/qwen3-coder-next`, `full`, H04). In `loop` and `full`, 50 counted
attempts got a `TS2345` in some turn. Only the final answer of an attempt is kept, so how many of those errors
were of this kind, and shown to the model as a mistake to fix, cannot be told from the file; those attempts
can only be made again.

Seen on 19 November 2026 in a manual session with a coding agent that was not part of the evaluation: two of
two first drafts of H06 used this spelling, and it was the only error of each
([`EDITOR.md`](EDITOR.md), "An agent session"). That session is what led to reading the linter.

## Open: the SDK level (API 13)

**Open.** The declarations the type layer checks against are `@arkts/declarations` 0.0.21, the latest release of
that package. The highest `@since` in it is 13, so an API that HarmonyOS added later does not exist for the
checker:

```ts
import { preferences } from '@kit.ArkData';

function save(store: preferences.Preferences): void {
  store.putSync('name', 'Ada');
  store.flushSync();   // TS2339: Property 'flushSync' does not exist on type 'Preferences'
}
```

The OpenHarmony reference lists `flushSync` from API 14
([`js-apis-data-preferences.md`](https://github.com/openharmony/docs/blob/master/en/application-dev/reference/apis-arkdata/js-apis-data-preferences.md)).
On a project that targets API 14 or later the answer is right, and here it fails the type layer. The same holds
for any other API newer than 13. The system prompt of every condition says "API 12 or later", so such an answer keeps to it. No
reference or trap depends on a later API. An answer that fails only on a name the SDK added after API 13 must be
read before it is counted; in the first full evaluation one attempt did (U15, `flushSync`).

Seen on a build: with compatible SDK 6.1.1(24) the two lines build with no error, only the warning "Function
may throw exceptions. Special handling is required." on each (probe A, P7).

## Open: decorator rules that only the build step checks

**Open.** Found while writing H08 to H10. The checker accepts each of these with no finding, and the build step
is believed to reject them: a `@CustomDialog` struct with no `CustomDialogController` field; `@Watch('name')`
where the struct has no method `name`; `@ObjectLink item: Plain` where the class `Plain` has no `@Observed`.
No reference or trap depends on any of them. A wrong answer that makes one of these mistakes passes here.

## Open: what only a device can tell

The judge never runs a page. For UI tasks it checks that the code compiles against the SDK, follows the ArkTS and
ArkUI rules above, and uses the building blocks the prompt asks for. A page that compiles and never updates on
screen (a nested field changed without `@Observed`, a module-level variable read in `build()`) passes. Closing this
needs the emulator: the third loop of Huawei's own harness.

