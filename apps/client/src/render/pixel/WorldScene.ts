/**
 * The game's Phaser scene (HOWTO §5.1, §6 Phase 2). A VIEW ONLY (D3): every frame it reconciles `game` (state.ts) into sprites; nothing
 * here is game truth, and Phaser input is disabled (main.ts owns input, networking and state).
 *
 *  - When the room changes (room + instanceId + ownerId) the room layer is destroyed and rebuilt: terrain from the `floor` rows (dual
 *    grid), north wall band + west wall strip, doors, props, NPCs, lights.
 *  - Avatars and placed furniture are reconciled every frame (add / update / remove).
 *  - Art comes from public/pixel through the manifest; whatever the manifest lacks is a flat placeholder (§5.10).
 *
 * Two cameras (DECISIONS Phase 1 #13): `main` draws the world at an integer device zoom, `fx` draws the light grade in screen space.
 */
import Phaser from 'phaser';
import { buildGrid, canPlaceFurniture, furnitureById, isCpuId, key as tileKey, positionAlong, propTiles, type Dir, type NpcDef, type PlacedFurniture, type PropDef, type RoomDef, type RoomGrid } from '@tudobem/shared';
import { game, type ClientAvatar } from '../../state';
import type { Guide, Hit } from '../view';
import type { Manifest } from './manifest';
import { FACING, type Facing } from './facing';
import { addSheetTexture, animKey, animNames, emoteDuration, sitFrame } from './charsheet';
import { CharSheets } from './charCache';
import type { CharAssets } from './charAssets';
import { composeLook } from './composeLook';
import { lookForAppearance, lookForNpc, lookHeadLift, type Look } from './looks';
import { LightingRig } from './lightingRig';
import { buildTerrainLayers } from './terrainLayers';
import { LabelLayer, type GuideItem, type StackItem } from './labels';
import { T, cameraCenter, cssZoomFor, deviceZoomFor, feet, snapToDevice, tileToWorld, worldToCanvas, type CamState, type Insets, type Rect } from './coords';
import { pickHit, type HitBox } from './hit';
import { roomKey, syncViews } from './reconcile';
import { DEPTH, PROP_LIGHT, footprintRect, inflate, propAnchor, propArtKey, propPlaceholderKey, propSize, spriteRect, standingDepth, unionRect } from './props';
import {
  FLOOR_PLACEHOLDER,
  FLOOR_SUBSTITUTE,
  NORTH_BAND_TILES,
  ROOM_HOUR,
  describeSkipped,
  decorCoveredByFacade,
  doormatRect,
  isNorthPortal,
  northBandRect,
  northDecor,
  northDecorRect,
  northDoorRect,
  northFacades,
  portalHitRect,
  roomBounds,
  westDoorRect,
  westStripRect,
} from './roomLayout';
import { ensureAnim, originOf } from './spriteUtil';

export interface SceneHost {
  labels: LabelLayer;
  guides: () => Guide[];
  /** HUD space to keep clear, CSS px */
  insets: () => Insets;
  lowfx: boolean;
  debugArt: boolean;
}

interface AvatarView {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  sheet: string;
  appearance: unknown;
  hat: string | null;
  look: Look;
  parrot: Phaser.GameObjects.Sprite | null;
  anim: string;
  facing: Facing;
  /** world px of the feet */
  wx: number;
  wy: number;
  lastX: number;
  lastY: number;
  sitting: boolean;
  moving: boolean;
}

interface NpcView {
  npc: NpcDef;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  sheet: string;
  /** art px the sprite rises above a bare head (hats) */
  lift: number;
}

interface FurnitureView {
  rect: Phaser.GameObjects.Rectangle;
  itemId: string;
  x: number;
  y: number;
}

interface Canopy {
  sprite: Phaser.GameObjects.Sprite;
  r: Rect;
  fade: number;
}

/** Art px from the feet to the top of the visible head (the 16x32 frame has empty rows above it); nameplates stand just above. */
const HEAD_LIFT = 23;
const HEAD_LIFT_SIT = 16;

const hex = (h: string) => Phaser.Display.Color.HexStringToColor(h).color;
const hash01 = (n: number) => {
  let h = Math.imul(n | 0, 0x9e3779b1) ^ 0x85ebca6b;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return ((h ^ (h >>> 12)) >>> 0) / 4294967296;
};

export class WorldScene extends Phaser.Scene {
  /** true once create() finished */
  ready = false;
  /** keys the scene asked for that the manifest lacks (HOWTO §5.10); mirrored to window.__tb.artMissing */
  readonly artMissing: string[] = [];
  cam: CamState = { zoom: 4, dpr: 1, cx: 0, cy: 0, w: 1, h: 1 };
  /** CSS px per art px (`WorldView.cam.scale`) */
  cssScale = 4;
  hitBoxes: HitBox[] = [];

  private rig!: LightingRig;
  private sheets!: CharSheets;
  private roomId = '';
  private roomDef: RoomDef | null = null;
  private roomObjs: Phaser.GameObjects.GameObject[] = [];
  private roomMap: Phaser.Tilemaps.Tilemap | null = null;
  private staticHits: HitBox[] = [];
  private placeholders: { key: string; rect: Rect }[] = [];
  private npcs: NpcView[] = [];
  private canopies: Canopy[] = [];
  private avatars = new Map<string, AvatarView>();
  private furniture = new Map<string, FurnitureView>();
  private grid: RoomGrid | null = null;
  private gridFurniture: PlacedFurniture[] | null = null;
  private bounds: Rect = { x0: 0, y0: 0, x1: 1, y1: 1 };
  private snapCamera = true;
  private hoverRect!: Phaser.GameObjects.Rectangle;
  private lastT = 0;

  constructor(
    private readonly m: Manifest,
    private readonly base: string,
    private readonly assets: CharAssets,
    private readonly host: SceneHost,
  ) {
    super('world');
  }

  // ------------------------------------------------------------------ loading
  preload(): void {
    const m = this.m;
    const b = this.base;
    for (const [name, a] of Object.entries(m.atlases)) this.load.atlas(name, b + a.image, b + a.data);
    this.load.image('terrainTs', b + m.terrain.tileset);
    for (const [key, f] of Object.entries(m.fx)) this.load.image(`fx:${key}`, b + f.file);
  }

  create(): void {
    const cam = this.cameras.main;
    cam.setBackgroundColor('#1d1b26');
    cam.setRoundPixels(true);
    this.rig = new LightingRig(this, cam, 'fx:glow');
    this.sheets = new CharSheets({
      add: (key, look) => addSheetTexture(this, key, composeLook(this.assets, look), this.m.sheet),
      remove: (key) => {
        for (const name of animNames(this.m.sheet)) for (const f of ['S', 'W', 'E', 'N'] as Facing[]) this.anims.remove(animKey(key, name, f));
        if (this.textures.exists(key)) this.textures.remove(key);
      },
    });
    // the hover marker belongs to the scene, not to a room layer
    this.hoverRect = this.rig.world(this.add.rectangle(0, 0, T, T, 0xffffff, 0.22)).setOrigin(0, 0).setStrokeStyle(1, 0xffffff, 0.8).setDepth(49000).setVisible(false);
    if (!this.host.lowfx) cam.postFX.addVignette(0.5, 0.5, 0.88, 0.22);
    this.scale.on('resize', (size: Phaser.Structs.Size) => this.rig.resize(size.width, size.height));
    this.ready = true;
  }

  private reg<G extends Phaser.GameObjects.GameObject>(o: G): G {
    this.rig.world(o);
    this.roomObjs.push(o);
    return o;
  }

  // ------------------------------------------------------------------ placeholders (HOWTO §5.10)
  private noteMissing(key: string): void {
    if (this.artMissing.includes(key)) return;
    this.artMissing.push(key);
  }

  /** A flat magenta box the size of the footprint. Never a painted stand-in. */
  private placeholder(key: string, r: Rect, depth: number): Phaser.GameObjects.Rectangle {
    this.noteMissing(key.replace(/#.*$/, ''));
    this.placeholders.push({ key, rect: r });
    return this.reg(this.add.rectangle((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, r.x1 - r.x0, r.y1 - r.y0, 0xff00ff, 0.35)).setStrokeStyle(1, 0xff00ff, 1).setDepth(depth);
  }

  private flat(r: Rect, color: number, depth: number): Phaser.GameObjects.Rectangle {
    return this.reg(this.add.rectangle(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0, color, 1)).setOrigin(0, 0).setDepth(depth);
  }

  // ------------------------------------------------------------------ sprites
  /** A standing sprite from the manifest with its contact and cast shadows; null when the manifest has no such key. */
  private sprite(key: string, wx: number, wy: number, depth: number, shadow = true): Phaser.GameObjects.Sprite | null {
    const d = this.m.sprites[key];
    if (!d) return null;
    const x = Math.round(wx);
    const y = Math.round(wy);
    const spr = this.reg(this.add.sprite(x, y, d.atlas, d.frame)).setOrigin(...originOf(d)).setDepth(depth);
    if (d.anim) spr.play({ key: ensureAnim(this, key, d), startFrame: Math.floor(hash01(x * 31 + y) * d.anim.frames.length) });
    if (shadow) {
      if (d.cast) {
        const c = this.reg(this.add.image(x, y, d.atlas, d.cast.frame)).setOrigin(d.cast.ax / d.cast.w, d.cast.ay / d.cast.h).setDepth(DEPTH.shadowCast);
        this.rig.castShadows.push(c);
      }
      const s = d.shadow ? this.m.sprites[d.shadow] : null;
      if (s) this.reg(this.add.image(x, y - 1, s.atlas, s.frame)).setOrigin(...originOf(s)).setDepth(DEPTH.shadowContact);
    }
    return spr;
  }

  // ------------------------------------------------------------------ room layer
  private destroyRoom(): void {
    for (const n of this.npcs) this.sheets.release(n.sheet);
    this.npcs = [];
    for (const o of this.roomObjs) o.destroy();
    this.roomObjs = [];
    this.roomMap?.destroy();
    this.roomMap = null;
    this.staticHits = [];
    this.placeholders = [];
    this.canopies = [];
    // furniture rectangles were registered with the room objects
    this.furniture.clear();
    this.rig.clearRoom();
  }

  private buildRoom(def: RoomDef): void {
    this.destroyRoom();
    const m = this.m;
    const has = (k: string) => !!m.sprites[k];
    const missingBefore = this.artMissing.length;

    // ---- terrain: dual-grid layers for the floor chars that have art; substitutes and flat placeholders for the rest
    const res = buildTerrainLayers(this, def.floor, m.terrain, 'terrainTs', { outside: 'x', wrap: (o) => this.rig.world(o), substitute: FLOOR_SUBSTITUTE });
    this.roomMap = res.map;
    const chars = new Set(def.floor.join(''));
    for (const ch of chars) {
      if (m.terrain.layers[ch]) continue;
      this.noteMissing(`terrain/${ch}`);
      const color = FLOOR_PLACEHOLDER[ch];
      if (color === undefined || FLOOR_SUBSTITUTE[ch]) continue; // 'x' is drawn as nothing; substituted terrain already drew
      def.floor.forEach((row, y) => {
        let x = 0;
        while (x < row.length) {
          if (row[x] !== ch) {
            x++;
            continue;
          }
          const x0 = x;
          while (x < row.length && row[x] === ch) x++;
          this.flat({ x0: x0 * T, y0: y * T, x1: x * T, y1: (y + 1) * T }, hex(color), DEPTH.terrain + 5);
        }
      });
    }

    // ---- walls: north band and west strip, from the room's own colors (flat placeholders until wall art exists)
    const band = northBandRect(def);
    this.noteMissing('walls/north');
    this.flat(band, hex(def.wallColor), DEPTH.wall);
    this.flat({ x0: band.x0, y0: -3, x1: band.x1, y1: 0 }, hex(def.wallTrim), DEPTH.wall + 1);
    const strip = westStripRect(def);
    this.noteMissing('walls/west');
    this.flat(strip, hex(def.wallColor), DEPTH.wall);
    this.flat({ x0: -3, y0: strip.y0, x1: 0, y1: strip.y1 }, hex(def.wallTrim), DEPTH.wall + 1);

    // ---- facades on north doors
    const facades = northFacades(def, has);
    let tallest = 0;
    for (const f of facades) {
      const d = m.sprites[f.key];
      const spr = this.sprite(f.key, f.wx, f.wy, standingDepth(f.wy, f.key));
      if (!spr) continue;
      tallest = Math.max(tallest, d.ay);
      if (d.lit && m.sprites[d.lit]) {
        const ld = m.sprites[d.lit];
        this.rig.litOverlays.push(this.reg(this.add.image(Math.round(f.wx), Math.round(f.wy), ld.atlas, ld.frame)).setOrigin(...originOf(ld)).setDepth(f.wy + 0.5).setAlpha(0));
      }
      for (const [wx, wy, ww, wh] of d.windows ?? []) {
        this.rig.lights.push({ x: Math.round(f.wx) - d.ax + wx + ww / 2, y: Math.round(f.wy) - d.ay + wy + wh + 5, r: 22 + ww * 0.5, color: 0xffc060, squash: 0.6, kind: 'window' });
      }
    }

    // ---- north wall decor (placeholders); west wall decor is skipped in Phase 2
    for (const d of northDecor(def)) {
      if (decorCoveredByFacade(d, facades)) continue;
      this.placeholder(`walls/${d.kind}`, northDecorRect(d), DEPTH.wallDecor);
    }

    // ---- doors
    for (const p of def.portals) {
      if (isNorthPortal(p)) {
        if (!facades.some((f) => f.portal.id === p.id)) this.placeholder('doors/north', northDoorRect(p), DEPTH.wallDecor);
      } else {
        this.placeholder('doors/west', westDoorRect(p), DEPTH.wallDecor);
        this.placeholder('props/doormat', inflate(doormatRect(p), -2), DEPTH.groundDecal);
      }
      const r = portalHitRect(p);
      this.staticHits.push({ ...r, hit: { kind: 'portal', portal: p }, depth: r.y1 });
    }

    // ---- ground decals: fallen petals under each ipê
    for (const p of def.props) {
      if (p.kind !== 'ipe') continue;
      const a = propAnchor(p);
      const pd = m.sprites[p.hero ? 'decals/petals_large' : 'decals/petals_medium'];
      if (pd) this.reg(this.add.image(Math.round(a.wx) + 3, Math.round(a.wy) - 1, pd.atlas, pd.frame)).setOrigin(0.5, 0.5).setDepth(-4900);
    }

    // ---- props
    for (const p of def.props) this.buildProp(p);

    // ---- NPCs
    for (const n of def.npcs) this.buildNpc(n);

    this.rig.syncLights();
    this.bounds = roomBounds(def, tallest);
    this.snapCamera = true;
    const skipped = describeSkipped({ [def.id]: def });
    if (skipped.length) console.info('[pixel] west-wall decor skipped in Phase 2:', skipped.join('; '));
    if (this.artMissing.length !== missingBefore) console.info('[pixel] missing art (placeholders):', this.artMissing.join(', '));
  }

  private buildProp(p: PropDef): void {
    const m = this.m;
    const a = propAnchor(p);
    const flat = p.kind === 'tatame';
    const depth = flat ? DEPTH.groundDecal + 10 : standingDepth(a.wy, p.id);
    const foot = footprintRect(p);
    let visual: Rect = foot;
    const artKey = propArtKey(p);
    const d = artKey ? m.sprites[artKey] : undefined;
    if (artKey && d) {
      this.sprite(artKey, a.wx, a.wy, depth);
      visual = unionRect(foot, spriteRect(Math.round(a.wx), Math.round(a.wy), d));
      if (typeof d.overhead === 'string' && m.sprites[d.overhead]) {
        const od = m.sprites[d.overhead];
        const x = Math.round(a.wx);
        const y = Math.round(a.wy);
        const spr = this.reg(this.add.sprite(x, y, od.atlas, od.frame)).setOrigin(...originOf(od)).setDepth(DEPTH.overhead + y / 1000);
        if (od.anim) spr.play({ key: ensureAnim(this, d.overhead, od), startFrame: Math.floor(hash01(x * 7 + y) * 4) });
        const left = x - od.ax;
        const top = y - od.ay;
        this.canopies.push({ sprite: spr, r: { x0: left, y0: top + 8, x1: left + od.w, y1: top + od.h + 14 }, fade: 1 });
      }
      const L = d.light ? { x: d.light.x - d.ax, y: d.light.y - d.ay, r: d.light.r, color: d.light.color } : PROP_LIGHT[p.kind];
      if (L) this.addLampLights(Math.round(a.wx), Math.round(a.wy), L);
    } else {
      this.placeholder(`${propPlaceholderKey(p)}#${p.id}`, foot, depth);
    }

    if (p.action) {
      this.staticHits.push({ ...inflate(unionRect(visual, foot), 2), hit: { kind: 'prop', prop: p }, depth: a.wy });
    } else if (p.seat) {
      const { w, h } = propSize(p);
      for (const t of propTiles(p)) {
        const tile: Rect = { x0: t.x * T, y0: t.y * T, x1: (t.x + 1) * T, y1: (t.y + 1) * T };
        // a single-tile seat (bench, stool) is clickable over its whole sprite, with a little slack; long seats per tile, taller
        const r = w === 1 && h === 1 ? inflate(unionRect(visual, tile), 3) : { ...tile, y0: tile.y0 - 6 };
        this.staticHits.push({ ...r, hit: { kind: 'seat', tile: { x: t.x, y: t.y } }, depth: a.wy });
      }
    }
  }

  private addLampLights(bx: number, by: number, L: { x: number; y: number; r: number; color: string }): void {
    const color = parseInt(L.color.slice(1), 16);
    this.rig.lights.push({ x: bx + L.x, y: by + L.y, r: L.r * 0.55, color, squash: 1, kind: 'lamp', glow: 0.4 });
    // the pool of light lands on the ground around the base
    this.rig.lights.push({ x: bx + 5, y: by - 2, r: L.r * 1.3, color, squash: 0.55, kind: 'lamp', glow: 0.26 });
  }

  private buildNpc(n: NpcDef): void {
    const look = lookForNpc(n.id, n.appearance, n.hat);
    const sheet = this.sheets.acquire(look);
    const f = feet(n.x, n.y);
    const spr = this.reg(this.add.sprite(f.wx, Math.round(f.wy), sheet, 0)).setOrigin(0.5, 1).setDepth(standingDepth(f.wy, n.id));
    const seed = n.x * 100 + n.y;
    const facing = FACING[n.dir];
    spr.play({ key: animKey(sheet, look.idle.anim === 'phone' && facing === 'S' ? 'phone' : 'idle', facing), startFrame: Math.floor(hash01(seed) * 6) });
    spr.anims.timeScale = look.idle.speed * (0.9 + 0.2 * hash01(seed + 7));
    const s16 = this.m.sprites['fx/shadow_16'];
    const shadow = this.reg(this.add.image(f.wx, Math.round(f.wy) - 1, s16.atlas, s16.frame)).setOrigin(...originOf(s16)).setDepth(DEPTH.shadowContact);
    this.npcs.push({ npc: n, sprite: spr, shadow, sheet, lift: lookHeadLift(look) });
    this.staticHits.push({ x0: f.wx - 9, y0: f.wy - 32, x1: f.wx + 9, y1: f.wy + 2, hit: { kind: 'npc', npc: n }, depth: f.wy + 0.5 });
  }

  // ------------------------------------------------------------------ per-frame reconcile
  override update(_time: number, delta: number): void {
    if (!this.ready) return;
    const dt = Math.min(0.1, delta / 1000);
    const now = performance.now();
    const room = game.room;
    const def = game.roomDef;
    if (!room || !def) {
      this.hitBoxes = [];
      this.host.labels.update([], [], { w: this.cam.w / this.cam.dpr, h: this.cam.h / this.cam.dpr });
      return;
    }
    const key = roomKey(room);
    if (key !== this.roomId || this.roomDef !== def) {
      this.roomId = key;
      this.roomDef = def;
      this.buildRoom(def);
    }
    if (this.gridFurniture !== game.furniture || !this.grid) {
      this.grid = buildGrid(def, game.furniture);
      this.gridFurniture = game.furniture;
    }
    this.applyZoom();
    const dyn: HitBox[] = [];
    this.syncFurniture(dyn);
    this.syncAvatars(def, now, dyn);
    this.updateCanopies(dt);
    this.updateHover(def);
    this.hitBoxes = this.staticHits.concat(dyn);
    this.updateCamera(dt, def);
    this.rig.apply(ROOM_HOUR[def.lighting], this.cameras.main.zoom, (wx, wy) => this.toDevice(wx, wy));
    this.pushLabels(def, now);
  }

  private applyZoom(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const css = cssZoomFor(window.innerWidth, window.innerHeight);
    const zoom = deviceZoomFor(css, dpr);
    this.cam.zoom = zoom;
    this.cam.dpr = this.scale.width / Math.max(1, window.innerWidth);
    this.cam.w = this.scale.width;
    this.cam.h = this.scale.height;
    this.cssScale = zoom / this.cam.dpr;
    if (this.cameras.main.zoom !== zoom) this.cameras.main.setZoom(zoom);
  }

  /** World px -> fx-camera (device) px, using the main camera as it is drawn. */
  private toDevice(wx: number, wy: number): [number, number] {
    const cam = this.cameras.main;
    const hw = cam.width / 2;
    const hh = cam.height / 2;
    return [(wx - cam.scrollX - hw) * cam.zoom + hw, (wy - cam.scrollY - hh) * cam.zoom + hh];
  }

  private updateCamera(dt: number, def: RoomDef): void {
    const self = game.self ? this.avatars.get(game.self.pub.id) : undefined;
    const focus = self ? { x: self.wx, y: self.wy - 10 } : { x: (def.cols * T) / 2, y: (def.rows * T) / 2 };
    const ins = this.host.insets();
    const k = this.cam.dpr;
    const target = cameraCenter({ w: this.cam.w, h: this.cam.h, zoom: this.cam.zoom }, this.bounds, focus, { top: ins.top * k, bottom: ins.bottom * k, left: ins.left * k, right: ins.right * k });
    if (this.snapCamera) {
      this.cam.cx = target.cx;
      this.cam.cy = target.cy;
      this.snapCamera = false;
    } else {
      // exponential follow, about 0.12 per 60 fps frame (HOWTO §5.3), frame-rate independent
      const a = 1 - Math.pow(1 - 0.12, dt * 60);
      this.cam.cx += (target.cx - this.cam.cx) * a;
      this.cam.cy += (target.cy - this.cam.cy) * a;
    }
    this.cam.cx = snapToDevice(this.cam.cx, this.cam.zoom);
    this.cam.cy = snapToDevice(this.cam.cy, this.cam.zoom);
    this.cameras.main.centerOn(this.cam.cx, this.cam.cy);
  }

  // ---- avatars
  private syncAvatars(def: RoomDef, now: number, dyn: HitBox[]): void {
    const items = new Map(game.avatars);
    syncViews(this.avatars, items, {
      create: (_id, a) => this.createAvatar(a),
      update: (v, a) => this.updateAvatar(v, a, def, now, dyn),
      destroy: (v) => this.destroyAvatar(v),
    });
  }

  private createAvatar(a: ClientAvatar): AvatarView {
    const look = lookForAppearance(a.pub.appearance, { hat: a.pub.hat });
    const sheet = this.sheets.acquire(look);
    const sprite = this.rig.world(this.add.sprite(0, 0, sheet, 0)).setOrigin(0.5, 1);
    const s16 = this.m.sprites['fx/shadow_16'];
    const shadow = this.rig.world(this.add.image(0, 0, s16.atlas, s16.frame)).setOrigin(...originOf(s16)).setDepth(DEPTH.shadowContact);
    return { sprite, shadow, sheet, appearance: a.pub.appearance, hat: a.pub.hat, look, parrot: null, anim: '', facing: 'S', wx: 0, wy: 0, lastX: Number.NaN, lastY: 0, sitting: false, moving: false };
  }

  private destroyAvatar(v: AvatarView): void {
    v.parrot?.destroy();
    v.sprite.destroy();
    v.shadow.destroy();
    this.sheets.release(v.sheet);
  }

  private updateAvatar(v: AvatarView, a: ClientAvatar, def: RoomDef, now: number, dyn: HitBox[]): void {
    // appearance or hat changed (wardrobe, avatarUpdated): swap the sheet
    if (a.pub.appearance !== v.appearance || a.pub.hat !== v.hat) {
      v.appearance = a.pub.appearance;
      v.hat = a.pub.hat;
      v.look = lookForAppearance(a.pub.appearance, { hat: a.pub.hat });
      const sheetKey = this.sheets.acquire(v.look);
      this.sheets.release(v.sheet);
      if (sheetKey !== v.sheet) {
        v.sheet = sheetKey;
        v.anim = '';
      }
    }

    const pos = positionAlong(a.from, a.path, now - a.start, a.pub.dir);
    const sitting = !pos.moving && (a.pub.sitting || a.sitOnArrive);
    let facing: Facing = v.facing;
    if (sitting) {
      const seat: Dir | undefined = this.grid?.seats.get(tileKey(pos.tile.x, pos.tile.y));
      facing = FACING[seat ?? pos.dir];
    } else if (pos.moving) {
      // top-down: face the way we are actually moving (diagonals pick the dominant axis); the wire Dir is the fallback (D5)
      const dx = pos.x - v.lastX;
      const dy = pos.y - v.lastY;
      if (Number.isFinite(dx) && Math.hypot(dx, dy) > 0.002) facing = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'E' : 'W') : dy > 0 ? 'S' : 'N';
      else if (!Number.isFinite(dx)) facing = FACING[pos.dir];
    } else if (!a.path.length) facing = FACING[a.pub.dir];
    v.lastX = pos.x;
    v.lastY = pos.y;
    v.facing = facing;
    v.sitting = sitting;
    v.moving = pos.moving;

    const f = feet(pos.x, pos.y);
    // emotes play the sheet's real frames (oi, dancar, rir, valeu, desculpa); the 2 px bounce is only the fallback for a sheet without them
    let bounce = 0;
    let emote: string | null = null;
    if (a.emote && !pos.moving && !sitting) {
      const t = now / 1000 - a.emote.t0;
      const dur = emoteDuration(this.m.sheet, a.emote.kind) / 1000;
      if (dur > 0) {
        if (t >= 0 && t < dur) emote = `${a.emote.kind}@${a.emote.t0}`;
      } else if (t >= 0 && t < 1.3) bounce = Math.round(Math.abs(Math.sin(t * 9)) * 2);
    }
    const wx = Math.round(f.wx);
    const wy = Math.round(f.wy);
    v.wx = wx;
    v.wy = wy;
    v.sprite.setPosition(wx, wy - bounce);
    v.shadow.setPosition(wx, wy - 1);
    // sitters draw just above what they sit on (the bench's bottom edge is the tile's bottom edge)
    const depth = sitting ? (pos.tile.y + 1) * T + 0.5 : standingDepth(f.wy, a.pub.id);
    v.sprite.setDepth(depth);

    const idleAnim = v.look.idle.anim === 'phone' && facing === 'S' ? 'phone' : 'idle';
    const animName = sitting ? `sit:${facing}` : pos.moving ? `walk:${facing}` : emote ? `emote:${emote}` : `${idleAnim}:${facing}`;
    const want = `${v.sheet}|${animName}`;
    if (want !== v.anim) {
      v.anim = want;
      if (sitting) {
        v.sprite.anims.stop();
        v.sprite.setTexture(v.sheet, sitFrame(this.m.sheet, facing));
      } else if (emote) {
        v.sprite.setTexture(v.sheet, 0);
        v.sprite.play({ key: animKey(v.sheet, emote.split('@')[0], 'S'), startFrame: 0 });
        v.sprite.anims.timeScale = 1;
      } else {
        v.sprite.setTexture(v.sheet, 0);
        const walking = pos.moving;
        v.sprite.play({ key: animKey(v.sheet, walking ? 'walk' : idleAnim, facing), startFrame: walking ? 0 : Math.floor(a.seed) % 6 });
        // a crowd never breathes in sync: pace depends on the pose and a small per-avatar jitter
        v.sprite.anims.timeScale = walking ? 1 : v.look.idle.speed * (0.9 + 0.2 * hash01(a.seed * 977 + 3));
      }
    }
    this.updateParrot(v, a, facing, wx, wy, depth, now);
    const h = sitting ? 24 : 32;
    dyn.push({ x0: wx - 9, y0: wy - h, x1: wx + 9, y1: wy + 2, hit: { kind: 'avatar', id: a.pub.id }, depth: wy + 0.6 });
    void def;
  }

  /** The companion parrot (profile.parrotEquipped -> PublicAvatar.parrot): the poleiro parrot hovering at the avatar's shoulder. */
  private updateParrot(v: AvatarView, a: ClientAvatar, facing: Facing, wx: number, wy: number, depth: number, now: number): void {
    const d = this.m.sprites['chars/parrot'];
    if (!a.pub.parrot || !d) {
      if (v.parrot) {
        v.parrot.destroy();
        v.parrot = null;
      }
      return;
    }
    if (!v.parrot) {
      v.parrot = this.rig.world(this.add.sprite(0, 0, d.atlas, d.frame)).setOrigin(...originOf(d));
      v.parrot.play({ key: ensureAnim(this, 'chars/parrot', d), startFrame: Math.floor(hash01(a.seed) * 4) });
    }
    // it hovers beside the head on the far shoulder: behind the body when walking away, mirrored so it always looks toward its owner
    const side = facing === 'W' ? 1 : -1;
    const bob = Math.round(Math.sin(now / 420 + a.seed) * 1.5);
    v.parrot.setPosition(wx + side * 9, wy - 12 + bob);
    v.parrot.setFlipX(side === 1);
    v.parrot.setDepth(facing === 'N' ? depth - 0.05 : depth + 0.05);
  }

  // ---- placed furniture (placeholders until Phase 4)
  private syncFurniture(dyn: HitBox[]): void {
    const items = new Map<string, PlacedFurniture>(game.furniture.map((f) => [f.uid, f]));
    syncViews(this.furniture, items, {
      create: (_uid, f) => {
        const def = furnitureById(f.itemId);
        const r: Rect = { x0: f.x * T + 1, y0: f.y * T + 1, x1: (f.x + 1) * T - 1, y1: (f.y + 1) * T - 1 };
        const rug = def?.kind === 'tapete';
        this.noteMissing(`furniture/${f.itemId}`);
        const rect = this.reg(this.add.rectangle((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, r.x1 - r.x0, r.y1 - r.y0, 0xff00ff, 0.35)).setStrokeStyle(1, 0xff00ff, 1).setDepth(rug ? DEPTH.groundDecal + 20 : standingDepth((f.y + 1) * T, f.uid));
        return { rect, itemId: f.itemId, x: f.x, y: f.y };
      },
      update: (v, f) => {
        if (v.x !== f.x || v.y !== f.y) {
          v.x = f.x;
          v.y = f.y;
          v.rect.setPosition(f.x * T + T / 2, f.y * T + T / 2);
          if (furnitureById(f.itemId)?.kind !== 'tapete') v.rect.setDepth(standingDepth((f.y + 1) * T, f.uid));
        }
        const sel = game.selectedFurniture === f.uid;
        v.rect.setStrokeStyle(sel ? 2 : 1, sel ? 0xf2c230 : 0xff00ff, 1);
        const def = furnitureById(f.itemId);
        const seat = !!def?.seat && !game.editMode;
        const hit: Hit = seat ? { kind: 'seat', tile: { x: f.x, y: f.y } } : { kind: 'furniture', f };
        dyn.push({ x0: f.x * T - 2, y0: f.y * T - 8, x1: (f.x + 1) * T + 2, y1: (f.y + 1) * T, hit, depth: (f.y + 1) * T });
      },
      destroy: (v) => v.rect.destroy(),
    });
  }

  private updateHover(def: RoomDef): void {
    const t = game.hoverTile;
    const show = !!t && !game.modalOpen && t.x >= 0 && t.y >= 0 && t.x < def.cols && t.y < def.rows;
    this.hoverRect.setVisible(show);
    if (!show || !t) return;
    const ok = game.placing ? canPlaceFurniture(def, game.furniture, t.x, t.y) : !!this.grid && !this.grid.blocked.has(tileKey(t.x, t.y));
    this.hoverRect.setPosition(t.x * T, t.y * T).setFillStyle(ok ? 0xffffff : 0xe5572f, 0.25).setStrokeStyle(1, ok ? 0xffffff : 0xe5572f, 0.8);
  }

  /** Overhead layers fade to 0.45 alpha while the local avatar's feet are inside (HOWTO §5.4). */
  private updateCanopies(dt: number): void {
    const self = game.self ? this.avatars.get(game.self.pub.id) : undefined;
    for (const c of this.canopies) {
      const inside = !!self && self.wx >= c.r.x0 && self.wx <= c.r.x1 && self.wy >= c.r.y0 && self.wy <= c.r.y1;
      const target = inside ? 0.45 : 1;
      c.fade += (target - c.fade) * Math.min(1, dt / 0.15);
      c.sprite.setAlpha(c.fade);
    }
  }

  // ------------------------------------------------------------------ DOM labels
  private pushLabels(def: RoomDef, now: number): void {
    const k = this.cam;
    const at = (wx: number, wy: number) => worldToCanvas(k, wx, wy);
    const stacks: StackItem[] = [];
    const selfId = game.room?.selfId;
    for (const n of this.npcs) {
      const p = at((n.npc.x + 0.5) * T, (n.npc.y + 1) * T - 3 - HEAD_LIFT - n.lift);
      const b = game.npcBubbles.get(n.npc.id);
      const age = b ? now - b.at : Infinity;
      stacks.push({
        key: `npc:${n.npc.id}`,
        x: p.px,
        y: p.py,
        plate: { text: `${n.npc.name} · ${n.npc.role.pt}`, kind: 'npc' },
        bubbles: b && age < 7000 ? [{ text: b.text, gloss: b.gloss, alpha: bubbleAlpha(age) }] : [],
      });
    }
    for (const [id, v] of this.avatars) {
      const a = game.avatars.get(id);
      if (!a) continue;
      const p = at(v.wx, v.wy - (v.sitting ? HEAD_LIFT_SIT : HEAD_LIFT) - lookHeadLift(v.look));
      const bubbles = isCpuId(id)
        ? [] // Live Ops lock: CPUs never show chat bubbles
        : a.bubbles
            .filter((b) => now - b.at < 7000)
            .slice(-2)
            .map((b) => ({ text: b.text, gloss: b.gloss, alpha: bubbleAlpha(now - b.at) }));
      stacks.push({ key: `av:${id}`, x: p.px, y: p.py, plate: { text: a.pub.name, kind: id === selfId ? 'me' : 'player' }, bubbles });
    }
    const guides: GuideItem[] = this.host.guides().map((g, i) => {
      const w = tileToWorld(g.x, g.y);
      const lift = Math.min(48, Math.max(12, g.lift * 0.3));
      const p = at(w.wx, w.wy - lift);
      return { key: `g${i}`, x: p.px, y: p.py, label: g.label };
    });
    const view = { w: k.w / k.dpr, h: k.h / k.dpr };
    this.host.labels.update(stacks, guides, view);
    if (this.host.debugArt) {
      this.host.labels.updateArtKeys(
        this.placeholders.map((ph, i) => {
          const p = at(ph.rect.x0, ph.rect.y0);
          return { key: `${ph.key}@${i}`, x: p.px, y: p.py };
        }),
      );
    }
    void def;
  }

  // ------------------------------------------------------------------ queries used by PixelView
  hitAt(wx: number, wy: number): Hit | null {
    return pickHit(this.hitBoxes, wx, wy, { selfId: game.room?.selfId, isCpu: isCpuId, editMode: game.editMode, placing: !!game.placing });
  }

  currentRoom(): RoomDef | null {
    return game.roomDef;
  }

  info() {
    return { zoom: this.cam.zoom, cssScale: this.cssScale, cx: this.cam.cx, cy: this.cam.cy, room: this.roomId, avatars: this.avatars.size, sheets: this.sheets.size, artMissing: this.artMissing };
  }
}

/** Same fade as the iso renderer: quick in, slow out over the last 700 ms of 7 s. */
function bubbleAlpha(age: number): number {
  return Math.max(0, Math.min(1, age / 120) * Math.min(1, (7000 - age) / 700));
}
