Write the file `solution.ets`: a queue that runs asynchronous jobs, a limited number at a time.

A job is a function `() => Promise<T>`. A job always returns a promise and never throws before returning it. When it fails, its promise rejects with an `Error`.

Export an interface `JobOutcome<T>` with three fields: `ok: boolean`, `value: T | undefined`, `error: Error | undefined`.

Export a class `JobQueue`.

- `constructor(concurrency: number)`: `concurrency` is a whole number, 1 or more: how many jobs may run at the same time.
- `add<T>(job: () => Promise<T>): Promise<T>` puts the job at the end of the queue and returns a promise that fulfils with the value of the job, or rejects with the error of the job (the same object). A job is running from the moment the queue calls it until its promise settles; before that it is waiting.
- Jobs are started in the order in which they were added, and never more than `concurrency` are running. When `add` is called while the queue is not paused and fewer than `concurrency` jobs are running, the job is called before `add` returns. Each time a running job settles, the queue starts the next waiting job, unless it is paused.
- Four getters, all `number`: `running` (jobs that are running now), `waiting` (jobs that are waiting now), `completed` (jobs whose promise fulfilled, so far) and `failed` (jobs whose promise rejected, so far).
- `pause(): void`: from now on no waiting job is started. Jobs that are running go on.
- `resume(): void` ends the pause and, before it returns, starts as many waiting jobs as the limit allows.
- `clear(): number` removes every waiting job from the queue and returns how many it removed. The promise that `add` returned for each of them rejects with a new `Error` whose `message` is `Job was cancelled`. Removed jobs are never called and count neither as completed nor as failed. Running jobs are not affected.
- `whenIdle(): Promise<void>` returns a promise that fulfils as soon as no job is running and no job is waiting. That moment can come when the last running job settles or when `clear` empties the queue. When the queue is already in that state, the returned promise is already fulfilled.
- `runAll<T>(jobs: Array<() => Promise<T>>): Promise<JobOutcome<T>[]>` adds every job to the queue, in the order of `jobs`, before it returns, exactly as `add` does. Its promise fulfils when all of them have settled, with one outcome per job in the order of `jobs`: `ok: true`, the value in `value` and `error: undefined` for a job that fulfilled; `ok: false`, `value: undefined` and the error in `error` for a job that failed or was removed by `clear`. It never rejects. For an empty list it fulfils with an empty array.
