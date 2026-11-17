// The judge: decides, with no model involved, whether a solution to a task is right.
//
//   static     no syntax, type or ArkTS-rule errors            (every task)
//   behaviour  the hidden tests pass                           (logic tasks)
//   structure  the required UI building blocks are present     (ui tasks)

import type { Task } from '../tasks.ts';
import { runBehaviourTests } from './behaviour.ts';
import { checkSource, errorsOf, type Finding } from './check.ts';
import { ts } from './program.ts';
import { checkStructure } from './structure.ts';

/**
 * Raised when a fix changes what the judge accepts or rejects, so that a results file can tell
 * which of its attempts an earlier judge wrote. Each attempt record carries it.
 *
 *   1  the judge of the first full evaluation (records written then carry no number)
 *   2  a call to a top-level `@Builder` function is UI, and the body of that function is checked
 */
export const JUDGE_VERSION = 2;

export interface Verdict {
  passed: boolean;
  /** Which layer stopped it; `none` when it passed. */
  failedAt: 'none' | 'static' | 'behaviour' | 'structure';
  /** All static findings, warnings included. */
  findings: Finding[];
  /** Reason from the behaviour or structure layer, empty otherwise. */
  detail: string;
}

/** The static layer alone: what the verification loop is allowed to show the model. */
export function staticCheck(source: string): Finding[] {
  return checkSource(source).findings;
}

export function judge(task: Task, source: string): Verdict {
  const { findings, tree } = checkSource(source);
  if (errorsOf(findings).length > 0) return { passed: false, failedAt: 'static', findings, detail: '' };

  if (task.kind === 'logic') {
    // The hidden tests run on plain JavaScript, where a HarmonyOS kit cannot be loaded.
    // The prompt says so; an import is a broken contract, not a crash to puzzle over.
    if (tree!.statements.some((s) => ts.isImportDeclaration(s))) {
      return { passed: false, failedAt: 'behaviour', findings, detail: 'the file imports a module; logic tasks must be self-contained' };
    }
    const result = runBehaviourTests(source, task.testsFile!);
    if (!result.passed) return { passed: false, failedAt: 'behaviour', findings, detail: result.detail };
  } else {
    const result = checkStructure(tree!, task.structure!);
    if (!result.passed) return { passed: false, failedAt: 'structure', findings, detail: `missing: ${result.missing.join(', ')}` };
  }

  return { passed: true, failedAt: 'none', findings, detail: '' };
}
