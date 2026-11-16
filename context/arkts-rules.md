# ArkTS in one page

ArkTS is TypeScript with static typing enforced, so that code can be compiled ahead of time.
Most TypeScript is valid ArkTS. The list below is what is not. The name in brackets is the
rule the ArkTS checker reports.

## Types

- No `any` and no `unknown`. Give every value a real type. [arkts-no-any-unknown]
- An object literal needs a declared class or interface as its type: `const p: Point = { x: 1, y: 2 }`.
  A bare `{ x: 1 }` with no declared type is an error. [arkts-no-untyped-obj-literals]
- Do not write object shapes inline as types (`let p: { x: number }`). Declare an interface or class. [arkts-no-obj-literals-as-types]
- No index signatures (`{ [key: string]: number }`). Use `Map<K, V>` or `Record<K, V>`. [arkts-no-indexed-signatures]
- No `obj['field']` access to fields. Use `obj.field`; use a `Map` for dynamic keys. [arkts-no-props-by-index]
- No intersection types (`A & B`); use inheritance. [arkts-no-intersection-types]
- No conditional types, no mapped types, no `T[K]` indexed access types. [arkts-no-conditional-types] [arkts-no-mapped-types] [arkts-no-aliases-by-index]
- Of the utility types only `Partial`, `Required`, `Readonly` and `Record` exist. [arkts-no-utility-types]
- No call signatures or constructor signatures in interfaces or type literals. Use function types
  (`type Handler = (x: number) => void`) and classes. [arkts-no-call-signatures] [arkts-no-ctor-signatures-type]
- No `is` type-guard functions and no `in` operator. Narrow with `instanceof` on classes. [arkts-no-is] [arkts-no-in]
- No `as const`. [arkts-no-as-const]
- Casts are written `value as T`, never `<T>value`. [arkts-as-casts]
- Two classes with the same fields are still different types; one is not assignable to the other. [arkts-no-structural-typing]
- An array literal must have one inferrable element type; objects inside it need a declared type. [arkts-no-noninferrable-arr-literals]
- `typeof` only as an expression (`typeof x === 'string'`), not as a type. [arkts-no-type-query]
- Functions whose return type is not obvious need it written out. [arkts-no-implicit-return-types]

## Statements and expressions

- `let` and `const` only, never `var`. [arkts-no-var]
- No destructuring: not in declarations, not in parameters, not in assignments. Read fields one by one.
  [arkts-no-destruct-decls] [arkts-no-destruct-params] [arkts-no-destruct-assignment]
- Spread only copies arrays into arrays or rest parameters. No object spread (`{ ...a }`). [arkts-no-spread]
- No `for...in`. Use `for...of`, an index loop, or `Object.keys` on a `Record`. [arkts-no-for-in]
- No `delete`. Model an optional value as `T | undefined` or use a `Map`. [arkts-no-delete]
- No comma operator outside a `for` header. [arkts-no-comma-outside-loops]
- Unary `+`, `-`, `~` only on numbers; convert strings with `Number(...)`. [arkts-no-polymorphic-unops]
- `throw` only instances of `Error` or a subclass. [arkts-limited-throw]
- No type annotation on a `catch` variable: write `catch (e)`. [arkts-no-types-in-catch]

## Functions and classes

- No function expressions (`function () {}` as a value). Use arrow functions. [arkts-no-func-expressions]
- No functions declared inside functions. Use an arrow function in a `const`. [arkts-no-nested-funcs]
- No `this` in a standalone function. [arkts-no-standalone-this]
- No `call`, `apply` or `bind` on functions. [arkts-no-func-apply-call] [arkts-no-func-bind]
- No generator functions. [arkts-no-generators]
- A method cannot be reassigned on an object (`obj.method = ...`). [arkts-no-method-reassignment]
- No `#private` names; use the `private` keyword. [arkts-no-private-identifiers]
- No `!` definite assignment on fields; initialise them. [arkts-no-definite-assignment]
- No fields declared in constructor parameters (`constructor(private x: number)`). [arkts-no-ctor-prop-decls]
- No `Symbol()` keys except `Symbol.iterator`. [arkts-no-symbol]
- An enum's members are all numbers or all strings, with constant values. [arkts-no-enum-mixed-types]
- `Object.assign`, `Object.defineProperty`, `Reflect`, `Proxy`, `eval` and similar dynamic APIs are not available. [arkts-limited-stdlib]
- No `globalThis`, no `require`, no `export =`. [arkts-no-globalthis] [arkts-no-require] [arkts-no-export-assignment]

## ArkUI

- A UI component is a `struct` with `@Component` and a `build()` method. A page adds `@Entry`.
  It is not a function and not a class, and there is no JSX.
- A struct must not be named like a built-in component (`Text`, `Counter`, `Search`, `Menu`, `Badge`...).
- `build()` contains only component descriptions, `if`/`else`, `ForEach` and `LazyForEach`.
  No local variables, no `return`, no `.map()` to produce components.
- Children go in a trailing block: `Column() { Text('a') }`. Attributes are chained calls: `.fontSize(16)`.
  There is no `style` object and no CSS.
- State that changes the screen is a field with a decorator: `@State` (owned by this component),
  `@Prop` (one-way copy from the parent), `@Link` (two-way with the parent, passed as `$name` or `this.name`),
  `@Provide`/`@Consume` (to descendants), `@StorageLink`/`@StorageProp` (app-wide `AppStorage`).
- A nested object is observed only one level deep. For objects inside arrays or objects, the class needs
  `@Observed` and the child component receives it as `@ObjectLink`.
- Lists: `ForEach(array, (item: T) => { ... }, (item: T) => key)`. Give the key function.
- Reusable UI fragments are `@Builder` functions or methods. Shared attributes are `@Styles` and `@Extend(Component)`.
- Lifecycle: `aboutToAppear()` and `aboutToDisappear()` on components, `onPageShow()` and `onPageHide()` on pages.
- Many attributes take enums, not strings: `InputType.Password`, `FontWeight.Bold`, `FlexAlign.Center`, `Color.Red`.
- There is no DOM and no browser: no `window`, `document`, `fetch`, `localStorage`, `alert`.
  Platform features come from kits: `import { router, promptAction } from '@kit.ArkUI'`,
  `import { http } from '@kit.NetworkKit'`, `import { preferences } from '@kit.ArkData'`.
