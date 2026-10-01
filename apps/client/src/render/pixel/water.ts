/**
 * Water light (V5): animated caustics and sparkle on the fountain basin by day, the same ripples glowing teal at night over the underwater lights.
 *
 * The water pixels are found in the sprite itself (blue/teal pixels), so any sprite with a basin works. Four caustic frames are drawn into small
 * canvas textures masked to the water, then cycled at 4 fps by an ADD-blended sprite over the fountain; a handful of 1 px sparkles twinkle on top
 * by day. Pure pattern functions are exported for tests.
 */
import Phaser from 'phaser';
import { causticAt, sparklePixels, waterMask } from './waterMath';

export { causticAt, isWaterPixel, sparklePixels, waterMask, type WaterMask } from './waterMath';

interface Basin {
  over: Phaser.GameObjects.Sprite;
  sparks: { spr: Phaser.GameObjects.Image; ph: number }[];
  key: string;
}

export class WaterFx {
  private basins: Basin[] = [];
  private t = 0;
  private n = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly rig: { world<G extends Phaser.GameObjects.GameObject>(o: G): G },
  ) {
    if (!scene.textures.exists('wfx:spark')) {
      const c = scene.textures.createCanvas('wfx:spark', 3, 3);
      if (c) {
        const g = c.getContext();
        g.fillStyle = 'rgba(255,255,255,0.55)';
        g.fillRect(1, 0, 1, 3);
        g.fillRect(0, 1, 3, 1);
        g.fillStyle = '#fff';
        g.fillRect(1, 1, 1, 1);
        c.refresh();
      }
    }
  }

  /** Add a basin: `data` is the sprite frame's RGBA (untrimmed), the foot of the sprite at world (wx, wy) with anchor (ax, ay) inside the frame. */
  add(key: string, data: Uint8ClampedArray, w: number, h: number, wx: number, wy: number, ax: number, ay: number, depth: number): void {
    const mask = waterMask(data, w, h);
    if (mask.px.length < 12) return;
    const id = `wfx:${this.n++}`;
    for (let f = 0; f < 4; f++) {
      const k = `${id}_${f}`;
      const ct = this.scene.textures.createCanvas(k, w, h);
      if (!ct) return;
      const g = ct.getContext();
      for (const [x, y] of mask.px) {
        const v = causticAt(x, y, f);
        if (v <= 0.02) continue;
        g.fillStyle = `rgba(255,255,255,${(v * 0.85).toFixed(2)})`;
        g.fillRect(x, y, 1, 1);
      }
      ct.refresh();
    }
    const left = Math.round(wx) - ax;
    const top = Math.round(wy) - ay;
    const over = this.rig.world(this.scene.add.sprite(left, top, `${id}_0`)).setOrigin(0, 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth + 0.003).setAlpha(0);
    const sparks = sparklePixels(mask, 7, Math.round(wx * 3 + wy)).map(([x, y], i) => ({
      spr: this.rig.world(this.scene.add.image(left + x, top + y, 'wfx:spark')).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth + 0.004).setAlpha(0),
      ph: i * 1.7,
    }));
    this.basins.push({ over, sparks, key: id });
  }

  clearRoom(): void {
    for (const b of this.basins) {
      b.over.destroy();
      for (const s of b.sparks) s.spr.destroy();
      for (let f = 0; f < 4; f++) if (this.scene.textures.exists(`${b.key}_${f}`)) this.scene.textures.remove(`${b.key}_${f}`);
    }
    this.basins = [];
  }

  get count(): number {
    return this.basins.length;
  }

  /**
   * `sun` 0..1 (how much direct sun: strong caustics and sparkle), `night` 0..1 with `lit` 0..1 (underwater lights on), `still` freezes the
   * animation (reduced motion), `fx` false hides the sparkle (low-fx).
   */
  update(dt: number, sun: number, night: number, lit: number, still: boolean, fx: boolean): void {
    if (!this.basins.length) return;
    this.t += still ? 0 : dt;
    const frame = Math.floor(this.t * 4) % 4;
    const day = Math.max(0, 1 - night * 2.2);
    for (const b of this.basins) {
      const a = Math.min(0.75, day * (0.12 + 0.3 * sun) + lit * 0.55);
      b.over.setTexture(`${b.key}_${frame}`).setAlpha(a).setVisible(a > 0.01);
      // by day the caustics are warm white, by night the teal of the lamps
      b.over.setTint(lit > 0.2 ? 0x7ffff0 : 0xfff4dc);
      for (const s of b.sparks) {
        const tw = Math.max(0, Math.sin(this.t * 3.1 + s.ph)) ** 6;
        const al = fx ? tw * (day * sun) * 0.9 + (lit > 0.2 ? tw * lit * 0.6 : 0) : 0;
        s.spr.setAlpha(al).setVisible(al > 0.02);
      }
    }
  }
}
