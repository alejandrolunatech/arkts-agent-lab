// "Docs" context: a plain keyword search over the HarmonyOS API declarations.
//
// It answers the question an IDE can always answer and a model often cannot:
// "what does this API really look like?". The search is deliberately simple
// (BM25 over signatures and the first line of their doc comment), so that the
// experiment measures a baseline anyone can build, not a tuned retriever.

import fs from 'node:fs';
import path from 'node:path';
import type * as TS from 'ohos-typescript';
import { declarationsDir, ts } from '../judge/program.ts';
import { repoRoot } from '../tasks.ts';

export interface DocChunk {
  /** Where the symbol lives: `global` for ArkUI components, else the module (`@ohos.router`). */
  module: string;
  /** `router.pushUrl`, `TextAttribute`, `InputType`... */
  symbol: string;
  /** Signatures as shown to the model. */
  text: string;
}

const MEMBERS_PER_CHUNK = 20;

/** First sentence of the doc comment in front of a node, if any. */
function summaryOf(node: TS.Node): string {
  const lead = node.getFullText().slice(0, node.getLeadingTriviaWidth());
  const blocks = [...lead.matchAll(/\/\*\*([\s\S]*?)\*\//g)];
  const last = blocks[blocks.length - 1]?.[1];
  if (!last) return '';
  for (const raw of last.split('\n')) {
    const line = raw.replace(/^\s*\*?\s?/, '').trim();
    if (line && !line.startsWith('@')) return line.slice(0, 160);
  }
  return '';
}

function signature(node: TS.Node): string {
  const summary = summaryOf(node);
  const text = node.getText().replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
  return summary ? `  // ${summary}\n  ${text}` : `  ${text}`;
}

function chunksOfFile(file: string, module: string): DocChunk[] {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.ES2021, true, ts.ScriptKind.TS);
  const chunks: DocChunk[] = [];
  const seen = new Set<string>();
  const add = (symbol: string, text: string): void => {
    // The declarations repeat a symbol once per API version; keep one copy of each text.
    if (seen.has(text)) return;
    seen.add(text);
    chunks.push({ module, symbol, text });
  };

  const visit = (statements: readonly TS.Statement[], prefix: string): void => {
    for (const node of statements) {
      if (ts.isModuleDeclaration(node) && node.body && ts.isModuleBlock(node.body)) {
        visit(node.body.statements, `${prefix}${node.name.text}.`);
      } else if (ts.isInterfaceDeclaration(node) || ts.isClassDeclaration(node)) {
        const name = `${prefix}${node.name?.text ?? 'default'}`;
        const kind = ts.isInterfaceDeclaration(node) ? 'interface' : 'class';
        const members = [...node.members];
        for (let i = 0; i < Math.max(members.length, 1); i += MEMBERS_PER_CHUNK) {
          const part = members.slice(i, i + MEMBERS_PER_CHUNK).map(signature).join('\n');
          add(name, `${kind} ${name} {\n${part}\n}`);
        }
      } else if (ts.isFunctionDeclaration(node) && node.name) {
        add(`${prefix}${node.name.text}`, signature(node).trim());
      } else if (ts.isEnumDeclaration(node)) {
        const names = node.members.map((m) => m.name.getText()).join(', ');
        add(`${prefix}${node.name.text}`, `enum ${prefix}${node.name.text} { ${names} }`);
      } else if (ts.isTypeAliasDeclaration(node)) {
        add(`${prefix}${node.name.text}`, signature(node).trim());
      } else if (ts.isVariableStatement(node)) {
        for (const d of node.declarationList.declarations) add(`${prefix}${d.name.getText()}`, signature(node).trim());
      }
    }
  };

  visit(source.statements, '');
  return chunks;
}

/** A kit file is a list of re-exports: it tells which module a name is imported from. */
function kitChunk(file: string, module: string): DocChunk {
  const names = [...fs.readFileSync(file, 'utf8').matchAll(/export\s*\{([^}]*)\}/g)]
    .flatMap((m) => m[1]!.split(','))
    .map((n) => n.trim())
    .filter(Boolean);
  return { module, symbol: module, text: `import { ${names.join(', ')} } from '${module}';` };
}

function buildIndex(): DocChunk[] {
  const chunks: DocChunk[] = [];
  const dts = (dir: string): string[] =>
    fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.d\.e?ts$/.test(f)).map((f) => path.join(dir, f)) : [];
  const moduleName = (file: string): string => path.basename(file).replace(/\.d\.e?ts$/, '');

  for (const file of dts(path.join(declarationsDir, 'component'))) chunks.push(...chunksOfFile(file, 'global'));
  for (const file of dts(path.join(declarationsDir, 'api'))) chunks.push(...chunksOfFile(file, moduleName(file)));
  for (const file of dts(path.join(declarationsDir, 'kits'))) chunks.push(kitChunk(file, moduleName(file)));
  return chunks;
}

const STOP = new Set('the a an of to in on and or is are for with that this it as be by at from when each one two its not page file write'.split(' '));

/** `pushUrl` becomes `push`, `url`, `pushurl`. */
export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  for (const word of text.match(/[A-Za-z][A-Za-z0-9]+/g) ?? []) {
    const parts = word.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(' ');
    for (const p of parts) if (p.length > 1 && !STOP.has(p)) tokens.push(p);
    if (parts.length > 1) tokens.push(word.toLowerCase());
  }
  return tokens;
}

interface Indexed {
  chunk: DocChunk;
  counts: Map<string, number>;
  length: number;
}

export class DocSearch {
  private readonly docs: Indexed[];
  private readonly documentFrequency = new Map<string, number>();
  private readonly averageLength: number;

  constructor(chunks: DocChunk[]) {
    this.docs = chunks.map((chunk) => {
      // The symbol name counts three times: a hit on the name matters more than one in the body.
      const tokens = [...tokenize(chunk.symbol), ...tokenize(chunk.symbol), ...tokenize(chunk.symbol), ...tokenize(chunk.text)];
      const counts = new Map<string, number>();
      for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
      for (const t of counts.keys()) this.documentFrequency.set(t, (this.documentFrequency.get(t) ?? 0) + 1);
      return { chunk, counts, length: tokens.length };
    });
    this.averageLength = this.docs.reduce((sum, d) => sum + d.length, 0) / Math.max(this.docs.length, 1);
  }

  /** Best chunks for a query, as many as fit in `budgetChars`. */
  search(query: string, budgetChars = 6000, maxChunks = 12): DocChunk[] {
    const terms = [...new Set(tokenize(query))];
    const k1 = 1.2;
    const b = 0.75;
    const scored: { score: number; chunk: DocChunk }[] = [];
    for (const doc of this.docs) {
      let score = 0;
      for (const term of terms) {
        const tf = doc.counts.get(term);
        if (!tf) continue;
        const df = this.documentFrequency.get(term) ?? 0;
        const idf = Math.log(1 + (this.docs.length - df + 0.5) / (df + 0.5));
        score += (idf * (tf * (k1 + 1))) / (tf + k1 * (1 - b + (b * doc.length) / this.averageLength));
      }
      if (score > 0) scored.push({ score, chunk: doc.chunk });
    }
    scored.sort((x, y) => y.score - x.score);

    const picked: DocChunk[] = [];
    const perSymbol = new Map<string, number>();
    let used = 0;
    for (const { chunk } of scored) {
      if (picked.length >= maxChunks) break;
      if (used + chunk.text.length > budgetChars) continue;
      // Overloads and API versions of one symbol would otherwise fill the whole budget.
      const key = `${chunk.module}:${chunk.symbol}`;
      if ((perSymbol.get(key) ?? 0) >= 2) continue;
      perSymbol.set(key, (perSymbol.get(key) ?? 0) + 1);
      picked.push(chunk);
      used += chunk.text.length;
    }
    return picked;
  }

  /** The kit that re-exports a name, so the model sees the import it should write. */
  private kitOf(name: string): string | undefined {
    if (!this.kits) {
      this.kits = new Map();
      for (const { chunk } of this.docs) {
        if (!chunk.module.startsWith('@kit.')) continue;
        for (const n of chunk.text.match(/\{([^}]*)\}/)?.[1]?.split(',') ?? []) {
          if (!this.kits.has(n.trim())) this.kits.set(n.trim(), chunk.module);
        }
      }
    }
    return this.kits.get(name);
  }

  private kits: Map<string, string> | undefined;

  /** Chunks as text for a prompt, each with where it can be imported from. */
  format(chunks: DocChunk[]): string {
    return chunks
      .map((c) => {
        if (c.module === 'global') return `// ${c.symbol}: available without import\n${c.text}`;
        const root = c.symbol.split('.')[0]!;
        const kit = this.kitOf(root);
        const origin = kit && kit !== c.module ? `import { ${root} } from '${kit}'` : `from ${c.module}`;
        return `// ${c.symbol}: ${origin}\n${c.text}`;
      })
      .join('\n\n');
  }
}

let cached: DocSearch | undefined;

/** The index over the installed declarations. Built once and kept on disk under `.tmp/`. */
export function docSearch(): DocSearch {
  if (cached) return cached;
  const version = JSON.parse(fs.readFileSync(path.join(declarationsDir, '..', 'package.json'), 'utf8')).version as string;
  const cacheFile = path.join(repoRoot, '.tmp', `docs-index-${version}.json`);
  let chunks: DocChunk[];
  if (fs.existsSync(cacheFile)) {
    chunks = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as DocChunk[];
  } else {
    chunks = buildIndex();
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(chunks));
  }
  cached = new DocSearch(chunks);
  return cached;
}
