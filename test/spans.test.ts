// Where a finding starts and ends, and which file names the checker takes from outside.

import assert from 'node:assert/strict';
import test from 'node:test';
import { checkSource, etsFileName, type Finding } from '../src/judge/check.ts';

const SOURCE = `@Entry
@Component
struct DemoPage {
  @State value: any = 1;

  build() {
    Column() {
      Text('hello').notAThing(3)
      let n: number = 1;
    }
  }
}
`;

/** The text between a finding's start and its end. */
function covered(source: string, f: Finding): string {
  const lines = source.split('\n');
  assert.equal(f.endLine, f.line, 'these findings stay on one line');
  return lines[f.line - 1]!.slice(f.column - 1, f.endColumn! - 1);
}

test('a finding of each layer ends just after the code it is about', () => {
  const byCode = new Map(checkSource(SOURCE).findings.map((f) => [f.code, covered(SOURCE, f)]));
  assert.deepEqual(
    [...byCode],
    [
      ['arkts-no-any-unknown', 'any'],
      ['TS2339', 'notAThing'],
      ['arkui-only-ui-syntax', 'let n: number = 1;'],
    ],
  );
});

test('a finding with no width ends where it starts', () => {
  const missingBrace = checkSource('export function open(): void {\n').findings.at(-1)!;
  assert.equal(missingBrace.code, 'TS1005');
  assert.deepEqual([missingBrace.endLine, missingBrace.endColumn], [missingBrace.line, missingBrace.column]);
});

test('a file name from outside is reduced to a name that ends in .ets', () => {
  assert.equal(etsFileName('Index.ets'), 'Index.ets');
  assert.equal(etsFileName('/project/pages/Index.ets'), 'Index.ets');
  assert.equal(etsFileName('..\\..\\pages\\Index.ets'), 'Index.ets');
  assert.equal(etsFileName('../../etc/passwd'), 'solution.ets');
  assert.equal(etsFileName('notes.ts'), 'solution.ets');
  assert.equal(etsFileName('.ets'), 'solution.ets');
  assert.equal(etsFileName('pages/'), 'solution.ets');
  assert.equal(etsFileName(undefined), 'solution.ets');
});
