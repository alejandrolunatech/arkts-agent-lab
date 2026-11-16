export class RetryError extends Error {
  constructor(
    public readonly attempts: number,
    public readonly lastError: Error,
  ) {
    super(`Failed after ${attempts} attempts: ${lastError.message}`);
    this.name = 'RetryError';
  }
}

export async function retry<T>(action: () => Promise<T>, attempts: number): Promise<T> {
  const limit = Math.max(1, attempts);
  let lastError: unknown;
  for (let attempt = 1; attempt <= limit; attempt++) {
    try {
      return await action();
    } catch (error: unknown) {
      lastError = error;
    }
  }
  throw new RetryError(limit, lastError instanceof Error ? lastError : new Error(String(lastError)));
}
