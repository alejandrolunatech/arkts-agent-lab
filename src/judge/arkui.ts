// Two things the HarmonyOS build does to ArkUI code that the type checker alone does not.
//
// 1. It forgives what only looks wrong to a type checker. `@Link total: number;` has no
//    initializer on purpose (the exempt decorators are read from the linter itself, not typed
//    here), and `$$this.name` is the two-way binding spelling, not an unknown name.
//
// 2. It rejects ordinary statements inside `build()`. That check lives in the build step
//    (ets-loader), which the lab does not run, so `uiSyntaxFindings` is our own, deliberately
//    cautious version: it flags only statements that can never be UI descriptions.

import type * as TS from 'ohos-typescript';
import { ts } from './program.ts';

const linter = ts.ArkTSLinter_1_1 as unknown as {
  NON_INITIALIZABLE_PROPERTY_DECORATORS: string[];
  NON_INITIALIZABLE_PROPERTY_CLASS_DECORATORS: string[];
  NON_RETURN_FUNCTION_DECORATORS: string[];
};

const NO_INITIALIZER = 2564;
const NO_RETURN = 2366;

/**
 * The decorators written on a declaration. TypeScript has no decorators on functions, so the
 * parser keeps `@Builder` of `@Builder function row() {}` apart, as an "illegal" decorator that
 * `getDecorators` does not return. In ArkUI that spelling is the ordinary global builder.
 */
function decoratorsOf(node: TS.Node): readonly TS.Decorator[] {
  const onFunction = (node as { illegalDecorators?: readonly TS.Decorator[] }).illegalDecorators ?? [];
  return [...(ts.getDecorators(node as TS.HasDecorators) ?? []), ...onFunction];
}

function decoratorNames(node: TS.Node): string[] {
  const names: string[] = [];
  for (const d of decoratorsOf(node)) {
    const target = ts.isCallExpression(d.expression) ? d.expression.expression : d.expression;
    if (ts.isIdentifier(target)) names.push(target.text);
  }
  return names;
}

const hasAny = (names: string[], wanted: string[]): boolean => names.some((n) => wanted.includes(n));

const CANNOT_FIND_NAME = /^Cannot find name '(\$\$?)(\w+)'/;
const NO_SUCH_PROPERTY = /^Property '\$(\w+)' does not exist on type/;

/** The innermost node that starts exactly at `start`, or the innermost one around it. */
function nodeAt(tree: TS.SourceFile, start: number): TS.Node {
  let found: TS.Node = tree;
  const visit = (node: TS.Node): void => {
    if (start < node.getStart() || start >= node.getEnd()) return;
    found = node;
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(tree, visit);
  return found;
}

function enclosingStruct(node: TS.Node): TS.StructDeclaration | undefined {
  for (let current: TS.Node | undefined = node; current; current = current.parent) {
    if (ts.isStructDeclaration(current)) return current;
  }
  return undefined;
}

/** True when the struct around `node` declares a field with this name. */
function hasField(node: TS.Node, name: string): boolean {
  const struct = enclosingStruct(node);
  return struct !== undefined && struct.members.some((member) => ts.isPropertyDeclaration(member) && member.name.getText() === name);
}

/**
 * `$$this.name`, `$name` and `this.$name` are ArkUI's two-way binding spellings. To the type
 * checker they are unknown names; the build step accepts them when they point at a field of
 * the struct they are written in.
 */
function isTwoWayBinding(tree: TS.SourceFile, d: TS.Diagnostic): boolean {
  if (d.start === undefined) return false;
  const message = ts.flattenDiagnosticMessageText(d.messageText, '\n');
  const node = nodeAt(tree, d.start);
  const name = CANNOT_FIND_NAME.exec(message);
  if (name) {
    if (name[2] !== 'this') return hasField(node, name[2]!);
    // `$$this` alone says nothing: the field after the dot must exist, because nothing else checks it.
    const access = node.parent;
    return name[1] === '$$' && ts.isPropertyAccessExpression(access) && access.expression === node && hasField(node, access.name.text);
  }
  const property = NO_SUCH_PROPERTY.exec(message);
  return property ? hasField(node, property[1]!) : false;
}

/** True when the real toolchain drops this compiler diagnostic for an ArkUI reason. */
export function forgivenByArkUi(tree: TS.SourceFile, d: TS.Diagnostic): boolean {
  if (isTwoWayBinding(tree, d)) return true;
  if (d.start === undefined || (d.code !== NO_INITIALIZER && d.code !== NO_RETURN)) return false;
  const start = d.start;
  let forgiven = false;

  const visit = (node: TS.Node): void => {
    if (forgiven || start < node.getFullStart() || start > node.getEnd()) return;
    if (d.code === NO_INITIALIZER && ts.isPropertyDeclaration(node) && node.name.getStart() === start) {
      const isDialogController = node.type?.getText() === 'CustomDialogController';
      forgiven =
        hasAny(decoratorNames(node), linter.NON_INITIALIZABLE_PROPERTY_DECORATORS) ||
        (isDialogController && hasAny(decoratorNames(node.parent), linter.NON_INITIALIZABLE_PROPERTY_CLASS_DECORATORS));
      return;
    }
    if (d.code === NO_RETURN && (ts.isMethodDeclaration(node) || ts.isFunctionDeclaration(node))) {
      const bodyStart = node.body?.getStart() ?? node.parameters.end;
      if (start >= node.parameters.end && start <= bodyStart && hasAny(decoratorNames(node), linter.NON_RETURN_FUNCTION_DECORATORS)) {
        forgiven = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(tree);
  return forgiven;
}

export interface UiSyntaxProblem {
  start: number;
  /** Just after the statement. */
  end: number;
  message: string;
}

const MESSAGE = 'Only UI component syntax can be written in build(), @Builder functions and component blocks';

/** `Column() { ... }.width('100%')` → the innermost call the chain starts from. */
function chainRoot(expression: TS.Expression): TS.Expression {
  let current = expression;
  for (;;) {
    if (!ts.isCallExpression(current) && !ts.isEtsComponentExpression(current)) return current;
    const callee: TS.Expression = current.expression;
    if (!ts.isPropertyAccessExpression(callee)) return current;
    const receiver = callee.expression;
    // `.width(...)` on a call is an attribute: keep walking. `this.header()` or `items.map()` is the root itself.
    if (!ts.isCallExpression(receiver) && !ts.isEtsComponentExpression(receiver)) return current;
    current = receiver;
  }
}

/** Names declared in one place that are, or are not, UI builders. */
interface Scope {
  /** Carry `@Builder` or `@LocalBuilder`, or are `@BuilderParam` fields. */
  builders: Set<string>;
  /** Declared without such a decorator. */
  plain: Set<string>;
}

/**
 * What the file itself tells us about builders. A bare call `header()` can only reach a top-level
 * function and `this.header()` only a member of the struct it is written in, so each is looked up
 * in its own scope: a `@Builder title()` in one struct says nothing about `title()` in another.
 */
interface BuilderNames {
  functions: Scope;
  structs: Map<TS.StructDeclaration, Scope>;
}

const isPlainIn = (scope: Scope | undefined, name: string): boolean => scope !== undefined && scope.plain.has(name) && !scope.builders.has(name);

function builderNames(tree: TS.SourceFile): BuilderNames {
  const names: BuilderNames = { functions: { builders: new Set(), plain: new Set() }, structs: new Map() };
  const note = (scope: Scope, node: TS.Node, name: string): void => {
    const isBuilder = hasAny(decoratorNames(node), ['Builder', 'LocalBuilder', 'BuilderParam']);
    (isBuilder ? scope.builders : scope.plain).add(name);
  };
  const visit = (node: TS.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name && ts.isSourceFile(node.parent)) note(names.functions, node, node.name.text);
    if (ts.isStructDeclaration(node)) {
      const scope: Scope = { builders: new Set(), plain: new Set() };
      for (const member of node.members) {
        if (ts.isMethodDeclaration(member)) note(scope, member, member.name.getText());
        if (ts.isPropertyDeclaration(member) && hasAny(decoratorNames(member), ['BuilderParam'])) scope.builders.add(member.name.getText());
      }
      names.structs.set(node, scope);
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return names;
}

function checkUiBlock(block: TS.Block, problems: UiSyntaxProblem[], names: BuilderNames): void {
  for (const statement of block.statements) checkUiStatement(statement, problems, names);
}

function checkUiStatement(statement: TS.Statement, problems: UiSyntaxProblem[], names: BuilderNames): void {
  const flag = (): void => void problems.push({ start: statement.getStart(), end: statement.getEnd(), message: MESSAGE });

  if (ts.isIfStatement(statement)) {
    for (const branch of [statement.thenStatement, statement.elseStatement]) {
      if (!branch) continue;
      if (ts.isBlock(branch)) checkUiBlock(branch, problems, names);
      else checkUiStatement(branch, problems, names);
    }
    return;
  }
  if (ts.isBlock(statement)) return checkUiBlock(statement, problems, names);
  if (ts.isEmptyStatement(statement)) return;
  if (!ts.isExpressionStatement(statement)) return flag(); // let, const, return, for, while, switch...

  const root = chainRoot(statement.expression);
  if (!ts.isCallExpression(root) && !ts.isEtsComponentExpression(root)) return flag(); // `a && Text()`, `c ? A() : B()`

  const callee = root.expression;
  if (ts.isIdentifier(callee)) {
    // A component, a custom component, a @Builder function, ForEach... but not an ordinary function of this file.
    if (isPlainIn(names.functions, callee.text)) return flag();
    if (ts.isEtsComponentExpression(root) && root.body) checkUiBlock(root.body, problems, names);
    if (callee.text === 'ForEach' || callee.text === 'LazyForEach') {
      const itemBuilder = root.arguments[1];
      if (itemBuilder && ts.isArrowFunction(itemBuilder) && ts.isBlock(itemBuilder.body)) checkUiBlock(itemBuilder.body, problems, names);
    }
    return;
  }
  if (ts.isPropertyAccessExpression(callee) && callee.expression.kind === ts.SyntaxKind.ThisKeyword) {
    // this.rowBuilder() is UI; this.plainMethod() is not.
    const struct = enclosingStruct(statement);
    if (isPlainIn(struct && names.structs.get(struct), callee.name.text)) flag();
    return;
  }
  flag(); // items.map(...), console.log(...), [1, 2].forEach(...)
}

/** Our stand-in for the build step's "only UI syntax here" check. */
export function uiSyntaxProblems(tree: TS.SourceFile): UiSyntaxProblem[] {
  const problems: UiSyntaxProblem[] = [];
  const names = builderNames(tree);

  const visit = (node: TS.Node): void => {
    const isBuild = ts.isMethodDeclaration(node) && ts.isStructDeclaration(node.parent) && node.name.getText() === 'build';
    const isBuilder =
      (ts.isMethodDeclaration(node) || ts.isFunctionDeclaration(node)) && hasAny(decoratorNames(node), ['Builder', 'LocalBuilder']);
    if ((isBuild || isBuilder) && node.body) {
      checkUiBlock(node.body, problems, names);
      return;
    }
    ts.forEachChild(node, visit);
  };

  visit(tree);
  return problems;
}
