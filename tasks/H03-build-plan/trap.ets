export class MissingDependencyError extends Error {
  constructor(
    public readonly task: string,
    public readonly dependency: string,
  ) {
    super(`Task '${task}' depends on unknown task '${dependency}'`);
    this.name = 'MissingDependencyError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class CycleError extends Error {
  constructor(public readonly path: string[]) {
    super(`Dependency cycle: ${path.join(' -> ')}`);
    this.name = 'CycleError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BuildPlan {
  private readonly sorted: string[] = [];
  private readonly levels: { [task: string]: number } = {};

  constructor(private readonly spec: Record<string, string[]>) {
    for (const [task, dependencies] of Object.entries(spec)) {
      for (const dependency of dependencies) {
        if (!(dependency in spec)) {
          throw new MissingDependencyError(task, dependency);
        }
      }
    }

    const chain: string[] = [];
    const place = (task: string): void => {
      if (task in this.levels) {
        return;
      }
      const start = chain.indexOf(task);
      if (start !== -1) {
        throw new CycleError([...chain.slice(start), task]);
      }
      chain.push(task);
      spec[task].forEach(place);
      chain.pop();
      this.levels[task] = Math.max(-1, ...spec[task].map((dependency) => this.levels[dependency])) + 1;
      this.sorted.push(task);
    };
    for (const task in spec) {
      place(task);
    }
  }

  order(): string[] {
    return [...this.sorted];
  }

  layers(): string[][] {
    const result: string[][] = [];
    for (const task in this.spec) {
      (result[this.levels[task]] ??= []).push(task);
    }
    return result;
  }

  dependentsOf(name: string): string[] {
    const found = new Set<string>();
    for (const task of this.sorted) {
      if (this.spec[task].some((dependency) => dependency === name || found.has(dependency))) {
        found.add(task);
      }
    }
    return [...found];
  }
}
