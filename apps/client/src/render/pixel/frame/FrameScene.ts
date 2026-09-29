/**
 * P1 style frame: a hard-coded 30x18 slice of praça rendered with Phaser from public/pixel (HOWTO Phase 1 step 3).
 * Everything on screen is a file from the manifest or a generated light/particle; nothing is drawn with canvas paths.
 */
import Phaser from 'phaser';
import type { Manifest, SpriteDef } from '../manifest';
import { COLS, ROWS, FLOOR, SHOPS, SHOP_BASE_Y, PROPS, TREES, WALKER_LOOP, SITTER, IDLER, PIGEONS, type PropPlacement } from './layout';
import { TERRAIN_PRIORITY, maskAt, phasedIndex, tileIndex } from '../terrain';
import { darknessAlpha, glowStrength, gradeAt, rgbToInt } from '../lighting';
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
  /** squash factor for the ground pool (1 = round halo) */
  squash: number;
  kind: 'lamp' | 'window' | 'player' | 'stall';
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

const hash01 = (n: number) => {
  let h = Math.imul(n | 0, 0x9e3779b1) ^ 0x85ebca6b;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return ((h ^ (h >>> 12)) >>> 0) / 4294967296;
};

export class FrameScene extends Phaser.Scene {
  private hour: number;
  private fxCam!: Phaser.Cameras.Scene2D.Camera;
  private grade!: Phaser.GameObjects.Rectangle;
  private dark!: Phaser.GameObjects.RenderTexture;
  private glowSprites: Phaser.GameObjects.Image[] = [];
  private windowRects: { rect: Phaser.GameObjects.Rectangle; x: number; y: number; w: number; h: number }[] = [];
  private lightSrc: Light[] = [];
  private castShadows: Phaser.GameObjects.Image[] = [];
  private cloud!: Phaser.GameObjects.TileSprite;
  private walker!: WalkerState;
  private pigeons: PigeonState[] = [];
  private canopies: { img: Phaser.GameObjects.Sprite; x0: number; y0: number; x1: number; y1: number; fade: number }[] = [];
  private zoomDev = 1;
  private lastLightKey = '';
  private petalEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];

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
  /** Debug/screenshot helper: current device zoom and camera. */
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

  /** A standing sprite from the manifest, with contact + cast shadow. Returns the image. */
  private place(key: string, tx: number, ty: number, opts: { flip?: boolean; depthBias?: number; noShadow?: boolean } = {}): Phaser.GameObjects.Sprite {
    const d = this.def(key);
    const wx = Math.round(tx * T), wy = Math.round(ty * T);
    const [ox, oy] = this.originOf(d);
    const spr = this.W(this.add.sprite(wx, wy, d.atlas, d.frame)).setOrigin(ox, oy).setDepth(wy + (opts.depthBias ?? 0));
    if (opts.flip) spr.setFlipX(true);
    if (d.anim) {
      const ak = 'anim:' + key;
      if (!this.anims.exists(ak)) this.anims.create({ key: ak, frames: d.anim.frames.map((f) => ({ key: d.atlas, frame: f })), frameRate: d.anim.fps, repeat: -1 });
      spr.play({ key: ak, startFrame: Math.floor(hash01(wx * 31 + wy) * d.anim.frames.length) });
    }
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
    const m = this.m;
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
    this.buildCharacters();
    this.buildPigeons();
    this.buildAmbient();
    this.buildLighting();
    this.applyGrade(true);
    // keep the camera framing on resize (the page passes a fresh zoom through opts on reload; this is enough for the frame)
    this.scale.on('resize', (size: Phaser.Structs.Size) => {
      this.fxCam.setSize(size.width, size.height);
      this.grade.setSize(size.width, size.height);
      this.dark.resize(size.width, size.height);
      cam.centerOn((this.opts.cx ?? COLS / 2) * T, (this.opts.cy ?? ROWS / 2) * T);
      this.lastLightKey = '';
    });
    void m;
  }

  // ------------------------------------------------------------------ terrain: one Tilemap layer per terrain, dual grid (half tile offset)
  private buildTerrain(): void {
    const t = this.m.terrain;
    const map = this.make.tilemap({ tileWidth: T, tileHeight: T, width: COLS + 1, height: ROWS + 1 });
    const ts = map.addTilesetImage('terrain', 'terrainTs', T, T, t.margin, t.spacing);
    if (!ts) throw new Error('terrain tileset failed');
    // flat underlays first (grass, asphalt), then slab terrains on top; see decisions-p1.md
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
    const mosaic = this.def('decals/sp_mosaic');
    this.W(this.add.image(14 * T, 9 * T, mosaic.atlas, mosaic.frame)).setOrigin(0, 0).setDepth(-5000);
    const pl = this.def('decals/petals_large');
    for (const t of TREES) {
      const d = t.key === 'props/ipe_large' ? pl : this.def('decals/petals_medium');
      this.W(this.add.image(Math.round(t.x * T) + 2, Math.round(t.y * T) - 2, d.atlas, d.frame)).setOrigin(0.5, 0.5).setDepth(-4900);
    }
  }

  private buildShops(): void {
    for (const s of SHOPS) {
      this.place(s.key, s.x, SHOP_BASE_Y, { noShadow: false });
    }
  }

  // ------------------------------------------------------------------ props
  private buildProps(): void {
    for (const p of PROPS) {
      this.place(p.key, p.x, p.y, { flip: p.flip });
      const d = this.def(p.key);
      if (d.light) {
        const [ox, oy] = [d.ax, d.ay];
        this.lightSrc.push({
          x: Math.round(p.x * T) + (d.light.x - ox),
          y: Math.round(p.y * T) + (d.light.y - oy),
          r: d.light.r,
          color: parseInt(d.light.color.slice(1), 16),
          squash: 1,
          kind: 'lamp',
        });
        // the pool of light lands on the ground near the base
        this.lightSrc.push({ x: Math.round(p.x * T) + 4, y: Math.round(p.y * T) - 3, r: d.light.r * 0.9, color: parseInt(d.light.color.slice(1), 16), squash: 0.55, kind: 'lamp' });
      }
    }
    // banca: warm interior light
    const bx = Math.round(21.5 * T), by = Math.round(8.0 * T);
    this.lightSrc.push({ x: bx, y: by - 18, r: 34, color: 0xffc46a, squash: 0.7, kind: 'stall' });
    // shop windows: rects + spill on the sidewalk
    for (const s of SHOPS) {
      const d = this.def(s.key);
      const ox = Math.round(s.x * T) - d.ax, oy = SHOP_BASE_Y * T - d.ay;
      for (const [wx, wy, ww, wh] of d.windows ?? []) {
        this.windowRects.push({ rect: this.W(this.add.rectangle(ox + wx, oy + wy, ww, wh, 0xffd070, 0)), x: ox + wx, y: oy + wy, w: ww, h: wh });
        this.lightSrc.push({ x: ox + wx + ww / 2, y: oy + wy + wh + 6, r: 24 + ww * 0.5, color: 0xffc060, squash: 0.6, kind: 'window' });
      }
    }
  }

  private buildTrees(): void {
    this.anims.globalTimeScale = 1;
    for (const t of TREES) {
      const trunk = this.place(t.key, t.x, t.y);
      void trunk;
      const d = this.def(t.key);
      if (typeof d.overhead !== 'string') continue;
      const cd = this.def(d.overhead);
      const wx = Math.round(t.x * T), wy = Math.round(t.y * T);
      const ak = 'anim:' + d.overhead;
      if (cd.anim && !this.anims.exists(ak)) this.anims.create({ key: ak, frames: cd.anim.frames.map((f) => ({ key: cd.atlas, frame: f })), frameRate: cd.anim.fps, repeat: -1 });
      const spr = this.W(this.add.sprite(wx, wy, cd.atlas, cd.frame)).setOrigin(...this.originOf(cd)).setDepth(50000 + wy / 1000);
      if (cd.anim) spr.play({ key: ak, startFrame: Math.floor(hash01(wx * 7 + wy) * 4) });
      const left = wx - cd.ax, top = wy - cd.ay;
      this.canopies.push({ img: spr, x0: left, y0: top, x1: left + cd.w, y1: top + cd.h + 14, fade: 1 });
      // petals fall from the canopy
      const emitter = this.W(
        this.add.particles(0, 0, d.atlas, {
          frame: ['fx/petal_a', 'fx/petal_b'],
          x: { min: left + 4, max: left + cd.w - 4 },
          y: { min: top + cd.h * 0.5, max: top + cd.h * 0.9 },
          lifespan: { min: 4200, max: 6500 },
          speedY: { min: 5, max: 11 },
          speedX: { min: -3, max: 7 },
          quantity: 1,
          frequency: 750,
          alpha: { start: 1, end: 0.15, ease: 'Sine.easeIn' },
          maxAliveParticles: 40,
        }),
      ).setDepth(50100);
      this.petalEmitters.push(emitter);
    }
  }

  // ------------------------------------------------------------------ characters
  private buildCharacters(): void {
    const meta = this.m.sheet;
    const skin = (i: number) => SKIN_TONES[i];
    const hair = (i: number) => HAIR_COLORS[i];
    const cloth = (i: number) => CLOTH_COLORS[i];
    const layers = (specs: [string, CharLayer['ramps']][]): CharLayer[] => specs.map(([k, r]) => ({ texture: `layer:${k}`, ramps: r }));
    // Júlia: blouse + jeans, walking a loop
    composeCharacter(this, 'char_julia', layers([
      ['body_medio', { skin: skin(2) }],
      ['outfit_o01', { top: cloth(12), bottom: cloth(2) }],
      ['hair_h02', { hair: hair(1) }],
    ]), meta);
    // Seu Zé on the bench
    composeCharacter(this, 'char_ze', layers([
      ['body_medio', { skin: skin(4) }],
      ['outfit_o13', { top: cloth(0), bottom: cloth(10) }],
      ['hair_h05', { hair: hair(5) }],
    ]), meta);
    // Nanda: mustard top, jeans
    composeCharacter(this, 'char_nanda', layers([
      ['body_medio', { skin: skin(5) }],
      ['outfit_o16', { top: cloth(1), bottom: cloth(2) }],
      ['hair_h12', { hair: hair(0) }],
    ]), meta);

    const shadow16 = this.def('fx/shadow_16');
    const mkShadow = (x: number, y: number) => this.W(this.add.image(x, y - 1, shadow16.atlas, shadow16.frame)).setOrigin(0.5, 0.5).setDepth(-4500);

    // walker
    const [wx, wy] = WALKER_LOOP[0];
    const sprite = this.W(this.add.sprite(wx * T, wy * T, 'char_julia', 0)).setOrigin(0.5, 1);
    this.walker = { sprite, shadow: mkShadow(wx * T, wy * T), sheet: 'char_julia', x: wx * T, y: wy * T, idx: 1, pause: 0, facing: 'E' };
    sprite.play(animKey('char_julia', 'walk', 'E'));

    // sitter (S-facing sit pose, on the bench)
    const sit = this.W(this.add.sprite(Math.round(SITTER.x * T), Math.round(SITTER.y * T), 'char_ze', sitFrame(meta, SITTER.facing))).setOrigin(0.5, 1);
    sit.setDepth(Math.round(SITTER.y * T) + 4);
    // idler
    const idle = this.W(this.add.sprite(Math.round(IDLER.x * T), Math.round(IDLER.y * T), 'char_nanda', 0)).setOrigin(0.5, 1);
    idle.setDepth(Math.round(IDLER.y * T));
    idle.play({ key: animKey('char_nanda', 'idle', IDLER.facing), startFrame: 2 });
    mkShadow(Math.round(IDLER.x * T), Math.round(IDLER.y * T));
    mkShadow(Math.round(SITTER.x * T), Math.round(SITTER.y * T) + 1);

    // a small light around Júlia when it gets dark
    this.lightSrc.push({ x: wx * T, y: wy * T - 8, r: 30, color: 0xffd9a0, squash: 1, kind: 'player' });
  }

  // ------------------------------------------------------------------ pigeons
  private buildPigeons(): void {
    const d = this.def('critters/pigeon');
    const sh = this.def('fx/shadow_16');
    PIGEONS.forEach((p, i) => {
      const x = p.x * T, y = p.y * T;
      const sprite = this.W(this.add.sprite(x, y, d.atlas, d.frame)).setOrigin(...this.originOf(d));
      const ak = 'anim:critters/pigeon';
      if (!this.anims.exists(ak)) this.anims.create({ key: ak, frames: d.anim!.frames.map((f) => ({ key: d.atlas, frame: f })), frameRate: d.anim!.fps, repeat: -1 });
      sprite.setFrame(d.anim!.frames[i % 6]);
      const shadow = this.W(this.add.image(x, y, sh.atlas, sh.frame)).setOrigin(0.5, 0.5).setDepth(-4500).setScale(0.6);
      this.pigeons.push({ sprite, shadow, x, y, tx: x, ty: y, wait: 0.5 + i * 0.7, flee: false });
    });
  }

  // ------------------------------------------------------------------ ambient: cloud shadows
  private buildAmbient(): void {
    const c = this.m.fx.cloudShadow;
    this.cloud = this.W(this.add.tileSprite(-64, -64, WORLD_W + 128, WORLD_H + 128, 'fx:cloudShadow')).setOrigin(0, 0).setDepth(60000).setAlpha(0.16).setTint(0x20306a);
    void c;
  }

  // ------------------------------------------------------------------ lighting (fx camera, screen space)
  private buildLighting(): void {
    const w = this.scale.width, h = this.scale.height;
    this.grade = this.F(this.add.rectangle(0, 0, w, h, 0xffffff)).setOrigin(0, 0).setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(1);
    this.dark = this.F(this.add.renderTexture(0, 0, w, h)).setOrigin(0, 0).setDepth(2);
    for (let i = 0; i < this.lightSrc.length; i++) {
      const g = this.F(this.add.image(0, 0, 'fx:glow')).setBlendMode(Phaser.BlendModes.ADD).setDepth(3).setAlpha(0);
      this.glowSprites.push(g);
    }
    this.cameras.main.postFX.addVignette(0.5, 0.5, 0.92, 0.2);
  }

  private applyGrade(force = false): void {
    const key = this.hour.toFixed(3);
    if (!force && key === this.lastLightKey) return;
    this.lastLightKey = key;
    this.grade.setFillStyle(rgbToInt(gradeAt(this.hour)));
    const dark = darknessAlpha(this.hour);
    const gs = glowStrength(this.hour);
    // cast shadows fade with the light
    for (const c of this.castShadows) c.setAlpha(Math.max(0.15, 1 - dark * 1.1));
    // darkness overlay with soft light holes
    this.dark.clear();
    if (dark > 0.001) {
      this.dark.fill(0x0b1030, dark);
      this.lightSrc.forEach((l, i) => {
        const strength = l.kind === 'player' ? Math.min(1, dark / 0.35) : gs;
        if (strength <= 0) return;
        const [sx, sy] = this.toScreen(l.x, l.y);
        const px = (l.r * 2 * this.cameras.main.zoom) / 128;
        this.dark.stamp('fx:glow', undefined, sx, sy, { scaleX: px, scaleY: px * l.squash, alpha: Math.min(1, strength * 1.05), erase: true });
      });
    }
    this.lightSrc.forEach((l, i) => {
      const g = this.glowSprites[i];
      const strength = l.kind === 'player' ? Math.min(1, dark / 0.35) * 0.55 : gs;
      const [sx, sy] = this.toScreen(l.x, l.y);
      const px = (l.r * 2 * this.cameras.main.zoom) / 128;
      g.setPosition(sx, sy).setScale(px, px * l.squash).setTint(l.color).setAlpha(strength * (l.kind === 'window' ? 0.32 : l.kind === 'stall' ? 0.3 : 0.4));
    });
    for (const wr of this.windowRects) wr.rect.setAlpha(gs * 0.62).setBlendMode(Phaser.BlendModes.ADD).setDepth(49000);
  }

  // ------------------------------------------------------------------ frame loop
  override update(_time: number, delta: number): void {
    const dt = Math.min(0.05, delta / 1000);
    this.updateWalker(dt);
    this.updatePigeons(dt);
    this.updateCanopies(dt);
    this.cloud.tilePositionX += dt * 5;
    this.cloud.tilePositionY += dt * 1.6;
    this.cloud.tilePositionX = Math.round(this.cloud.tilePositionX * 4) / 4;
    // light follows the walker
    const pl = this.lightSrc.find((l) => l.kind === 'player');
    if (pl) {
      pl.x = this.walker.x;
      pl.y = this.walker.y - 8;
    }
    // redraw the lighting every frame: the walker's light moves, and the slider changes the hour
    this.lastLightKey = '';
    this.applyGrade();
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
    for (const p of this.pigeons) {
      const dw = Math.hypot(p.x - wk.x, p.y - wk.y);
      if (dw < 30 && !p.flee) {
        p.flee = true;
        const ang = Math.atan2(p.y - wk.y, p.x - wk.x);
        p.tx = Phaser.Math.Clamp(p.x + Math.cos(ang) * 44, 16, WORLD_W - 16);
        p.ty = Phaser.Math.Clamp(p.y + Math.sin(ang) * 26, 7 * T, 13 * T);
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
          p.wait = 1.5 + hash01(Math.floor(p.x * 13 + p.y * 7 + this.time.now)) * 3;
          const a = hash01(Math.floor(this.time.now / 100) + Math.floor(p.x)) * Math.PI * 2;
          p.tx = Phaser.Math.Clamp(p.x + Math.cos(a) * 14, 8 * T, 20 * T);
          p.ty = Phaser.Math.Clamp(p.y + Math.sin(a) * 8, 8 * T, 13.5 * T);
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

export type { PropPlacement };
