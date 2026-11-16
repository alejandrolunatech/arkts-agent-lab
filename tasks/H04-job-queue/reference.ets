export interface JobOutcome<T> {
  ok: boolean;
  value: T | undefined;
  error: Error | undefined;
}

class WaitingJob {
  start: () => void;
  cancel: () => void;

  constructor(start: () => void, cancel: () => void) {
    this.start = start;
    this.cancel = cancel;
  }
}

export class JobQueue {
  private concurrency: number;
  private waitingJobs: WaitingJob[] = [];
  private idleWaiters: (() => void)[] = [];
  private runningCount: number = 0;
  private completedCount: number = 0;
  private failedCount: number = 0;
  private isPaused: boolean = false;

  constructor(concurrency: number) {
    this.concurrency = concurrency;
  }

  get running(): number {
    return this.runningCount;
  }

  get waiting(): number {
    return this.waitingJobs.length;
  }

  get completed(): number {
    return this.completedCount;
  }

  get failed(): number {
    return this.failedCount;
  }

  add<T>(job: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve: (value: T) => void, reject: (reason: Error) => void) => {
      const start = (): void => {
        this.runningCount++;
        job().then((value: T) => {
          this.completedCount++;
          resolve(value);
          this.afterJob();
        }, (error: Error) => {
          this.failedCount++;
          reject(error);
          this.afterJob();
        });
      };
      const cancel = (): void => {
        reject(new Error('Job was cancelled'));
      };
      this.waitingJobs.push(new WaitingJob(start, cancel));
      this.startWaiting();
    });
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
    this.startWaiting();
  }

  clear(): number {
    const removed = this.waitingJobs;
    this.waitingJobs = [];
    for (const entry of removed) {
      entry.cancel();
    }
    this.tellIdle();
    return removed.length;
  }

  whenIdle(): Promise<void> {
    if (this.isIdle()) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve: () => void) => {
      this.idleWaiters.push(resolve);
    });
  }

  runAll<T>(jobs: Array<() => Promise<T>>): Promise<JobOutcome<T>[]> {
    const outcomes: Promise<JobOutcome<T>>[] = [];
    for (const job of jobs) {
      outcomes.push(this.outcomeOf<T>(this.add<T>(job)));
    }
    return Promise.all<JobOutcome<T>>(outcomes);
  }

  private async outcomeOf<T>(result: Promise<T>): Promise<JobOutcome<T>> {
    try {
      const value = await result;
      const success: JobOutcome<T> = { ok: true, value: value, error: undefined };
      return success;
    } catch (error) {
      const failure: JobOutcome<T> = { ok: false, value: undefined, error: error as Error };
      return failure;
    }
  }

  private isIdle(): boolean {
    return this.runningCount === 0 && this.waitingJobs.length === 0;
  }

  private startWaiting(): void {
    while (!this.isPaused && this.runningCount < this.concurrency && this.waitingJobs.length > 0) {
      const entry = this.waitingJobs.shift();
      if (entry !== undefined) {
        entry.start();
      }
    }
  }

  private afterJob(): void {
    this.runningCount--;
    this.startWaiting();
    this.tellIdle();
  }

  private tellIdle(): void {
    if (!this.isIdle()) {
      return;
    }
    const waiters = this.idleWaiters;
    this.idleWaiters = [];
    for (const waiter of waiters) {
      waiter();
    }
  }
}
