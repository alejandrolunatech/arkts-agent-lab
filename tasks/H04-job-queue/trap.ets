export interface JobOutcome<T> {
  ok: boolean;
  value: T | undefined;
  error: Error | undefined;
}

export class JobQueue {
  private readonly queue: Array<{ start: () => void; cancel: () => void }> = [];
  private idleWaiters: Array<() => void> = [];
  private active = 0;
  private succeeded = 0;
  private errored = 0;
  private paused = false;

  constructor(private readonly concurrency: number) {}

  get running(): number {
    return this.active;
  }

  get waiting(): number {
    return this.queue.length;
  }

  get completed(): number {
    return this.succeeded;
  }

  get failed(): number {
    return this.errored;
  }

  add<T>(job: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        start: () => this.run(job).then(resolve, reject),
        cancel: () => reject(new Error('Job was cancelled')),
      });
      this.drain();
    });
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    this.drain();
  }

  clear(): number {
    const removed = this.queue.splice(0);
    removed.forEach(({ cancel }) => cancel());
    this.notifyIdle();
    return removed.length;
  }

  whenIdle(): Promise<void> {
    if (this.isIdle) {
      return Promise.resolve();
    }
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  async runAll<T>(jobs: Array<() => Promise<T>>): Promise<JobOutcome<T>[]> {
    const settled = await Promise.allSettled(jobs.map((job) => this.add(job)));
    return settled.map((result) =>
      result.status === 'fulfilled'
        ? { ok: true, value: result.value, error: undefined }
        : { ok: false, value: undefined, error: result.reason },
    );
  }

  private get isIdle(): boolean {
    return this.active === 0 && this.queue.length === 0;
  }

  private async run<T>(job: () => Promise<T>): Promise<T> {
    this.active++;
    try {
      const value = await job();
      this.succeeded++;
      return value;
    } catch (error: unknown) {
      this.errored++;
      throw error;
    } finally {
      this.active--;
      this.drain();
      this.notifyIdle();
    }
  }

  private drain(): void {
    while (!this.paused && this.active < this.concurrency && this.queue.length > 0) {
      this.queue.shift()!.start();
    }
  }

  private notifyIdle(): void {
    if (this.isIdle) {
      this.idleWaiters.splice(0).forEach((resolve) => resolve());
    }
  }
}
