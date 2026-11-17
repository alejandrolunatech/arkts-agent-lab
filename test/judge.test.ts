import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { runBehaviourTests } from '../src/judge/behaviour.ts';
import { checkSource, errorsOf } from '../src/judge/check.ts';
import { judge } from '../src/judge/judge.ts';
import { sharedDeclarationCount } from '../src/judge/program.ts';
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

test('a two-way binding must name a field of the struct it is written in', () => {
  // `$$this` alone used to be enough: the misspelled field went through with no finding at all.
  assert.ok(codes(page('      TextInput({ text: $$this.nmae })', "@State name: string = '';")).length > 0);
  // `label` is a field, but of another struct.
  const other = "\n@Component\nstruct Other {\n  @State label: string = '';\n  build() {\n    Text(this.label)\n  }\n}\n";
  assert.ok(codes(page('      TextInput({ text: $$this.label })') + other).length > 0);
  assert.ok(codes(page('      TextInput({ text: $label })') + other).length > 0);
});

test('a builder in one struct says nothing about a method of the same name in another', () => {
  // DemoPage has `@Builder title()`. Card has a plain `title()`, and calling it in build() is not UI.
  const card = "\n@Component\nstruct Card {\n  title(): void {\n    Text('x')\n  }\n  build() {\n    Column() {\n      this.title()\n    }\n  }\n}\n";
  assert.deepEqual(codes(page("      this.title('t')") + card), ['arkui-only-ui-syntax']);
  // And the other way round: a plain top-level function does not turn a struct's builder into plain code.
  const helper = "\nfunction title(): string {\n  return 't';\n}\n";
  assert.deepEqual(codes(page("      this.title('t')") + helper), []);
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

test('a top-level @Builder function is a builder: calling it is UI, and its body holds only UI', () => {
  const withGlobal = (builder: string, call: string): string => `${builder}\n${page(call)}`;
  const row = "function LabelRow(text: string) {\n  Row() {\n    Text(text)\n  }\n}\n";
  // Every spelling of the decorator in front of a function, alone on its line or not, exported or not.
  for (const spelling of [`@Builder\n${row}`, `@Builder ${row}`, `@Builder\nexport ${row}`, `const GAP: number = 4;\n@Builder\n${row}`]) {
    assert.deepEqual(codes(withGlobal(spelling, "      LabelRow('a')")), []);
  }
  // Without the decorator it is an ordinary function, and calling it in build() is not UI.
  const plain = "function shout(text: string): string {\n  return text.toUpperCase();\n}\n";
  assert.deepEqual(codes(withGlobal(plain, "      shout('a')")), ['arkui-only-ui-syntax']);
  // The body of a global builder follows the same rule as build().
  const loops = "@Builder\nfunction Labels(items: string[]) {\n  items.map((item: string) => Text(item))\n}\n";
  assert.deepEqual(codes(withGlobal(loops, "      Labels(this.items)")), ['arkui-only-ui-syntax']);
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

test('a UI task asks only for what its prompt names: a list need not be a List', () => {
  const task = loadTask(path.join(tasksDir, 'U11-nested-object-update'));
  const withColumn = `
@Observed
class Person {
  name: string;
  score: number;

  constructor(name: string, score: number) {
    this.name = name;
    this.score = score;
  }
}

@Component
struct PersonRow {
  @ObjectLink person: Person;

  build() {
    Row() {
      Text(this.person.name + ': ' + this.person.score.toString())
      Button('+1').onClick(() => {
        this.person.score += 1;
      })
    }
  }
}

@Entry
@Component
struct PeoplePage {
  @State people: Person[] = [new Person('Ana', 3), new Person('Bruno', 5), new Person('Carla', 1)];

  build() {
    Column() {
      ForEach(this.people, (person: Person) => {
        PersonRow({ person: person })
      }, (person: Person) => person.name)
    }
  }
}
`;
  const verdict = judge(task, withColumn);
  assert.equal(verdict.detail, '');
  assert.equal(verdict.passed, true);
});

test('the SDK declarations are parsed once and shared, and a check does not depend on the checks before it', () => {
  // The linter in the fork keeps every source file it has seen. Parsing the declarations again for each
  // check made a long run grow by about 15 MB a check until Node ran out of memory.
  const ui = loadTask(path.join(tasksDir, 'U02-todo-list'));
  const trap = readSolution(ui, 'trap');
  const reference = readSolution(ui, 'reference');
  const first = checkSource(trap).findings;
  const shared = sharedDeclarationCount();
  assert.ok(shared > 100, `only ${shared} declaration files are shared`);

  assert.deepEqual(codes(reference), []);
  assert.deepEqual(codes('export function f(x: any): number {\n  return 1;\n}\n'), ['arkts-no-any-unknown']);
  assert.deepEqual(checkSource(trap).findings, first);
  assert.equal(sharedDeclarationCount(), shared);
});
