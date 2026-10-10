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
import {
  buildGrid,
  feiraOpen,
  canPlaceFurniture,
  furnitureById,
  hotspotBox,
  diaryVisible,
  hotspotsInRoom,
  normalizeDiary,
  wordForSign,
  isCpuId,
  normalizeBjj,
  key as tileKey,
  positionAlong,
  propTiles,
  type Dir,
  npcDefById,
  type PlacedFurniture,
  type PropDef,
  type RoomDef,
  type RoomGrid,
  type WallDecor,
  COUNTER_MENU,
  CRESTS,
  PET_COPY,
  STREET_SNACKS,
  CARRY,
  carryOf,
} from '@tudobem/shared';
import { game, type ClientAvatar } from '../../state';
import type { Guide, Hit } from '../view';
import type { Manifest } from './manifest';
import { FACING, facingAlongPath, type Facing } from './facing';
import { createPetFollow, petCommandFromLines, stepPet, type PetFollow } from './petFollow';
import { addSheetTexture, animKey, animNames, emoteDuration, sitFrame } from './charsheet';
import { danceSway, emotePlaysSheet } from './emoteMotion';
import { CharSheets } from './charCache';
import type { CharAssets } from './charAssets';
import { composeLook } from './composeLook';
import { avatarCrown, avatarDrawScale, avatarPx, setAvatarZoom } from './characters';
import { academyUniformKey, lookForAvatar, lookForNpc, lookHeadLift, type Look } from './looks';
import { LightingRig, type Light } from './lightingRig';
import { computeLook, isOutdoor, lightDelay, windowPanes, type SceneLook } from './dayNight';
import { RUNWAYS, runwayPose, type RunwayDef } from './runway';
import { WeatherBlend, groundWetTint, type FxLevel } from './weatherLook';
import { WeatherFx } from './weatherFx';
import { ShadowLayer, type ShadowHandle } from './shadowLayer';
import { AoLayer } from './aoLayer';
import { v5on } from './v5flags';
import { WaterFx } from './water';
import { presetFor } from './lightPresets';
import { roofHall } from './roofLights';
import { aoForOverhead, aoForSprite } from './ao';
import { AmbientLife, ambientHandlesProp } from './ambient';
import { ZoneFeed } from '../../audio/zonesFeed';
import { ambience } from '../../ambience';
import { carrySfxFor, carrySfxGain } from '../../audio/carrySfx';
import { FrameProbe, LowFxGovernor, reducedMotion } from './perf';
import { clock } from '../../gameClock';
import { buildTerrainLayers } from './terrainLayers';
import { LabelLayer, type GuideItem, type StackItem } from './labels';
import { doorTagsFor, doorsFresh, type DoorTag } from '../../ui/wayfinding';
import { declinedOffers, npcMarkers } from '../../ui/recadoView';
import { T, cssZoomFor, deviceZoomFor, feet, leadNorthFor, outdoorFraming, roomFraming, roomZoom, snapToDevice, tileToWorld, worldToCanvas, type CamState, type Insets, type Rect } from './coords';

/** Door tags per room definition (they never change while the room is up). */
const DOOR_TAGS = new WeakMap<object, DoorTag[]>();
import { pickHit, type HitBox } from './hit';
import { boutZoomStep, dialogueFraming, easeOut, stepBlend } from './dialogueCam';
import { BoutStage, type StageHost } from './boutStage';
import { boutFeed } from './boutFeed';
import { CounterStage } from './correriaStage';
import { correriaFeed } from './correriaFeed';
import { FOCUS, NEED } from './correriaArt';
import { roomKey, syncViews } from './reconcile';
import { DEPTH, PROP_LIGHT, fencePieces, footprintRect, inflate, propAnchor, propClickKind, propDepth, furnitureArtKey, propArtKey, propPlaceholderKey, glintSpot, propSlices, propSize, spriteRect, standingDepth, unionRect } from './props';
import { sceneryFor, type WireRun } from './scenery';
import { SURROUND_TILES, surroundFor, surroundReachFor, type Surround } from './surround';
import { CROSS_PIXELS, TAP_COLORS, ringPixels, tapFrame, type TapCue } from './tapMark';
import {
  FLOOR_PLACEHOLDER,
  CAMERA_LEAD_NORTH,
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
import { PARROT_FRAME_COUNT, PARROT_H, PARROT_W, parrotPixels, parrotSpecies } from './parrotSpecies';
import { GHOST_ALPHA, ghostFor, type GhostSpec } from './decorate';
import { CARRY_BEAT_MS, arcPoint, beatPose, binInReach, carryMove, groundSpot } from './carryFx';

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
  /** Academy uniform key (`academyUniformKey`). Empty when the avatar wears no academy gi. */
  uniform: string;
  look: Look;
  parrot: Phaser.GameObjects.Sprite | null;
  /** Animation key the shoulder parrot is playing (`anim:chars/parrot` or a recolored `anim:parrot:<color>`). */
  parrotKey: string;
  /** Subscriber dog or cat. It walks a breadcrumb trail behind the owner; it is not a click target. */
  pet: Phaser.GameObjects.Sprite | null;
  petKind: string;
  petKey: string;
  petFollow: PetFollow;
  /** Chat timestamp already offered to the pet, so a line is heard once. */
  petHeard: number;
  /** Street snack in hand (session carry). */
  carry: Phaser.GameObjects.Image | null;
  carryKey: string;
  /** When the held icon last changed, so the pop can run while scale is reapplied every frame. */
  carryPop: number;
  /** Comer / Beber in progress: the full item at the mouth (`carryFx.beatPose`); the empty, if any, waits hidden in `carry`. */
  carryBeat: { kind: 'eat' | 'drink'; t0: number; lastMs: number; img: Phaser.GameObjects.Image } | null;
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
  /** waiting for traffic: which walk (its start time) the hold belongs to, ms held so far, ms of this wait, last frame time */
  walkStart: number;
  holdMs: number;
  waitMs: number;
  lastNow: number;
}

/** Longest an avatar waits for a car in its way before it carries on regardless (a car that is itself waiting for them). */
const CAR_WAIT_MAX_MS = 2500;

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

/** seconds the emote pop-up icon stays over the head */
const EMOTE_ICON_S = 1.1;
/**
 * World px below the mat's middle the bout camera aims at: the middle of the fighters. The pair frame stands 18 below the mat centre and is
 * 42 tall, but the figures only fill its lower ~30 px (heads start about 13 px down), so their middle is about 4 below the mat centre.
 */
const BOUT_PAIR_FOCUS = 4;
/** The part of a 56 x 42 pair frame the fighters actually fill, standing or on the ground: what the bout camera sizes them by. */
const BOUT_PAIR_BODY = { w: 56, h: 32 } as const;

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
  /** The bout camera's extra device zoom right now (it walks toward its target one px at a time); 0 while the camera is off. */
  private boutStep = 0;
  private boutStepT = 0;
  /** the Correria no Balcão counter (board, queue, shelf taps) behind the padaria counter */
  private counter!: CounterStage;
  private counterBlend = 0;
  private counterWasOn = false;
  private roomId = '';
  private roomDef: RoomDef | null = null;
  private layoutEpoch = -1;
  private roomObjs: Phaser.GameObjects.GameObject[] = [];
  /** Reading words in this room: a small twinkle over each one this player has not read yet (the signs have no sprite of their own). */
  private glints: { word: string; img: Phaser.GameObjects.Image; phase: number }[] = [];
  /** The airport's runway: the plane that lands now and then, its shadow and the touchdown puff (`runway.ts`). */
  private runway: { def: RunwayDef; plane: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image | null; puff: Phaser.GameObjects.Image | null } | null = null;
  private glintDiary: unknown = null;
  private glintHave = new Set<string>();
  private roomMap: Phaser.Tilemaps.Tilemap | null = null;
  private staticHits: HitBox[] = [];
  private placeholders: { key: string; rect: Rect }[] = [];
  private stall: StallView | null = null;
  /** Lixeiras in this room (tile, sprite, the y of the open mouth): where a Jogar fora lands, and what bounces when it does. */
  private bins: { x: number; y: number; sprite: Phaser.GameObjects.Sprite; mouthY: number }[] = [];
  private canopies: Canopy[] = [];
  /** Feira stalls (Phase 9): the open sprites and tarp, and the folded ones, shown by the game clock (06:00-13:00). */
  private feiraStalls: { open: Phaser.GameObjects.GameObject[]; closed: Phaser.GameObjects.GameObject[]; isOpen: boolean | null }[] = [];
  private avatars = new Map<string, AvatarView>();
  private furniture = new Map<string, FurnitureView>();
  private grid: RoomGrid | null = null;
  private gridFurniture: PlacedFurniture[] | null = null;
  /** The room the grid was built from, so a live cart toggle rebuilds collision with the sprites. */
  private gridDef: RoomDef | null = null;
  private bounds: Rect = { x0: 0, y0: 0, x1: 1, y1: 1 };
  private snapCamera = true;
  /** the camera centre as it follows, unsnapped (`cam.cx/cy` is this snapped to device px) */
  private follow = { x: 0, y: 0 };
  /** prop reach (tiles) the current open-air room's surround was built with (surroundReachFor) */
  private surroundReach = 0;
  private hoverRect!: Phaser.GameObjects.Rectangle;
  /** the tap-to-walk marker (tapMark.ts): the ring under the destination, or the refused cross */
  private tapImg!: Phaser.GameObjects.Image;
  private tap: { kind: TapCue; wx: number; wy: number; t0: number; tile: { x: number; y: number } | null } | null = null;
  private lastT = 0;
  /** the game day the room was built for (a new day brings a new couple of small diary objects) */
  private diaryDay = -1;
  /** decorate-mode ghost of the piece being placed or moved (scene-level: it outlives room rebuilds) */
  private ghost: Phaser.GameObjects.Sprite | null = null;
  private ghostKey = '';
  /** the padaria order rail: still until Correria no Balcão is open */
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
    for (const [name, a] of Object.entries(m.atlases)) if (!a.lazy) this.load.atlas(name, b + a.image, b + a.data);
    this.load.image('terrainTs', b + m.terrain.tileset);
    for (const [key, f] of Object.entries(m.fx)) this.load.image(`fx:${key}`, b + f.file);
    // what you can carry: the praça snacks, the padaria counter menu, and the empties they leave
    const carry = new Map<string, string>();
    for (const s of STREET_SNACKS) carry.set(s.id, s.icon);
    for (const id of COUNTER_MENU) carry.set(id, id);
    for (const c of Object.values(CARRY)) if (c.kind === 'trash') carry.set(c.id, c.tex);
    for (const [id, icon] of carry) {
      const img = m.images?.[`icons/${icon}`];
      if (img?.file) this.load.image(`carry:${id}`, b + img.file);
    }
    for (const kind of ['dog', 'cat'] as const) {
      const img = m.images?.[`chars/pet_${kind}`];
      if (img?.file && img.frameW) this.load.spritesheet(`pet:${kind}`, b + img.file, { frameWidth: img.frameW, frameHeight: img.h });
    }
  }

  create(): void {
    const cam = this.cameras.main;
    cam.setBackgroundColor('#1d1b26');
    cam.setRoundPixels(true);
    this.rig = new LightingRig(this, cam, 'fx:glow');
    for (const kind of ['dog', 'cat'] as const) this.createPetAnims(kind);
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
    this.tapImg = this.rig.world(this.add.image(0, 0, '__WHITE')).setOrigin(0, 0).setVisible(false);
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
      loadAtlas: (name, done) => {
        const a = this.m.atlases[name];
        if (!a || this.textures.exists(name)) return done();
        this.load.atlas(name, this.base + a.image, this.base + a.data);
        this.load.once(`filecomplete-atlasjson-${name}`, () => done());
        this.load.once('loaderror', () => done());
        this.load.start();
      },
      crowd: () => this.crowdSpots(),
      mat: () => this.matCenter(),
      placar: () => this.placarAnchor(),
      toCanvas: (wx, wy) => worldToCanvas(this.cam, wx, wy),
      cssScale: () => this.cssScale,
      reduced: () => this.fxLevel.reduced,
      instant: () => !!this.host.shot,
    });
    this.counter = new CounterStage({
      scene: this,
      world: (o) => this.rig.world(o),
      manifest: this.m,
      noteMissing: (k) => this.noteMissing(k),
      acquireSheet: (look) => this.sheets.acquire(look),
      releaseSheet: (k) => this.sheets.release(k),
      toCanvas: (wx, wy) => worldToCanvas(this.cam, wx, wy),
      cssScale: () => this.cssScale,
      reduced: () => this.fxLevel.reduced,
      instant: () => !!this.host.shot,
    });
    if (!this.host.lowfx) this.vignette = cam.postFX.addVignette(0.5, 0.5, 0.88, 0.22);
    this.scale.on('resize', (size: Phaser.Structs.Size) => this.rig.resize(size.width, size.height));
    this.ready = true;
  }

  /** The twinkle sprite (7 x 7 art px, drawn once): a four-point star in the guide arrow's gold. */
  private glintTexture(): string {
    const key = 'fx:glint';
    if (!this.textures.exists(key))
      this.textures.generate(key, {
        data: ['...1...', '...2...', '..232..', '1233321', '..232..', '...2...', '...1...'],
        pixelWidth: 1,
        palette: { 1: '#c9921c', 2: '#f2c230', 3: '#fffbe8' } as unknown as Phaser.Types.Create.Palette,
      });
    return key;
  }

  /** One twinkle per reading word in the room, at the top of the thing it is written on. Shown only while the word is unread (`syncGlints`). */
  private buildGlints(def: RoomDef): void {
    const tex = this.glintTexture();
    // the art of the room's props, to find the sign board a word is written on (the hotspot box is only the floor it stands on)
    const arts: { key: string; rect: Rect }[] = [];
    for (const p of def.props) {
      const key = propArtKey(p);
      const d = key ? this.m.sprites[key] : undefined;
      if (!key || !d) continue;
      const a = propAnchor(p);
      arts.push({ key, rect: spriteRect(Math.round(a.wx), Math.round(a.wy), d) });
    }
    for (const hs of hotspotsInRoom(def.id)) {
      const word = wordForSign(hs.id);
      if (!word) continue;
      const b = hotspotBox(hs);
      const at = glintSpot({ x0: b.x0 * T, y0: b.y0 * T, x1: b.x1 * T, y1: b.y1 * T }, arts);
      const img = this.reg(this.add.image(at.x, at.y, tex)).setDepth(DEPTH.overhead - 10).setVisible(false);
      this.glints.push({ word: word.id, img, phase: hash01(b.x0 * 13 + b.y0 * 7) * Math.PI * 2 });
    }
  }

  /** The landing plane of a room with a runway (the airport): hidden until the clock brings it round. */
  private buildRunway(def: RoomDef): void {
    this.runway = null;
    const rw = RUNWAYS[def.id];
    const d = rw ? this.m.sprites['aero/aviao_pista'] : undefined;
    if (!rw || !d) return;
    const plane = this.reg(this.add.image(0, 0, d.atlas, d.frame)).setOrigin(...originOf(d)).setDepth(rw.y + 0.5).setVisible(false);
    const sd = this.m.sprites['fx/shadow_48'];
    const shadow = sd ? this.reg(this.add.image(0, 0, sd.atlas, sd.frame)).setOrigin(...originOf(sd)).setDepth(DEPTH.shadowContact).setVisible(false) : null;
    const pd = this.m.sprites['aero/fumaca'];
    const puff = pd ? this.reg(this.add.image(0, 0, pd.atlas, pd.frame)).setOrigin(...originOf(pd)).setDepth(rw.y + 0.6).setVisible(false) : null;
    this.runway = { def: rw, plane, shadow, puff };
  }

  private syncRunway(): void {
    const r = this.runway;
    if (!r) return;
    const p = runwayPose(r.def, Date.now() + clock.skewMs);
    r.plane.setVisible(p.visible);
    r.shadow?.setVisible(p.visible);
    if (!p.visible) {
      r.puff?.setVisible(false);
      return;
    }
    const x = Math.round(p.x);
    const back = p.dir === 'w' ? -1 : 1;
    r.plane.setPosition(x, Math.round(p.groundY - p.alt)).setRotation(p.pitch * back).setFlipX(p.dir === 'w');
    // the shadow on the runway: smaller and fainter the higher the plane is
    r.shadow?.setPosition(x + Math.round(p.alt * 0.25), p.groundY).setScale(Math.max(0.4, 1.4 - p.alt / 120), 0.8).setAlpha(Math.max(0.15, 0.7 - p.alt / 160));
    if (r.puff) {
      r.puff.setVisible(p.puff > 0);
      if (p.puff > 0) r.puff.setPosition(x - back * (14 + Math.round((1 - p.puff) * 10)), p.groundY).setAlpha(p.puff).setScale(1 + (1 - p.puff) * 0.8);
    }
  }

  /** Twinkle the unread words (slow, staggered; steady under reduced motion); hidden while a counter or bout has the screen. */
  private syncGlints(now: number): void {
    if (!this.glints.length) return;
    // the diary set is rebuilt only when the profile's diary array changes (a new profile push)
    const diary = game.profile?.diary;
    if (diary !== this.glintDiary) {
      this.glintDiary = diary;
      this.glintHave = new Set(normalizeDiary(diary));
    }
    const have = this.glintHave;
    const busy = correriaFeed.active || boutFeed.active || game.cameraOn;
    for (const g of this.glints) {
      const show = !busy && !have.has(g.word);
      g.img.setVisible(show);
      if (!show) continue;
      if (this.fxLevel.reduced) {
        g.img.setAlpha(0.9).setScale(1);
        continue;
      }
      const t = (Math.sin(now / 520 + g.phase) + 1) / 2;
      g.img.setAlpha(0.35 + 0.65 * t).setScale(0.75 + 0.35 * t);
    }
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
    if (shadow && key.startsWith('vehicles/')) this.reg(this.rig.liftBody(spr)); // a parked car keeps its shape at night
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
    this.bins = [];
    this.feiraStalls = [];
    for (const o of this.roomObjs) o.destroy();
    this.roomObjs = [];
    this.roomMap?.destroy();
    this.roomMap = null;
    this.staticHits = [];
    this.glints = [];
    this.runway = null;
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

    // ---- terrain: dual-grid layers for the floor chars that have art; substitutes and flat placeholders for the rest. An open-air map draws
    // the town around it too (surround.ts): the same layers, started `margin` tiles out, so the ground runs on past the map edge
    // its props reach as far past the map as this window can see (issue #154), so where they stop is never on screen
    this.surroundReach = def.outdoor ? this.wantedReach(def) : 0;
    const sur = surroundFor(def, this.surroundReach);
    const res = buildTerrainLayers(this, sur ? sur.floor : def.floor, m.terrain, 'terrainTs', { outside: def.outdoor ? undefined : 'x', wrap: (o) => this.rig.world(o), substitute: FLOOR_SUBSTITUTE, offset: sur ? -sur.margin : 0 });
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

    // ---- sky and far skyline above the street of an open-air map
    if (sur) this.buildBackdrop(sur);

    // ---- ground dressing and wires of an open-air map, and of the neighbouring areas drawn around it
    this.buildScenery(def);
    if (sur) this.buildSurroundScenery(sur);

    // ---- props
    // the small diary objects and signs stand out a couple at a time, a different couple each game day
    this.diaryDay = clock.day();
    for (const p of def.props) if (diaryVisible(def.id, p.id, this.diaryDay)) this.buildProp(p);
    // the town around an open-air map: scenery only (no action, label or seat, outside the walkable grid).
    // Static sprites, no sun-shadow caster and no lamp: those are per-frame, and a phone was paying for a whole neighbouring block (issue #123).
    for (const p of sur?.props ?? []) this.buildProp(p, true);

    // ---- readable world (Phase 7): a click box per hotspot (the footprint, plus the wall rows above it for a sign painted on a north wall)
    for (const hs of hotspotsInRoom(def.id)) {
      // Seu Carlos's own shelf sign does not hang in a player-owned padaria
      if (game.room?.padaria && hs.id === 'padaria_prateleira') continue;
      if (!diaryVisible(def.id, hs.id, this.diaryDay)) continue;
      const b = hotspotBox(hs);
      this.staticHits.push({ x0: b.x0 * T, y0: b.y0 * T, x1: b.x1 * T, y1: b.y1 * T, hit: { kind: 'hotspot', hotspot: hs }, depth: b.y1 * T - 0.25 });
    }
    this.buildGlints(def);
    this.buildRunway(def);
    // ---- the ceiling panels of a roofed open-air map (the airport terminal): the hall stays lit from dusk to dawn
    this.rig.roof = roofHall(def);

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
    this.tap = null;
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

  /** `scenery`: a surround prop. One sprite, no sun-shadow caster, no lamp and no stall logic (those update every frame). */
  private buildProp(p: PropDef, scenery = false): void {
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
          this.sprite(s.key, wx, wy, depth, !scenery);
          visual = unionRect(visual, spriteRect(Math.round(wx), Math.round(wy), sd));
        } else this.placeholder(`${s.key}#${p.id}`, { x0: s.x * T, y0: s.y * T, x1: (s.x + 1) * T, y1: (s.y + 1) * T }, depth);
      }
    } else if (artKey && d) {
      const main = this.sprite(artKey, a.wx, a.wy, depth, !scenery);
      const mainShadow = this.lastShadow;
      const feiraEntry = !scenery && p.kind === 'feira' ? { open: (main ? [main] : []) as Phaser.GameObjects.GameObject[], closed: [] as Phaser.GameObjects.GameObject[], isOpen: null as boolean | null } : null;
      if (feiraEntry && mainShadow) feiraEntry.open.push(mainShadow as unknown as Phaser.GameObjects.GameObject);
      if (!scenery && p.kind === 'barraca_chapeus') this.stall = { main, canopy: null, wx: a.wx, wy: a.wy, closed: false };
      if (!scenery && p.kind === 'lixeira' && main) this.bins.push({ x: p.x, y: p.y, sprite: main, mouthY: Math.round(a.wy) - d.ay + 4 });
      if (!scenery && p.kind === 'trilho_pedidos' && main && d.anim) {
        // the ticket rail is still until Correria no Balcão opens (updateTrilho)
        main.anims.stop();
        main.setFrame(d.anim.frames[0]);
        this.trilho = main;
        this.trilhoLive = false;
      }
      if (!scenery && d.lit && m.sprites[d.lit]) {
        const ld = m.sprites[d.lit];
        this.rig.litOverlays.push(this.reg(this.add.image(Math.round(a.wx), Math.round(a.wy), ld.atlas, ld.frame)).setOrigin(...originOf(ld)).setDepth(depth + 0.01).setAlpha(0).setData('delay', lightDelay(a.wx, a.wy)));
      }
      visual = unionRect(foot, spriteRect(Math.round(a.wx), Math.round(a.wy), d));
      // lit windows of a building front: light pools on the sidewalk at night
      if (!scenery) for (const [wx, wy, ww, wh] of d.windows ?? []) {
        this.rig.lights.push({ x: Math.round(a.wx) - d.ax + wx + ww / 2, y: Math.round(a.wy) - d.ay + wy + wh + 5, r: 22 + ww * 0.5, color: 0xffc060, squash: 0.6, kind: 'window' });
      }
      if (typeof d.overhead === 'string' && m.sprites[d.overhead]) {
        const od = m.sprites[d.overhead];
        const x = Math.round(a.wx);
        const y = Math.round(a.wy);
        const spr = this.reg(this.add.sprite(x, y, od.atlas, od.frame)).setOrigin(...originOf(od)).setDepth(DEPTH.overhead + y / 1000);
        if (od.anim) spr.play({ key: ensureAnim(this, d.overhead, od), startFrame: Math.floor(hash01(x * 7 + y) * 4) });
        if (!scenery && p.kind === 'barraca_chapeus' && this.stall) this.stall.canopy = spr;
        feiraEntry?.open.push(spr);
        const canopyShadow = !scenery && this.roomOutdoor ? this.shadows.addStatic(d.overhead, od, x, y, DEPTH.overhead + y / 1000) : null;
        if (!scenery && this.roomOutdoor && p.kind !== 'feira') this.ao.add(aoForOverhead(d.overhead, od, x, y, d.footprint));
        if (feiraEntry && canopyShadow) feiraEntry.open.push(canopyShadow as unknown as Phaser.GameObjects.GameObject);
        if (!scenery) {
          const left = x - od.ax;
          const top = y - od.ay;
          this.canopies.push({ sprite: spr, r: { x0: left, y0: top + 8, x1: left + od.w, y1: top + od.h + 14 }, fade: 1, stall: p.kind === 'feira' || p.kind === 'barraca_chapeus' });
        }
      }
      if (feiraEntry) this.buildFeiraClosed(artKey, a, depth, feiraEntry);
      if (!scenery) {
        const L = d.light ? { x: d.light.x - d.ax, y: d.light.y - d.ay, r: d.light.r, color: d.light.color } : PROP_LIGHT[p.kind];
        if (L) this.addLampLights(Math.round(a.wx), Math.round(a.wy), L);
        else {
          // V5: lights from data: the sprite key's preset, or the generic pool for a prop flagged lightAtNight
          const pr = presetFor(artKey, p.lightAtNight);
          if (pr) {
            const bx = Math.round(a.wx);
            const by = Math.round(a.wy);
            const delay = lightDelay(bx, by);
            for (const s of pr.lights) this.rig.lights.push({ x: bx + s.x, y: by + s.y, r: s.r, color: parseInt(s.color.slice(1), 16), squash: s.squash, kind: 'lamp', glow: s.glow ?? 0.4, delay, halo: s.halo });
          }
        }
      }
      if (!scenery && this.roomOutdoor && presetFor(artKey, p.lightAtNight)?.water) {
        const px = this.shadows.readFrame(d.atlas, d.frame);
        if (px) this.water.add(artKey, px.data as Uint8ClampedArray, px.w, px.h, a.wx, a.wy, d.ax, d.ay, depth);
      }
    } else {
      this.placeholder(`${propPlaceholderKey(p)}#${p.id}`, foot, depth);
    }

    const click = propClickKind(p);
    if (click === 'prop') {
      this.staticHits.push({ ...inflate(unionRect(visual, foot), 2), hit: { kind: 'prop', prop: p }, depth: a.wy });
    } else if (click === 'seat') {
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
  /**
   * The strip of sky and distant buildings standing on the street's north edge (`backdrop/sky_0..3`, 14 tiles each), across the whole width
   * the camera can show; the facades hide its feet. Above it, open sky in three bands, lightest at the horizon (the strip's own top colour).
   */
  private buildBackdrop(sur: Surround): void {
    const y = sur.skyline;
    // strips on the town grid's 14-tile rhythm, so the skyline lines up across the rua / rua_leste seam
    const W = 14 * T;
    const ox = sur.townX * T;
    for (let i = Math.floor((sur.skyX0 + ox) / W); i * W - ox < sur.skyX1; i++) {
      const sd = this.m.sprites[`backdrop/sky_${((i % 4) + 4) % 4}`];
      if (sd) this.reg(this.add.image(i * W - ox, y, sd.atlas, sd.frame)).setOrigin(0, 1).setDepth(-9500);
    }
    const top = y - 32 - SURROUND_TILES * T;
    const bands: [number, number][] = [
      [y - 32 - 2 * T, 0x94b6cf],
      [y - 32 - 6 * T, 0x8aaecb],
      [top, 0x80a7c6],
    ];
    let bottom = y - 32;
    for (const [y0, color] of bands) {
      this.reg(this.add.rectangle(sur.skyX0, y0, sur.skyX1 - sur.skyX0, bottom - y0, color, 1)).setOrigin(0, 0).setDepth(-9501);
      bottom = y0;
    }
  }

  /** Ground dressing of the neighbouring areas around an open-air map (shifted onto this map's tiles) and the lane dashes of the generated blocks. */
  private buildSurroundScenery(sur: Surround): void {
    const has = (k: string) => !!this.m.sprites[k];
    const r = sur.reach;
    for (const n of sur.neighbours) {
      const sc = sceneryFor(n.def, has);
      if (!sc) continue;
      const dx = n.dx * T;
      const dy = n.dy * T;
      for (const d of sc.decals) {
        const x = d.x + dx;
        const y = d.y + dy;
        if (x < r.x0 || x > r.x1 || y < r.y0 || y > r.y1) continue;
        const sd = this.m.sprites[d.key];
        const img = this.reg(this.add.image(x, y, sd.atlas, sd.frame)).setDepth(d.depth);
        if (d.origin === 'tl') img.setOrigin(0, 0);
        else img.setOrigin(...originOf(sd));
      }
      this.buildWires(sc.wires, dx, dy);
    }
    const dash = this.m.sprites['decals/lane_dash'];
    if (dash) for (const d of sur.dashes) this.reg(this.add.image(d.x, d.y, dash.atlas, dash.frame)).setOrigin(0, 0).setDepth(DEPTH.groundDecal);
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
    this.buildWires(sc.wires, 0, 0);
  }

  /** The overhead wires between utility poles, shifted by (dx, dy) world px (a neighbouring area's wires drawn around this map). */
  private buildWires(runs: WireRun[], dx: number, dy: number): void {
    const pole = this.m.sprites['props/poste_fios'];
    const attachY = pole?.attach?.[1] ?? -51;
    for (const run of runs) {
      let wx = run.x + dx;
      const wy = run.y + dy + attachY;
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
    return lookForAvatar(a.pub);
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
    // a window grown past what the surround was built for (a resize, a rotated tablet) rebuilds it with a longer reach; shrinking keeps it
    if (
      key !== this.roomId ||
      this.roomDef !== def ||
      clock.day() !== this.diaryDay ||
      game.layoutEpoch !== this.layoutEpoch ||
      (def.outdoor && this.wantedReach(def) > this.surroundReach)
    ) {
      this.roomId = key;
      this.roomDef = def;
      this.layoutEpoch = game.layoutEpoch;
      this.grid = null;
      this.gridFurniture = null;
      this.buildRoom(def);
    }
    if (this.gridFurniture !== game.furniture || this.gridDef !== def || !this.grid) {
      this.grid = buildGrid(def, game.furniture);
      this.gridFurniture = game.furniture;
      this.gridDef = def;
    }
    this.applyZoom();
    const dyn: HitBox[] = [];
    this.syncFurniture(dyn);
    this.syncAvatars(def, now, dyn, dt);
    this.syncGlints(now);
    this.syncBout(dt, now);
    this.syncCounter(dt, now);
    this.updateCanopies(dt);
    this.updateHover(def);
    this.updateTap(now);
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
        this.playerLight.y = me.wy - avatarPx(8);
      }
    }
    const params = this.blend.step(weather, dt);
    const look = computeLook({ outdoor: this.outdoor, roomHour: ROOM_HOUR[def.lighting], minutes: clock.minutesExact(), weather: params });
    this.look = look;
    const people = [...this.avatars.values()].map((v) => ({ x: v.wx, y: v.wy }));
    this.syncRunway();
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
    // A review frame (`?shot=`) keeps the full effect set. A slow box would otherwise drop the clouds the shot is there to show.
    if (!this.host.shot && this.gov.check(t)) this.degrade('p90');
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

  /** Prop reach (tiles) the surround of an open-air room needs at the current window size and zoom (surround.surroundReachFor). */
  private wantedReach(def: RoomDef): number {
    const dpr = this.scale.width / Math.max(1, window.innerWidth);
    const zoom = deviceZoomFor(cssZoomFor(window.innerWidth, window.innerHeight), dpr) / dpr;
    return surroundReachFor(def, { w: window.innerWidth, h: window.innerHeight }, zoom, this.host.insets());
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
      npc: n ? { x: (n.x + 0.5) * T, y: (n.y + 1) * T - 3 - avatarPx(10) } : null,
      blend: easeOut(this.dlgBlend),
      step: Math.max(1, Math.round(k)),
    });
    return { ...f, ...g };
  }

  // ---- Treino no tatame: the camera eases one zoom step onto the mat, above the overlay and under the scoreboard (like the dialogue)
  private withBout(f: { zoom: number; cx: number; cy: number; fits: boolean }, ins: Insets, k: number, dt: number): typeof f {
    this.boutBlend = stepBlend(this.boutBlend, boutFeed.camera ? 1 : 0, dt, 0.4, this.fxLevel.reduced || !!this.host.shot);
    if (this.boutBlend <= 0) {
      this.boutStep = 0;
      return f;
    }
    const mat = this.matCenter();
    if (!mat) return f;
    const unit = Math.max(1, Math.round(k));
    // during a match the camera works around the tallest the overlay has been, so it holds still while the panel changes
    const box = boutFeed.active ? boutFeed.fightBox(this.cam.h / k) : boutFeed.boxPx;
    // the lobby is one step in; a match on the mat goes in until the fighters fill the free band, so they are big and the grips readable
    const target = boutFeed.active ? boutZoomStep({ baseZoom: f.zoom, unit, view: { w: this.cam.w, h: this.cam.h }, topPx: (boutFeed.topPx + 6) * k, boxPx: (box + 6) * k, pair: BOUT_PAIR_BODY, fill: 0.7 }) : unit;
    // and it walks there one whole device px at a time (crisp at every frame), not in one cut
    if (this.boutStep <= 0 || this.fxLevel.reduced || this.host.shot) this.boutStep = target;
    else if (this.boutStep !== target) {
      this.boutStepT += dt;
      if (this.boutStepT >= 0.06) {
        this.boutStepT = 0;
        this.boutStep += Math.sign(target - this.boutStep);
      }
    }
    const g = dialogueFraming({
      base: f,
      view: { w: this.cam.w, h: this.cam.h },
      bounds: this.bounds,
      // The mat sits a little lower in the free band (when the screen has spare height) so the north wall's sign is not cut by the top of the screen.
      insets: { top: (boutFeed.topPx + this.boutWallReveal(boutFeed.topPx, box + 6, k)) * k, bottom: 0, left: ins.left * k, right: ins.right * k },
      boxPx: (box + 6) * k,
      // the pair itself, not the mat's middle: the fighters stand a little below it
      self: { x: mat.x, y: mat.y + (boutFeed.active ? BOUT_PAIR_FOCUS : 0) },
      npc: null,
      blend: easeOut(this.boutBlend),
      step: this.boutStep,
    });
    return { ...f, ...g };
  }

  // ---- Correria no Balcão: the camera eases one zoom step onto the work board, above the overlay (like the dialogue)
  private withCounter(f: { zoom: number; cx: number; cy: number; fits: boolean }, ins: Insets, k: number, dt: number): typeof f {
    this.counterBlend = stepBlend(this.counterBlend, correriaFeed.camera ? 1 : 0, dt, 0.4, this.fxLevel.reduced || !!this.host.shot);
    if (this.counterBlend <= 0 || !this.roomId.startsWith('padaria')) return f;
    // one step in, but never so far that the board and the queue leave the free band between the HUD and the strip
    const unit = Math.max(1, Math.round(k));
    const availH = this.cam.h - (correriaFeed.topPx + 6) * k - (correriaFeed.boxPx + 6) * k;
    const availW = this.cam.w - (ins.left + ins.right) * k;
    let zoom = f.zoom + unit;
    while (zoom > unit && (NEED.h * zoom > availH || NEED.w * zoom > availW)) zoom -= unit;
    const base = zoom >= f.zoom ? f : { ...f, zoom };
    const g = dialogueFraming({
      base,
      view: { w: this.cam.w, h: this.cam.h },
      bounds: this.bounds,
      insets: { top: (correriaFeed.topPx + 6) * k, bottom: 0, left: ins.left * k, right: ins.right * k },
      boxPx: (correriaFeed.boxPx + 6) * k,
      self: { x: FOCUS.x, y: FOCUS.y },
      npc: null,
      blend: easeOut(this.counterBlend),
      step: Math.max(0, zoom - base.zoom),
    });
    return { ...f, ...g };
  }

  /** The counter game's own avatar rules: the player is not in the room as a character (the board is them), and the stage updates. */
  private syncCounter(dt: number, now: number): void {
    const hide = correriaFeed.active;
    const me = game.room ? this.avatars.get(game.room.selfId) : undefined;
    if (me) {
      if (hide) {
        me.sprite.setVisible(false);
        me.shadow.setVisible(false);
        me.parrot?.setVisible(false);
        me.pet?.setVisible(false);
      } else if (this.counterWasOn && !boutFeed.active) {
        me.sprite.setVisible(true);
        me.shadow.setVisible(true);
      }
    }
    this.counterWasOn = hide;
    this.counter.update(dt, now);
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
  private biaView(): ReturnType<StageHost['bia']> {
    const v = this.avatars.get('npc-prof');
    return v ? { sprite: v.sprite, shadow: v.shadow, wx: v.wx, wy: v.wy, depth: v.sprite.depth } : null;
  }

  /** The spectators: every CPU in the room, with the world px of the top of its head (where the cheer pops up). */
  private crowdSpots(): { id: string; x: number; y: number }[] {
    const out: { id: string; x: number; y: number }[] = [];
    for (const [id, v] of this.avatars) if (isCpuId(id)) out.push({ id, x: v.wx, y: v.wy - avatarCrown(v.sitting, lookHeadLift(v.look)) - avatarPx(4) });
    return out;
  }

  /** The bout's own avatar rules: the player is not on the mat as a character (the pair sprite is them), and the stage updates. */
  private syncBout(dt: number, now: number): void {
    const hide = boutFeed.active;
    const me = game.room ? this.avatars.get(game.room.selfId) : undefined;
    if (me) {
      me.sprite.setVisible(!hide);
      me.shadow.setVisible(!hide);
      if (hide) {
        me.parrot?.setVisible(false);
        me.pet?.setVisible(false);
      }
    }
    this.stage.update(dt, now);
  }

  private updateCamera(dt: number, def: RoomDef): void {
    const self = game.self ? this.avatars.get(game.self.pub.id) : undefined;
    const ins = this.host.insets();
    const k = this.cam.dpr;
    const dpr = k; // the effective (possibly capped, see bufferPixels) ratio of the backing store
    // interiors: the whole room (walls included) when it fits at this or the next lower integer zoom, else follow the avatar with the north wall
    // kept in view. Open-air maps: the window's zoom, following the avatar; the town drawn around the map fills the rest (issue #123)
    const view = { w: this.cam.w, h: this.cam.h };
    const insDev = { top: ins.top * k, bottom: ins.bottom * k, left: ins.left * k, right: ins.right * k };
    const cssZoom = cssZoomFor(window.innerWidth, window.innerHeight);
    // the north lead shrinks on a short window so the avatar keeps a few tiles of floor in view below it
    const zoomForLead = def.outdoor ? deviceZoomFor(cssZoom, dpr) : roomZoom(view, this.bounds, insDev, cssZoom, dpr);
    const lead = leadNorthFor(CAMERA_LEAD_NORTH[def.id] ?? 0, view.h, insDev.bottom, zoomForLead, avatarPx(10));
    const focus = self ? { x: self.wx, y: self.wy - avatarPx(10) - lead } : { x: (def.cols * T) / 2, y: (def.rows * T) / 2 };
    let f = def.outdoor ? outdoorFraming(view, this.bounds, focus, insDev, cssZoom, dpr) : roomFraming(view, this.bounds, focus, insDev, cssZoom, dpr);
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
    f = this.withDialogue(f, self ? { x: self.wx, y: self.wy - avatarPx(10) } : focus, ins, k, dt);
    f = this.withBout(f, ins, k, dt);
    f = this.withCounter(f, ins, k, dt);
    const target = { cx: f.cx, cy: f.cy };
    this.cam.zoom = f.zoom;
    setAvatarZoom(f.zoom);
    if (this.cameras.main.zoom !== f.zoom) {
      this.cameras.main.setZoom(f.zoom);
      this.snapCamera = true;
    }
    this.cssScale = f.zoom / this.cam.dpr;
    const fol = this.follow;
    if (this.snapCamera) {
      fol.x = target.cx;
      fol.y = target.cy;
      this.snapCamera = false;
    } else {
      // exponential follow, about 0.12 per 60 fps frame (HOWTO §5.3), frame-rate independent
      const a = 1 - Math.pow(1 - 0.12, dt * 60);
      fol.x += (target.cx - fol.x) * a;
      fol.y += (target.cy - fol.y) * a;
    }
    // only what is drawn is snapped. Feeding the snapped centre back into the follow made a dead zone (a step under half a device px
    // rounded away every frame) and then a lurch once the gap grew past it (issue #154).
    this.cam.cx = snapToDevice(fol.x, this.cam.zoom);
    this.cam.cy = snapToDevice(fol.y, this.cam.zoom);
    const nudge = this.stage.cameraNudge();
    const cn = this.counter.cameraNudge();
    // On a phone the design panel covers the bottom of the screen. Look a little south so the avatar sits in the open part.
    // The offset is on the camera state too, so a tap lands on the prop the picture shows.
    const designLift = game.designMode && window.innerWidth <= 720 ? (this.cam.h * 0.2) / Math.max(1, this.cam.zoom) : 0;
    const pan = game.designMode ? game.designPan : { x: 0, y: 0 };
    this.cam.ox = pan.x;
    this.cam.oy = pan.y + designLift;
    this.cameras.main.centerOn(this.cam.cx + nudge.x + cn.x + this.cam.ox, this.cam.cy + nudge.y + cn.y + this.cam.oy);
    if (this.counterBlend > 0) this.counter.invalidate();
  }

  // ---- avatars
  private syncAvatars(def: RoomDef, now: number, dyn: HitBox[], dt: number): void {
    const items = new Map(game.avatars);
    syncViews(this.avatars, items, {
      create: (_id, a) => this.createAvatar(a),
      update: (v, a) => this.updateAvatar(v, a, def, now, dyn, dt),
      destroy: (v) => this.destroyAvatar(v),
    });
  }

  private createAvatar(a: ClientAvatar): AvatarView {
    const look = this.lookOf(a);
    const sheet = this.sheets.acquire(look);
    const sprite = this.rig.world(this.add.sprite(0, 0, sheet, 0)).setOrigin(0.5, 1).setScale(avatarDrawScale());
    const s16 = this.m.sprites['fx/shadow_16'];
    // wider with the body, still flat on the tile so the feet read as planted
    const shadow = this.rig.world(this.add.image(0, 0, s16.atlas, s16.frame)).setOrigin(...originOf(s16)).setDepth(DEPTH.shadowContact).setScale(avatarDrawScale(), 1);
    this.shadows.follow(sprite, 'chars/avatar', { frame: 0, rim: true });
    return {
      sprite,
      shadow,
      sheet,
      appearance: a.pub.appearance,
      hat: a.pub.hat,
      belt: a.pub.belt,
      uniform: academyUniformKey(a.pub),
      look,
      parrot: null,
      parrotKey: '',
      pet: null,
      petKind: '',
      petKey: '',
      petFollow: createPetFollow(),
      petHeard: -1,
      carry: null,
      carryKey: '',
      carryPop: 0,
      carryBeat: null,
      icon: null,
      iconKey: '',
      anim: '',
      facing: 'S',
      wx: 0,
      wy: 0,
      dirSeen: undefined,
      sitting: false,
      moving: false,
      walkStart: NaN,
      holdMs: 0,
      waitMs: 0,
      lastNow: 0,
    };
  }

  private destroyAvatar(v: AvatarView): void {
    v.parrot?.destroy();
    v.pet?.destroy();
    v.carry?.destroy();
    v.carryBeat?.img.destroy();
    v.icon?.destroy();
    v.sprite.destroy();
    v.shadow.destroy();
    this.sheets.release(v.sheet);
  }

  private updateAvatar(v: AvatarView, a: ClientAvatar, def: RoomDef, now: number, dyn: HitBox[], dt: number): void {
    // appearance or hat changed (wardrobe, avatarUpdated): swap the sheet
    const uniform = academyUniformKey(a.pub);
    if (a.pub.appearance !== v.appearance || a.pub.hat !== v.hat || a.pub.belt !== v.belt || uniform !== v.uniform) {
      v.appearance = a.pub.appearance;
      v.hat = a.pub.hat;
      v.belt = a.pub.belt;
      v.uniform = uniform;
      v.look = this.lookOf(a);
      const sheetKey = this.sheets.acquire(v.look);
      this.sheets.release(v.sheet);
      if (sheetKey !== v.sheet) {
        v.sheet = sheetKey;
        v.anim = '';
      }
    }

    // nobody walks through a car: where the walk would put the feet inside a vehicle the avatar stands still at the kerb (the walk clock is
    // held back frame by frame) and goes on once the car has passed or stopped short
    if (v.walkStart !== a.start) {
      v.walkStart = a.start;
      v.holdMs = 0;
      v.waitMs = 0;
    }
    const frameMs = Math.min(100, Math.max(0, now - v.lastNow));
    v.lastNow = now;
    let pos = positionAlong(a.from, a.path, now - a.start - v.holdMs, a.pub.dir);
    if (a.path.length) {
      const fp = feet(pos.x, pos.y);
      if (this.ambient.vehicleAt(fp.wx, fp.wy)) {
        if (v.waitMs < CAR_WAIT_MAX_MS) {
          v.holdMs += frameMs;
          v.waitMs += frameMs;
          pos = positionAlong(a.from, a.path, now - a.start - v.holdMs, a.pub.dir);
        }
      } else v.waitMs = 0;
    }
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
    // rir and desculpa play their sheet rows. oi, valeu and dancar do not: those rows paint an extra arm.
    // The pop-up icon still names the emote. Dançar leans side to side on the idle body. The 2 px bounce is only a fallback.
    let bounce = 0;
    let sway = 0;
    let emote: string | null = null;
    if (a.emote && !pos.moving && !sitting) {
      const t = now / 1000 - a.emote.t0;
      const dur = emoteDuration(this.m.sheet, a.emote.kind) / 1000;
      if (!emotePlaysSheet(a.emote.kind)) {
        sway = danceSway(a.emote.kind, t, dur > 0 ? dur : 1.3, reducedMotion());
      } else if (dur > 0) {
        if (t >= 0 && t < dur) emote = `${a.emote.kind}@${a.emote.t0}`;
      } else if (t >= 0 && t < 1.3) bounce = Math.round(Math.abs(Math.sin(t * 9)) * 2);
    }
    // at the ~1.4x draw scale a player one tile in front of the person they talk to covers them: while the dialogue is open the player
    // takes a step to the side (same row, eased with the dialogue camera), so both faces read in the close-up
    let aside = 0;
    const talkTo = this.dlg?.npc ?? (this.dlgBlend > 0 ? this.dlgNpc : null);
    if (talkTo && a.pub.id === game.room?.selfId && !pos.moving && !sitting) {
      const dxT = pos.tile.x - talkTo.x;
      const dyT = pos.tile.y - talkTo.y;
      if (Math.abs(dxT) <= 1 && Math.abs(dyT) <= 2) aside = Math.round((dxT < 0 ? -1 : 1) * avatarPx(10) * easeOut(this.dlgBlend));
    }
    // a walker lands on device px, not whole art px: the camera glides on device px, so a 1 art px step (4 device px at zoom 4) every few
    // frames made the walker shake against the street (issue #154). Standing still, the figure sits on the art grid like everything else.
    const snap = (v: number) => (pos.moving ? snapToDevice(v, this.cam.zoom) : Math.round(v));
    const wx = snap(f.wx) + aside;
    // feet stay on the tile. The scaled figure already puts the head above the padaria counter,
    // so the old 11 px counter lift (which planted the feet on the counter top) is gone.
    const wy = snap(f.wy);
    v.wx = wx;
    v.wy = wy;
    const bodyX = wx + sway;
    v.sprite.setPosition(bodyX, wy - bounce).setScale(avatarDrawScale());
    // under the mat camera, neighbours who wander about step out of the picture; the seated crowd stays to watch
    if (isCpuId(a.pub.id)) {
      const away = boutFeed.camera && !sitting;
      v.sprite.setAlpha(away ? 0 : 1);
      v.shadow.setAlpha(away ? 0 : 1);
    }
    v.shadow.setPosition(wx, wy - 1).setScale(avatarDrawScale(), 1);
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
    this.updateParrot(v, a, facing, bodyX, wy, depth, now);
    this.updatePet(v, a, wx, wy, dt);
    this.updateCarry(v, a, facing, bodyX, wy, depth);
    this.updateEmoteIcon(v, a, bodyX, wy - bounce, sitting, now);
    const h = avatarPx(sitting ? 24 : 32);
    const half = avatarPx(9);
    const base = a.pub.npc ? npcDefById(a.pub.npc) : undefined;
    if (base) {
      // a neighbour: clicking it is the same as clicking an NPC of old, at the tile it has reached, with the interact tile of its slot
      const npc = { ...base, x: pos.tile.x, y: pos.tile.y, interact: a.pub.npcInteract ?? base.interact };
      dyn.push({ x0: wx - half, y0: wy - h - avatarPx(2), x1: wx + half, y1: wy + avatarPx(2), hit: { kind: 'npc', npc }, depth: wy + 0.5 });
    } else dyn.push({ x0: wx - half, y0: wy - h, x1: wx + half, y1: wy + avatarPx(2), hit: { kind: 'avatar', id: a.pub.id }, depth: wy + 0.6 });
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
    const top = avatarCrown(sitting, lookHeadLift(v.look)) - avatarPx(1);
    v.icon.setPosition(wx + avatarPx(8), Math.round(wy - top - avatarPx(1) + rise * avatarPx(4))).setAlpha(Math.min(1, (EMOTE_ICON_S - t) / 0.25)).setVisible(true);
  }

  /**
   * Animation for the shoulder parrot. Verde plays the poleiro sheet. Every other colour is its own authored bird
   * (`parrotSpecies.ts`), painted once into canvas textures of the same size and anchor.
   */
  private parrotAnim(colorId: string | null | undefined): string {
    const d = this.m.sprites['chars/parrot'];
    const plain = d ? ensureAnim(this, 'chars/parrot', d) : '';
    const species = parrotSpecies(colorId);
    if (species === 'verde') return plain;
    const animKey = `anim:parrot:${species}`;
    if (this.anims.exists(animKey)) return animKey;
    const frames: { key: string }[] = [];
    for (let i = 0; i < PARROT_FRAME_COUNT; i++) {
      const texKey = `parrot:${species}:${i}`;
      if (!this.textures.exists(texKey)) {
        const canvas = this.textures.createCanvas(texKey, PARROT_W, PARROT_H);
        if (!canvas) return plain;
        canvas.getContext().putImageData(new ImageData(parrotPixels(species, i), PARROT_W, PARROT_H), 0, 0);
        canvas.refresh();
      }
      frames.push({ key: texKey });
    }
    this.anims.create({ key: animKey, frames, frameRate: d?.anim?.fps ?? 3, repeat: -1 });
    return animKey;
  }

  /** The companion parrot (profile.parrotEquipped -> PublicAvatar.parrot): the poleiro parrot hovering at the avatar's shoulder. */
  private updateParrot(v: AvatarView, a: ClientAvatar, facing: Facing, wx: number, wy: number, depth: number, now: number): void {
    const d = this.m.sprites['chars/parrot'];
    if (!a.pub.parrot || !d) {
      if (v.parrot) {
        v.parrot.destroy();
        v.parrot = null;
        v.parrotKey = '';
      }
      return;
    }
    const anim = this.parrotAnim(a.pub.parrotColor);
    if (!v.parrot) {
      v.parrot = this.rig.world(this.add.sprite(0, 0, d.atlas, d.frame)).setOrigin(...originOf(d));
      v.parrotKey = '';
    }
    if (anim && v.parrotKey !== anim) {
      v.parrotKey = anim;
      v.parrot.clearTint();
      v.parrot.play({ key: anim, startFrame: Math.floor(hash01(a.seed) * 4) });
    }
    // it hovers beside the head on the far shoulder: behind the body when walking away, mirrored so it always looks toward its owner
    const side = facing === 'W' ? 1 : -1;
    const bob = Math.round(Math.sin(now / 420 + a.seed) * 1.5);
    v.parrot.setPosition(wx + side * avatarPx(9), wy - avatarPx(14) + bob);
    v.parrot.setFlipX(side === 1);
    v.parrot.setDepth(facing === 'N' ? depth - 0.05 : depth + 0.05);
  }

  /**
   * Frame ranges baked into `chars/pet_*` (see pets.mjs). The manifest's `anims` wins when present.
   * Side poses face east; west is the same strip flipped. Lie-down is the same three facings as sit.
   */
  private petAnims(kind: 'dog' | 'cat'): Record<string, [number, number]> {
    const fromManifest = this.m.images?.[`chars/pet_${kind}`]?.anims;
    const need = ['walkE', 'walkS', 'walkN', 'idleS', 'sitE', 'sitS', 'sitN', 'lieE', 'lieS', 'lieN'] as const;
    if (fromManifest && need.every((k) => fromManifest[k])) return fromManifest;
    return { walkE: [0, 3], walkS: [4, 7], walkN: [8, 11], idleS: [12, 13], sitE: [14, 14], sitS: [15, 15], sitN: [16, 16], lieE: [17, 17], lieS: [18, 18], lieN: [19, 19] };
  }

  private createPetAnims(kind: 'dog' | 'cat'): void {
    if (!this.textures.exists(`pet:${kind}`)) return;
    const fps = this.m.images?.[`chars/pet_${kind}`]?.fps ?? 8;
    for (const [name, range] of Object.entries(this.petAnims(kind))) {
      const key = `anim:pet:${kind}:${name}`;
      if (this.anims.exists(key)) continue;
      const [start, end] = range;
      this.anims.create({ key, frames: this.anims.generateFrameNumbers(`pet:${kind}`, { start, end }), frameRate: name.startsWith('idle') ? 3 : fps, repeat: -1 });
    }
  }

  /** Which strip to play, and whether to mirror it. West reuses the east poses. Idle is the front blink. */
  private petPose(facing: Facing, pose: PetFollow['pose']): { name: string; flip: boolean } {
    const flip = facing === 'W';
    if (pose === 'walk') {
      if (facing === 'N') return { name: 'walkN', flip: false };
      if (facing === 'S') return { name: 'walkS', flip: false };
      return { name: 'walkE', flip };
    }
    if (pose === 'idle') return { name: 'idleS', flip: false };
    const stem = pose === 'lie' ? 'lie' : 'sit';
    if (facing === 'N') return { name: `${stem}N`, flip: false };
    if (facing === 'S') return { name: `${stem}S`, flip: false };
    return { name: `${stem}E`, flip };
  }

  /**
   * Subscriber dog or cat. It walks the owner's breadcrumb trail a couple of tiles behind, at its
   * own speed, and idles once it has caught up. "senta" / "deita" / "vem" are read from chat the
   * owner already sent. The frames are critter-scale (1 art px per world px), so they are not given
   * the people's extra draw scale.
   *
   * The sprite is not a hit target. Clicks are resolved from avatar and NPC boxes, and the pet is
   * never added to that list, so it cannot take a click meant for the player or a neighbour.
   */
  private updatePet(v: AvatarView, a: ClientAvatar, wx: number, wy: number, dt: number): void {
    const kind = a.pub.pet === 'dog' || a.pub.pet === 'cat' ? a.pub.pet : null;
    const heard = petCommandFromLines(
      a.bubbles,
      v.petHeard,
      kind ? [PET_COPY[kind].pt, PET_COPY[kind].en, ...(a.pub.petName ? [a.pub.petName] : [])] : [],
    );
    v.petHeard = heard.heardAt;
    if (!kind) {
      if (v.pet) {
        v.pet.destroy();
        v.pet = null;
        v.petKind = '';
        v.petKey = '';
      }
      if (Number.isFinite(v.petFollow.x)) v.petFollow = createPetFollow();
      return;
    }
    const follow = stepPet(v.petFollow, {
      ownerX: wx,
      ownerY: wy,
      ownerMoving: v.moving,
      place: this.roomId,
      dt,
      command: heard.command,
    });
    const pose = this.petPose(follow.facing, follow.pose);
    const anim = `anim:pet:${kind}:${pose.name}`;
    if (!this.anims.exists(anim)) {
      v.pet?.setVisible(false);
      return;
    }
    if (!v.pet || v.petKind !== kind) {
      v.pet?.destroy();
      v.pet = this.rig.world(this.add.sprite(0, 0, `pet:${kind}`, 0)).setOrigin(0.5, 1);
      v.pet.disableInteractive();
      v.petKind = kind;
      v.petKey = '';
    }
    if (v.petKey !== anim) {
      v.petKey = anim;
      v.pet.play({ key: anim, startFrame: 0 });
    }
    v.pet.setVisible(v.sprite.visible);
    v.pet.setPosition(Math.round(follow.x), Math.round(follow.y));
    v.pet.setFlipX(pose.flip);
    v.pet.setDepth(standingDepth(follow.y, `${a.pub.id}:pet`));
    v.pet.setScale(1);
  }

  /**
   * Snack, drink, or empty in the hand (session `carry`), and what a change of it looks like (`carryFx.ts`): Comer / Beber raise the item to
   * the mouth for three bites or sips before the empty comes back down; Jogar fora throws it, into a lixeira in reach or onto the ground.
   */
  private updateCarry(v: AvatarView, a: ClientAvatar, facing: Facing, wx: number, wy: number, depth: number): void {
    const key = carryOf(a.pub.carry) ? a.pub.carry! : '';
    if (key !== v.carryKey) this.carryChanged(v, a, key, facing, wx, wy, depth);
    const side = facing === 'W' ? -1 : 1;
    const hand = { x: wx + side * avatarPx(6), y: wy - avatarPx(7) };
    const mouth = { x: wx + side * avatarPx(3), y: wy - avatarPx(13) };
    const at = (k: number) => ({ x: hand.x + (mouth.x - hand.x) * k, y: hand.y + (mouth.y - hand.y) * k });
    const base = 0.6 * avatarDrawScale();
    // at the mouth of someone facing away, the item is behind the head
    const front = facing === 'N' ? depth - 0.08 : depth + 0.08;
    const beat = v.carryBeat;
    if (beat) {
      const ms = this.time.now - beat.t0;
      const pose = beatPose(beat.kind, ms, beat.lastMs);
      beat.lastMs = ms;
      v.sprite.y += avatarPx(pose.nod);
      if (!pose.finished) {
        const p = at(pose.lift);
        beat.img.setPosition(p.x, p.y).setScale(base * pose.scale).setAngle(side * pose.angle).setDepth(front);
        if (pose.bite >= 0 && beat.kind === 'eat') this.carryCrumbs(mouth.x, mouth.y + 2, depth, 3);
        v.carry?.setVisible(false);
        return;
      }
      // the last bite or sip: the full item is gone, the empty (if any) comes back down to the hand
      if (beat.img.active) beat.img.destroy();
      if (ms < CARRY_BEAT_MS && v.carry) {
        const p = at(pose.lift);
        v.carry.setVisible(true).setPosition(p.x, p.y).setScale(base).setAngle(0).setDepth(front);
        return;
      }
      v.carryBeat = null;
    }
    if (!v.carry) return;
    const age = this.time.now - v.carryPop;
    const bump = age >= 0 && age < 320 ? Math.sin((age / 320) * Math.PI) : 0;
    v.carry.setVisible(true).setPosition(hand.x, hand.y - bump * 5).setScale(base * (1 + 0.28 * bump)).setAngle(0).setDepth(depth + 0.08);
  }

  /** The held item changed on the wire: start the beat it reads as (`carryMove`) and put the new item, if any, in the hand. */
  private carryChanged(v: AvatarView, a: ClientAvatar, key: string, facing: Facing, wx: number, wy: number, depth: number): void {
    const prevKey = v.carryKey;
    const old = v.carry;
    v.carry = null;
    v.carryKey = key;
    if (v.carryBeat) {
      if (v.carryBeat.img.active) v.carryBeat.img.destroy();
      v.carryBeat = null;
    }
    // finger food leaves nothing either way: your own Comer / Jogar fora tells the two apart
    const intent = a.pub.id === game.room?.selfId && game.carryIntent && performance.now() - game.carryIntent.at < 5000 ? game.carryIntent.action : null;
    const move = old ? carryMove(prevKey, key, intent) : 'swap';
    const beat = (move === 'eat' || move === 'drink') && !reducedMotion();
    if (move === 'eat' || move === 'drink') this.carrySound(a, prevKey);
    if (key) {
      const tex = `carry:${carryOf(key)!.tex}`;
      if (this.textures.exists(tex)) {
        v.carry = this.rig.world(this.add.image(0, 0, tex)).setOrigin(0.5, 1).setVisible(!beat);
        // the pop plays when it lands in the hand
        v.carryPop = this.time.now + (beat ? CARRY_BEAT_MS : 0);
      }
    }
    if (!old) return;
    if (beat) {
      v.carryBeat = { kind: move, t0: this.time.now, lastMs: -1, img: old };
      return;
    }
    if (move === 'toss') {
      this.tossCarry(old, facing, wx, wy);
      return;
    }
    if (move === 'eat' || carryOf(prevKey)?.kind === 'food') this.carryCrumbs(old.x, old.y, depth);
    old.destroy();
  }

  /** The bites or sips of a Comer / Beber (`carrySfx.ts`), timed to the beat; played with reduced motion too, where the beat is skipped. */
  private carrySound(a: ClientAvatar, prevKey: string): void {
    const kind = carrySfxFor(prevKey);
    const me = game.self?.pub;
    if (!kind || !game.sound || !me) return;
    const self = a.pub.id === me.id;
    const gain = carrySfxGain(self, Math.hypot(a.pub.x - me.x, a.pub.y - me.y));
    if (gain > 0) ambience.sfx(kind, gain);
  }

  /** Jogar fora: an arc into the lixeira in reach (the bin bounces as it lands), else onto the ground a step ahead, where it hops and fades. */
  private tossCarry(img: Phaser.GameObjects.Image, facing: Facing, wx: number, wy: number): void {
    const from = { x: img.x, y: img.y };
    const i = binInReach({ x: Math.floor(wx / T), y: Math.floor((wy - 1) / T) }, this.bins);
    const bin = i >= 0 ? this.bins[i]! : null;
    const to = bin ? { x: bin.sprite.x, y: bin.mouthY + 3 } : groundSpot({ x: wx, y: wy }, facing, T * 1.2);
    const h = bin ? 14 + Math.abs(to.x - from.x) * 0.15 : 9;
    const scale = img.scaleX;
    const spin = (to.x >= from.x ? 1 : -1) * (bin ? 300 : 400);
    const lift = img.depth;
    const p = { t: 0 };
    img.setAngle(0);
    this.tweens.add({
      targets: p,
      t: 1,
      duration: bin ? 440 : 380,
      ease: 'Linear',
      onUpdate: () => {
        const q = arcPoint(from, to, h, p.t);
        img.setPosition(q.x, q.y).setAngle(spin * p.t).setScale(scale * (1 - 0.2 * p.t));
        // over the bin on the way up, into its mouth (behind the front of the can) on the way down
        if (bin) img.setDepth(p.t > 0.72 ? bin.sprite.depth - 0.01 : Math.max(lift, bin.sprite.depth + 0.01));
        else img.setDepth(Math.max(lift, standingDepth(q.y + 2, 'toss')));
      },
      onComplete: () => {
        if (!img.active) return;
        if (bin) {
          img.destroy();
          this.binBounce(bin.sprite, bin.mouthY);
        } else this.landOnGround(img, scale * 0.8);
      },
    });
  }

  /** The lixeira takes it: a squash and stretch from its feet and a little puff out of the mouth. */
  private binBounce(bin: Phaser.GameObjects.Sprite, mouthY: number): void {
    this.carryCrumbs(bin.x, mouthY, bin.depth, 3, [0xf8f8f8, 0xd8d0e0], -8);
    if (bin.getData('bounce')) return;
    bin.setData('bounce', true);
    const sx = bin.scaleX;
    const sy = bin.scaleY;
    this.tweens.chain({
      targets: bin,
      tweens: [
        { scaleX: sx * 1.12, scaleY: sy * 0.84, duration: 70, ease: 'Quad.easeOut' },
        { scaleX: sx * 0.94, scaleY: sy * 1.1, duration: 110, ease: 'Quad.easeOut' },
        { scaleX: sx, scaleY: sy, duration: 220, ease: 'Bounce.easeOut' },
      ],
      onComplete: () => {
        bin.setScale(sx, sy);
        bin.setData('bounce', false);
      },
    });
  }

  /** A toss with no lixeira in reach: it lands, hops once in a puff of dust, lies there a moment and fades. */
  private landOnGround(img: Phaser.GameObjects.Image, scale: number): void {
    const y = img.y;
    img.setDepth(standingDepth(y, 'toss'));
    this.carryCrumbs(img.x, y, img.depth, 4, [0xd8d0c4, 0xb7aa96], 0);
    this.tweens.chain({
      targets: img,
      tweens: [
        { y: y - 4, angle: img.angle + 40, duration: 120, ease: 'Quad.easeOut' },
        { y, angle: img.angle + 70, duration: 120, ease: 'Quad.easeIn' },
        { alpha: 0, scale: scale * 0.6, duration: 480, delay: 420, ease: 'Quad.easeIn' },
      ],
      onComplete: () => {
        if (img.active) img.destroy();
      },
    });
  }

  /** A few 2 px bits flying out: crumbs off a bite (falling), dust from a landing (`fall` 0), a puff out of a bin (rising). */
  private carryCrumbs(x: number, y: number, depth: number, n = 5, colors = [0xe6c07b, 0xc48a4a, 0xf2e2c4], fall = 12): void {
    for (let i = 0; i < n; i++) {
      const c = this.rig.world(this.add.rectangle(x, y, 2, 2, colors[i % colors.length]!)).setDepth(depth + 0.2);
      const spread = i - (n - 1) / 2;
      this.tweens.add({
        targets: c,
        x: x + spread * 7,
        y: y + fall + (i % 3) * (fall < 0 ? -2 : 3),
        alpha: 0,
        duration: 360 + i * 30,
        ease: 'Quad.easeOut',
        onComplete: () => {
          if (c.active) c.destroy();
        },
      });
    }
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

  /**
   * Show the tap marker (tapMark.ts) for a tap on `tile`, or at a world point off the walkable map (a refused tap on the town around it).
   * The ring circles where the feet will stand. Both it and the refused cross draw over the world, so a prop in front never hides them.
   */
  markTap(kind: TapCue, at: { tile: { x: number; y: number } } | { wx: number; wy: number }): void {
    const p = 'tile' in at ? { wx: (at.tile.x + 0.5) * T, wy: (at.tile.y + 1) * T - 4 } : at;
    // a steer onto the same tile keeps the ring as it is (no restart every move of the finger)
    if (kind === 'steer' && this.tap && 'tile' in at && this.tap.tile?.x === at.tile.x && this.tap.tile?.y === at.tile.y && this.tap.kind !== 'refused') return;
    this.tap = { kind, wx: Math.round(p.wx), wy: Math.round(p.wy), t0: performance.now(), tile: 'tile' in at ? at.tile : null };
  }

  private updateTap(now: number): void {
    const tap = this.tap;
    const img = this.tapImg;
    if (!tap || game.modalOpen) {
      if (img.visible) img.setVisible(false);
      if (tap && game.modalOpen) this.tap = null;
      return;
    }
    const t = (now - tap.t0) / 1000;
    const me = game.self ? this.avatars.get(game.self.pub.id) : undefined;
    // done: standing on the tile, or standing anywhere a second after the tap (the server found no path, or the walk was cut short); a new tap
    // replaces the marker anyway. The second covers the round trip before the walk starts.
    const arrived = !!tap.tile && !!me && !me.moving && ((Math.abs(me.wx - tap.wx) < T && Math.abs(me.wy - tap.wy) < T) || t > 1);
    const f = tapFrame(tap.kind, t, arrived, this.fxLevel.reduced);
    if (!f) {
      this.tap = null;
      img.setVisible(false);
      return;
    }
    const tex = this.tapTexture(tap.kind, f.radius);
    // an Image, not live Graphics: images are rounded to the device px grid with the camera, Graphics blurred over two px at half-px scrolls.
    // Over the world, like the hover square: on the ground the ring hid behind the bench or stall in front of the tile, just where it mattered
    img
      .setTexture(tex.key)
      .setPosition(tap.wx + f.shake - tex.ox, tap.wy - tex.oy)
      .setAlpha(f.alpha)
      .setDepth(tap.kind === 'refused' ? 49001 : 48999)
      .setVisible(true);
  }

  /** The baked marker art for a kind and ring radius: 1 art px per texel, with a dark edge so it reads on pale calçada and dark asphalt. */
  private tapTexture(kind: TapCue, radius: number): { key: string; ox: number; oy: number } {
    const refused = kind === 'refused';
    const color = TAP_COLORS[kind];
    const key = refused ? 'tap:cross' : `tap:ring:${color.toString(16)}:${radius}`;
    const px = refused ? CROSS_PIXELS : ringPixels(radius);
    let ox = 0;
    let oy = 0;
    for (const [x, y] of px) {
      ox = Math.max(ox, -x + 1);
      oy = Math.max(oy, -y + 1);
    }
    if (!this.textures.exists(key)) {
      const g = this.make.graphics({}, false);
      let w = 0;
      let h = 0;
      for (const [x, y] of px) {
        w = Math.max(w, x + ox + 2);
        h = Math.max(h, y + oy + 2);
      }
      if (refused) {
        g.fillStyle(0x2a1a1a, 0.7);
        for (const [x, y] of px) g.fillRect(x + ox - 1, y + oy - 1, 3, 3);
      } else {
        // a drop shadow one px down
        g.fillStyle(0x1d1b26, 0.45);
        for (const [x, y] of px) g.fillRect(x + ox, y + oy + 1, 1, 1);
      }
      g.fillStyle(color, 1);
      for (const [x, y] of px) g.fillRect(x + ox, y + oy, 1, 1);
      g.generateTexture(key, w, h);
      g.destroy();
    }
    return { key, ox, oy };
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

  /** The order rail on the padaria counter is still until Correria no Balcão is open, then its tickets flutter. */
  private updateTrilho(): void {
    const t = this.trilho;
    if (!t) return;
    const open = correriaFeed.active;
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
      stacks.push({ key: 'stall:closed', x: p.px, y: p.py, plate: { text: 'Fechado · volta às 8h', gloss: 'Closed · back at 8 am', kind: 'npc' }, bubbles: [] });
    }
    // the feira's banner says it is closed outside 06:00-13:00
    if (this.feiraStalls.length && !feiraOpen(clock.minutes())) {
      const b = def.props.find((q) => q.id === 'feira_livre');
      if (b) {
        const p = at((b.x + (b.w ?? 1) / 2) * T, b.y * T - 22);
        stacks.push({ key: 'feira:closed', x: p.px, y: p.py, plate: { text: 'Feira fechada · volta às 6h', gloss: 'Market closed · back at 6 am', kind: 'npc' }, bubbles: [] });
      }
    }
    // recado markers: "!" over a neighbour with an errand for you, "?" over the one your current step is with
    const markers = npcMarkers(game.board, declinedOffers);
    for (const [id, v] of this.avatars) {
      const a = game.avatars.get(id);
      if (!a) continue;
      if (id === selfId && (boutFeed.active || correriaFeed.active)) continue; // the pair sprite / the counter is the player now
      const p = at(v.wx, v.wy - avatarCrown(v.sitting, lookHeadLift(v.look)));
      if (a.pub.npc) {
        // a neighbour: terracotta plate with the role, and its own bubbles (idle lines are keyed by NPC id)
        const b = game.npcBubbles.get(a.pub.npc);
        const age = b ? now - b.at : Infinity;
        const role = npcDefById(a.pub.npc)?.role.pt;
        stacks.push({
          key: `npc:${a.pub.npc}`,
          x: p.px,
          y: p.py,
          z: Math.round(p.py),
          // the mat camera keeps the pair and the scoreboard clear: neighbours' plates wait until the bout is over (their bubbles still talk)
          plate: boutFeed.camera
            ? null
            : { text: role && game.hoverKey === `npc:${a.pub.npc}` ? `${a.pub.name} · ${role}` : a.pub.name, kind: 'npc', ...(markers.has(a.pub.npc) ? { marker: markers.get(a.pub.npc) } : {}) },
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
            .map((b) => ({
              text: b.text,
              gloss: b.gloss,
              alpha: bubbleAlpha(now - b.at),
              ...(a.pub.bubbleStyle && a.pub.bubbleStyle !== 'classic' ? { style: a.pub.bubbleStyle } : {}),
            }));
      // CPUs are scenery: their name shows on hover, within ~3.5 tiles of you, or while they emote
      const near = !!selfView && Math.hypot(v.wx - selfView.wx, v.wy - selfView.wy) <= 3.5 * T;
      const cpuShow = !boutFeed.camera && (!isCpuId(id) || game.hoverKey === `av:${id}` || near || (!!a.emote && performance.now() - a.emote.t0 < 3500));
      stacks.push({
        key: `av:${id}`,
        x: p.px,
        y: p.py,
        z: Math.round(p.py),
        plate: {
          text: a.pub.name,
          kind: id === selfId ? 'me' : 'player',
          show: cpuShow,
          ...(a.pub.academyGi ? { mark: CRESTS[a.pub.academyGi.stamp].glyph } : {}),
          ...(a.pub.founder ? { founder: true } : {}),
          ...(a.pub.founderBadge ? { subBadge: true } : {}),
          ...(a.pub.feiraCrown || game.feiraCrownId === id ? { feiraCrown: true } : {}),
          ...(!isCpuId(id) && a.pub.nameplate ? { tier: a.pub.nameplate } : {}),
          ...(a.pub.belt ? { belt: a.pub.belt } : {}),
          ...(id === selfId && a.pub.belt && game.profile ? { stripes: normalizeBjj(game.profile.bjj).stripes } : {}),
        },
        bubbles,
      });
      // Collar tag: follows the pet sprite (already depth-sorted in the world) and hides with it.
      const petName = a.pub.petName;
      if (petName && v.pet?.visible) {
        const lift = v.petFollow.pose === 'lie' ? 14 : 22;
        const tag = at(v.pet.x, v.pet.y - lift);
        stacks.push({
          key: `pet:${id}`,
          x: tag.px,
          y: tag.py,
          z: Math.round(tag.py),
          plate: { text: petName, kind: 'pet' },
          bubbles: [],
        });
      }
    }
    // a player-owned padaria: its name in chalk on the blackboard (Seu Carlos's board stays plain)
    const own = game.room?.padaria;
    const lousa = own ? northDecor(def).find((d) => d.kind === 'lousa') : undefined;
    if (own && lousa) {
      const p = at(((lousa.from + lousa.to) / 2) * T, -17);
      stacks.push({ key: `sign:${own.id}`, x: p.px, y: p.py, plate: { text: own.name, kind: 'sign' }, bubbles: [] });
    }
    // a player academy: its crest and name on a plate over the crest board
    const team = game.room?.room === 'andar' ? game.room.academy : undefined;
    const board = team ? def.props.find((q) => q.id === 'andar_brasao') : undefined;
    if (team && board) {
      const p = at((board.x + 0.5) * T, -16);
      stacks.push({ key: `sign:academy:${team.id}`, x: p.px, y: p.py, plate: { text: `${CRESTS[team.crest].glyph} ${team.name}`, kind: 'sign' }, bubbles: [] });
    }
    // wayfinding: a tag over every way out, destination in PT over EN (glowing on a first visit); not while a bout has the mat camera
    if (!boutFeed.camera) {
      let tags = DOOR_TAGS.get(def);
      if (!tags) DOOR_TAGS.set(def, (tags = doorTagsFor(def)));
      const kind = doorsFresh() ? 'doorNew' : 'door';
      for (const t of tags) {
        const w = tileToWorld(t.x, t.y);
        const p = at(w.wx, w.wy - 22);
        stacks.push({ key: `door:${t.key}`, x: p.px, y: p.py, z: Math.round(p.py), plate: { text: t.pt, gloss: t.en, kind }, bubbles: [] });
      }
    }
    const guides: GuideItem[] = this.host.guides().map((g, i) => {
      const w = tileToWorld(g.x, g.y);
      const lift = Math.min(48, Math.max(12, g.lift * 0.3));
      const p = at(w.wx, w.wy - lift);
      const floor = at(w.wx, w.wy);
      return { key: `g${i}`, x: p.px, y: p.py, label: g.label, en: g.en, kind: g.kind, first: g.first, floor: { x: floor.px, y: floor.py, tile: (T * k.zoom) / k.dpr } };
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

  /** Frame names of the sprites built for this room (e2e: the game cart and its sign). */
  drawnFrames(): string[] {
    const out: string[] = [];
    for (const o of this.roomObjs) {
      const spr = o as { frame?: { name?: string }; visible?: boolean };
      if (spr.visible === false) continue;
      if (typeof spr.frame?.name === 'string') out.push(spr.frame.name);
    }
    return out;
  }

  info() {
    return { zoom: this.cam.zoom, cssScale: this.cssScale, cx: this.cam.cx, cy: this.cam.cy, room: this.roomId, avatars: this.avatars.size, sheets: this.sheets.size, artMissing: this.artMissing, bout: this.stage.info(), counter: this.counter.info() };
  }
}

/** Quick fade in, then fully opaque until the bubble is removed at 7 s: a bubble is never see-through (the old 700 ms fade-out read as a ghost). */
function bubbleAlpha(age: number): number {
  return Math.max(0, Math.min(1, age / 120));
}
