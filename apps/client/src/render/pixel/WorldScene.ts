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
import { buildGrid, feiraOpen, canPlaceFurniture, furnitureById, hotspotBox, hotspotsInRoom, isCpuId, key as tileKey, positionAlong, propTiles, type Dir, npcDefById, type PlacedFurniture, type PropDef, type RoomDef, type RoomGrid, type WallDecor } from '@tudobem/shared';
import { game, type ClientAvatar } from '../../state';
import type { Guide, Hit } from '../view';
import type { Manifest } from './manifest';
import { FACING, facingAlongPath, type Facing } from './facing';
import { addSheetTexture, animKey, animNames, emoteDuration, sitFrame } from './charsheet';
import { CharSheets } from './charCache';
import type { CharAssets } from './charAssets';
import { composeLook } from './composeLook';
import { lookForAppearance, lookForNpc, lookHeadLift, type Look } from './looks';
import { LightingRig, type Light } from './lightingRig';
import { computeLook, isOutdoor, lightDelay, windowPanes, type SceneLook } from './dayNight';
import { WeatherBlend, groundWetTint, type FxLevel } from './weatherLook';
import { WeatherFx } from './weatherFx';
import { ShadowLayer, type ShadowHandle } from './shadowLayer';
import { AoLayer } from './aoLayer';
import { v5on } from './v5flags';
import { WaterFx } from './water';
import { presetFor } from './lightPresets';
import { aoForOverhead, aoForSprite } from './ao';
import { AmbientLife, ambientHandlesProp } from './ambient';
import { ZoneFeed } from '../../audio/zonesFeed';
import { FrameProbe, LowFxGovernor, reducedMotion } from './perf';
import { clock } from '../../gameClock';
import { buildTerrainLayers } from './terrainLayers';
import { LabelLayer, type GuideItem, type StackItem } from './labels';
import { OUTDOOR_NORTH, T, cssZoomFor, feet, roomFraming, snapToDevice, tileToWorld, worldToCanvas, type CamState, type Insets, type Rect } from './coords';
import { pickHit, type HitBox } from './hit';
import { dialogueFraming, easeOut, stepBlend } from './dialogueCam';
import { BoutStage } from './boutStage';
import { boutFeed } from './boutFeed';
import { roomKey, syncViews } from './reconcile';
import { DEPTH, PROP_LIGHT, fencePieces, footprintRect, inflate, propAnchor, propDepth, furnitureArtKey, propArtKey, propPlaceholderKey, propSlices, propSize, spriteRect, standingDepth, unionRect } from './props';
import { sceneryFor } from './scenery';
import {
  FLOOR_PLACEHOLDER,
  FLOOR_SUBSTITUTE,
  NORTH_BAND_TILES,
  WEST_STRIP_TILES,
  ROOM_HOUR,
  WALL_STYLE,
  allNorthDecor,
  decorArt,
  northWallKey,
  westWallKey,
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
  windowPatches,
  westDoorRect,
  westStripRect,
} from './roomLayout';
import { ensureAnim, originOf } from './spriteUtil';
import { GHOST_ALPHA, ghostFor, type GhostSpec } from './decorate';
import { modalId } from '../../ui/modal';

export interface SceneHost {
  labels: LabelLayer;
  guides: () => Guide[];
  /** HUD space to keep clear, CSS px */
  insets: () => Insets;
  lowfx: boolean;
  debugArt: boolean;
  /** `?shot=map`: zoom out to fit the whole outdoor map (screenshots) */
  shot?: string | null;
}

interface AvatarView {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  sheet: string;
  appearance: unknown;
  hat: string | null;
  belt?: string;
  look: Look;
  parrot: Phaser.GameObjects.Sprite | null;
  /** the pop-up icon over the head while an emote plays (fx/emote_<kind>), and the emote it shows */
  icon: Phaser.GameObjects.Sprite | null;
  iconKey: string;
  anim: string;
  facing: Facing;
  /** world px of the feet */
  wx: number;
  wy: number;
  /** The wire Dir last seen: tells a real turn from the wire Dir of a walk the sprite already faced. */
  dirSeen: Dir | undefined;
  sitting: boolean;
  moving: boolean;
}

/** Nanda's hat stall: it shows as closed (dimmed, with a sign) while she is not standing at it. */
interface StallView {
  main: Phaser.GameObjects.Sprite | null;
  canopy: Phaser.GameObjects.Sprite | null;
  wx: number;
  wy: number;
  closed: boolean;
}

interface FurnitureView {
  /** the sprite (art) or the magenta placeholder box (art missing) */
  obj: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle;
  /** contact shadow under a sprite */
  shadow: Phaser.GameObjects.Image | null;
  /** selection outline (edit mode) */
  sel: Phaser.GameObjects.Graphics;
  /** what the outline was last drawn for (rebuilt when the piece moves, turns or is selected) */
  selSig: string;
  itemId: string;
  rot: 0 | 1;
  x: number;
  y: number;
}

interface Canopy {
  sprite: Phaser.GameObjects.Sprite;
  r: Rect;
  fade: number;
  /** a vendor's stall (feira, hat stall): the tarp also fades while you stand in front of it or talk to the vendor behind it */
  stall?: boolean;
}

/** Art px from the feet to the top of the visible head (the 16x32 frame has empty rows above it); nameplates stand just above. */
/** Art px an NPC behind a counter is drawn above its tile so the head and shoulders clear the counter top. */
const COUNTER_LIFT = 11;
const HEAD_LIFT = 23;
const HEAD_LIFT_SIT = 16;
/** seconds the emote pop-up icon stays over the head */
const EMOTE_ICON_S = 1.1;

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
  /** V5: directional cast shadows (outdoor rooms; interiors keep their baked ones) */
  private shadows!: ShadowLayer;
  private ao!: AoLayer;
  private water!: WaterFx;
  /** terrain layers with their floor char, tinted darker as the ground gets wet */
  private groundLayers: { ch: string; layer: Phaser.Tilemaps.TilemapLayer }[] = [];
  private wetApplied = -1;
  private roomOutdoor = false;
  private lastShadow: ShadowHandle | null = null;
  // Phase 6a: live clock, weather, performance fallback
  private weatherFx!: WeatherFx;
  private ambient!: AmbientLife;
  private readonly zoneFeed = new ZoneFeed();
  private readonly blend = new WeatherBlend();
  private blendReady = false;
  private outdoor = false;
  private look: SceneLook | null = null;
  private playerLight: Light | null = null;
  private readonly probe = new FrameProbe();
  private gov!: LowFxGovernor;
  private readonly fxLevel: FxLevel = { lowfx: false, reduced: false };
  private vignette: Phaser.FX.Vignette | null = null;
  private lastUpdateAt = 0;
  private reducedCheckAt = 0;
  private sheets!: CharSheets;
  /** the Treino no tatame bout on the academia mat (pair sprite, referee, crowd, fx) */
  private stage!: BoutStage;
  private boutBlend = 0;
  private roomId = '';
  private roomDef: RoomDef | null = null;
  private roomObjs: Phaser.GameObjects.GameObject[] = [];
  private roomMap: Phaser.Tilemaps.Tilemap | null = null;
  private staticHits: HitBox[] = [];
  private placeholders: { key: string; rect: Rect }[] = [];
  private stall: StallView | null = null;
  private canopies: Canopy[] = [];
  /** Feira stalls (Phase 9): the open sprites and tarp, and the folded ones, shown by the game clock (06:00-13:00). */
  private feiraStalls: { open: Phaser.GameObjects.GameObject[]; closed: Phaser.GameObjects.GameObject[]; isOpen: boolean | null }[] = [];
  private avatars = new Map<string, AvatarView>();
  private furniture = new Map<string, FurnitureView>();
  private grid: RoomGrid | null = null;
  private gridFurniture: PlacedFurniture[] | null = null;
  private bounds: Rect = { x0: 0, y0: 0, x1: 1, y1: 1 };
  private snapCamera = true;
  private hoverRect!: Phaser.GameObjects.Rectangle;
  private lastT = 0;
  /** decorate-mode ghost of the piece being placed or moved (scene-level: it outlives room rebuilds) */
  private ghost: Phaser.GameObjects.Sprite | null = null;
  private ghostKey = '';
  /** the padaria order rail: still until Me vê um is open */
  private trilho: Phaser.GameObjects.Sprite | null = null;
  private trilhoLive = false;

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
    this.shadows = new ShadowLayer(this, this.rig);
    this.rig.shadows = this.shadows;
    this.ao = new AoLayer(this, this.rig);
    this.water = new WaterFx(this, this.rig);
    this.sheets = new CharSheets({
      add: (key, look) => addSheetTexture(this, key, composeLook(this.assets, look), this.m.sheet),
      remove: (key) => {
        for (const name of animNames(this.m.sheet)) for (const f of ['S', 'W', 'E', 'N'] as Facing[]) this.anims.remove(animKey(key, name, f));
        if (this.textures.exists(key)) this.textures.remove(key);
      },
    });
    // the hover marker belongs to the scene, not to a room layer
    this.hoverRect = this.rig.world(this.add.rectangle(0, 0, T, T, 0xffffff, 0.22)).setOrigin(0, 0).setStrokeStyle(1, 0xffffff, 0.8).setDepth(49000).setVisible(false);
    this.fxLevel.lowfx = this.host.lowfx;
    this.fxLevel.reduced = reducedMotion();
    this.gov = new LowFxGovernor(this.probe, this.host.lowfx);
    this.weatherFx = new WeatherFx(this, this.rig, () => this.fxLevel);
    this.ambient = new AmbientLife(this, this.rig, this.m, () => this.fxLevel);
    this.stage = new BoutStage({
      scene: this,
      world: (o) => this.rig.world(o),
      manifest: this.m,
      noteMissing: (k) => this.noteMissing(k),
      acquireSheet: (look) => this.sheets.acquire(look),
      releaseSheet: (k) => this.sheets.release(k),
      playerAppearance: () => game.self?.pub.appearance ?? null,
      bia: () => this.biaView(),
      crowd: () => this.crowdSpots(),
      mat: () => this.matCenter(),
      placar: () => this.placarAnchor(),
      toCanvas: (wx, wy) => worldToCanvas(this.cam, wx, wy),
      cssScale: () => this.cssScale,
      reduced: () => this.fxLevel.reduced,
      instant: () => !!this.host.shot,
    });
    if (!this.host.lowfx) this.vignette = cam.postFX.addVignette(0.5, 0.5, 0.88, 0.22);
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
    if (key.startsWith('vehicles/')) this.reg(this.rig.liftBody(spr)); // a parked car keeps its shape at night
    this.lastShadow = shadow && this.roomOutdoor ? this.shadows.addStatic(key, d, x, y, depth) : null;
    if (shadow && this.roomOutdoor) this.ao.add(aoForSprite(key, d, x, y));
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
    this.stall = null;
    this.feiraStalls = [];
    for (const o of this.roomObjs) o.destroy();
    this.roomObjs = [];
    this.roomMap?.destroy();
    this.roomMap = null;
    this.staticHits = [];
    this.placeholders = [];
    this.canopies = [];
    this.trilho = null;
    this.trilhoLive = false;
    // furniture rectangles were registered with the room objects
    this.furniture.clear();
    this.rig.clearRoom();
    this.shadows?.clearRoom();
    this.ao?.clearRoom();
    this.water?.clearRoom();
    this.weatherFx?.clearRoom();
  }

  private buildRoom(def: RoomDef): void {
    this.destroyRoom();
    this.roomOutdoor = isOutdoor(def);
    const m = this.m;
    const has = (k: string) => !!m.sprites[k];
    const missingBefore = this.artMissing.length;

    // ---- terrain: dual-grid layers for the floor chars that have art; substitutes and flat placeholders for the rest
    const res = buildTerrainLayers(this, def.floor, m.terrain, 'terrainTs', { outside: def.outdoor ? undefined : 'x', wrap: (o) => this.rig.world(o), substitute: FLOOR_SUBSTITUTE });
    this.roomMap = res.map;
    this.groundLayers = res.layers.map((layer, i) => ({ ch: res.drawn[i], layer }));
    this.wetApplied = -1;
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

    // ---- walls: north band and west strip from 16 px wall tiles per room style (flat placeholders in the room's colors when the art is missing)
    if (!def.outdoor) this.buildWalls(def);

    // ---- facades on north doors (an open-air map has its building fronts as props)
    const facades = def.outdoor ? [] : northFacades(def, has);
    let tallest = 0;
    for (const f of facades) {
      const d = m.sprites[f.key];
      const spr = this.sprite(f.key, f.wx, f.wy, standingDepth(f.wy, f.key));
      if (!spr) continue;
      tallest = Math.max(tallest, d.ay);
      // each window is its own light: the lit overlay is cropped per window and every window has its own 0..40 game-minute switch-on delay
      const fx0 = Math.round(f.wx) - d.ax;
      const fy0 = Math.round(f.wy) - d.ay;
      const ld = d.lit ? m.sprites[d.lit] : undefined;
      const wins = d.windows ?? [];
      if (ld && !wins.length) {
        this.rig.litOverlays.push(this.reg(this.add.image(Math.round(f.wx), Math.round(f.wy), ld.atlas, ld.frame)).setOrigin(...originOf(ld)).setDepth(f.wy + 0.5).setAlpha(0).setData('delay', lightDelay(f.wx, f.wy)));
      }
      for (const [wx, wy, ww, wh] of wins) {
        const delay = lightDelay(fx0 + wx, fy0 + wy);
        if (ld) {
          const o = this.reg(this.add.image(Math.round(f.wx), Math.round(f.wy), ld.atlas, ld.frame)).setOrigin(...originOf(ld)).setDepth(f.wy + 0.5).setAlpha(0).setData('delay', delay);
          o.setCrop(Math.max(0, wx - 1), Math.max(0, wy - 1), ww + 2, wh + 2);
          this.rig.litOverlays.push(o);
        }
        this.rig.lights.push({ x: fx0 + wx + ww / 2, y: fy0 + wy + wh + 5, r: 22 + ww * 0.5, color: 0xffc060, squash: 0.6, kind: 'window', delay });
      }
    }

    // ---- north wall decor (its own plus the west-wall decor moved to a free stretch, roomLayout.relocatedWestDecor)
    for (const d of allNorthDecor(def)) {
      if (decorCoveredByFacade(d, facades)) continue;
      this.buildDecor(d);
    }

    // ---- window light on the floor under every north-wall window (interiors): a warm slanted patch, ADD blended, in the lighting rig
    for (const w of windowPatches(def)) {
      const pd = m.sprites[w.key];
      if (pd) this.rig.patches.push(this.reg(this.add.image(w.x, w.y, pd.atlas, pd.frame)).setOrigin(0, 0).setDepth(DEPTH.groundDecal + 60).setBlendMode(Phaser.BlendModes.ADD));
    }

    // ---- the night sky in the window glass (alpha follows the live clock in the rig), with a few stars
    const wp = windowPanes(def);
    for (const r of wp.panes) this.rig.panes.push(this.reg(this.add.rectangle(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0, 0x15264f, 1)).setOrigin(0, 0).setDepth(DEPTH.wallDecor + 1).setAlpha(0));
    for (const s of wp.stars) this.rig.panes.push(this.reg(this.add.rectangle(s.x, s.y, 1, 1, 0xf4f0d0, 1)).setOrigin(0, 0).setDepth(DEPTH.wallDecor + 2).setAlpha(0));

    // ---- doors
    for (const p of def.portals) {
      if (!p.wall) {
        // an outdoor door is part of its facade sprite: only the click box is needed
        const r = portalHitRect(p);
        this.staticHits.push({ ...r, hit: { kind: 'portal', portal: p }, depth: r.y1 });
        continue;
      }
      if (isNorthPortal(p)) {
        if (!facades.some((f) => f.portal.id === p.id) && !this.sprite('doors/north', (p.x + 0.5) * T, 0, DEPTH.wallDecor, false)) this.placeholder('doors/north', northDoorRect(p), DEPTH.wallDecor);
      } else {
        if (!this.sprite('doors/west', 0, (p.y + 1) * T, DEPTH.wallDecor, false)) this.placeholder('doors/west', westDoorRect(p), DEPTH.wallDecor);
        if (!this.sprite('props/doormat', (p.x + 0.5) * T, (p.y + 1) * T, DEPTH.groundDecal, false)) this.placeholder('props/doormat', inflate(doormatRect(p), -2), DEPTH.groundDecal);
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

    // ---- sky and far skyline in the top margin of an open-air map
    if (def.outdoor) this.buildBackdrop(def);

    // ---- ground dressing and wires of an open-air map
    this.buildScenery(def);

    // ---- props
    for (const p of def.props) this.buildProp(p);

    // ---- readable world (Phase 7): a click box per hotspot (the footprint, plus the wall rows above it for a sign painted on a north wall)
    for (const hs of hotspotsInRoom(def.id)) {
      const b = hotspotBox(hs);
      this.staticHits.push({ x0: b.x0 * T, y0: b.y0 * T, x1: b.x1 * T, y1: b.y1 * T, hit: { kind: 'hotspot', hotspot: hs }, depth: b.y1 * T - 0.25 });
    }

    // (the neighbours are not part of the room: the server walks them along their schedules and sends them as avatars)

    // a small warm glow around the local player at night (HOWTO §5.8); follows the avatar in applyLook
    this.playerLight = { x: 0, y: 0, r: 0, color: 0xffd9a8, squash: 0.85, kind: 'player', glow: 0.22 };
    this.rig.lights.push(this.playerLight);
    this.rig.syncLights();
    // outdoor rooms follow the live clock and weather; puddles go on the free calçada / asfalto tiles
    this.outdoor = isOutdoor(def);
    const blocked = buildGrid(def, []).blocked;
    this.weatherFx.buildRoom(def, (x, y) => blocked.has(tileKey(x, y)));
    this.ambient.buildRoom(def, (x, y) => x >= 0 && y >= 0 && x < def.cols && y < def.rows && !blocked.has(tileKey(x, y)));
    this.ao.build(def.floor, def.outdoor === true);
    this.bounds = roomBounds(def, tallest);
    this.snapCamera = true;
    this.hoverRect.setVisible(false);
    const skipped = describeSkipped({ [def.id]: def });
    if (skipped.length) console.info('[pixel] west-wall decor skipped in Phase 2:', skipped.join('; '));
    if (this.artMissing.length !== missingBefore) console.info('[pixel] missing art (placeholders):', this.artMissing.join(', '));
  }

  /** North band (3 tiles) and west strip from wall tiles; a missing tile key falls back to a flat fill in the room's wall color. */
  private buildWalls(def: RoomDef): void {
    const style = WALL_STYLE[def.id] ?? 'padaria';
    const band = northBandRect(def);
    const strip = westStripRect(def);
    const has = (k: string) => !!this.m.sprites[k];
    for (let i = -1; i < def.cols; i++) {
      const key = northWallKey(style, i < 0 ? 'l' : i === def.cols - 1 ? 'r' : 'm');
      if (!has(key)) {
        this.noteMissing(key);
        this.flat({ x0: i * T, y0: band.y0, x1: (i + 1) * T, y1: 0 }, hex(def.wallColor), DEPTH.wall);
        continue;
      }
      this.sprite(key, i * T, 0, DEPTH.wall, false);
    }
    for (let j = 0; j < def.rows; j++) {
      const key = westWallKey(style, j === def.rows - 1);
      if (!has(key)) {
        this.noteMissing(westWallKey(style, false));
        this.flat({ x0: strip.x0, y0: j * T, x1: 0, y1: (j + 1) * T }, hex(def.wallColor), DEPTH.wall);
        continue;
      }
      this.sprite(key, 0, (j + 1) * T, DEPTH.wall, false);
    }
    this.buildShell(def, style);
  }

  /**
   * The outer shell of an interior (visual pass V3): the east wall and the south wall close the room (thick caps, the exterior face of the
   * south wall with its plinth), and a quiet night sidewalk fills everything around so the room reads as a building on a street, not as a
   * diorama in a void. Art keys `walls/east_<style>[_b]`, `walls/south_<style>_w|_m|_e`, `walls/exterior`; each is optional.
   */
  private buildShell(def: RoomDef, style: string): void {
    const has = (k: string) => !!this.m.sprites[k];
    const ext = this.m.sprites['walls/exterior'];
    if (ext) {
      const M = 22; // tiles of street around the walls (a phone at zoom 2 and a desktop at zoom 3 never see past it)
      const x0 = Math.floor((-M * T) / ext.w) * ext.w;
      const x1 = (def.cols + M) * T;
      const y0 = Math.floor((-(NORTH_BAND_TILES + M) * T) / ext.h) * ext.h;
      const y1 = (def.rows + M) * T;
      for (let y = y0; y < y1; y += ext.h) for (let x = x0; x < x1; x += ext.w) this.sprite('walls/exterior', x + ext.ax, y + ext.ay, DEPTH.terrain - 10, false);
    }
    for (let j = -NORTH_BAND_TILES; j < def.rows; j++) {
      const key = `walls/east_${style}${j === def.rows - 1 ? '_b' : ''}`;
      if (has(key)) this.sprite(key, def.cols * T, (j + 1) * T, DEPTH.wall, false);
    }
    for (let i = -WEST_STRIP_TILES; i <= def.cols; i++) {
      const key = `walls/south_${style}_${i < 0 ? 'w' : i === def.cols ? 'e' : 'm'}`;
      if (has(key)) this.sprite(key, i * T, def.rows * T, DEPTH.wall, false);
    }
  }

  /** One wall decor item: tiled along its span or centred on it, at the height its art table gives; a placeholder box when the art is missing. */
  private buildDecor(d: WallDecor): void {
    const art = decorArt(d);
    const spr = art ? this.m.sprites[art.key] : undefined;
    if (!art || !spr) {
      this.placeholder(`walls/${d.kind}`, northDecorRect(d), DEPTH.wallDecor);
      return;
    }
    if (art.mode === 'tile') {
      for (let x = d.from * T; x < d.to * T; x += spr.w) this.sprite(art.key, x + spr.ax, art.bottom, DEPTH.wallDecor, false);
      return;
    }
    const left = Math.round(((d.from + d.to) * T - spr.w) / 2);
    this.sprite(art.key, left + spr.ax, art.bottom, DEPTH.wallDecor, false);
  }

  private buildProp(p: PropDef): void {
    const m = this.m;
    if (p.kind === 'cerca') {
      this.buildFence(p);
      return;
    }
    const a = propAnchor(p);
    const flat = p.kind === 'tatame';
    const depth = flat ? DEPTH.groundDecal + 10 : propDepth(p, a.wy);
    const foot = footprintRect(p);
    let visual: Rect = foot;
    const artKey = propArtKey(p);
    const d = artKey ? m.sprites[artKey] : undefined;
    const slices = propSlices(p);
    if (slices) {
      // long props (counter, bleachers): one sprite per footprint tile
      for (const s of slices) {
        const sd = m.sprites[s.key];
        const wx = (s.x + 0.5) * T;
        const wy = (s.y + 1) * T;
        if (sd) {
          this.sprite(s.key, wx, wy, depth);
          visual = unionRect(visual, spriteRect(Math.round(wx), Math.round(wy), sd));
        } else this.placeholder(`${s.key}#${p.id}`, { x0: s.x * T, y0: s.y * T, x1: (s.x + 1) * T, y1: (s.y + 1) * T }, depth);
      }
    } else if (artKey && d) {
      const main = this.sprite(artKey, a.wx, a.wy, depth);
      const mainShadow = this.lastShadow;
      const feiraEntry = p.kind === 'feira' ? { open: (main ? [main] : []) as Phaser.GameObjects.GameObject[], closed: [] as Phaser.GameObjects.GameObject[], isOpen: null as boolean | null } : null;
      if (feiraEntry && mainShadow) feiraEntry.open.push(mainShadow as unknown as Phaser.GameObjects.GameObject);
      if (p.kind === 'barraca_chapeus') this.stall = { main, canopy: null, wx: a.wx, wy: a.wy, closed: false };
      if (p.kind === 'trilho_pedidos' && main && d.anim) {
        // the ticket rail is still until Me vê um opens (updateTrilho)
        main.anims.stop();
        main.setFrame(d.anim.frames[0]);
        this.trilho = main;
        this.trilhoLive = false;
      }
      if (d.lit && m.sprites[d.lit]) {
        const ld = m.sprites[d.lit];
        this.rig.litOverlays.push(this.reg(this.add.image(Math.round(a.wx), Math.round(a.wy), ld.atlas, ld.frame)).setOrigin(...originOf(ld)).setDepth(depth + 0.01).setAlpha(0).setData('delay', lightDelay(a.wx, a.wy)));
      }
      visual = unionRect(foot, spriteRect(Math.round(a.wx), Math.round(a.wy), d));
      // lit windows of a building front: light pools on the sidewalk at night
      for (const [wx, wy, ww, wh] of d.windows ?? []) {
        this.rig.lights.push({ x: Math.round(a.wx) - d.ax + wx + ww / 2, y: Math.round(a.wy) - d.ay + wy + wh + 5, r: 22 + ww * 0.5, color: 0xffc060, squash: 0.6, kind: 'window' });
      }
      if (typeof d.overhead === 'string' && m.sprites[d.overhead]) {
        const od = m.sprites[d.overhead];
        const x = Math.round(a.wx);
        const y = Math.round(a.wy);
        const spr = this.reg(this.add.sprite(x, y, od.atlas, od.frame)).setOrigin(...originOf(od)).setDepth(DEPTH.overhead + y / 1000);
        if (od.anim) spr.play({ key: ensureAnim(this, d.overhead, od), startFrame: Math.floor(hash01(x * 7 + y) * 4) });
        if (p.kind === 'barraca_chapeus' && this.stall) this.stall.canopy = spr;
        feiraEntry?.open.push(spr);
        const canopyShadow = this.roomOutdoor ? this.shadows.addStatic(d.overhead, od, x, y, DEPTH.overhead + y / 1000) : null;
        if (this.roomOutdoor && p.kind !== 'feira') this.ao.add(aoForOverhead(d.overhead, od, x, y, d.footprint));
        if (feiraEntry && canopyShadow) feiraEntry.open.push(canopyShadow as unknown as Phaser.GameObjects.GameObject);
        const left = x - od.ax;
        const top = y - od.ay;
        this.canopies.push({ sprite: spr, r: { x0: left, y0: top + 8, x1: left + od.w, y1: top + od.h + 14 }, fade: 1, stall: p.kind === 'feira' || p.kind === 'barraca_chapeus' });
      }
      if (feiraEntry) this.buildFeiraClosed(artKey, a, depth, feiraEntry);
      const L = d.light ? { x: d.light.x - d.ax, y: d.light.y - d.ay, r: d.light.r, color: d.light.color } : PROP_LIGHT[p.kind];
      if (L) this.addLampLights(Math.round(a.wx), Math.round(a.wy), L);
      else {
        // V5: lights from data: the sprite key's preset, or the generic pool for a prop flagged lightAtNight
        const pr = presetFor(artKey, p.lightAtNight);
        if (pr) {
          const bx = Math.round(a.wx);
          const by = Math.round(a.wy);
          const delay = lightDelay(bx, by);
          for (const s of pr.lights) this.rig.lights.push({ x: bx + s.x, y: by + s.y, r: s.r, color: parseInt(s.color.slice(1), 16), squash: s.squash, kind: 'lamp', glow: s.glow ?? 0.4, delay });
        }
      }
      if (this.roomOutdoor && presetFor(artKey, p.lightAtNight)?.water) {
        const px = this.shadows.readFrame(d.atlas, d.frame);
        if (px) this.water.add(artKey, px.data as Uint8ClampedArray, px.w, px.h, a.wx, a.wy, d.ax, d.ay, depth);
      }
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

  /** The folded variant of a feira stall (`<key>_fechada`: goods under a sheet, tarp rolled on the bar), shown while the feira is closed. */
  private buildFeiraClosed(openKey: string, a: { wx: number; wy: number }, depth: number, entry: { open: Phaser.GameObjects.GameObject[]; closed: Phaser.GameObjects.GameObject[]; isOpen: boolean | null }): void {
    const ck = `${openKey}_fechada`;
    const cd = this.m.sprites[ck];
    if (!cd) {
      this.noteMissing(ck);
      return;
    }
    const main = this.sprite(ck, a.wx, a.wy, depth, false);
    if (main) entry.closed.push(main);
    const closedShadow = main && this.roomOutdoor ? this.shadows.addStatic(ck, cd, a.wx, a.wy, depth) : null;
    if (closedShadow) entry.closed.push(closedShadow as unknown as Phaser.GameObjects.GameObject);
    if (typeof cd.overhead === 'string' && this.m.sprites[cd.overhead]) {
      const od = this.m.sprites[cd.overhead];
      const x = Math.round(a.wx);
      const y = Math.round(a.wy);
      entry.closed.push(this.reg(this.add.sprite(x, y, od.atlas, od.frame)).setOrigin(...originOf(od)).setDepth(DEPTH.overhead + y / 1000));
      const rollShadow = this.roomOutdoor ? this.shadows.addStatic(cd.overhead, od, x, y, DEPTH.overhead + y / 1000) : null;
      if (rollShadow) entry.closed.push(rollShadow as unknown as Phaser.GameObjects.GameObject);
    }
    this.feiraStalls.push(entry);
  }

  /** Show the open stalls (tarp up) at 06:00-13:00, the folded ones otherwise. */
  private updateFeira(): void {
    if (!this.feiraStalls.length) return;
    const open = feiraOpen(clock.minutes());
    for (const e of this.feiraStalls) {
      if (e.isOpen === open) continue;
      e.isOpen = open;
      for (const o of e.open) (o as Phaser.GameObjects.Sprite).setVisible(open);
      for (const o of e.closed) (o as Phaser.GameObjects.Sprite).setVisible(!open);
    }
  }

  /** A fenced rectangle: the perimeter pieces of the pack's fence set (the inside is blocked and dressed by other props). */
  private buildFence(p: PropDef): void {
    for (const piece of fencePieces(p)) {
      if (!this.m.sprites[piece.key]) {
        this.noteMissing(piece.key);
        continue;
      }
      this.sprite(piece.key, (piece.x + (piece.w ?? 1) / 2) * T, (piece.y + 1) * T, standingDepth((piece.y + 1) * T, `${p.id}:${piece.x},${piece.y}`), false);
    }
  }

  /** Ground decals (crosswalks, mosaic, flowers, tufts, grime) and the overhead wires of an open-air map. */
  /** The strip of sky and distant buildings above the north row (`backdrop/sky_0..3`, 14 tiles each); the facades hide their feet. */
  private buildBackdrop(def: RoomDef): void {
    for (let i = 0; i * 14 < def.cols; i++) {
      const sd = this.m.sprites[`backdrop/sky_${i % 4}`];
      if (sd) this.reg(this.add.image(i * 14 * T, 0, sd.atlas, sd.frame)).setOrigin(0, 1).setDepth(-9500);
    }
  }

  private buildScenery(def: RoomDef): void {
    const sc = sceneryFor(def, (k) => !!this.m.sprites[k]);
    if (!sc) return;
    for (const d of sc.decals) {
      const sd = this.m.sprites[d.key];
      const img = this.reg(this.add.image(d.x, d.y, sd.atlas, sd.frame)).setDepth(d.depth);
      if (d.origin === 'tl') img.setOrigin(0, 0);
      else img.setOrigin(...originOf(sd));
    }
    const pole = this.m.sprites['props/poste_fios'];
    const attachY = pole?.attach?.[1] ?? -51;
    for (const run of sc.wires) {
      let wx = run.x;
      const wy = run.y + attachY;
      for (const key of run.keys) {
        const wd = this.m.sprites[key];
        if (!wd) {
          this.noteMissing(key);
          continue;
        }
        // wires cross over everything: overhead layer, a little see-through so they never fight the art below
        this.reg(this.add.image(wx, wy, wd.atlas, wd.frame)).setOrigin(...originOf(wd)).setDepth(DEPTH.overhead + 200).setAlpha(0.7);
        wx += wd.w - 1;
      }
    }
  }

  private addLampLights(bx: number, by: number, L: { x: number; y: number; r: number; color: string }): void {
    const color = parseInt(L.color.slice(1), 16);
    // one switch per lamp: the halo and the pool on the ground share the delay of the lamp's position
    const delay = lightDelay(bx, by);
    this.rig.lights.push({ x: bx + L.x, y: by + L.y, r: L.r * 0.55, color, squash: 1, kind: 'lamp', glow: 0.6, delay, mirror: Math.max(0, -2 * L.y) });
    // the pool of light lands on the ground around the base
    this.rig.lights.push({ x: bx + 5, y: by - 2, r: L.r * 1.3, color, squash: 0.55, kind: 'lamp', glow: 0.4, delay });
  }

  /** The look of an avatar: a neighbour wears its own style (portrait match), everyone else their appearance. */
  private lookOf(a: ClientAvatar): Look {
    if (a.pub.npc) return lookForNpc(a.pub.npc, a.pub.appearance, a.pub.hat);
    // in the academia a player wears the belt they earned (white until the blue belt); CPUs stay in street clothes
    const belt = game.roomDef?.id === 'academia' && !isCpuId(a.pub.id) ? (a.pub.belt ?? 'branca') : null;
    return lookForAppearance(a.pub.appearance, { hat: a.pub.hat, ...(belt ? { gi: true, belt } : {}) });
  }

  /** Nanda's stall is closed (dimmed) unless she is standing at it. */
  private updateStall(): void {
    const s = this.stall;
    if (!s) return;
    const nanda = this.avatars.get('npc-nanda');
    const closed = !nanda || nanda.moving;
    if (closed === s.closed) return;
    s.closed = closed;
    for (const spr of [s.main, s.canopy]) {
      if (!spr) continue;
      if (closed) spr.setTint(0x8f94b8);
      else spr.clearTint();
    }
  }

  // ------------------------------------------------------------------ per-frame reconcile
  override update(_time: number, delta: number): void {
    if (!this.ready) return;
    this.trackPerf();
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
    this.syncBout(dt, now);
    this.updateCanopies(dt);
    this.updateHover(def);
    this.updateTrilho();
    this.updateStall();
    this.updateFeira();
    this.hitBoxes = this.staticHits.concat(dyn);
    this.updateCamera(dt, def);
    this.applyLook(def, dt);
    this.pushLabels(def, now);
  }

  /** Phase 6a: the live game clock and weather -> the rig (grade, darkness, lamps) and the rain. */
  private applyLook(def: RoomDef, dt: number): void {
    const weather = clock.weather();
    if (!this.blendReady) {
      this.blend.snap(weather);
      this.blendReady = true;
    }
    const me = game.self ? this.avatars.get(game.self.pub.id) : undefined;
    if (this.playerLight) {
      this.playerLight.r = me ? 30 : 0;
      if (me) {
        this.playerLight.x = me.wx;
        this.playerLight.y = me.wy - 8;
      }
    }
    const params = this.blend.step(weather, dt);
    const look = computeLook({ outdoor: this.outdoor, roomHour: ROOM_HOUR[def.lighting], minutes: clock.minutesExact(), weather: params });
    this.look = look;
    const people = [...this.avatars.values()].map((v) => ({ x: v.wx, y: v.wy }));
    this.ambient.update({ dt, t: Date.now() + clock.skewMs, minute: clock.minutesExact(), params, dark: look.dark, people, cam: this.cameras.main });
    this.zoneFeed.update(def, me ? { x: me.wx, y: me.wy, moving: me.moving } : null, clock.minutes(), params.rain, performance.now());
    // V5: the sun's shadows draw in outdoor rooms unless low-fx dropped them (then the baked cast shadows are used)
    const dyn = this.outdoor && !this.fxLevel.lowfx && v5on('shadow');
    this.rig.bakedCast = !dyn;
    this.rig.apply(look, this.cameras.main.zoom, (wx, wy) => this.toDevice(wx, wy));
    this.shadows.update(look.shadow, dyn, 1, look.rim);
    this.ao.update(this.outdoor && !this.fxLevel.lowfx && v5on('ao') ? look.ao : 0);
    // V5: wet ground: the paving gets darker and bluer, the grass a little richer (tints only change in 5% steps)
    const wetQ = v5on('wet') ? Math.round(look.wet * 20) / 20 : 0;
    if (wetQ !== this.wetApplied) {
      this.wetApplied = wetQ;
      for (const g of this.groundLayers) if ('catkdp'.includes(g.ch)) g.layer.setTint(groundWetTint(wetQ, g.ch === 'g' || g.ch === 'd' ? 'grass' : 'paving'));
    }
    if (v5on('water')) this.water.update(dt, params.sun * Math.max(0, 1 - look.night * 1.5), look.night, look.lampOn(20), this.fxLevel.reduced, !this.fxLevel.lowfx);
    this.weatherFx.update({ lampOn: look.lampOn, wet: look.wet, dt, zoom: this.cameras.main.zoom, w: this.scale.width, h: this.scale.height, params, night: look.night, outdoor: this.outdoor, cam: this.cameras.main });
  }

  /** Frame-time probe, the automatic low-fx fallback and reduced motion (HOWTO §5.11). */
  private trackPerf(): void {
    const t = performance.now();
    if (this.lastUpdateAt) this.probe.record(t - this.lastUpdateAt, t);
    this.lastUpdateAt = t;
    if (this.gov.check(t)) this.degrade('p90');
    if (t - this.reducedCheckAt > 1000) {
      this.reducedCheckAt = t;
      this.fxLevel.reduced = reducedMotion();
    }
  }

  /** Low-fx: no vignette, half the rain, no splashes or ripples. */
  private degrade(reason: string): void {
    this.fxLevel.lowfx = true;
    if (this.vignette) {
      this.cameras.main.postFX.remove(this.vignette);
      this.vignette = null;
    }
    console.info(`[pixel] low-fx on (${reason})`);
  }

  /** Debug / shots hook (window.__tb.ambient): the ambient layer's live numbers and a way to call the bus. */
  ambientHook() {
    return { info: () => this.ambient.info(), bus: (inMs?: number) => this.ambient.bus(inMs) };
  }

  /** Debug hook (window.__tb.facings): the facing and animation each avatar sprite is drawn with this frame (e2e and bug repros). */
  facingsHook(): Record<string, { facing: Facing; anim: string; moving: boolean }> {
    const out: Record<string, { facing: Facing; anim: string; moving: boolean }> = {};
    for (const [id, v] of this.avatars) out[id] = { facing: v.facing, anim: v.sprite.anims.currentAnim?.key ?? v.anim, moving: v.moving };
    return out;
  }

  perfInfo() {
    return {
      ...this.probe.stats(),
      lowfx: this.fxLevel.lowfx,
      lowfxReason: this.gov.reason,
      reducedMotion: this.fxLevel.reduced,
      particles: this.weatherFx.particles() + this.ambient.particles(),
      ambient: this.ambient.info(),
      weather: clock.weather(),
      minutes: clock.minutes(),
      outdoor: this.outdoor,
      objects: this.children.length,
      textures: Object.keys(this.textures.list).length,
      dark: this.look ? +this.look.dark.toFixed(3) : 0,
      fx: this.weatherFx.info(),
      shade: { casters: this.shadows.count, rims: this.shadows.rimCount, silhouettes: this.shadows.generated, pages: this.shadows.pageCount, fill: this.shadows.pageFill, aoShapes: this.ao.shapeCount },
    };
  }

  /** Canvas size and DPR for this frame; the zoom itself is chosen per room in `updateCamera` (roomFraming). */
  private applyZoom(): void {
    this.cam.dpr = this.scale.width / Math.max(1, window.innerWidth);
    this.cam.w = this.scale.width;
    this.cam.h = this.scale.height;
  }

  /** World px -> fx-camera (device) px, using the main camera as it is drawn. */
  private toDevice(wx: number, wy: number): [number, number] {
    const cam = this.cameras.main;
    const hw = cam.width / 2;
    const hh = cam.height / 2;
    return [(wx - cam.scrollX - hw) * cam.zoom + hw, (wy - cam.scrollY - hh) * cam.zoom + hh];
  }

  // ---- Phase 7: dialogue camera (one zoom step in, centred between the player and the NPC, above the box)
  private dlg: { npc: { x: number; y: number } | null } | null = null;
  private dlgNpc: { x: number; y: number } | null = null;
  private dlgBoxCss = 0;
  private dlgBlend = 0;

  /** The dialogue box opened (`npc`: its tile, or null for something that is not a person) or closed (`null`). */
  setDialogue(d: { npc: { x: number; y: number } | null } | null): void {
    this.dlg = d;
    if (d?.npc) this.dlgNpc = d.npc;
  }

  /** Height of the dialogue box in CSS px. */
  setDialogueBox(px: number): void {
    this.dlgBoxCss = px;
  }

  private withDialogue(f: { zoom: number; cx: number; cy: number; fits: boolean }, self: { x: number; y: number }, ins: Insets, k: number, dt: number): typeof f {
    this.dlgBlend = stepBlend(this.dlgBlend, this.dlg ? 1 : 0, dt, 0.28, this.fxLevel.reduced || !!this.host.shot);
    if (this.dlgBlend <= 0) return f;
    const n = this.dlgNpc;
    const g = dialogueFraming({
      base: f,
      view: { w: this.cam.w, h: this.cam.h },
      bounds: this.bounds,
      insets: { top: ins.top * k, bottom: ins.bottom * k, left: ins.left * k, right: ins.right * k },
      boxPx: (this.dlgBoxCss + 12) * k,
      self,
      npc: n ? { x: (n.x + 0.5) * T, y: (n.y + 1) * T - 13 } : null,
      blend: easeOut(this.dlgBlend),
      step: Math.max(1, Math.round(k)),
    });
    return { ...f, ...g };
  }

  // ---- Treino no tatame: the camera eases one zoom step onto the mat, above the overlay and under the scoreboard (like the dialogue)
  private withBout(f: { zoom: number; cx: number; cy: number; fits: boolean }, ins: Insets, k: number, dt: number): typeof f {
    this.boutBlend = stepBlend(this.boutBlend, boutFeed.camera ? 1 : 0, dt, 0.4, this.fxLevel.reduced || !!this.host.shot);
    if (this.boutBlend <= 0) return f;
    const mat = this.matCenter();
    if (!mat) return f;
    const g = dialogueFraming({
      base: f,
      view: { w: this.cam.w, h: this.cam.h },
      bounds: this.bounds,
      // The mat sits a little lower in the free band (when the screen has spare height) so the north wall's sign is not cut by the top of the screen.
      insets: { top: (boutFeed.topPx + this.boutWallReveal(boutFeed.topPx, boutFeed.boxPx + 6, k)) * k, bottom: 0, left: ins.left * k, right: ins.right * k },
      boxPx: (boutFeed.boxPx + 6) * k,
      self: { x: mat.x, y: mat.y },
      npc: null,
      blend: easeOut(this.boutBlend),
      step: Math.max(1, Math.round(k)),
    });
    return { ...f, ...g };
  }

  /** Extra top inset (CSS px) that nudges the mat down; 0 unless the band between the scoreboard and the panel is over 330 CSS px tall. */
  private boutWallReveal(topPx: number, boxPx: number, k: number): number {
    const free = this.cam.h / k - topPx - boxPx;
    return Math.min(60, Math.max(0, free - 330));
  }

  /** The middle of the open mat (the tatame prop), world px, plus its east and west edges; null in a room without one. */
  private matCenter(): { x: number; y: number; x0: number; x1: number } | null {
    const p = this.roomDef?.props.find((q) => q.kind === 'tatame');
    if (!p) return null;
    const w = p.w ?? 1;
    const hgt = p.h ?? 1;
    return { x: (p.x + w / 2) * T, y: (p.y + hgt / 2) * T, x0: p.x * T, x1: (p.x + w) * T };
  }

  /** Anchor (bottom centre) of the mat scoreboard prop, world px. */
  private placarAnchor(): { wx: number; wy: number } | null {
    const p = this.roomDef?.props.find((q) => q.id === 'placar');
    return p ? propAnchor(p) : null;
  }

  /** Professora Bia's avatar view (the referee), if she is in the room. */
  private biaView(): { sprite: Phaser.GameObjects.Sprite; wx: number; wy: number; depth: number } | null {
    const v = this.avatars.get('npc-prof');
    return v ? { sprite: v.sprite, wx: v.wx, wy: v.wy, depth: v.sprite.depth } : null;
  }

  /** The spectators: every CPU in the room, with the world px of the top of its head (where the cheer pops up). */
  private crowdSpots(): { id: string; x: number; y: number }[] {
    const out: { id: string; x: number; y: number }[] = [];
    for (const [id, v] of this.avatars) if (isCpuId(id)) out.push({ id, x: v.wx, y: v.wy - (v.sitting ? HEAD_LIFT_SIT : HEAD_LIFT) - lookHeadLift(v.look) - 4 });
    return out;
  }

  /** The bout's own avatar rules: the player is not on the mat as a character (the pair sprite is them), and the stage updates. */
  private syncBout(dt: number, now: number): void {
    const hide = boutFeed.active;
    const me = game.room ? this.avatars.get(game.room.selfId) : undefined;
    if (me) {
      me.sprite.setVisible(!hide);
      me.shadow.setVisible(!hide);
      if (hide) me.parrot?.setVisible(false);
    }
    this.stage.update(dt, now);
  }

  private updateCamera(dt: number, def: RoomDef): void {
    const self = game.self ? this.avatars.get(game.self.pub.id) : undefined;
    const focus = self ? { x: self.wx, y: self.wy - 10 } : { x: (def.cols * T) / 2, y: (def.rows * T) / 2 };
    const ins = this.host.insets();
    const k = this.cam.dpr;
    const dpr = k; // the effective (possibly capped, see bufferPixels) ratio of the backing store
    // the whole room (walls included) when it fits at this or the next lower integer zoom, else follow the avatar with the north wall kept in view
    let f = roomFraming({ w: this.cam.w, h: this.cam.h }, this.bounds, focus, { top: ins.top * k, bottom: ins.bottom * k, left: ins.left * k, right: ins.right * k }, cssZoomFor(window.innerWidth, window.innerHeight), dpr, def.outdoor ? OUTDOOR_NORTH : undefined);
    if (this.host.shot === 'map' && def.outdoor) {
      // debug `?shot=map`: the whole map in one frame, at the biggest integer zoom that fits (1x on a 1280 x 800 window), centred, no follow
      const zoom = Math.max(1, Math.floor(Math.min(this.cam.w / (def.cols * T), this.cam.h / (def.rows * T))));
      f = { zoom, cx: (def.cols * T) / 2, cy: (def.rows * T) / 2, fits: true };
    }
    const camShot = /^cam:(-?[\d.]+),(-?[\d.]+),(\d+)$/.exec(this.host.shot ?? '');
    if (camShot) {
      // debug `?shot=cam:<tileX>,<tileY>,<zoom>` (art reviews): a fixed camera on a tile position at an integer zoom
      f = { zoom: Number(camShot[3]), cx: Number(camShot[1]) * T, cy: Number(camShot[2]) * T, fits: true };
    }
    f = this.withDialogue(f, self ? { x: self.wx, y: self.wy - 10 } : focus, ins, k, dt);
    f = this.withBout(f, ins, k, dt);
    const target = { cx: f.cx, cy: f.cy };
    this.cam.zoom = f.zoom;
    if (this.cameras.main.zoom !== f.zoom) {
      this.cameras.main.setZoom(f.zoom);
      this.snapCamera = true;
    }
    this.cssScale = f.zoom / this.cam.dpr;
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
    const nudge = this.stage.cameraNudge();
    this.cameras.main.centerOn(this.cam.cx + nudge.x, this.cam.cy + nudge.y);
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
    const look = this.lookOf(a);
    const sheet = this.sheets.acquire(look);
    const sprite = this.rig.world(this.add.sprite(0, 0, sheet, 0)).setOrigin(0.5, 1);
    const s16 = this.m.sprites['fx/shadow_16'];
    const shadow = this.rig.world(this.add.image(0, 0, s16.atlas, s16.frame)).setOrigin(...originOf(s16)).setDepth(DEPTH.shadowContact);
    this.shadows.follow(sprite, 'chars/avatar', { frame: 0, rim: true });
    return { sprite, shadow, sheet, appearance: a.pub.appearance, hat: a.pub.hat, belt: a.pub.belt, look, parrot: null, icon: null, iconKey: '', anim: '', facing: 'S', wx: 0, wy: 0, dirSeen: undefined, sitting: false, moving: false };
  }

  private destroyAvatar(v: AvatarView): void {
    v.parrot?.destroy();
    v.icon?.destroy();
    v.sprite.destroy();
    v.shadow.destroy();
    this.sheets.release(v.sheet);
  }

  private updateAvatar(v: AvatarView, a: ClientAvatar, def: RoomDef, now: number, dyn: HitBox[]): void {
    // appearance or hat changed (wardrobe, avatarUpdated): swap the sheet
    if (a.pub.appearance !== v.appearance || a.pub.hat !== v.hat || a.pub.belt !== v.belt) {
      v.appearance = a.pub.appearance;
      v.hat = a.pub.hat;
      v.belt = a.pub.belt;
      v.look = this.lookOf(a);
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
      v.dirSeen = undefined; // standing up reads the wire Dir again
    } else if (pos.moving) {
      // top-down: the facing comes from the path step being walked, once per step, never from per-frame position deltas (those flipped
      // E/W <-> S/N every frame on an exact diagonal). Diagonals face E/W; the wire Dir is the fallback when there is no step (D5).
      const i = pos.next ? a.path.indexOf(pos.next) : -1;
      facing = i >= 0 ? facingAlongPath(pos.tile, a.path.slice(i), v.facing) : v.moving ? v.facing : FACING[pos.dir];
      v.dirSeen = a.pub.dir;
    } else if (!a.path.length) {
      // standing: the wire Dir turns the sprite when it CHANGES (a fresh spawn, a turn in place). Right after a walk the walking facing
      // stays: the wire Dir of a diagonal step is an isometric SE/SW/NE/NW that does not match the E/W the sprite walked with
      if (v.dirSeen === undefined || a.pub.dir !== v.dirSeen) facing = FACING[a.pub.dir];
      v.dirSeen = a.pub.dir;
    }
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
    // a neighbour standing right behind a counter (Seu Carlos at the padaria) is drawn a little further up, over his own shelves, so the counter
    // top no longer cuts off his face; depth, tile and click logic keep the real tile
    const lift = !sitting && !pos.moving && a.pub.npc && !this.roomOutdoor && this.grid?.blocked.has(tileKey(pos.tile.x, pos.tile.y + 1)) ? COUNTER_LIFT : 0;
    const wy = Math.round(f.wy) - lift;
    v.wx = wx;
    v.wy = wy;
    v.sprite.setPosition(wx, wy - bounce);
    v.shadow.setPosition(wx, wy - 1);
    // sitters draw just above what they sit on (the bench's bottom edge is the tile's bottom edge)
    const depth = sitting ? (pos.tile.y + 1) * T + 0.5 : standingDepth(f.wy, a.pub.id);
    v.sprite.setDepth(depth);
    this.shadows.setFollowScale(v.sprite, sitting ? 0.62 : 1);

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
    this.updateEmoteIcon(v, a, wx, wy - bounce, sitting, now);
    const h = sitting ? 24 : 32;
    const base = a.pub.npc ? npcDefById(a.pub.npc) : undefined;
    if (base) {
      // a neighbour: clicking it is the same as clicking an NPC of old, at the tile it has reached, with the interact tile of its slot
      const npc = { ...base, x: pos.tile.x, y: pos.tile.y, interact: a.pub.npcInteract ?? base.interact };
      dyn.push({ x0: wx - 9, y0: wy - h - 2, x1: wx + 9, y1: wy + 2, hit: { kind: 'npc', npc }, depth: wy + 0.5 });
    } else dyn.push({ x0: wx - 9, y0: wy - h, x1: wx + 9, y1: wy + 2, hit: { kind: 'avatar', id: a.pub.id }, depth: wy + 0.6 });
    void def;
  }

  /**
   * The pop-up icon of an emote (wave, thumbs up, laugh, music note, sweat drop in a small bubble) over the head's right side for ~1.1 s: it rises
   * 4 px in the first 0.16 s, holds, and fades out in the last 0.25 s. Shown even while the avatar walks (the gesture itself needs it to stand still).
   */
  private updateEmoteIcon(v: AvatarView, a: ClientAvatar, wx: number, wy: number, sitting: boolean, now: number): void {
    const t = a.emote ? now / 1000 - a.emote.t0 : -1;
    const d = a.emote && t >= 0 && t < EMOTE_ICON_S ? this.m.sprites[`fx/emote_${a.emote.kind}`] : undefined;
    if (!d || !a.emote) {
      if (v.icon?.visible) v.icon.setVisible(false);
      return;
    }
    if (!v.icon) v.icon = this.rig.world(this.add.sprite(0, 0, d.atlas, d.frame)).setDepth(DEPTH.overhead + 1);
    if (v.iconKey !== a.emote.kind) {
      v.iconKey = a.emote.kind;
      v.icon.setTexture(d.atlas, d.frame).setOrigin(...originOf(d));
    }
    const rise = 1 - Math.min(1, t / 0.16);
    const top = (sitting ? HEAD_LIFT_SIT : HEAD_LIFT) - 1 + lookHeadLift(v.look);
    v.icon.setPosition(wx + 8, Math.round(wy - top - 1 + rise * 4)).setAlpha(Math.min(1, (EMOTE_ICON_S - t) / 0.25)).setVisible(true);
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
    v.parrot.setPosition(wx + side * 9, wy - 14 + bob);
    v.parrot.setFlipX(side === 1);
    v.parrot.setDepth(facing === 'N' ? depth - 0.05 : depth + 0.05);
  }

  // ---- placed furniture: `furniture/<id>_<rot>` sprites (art track 3); a magenta box when the art is missing
  private furnitureObj(v: FurnitureView | null, f: PlacedFurniture): Pick<FurnitureView, 'obj' | 'shadow'> {
    const def = furnitureById(f.itemId);
    const rug = def?.kind === 'tapete';
    const key = furnitureArtKey(f.itemId, f.rot);
    const sd = this.m.sprites[key];
    const depth = rug ? DEPTH.groundDecal + 20 : standingDepth((f.y + 1) * T, f.uid);
    const wx = f.x * T + T / 2;
    const wy = (f.y + 1) * T;
    if (v) {
      v.obj.destroy();
      v.shadow?.destroy();
    }
    if (!sd) {
      this.noteMissing(key.replace(/_[01]$/, ''));
      const r: Rect = { x0: f.x * T + 1, y0: f.y * T + 1, x1: (f.x + 1) * T - 1, y1: (f.y + 1) * T - 1 };
      const obj = this.reg(this.add.rectangle((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, r.x1 - r.x0, r.y1 - r.y0, 0xff00ff, 0.35)).setStrokeStyle(1, 0xff00ff, 1).setDepth(depth);
      return { obj, shadow: null };
    }
    const obj = this.reg(this.add.sprite(wx, wy, sd.atlas, sd.frame)).setOrigin(...originOf(sd)).setDepth(depth);
    if (sd.anim) obj.play({ key: ensureAnim(this, key, sd), startFrame: Math.floor(hash01(f.x * 31 + f.y) * sd.anim.frames.length) });
    const s = sd.shadow ? this.m.sprites[sd.shadow] : null;
    const shadow = s ? this.reg(this.add.image(wx, wy - 1, s.atlas, s.frame)).setOrigin(...originOf(s)).setDepth(DEPTH.shadowContact) : null;
    return { obj, shadow };
  }

  /** World rect of a placed piece: its tile plus its sprite (what the selection outline hugs). */
  private furnitureBox(f: PlacedFurniture): Rect {
    const tile: Rect = { x0: f.x * T, y0: f.y * T, x1: (f.x + 1) * T, y1: (f.y + 1) * T };
    const sd = this.m.sprites[furnitureArtKey(f.itemId, f.rot)];
    return sd ? unionRect(tile, spriteRect(Math.round(f.x * T + T / 2), (f.y + 1) * T, sd)) : tile;
  }

  /** Two 1 px rings, mustard inside navy, drawn as filled bars so every edge is a whole art pixel. */
  private drawSelection(g: Phaser.GameObjects.Graphics, r: Rect): void {
    g.clear();
    const ring = (b: Rect, color: number) => {
      g.fillStyle(color, 1);
      g.fillRect(b.x0, b.y0, b.x1 - b.x0, 1);
      g.fillRect(b.x0, b.y1 - 1, b.x1 - b.x0, 1);
      g.fillRect(b.x0, b.y0 + 1, 1, b.y1 - b.y0 - 2);
      g.fillRect(b.x1 - 1, b.y0 + 1, 1, b.y1 - b.y0 - 2);
    };
    ring(inflate(r, 1), 0x2a2233);
    ring(r, 0xf2c230);
    // corner studs make the outline read even over busy floors
    g.fillStyle(0xfff3b0, 1);
    for (const [x, y] of [[r.x0, r.y0], [r.x1 - 1, r.y0], [r.x0, r.y1 - 1], [r.x1 - 1, r.y1 - 1]]) g.fillRect(x, y, 1, 1);
  }

  private syncFurniture(dyn: HitBox[]): void {
    const items = new Map<string, PlacedFurniture>(game.furniture.map((f) => [f.uid, f]));
    syncViews(this.furniture, items, {
      create: (_uid, f) => {
        const { obj, shadow } = this.furnitureObj(null, f);
        const sel = this.reg(this.add.graphics()).setDepth(DEPTH.overhead - 1).setVisible(false);
        return { obj, shadow, sel, selSig: '', itemId: f.itemId, rot: f.rot, x: f.x, y: f.y };
      },
      update: (v, f) => {
        const def = furnitureById(f.itemId);
        if (v.rot !== f.rot) {
          v.rot = f.rot;
          Object.assign(v, this.furnitureObj(v, f));
        }
        if (v.x !== f.x || v.y !== f.y) {
          v.x = f.x;
          v.y = f.y;
          Object.assign(v, this.furnitureObj(v, f));
        }
        const selected = game.selectedFurniture === f.uid;
        v.sel.setVisible(selected);
        if (selected) {
          const sig = `${f.x},${f.y},${f.rot}`;
          if (sig !== v.selSig) {
            v.selSig = sig;
            this.drawSelection(v.sel, this.furnitureBox(f));
          }
          v.sel.setAlpha(0.8 + 0.2 * Math.sin(performance.now() / 180));
        } else v.selSig = '';
        if (v.obj instanceof Phaser.GameObjects.Rectangle) v.obj.setStrokeStyle(selected ? 2 : 1, selected ? 0xf2c230 : 0xff00ff, 1);
        const seat = !!def?.seat && !game.editMode;
        const hit: Hit = seat ? { kind: 'seat', tile: { x: f.x, y: f.y } } : { kind: 'furniture', f };
        dyn.push({ x0: f.x * T - 2, y0: f.y * T - 8, x1: (f.x + 1) * T + 2, y1: (f.y + 1) * T, hit, depth: (f.y + 1) * T });
      },
      destroy: (v) => {
        v.obj.destroy();
        v.shadow?.destroy();
        v.sel.destroy();
      },
    });
  }

  private updateHover(def: RoomDef): void {
    const t = game.hoverTile;
    const show = !!t && !game.modalOpen && t.x >= 0 && t.y >= 0 && t.x < def.cols && t.y < def.rows;
    this.hoverRect.setVisible(show);
    // decorate mode: a translucent ghost of the piece in hand (or being moved), green where it can go and red where it cannot
    const ghost = show ? ghostFor(def, game.furniture, t, game.placing, game.selectedFurniture, game.editMode) : null;
    this.updateGhost(ghost);
    if (!show || !t) return;
    if (ghost) {
      this.hoverRect.setPosition(t.x * T, t.y * T).setFillStyle(ghost.tile, 0.3).setStrokeStyle(1, ghost.tile, 0.9);
      return;
    }
    const ok = game.placing ? canPlaceFurniture(def, game.furniture, t.x, t.y) : !!this.grid && !this.grid.blocked.has(tileKey(t.x, t.y));
    this.hoverRect.setPosition(t.x * T, t.y * T).setFillStyle(ok ? 0xffffff : 0xe5572f, 0.25).setStrokeStyle(1, ok ? 0xffffff : 0xe5572f, 0.8);
  }

  private updateGhost(g: GhostSpec | null): void {
    const sd = g ? this.m.sprites[furnitureArtKey(g.itemId, g.rot)] : undefined;
    if (!g || !sd) {
      this.ghost?.setVisible(false);
      return;
    }
    if (!this.ghost) this.ghost = this.rig.world(this.add.sprite(0, 0, sd.atlas, sd.frame));
    const spr = this.ghost;
    if (this.ghostKey !== `${g.itemId}_${g.rot}`) {
      this.ghostKey = `${g.itemId}_${g.rot}`;
      spr.setTexture(sd.atlas, sd.frame).setOrigin(...originOf(sd));
    }
    // sits like a standing piece on its tile but always in front of it: the player is choosing where it goes
    spr.setPosition(Math.round(g.x * T + T / 2), (g.y + 1) * T).setDepth(49500).setTint(g.tint).setAlpha(GHOST_ALPHA + 0.08 * Math.sin(performance.now() / 220)).setVisible(true);
  }

  /** The order rail on the padaria counter is still until Me vê um is open, then its tickets flutter. */
  private updateTrilho(): void {
    const t = this.trilho;
    if (!t) return;
    const open = modalId() === 'minigame';
    if (open === this.trilhoLive) return;
    this.trilhoLive = open;
    const d = this.m.sprites['props/trilho_pedidos'];
    if (!d?.anim) return;
    if (open) {
      t.play({ key: ensureAnim(this, 'props/trilho_pedidos', d) });
      t.anims.timeScale = 2.4;
    } else {
      t.anims.stop();
      t.setFrame(d.anim.frames[0]);
    }
  }

  /** Overhead layers fade to 0.45 alpha while the local avatar's feet are inside (HOWTO §5.4). */
  private updateCanopies(dt: number): void {
    const self = game.self ? this.avatars.get(game.self.pub.id) : undefined;
    // Phase 10: a vendor stands under the tarp; while you talk to them (or stand at the stall) the tarp lets them show through
    const dn = this.dlg?.npc ?? null;
    const npcAt = dn ? { x: (dn.x + 0.5) * T, y: (dn.y + 1) * T } : null;
    for (const c of this.canopies) {
      const inside = !!self && self.wx >= c.r.x0 && self.wx <= c.r.x1 && self.wy >= c.r.y0 && self.wy <= c.r.y1;
      const talking = !!c.stall && !!npcAt && npcAt.x >= c.r.x0 && npcAt.x <= c.r.x1 && npcAt.y >= c.r.y0 && npcAt.y <= c.r.y1 + T;
      const infront = !!c.stall && !!self && self.wx >= c.r.x0 && self.wx <= c.r.x1 && self.wy > c.r.y1 && self.wy <= c.r.y1 + 2 * T;
      const target = talking ? 0.3 : inside || infront ? 0.45 : 1;
      c.fade += (target - c.fade) * Math.min(1, dt / 0.15);
      c.sprite.setAlpha(c.fade);
      // at night a lamp's hole in the darkness (and its warm glow) would light a canopy up neon green: the foliage itself is dimmed by up to a third
      if (!c.stall) {
        const g = Math.round(255 * (1 - 0.34 * Math.min(1, (this.look?.dark ?? 0) / 0.5)));
        c.sprite.setTint((g << 16) | (g << 8) | g);
      }
    }
  }

  // ------------------------------------------------------------------ DOM labels
  private pushLabels(def: RoomDef, now: number): void {
    const k = this.cam;
    const at = (wx: number, wy: number) => worldToCanvas(k, wx, wy);
    const stacks: StackItem[] = [];
    const selfId = game.room?.selfId;
    const selfView = selfId ? this.avatars.get(selfId) : undefined;
    if (this.stall?.closed) {
      const p = at(this.stall.wx, this.stall.wy - 30);
      stacks.push({ key: 'stall:closed', x: p.px, y: p.py, plate: { text: 'Fechado · volta às 8h', kind: 'npc' }, bubbles: [] });
    }
    // the feira's banner says it is closed outside 06:00-13:00
    if (this.feiraStalls.length && !feiraOpen(clock.minutes())) {
      const b = def.props.find((q) => q.id === 'feira_livre');
      if (b) {
        const p = at((b.x + (b.w ?? 1) / 2) * T, b.y * T - 22);
        stacks.push({ key: 'feira:closed', x: p.px, y: p.py, plate: { text: 'Feira fechada · volta às 6h', kind: 'npc' }, bubbles: [] });
      }
    }
    for (const [id, v] of this.avatars) {
      const a = game.avatars.get(id);
      if (!a) continue;
      if (id === selfId && boutFeed.active) continue; // the pair sprite is the player now
      const p = at(v.wx, v.wy - (v.sitting ? HEAD_LIFT_SIT : HEAD_LIFT) - lookHeadLift(v.look));
      if (a.pub.npc) {
        // a neighbour: terracotta plate with the role, and its own bubbles (idle lines are keyed by NPC id)
        const b = game.npcBubbles.get(a.pub.npc);
        const age = b ? now - b.at : Infinity;
        const role = npcDefById(a.pub.npc)?.role.pt;
        stacks.push({
          key: `npc:${a.pub.npc}`,
          x: p.px,
          y: p.py,
          plate: { text: role && game.hoverKey === `npc:${a.pub.npc}` ? `${a.pub.name} · ${role}` : a.pub.name, kind: 'npc' },
          // Bia is the referee while a bout is on: her idle chatter stays quiet
          bubbles: b && age < 7000 && !(boutFeed.camera && a.pub.npc === 'prof') ? [{ text: b.text, gloss: b.gloss, alpha: bubbleAlpha(age) }] : [],
        });
        continue;
      }
      const bubbles = isCpuId(id)
        ? [] // Live Ops lock: CPUs never show chat bubbles
        : a.bubbles
            .filter((b) => now - b.at < 7000)
            .slice(-2)
            .map((b) => ({ text: b.text, gloss: b.gloss, alpha: bubbleAlpha(now - b.at) }));
      // CPUs are scenery: their name shows on hover, within ~3.5 tiles of you, or while they emote
      const near = !!selfView && Math.hypot(v.wx - selfView.wx, v.wy - selfView.wy) <= 3.5 * T;
      const cpuShow = !isCpuId(id) || game.hoverKey === `av:${id}` || near || (!!a.emote && performance.now() - a.emote.t0 < 3500);
      stacks.push({ key: `av:${id}`, x: p.px, y: p.py, plate: { text: a.pub.name, kind: id === selfId ? 'me' : 'player', show: cpuShow }, bubbles });
    }
    const guides: GuideItem[] = this.host.guides().map((g, i) => {
      const w = tileToWorld(g.x, g.y);
      const lift = Math.min(48, Math.max(12, g.lift * 0.3));
      const p = at(w.wx, w.wy - lift);
      return { key: `g${i}`, x: p.px, y: p.py, label: g.label };
    });
    const view = { w: k.w / k.dpr, h: k.h / k.dpr };
    this.host.labels.update(stacks, guides, view, this.host.insets());
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
    return { zoom: this.cam.zoom, cssScale: this.cssScale, cx: this.cam.cx, cy: this.cam.cy, room: this.roomId, avatars: this.avatars.size, sheets: this.sheets.size, artMissing: this.artMissing, bout: this.stage.info() };
  }
}

/** Quick fade in, then fully opaque until the bubble is removed at 7 s: a bubble is never see-through (the old 700 ms fade-out read as a ghost). */
function bubbleAlpha(age: number): number {
  return Math.max(0, Math.min(1, age / 120));
}
