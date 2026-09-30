/**
 * Composed character sheets for the game scene: compose on demand, cache by look, evict least-recently-used sheets that no sprite uses
 * and remove their texture and animations (HOWTO §5.5, pitfall "memory grows as players come and go"). The backend is injected so the
 * cache logic is testable without Phaser.
 */
import { Lru } from './lru';
import { lookKey, type Look } from './looks';

export const SHEET_CAP = 64;

export interface SheetBackend {
  /** compose the look and register the texture (and animations) under `key` */
  add(key: string, look: Look): void;
  /** remove the texture and animations of an evicted sheet */
  remove(key: string): void;
}

export class CharSheets {
  private lru: Lru<string>;

  constructor(
    private readonly backend: SheetBackend,
    cap = SHEET_CAP,
  ) {
    this.lru = new Lru<string>(cap, (key) => this.backend.remove(key));
  }

  get size(): number {
    return this.lru.size;
  }

  has(key: string): boolean {
    return this.lru.has(key);
  }

  /** Texture key of the sheet for a look (composed the first time). The caller must `release` it when its sprite stops using it. */
  acquire(look: Look): string {
    const key = lookKey(look);
    if (!this.lru.has(key)) {
      this.backend.add(key, look);
      this.lru.set(key, key);
    } else this.lru.get(key);
    this.lru.retain(key);
    return key;
  }

  release(key: string): void {
    this.lru.release(key);
  }
}
