/**
 * Draws the tap cues of tapMark.ts: one image, re-textured and moved as the mark changes. The ring textures are made once from `ringPixels`
 * (art px, so they stay crisp at every integer zoom); nothing here allocates per frame.
 */
import Phaser from 'phaser';
import { T } from './coords';
import { DEPTH } from './props';
import { crossPixels, markFadeStart, markLook, ringPixels, type TapKind, type TapMark } from './tapMark';

const RING = { rx: 6, ry: 3 };
const POP = { rx: 8, ry: 4 };
const CROSS_R = 3;
const SHADOW = 'rgba(29,27,38,0.55)';
const COLORS: Record<Exclude<TapKind, 'refused'>, string> = { floor: '#fff8e8', act: '#f2c230' };

interface Tex {
  key: string;
  /** offset from the mark's centre pixel to the texture's top-left */
  ox: number;
  oy: number;
}

/** A texture from pixel offsets around a centre: a 1 px dark shadow under each pixel, then the colour on top. */
function bake(scene: Phaser.Scene, key: string, pixels: [number, number][], color: string, extra: [number, number][] = []): Tex {
  const all = pixels.concat(extra);
  const minX = Math.min(...all.map((p) => p[0]));
  const maxX = Math.max(...all.map((p) => p[0]));
  const minY = Math.min(...all.map((p) => p[1]));
  const maxY = Math.max(...all.map((p) => p[1]));
  const w = maxX - minX + 1;
  const h = maxY - minY + 2;
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.createCanvas(key, w, h)!;
    const ctx = tex.getContext();
    ctx.fillStyle = SHADOW;
    for (const [i, j] of all) ctx.fillRect(i - minX, j - minY + 1, 1, 1);
    ctx.fillStyle = color;
    for (const [i, j] of all) ctx.fillRect(i - minX, j - minY, 1, 1);
    tex.refresh();
  }
  return { key, ox: minX, oy: minY };
}

export class TapMarkerLayer {
  private img: Phaser.GameObjects.Image;
  private tex: Record<string, Tex>;
  private mark: TapMark | null = null;
  private fadingSince: number | null = null;

  constructor(scene: Phaser.Scene, world: <G extends Phaser.GameObjects.GameObject>(o: G) => G) {
    const ring = ringPixels(RING.rx, RING.ry);
    const pop = ringPixels(POP.rx, POP.ry);
    // the gold "going to do something" ring has a small inner ring too: a target, not just a spot
    const inner = ringPixels(2, 1);
    this.tex = {
      floor0: bake(scene, 'tap:floor0', ring, COLORS.floor),
      floor1: bake(scene, 'tap:floor1', pop, COLORS.floor),
      act0: bake(scene, 'tap:act0', ring, COLORS.act, inner),
      act1: bake(scene, 'tap:act1', pop, COLORS.act, inner),
      refused0: bake(scene, 'tap:refused0', crossPixels(CROSS_R), '#e5572f'),
    };
    this.img = world(scene.add.image(0, 0, 'tap:floor0')).setOrigin(0, 0).setVisible(false);
  }

  /** Per frame: `self` is the local avatar's tile (null when there is none), `reduced` is prefers-reduced-motion. */
  update(mark: TapMark | null, now: number, self: { x: number; y: number; moving: boolean } | null, reduced: boolean): void {
    if (mark !== this.mark) {
      this.mark = mark;
      this.fadingSince = null;
    }
    if (!mark) {
      this.img.setVisible(false);
      return;
    }
    this.fadingSince = markFadeStart(mark, now, self, this.fadingSince);
    const look = markLook(mark.kind, now - mark.t0, this.fadingSince === null ? null : now - this.fadingSince, reduced);
    if (!look) {
      this.img.setVisible(false);
      return;
    }
    const t = this.tex[`${mark.kind}${mark.kind === 'refused' ? 0 : look.frame}`];
    // the ring's centre pixel sits just above the feet of someone standing on the tile; the cross in the middle of the tile
    const cx = mark.x * T + T / 2;
    const cy = mark.kind === 'refused' ? mark.y * T + T / 2 : (mark.y + 1) * T - 4;
    if (this.img.texture.key !== t.key) this.img.setTexture(t.key);
    this.img
      .setPosition(cx + t.ox + look.dx, cy + t.oy)
      .setAlpha(look.alpha)
      // the ring lies on the ground (the avatar walks over it); the cross is a message, so it draws over everything, like the hover tile
      .setDepth(mark.kind === 'refused' ? 49000 : DEPTH.shadowContact + 40)
      .setVisible(true);
  }
}
