/**
 * Ambient life of the outdoor map (HOWTO Phase 6 step 5, DECISIONS "Phase 6b"): traffic and the bus, the vira-lata, pigeons, butterflies,
 * fireflies, falling ipê petals, cloud shadows and the fountain spray. Everything is purely visual (nothing blocks anything), deterministic
 * from the synced clock where it can be (`ambientSim.ts`), pooled, and it obeys the low-fx / reduced-motion levels of `perf.ts`.
 *
 * Depth follows the rest of the scene: anything standing sorts by its bottom y (vehicles by their wheels), things that fly sit above the
 * characters but under the tree canopies (50000), cloud shadows above everything in the world.
 */
import Phaser from 'phaser';
import type { RoomDef } from '@tudobem/shared';
import type { Manifest, SpriteDef } from './manifest';
import type { LightingRig, Light } from './lightingRig';
import type { FxLevel, WeatherParams } from './weatherLook';
import { DEPTH, propAnchor } from './props';
import { T } from './coords';
import { ensureAnim, originOf } from './spriteUtil';
import { AMBIENT, type AmbientRoom } from './ambientData';
import {
  CLOUD_CROPS,
  DogSim,
  butterfliesActive,
  cloudBlobs,
  cloudShadowAlpha,
  dogKey,
  firefliesActive,
  makeFlock,
  petalBudget,
  pigeonAlpha,
  roamTiles,
  stepFlock,
  vehiclesAt,
  type Pigeon,
  type Pt,
  type Vehicle,
} from './ambientSim';
import { hash2 } from './terrain';

export interface AmbientFrame {
  dt: number;
  /** server-synced wall clock, ms */
  t: number;
  /** game minute (fractional) */
  minute: number;
  params: WeatherParams;
  /** 0..1 night darkness of the scene */
  dark: number;
  /** feet of every player (world px) */
  people: readonly Pt[];
  cam: Phaser.Cameras.Scene2D.Camera;
}

const unit = (a: number, b: number, c: number) => hash2(a, b, c) / 4294967296;

/** The room-data prop whose art the ambient dog replaces (the scene skips it). */
export const ambientHandlesProp = (roomId: string, propId: string): boolean => AMBIENT[roomId]?.dog.propId === propId;

const DEPTH_FLY = 49000;
const DEPTH_PETAL = 49800;
const DEPTH_CLOUD = DEPTH.overhead + 900;
const HEADLIGHTS = 10;
const BUTTERFLY_COLORS = ['#f2c230', '#f4efe6', '#e8823a', '#6aa7e0'];
const PETAL_LIFE = 5;
const N_DROPS = 10;
const N_FIREFLIES = 16;
const N_BUTTERFLIES = 8;

function makeTex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): void {
  if (scene.textures.exists(key)) return;
  const t = scene.textures.createCanvas(key, w, h);
  if (!t) return;
  draw(t.getContext());
  t.refresh();
}

/** A small wing pattern: X = wing, B = body. */
function pixels(ctx: CanvasRenderingContext2D, rows: string[], wing: string): void {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (c === '.') continue;
      ctx.fillStyle = c === 'B' ? '#3b2b24' : wing;
      ctx.fillRect(x, y, 1, 1);
    }
  });
}

const BF_OPEN = ['.XX.XX.', 'XXXBXXX', 'XXXBXXX', '.XXBXX.'];
const BF_SHUT = ['..X..', '.XBX.', '.XBX.', '..B..'];

interface VehView {
  spr: Phaser.GameObjects.Sprite;
  shadows: Phaser.GameObjects.Image[];
  key: string;
  moving: boolean;
}

interface PetalView {
  img: Phaser.GameObjects.Image;
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  ground: number;
  phase: number;
}

interface FlockView {
  birds: Pigeon[];
  sprites: Phaser.GameObjects.Sprite[];
  shadows: Phaser.GameObjects.Image[];
  seed: number;
}

export class AmbientLife {
  private data: AmbientRoom | null = null;
  private def: RoomDef | null = null;
  private objs: Phaser.GameObjects.GameObject[] = [];
  private vehicles = new Map<string, VehView>();
  private headlights: Light[] = [];
  private dog: { sim: DogSim; spr: Phaser.GameObjects.Sprite; shadow: Phaser.GameObjects.Image; key: string } | null = null;
  private flocks: FlockView[] = [];
  private petals: PetalView[] = [];
  private spray: { img: Phaser.GameObjects.Image; phase: number; dx: number }[] = [];
  private fireflies: { img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; x: number; y: number; ph: number }[] = [];
  private butterflies: { img: Phaser.GameObjects.Image; cx: number; cy: number; ph: number; c: number }[] = [];
  private clouds: Phaser.GameObjects.Image[] = [];
  private canopies: { x0: number; x1: number; y0: number; y1: number; ground: number }[] = [];
  private petalCarry = 0;
  private forcedBusAt: number | undefined;
  private tSec = 0;
  private lastT = Date.now();
  private butterflyVis = 0;
  private fireflyVis = 0;
  private cloudVis = 0;
  private last = { vehicles: 0, bus: false, dogAnim: '', flocksAway: 0, clouds: 0 };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly rig: LightingRig,
    private readonly m: Manifest,
    private readonly fxLevel: () => FxLevel,
  ) {
    const s = scene;
    BUTTERFLY_COLORS.forEach((c, i) => {
      makeTex(s, `amb:bf${i}_0`, 7, 4, (ctx) => pixels(ctx, BF_OPEN, c));
      makeTex(s, `amb:bf${i}_1`, 5, 4, (ctx) => pixels(ctx, BF_SHUT, c));
    });
    makeTex(s, 'amb:ff', 3, 3, (ctx) => {
      ctx.fillStyle = '#f6f8b0';
      ctx.fillRect(1, 0, 1, 3);
      ctx.fillRect(0, 1, 3, 1);
      ctx.fillStyle = '#fffff0';
      ctx.fillRect(1, 1, 1, 1);
    });
    makeTex(s, 'amb:drop', 2, 2, (ctx) => {
      ctx.fillStyle = '#e4f3ff';
      ctx.fillRect(0, 0, 2, 2);
      ctx.fillStyle = '#a8d4f0';
      ctx.fillRect(1, 1, 1, 1);
    });
  }

  private reg<G extends Phaser.GameObjects.GameObject>(o: G): G {
    this.rig.world(o);
    this.objs.push(o);
    return o;
  }

  private regScreen<G extends Phaser.GameObjects.GameObject>(o: G): G {
    this.rig.screen(o);
    this.objs.push(o);
    return o;
  }

  private def_(key: string): SpriteDef | undefined {
    return this.m.sprites[key];
  }

  // ------------------------------------------------------------------ room
  buildRoom(def: RoomDef, walkable: (x: number, y: number) => boolean): void {
    this.clearRoom();
    const data = AMBIENT[def.id];
    if (!data || !def.outdoor) return;
    this.data = data;
    this.def = def;
    // headlight pool (rig lights: a hole in the night and a warm glow), parked with live 0
    for (let i = 0; i < HEADLIGHTS; i++) {
      const l: Light = { x: 0, y: 0, r: 30, color: 0xfff0c8, squash: 0.45, kind: 'car', live: 0, glow: 0.6 };
      this.headlights.push(l);
      this.rig.lights.push(l);
    }
    // the dog
    const home = data.dog.home;
    const tiles = roamTiles(home, data.dog.radius, walkable);
    const sim = new DogSim(home, tiles);
    const sd = this.def_(dogKey(sim.state));
    if (sd) {
      const spr = this.reg(this.scene.add.sprite(sim.x, sim.y, sd.atlas, sd.frame)).setOrigin(...originOf(sd));
      const shadow = this.reg(this.scene.add.image(sim.x, sim.y - 1, this.m.sprites['fx/shadow_16'].atlas, this.m.sprites['fx/shadow_16'].frame)).setOrigin(...originOf(this.m.sprites['fx/shadow_16'])).setDepth(DEPTH.shadowContact);
      this.dog = { sim, spr, shadow, key: '' };
    }
    // pigeons
    const pd = this.def_('critters/pigeon');
    const s10 = this.m.sprites['fx/shadow_10'];
    data.flocks.forEach((f, fi) => {
      if (!pd) return;
      const birds = makeFlock((f.x + 0.5) * T, (f.y + 0.7) * T, f.n, fi + 1);
      const sprites = birds.map((b, i) => {
        const spr = this.reg(this.scene.add.sprite(b.x, b.y, pd.atlas, pd.frame)).setOrigin(...originOf(pd));
        spr.play({ key: ensureAnim(this.scene, 'critters/pigeon', pd), startFrame: Math.floor(unit(fi, i, 41) * 6) });
        spr.anims.timeScale = 0.5 + unit(fi, i, 42) * 0.7;
        return spr;
      });
      const shadows = birds.map((b) => this.reg(this.scene.add.image(b.x, b.y - 1, s10.atlas, s10.frame)).setOrigin(...originOf(s10)).setDepth(DEPTH.shadowContact));
      this.flocks.push({ birds, sprites, shadows, seed: fi + 1 });
    });
    // petals: the canopies of the ipês
    for (const p of def.props) {
      if (p.kind !== 'ipe') continue;
      const d = this.def_(p.hero ? 'props/ipe_large' : 'props/ipe_medium');
      const od = d && typeof d.overhead === 'string' ? this.def_(d.overhead) : undefined;
      if (!d || !od) continue;
      const a = propAnchor(p);
      const left = Math.round(a.wx) - od.ax;
      const top = Math.round(a.wy) - od.ay;
      this.canopies.push({ x0: left + od.w * 0.18, x1: left + od.w * 0.82, y0: top + od.h * 0.3, y1: top + od.h * 0.62, ground: a.wy });
    }
    const p1 = this.def_('fx/petal_a');
    if (p1) {
      const budget = petalBudget(false, false);
      for (let i = 0; i < budget; i++) {
        const k = i % 2 ? 'fx/petal_a' : 'fx/petal_b';
        const d = this.m.sprites[k];
        const img = this.reg(this.scene.add.image(0, 0, d.atlas, d.frame)).setOrigin(0.5, 0.5).setDepth(DEPTH_PETAL).setVisible(false);
        this.petals.push({ img, alive: false, x: 0, y: 0, vx: 0, vy: 0, t: 0, ground: 0, phase: 0 });
      }
    }
    // butterflies around the ipês, fireflies over the lawns
    const trees = def.props.filter((p) => p.kind === 'ipe');
    for (let i = 0; i < N_BUTTERFLIES && trees.length; i++) {
      const tr = trees[i % trees.length];
      const a = propAnchor(tr);
      const c = i % BUTTERFLY_COLORS.length;
      const img = this.reg(this.scene.add.image(0, 0, `amb:bf${c}_0`)).setDepth(DEPTH_FLY).setVisible(false);
      this.butterflies.push({ img, cx: a.wx + (unit(i, 5, 51) - 0.5) * 30, cy: a.wy - 4 + unit(i, 5, 52) * 6, ph: unit(i, 5, 53) * 20, c });
    }
    const grass: { x: number; y: number }[] = [];
    for (let y = 0; y < def.rows; y++) for (let x = 0; x < def.cols; x++) if (def.floor[y]?.[x] === 'g' && walkable(x, y)) grass.push({ x, y });
    const glow = this.m.fx.glow ? 'fx:glow' : null;
    for (let i = 0; i < N_FIREFLIES && grass.length; i++) {
      const g = grass[Math.floor(unit(i, 6, 61) * grass.length) % grass.length];
      const x = (g.x + unit(i, 6, 62)) * T;
      const y = (g.y + unit(i, 6, 63)) * T;
      // screen space (fx camera, above the night): the darkness must not swallow them
      const img = this.regScreen(this.scene.add.image(x, y, 'amb:ff')).setDepth(4.2).setVisible(false);
      const halo = glow ? this.regScreen(this.scene.add.image(x, y, glow)).setBlendMode(Phaser.BlendModes.ADD).setTint(0xc8f060).setDepth(4.1).setVisible(false) : img;
      this.fireflies.push({ img, glow: halo, x, y, ph: unit(i, 6, 64) * 40 });
    }
    // fountain spray
    for (let i = 0; i < N_DROPS; i++) {
      const img = this.reg(this.scene.add.image(0, 0, 'amb:drop')).setDepth(data.fountain.y + 3).setVisible(false);
      this.spray.push({ img, phase: i / N_DROPS, dx: (unit(i, 7, 71) - 0.5) * 2 });
    }
    // cloud shadows: crops of the shadow texture
    if (this.scene.textures.exists('fx:cloudShadow')) {
      for (let i = 0; i < 4; i++) {
        const c = CLOUD_CROPS[i];
        const img = this.reg(this.scene.add.image(0, 0, 'fx:cloudShadow')).setOrigin(0, 0).setDepth(DEPTH_CLOUD).setAlpha(0).setCrop(c[0], c[1], c[2], c[3]);
        this.clouds.push(img);
      }
    }
    this.rig.syncLights();
  }

  clearRoom(): void {
    for (const o of this.objs) o.destroy();
    this.objs = [];
    this.vehicles.clear();
    this.headlights = [];
    this.dog = null;
    this.flocks = [];
    this.petals = [];
    this.spray = [];
    this.fireflies = [];
    this.butterflies = [];
    this.clouds = [];
    this.canopies = [];
    this.data = null;
    this.def = null;
  }

  /** Test and screenshot hook: a bus reaches the stop `inMs` from now (negative: it is already there). */
  bus(inMs = -500): void {
    this.forcedBusAt = this.lastT + inMs;
  }

  // ------------------------------------------------------------------ per frame
  update(f: AmbientFrame): void {
    const data = this.data;
    if (!data) return;
    const fx = this.fxLevel();
    this.tSec += f.dt;
    this.lastT = f.t;
    const rainy = f.params.rain;
    this.updateVehicles(data, f);
    this.updateDog(f);
    this.updateFlocks(f, fx);
    this.updateButterflies(f, fx, rainy);
    this.updateFireflies(f, fx, rainy);
    this.updatePetals(data, f, fx, rainy);
    this.updateSpray(f, fx);
    this.updateClouds(f, fx);
  }

  private updateVehicles(data: AmbientRoom, f: AmbientFrame): void {
    const wall = f.t;
    const list = vehiclesAt(data, wall, f.minute, { forcedBusAt: this.forcedBusAt });
    const seen = new Set<string>();
    const wallW = (this.def?.cols ?? 56) * T;
    let lit = 0;
    let bus = false;
    for (const v of list) {
      const d = this.def_(v.key);
      if (!d) continue;
      seen.add(v.id);
      let view = this.vehicles.get(v.id);
      if (!view) view = this.spawnVehicle(v, d);
      this.vehicles.set(v.id, view);
      const x = Math.round(v.x);
      view.spr.setPosition(x, v.laneY).setDepth(v.laneY + 0.3);
      // it slides in and out from behind the barricades at the map edge
      const edge = Math.min(x, wallW - x);
      view.spr.setAlpha(Math.max(0, Math.min(1, (edge + 6) / 70)));
      if (d.anim) {
        if (v.moving && !view.moving) view.spr.anims.resume();
        else if (!v.moving && view.moving) view.spr.anims.pause();
      }
      view.moving = v.moving;
      // shadows sit under the body
      const n = view.shadows.length;
      view.shadows.forEach((s, i) => s.setPosition(x + (n > 1 ? (i - (n - 1) / 2) * (v.len / 2.4) : 0), v.laneY - 1).setAlpha(view.spr.alpha));
      if (v.bus) bus = true;
      if (v.headlights && lit < this.headlights.length) {
        const l = this.headlights[lit++];
        const ahead = (v.dir === 'e' ? 1 : -1) * (v.len / 2 + 10);
        l.x = x + ahead;
        l.y = v.laneY - 7;
        l.r = v.bus ? 44 : 36;
        l.live = view.spr.alpha;
      }
    }
    for (let i = lit; i < this.headlights.length; i++) this.headlights[i].live = 0;
    for (const [id, view] of this.vehicles) {
      if (seen.has(id)) continue;
      view.spr.destroy();
      for (const s of view.shadows) s.destroy();
      this.objs = this.objs.filter((o) => o !== view.spr && !view.shadows.includes(o as Phaser.GameObjects.Image));
      this.vehicles.delete(id);
    }
    this.last.vehicles = this.vehicles.size;
    this.last.bus = bus;
  }

  private spawnVehicle(v: Vehicle, d: SpriteDef): VehView {
    const spr = this.reg(this.scene.add.sprite(v.x, v.laneY, d.atlas, d.frame)).setOrigin(...originOf(d));
    if (d.anim) spr.play({ key: ensureAnim(this.scene, v.key, d), startFrame: Math.floor(unit(v.x | 0, 3, 91) * 2) });
    const sd = d.shadow ? this.m.sprites[d.shadow] : null;
    const shadows: Phaser.GameObjects.Image[] = [];
    if (sd) {
      const n = v.len > 80 ? 2 : 1;
      for (let i = 0; i < n; i++) shadows.push(this.reg(this.scene.add.image(v.x, v.laneY - 1, sd.atlas, sd.frame)).setOrigin(...originOf(sd)).setDepth(DEPTH.shadowContact));
    }
    return { spr, shadows, key: v.key, moving: true };
  }

  private updateDog(f: AmbientFrame): void {
    const dog = this.dog;
    if (!dog) return;
    const st = dog.sim.update(f.dt, f.minute);
    const key = dogKey(st);
    const d = this.def_(key);
    if (!d) return;
    if (dog.key !== key) {
      dog.key = key;
      dog.spr.setFrame(d.frame).setOrigin(...originOf(d));
      if (d.anim) dog.spr.play({ key: ensureAnim(this.scene, key, d), startFrame: Math.floor(unit(key.length, 1, 92) * d.anim.frames.length) });
    }
    dog.spr.setPosition(Math.round(st.x), Math.round(st.y)).setDepth(st.y + 0.4);
    dog.shadow.setPosition(Math.round(st.x), Math.round(st.y) - 1);
    this.last.dogAnim = st.anim;
  }

  private updateFlocks(f: AmbientFrame, fx: FxLevel): void {
    let away = 0;
    for (const fl of this.flocks) {
      stepFlock(fl.birds, f.dt, f.people, fl.seed);
      fl.birds.forEach((b, i) => {
        const spr = fl.sprites[i];
        // low-fx: half the birds
        const hidden = fx.lowfx && i % 2 === 1;
        const a = hidden ? 0 : pigeonAlpha(b);
        spr.setVisible(a > 0.01).setAlpha(a);
        fl.shadows[i].setVisible(a > 0.01 && b.mode !== 'away').setAlpha(Math.max(0.25, a * (1 - Math.min(0.7, b.z / 60))));
        if (b.mode === 'away') away++;
        const air = b.z > 0.5;
        // wings: the sprite flips every 70 ms while it is airborne, and it is drawn lifted
        spr.setPosition(Math.round(b.x), Math.round(b.y - b.z));
        spr.setFlipX(air ? Math.floor(this.tSec * 14 + i) % 2 === 0 : false);
        spr.setDepth(air ? DEPTH_FLY : b.y);
        fl.shadows[i].setPosition(Math.round(b.x), Math.round(b.y) - 1);
        if (air) spr.anims.timeScale = 3;
        else if (spr.anims.timeScale === 3) spr.anims.timeScale = 0.5 + unit(fl.seed, i, 42) * 0.7;
      });
    }
    this.last.flocksAway = away;
  }

  private fade(cur: number, on: boolean, dt: number, rate = 1.2): number {
    return Math.max(0, Math.min(1, cur + (on ? dt : -dt) * rate));
  }

  private updateButterflies(f: AmbientFrame, fx: FxLevel, rain: number): void {
    const on = !fx.lowfx && !fx.reduced && butterfliesActive(f.minute, rain) && f.dark < 0.2;
    this.butterflyVis = this.fade(this.butterflyVis, on, f.dt);
    for (const b of this.butterflies) {
      b.img.setVisible(this.butterflyVis > 0.02);
      if (this.butterflyVis <= 0.02) continue;
      const t = this.tSec + b.ph;
      // a lazy loop around the tree with a little hop
      const x = b.cx + Math.cos(t * 0.55) * 20 + Math.sin(t * 1.3) * 4;
      const y = b.cy + Math.sin(t * 0.7) * 8 - 18 - Math.abs(Math.sin(t * 1.9)) * 6;
      b.img.setPosition(Math.round(x), Math.round(y)).setAlpha(this.butterflyVis);
      b.img.setTexture(`amb:bf${b.c}_${Math.floor(t * 7) % 2}`);
      b.img.setDepth(y + 60);
    }
  }

  private updateFireflies(f: AmbientFrame, fx: FxLevel, rain: number): void {
    const on = !fx.lowfx && !fx.reduced && firefliesActive(f.minute) && f.dark > 0.12 && rain < 0.25;
    this.fireflyVis = this.fade(this.fireflyVis, on, f.dt, 0.6);
    const cam = f.cam;
    const z = cam.zoom;
    const hw = cam.width / 2;
    const hh = cam.height / 2;
    for (const b of this.fireflies) {
      const vis = this.fireflyVis > 0.02;
      b.img.setVisible(vis);
      if (b.glow !== b.img) b.glow.setVisible(vis);
      if (!vis) continue;
      const t = this.tSec + b.ph;
      const blink = Math.max(0, Math.sin(t * 1.7)) ** 2;
      const wx = b.x + Math.sin(t * 0.6) * 9 + Math.sin(t * 1.7) * 2;
      const wy = b.y - 10 + Math.cos(t * 0.45) * 6;
      // world -> fx camera (device px), like the lighting rig; the dot is one art pixel block at the integer zoom
      const sx = Math.round((wx - cam.scrollX - hw) * z + hw);
      const sy = Math.round((wy - cam.scrollY - hh) * z + hh);
      b.img.setPosition(sx, sy).setScale(z).setAlpha(this.fireflyVis * (0.3 + 0.7 * blink));
      if (b.glow !== b.img) b.glow.setPosition(sx, sy).setScale((z * 22) / 128).setAlpha(this.fireflyVis * blink * 0.7);
    }
  }

  private updatePetals(data: AmbientRoom, f: AmbientFrame, fx: FxLevel, rain: number): void {
    void data;
    const cap = Math.min(this.petals.length, petalBudget(fx.lowfx, fx.reduced));
    // a gust of wind every so often: more petals, blown east
    const wind = Math.max(0, Math.sin(this.tSec * 0.19) * Math.sin(this.tSec * 0.047 + 1));
    let alive = 0;
    for (const p of this.petals) {
      if (!p.alive) continue;
      p.t += f.dt;
      p.vx += (wind * 26 - p.vx) * Math.min(1, f.dt * 1.5);
      p.x += (p.vx + Math.sin(p.t * 2.2 + p.phase) * 5) * f.dt;
      p.y += p.vy * f.dt;
      const life = p.y >= p.ground;
      if (life) {
        p.alive = false;
        p.img.setVisible(false);
        continue;
      }
      alive++;
      p.img.setPosition(Math.round(p.x), Math.round(p.y)).setAlpha(Math.min(1, p.t * 2) * (1 - Math.max(0, p.y - (p.ground - 10)) / 10));
    }
    if (!this.canopies.length) return;
    // spawn under the trees that are on screen
    const wv = f.cam.worldView;
    const near = this.canopies.filter((c) => c.x1 > wv.x - 30 && c.x0 < wv.right + 30 && c.y1 > wv.y - 30 && c.y0 < wv.bottom + 40);
    if (!near.length) return;
    const rate = (cap / PETAL_LIFE) * (0.55 + wind * 1.4) * (1 - rain * 0.7);
    this.petalCarry += rate * f.dt;
    while (this.petalCarry >= 1) {
      this.petalCarry -= 1;
      if (alive >= cap) break;
      const p = this.petals.find((q) => !q.alive);
      if (!p) break;
      const c = near[Math.floor(Math.random() * near.length)];
      p.alive = true;
      p.t = 0;
      p.x = c.x0 + Math.random() * (c.x1 - c.x0);
      p.y = c.y0 + Math.random() * (c.y1 - c.y0);
      p.vx = 0;
      p.vy = 11 + Math.random() * 9;
      p.ground = c.ground - 2 + Math.random() * 10;
      p.phase = Math.random() * 6;
      p.img.setVisible(true).setAlpha(0);
      alive++;
    }
  }

  private updateSpray(f: AmbientFrame, fx: FxLevel): void {
    const data = this.data;
    if (!data) return;
    const on = !fx.reduced;
    for (const s of this.spray) {
      s.img.setVisible(on);
      if (!on) continue;
      const u = (this.tSec * 1.1 + s.phase) % 1;
      // a jet: up fast, over and down into the basin
      const h = 4 * u * (1 - u) * 15;
      const x = data.fountain.x + s.dx * u * 11;
      s.img.setPosition(Math.round(x), Math.round(data.fountain.y - h)).setAlpha(u > 0.9 ? (1 - u) * 10 : 0.95);
    }
    void f;
  }

  private updateClouds(f: AmbientFrame, fx: FxLevel): void {
    if (!this.clouds.length) return;
    const on = !fx.lowfx && !fx.reduced;
    const a = on ? cloudShadowAlpha(f.params.sun, f.dark) : 0;
    this.cloudVis += (a - this.cloudVis) * Math.min(1, f.dt * 1.5);
    const w = (this.def?.cols ?? 56) * T;
    const h = (this.def?.rows ?? 40) * T;
    const blobs = cloudBlobs(this.clouds.length, this.tSec, w, h);
    this.clouds.forEach((img, i) => {
      const b = blobs[i];
      const c = CLOUD_CROPS[b.crop];
      img.setVisible(this.cloudVis > 0.01).setAlpha(this.cloudVis * 0.28).setPosition(Math.round(b.x - c[0]), Math.round(b.y - c[1]));
    });
    this.last.clouds = this.cloudVis > 0.01 ? this.clouds.length : 0;
  }

  // ------------------------------------------------------------------ info
  /** Live particles that count against the 300 cap: petals, butterflies, fireflies, spray drops. */
  particles(): number {
    let n = 0;
    for (const p of this.petals) if (p.alive) n++;
    if (this.butterflyVis > 0.02) n += this.butterflies.length;
    if (this.fireflyVis > 0.02) n += this.fireflies.length;
    if (this.spray.length && this.spray[0].img.visible) n += this.spray.length;
    return n;
  }

  info() {
    return { ...this.last, particles: this.particles(), petals: this.petals.filter((p) => p.alive).length, butterflies: this.butterflyVis > 0.02 ? this.butterflies.length : 0, fireflies: this.fireflyVis > 0.02 ? this.fireflies.length : 0 };
  }
}
