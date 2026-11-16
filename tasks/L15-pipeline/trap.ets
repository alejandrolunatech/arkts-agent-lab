export type Transform = (text: string) => string;

export const trim: Transform = (text) => text.trim();

export const lowerCase: Transform = (text) => text.toLowerCase();

export const collapseSpaces: Transform = (text) => text.replace(/\s+/g, ' ');

export class Pipeline {
  private readonly steps: { name: string; apply: Transform }[] = [];

  add(name: string, step: Transform): this {
    this.steps.push({ name, apply: step });
    return this;
  }

  run(text: string): string {
    return this.steps.reduce((result, { apply }) => apply(result), text);
  }

  names(): string[] {
    return this.steps.map(({ name }) => name);
  }

  toFunction(): Transform {
    return this.run.bind(this);
  }
}

export function compose(...steps: Transform[]): Transform {
  return (text) => steps.reduce((result, step) => step(result), text);
}
