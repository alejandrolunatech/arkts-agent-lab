Write the file `solution.ets`.

Export a class `RetryError` that extends `Error`.

- Its constructor is `constructor(attempts: number, lastError: Error)`.
- It has two fields, `attempts: number` and `lastError: Error`, holding the constructor arguments.
- Its `message` is `Failed after <attempts> attempts: <message of lastError>`, for example `Failed after 3 attempts: timeout`.

Export an async function `retry<T>(action: () => Promise<T>, attempts: number): Promise<T>`.

- It calls `action` and waits for the result. When a call succeeds, `retry` returns that value and does not call `action` again.
- When a call fails, it calls `action` again, one call at a time with no pause in between, until `action` has been called `attempts` times in total.
- When every call has failed, `retry` rejects with a `RetryError` whose `attempts` is the number of calls made and whose `lastError` is the error of the last call.
- An `attempts` below 1 counts as 1.
- `action` only ever fails with an `Error`.
