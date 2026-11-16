// Command line of the lab. `npm run lab -- <command>`.

import fs from 'node:fs';
import path from 'node:path';
import { checkFiles, errorsOf, formatFinding } from './judge/check.ts';
import { verifyTasks } from './verify.ts';

const HELP = `arkts-agent-lab

  check <file.ets>...       run the ArkTS checker on files and print what it finds
  verify-tasks [id...]      prove every task: its reference passes, its trap fails
`;

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  switch (command) {
    case 'check': {
      if (rest.length === 0) return usage('check needs at least one file');
      const files = rest.map((f) => path.resolve(f));
      for (const f of files) if (!fs.existsSync(f)) return usage(`no such file: ${f}`);
      const { findings } = checkFiles(files, process.cwd());
      for (const finding of findings) console.log(formatFinding(finding));
      const errors = errorsOf(findings).length;
      console.log(errors === 0 ? 'No errors.' : `${errors} error(s).`);
      return errors === 0 ? 0 : 1;
    }
    case 'verify-tasks':
      return verifyTasks(rest) ? 0 : 1;
    default:
      console.log(HELP);
      return command ? 1 : 0;
  }
}

function usage(message: string): number {
  console.error(message);
  console.error(HELP);
  return 2;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
