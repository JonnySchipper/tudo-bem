/**
 * Least-recently-used cache of composed character sheets (HOWTO §5.5: cap 64, remove the texture on eviction).
 * Entries that are still in use (a sprite draws with them) are never evicted, so the cache can briefly exceed its cap.
 * Pure: the caller supplies what to do on eviction.
 */
export class Lru<V> {
  private map = new Map<string, { v: V; uses: number }>();

  constructor(
    private readonly cap: number,
    private readonly onEvict: (key: string, v: V) => void,
  ) {}

  get size(): number {
    return this.map.size;
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  keys(): string[] {
    return [...this.map.keys()];
  }

  /** Get and mark as most recently used. */
  get(key: string): V | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    this.map.delete(key);
    this.map.set(key, e);
    return e.v;
  }

  set(key: string, v: V): void {
    const old = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, { v, uses: old?.uses ?? 0 });
    this.trim(key);
  }

  /** A sprite starts drawing with this entry. */
  retain(key: string): void {
    const e = this.map.get(key);
    if (e) e.uses++;
  }

  /** A sprite stops drawing with this entry. */
  release(key: string): void {
    const e = this.map.get(key);
    if (e && e.uses > 0) e.uses--;
    this.trim();
  }

  private trim(protect?: string): void {
    if (this.map.size <= this.cap) return;
    for (const [k, e] of this.map) {
      if (this.map.size <= this.cap) break;
      if (e.uses > 0 || k === protect) continue;
      this.map.delete(k);
      this.onEvict(k, e.v);
    }
  }
}
