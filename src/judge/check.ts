// Static check of ArkTS source: the three layers an IDE can give an agent
// before anything runs.
//
//   syntax  the file does not parse as ArkTS
//   type    it parses, but a name, property or argument does not exist in the HarmonyOS API
//   arkts   it is valid TypeScript that ArkTS forbids (`any`, destructuring, object spread...)
//   arkui   it puts ordinary statements where only UI descriptions may stand (see arkui.ts)

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type * as TS from 'ohos-typescript';
import { forgivenByArkUi, uiSyntaxProblems } from './arkui.ts';
import { createArkProgram, ts } from './program.ts';

export type Layer = 'syntax' | 'type' | 'arkts' | 'arkui';

export interface Finding {
  layer: Layer;
  /** `TS2339` for compiler findings, the rule name (`arkts-no-any-unknown`) for linter findings. */
  code: string;
  severity: 'error' | 'warning';
  file: string;
  /** 1-based. */
  line: number;
  /** 1-based. */
  column: number;
  message: string;
}

const RULE_NAME = /\((arkts-[a-z0-9-]+)\)\s*$/;

function toFinding(layer: Layer, d: TS.Diagnostic, root: string): Finding | undefined {
  if (!d.file || d.start === undefined) return undefined;
  const pos = d.file.getLineAndCharacterOfPosition(d.start);
  const message = ts.flattenDiagnosticMessageText(d.messageText, '\n');
  const rule = layer === 'arkts' ? RULE_NAME.exec(message)?.[1] : undefined;
  return {
    layer,
    code: rule ?? `TS${d.code}`,
    severity: d.category === ts.DiagnosticCategory.Warning ? 'warning' : 'error',
    file: path.relative(root, d.file.fileName),
    line: pos.line + 1,
    column: pos.character + 1,
    message,
  };
}

export interface CheckResult {
  findings: Finding[];
  /** Syntax trees of the checked files, by absolute path. Used by the structure check. */
  trees: Map<string, TS.SourceFile>;
}

/**
 * Checks `.ets` files that exist on disk. `root` is only used to print short paths.
 * Findings come back sorted by position, errors and warnings together.
 */
export function checkFiles(files: string[], root: string): CheckResult {
  const { builder, program } = createArkProgram(files);
  const wanted = new Set(files.map((f) => path.resolve(f)));
  const findings: Finding[] = [];
  const trees = new Map<string, TS.SourceFile>();

  for (const file of files) {
    const source = program.getSourceFile(file);
    if (!source) continue;
    trees.set(path.resolve(file), source);
    for (const d of program.getSyntacticDiagnostics(source)) pushIf(findings, toFinding('syntax', d, root));
    for (const d of program.getSemanticDiagnostics(source)) {
      if (!forgivenByArkUi(source, d)) pushIf(findings, toFinding('type', d, root));
    }
  }

  // The linter needs a tree it can trust: on a syntax error its findings are noise.
  if (!findings.some((f) => f.layer === 'syntax')) {
    for (const d of ts.ArkTSLinter_1_1.runArkTSLinter(builder, undefined, undefined, '1.1')) {
      if (d.file && wanted.has(path.resolve(d.file.fileName))) pushIf(findings, toFinding('arkts', d, root));
    }
    for (const [file, tree] of trees) {
      for (const problem of uiSyntaxProblems(tree)) {
        const pos = tree.getLineAndCharacterOfPosition(problem.start);
        findings.push({
          layer: 'arkui',
          code: 'arkui-only-ui-syntax',
          severity: 'error',
          file: path.relative(root, file),
          line: pos.line + 1,
          column: pos.character + 1,
          message: problem.message,
        });
      }
    }
  }

  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column);
  return { findings, trees };
}

function pushIf(list: Finding[], finding: Finding | undefined): void {
  if (finding) list.push(finding);
}

export interface SourceCheck {
  findings: Finding[];
  tree: TS.SourceFile | undefined;
}

/** Checks one file given as text. Writes it to a private temp folder first. */
export function checkSource(source: string, fileName = 'solution.ets'): SourceCheck {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'arkts-check-')));
  try {
    const file = path.join(dir, fileName);
    fs.writeFileSync(file, source);
    const result = checkFiles([file], dir);
    return { findings: result.findings, tree: result.trees.get(file) };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export function errorsOf(findings: Finding[]): Finding[] {
  return findings.filter((f) => f.severity === 'error');
}

/** One finding as an agent or a terminal reads it. */
export function formatFinding(f: Finding): string {
  return `${f.file}:${f.line}:${f.column} ${f.severity} [${f.code}] ${f.message}`;
}
