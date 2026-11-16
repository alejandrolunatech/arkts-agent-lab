// Builds an ArkTS program the same way the HarmonyOS toolchain does, but headless:
// the OpenHarmony fork of TypeScript (it parses `struct` and the ArkUI trailing-closure
// syntax and ships the official ArkTS linter) plus the HarmonyOS API declarations.
//
// Nothing here calls a model or a network. It is the "compiler in the loop".

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import type * as TS from 'ohos-typescript';

const require = createRequire(import.meta.url);

/** The OpenHarmony TypeScript fork. Loaded with require because it is CommonJS. */
export const ts: typeof TS = require('ohos-typescript');

/** Folder with the HarmonyOS API declarations (`component/`, `api/`, `kits/`). */
export const declarationsDir: string = path.dirname(require.resolve('@arkts/declarations'));

/** Folder with the fork's own `lib.*.d.ts` files. */
const typescriptLibDir: string = path.dirname(require.resolve('ohos-typescript'));

interface UiComponent {
  name: string;
  type: string;
  instance: string;
}

let cachedComponents: UiComponent[] | undefined;

/**
 * ArkUI components are ordinary identifiers in the declarations
 * (`declare const Text: TextInterface; declare const TextInstance: TextAttribute`).
 * The parser needs their names to treat `Text('hi') { ... }` as UI syntax, so we
 * read the list from the declarations instead of hard-coding it.
 */
export function uiComponents(): UiComponent[] {
  if (cachedComponents) return cachedComponents;
  const dir = path.join(declarationsDir, 'component');
  const found: UiComponent[] = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.d.ts')) continue;
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    const instances = new Map<string, string>();
    for (const m of text.matchAll(/declare const (\w+)Instance: (\w+);/g)) instances.set(m[1]!, m[2]!);
    for (const m of text.matchAll(/declare const (\w+): \w+Interface;/g)) {
      const type = instances.get(m[1]!);
      if (type) found.push({ name: m[1]!, type, instance: `${m[1]}Instance` });
    }
  }
  cachedComponents = found;
  return found;
}

/** The `ets` compiler option: what makes the fork parse ArkUI instead of plain TypeScript. */
function etsOptions(): TS.EtsOptions {
  const components = uiComponents();
  return {
    render: { method: ['build', 'pageTransition'], decorator: ['LocalBuilder', 'Builder'] },
    components: components.map((c) => c.name),
    libs: [],
    extend: { decorator: ['Extend', 'AnimatableExtend'], components },
    styles: {
      decorator: 'Styles',
      component: { name: 'Common', type: 'T', instance: 'CommonInstance' },
      property: 'stateStyles',
    },
    concurrent: { decorator: 'Concurrent' },
    customComponent: 'CustomComponent',
    propertyDecorators: [
      { name: 'Link', needInitialization: false },
      { name: 'Prop', needInitialization: false },
      { name: 'ObjectLink', needInitialization: false },
      { name: 'Consume', needInitialization: false },
    ],
    emitDecorators: [{ name: 'Monitor', emitParameters: true }],
    syntaxComponents: {
      paramsUICallback: ['ForEach', 'LazyForEach'],
      attrUICallback: [{ name: 'Repeat', attributes: ['each', 'template'] }],
    },
  } as TS.EtsOptions;
}

let cachedPaths: Record<string, string[]> | undefined;

/** `@kit.ArkUI`, `@ohos.router`... resolve through the path map the declarations ship. */
function apiPaths(): Record<string, string[]> {
  if (!cachedPaths) {
    const base = JSON.parse(fs.readFileSync(path.join(declarationsDir, 'tsconfig.base.json'), 'utf8'));
    cachedPaths = base.compilerOptions.paths as Record<string, string[]>;
  }
  return cachedPaths;
}

export function compilerOptions(): TS.CompilerOptions {
  return {
    target: ts.ScriptTarget.ES2021,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    lib: ['lib.es2021.d.ts'], // no DOM: ArkUI has its own `Text`, `Image`...
    // The same strict flags the ArkTS linter turns on for its own checker. Not `strict: true`:
    // that would also make `catch (e)` variables `unknown`, which the platform does not do.
    strictNullChecks: true,
    strictFunctionTypes: true,
    strictPropertyInitialization: true,
    noImplicitReturns: true,
    noEmit: true,
    skipLibCheck: true,
    allowArbitraryExtensions: true,
    experimentalDecorators: true,
    types: [],
    baseUrl: declarationsDir,
    paths: apiPaths(),
    ets: etsOptions(),
  };
}

/** Global declarations every ArkTS file sees without importing: components and decorators. */
function globalDeclarationFiles(): string[] {
  const dir = path.join(declarationsDir, 'component');
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.d.ts'))
    .map((f) => path.join(dir, f));
  files.push(path.join(declarationsDir, 'global.d.ts'));
  return files;
}

export interface ArkProgram {
  builder: TS.BuilderProgram;
  program: TS.Program;
}

/**
 * Parsed declaration files, kept for the life of the process and shared by every program.
 *
 * Without this, each check parsed the few hundred HarmonyOS declaration files again, and the
 * linter in the fork kept them all: it remembers every source file it has looked at in a
 * module-level map that nothing clears (`srcFilePathComponents` in its `Utils.ts`). That is
 * harmless in a build, which lints once and exits, and it ended a 1200-attempt evaluation with
 * "JavaScript heap out of memory" after about 300 checks. With the files shared, that map sees
 * the same objects again and only the checked file itself is new each time.
 *
 * Only files that never change during a run are kept: the TypeScript libraries and the API
 * declarations. The files being checked are always read from disk.
 */
const sharedDeclarations = new Map<string, TS.SourceFile>();

function isSharedDeclaration(fileName: string): boolean {
  if (!fileName.endsWith('.d.ts') && !fileName.endsWith('.d.ets')) return false;
  const resolved = path.resolve(fileName);
  return resolved.startsWith(declarationsDir + path.sep) || resolved.startsWith(typescriptLibDir + path.sep);
}

/** How many parsed declaration files are being shared. For tests. */
export function sharedDeclarationCount(): number {
  return sharedDeclarations.size;
}

function shareDeclarations(host: TS.CompilerHost): void {
  const read = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, languageVersionOrOptions, onError, shouldCreateNewSourceFile) => {
    if (!isSharedDeclaration(fileName)) return read(fileName, languageVersionOrOptions, onError, shouldCreateNewSourceFile);
    const key = path.resolve(fileName);
    let file = sharedDeclarations.get(key);
    if (!file) {
      file = read(fileName, languageVersionOrOptions, onError, shouldCreateNewSourceFile);
      if (file) sharedDeclarations.set(key, file);
    }
    return file;
  };
}

/** Creates a program for the given `.ets` files (absolute paths on disk). */
export function createArkProgram(files: string[]): ArkProgram {
  const options = compilerOptions();
  const host = ts.createIncrementalCompilerHost(options);
  shareDeclarations(host);
  const builder = ts.createIncrementalProgramForArkTs({
    rootNames: [...globalDeclarationFiles(), ...files],
    options,
    host,
  });
  return { builder, program: builder.getProgram() };
}
