export class MissingDependencyError extends Error {
  task: string;
  dependency: string;

  constructor(task: string, dependency: string) {
    super(`Task '${task}' depends on unknown task '${dependency}'`);
    this.name = 'MissingDependencyError';
    this.task = task;
    this.dependency = dependency;
  }
}

export class CycleError extends Error {
  path: string[];

  constructor(path: string[]) {
    super(`Dependency cycle: ${path.join(' -> ')}`);
    this.name = 'CycleError';
    this.path = path;
  }
}

export class BuildPlan {
  private names: string[] = [];
  private dependencies: Map<string, string[]> = new Map<string, string[]>();
  private placed: string[] = [];
  private levels: Map<string, number> = new Map<string, number>();

  constructor(spec: Record<string, string[]>) {
    this.names = Object.keys(spec);
    for (const name of this.names) {
      this.dependencies.set(name, spec[name].slice());
    }
    for (const name of this.names) {
      for (const dependency of this.listOf(name)) {
        if (!this.dependencies.has(dependency)) {
          throw new MissingDependencyError(name, dependency);
        }
      }
    }
    const chain: string[] = [];
    for (const name of this.names) {
      this.place(name, chain);
    }
  }

  order(): string[] {
    return this.placed.slice();
  }

  layers(): string[][] {
    const result: string[][] = [];
    for (const name of this.names) {
      const level = this.levelOf(name);
      while (result.length <= level) {
        result.push([]);
      }
      result[level].push(name);
    }
    return result;
  }

  dependentsOf(name: string): string[] {
    const found: Set<string> = new Set<string>();
    if (!this.dependencies.has(name)) {
      return [];
    }
    found.add(name);
    const result: string[] = [];
    // In placing order every dependency comes first, so one pass is enough.
    for (const task of this.placed) {
      if (found.has(task)) {
        continue;
      }
      for (const dependency of this.listOf(task)) {
        if (found.has(dependency)) {
          found.add(task);
          result.push(task);
          break;
        }
      }
    }
    return result;
  }

  private listOf(name: string): string[] {
    const list = this.dependencies.get(name);
    return list === undefined ? [] : list;
  }

  private levelOf(name: string): number {
    const level = this.levels.get(name);
    return level === undefined ? 0 : level;
  }

  private place(name: string, chain: string[]): void {
    if (this.levels.has(name)) {
      return;
    }
    const start = chain.indexOf(name);
    if (start >= 0) {
      const path = chain.slice(start);
      path.push(name);
      throw new CycleError(path);
    }
    chain.push(name);
    let level = 0;
    for (const dependency of this.listOf(name)) {
      this.place(dependency, chain);
      level = Math.max(level, this.levelOf(dependency) + 1);
    }
    chain.pop();
    this.levels.set(name, level);
    this.placed.push(name);
  }
}
