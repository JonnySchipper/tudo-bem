/**
 * Composed character sheets for the game scene: compose on demand with the Phase 1 palette swap (charsheet.ts), cache by look, evict
 * least-recently-used sheets that no sprite uses and remove their texture and animations (HOWTO §5.5, pitfall "memory grows as players
 * come and go").
 */
import type Phaser from 'phaser';
import { animKey, composeCharacter, type CharLayer, type Facing, type SheetMeta } from './charsheet';
import { Lru } from './lru';
import { lookKey, type Look } from './looks';

const CAP = 64;
const FACINGS: Facing[] = ['S', 'W', 'E', 'N'];

export class CharSheets {
  private lru: Lru<string>;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly meta: SheetMeta,
  ) {
    this.lru = new Lru<string>(CAP, (key) => this.dispose(key));
  }

  get size(): number {
    return this.lru.size;
  }

  /** Texture key of the sheet for a look (composed the first time). The caller must `release` it when its sprite stops using it. */
  acquire(look: Look): string {
    const key = lookKey(look);
    if (!this.lru.get(key)) {
      const layers: CharLayer[] = [
        { texture: `layer:${look.body}`, ramps: { skin: look.skin } },
        { texture: `layer:${look.outfit}`, ramps: { top: look.top, bottom: look.bottom } },
        { texture: `layer:${look.hair}`, ramps: { hair: look.hairColor } },
      ];
      composeCharacter(this.scene, key, layers, this.meta);
      this.lru.set(key, key);
    }
    this.lru.retain(key);
    return key;
  }

  release(key: string): void {
    this.lru.release(key);
  }

  private dispose(key: string): void {
    for (const name of ['idle', 'walk']) for (const f of FACINGS) this.scene.anims.remove(animKey(key, name, f));
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
  }
}
