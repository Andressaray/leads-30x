/**
 * In-memory cache with expiration (TTL) and a maximum size. When full it drops
 * the oldest entry. It is lost when the server restarts, on purpose: the
 * leads are already stored in the database; this only avoids asking the
 * public sources for the same thing for a few hours.
 */
export class CacheTtl<V> {
  private readonly data = new Map<string, { value: V; expires: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 100,
    private readonly now: () => number = Date.now
  ) {}

  get active(): boolean {
    return this.ttlMs > 0 && this.maxEntries > 0;
  }

  get(key: string): V | undefined {
    const e = this.data.get(key);
    if (!e) return undefined;
    if (e.expires <= this.now()) {
      this.data.delete(key);
      return undefined;
    }
    return e.value;
  }

  set(key: string, value: V): void {
    if (!this.active) return;
    this.data.delete(key);
    while (this.data.size >= this.maxEntries) {
      const oldest = this.data.keys().next().value;
      if (oldest === undefined) break;
      this.data.delete(oldest);
    }
    this.data.set(key, { value, expires: this.now() + this.ttlMs });
  }

  get size(): number {
    return this.data.size;
  }
}

/** Rejects if the promise does not finish within `ms`. The background task keeps going, but it is no longer awaited. */
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  if (!(ms > 0) || !Number.isFinite(ms)) return promise;
  let timer: NodeJS.Timeout | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
    timer.unref?.();
  });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}
