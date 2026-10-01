/**
 * The Phaser side of the ambient occlusion (`ao.ts`): one canvas the size of the map, painted when the room is built, drawn as a single MULTIPLY
 * image under the sun's shadows. Nothing is redrawn per frame; only the layer's alpha follows the sky (stronger under an overcast sky, where the
 * light is diffuse and the occlusion is what you see, weaker at night).
 */
import Phaser from 'phaser';
import { aoForTerrain, paintAo, type AoShape } from './ao';
import { DEPTH } from './props';

const KEY = 'ao_room';

export class AoLayer {
  private img: Phaser.GameObjects.Image | null = null;
  private shapes: AoShape[] = [];
  private pending = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly rig: { world<G extends Phaser.GameObjects.GameObject>(o: G): G },
  ) {}

  /** Collect shapes while the room builds. */
  add(shapes: readonly AoShape[]): void {
    this.shapes.push(...shapes);
  }

  /** Paint everything collected, plus the terrain edges of an open-air map, into the room canvas and show it. */
  build(floor: readonly string[], outdoor: boolean): void {
    this.dropImage();
    const cols = floor[0]?.length ?? 0;
    const w = cols * 16;
    const h = floor.length * 16;
    if (!w || !h || !outdoor) {
      this.shapes = [];
      return;
    }
    const t = this.scene.textures;
    if (t.exists(KEY)) t.remove(KEY);
    const ct = t.createCanvas(KEY, w, h);
    if (!ct) return;
    ct.setFilter(Phaser.Textures.FilterMode.LINEAR);
    paintAo(ct.getContext(), w, h, this.shapes, aoForTerrain(floor));
    ct.refresh();
    this.pending = this.shapes.length;
    this.shapes = [];
    this.img = this.rig.world(this.scene.add.image(0, 0, KEY)).setOrigin(0, 0).setDepth(DEPTH.shadowCast - 50).setBlendMode(Phaser.BlendModes.MULTIPLY).setAlpha(0);
  }

  /** `strength` 0..1 (0 hides the layer: low-fx, interiors). */
  update(strength: number): void {
    if (!this.img) return;
    const a = Math.min(1, Math.max(0, strength));
    this.img.setAlpha(a).setVisible(a > 0.01);
  }

  get shapeCount(): number {
    return this.pending;
  }

  private dropImage(): void {
    this.img?.destroy();
    this.img = null;
  }

  clearRoom(): void {
    this.shapes = [];
    this.pending = 0;
    this.dropImage();
    if (this.scene.textures.exists(KEY)) this.scene.textures.remove(KEY);
  }
}
