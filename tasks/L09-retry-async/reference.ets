export class RetryError extends Error {
  attempts: number;
  lastError: Error;

  constructor(attempts: number, lastError: Error) {
    super(`Failed after ${attempts} attempts: ${lastError.message}`);
    this.name = 'RetryError';
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

export async function retry<T>(action: () => Promise<T>, attempts: number): Promise<T> {
  const limit = Math.max(1, attempts);
  let lastError: Error = new Error('The action was not called');
  for (let attempt = 1; attempt <= limit; attempt++) {
    try {
      return await action();
    } catch (error) {
      lastError = error as Error;
    }
  }
  throw new RetryError(limit, lastError);
}
