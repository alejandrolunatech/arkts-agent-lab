// Probe A for docs/JUDGE-GAPS.md of arkts-agent-lab: type and linter questions.
// Build this page once in DevEco Studio. Every line marked P<n> is a question:
// does the build report an error on it? Lines without a mark are plain ArkTS.
import { preferences } from '@kit.ArkData';

export function describe(run: () => void): string {
  try {
    run();
    return 'ok';
  } catch (err) {
    return `failed: ${err.message}`; // P1 a property of the catch variable
  }
}

export async function retry(action: () => Promise<string>, attempts: number): Promise<string> {
  let lastError: Error = new Error('not called');
  for (let i = 0; i < attempts; i++) {
    try {
      return await action();
    } catch (e) {
      lastError = e; // P2 the catch variable kept in an Error
    }
  }
  throw lastError;
}

export function last(items: number[]): number | undefined {
  return items.at(-1); // P3 Array.prototype.at
}

export function wrap(cause: Error): Error {
  return new Error('wrapped', { cause: cause }); // P4 the cause of an Error
}

class CancelledError extends Error {}

function report(problem: Error): string {
  return problem.message;
}

export function cancelled(): string {
  const first: Error = new CancelledError('stop'); // P5 a subclass of Error kept in an Error
  return report(new CancelledError('stop')) + first.message; // P6 a subclass of Error passed as an Error
}

export function save(store: preferences.Preferences): void {
  store.putSync('name', 'Ada');
  store.flushSync(); // P7 an API added after level 13
}

@Component
struct SizeControls {
  @State size: number = 18; // P8 a field named like a common attribute

  build() {
    Text(this.size.toString())
  }
}

@Entry
@Component
struct Index {
  build() {
    Column() {
      SizeControls()
    }
  }
}
