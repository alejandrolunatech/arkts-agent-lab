// Structure check for UI tasks. A page cannot be run without a device or an emulator,
// so for UI we ask a narrower question the syntax tree can answer: did the solution use
// the building blocks the task asked for?
//
// This is the honest limit of the lab: it does not prove the page looks or behaves right.

import type * as TS from 'ohos-typescript';
import { ts } from './program.ts';

/** What a UI task can require. Every field is optional; an empty object requires nothing. */
export interface StructureSpec {
  /**
   * Decorators that must appear, without the `@`: `Entry`, `State`, `Builder`...
   * In this list and the next two, `A|B` accepts either name.
   */
  decorators?: string[];
  /** ArkUI components that must be used: `List`, `ForEach`, `TextInput`... */
  components?: string[];
  /** Attribute or method names that must be called with a dot: `onClick`, `pushUrl`... */
  calls?: string[];
  /** Every `ForEach` must pass a key generator as its third argument. */
  forEachKeyed?: boolean;
  /** Minimum number of `struct` components declared in the file. */
  minStructs?: number;
}

export interface StructureResult {
  passed: boolean;
  missing: string[];
}

interface Facts {
  decorators: Set<string>;
  components: Set<string>;
  calls: Set<string>;
  structs: number;
  unkeyedForEach: number;
}

function collect(source: TS.SourceFile): Facts {
  const facts: Facts = { decorators: new Set(), components: new Set(), calls: new Set(), structs: 0, unkeyedForEach: 0 };

  const visit = (node: TS.Node): void => {
    if (ts.isDecorator(node)) {
      const target = ts.isCallExpression(node.expression) ? node.expression.expression : node.expression;
      if (ts.isIdentifier(target)) facts.decorators.add(target.text);
    }
    if (ts.isStructDeclaration(node)) facts.structs += 1;
    // `Text('a')` is a call; `Column() { ... }` is the fork's own node kind. Both carry
    // the callee in `expression` and the arguments in `arguments`.
    if (ts.isCallExpression(node) || ts.isEtsComponentExpression(node)) {
      const callee = node.expression;
      if (ts.isIdentifier(callee)) {
        facts.components.add(callee.text);
        if (callee.text === 'ForEach' && node.arguments.length < 3) facts.unkeyedForEach += 1;
      }
      if (ts.isPropertyAccessExpression(callee)) facts.calls.add(callee.name.text);
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return facts;
}

/** `tree` must come from the ArkTS program: only there is UI syntax parsed as UI. */
export function checkStructure(tree: TS.SourceFile, spec: StructureSpec): StructureResult {
  const facts = collect(tree);
  const missing: string[] = [];

  // `State|Local` means either one: HarmonyOS has two generations of state decorators and both are right.
  const has = (seen: Set<string>, wanted: string): boolean => wanted.split('|').some((name) => seen.has(name));
  for (const name of spec.decorators ?? []) if (!has(facts.decorators, name)) missing.push(`decorator @${name}`);
  for (const name of spec.components ?? []) if (!has(facts.components, name)) missing.push(`component ${name}`);
  for (const name of spec.calls ?? []) if (!has(facts.calls, name)) missing.push(`call .${name}()`);
  if (spec.forEachKeyed && facts.unkeyedForEach > 0) missing.push('ForEach without a key generator');
  if (spec.minStructs !== undefined && facts.structs < spec.minStructs) {
    missing.push(`${spec.minStructs} struct component(s), found ${facts.structs}`);
  }

  return { passed: missing.length === 0, missing };
}
