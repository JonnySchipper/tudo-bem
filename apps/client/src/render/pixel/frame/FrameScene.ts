/**
 * P1 style frame: a hard-coded 30x18 slice of praça rendered with Phaser from public/pixel (HOWTO Phase 1 step 3).
 * Everything on screen is a file from the manifest or a generated light/particle; nothing is drawn with canvas paths.
 *
 * Two cameras: `main` (zoom = integer device zoom) draws the world; `fx` (zoom 1, screen space) draws the grade, the night
 * darkness and the additive glow so those stay smooth at screen resolution while the art stays crisp.
 */
import Phaser from 'phaser';
import type { Manifest, SpriteDef } from '../manifest';
import {
  COLS, ROWS, FLOOR, SHOPS, PROPS, TREES, DECALS, TUFTS, GRIME, WALKER_LOOP, SITTERS, IDLERS, PIGEONS, PIGEON_BOUNDS, LANES, POLES, WIRE_SPANS, type Lane,
} from './layout';
import { TERRAIN_PRIORITY, maskAt, phasedIndex, tileIndex } from '../terrain';
import { darknessAlpha, glowStrength, gradeAt, rgbToInt, shadowFill, sunGlow } from '../lighting';
import { HAIR_COLORS, CLOTH_COLORS, SKIN_TONES } from '@tudobem/shared';
import { animKey, composeCharacter, sitFrame, type CharLayer, type Facing } from '../charsheet';

const T = 16;
export const WORLD_W = COLS * T;
export const WORLD_H = ROWS * T;

export interface FrameOptions {
  hour: number;
  /** integer CSS zoom (art px -> CSS px); default from the HOWTO 5.3 formula */
  zoom?: number;
  /** camera centre in tiles; default = map centre */
  cx?: number;
  cy?: number;
  dpr: number;
}

interface Light {
  x: number; // world px
  y: number;
  r: number; // world px radius
  color: number;
  /** vertical squash of the glow (1 = round halo, <1 = pool on the ground) */
  squash: number;
  kind: 'lamp' | 'window' | 'player' | 'stall' | 'car';
  /** 0..1 multiplier set per frame for dynamic lights */
  live?: number;
  /** additive glow alpha override */
  glow?: number;
}

interface WalkerState {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  sheet: string;
  x: number;
  y: number;
  idx: number;
  pause: number;
  facing: Facing;
}

interface PigeonState {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  x: number;
  y: number;
  tx: number;
  ty: number;
  wait: number;
  flee: boolean;
}

interface CarState {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  lane: Lane;
  x: number;
  speed: number;
  wait: number;
  light: Light;
  variant: number;
}

const hash01 = (n: number) => {
  let h = Math.imul(n | 0, 0x9e3779b1) ^ 0x85ebca6b;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return ((h ^ (h >>> 12)) >>> 0) / 4294967296;
};

export class FrameScene extends Phaser.Scene {
  private hour: number;
  private fxCam!: Phaser.Cameras.Scene2D.Camera;
  private grade!: Phaser.GameObjects.RenderTexture;
  private fill!: Phaser.GameObjects.Rectangle;
  private litOverlays: Phaser.GameObjects.Image[] = [];
  private dark!: Phaser.GameObjects.RenderTexture;
  private sun!: Phaser.GameObjects.Image;
  private glowSprites: Phaser.GameObjects.Image[] = [];
  private windowRects: Phaser.GameObjects.Rectangle[] = [];
  private lightSrc: Light[] = [];
  private castShadows: Phaser.GameObjects.Image[] = [];
  private cloud!: Phaser.GameObjects.TileSprite;
  private walker!: WalkerState;
  private pigeons: PigeonState[] = [];
  private cars: CarState[] = [];
  private canopies: { img: Phaser.GameObjects.Sprite; x0: number; y0: number; x1: number; y1: number; fade: number }[] = [];
  private zoomDev = 1;
  private clock = 0;
  /** true once create() finished (the page polls this) */
  ready = false;

  constructor(private readonly m: Manifest, private readonly base: string, private readonly opts: FrameOptions) {
    super('frame');
    this.hour = opts.hour;
  }

  // ------------------------------------------------------------------ API used by the page
  setHour(h: number): void {
    this.hour = h;
  }
  getHour(): number {
    return this.hour;
  }
  /** Feet of the walking character, world px. */
  walkerPos(): { x: number; y: number } {
    return { x: Math.round(this.walker.x), y: Math.round(this.walker.y) };
  }
  /** World px -> CSS px in the page (for the DOM label overlay). */
  worldToClient(wx: number, wy: number): { x: number; y: number } {
    const [sx, sy] = this.toScreen(wx, wy);
    return { x: sx / this.opts.dpr, y: sy / this.opts.dpr };
  }
  /** CSS px per art px. */
  cssScale(): number {
    return this.zoomDev / this.opts.dpr;
  }
  info() {
    return { zoom: this.zoomDev, cssZoom: this.zoomDev / this.opts.dpr, scrollX: this.cameras.main.scrollX, scrollY: this.cameras.main.scrollY };
  }

  // ------------------------------------------------------------------ loading
  preload(): void {
    const m = this.m;
    const b = this.base;
    for (const [name, a] of Object.entries(m.atlases)) this.load.atlas(name, b + a.image, b + a.data);
    this.load.image('terrainTs', b + m.terrain.tileset);
    for (const [key, file] of Object.entries(m.chars)) this.load.image(`layer:${key}`, b + file);
    for (const [key, f] of Object.entries(m.fx)) this.load.image(`fx:${key}`, b + f.file);
  }

  // ------------------------------------------------------------------ helpers
  private W<G extends Phaser.GameObjects.GameObject>(o: G): G {
    this.fxCam.ignore(o);
    return o;
  }
  private F<G extends Phaser.GameObjects.GameObject>(o: G): G {
    this.cameras.main.ignore(o);
    return o;
  }
  private def(key: string): SpriteDef {
    const d = this.m.sprites[key];
    if (!d) throw new Error('manifest: missing sprite ' + key);
    return d;
  }
  private originOf(d: SpriteDef): [number, number] {
    return [d.ax / d.w, d.ay / d.h];
  }
  private toScreen(wx: number, wy: number): [number, number] {
    const cam = this.cameras.main;
    const hw = cam.width / 2, hh = cam.height / 2;
    return [(wx - cam.scrollX - hw) * cam.zoom + hw, (wy - cam.scrollY - hh) * cam.zoom + hh];
  }
  private ensureAnim(key: string, d: SpriteDef): string {
    const ak = 'anim:' + key;
    if (d.anim && !this.anims.exists(ak)) this.anims.create({ key: ak, frames: d.anim.frames.map((f) => ({ key: d.atlas, frame: f })), frameRate: d.anim.fps, repeat: -1 });
    return ak;
  }

  /** Keys the layout asked for that the manifest doesn't have (HOWTO 5.10). The frame shows a flat magenta box, never a painted stand-in. */
  readonly artMissing: string[] = [];

  private placeholder(key: string, tx: number, ty: number): Phaser.GameObjects.Sprite {
    if (!this.artMissing.includes(key)) {
      this.artMissing.push(key);
      console.warn('[pixel] missing art:', key);
    }
    const wx = Math.round(tx * T), wy = Math.round(ty * T);
    const box = this.W(this.add.rectangle(wx, wy, T, T, 0xff00ff, 0.35)).setOrigin(0.5, 1).setStrokeStyle(1, 0xff00ff, 1).setDepth(wy);
    // the caller only needs a depth/position handle; a rectangle is enough
    return box as unknown as Phaser.GameObjects.Sprite;
  }

  /** A standing sprite from the manifest, with contact + cast shadow. */
  private place(key: string, tx: number, ty: number, opts: { flip?: boolean; depthBias?: number; noShadow?: boolean } = {}): Phaser.GameObjects.Sprite {
    if (!this.m.sprites[key]) return this.placeholder(key, tx, ty);
    const d = this.def(key);
    const wx = Math.round(tx * T), wy = Math.round(ty * T);
    const spr = this.W(this.add.sprite(wx, wy, d.atlas, d.frame)).setOrigin(...this.originOf(d)).setDepth(wy + (opts.depthBias ?? 0));
    if (opts.flip) spr.setFlipX(true).setOrigin(1 - d.ax / d.w, d.ay / d.h);
    if (d.anim) spr.play({ key: this.ensureAnim(key, d), startFrame: Math.floor(hash01(wx * 31 + wy) * d.anim.frames.length) });
    if (!opts.noShadow) {
      if (d.cast) {
        const c = this.W(this.add.image(wx, wy, d.atlas, d.cast.frame)).setOrigin(d.cast.ax / d.cast.w, d.cast.ay / d.cast.h).setDepth(-4600);
        this.castShadows.push(c);
      }
      if (d.shadow) {
        const s = this.def(d.shadow);
        this.W(this.add.image(wx, wy - 1, s.atlas, s.frame)).setOrigin(...this.originOf(s)).setDepth(-4500);
      }
    }
    return spr;
  }

  // ------------------------------------------------------------------ create
  create(): void {
    const cam = this.cameras.main;
    const dpr = this.opts.dpr;
    const cssZoom = this.opts.zoom ?? Math.min(5, Math.max(2, Math.floor(Math.min(window.innerWidth / (20 * T), window.innerHeight / (12 * T)))));
    this.zoomDev = Number.isInteger(dpr) ? cssZoom * dpr : Math.max(1, Math.floor(cssZoom * dpr));
    cam.setBackgroundColor('#1d1b26');
    cam.setZoom(this.zoomDev);
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.centerOn((this.opts.cx ?? COLS / 2) * T, (this.opts.cy ?? ROWS / 2) * T);

    this.fxCam = this.cameras.add(0, 0, this.scale.width, this.scale.height, false, 'fx');
    this.fxCam.setRoundPixels(false);

    this.buildTerrain();
    this.buildDecals();
    this.buildShops();
    this.buildProps();
    this.buildTrees();
    this.buildWires();
    this.buildCharacters();
    this.buildPigeons();
    this.buildCars();
    this.buildAmbient();
    this.buildLighting();
    this.applyLighting();
    this.ready = true;
    this.scale.on('resize', (size: Phaser.Structs.Size) => {
      this.fxCam.setSize(size.width, size.height);
      this.grade.resize(size.width, size.height);
      this.dark.resize(size.width, size.height);
      this.fill.setSize(size.width, size.height);
      cam.centerOn((this.opts.cx ?? COLS / 2) * T, (this.opts.cy ?? ROWS / 2) * T);
    });
  }

  // ------------------------------------------------------------------ terrain: one Tilemap layer per terrain, dual grid (half tile offset)
  private buildTerrain(): void {
    const t = this.m.terrain;
    const map = this.make.tilemap({ tileWidth: T, tileHeight: T, width: COLS + 1, height: ROWS + 1 });
    const ts = map.addTilesetImage('terrain', 'terrainTs', T, T, t.margin, t.spacing);
    if (!ts) throw new Error('terrain tileset failed');
    // flat underlays first (grass, asphalt), then slab terrains on top (see decisions-p1.md)
    const order = [...TERRAIN_PRIORITY].filter((c) => t.layers[c]);
    order.sort((a, b) => Number(t.layers[a].edge === 'slab') - Number(t.layers[b].edge === 'slab'));
    order.forEach((ch, li) => {
      const def = t.layers[ch];
      const layer = map.createBlankLayer(`terrain_${ch}`, ts, -T / 2, -T / 2, COLS + 1, ROWS + 1);
      if (!layer) throw new Error('layer failed ' + ch);
      layer.setDepth(-10000 + li);
      this.W(layer);
      for (let j = 0; j <= ROWS; j++) {
        for (let i = 0; i <= COLS; i++) {
          const mask = maskAt(FLOOR, ch, i, j);
          const idx = def.edge === 'slab' ? phasedIndex(def.first, mask, i, def.phases) : tileIndex(def.first, mask, i, j, def.variants);
          if (idx >= 0) layer.putTileAt(idx, i, j);
        }
      }
    });
  }

  // ------------------------------------------------------------------ ground decals
  private buildDecals(): void {
    for (const p of DECALS) {
      const d = this.def(p.key);
      const wx = Math.round(p.x * T), wy = Math.round(p.y * T);
      const img = this.W(this.add.image(wx, wy, d.atlas, d.frame));
      if (p.topLeft) img.setOrigin(0, 0);
      else img.setOrigin(...this.originOf(d));
      img.setDepth(p.key.includes('flowers') ? -4800 : -5000);
    }
    // petals fallen under each ipê
    for (const t of TREES) {
      const d = this.def(t.key === 'props/ipe_large' ? 'decals/petals_large' : 'decals/petals_medium');
      this.W(this.add.image(Math.round(t.x * T) + 3, Math.round(t.y * T) - 1, d.atlas, d.frame)).setOrigin(0.5, 0.5).setDepth(-4900);
    }
    // lane dashes down the middle of the road
    const dash = this.def('decals/lane_dash');
    for (let x = 4; x < WORLD_W; x += 32) this.W(this.add.image(x, 16 * T - 1, dash.atlas, dash.frame)).setOrigin(0, 0).setDepth(-5000);
    // grime stains
    for (const g of GRIME) {
      const d = this.def(`decals/grime_${g.k}`);
      this.W(this.add.image(Math.round(g.x * T), Math.round(g.y * T), d.atlas, d.frame)).setOrigin(...this.originOf(d)).setDepth(-4950);
    }
    // tufts
    for (const t of TUFTS) {
      const d = this.def(`decals/tuft_${t.k}`);
      this.W(this.add.image(Math.round(t.x * T), Math.round(t.y * T), d.atlas, d.frame)).setOrigin(...this.originOf(d)).setDepth(-4400);
    }
  }

  private buildShops(): void {
    for (const s of SHOPS) {
      this.place(s.key, s.x, s.y);
      // lit windows
      const d = this.def(s.key);
      const ox = Math.round(s.x * T) - d.ax, oy = s.y * T - d.ay;
      if (d.lit && this.m.sprites[d.lit]) {
        // authored lit-window overlay: warm panes (and bread / gym silhouettes) fade in with the night
        const ld = this.def(d.lit);
        this.litOverlays.push(this.W(this.add.image(Math.round(s.x * T), Math.round(s.y * T), ld.atlas, ld.frame)).setOrigin(...this.originOf(ld)).setDepth(Math.round(s.y * T) + 0.5).setAlpha(0));
      }
      for (const [wx, wy, ww, wh] of d.windows ?? []) {
        if (!d.lit) this.windowRects.push(this.W(this.add.rectangle(ox + wx, oy + wy, ww, wh, 0xffd070, 0).setOrigin(0, 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(49000)));
        this.lightSrc.push({ x: ox + wx + ww / 2, y: oy + wy + wh + 5, r: 22 + ww * 0.5, color: 0xffc060, squash: 0.6, kind: 'window' });
      }
    }
  }

  // ------------------------------------------------------------------ props
  private buildProps(): void {
    for (const p of PROPS) {
      this.place(p.key, p.x, p.y, { flip: p.flip });
      const d = this.m.sprites[p.key];
      if (!d) continue;
      if (typeof d.overhead === 'string' && this.m.sprites[d.overhead]) {
        const od = this.def(d.overhead);
        const wx0 = Math.round(p.x * T), wy0 = Math.round(p.y * T);
        this.W(this.add.image(wx0, wy0, od.atlas, od.frame)).setOrigin(...this.originOf(od)).setDepth(50000 + wy0 / 1000);
      }
      if (d.light) {
        const color = parseInt(d.light.color.slice(1), 16);
        const bx = Math.round(p.x * T), by = Math.round(p.y * T);
        const dir = p.flip ? -1 : 1;
        this.lightSrc.push({ x: bx + (d.light.x - d.ax) * dir, y: by + (d.light.y - d.ay), r: d.light.r * 0.55, color, squash: 1, kind: 'lamp', glow: 0.4 });
        // the pool of light lands on the ground around the base
        this.lightSrc.push({ x: bx + 5 * dir, y: by - 2, r: d.light.r * 1.3, color, squash: 0.55, kind: 'lamp', glow: 0.26 });
      }
    }
    // banca: warm interior light
    const banca = PROPS.find((p) => p.key === 'props/banca');
    if (banca) this.lightSrc.push({ x: Math.round(banca.x * T), y: Math.round(banca.y * T) - 16, r: 36, color: 0xffc46a, squash: 0.75, kind: 'stall' });
  }

  private buildTrees(): void {
    for (const t of TREES) {
      this.place(t.key, t.x, t.y);
      const d = this.def(t.key);
      if (typeof d.overhead !== 'string') continue;
      const cd = this.def(d.overhead);
      const wx = Math.round(t.x * T), wy = Math.round(t.y * T);
      const spr = this.W(this.add.sprite(wx, wy, cd.atlas, cd.frame)).setOrigin(...this.originOf(cd)).setDepth(50000 + wy / 1000);
      if (cd.anim) spr.play({ key: this.ensureAnim(d.overhead, cd), startFrame: Math.floor(hash01(wx * 7 + wy) * 4) });
      const left = wx - cd.ax, top = wy - cd.ay;
      this.canopies.push({ img: spr, x0: left, y0: top, x1: left + cd.w, y1: top + cd.h + 14, fade: 1 });
      // petals fall from the canopy
      this.W(
        this.add.particles(0, 0, d.atlas, {
          frame: ['fx/petal_a', 'fx/petal_b'],
          x: { min: left + 4, max: left + cd.w - 4 },
          y: { min: top + cd.h * 0.45, max: top + cd.h * 0.9 },
          lifespan: { min: 4200, max: 6500 },
          speedY: { min: 5, max: 11 },
          speedX: { min: -3, max: 7 },
          quantity: 1,
          frequency: 650,
          alpha: { start: 1, end: 0.15, ease: 'Sine.easeIn' },
          maxAliveParticles: 40,
        }),
      ).setDepth(50100);
    }
  }

  // ------------------------------------------------------------------ utility poles + overhead wires
  private buildWires(): void {
    for (const p of POLES) this.place('props/poste_fios', p.x, p.y);
    const pd = this.m.sprites['props/poste_fios'];
    if (!pd) return;
    const attachY = pd.attach?.[1] ?? -51;
    for (const span of WIRE_SPANS) {
      const pole = POLES[span.from];
      let wx = Math.round(pole.x * T);
      const wy = Math.round(pole.y * T) + attachY;
      for (const key of span.keys) {
        const d = this.m.sprites[key];
        if (!d) { this.placeholder(key, wx / T, pole.y); continue; }
        this.W(this.add.image(wx, wy, d.atlas, d.frame)).setOrigin(...this.originOf(d)).setDepth(50200);
        wx += d.w - 1;
      }
    }
  }

  // ------------------------------------------------------------------ characters
  private buildCharacters(): void {
    const meta = this.m.sheet;
    const skin = (i: number) => SKIN_TONES[i];
    const hair = (i: number) => HAIR_COLORS[i];
    const cloth = (i: number) => CLOTH_COLORS[i];
    const layers = (specs: [string, CharLayer['ramps']][]): CharLayer[] => specs.map(([k, r]) => ({ texture: `layer:${k}`, ramps: r }));
    composeCharacter(this, 'char_julia', layers([['body_medio', { skin: skin(2) }], ['outfit_o01', { top: cloth(12), bottom: cloth(2) }], ['hair_h02', { hair: hair(1) }]]), meta);
    composeCharacter(this, 'char_ze', layers([['body_medio', { skin: skin(4) }], ['outfit_o13', { top: cloth(0), bottom: cloth(10) }], ['hair_h05', { hair: hair(5) }]]), meta);
    composeCharacter(this, 'char_mara', layers([['body_medio', { skin: skin(3) }], ['outfit_o01', { top: cloth(9), bottom: cloth(5) }], ['hair_h12', { hair: hair(6) }]]), meta);
    composeCharacter(this, 'char_nanda', layers([['body_medio', { skin: skin(5) }], ['outfit_o16', { top: cloth(1), bottom: cloth(2) }], ['hair_h12', { hair: hair(0) }]]), meta);
    composeCharacter(this, 'char_beto', layers([['body_medio', { skin: skin(1) }], ['outfit_o13', { top: cloth(6), bottom: cloth(11) }], ['hair_h02', { hair: hair(3) }]]), meta);

    const shadow16 = this.def('fx/shadow_16');
    const mkShadow = (x: number, y: number) => this.W(this.add.image(x, y - 1, shadow16.atlas, shadow16.frame)).setOrigin(0.5, 0.5).setDepth(-4500);

    const [wx, wy] = WALKER_LOOP[0];
    const sprite = this.W(this.add.sprite(wx * T, wy * T, 'char_julia', 0)).setOrigin(0.5, 1);
    this.walker = { sprite, shadow: mkShadow(wx * T, wy * T), sheet: 'char_julia', x: wx * T, y: wy * T, idx: 1, pause: 0, facing: 'E' };
    sprite.play(animKey('char_julia', 'walk', 'E'));

    // sitters: S-facing sit pose in front of the bench (depth just above the bench)
    for (const s of SITTERS) {
      const benchY = Math.round(s.y * T);
      const spr = this.W(this.add.sprite(Math.round(s.x * T), benchY - 3, s.sheet, sitFrame(meta, s.facing))).setOrigin(0.5, 1);
      spr.setDepth(benchY + 1);
      mkShadow(Math.round(s.x * T), benchY);
    }
    for (const s of IDLERS) {
      const spr = this.W(this.add.sprite(Math.round(s.x * T), Math.round(s.y * T), s.sheet, 0)).setOrigin(0.5, 1);
      spr.setDepth(Math.round(s.y * T));
      spr.play({ key: animKey(s.sheet, 'idle', s.facing), startFrame: Math.floor(hash01(s.x * 100) * 6) });
      mkShadow(Math.round(s.x * T), Math.round(s.y * T));
    }
    // a small light around Júlia when it gets dark
    this.lightSrc.push({ x: wx * T, y: wy * T - 8, r: 34, color: 0xffd9a0, squash: 1, kind: 'player' });
  }

  // ------------------------------------------------------------------ pigeons
  private buildPigeons(): void {
    const d = this.def('critters/pigeon');
    const sh = this.def('fx/shadow_10');
    this.ensureAnim('critters/pigeon', d);
    PIGEONS.forEach((p, i) => {
      const x = p.x * T, y = p.y * T;
      const sprite = this.W(this.add.sprite(x, y, d.atlas, d.frame)).setOrigin(...this.originOf(d));
      sprite.setFrame(d.anim!.frames[i % 6]);
      const shadow = this.W(this.add.image(x, y, sh.atlas, sh.frame)).setOrigin(0.5, 0.5).setDepth(-4500);
      this.pigeons.push({ sprite, shadow, x, y, tx: x, ty: y, wait: 0.5 + i * 0.7, flee: false });
    });
  }

  // ------------------------------------------------------------------ traffic
  private buildCars(): void {
    LANES.forEach((lane, li) => {
      const key = lane.keys[0];
      const d = this.def(key);
      const sprite = this.W(this.add.sprite(0, 0, d.atlas, d.frame)).setOrigin(...this.originOf(d));
      if (d.anim) sprite.play(this.ensureAnim(key, d));
      const sh = this.def('fx/shadow_48');
      const shadow = this.W(this.add.image(0, 0, sh.atlas, sh.frame)).setOrigin(...this.originOf(sh)).setDepth(-4500);
      const light: Light = { x: 0, y: 0, r: 30, color: 0xfff1c8, squash: 0.55, kind: 'car', live: 0 };
      this.lightSrc.push(light);
      // the first car of each lane starts on screen so the frame always shows traffic
      const onScreen = lane.startX !== null;
      const startX = (lane.startX ?? (lane.dir < 0 ? 26.5 : 7.5)) * T;
      this.cars.push({ sprite, shadow, lane, x: startX, speed: lane.speed, wait: onScreen ? 0 : 7, light, variant: 0 });
      this.positionCar(this.cars[li]);
      if (!onScreen) {
        sprite.setVisible(false);
        shadow.setVisible(false);
      }
    });
  }

  private positionCar(c: CarState): void {
    const y = Math.round(c.lane.y * T);
    c.sprite.setPosition(Math.round(c.x), y).setDepth(y);
    c.shadow.setPosition(Math.round(c.x), y - 1);
    c.light.x = c.x + c.lane.dir * 26;
    c.light.y = y - 8;
  }

  private updateCars(dt: number): void {
    for (const c of this.cars) {
      if (c.wait > 0) {
        c.wait -= dt;
        c.sprite.setVisible(false);
        c.shadow.setVisible(false);
        c.light.live = 0;
        if (c.wait <= 0) {
          c.variant = (c.variant + 1) % c.lane.keys.length;
          const key = c.lane.keys[c.variant];
          const d = this.def(key);
          c.sprite.setFrame(d.frame).setOrigin(...this.originOf(d));
          if (d.anim) c.sprite.play(this.ensureAnim(key, d), true);
          else c.sprite.anims.stop();
          c.x = c.lane.dir < 0 ? WORLD_W + 90 : -90;
          c.sprite.setVisible(true);
          c.shadow.setVisible(true);
        }
        continue;
      }
      c.x += c.lane.dir * c.speed * dt;
      if ((c.lane.dir < 0 && c.x < -90) || (c.lane.dir > 0 && c.x > WORLD_W + 90)) c.wait = 5 + Math.random() * 6;
      c.light.live = 1;
      this.positionCar(c);
    }
  }

  // ------------------------------------------------------------------ ambient: cloud shadows
  private buildAmbient(): void {
    this.cloud = this.W(this.add.tileSprite(-64, -64, WORLD_W + 128, WORLD_H + 128, 'fx:cloudShadow')).setOrigin(0, 0).setDepth(60000).setAlpha(0.13).setTint(0x1c2a66);
  }

  // ------------------------------------------------------------------ lighting (fx camera, screen space)
  private buildLighting(): void {
    const w = this.scale.width, h = this.scale.height;
    // grade: a full-screen multiply layer. Light sources erase holes in it, so lit pools are not tinted by the grade.
    this.grade = this.F(this.add.renderTexture(0, 0, w, h)).setOrigin(0, 0).setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(1);
    // darkness overlay for night (normal blend), also with light holes
    // cool blue fill in the shadows (SCREEN lifts darks more than lights): keeps golden hour from being a flat orange wash
    this.fill = this.F(this.add.rectangle(0, 0, w, h, 0x3454a8, 0)).setOrigin(0, 0).setBlendMode(Phaser.BlendModes.SCREEN).setDepth(1.5);
    this.dark = this.F(this.add.renderTexture(0, 0, w, h)).setOrigin(0, 0).setDepth(2);
    for (let i = 0; i < this.lightSrc.length; i++) {
      this.glowSprites.push(this.F(this.add.image(0, 0, 'fx:glow')).setBlendMode(Phaser.BlendModes.ADD).setDepth(3).setAlpha(0));
    }
    this.sun = this.F(this.add.image(0, 0, 'fx:glow')).setBlendMode(Phaser.BlendModes.ADD).setDepth(3.5).setTint(0xffb867).setAlpha(0);
    this.cameras.main.postFX.addVignette(0.5, 0.5, 0.92, 0.2);
  }

  private applyLighting(): void {
    const zoom = this.cameras.main.zoom;
    const dark = darknessAlpha(this.hour);
    const gs = glowStrength(this.hour);
    for (const c of this.castShadows) c.setAlpha(Math.max(0.15, 1 - dark * 1.1));
    const strengthOf = (l: Light) => {
      if (l.kind === 'player') return Math.min(1, dark / 0.35);
      if (l.kind === 'car') return gs * (l.live ?? 0);
      return gs;
    };
    this.grade.fill(rgbToInt(gradeAt(this.hour)), 1);
    const sf = shadowFill(this.hour);
    this.fill.setFillStyle(rgbToInt(sf.color), sf.alpha);
    for (const o of this.litOverlays) o.setAlpha(Math.min(1, gs * 0.95));
    this.dark.clear();
    if (dark > 0.001) this.dark.fill(0x0b1030, dark);
    this.lightSrc.forEach((l, i) => {
      const s = strengthOf(l);
      const g = this.glowSprites[i];
      const [sx, sy] = this.toScreen(l.x, l.y);
      const px = (l.r * 2 * zoom) / 128;
      if (s > 0.001) {
        // erase: the grade is mostly lifted inside the light, the darkness fully
        this.grade.stamp('fx:glow', undefined, sx, sy, { scaleX: px, scaleY: px * l.squash, alpha: Math.min(1, s * 0.9), erase: true });
        if (dark > 0.001) this.dark.stamp('fx:glow', undefined, sx, sy, { scaleX: px, scaleY: px * l.squash, alpha: Math.min(1, s * 1.05), erase: true });
      }
      const glowAlpha = l.glow ?? (l.kind === 'window' ? 0.3 : l.kind === 'stall' ? 0.3 : l.kind === 'player' ? 0.22 : l.kind === 'car' ? 0.3 : 0.42);
      g.setPosition(sx, sy).setScale(px, px * l.squash).setTint(l.color).setAlpha(s * glowAlpha);
    });
    for (const r of this.windowRects) r.setAlpha(gs * 0.6);
    // low sun: a big warm glow from the upper left (adds warmth and shows the light direction without darkening the scene)
    const sw = this.scale.width, sh = this.scale.height;
    this.sun.setPosition(sw * 0.12, -sh * 0.08).setScale((Math.max(sw, sh) * 2.1) / 128).setAlpha(sunGlow(this.hour) * 0.2);
  }

  // ------------------------------------------------------------------ frame loop
  override update(_time: number, delta: number): void {
    const dt = Math.min(0.05, delta / 1000);
    this.clock += dt;
    this.updateWalker(dt);
    this.updatePigeons(dt);
    this.updateCars(dt);
    this.updateCanopies(dt);
    this.cloud.tilePositionX = Math.round((this.cloud.tilePositionX + dt * 4) * 4) / 4;
    this.cloud.tilePositionY = Math.round((this.cloud.tilePositionY + dt * 1.4) * 4) / 4;
    const pl = this.lightSrc.find((l) => l.kind === 'player');
    if (pl) {
      pl.x = this.walker.x;
      pl.y = this.walker.y - 8;
    }
    this.applyLighting();
  }

  private updateWalker(dt: number): void {
    const w = this.walker;
    if (w.pause > 0) {
      w.pause -= dt;
      if (w.pause <= 0) w.sprite.play(animKey(w.sheet, 'walk', w.facing), true);
      return;
    }
    const [tx, ty] = WALKER_LOOP[w.idx];
    const dx = tx * T - w.x, dy = ty * T - w.y;
    const dist = Math.hypot(dx, dy);
    const step = 24 * dt;
    if (dist <= step) {
      w.x = tx * T;
      w.y = ty * T;
      w.idx = (w.idx + 1) % WALKER_LOOP.length;
      w.pause = 0.9;
      w.sprite.play(animKey(w.sheet, 'idle', w.facing), true);
    } else {
      w.x += (dx / dist) * step;
      w.y += (dy / dist) * step;
      const f: Facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'E' : 'W') : dy > 0 ? 'S' : 'N';
      if (f !== w.facing) {
        w.facing = f;
        w.sprite.play(animKey(w.sheet, 'walk', f), true);
      }
    }
    w.sprite.setPosition(Math.round(w.x), Math.round(w.y)).setDepth(Math.round(w.y));
    w.shadow.setPosition(Math.round(w.x), Math.round(w.y) - 1);
  }

  private updatePigeons(dt: number): void {
    const wk = this.walker;
    const b = PIGEON_BOUNDS;
    for (const p of this.pigeons) {
      const dw = Math.hypot(p.x - wk.x, p.y - wk.y);
      if (dw < 30 && !p.flee) {
        p.flee = true;
        const ang = Math.atan2(p.y - wk.y, p.x - wk.x);
        p.tx = Phaser.Math.Clamp(p.x + Math.cos(ang) * 44, b.x0 * T, b.x1 * T);
        p.ty = Phaser.Math.Clamp(p.y + Math.sin(ang) * 26, b.y0 * T, b.y1 * T);
      }
      const dx = p.tx - p.x, dy = p.ty - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.6) {
        const sp = (p.flee ? 64 : 14) * dt;
        p.x += (dx / dist) * Math.min(sp, dist);
        p.y += (dy / dist) * Math.min(sp, dist);
        if (!p.sprite.anims.isPlaying) p.sprite.play('anim:critters/pigeon');
        p.sprite.setFlipX(dx < 0);
      } else {
        if (p.sprite.anims.isPlaying) p.sprite.anims.stop();
        p.flee = false;
        p.wait -= dt;
        if (p.wait <= 0) {
          p.wait = 1.5 + hash01(Math.floor(p.x * 13 + p.y * 7 + this.clock * 10)) * 3;
          const a = hash01(Math.floor(this.clock * 10) + Math.floor(p.x)) * Math.PI * 2;
          p.tx = Phaser.Math.Clamp(p.x + Math.cos(a) * 14, b.x0 * T, b.x1 * T);
          p.ty = Phaser.Math.Clamp(p.y + Math.sin(a) * 8, b.y0 * T, b.y1 * T);
        }
      }
      p.sprite.setPosition(Math.round(p.x), Math.round(p.y)).setDepth(Math.round(p.y));
      p.shadow.setPosition(Math.round(p.x), Math.round(p.y) - 1);
    }
  }

  private updateCanopies(dt: number): void {
    const { x, y } = this.walker;
    for (const c of this.canopies) {
      const inside = x >= c.x0 && x <= c.x1 && y >= c.y0 + 8 && y <= c.y1;
      const target = inside ? 0.45 : 1;
      c.fade += (target - c.fade) * Math.min(1, dt / 0.15);
      c.img.setAlpha(c.fade);
    }
  }
}
