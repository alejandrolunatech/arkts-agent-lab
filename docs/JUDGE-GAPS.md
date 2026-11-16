# Judge gaps

Places where the checker and real ArkTS disagree. One entry per gap, with the smallest example.

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

**Fixed in src/judge/program.ts**, to confirm on a real DevEco build. The program now uses the four strict flags the linter's own checker uses instead of `strict: true`, so the catch variable is no longer `unknown`.

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

## Probably rejected wrongly: assigning or rethrowing the `catch` variable (TS2322), same cause as TS18046 above

**Fixed with the entry above**, to confirm on a real DevEco build.

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

## Open: the standard library level (`Array.prototype.at`, `Error` cause)

**Open, to confirm on a real DevEco build.** The program uses `lib.es2021`, so `items.at(-1)` is `TS2550` and
`new Error('x', { cause })` is `TS2554`. If the real SDK accepts them, a right answer is rejected here. No reference
or trap depends on either.

## Open: what only a device can tell

The judge never runs a page. For UI tasks it checks that the code compiles against the SDK, follows the ArkTS and
ArkUI rules above, and uses the building blocks the prompt asks for. A page that compiles and never updates on
screen (a nested field changed without `@Observed`, a module-level variable read in `build()`) passes. Closing this
needs the emulator: the third loop of Huawei's own harness.

