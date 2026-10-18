/**
 * Runs tasks one at a time, in arrival order. The sources are public
 * services with per-IP limits, so it is not a good idea to run searches in parallel.
 */
export class SerialQueue {
  private queue: Promise<unknown> = Promise.resolve();
  private pending = 0;

  get waiting(): number {
    return this.pending;
  }

  run<T>(task: () => Promise<T>): Promise<T> {
    this.pending += 1;
    const result = this.queue.then(() => task());
    this.queue = result.catch(() => undefined);
    return result.finally(() => {
      this.pending -= 1;
    });
  }
}
