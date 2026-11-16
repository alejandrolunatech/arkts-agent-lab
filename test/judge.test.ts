import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { runBehaviourTests } from '../src/judge/behaviour.ts';
import { checkSource, errorsOf } from '../src/judge/check.ts';
import { judge } from '../src/judge/judge.ts';
import { checkStructure } from '../src/judge/structure.ts';
import { loadTask, readSolution, tasksDir } from '../src/tasks.ts';

const codes = (source: string): string[] => errorsOf(checkSource(source).findings).map((f) => f.code);

const page = (body: string, fields = ''): string => `
@Entry
@Component
struct DemoPage {
  @State items: string[] = ['a', 'b'];
  @State on: boolean = true;
  ${fields}
  @Builder
  title(text: string) {
    Text(text)
  }

  build() {
    Column() {
${body}
    }
  }
}
`;

test('plain typed ArkTS has no findings', () => {
  assert.deepEqual(codes('export function double(x: number): number {\n  return x * 2;\n}\n'), []);
});

test('TypeScript that ArkTS forbids is reported by rule name', () => {
  const found = codes('var legacy: any = 1;\nconst { a } = legacy;\nexport const x: number = a;\n');
  assert.ok(found.includes('arkts-no-var'));
  assert.ok(found.includes('arkts-no-any-unknown'));
  assert.ok(found.includes('arkts-no-destruct-decls'));
});

test('a syntax error is reported in the syntax layer and silences the linter', () => {
  const { findings } = checkSource('export function broken(: number {\n');
  assert.ok(findings.length > 0);
  assert.ok(findings.every((f) => f.layer === 'syntax' || f.layer === 'type'));
});

test('an ArkUI page parses as UI and type-checks against the SDK', () => {
  assert.deepEqual(codes(page("      Text('hello').fontSize(20)")), []);
});

test('an attribute that does not exist in the SDK is a type error', () => {
  assert.deepEqual(codes(page("      Text('hello').notAThing(3)")), ['TS2339']);
});

test('a web API that does not exist on HarmonyOS is a type error', () => {
  const found = codes('export function save(v: string): void {\n  localStorage.setItem("k", v);\n}\n');
  assert.ok(found.includes('TS2304') || found.includes('TS2552'), found.join(','));
});

test('fields the parent fills in need no initializer; other fields do', () => {
  const child = (field: string): string => `
@Component
struct Child {
  ${field}
  build() {
    Text('x')
  }
}
`;
  assert.deepEqual(codes(child('@Link total: number;')), []);
  assert.deepEqual(codes(child('@Prop label: string;')), []);
  assert.deepEqual(codes(child('total: number;')), ['TS2564']);
});

test('two-way binding spellings are accepted when they point at a field', () => {
  assert.deepEqual(codes(page('      TextInput({ text: $$this.name })', "@State name: string = '';")), []);
  assert.ok(codes(page('      TextInput({ text: $$nothing })')).length > 0);
});

test('reading the error in a catch block is allowed, as on the platform', () => {
  const source = 'export function describe(run: () => void): string {\n  try {\n    run();\n    return "ok";\n  } catch (err) {\n    return `failed: ${(err as Error).message}`;\n  }\n}\n';
  assert.deepEqual(codes(source), []);
});

test('a plain method that returns a component is not a builder', () => {
  const plain = "\n  label(): void {\n    Text('x')\n  }\n";
  assert.deepEqual(codes(page('      this.label()', plain)), ['arkui-only-ui-syntax']);
});

test('ordinary statements inside build() are rejected, UI descriptions are not', () => {
  const only = 'arkui-only-ui-syntax';
  assert.deepEqual(codes(page("      this.on && Text('a')")), [only]);
  assert.deepEqual(codes(page("      this.items.map((item: string) => Text(item))")), [only]);
  assert.deepEqual(codes(page('      let n: number = 1;')), [only]);
  assert.deepEqual(codes(page("      if (this.on) {\n        console.log('x')\n      }")), [only]);
  assert.deepEqual(
    codes(
      page(`      this.title('t')
      if (this.on) {
        Text('on')
      } else {
        Text('off')
      }
      ForEach(this.items, (item: string) => {
        Row() {
          Text(item)
        }
        .onClick(() => {
          const copy: string[] = this.items.slice();
          this.items = copy;
        })
      }, (item: string) => item)`),
    ),
    [],
  );
});

test('the structure check reads building blocks from the tree', () => {
  const source = page("      ForEach(this.items, (item: string) => {\n        Text(item).onClick(() => {})\n      })");
  const { tree } = checkSource(source);
  assert.ok(tree);
  assert.deepEqual(checkStructure(tree, { decorators: ['Entry', 'State'], components: ['Column', 'Text'], calls: ['onClick'], minStructs: 1 }), {
    passed: true,
    missing: [],
  });
  const strict = checkStructure(tree, { components: ['List'], forEachKeyed: true, minStructs: 2 });
  assert.equal(strict.passed, false);
  assert.equal(strict.missing.length, 3);
});

test('behaviour tests run the solution and report what failed', () => {
  const task = loadTask(path.join(tasksDir, 'L01-total-by-category'));
  assert.equal(runBehaviourTests(readSolution(task, 'reference'), task.testsFile!).passed, true);
  const wrong = 'export function totalByCategory(): Map<string, number> {\n  return new Map<string, number>();\n}\n';
  const result = runBehaviourTests(wrong, task.testsFile!);
  assert.equal(result.passed, false);
  assert.match(result.detail, /sums amounts per category/);
});

test('model-written code cannot write files while it is being tested', () => {
  const task = loadTask(path.join(tasksDir, 'L01-total-by-category'));
  const hostile = `import fs from 'node:fs';
export function totalByCategory(): Map<string, number> {
  fs.writeFileSync('/tmp/arkts-agent-lab-should-not-exist', 'x');
  return new Map<string, number>();
}
`;
  const result = runBehaviourTests(hostile, task.testsFile!);
  assert.equal(result.passed, false);
});

test('the judge passes a reference, and names the layer that stops a wrong answer', () => {
  const logic = loadTask(path.join(tasksDir, 'L01-total-by-category'));
  assert.equal(judge(logic, readSolution(logic, 'reference')).failedAt, 'none');
  assert.equal(judge(logic, readSolution(logic, 'trap')).failedAt, 'static');
  const empty = 'export interface Expense {\n  category: string;\n  amount: number;\n}\nexport function totalByCategory(expenses: Expense[]): Map<string, number> {\n  return new Map<string, number>();\n}\n';
  assert.equal(judge(logic, empty).failedAt, 'behaviour');

  const ui = loadTask(path.join(tasksDir, 'U01-counter-page'));
  assert.equal(judge(ui, readSolution(ui, 'reference')).passed, true);
  const noButtons = "@Entry\n@Component\nstruct CounterPage {\n  @State count: number = 0;\n  build() {\n    Column() {\n      Text(`${this.count}`)\n    }\n  }\n}\n";
  const verdict = judge(ui, noButtons);
  assert.equal(verdict.failedAt, 'structure');
  assert.match(verdict.detail, /Button/);
});

test('a logic solution that imports a module breaks the contract', () => {
  const logic = loadTask(path.join(tasksDir, 'L01-total-by-category'));
  const withImport = `import { router } from '@kit.ArkUI';\n${readSolution(logic, 'reference')}`;
  const verdict = judge(logic, withImport);
  assert.deepEqual(verdict.findings, []);
  assert.equal(verdict.passed, false);
  assert.match(verdict.detail, /self-contained/);
});
