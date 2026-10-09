/**
 * Sliding-window attempt counter (in memory; one Fly machine). Browser-safe: no Node imports, so the
 * World (which also runs in solo mode) can throttle the admin login with it.
 */
export class AttemptLimiter {
  private hits = new Map<string, number[]>();
  constructor(
    private max: number,
    private windowMs: number,
    private now: () => number = Date.now,
  ) {}

  blocked(key: string): boolean {
    return this.recent(key).length >= this.max;
  }

  hit(key: string) {
    const list = this.recent(key);
    list.push(this.now());
    this.hits.set(key, list);
    if (this.hits.size > 10_000) this.prune();
  }

  /**
   * Check and count in one step, before any slow await. Parallel requests each take a slot, so a burst
   * cannot all pass `blocked()` before the first one records its `hit()`. False when the window is full.
   */
  take(key: string): boolean {
    if (this.blocked(key)) return false;
    this.hit(key);
    return true;
  }

  /** Give back the newest slot (a reserved attempt that turned out not to count). */
  release(key: string) {
    const list = this.hits.get(key);
    if (!list?.length) return;
    list.pop();
    if (!list.length) this.hits.delete(key);
  }

  reset(key: string) {
    this.hits.delete(key);
  }

  private recent(key: string) {
    const cutoff = this.now() - this.windowMs;
    return (this.hits.get(key) ?? []).filter((t) => t > cutoff);
  }

  private prune() {
    for (const k of [...this.hits.keys()]) if (!this.recent(k).length) this.hits.delete(k);
  }
}
