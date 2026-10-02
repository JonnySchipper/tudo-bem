/**
 * Weather effects for outdoor rooms (HOWTO Phase 6 step 4): fine slanted rain (garoa) and heavier rain with ground splashes, puddle decals and
 * ripples (chuva). Interiors get none of it. Everything is generated at runtime as tiny textures (D6 allows particles and light), drawn in art
 * pixels and scaled by the integer camera zoom so it stays crisp next to the sprites.
 *
 * Rain and splashes live in screen space (the `fx` camera), puddles and ripples in world space. The rain is a pool of images that is grown and
 * shrunk to `rainPlan` (particle caps, low-fx and reduced-motion levels), not an emitter, so the cap is exact.
 */
import Phaser from 'phaser';
import type { RoomDef } from '@tudobem/shared';
import type { LightingRig, Light } from './lightingRig';
import { hashPos01, isOutdoor } from './dayNight';
import { MAX_PUDDLES, PUDDLE_DENSITY, rainColor, rainPlan, type FxLevel, type WeatherParams } from './weatherLook';
import { rgbToInt } from './lighting';
import { v5on } from './v5flags';

const T = 16;
const DEPTH_RAIN = 2.6;
const DEPTH_SPLASH = 2.65;
/** puddles sit above the calçada and the fallen petals, under everything that stands */
const DEPTH_PUDDLE = -4800;
const DEPTH_RIPPLE = -4790;

/** Fall speed and wind in art px/s: the streak textures are drawn with the same slope (2 px across 7 rows), so the streak follows its path. */
const FALL = 300;
const FALL_FAR = 220;
const WIND = -87;

interface Drop {
  img: Phaser.GameObjects.Image;
  /** device px */
  x: number;
  y: number;
  k: number;
  far: boolean;
  landY: number;
}

interface Splash {
  img: Phaser.GameObjects.Image;
  t: number;
}

interface Puddle {
  /** the lamp or window this puddle mirrors at night, with how close it is (0..1) */
  mirror?: { light: Light; k: number; img: Phaser.GameObjects.Image };
  img: Phaser.GameObjects.Image;
  cx: number;
  cy: number;
  w: number;
  h: number;
}

interface Ripple {
  img: Phaser.GameObjects.Image;
  t: number;
  life: number;
  active: boolean;
}

export interface WeatherFrame {
  /** schedule of a light by its delay (puddles mirror the lamps that are on) */
  lampOn: (delay: number) => number;
  /** 0..1 wet ground */
  wet: number;
  dt: number;
  /** integer device zoom of the main camera */
  zoom: number;
  /** fx camera size, device px */
  w: number;
  h: number;
  params: WeatherParams;
  /** 0..1, for the rain color */
  night: number;
  outdoor: boolean;
  cam: Phaser.Cameras.Scene2D.Camera;
}

function makeTex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): void {
  if (scene.textures.exists(key)) return;
  const t = scene.textures.createCanvas(key, w, h);
  if (!t) return;
  draw(t.getContext());
  t.refresh();
}

/** Pixel ellipse outline of radii (rx, ry) centred in a (2*rx+1) x (2*ry+1) canvas. */
function ringPixels(ctx: CanvasRenderingContext2D, rx: number, ry: number, color: string): void {
  ctx.fillStyle = color;
  for (let y = 0; y <= 2 * ry; y++)
    for (let x = 0; x <= 2 * rx; x++) {
      const e = ((x - rx) / (rx + 0.5)) ** 2 + ((y - ry) / (ry + 0.5)) ** 2;
      if (e <= 1 && e > 0.55) ctx.fillRect(x, y, 1, 1);
    }
}

/** A soft-edged pixel puddle: sky-blue water with a light lip on the lit (upper) edge and a darker one below. */
function puddlePixels(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number): void {
  const inside = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    const nx = (x + 0.5 - w / 2) / (w / 2);
    const ny = (y + 0.5 - h / 2) / (h / 2);
    const a = Math.atan2(ny, nx);
    const r = 1 + 0.16 * Math.sin(3 * a + seed) + 0.08 * Math.sin(5 * a + seed * 2.3);
    return nx * nx + ny * ny < r * r * 0.9;
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      const up = inside(x, y - 1);
      const down = inside(x, y + 1);
      if (!up) ctx.fillStyle = 'rgba(206,224,248,0.78)';
      else if (!down) ctx.fillStyle = 'rgba(60,84,136,0.55)';
      else ctx.fillStyle = 'rgba(112,146,196,0.58)';
      ctx.fillRect(x, y, 1, 1);
      // a sliver of sky reflected in the upper-left of the water
      if (up && down && x > w * 0.2 && x < w * 0.45 && y < h * 0.5) {
        ctx.fillStyle = 'rgba(190,212,244,0.30)';
        ctx.fillRect(x, y, 1, 1);
      }
    }
}

const PUDDLE_SIZES: [number, number][] = [
  [12, 5],
  [20, 8],
  [30, 11],
];

export class WeatherFx {
  private drops: Drop[] = [];
  private splashes: Splash[] = [];
  private puddles: Puddle[] = [];
  private ripples: Ripple[] = [];
  /** 0..1 fade of the whole effect in and out of an outdoor room (interiors: 0) */
  private vis = 0;
  private tint = -1;
  private ripplePuddleAt = 0;
  /** walkable ground tiles of the current room (rain only splashes there) and the building bands the streaks fade behind (world px) */
  private ground: Uint8Array | null = null;
  private cols = 0;
  private rows = 0;
  private bandTop = 0;
  private bandBottom = Infinity;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly rig: LightingRig,
    private readonly fxLevel: () => FxLevel,
  ) {
    const near = '#ffffff';
    makeTex(scene, 'wx:drop', 3, 7, (c) => {
      c.fillStyle = near;
      for (const [x, y] of [[2, 0], [2, 1], [1, 2], [1, 3], [1, 4], [0, 5], [0, 6]]) c.fillRect(x, y, 1, 1);
    });
    makeTex(scene, 'wx:drop_far', 2, 4, (c) => {
      c.fillStyle = near;
      for (const [x, y] of [[1, 0], [1, 1], [0, 2], [0, 3]]) c.fillRect(x, y, 1, 1);
    });
    makeTex(scene, 'wx:splash0', 5, 3, (c) => {
      c.fillStyle = near;
      for (const [x, y] of [[2, 2], [1, 1], [3, 1]]) c.fillRect(x, y, 1, 1);
    });
    makeTex(scene, 'wx:splash1', 7, 3, (c) => {
      c.fillStyle = near;
      for (const [x, y] of [[0, 2], [6, 2], [1, 1], [5, 1], [2, 0], [4, 0]]) c.fillRect(x, y, 1, 1);
    });
    for (let i = 0; i < 4; i++) {
      const rx = 2 + i * 2;
      const ry = 1 + i;
      makeTex(scene, `wx:ripple${i}`, 2 * rx + 1, 2 * ry + 1, (c) => ringPixels(c, rx, ry, 'rgba(230,240,255,1)'));
    }
    PUDDLE_SIZES.forEach(([w, h], i) => {
      // two shape seeds per size so neighbours are not clones
      for (let v = 0; v < 2; v++) makeTex(scene, `wx:puddle${i}_${v}`, w, h, (c) => puddlePixels(c, w, h, i * 1.7 + v * 2.9 + 0.4));
    });
  }

  // ------------------------------------------------------------------ room
  /** Puddle decals on calçada and asfalto, deterministic by tile so every player sees the same wet street. `blocked` keeps them off props. */
  buildRoom(def: RoomDef, blocked: (x: number, y: number) => boolean): void {
    this.clearRoom();
    const outdoor = isOutdoor(def);
    if (!outdoor) return;
    const ok = (x: number, y: number) => {
      const ch = def.floor[y]?.[x];
      return (ch === 'c' || ch === 'a' || ch === 'p') && !blocked(x, y);
    };
    this.buildGround(def, blocked);
    const cand: { h: number; x: number; y: number }[] = [];
    for (let y = 0; y < def.rows; y++)
      for (let x = 0; x < def.cols; x++) {
        if (!ok(x, y)) continue;
        const h = hashPos01(x * 7 + 3, y * 13 + 5);
        if (h < PUDDLE_DENSITY) cand.push({ h, x, y });
      }
    cand.sort((a, b) => a.h - b.h);
    for (const c of cand.slice(0, MAX_PUDDLES)) {
      const r1 = hashPos01(c.x * 3 + 11, c.y * 5 + 2);
      const r2 = hashPos01(c.x * 17 + 1, c.y * 19 + 7);
      const r3 = hashPos01(c.x * 23 + 9, c.y * 29 + 4);
      let size = r3 < 0.55 ? 0 : r3 < 0.9 ? 1 : 2;
      if (size === 2 && !(ok(c.x + 1, c.y) && ok(c.x, c.y + 1))) size = 1;
      const [w, h] = PUDDLE_SIZES[size];
      const cx = Math.round((c.x + 0.3 + 0.4 * r1) * T);
      const cy = Math.round((c.y + 0.4 + 0.3 * r2) * T);
      const img = this.rig.world(this.scene.add.image(cx, cy, `wx:puddle${size}_${r3 < 0.5 ? 0 : 1}`)).setDepth(DEPTH_PUDDLE).setAlpha(0);
      const p: Puddle = { img, cx, cy, w, h };
      // night: the nearest lamp or window light mirrors in this puddle (an ADD copy of the puddle in the light's colour)
      let best: Light | null = null;
      let bd = 78;
      for (const l of this.rig.lights) {
        if (l.kind !== 'lamp' && l.kind !== 'window' && l.kind !== 'stall') continue;
        const d = Math.hypot(l.x - cx, (l.y - cy) * 0.8);
        if (d < bd) {
          bd = d;
          best = l;
        }
      }
      if (best) {
        const mi = this.rig.world(this.scene.add.image(cx, cy, `wx:puddle${size}_${r3 < 0.5 ? 0 : 1}`)).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH_PUDDLE + 1).setAlpha(0).setTint(best.color);
        p.mirror = { light: best, k: 1 - bd / 78, img: mi };
      }
      this.puddles.push(p);
    }
    for (let i = 0; i < 14; i++) {
      const img = this.rig.world(this.scene.add.image(0, 0, 'wx:ripple0')).setDepth(DEPTH_RIPPLE).setVisible(false);
      this.ripples.push({ img, t: 0, life: 0.7, active: false });
    }
  }

  /** Ground mask (floor is paving, asphalt, grass or bricks and nothing blocks it) and the rows of buildings at the top and bottom of the map. */
  private buildGround(def: RoomDef, blocked: (x: number, y: number) => boolean): void {
    this.cols = def.cols;
    this.rows = def.rows;
    this.ground = new Uint8Array(def.cols * def.rows);
    const rowOpen: number[] = [];
    for (let y = 0; y < def.rows; y++) {
      let open = 0;
      for (let x = 0; x < def.cols; x++) {
        const ch = def.floor[y]?.[x];
        const g = (ch === 'c' || ch === 'a' || ch === 'p' || ch === 'g' || ch === 't') && !blocked(x, y);
        this.ground[y * def.cols + x] = g ? 1 : 0;
        if (g) open++;
      }
      rowOpen.push(open / def.cols);
    }
    // a building row is a row with under 40% open ground; the bands are the solid runs at the very top and bottom
    let top = 0;
    while (top < def.rows && rowOpen[top] < 0.4) top++;
    let bottom = def.rows;
    while (bottom > 0 && rowOpen[bottom - 1] < 0.4) bottom--;
    this.bandTop = top * T;
    this.bandBottom = bottom >= def.rows ? Infinity : bottom * T;
  }

  /** True when world px (wx, wy) is on walkable ground. */
  private onGround(wx: number, wy: number): boolean {
    if (!this.ground) return true;
    const tx = Math.floor(wx / T);
    const ty = Math.floor(wy / T);
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return false;
    return this.ground[ty * this.cols + tx] === 1;
  }

  /** 0..1: streaks fade out behind the building fronts (the rows above bandTop and below bandBottom, and the sky margin above the map). */
  private streakFade(wy: number): number {
    const a = Math.min(1, Math.max(0, (wy - (this.bandTop - 14)) / 22));
    const b = Math.min(1, Math.max(0, (this.bandBottom + 6 - wy) / 22));
    return Math.min(a, b);
  }

  clearRoom(): void {
    for (const p of this.puddles) {
      p.img.destroy();
      p.mirror?.img.destroy();
    }
    for (const r of this.ripples) r.img.destroy();
    this.puddles = [];
    this.ripples = [];
    this.ground = null;
    this.bandTop = 0;
    this.bandBottom = Infinity;
  }

  /** for tests and shots */
  info() {
    return { puddles: this.puddles.length, drops: this.drops.filter((d) => d.img.visible).length, splashes: this.splashes.filter((s) => s.img.visible).length, ripples: this.ripples.filter((r) => r.active).length, vis: +this.vis.toFixed(2) };
  }

  /** Live particle count (rain + splashes + ripples), against the 300 cap. */
  particles(): number {
    return this.info().drops + this.info().splashes + this.info().ripples;
  }

  // ------------------------------------------------------------------ frame
  update(f: WeatherFrame): void {
    const to = f.outdoor ? 1 : 0;
    this.vis += (to - this.vis) * (1 - Math.exp(-f.dt / 0.45));
    if (Math.abs(this.vis - to) < 0.003) this.vis = to;
    const fx = this.fxLevel();
    const plan = rainPlan({ rain: f.params.rain * this.vis }, fx);

    // puddles follow the weather; ripples need them wet
    const wet = f.params.puddles * (f.outdoor ? 1 : 0);
    const pa = Math.min(1, wet) * 0.92;
    for (const p of this.puddles) {
      p.img.setAlpha(pa);
      if (p.mirror) {
        const l = p.mirror.light;
        const on = l.delay === undefined ? Math.min(1, f.night * 2) : f.lampOn(l.delay);
        const a = !v5on('mirror') ? 0 : on * Math.min(1, wet) * Math.min(1, f.night * 1.6) * (0.35 + 0.65 * p.mirror.k) * 0.7;
        p.mirror.img.setAlpha(a).setVisible(a > 0.01);
      }
    }

    this.updateDrops(f, plan);
    this.updateSplashes(f, plan);
    this.updateRipples(f, plan, wet);
  }

  private updateDrops(f: WeatherFrame, plan: ReturnType<typeof rainPlan>): void {
    const z = f.zoom;
    // grow the pool to the plan, shrink by hiding
    while (this.drops.length < plan.drops) {
      const far = Math.random() < 0.4;
      const img = this.rig.screen(this.scene.add.image(0, 0, far ? 'wx:drop_far' : 'wx:drop')).setDepth(DEPTH_RAIN).setOrigin(0.5, 0.5).setVisible(false);
      this.drops.push({ img, x: Math.random() * (f.w + 120 * z), y: Math.random() * f.h, k: 0.85 + Math.random() * 0.3, far, landY: f.h * (0.32 + Math.random() * 0.66) });
    }
    const color = rgbToInt(rainColor(f.night));
    const recolor = color !== this.tint;
    this.tint = color;
    const speed = plan.speed;
    const heavy = f.params.rain > 0.7;
    const view = f.cam.worldView;
    for (let i = 0; i < this.drops.length; i++) {
      const d = this.drops[i];
      if (i >= plan.drops) {
        if (d.img.visible) d.img.setVisible(false);
        continue;
      }
      const v = (d.far ? FALL_FAR : FALL) * d.k * speed * z;
      d.y += v * f.dt;
      d.x += WIND * d.k * speed * z * (d.far ? 0.73 : 1) * f.dt;
      const limit = heavy ? d.landY : f.h + 8 * z;
      if (d.y >= limit) {
        if (heavy && plan.splashes > 0 && !d.far && this.onGround(view.x + d.x / z, view.y + d.y / z)) this.spawnSplash(d.x, d.y, z);
        d.y = -8 * z - Math.random() * 40 * z;
        d.x = Math.random() * (f.w + 120 * z);
        d.landY = f.h * (0.32 + Math.random() * 0.66);
      }
      if (d.x < -6 * z) d.x += f.w + 126 * z;
      d.img
        .setPosition(Math.round(d.x), Math.round(d.y))
        .setScale(z)
        .setAlpha((d.far ? 0.34 : 0.6) * Math.min(1, this.vis * 1.2) * (1 - 0.4 * f.night) * this.streakFade(view.y + d.y / z))
        .setVisible(true);
      if (recolor) d.img.setTint(color);
    }
  }

  private spawnSplash(x: number, y: number, z: number): void {
    let s = this.splashes.find((q) => !q.img.visible);
    if (!s) {
      if (this.splashes.length >= 34) return;
      const img = this.rig.screen(this.scene.add.image(0, 0, 'wx:splash0')).setDepth(DEPTH_SPLASH).setOrigin(0.5, 1).setVisible(false);
      s = { img, t: 0 };
      this.splashes.push(s);
    }
    s.t = 0;
    s.img.setPosition(Math.round(x), Math.round(y)).setScale(z).setTexture('wx:splash0').setAlpha(0.6).setTint(this.tint).setVisible(true);
  }

  private updateSplashes(f: WeatherFrame, plan: ReturnType<typeof rainPlan>): void {
    for (const s of this.splashes) {
      if (!s.img.visible) continue;
      s.t += f.dt;
      if (plan.splashes === 0 || s.t > 0.22) {
        s.img.setVisible(false);
        continue;
      }
      s.img.setTexture(s.t < 0.09 ? 'wx:splash0' : 'wx:splash1').setAlpha(0.6 * (1 - s.t / 0.22));
    }
  }

  private updateRipples(f: WeatherFrame, plan: ReturnType<typeof rainPlan>, wet: number): void {
    const view = f.cam.worldView;
    let live = 0;
    for (const r of this.ripples) {
      if (!r.active) continue;
      r.t += f.dt;
      if (r.t >= r.life || plan.ripples === 0) {
        r.active = false;
        r.img.setVisible(false);
        continue;
      }
      live++;
      const k = r.t / r.life;
      r.img.setTexture(`wx:ripple${Math.min(3, Math.floor(k * 4))}`).setAlpha(0.7 * (1 - k) * Math.min(1, wet));
    }
    if (plan.ripples === 0 || wet < 0.5 || !this.puddles.length) return;
    // start a new ripple on a visible puddle when a slot is free
    this.ripplePuddleAt -= f.dt;
    if (this.ripplePuddleAt > 0 || live >= plan.ripples) return;
    this.ripplePuddleAt = 0.05 + Math.random() * 0.12;
    const free = this.ripples.find((r) => !r.active);
    if (!free) return;
    const seen = this.puddles.filter((p) => p.cx > view.x - 8 && p.cx < view.right + 8 && p.cy > view.y - 8 && p.cy < view.bottom + 8);
    if (!seen.length) return;
    const p = seen[Math.floor(Math.random() * seen.length)];
    free.active = true;
    free.t = 0;
    free.life = 0.55 + Math.random() * 0.3;
    free.img.setPosition(Math.round(p.cx + (Math.random() - 0.5) * (p.w - 8)), Math.round(p.cy + (Math.random() - 0.5) * (p.h - 4))).setVisible(true);
  }

  destroy(): void {
    this.clearRoom();
    for (const d of this.drops) d.img.destroy();
    for (const s of this.splashes) s.img.destroy();
    this.drops = [];
    this.splashes = [];
  }
}
