// The judge: decides, with no model involved, whether a solution to a task is right.
//
//   static     no syntax, type or ArkTS-rule errors            (every task)
//   behaviour  the hidden tests pass                           (logic tasks)
//   structure  the required UI building blocks are present     (ui tasks)

import type { Task } from '../tasks.ts';
import { runBehaviourTests } from './behaviour.ts';
import { checkSource, errorsOf, type Finding } from './check.ts';
import { checkStructure } from './structure.ts';

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
    const result = runBehaviourTests(source, task.testsFile!);
    if (!result.passed) return { passed: false, failedAt: 'behaviour', findings, detail: result.detail };
  } else {
    const result = checkStructure(tree!, task.structure!);
    if (!result.passed) return { passed: false, failedAt: 'structure', findings, detail: `missing: ${result.missing.join(', ')}` };
  }

  return { passed: true, failedAt: 'none', findings, detail: '' };
}
