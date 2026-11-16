export type Transform = (text: string) => string;

export function trim(text: string): string {
  return text.trim();
}

export function lowerCase(text: string): string {
  return text.toLowerCase();
}

export function collapseSpaces(text: string): string {
  return text.replace(/\s+/g, ' ');
}

interface Step {
  name: string;
  apply: Transform;
}

export class Pipeline {
  private steps: Step[] = [];

  add(name: string, step: Transform): Pipeline {
    const entry: Step = { name: name, apply: step };
    this.steps.push(entry);
    return this;
  }

  run(text: string): string {
    let result = text;
    for (const step of this.steps) {
      result = step.apply(result);
    }
    return result;
  }

  names(): string[] {
    return this.steps.map((step: Step): string => step.name);
  }

  toFunction(): Transform {
    return (text: string): string => this.run(text);
  }
}

export function compose(...steps: Transform[]): Transform {
  return (text: string): string => {
    let result = text;
    for (const step of steps) {
      result = step(result);
    }
    return result;
  };
}
