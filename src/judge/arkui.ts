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

function decoratorNames(node: TS.Node): string[] {
  const names: string[] = [];
  for (const d of ts.getDecorators(node as TS.HasDecorators) ?? []) {
    const target = ts.isCallExpression(d.expression) ? d.expression.expression : d.expression;
    if (ts.isIdentifier(target)) names.push(target.text);
  }
  return names;
}

const hasAny = (names: string[], wanted: string[]): boolean => names.some((n) => wanted.includes(n));

const CANNOT_FIND_NAME = /^Cannot find name '(\$\$?)(\w+)'/;
const NO_SUCH_PROPERTY = /^Property '\$(\w+)' does not exist on type/;

/** Names of the fields declared in the file's structs. */
function structFields(tree: TS.SourceFile): Set<string> {
  const names = new Set<string>();
  const visit = (node: TS.Node): void => {
    if (ts.isStructDeclaration(node)) {
      for (const member of node.members) if (ts.isPropertyDeclaration(member)) names.add(member.name.getText());
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return names;
}

/**
 * `$$this.name` and `$name` are ArkUI's two-way binding spellings. To the type checker they
 * are unknown identifiers; the build step accepts them when they point at a field.
 */
function isTwoWayBinding(tree: TS.SourceFile, message: string): boolean {
  const name = CANNOT_FIND_NAME.exec(message);
  if (name) return name[2] === 'this' ? name[1] === '$$' : structFields(tree).has(name[2]!);
  const property = NO_SUCH_PROPERTY.exec(message);
  return property ? structFields(tree).has(property[1]!) : false;
}

/** True when the real toolchain drops this compiler diagnostic for an ArkUI reason. */
export function forgivenByArkUi(tree: TS.SourceFile, d: TS.Diagnostic): boolean {
  if (isTwoWayBinding(tree, ts.flattenDiagnosticMessageText(d.messageText, '\n'))) return true;
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

/** What the file itself tells us about names that are, or are not, UI builders. */
interface BuilderNames {
  /** Methods of structs and top-level functions that carry `@Builder` or `@LocalBuilder`, and `@BuilderParam` fields. */
  builders: Set<string>;
  /** Methods and top-level functions declared in the file without such a decorator. */
  plain: Set<string>;
}

function builderNames(tree: TS.SourceFile): BuilderNames {
  const names: BuilderNames = { builders: new Set(), plain: new Set() };
  const note = (node: TS.Node, name: string): void => {
    const isBuilder = hasAny(decoratorNames(node), ['Builder', 'LocalBuilder', 'BuilderParam']);
    (isBuilder ? names.builders : names.plain).add(name);
  };
  const visit = (node: TS.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name && ts.isSourceFile(node.parent)) note(node, node.name.text);
    if (ts.isStructDeclaration(node)) {
      for (const member of node.members) {
        if (ts.isMethodDeclaration(member)) note(member, member.name.getText());
        if (ts.isPropertyDeclaration(member) && hasAny(decoratorNames(member), ['BuilderParam'])) names.builders.add(member.name.getText());
      }
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
    if (names.plain.has(callee.text) && !names.builders.has(callee.text)) return flag();
    if (ts.isEtsComponentExpression(root) && root.body) checkUiBlock(root.body, problems, names);
    if (callee.text === 'ForEach' || callee.text === 'LazyForEach') {
      const itemBuilder = root.arguments[1];
      if (itemBuilder && ts.isArrowFunction(itemBuilder) && ts.isBlock(itemBuilder.body)) checkUiBlock(itemBuilder.body, problems, names);
    }
    return;
  }
  if (ts.isPropertyAccessExpression(callee) && callee.expression.kind === ts.SyntaxKind.ThisKeyword) {
    // this.rowBuilder() is UI; this.plainMethod() is not.
    if (names.plain.has(callee.name.text) && !names.builders.has(callee.name.text)) flag();
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
