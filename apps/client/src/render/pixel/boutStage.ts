/**
 * The bout in the world (Phaser side). Everything happens on the academia mat, no modal:
 *  - the two fighters are one pair sprite at the mat centre (`bjj/pair_<pos>_n`, palette-swapped to the player's look and the partner's),
 *    with transition clips when the position changes, the tap, the raised hand and the fist bump;
 *  - they walk onto the mat on the character sheets, face off, bump fists, and Bia calls "Combate!";
 *  - Professora Bia (the real NPC) swaps to her referee frame while she calls points;
 *  - the bleacher spectators pop 👏 🔥 😮 and short shouts; dust puffs, sweat sparkles, hit-stop and a camera nudge sell the scrambles;
 *  - the mat scoreboard (`props/placar`) shows the live numbers in DOM cells.
 * It reads `boutFeed` (written by ui/bout.ts); missing art is a magenta box and a note in `artMissing` (HOWTO 5.10).
 */
import Phaser from 'phaser';
import { HAIR_COLORS, SKIN_TONES, cpuLook, formatBoutClock, type Appearance, type BjjPositionId, type CrowdCue, CROWD, type RefSignal } from '@tudobem/shared';
import { game } from '../../state';
import type { Manifest, SpriteDef } from './manifest';
import { animKey } from './charsheet';
import { lookForAppearance, type Look } from './looks';
import { boutFeed, type StageCue } from './boutFeed';
import { cartoonFor, sampleCartoon, type Cartoon, type CartoonRead } from './gagCartoon';
import { DEPTH } from './props';
import { originOf } from './spriteUtil';
import {
  FRAMES,
  MATCH_ATLAS,
  PAIR_SIZE,
  PLACAR_CELLS,
  PLACAR_KEY,
  colorsSig,
  faceOffKey,
  finishTapKey,
  fistbumpKey,
  pairFrames,
  pairSwap,
  partnerGi,
  presentFrames,
  refKey,
  refTable,
  topSide,
  transFrames,
  winRaiseKey,
  type PairColors,
  type RefArt,
} from './bjjArt';
import { CLIP_FRAMES, IMPACT, LAND, SLAM_FAMILIES, clipDef, clipFrameAt, clipKey, standGrip, standKey, STAND_FRAMES, type ClipDef } from './bjjClips';
import { applySwap, type PairSwap } from './bjjSwap';

type Mode = 'off' | 'walkin' | 'face' | 'bump' | 'fight' | 'trans' | 'cartoon' | 'clip' | 'finish' | 'win' | 'draw';

/** A baked move clip in progress (bjjClips.ts): the mover is art slot A, the frames may be mirrored so the partner stays on the right. */
interface ClipRun {
  def: ClipDef;
  keys: string[];
  hit: boolean;
  actor: 'you' | 'partner';
  flip: boolean;
  /** the finishing move: the big frame and the landing hang in slow motion */
  slow: boolean;
  to: BjjPositionId;
  aheadTo: 'you' | 'partner' | null;
  t0: number;
  ms: number;
  shown: number;
  /**
   * Tatame v3: the clip is driven by the taps. While `driven`, the wind-up frame (0–3) only moves on a `step` cue (or by itself over
   * `autoMs`, the partner's wind-up) and the clip never ends; a `land` cue then plays from `landFrom` to the last frame over `ms`.
   */
  driven?: boolean;
  autoMs?: number;
  landFrom?: number;
  /** the miss clip's keys, swapped in when a driven move does not land */
  missKeys?: string[];
}

export interface StageHost {
  scene: Phaser.Scene;
  world: <G extends Phaser.GameObjects.GameObject>(o: G) => G;
  manifest: Manifest;
  noteMissing: (key: string) => void;
  acquireSheet: (look: Look) => string;
  releaseSheet: (key: string) => void;
  /** the player's own appearance (the local avatar) */
  playerAppearance: () => Appearance | null;
  /** Professora Bia's avatar view, to swap her for the referee during a match */
  bia: () => { sprite: Phaser.GameObjects.Sprite; shadow?: Phaser.GameObjects.GameObject & { setVisible(v: boolean): unknown }; wx: number; wy: number; depth: number } | null;
  /** load a lazy atlas of the manifest (the match frames); `done` runs once it is in the texture manager */
  loadAtlas: (name: string, done: () => void) => void;
  /** world px of the head of every spectator that can cheer */
  crowd: () => { id: string; x: number; y: number }[];
  mat: () => { x: number; y: number; x0: number; x1: number } | null;
  placar: () => { wx: number; wy: number } | null;
  toCanvas: (wx: number, wy: number) => { px: number; py: number };
  cssScale: () => number;
  reduced: () => boolean;
  /** the screenshots hook: play the intro instantly */
  instant: () => boolean;
}

const hash01 = (n: number) => {
  let h = Math.imul(n | 0, 0x9e3779b1) ^ 0x85ebca6b;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return ((h ^ (h >>> 12)) >>> 0) / 4294967296;
};

/** Art px the pair stands below the mat centre (the frame is 42 tall: its middle lands near the mat's middle). */
const PAIR_DROP = 18;
const REF_SHOW_MS = 1500;
/** World px between the mat's east edge and the referee's feet (her frame is 16 wide: she stands clear of the mat's border). */
const REF_GAP = 14;
const HITSTOP_MS = 80;
/** How fast the dust moves during the finishing move's slow-motion beat. */
const SLOW_PARTICLES = 0.3;
const CROWD_MS = 1500;
const FLASH_MS = 90;
const WORD_MS = 1300;

/**
 * Where a held grip sits on the standing pair, art px from the pair's anchor (bottom centre). In the standing frame the player (white gi)
 * is on the left and the partner (blue gi) on the right, so your collar grip is on their lapel and their sleeve grip is on your arm.
 */
const GRIP_SPOT: Record<'you' | 'partner', Record<'collar' | 'sleeve', { x: number; y: number }>> = {
  you: { collar: { x: 3, y: -19 }, sleeve: { x: 7, y: -13 } },
  partner: { collar: { x: -4, y: -19 }, sleeve: { x: -8, y: -13 } },
};
/** Art px a fighter's word pops sit beside the pair's middle (the player on the left). */
const WORD_SIDE = 14;

interface Particle {
  r: Phaser.GameObjects.Rectangle;
  vx: number;
  vy: number;
  life: number;
  max: number;
  g: number;
}

export class BoutStage {
  private mode: Mode = 'off';
  private epoch = -1;
  private pos: BjjPositionId = 'de_pe';
  private top: 'you' | 'partner' | null = null;
  private frames: string[] = [];
  private fps = 5;
  private loop = true;
  private t = 0;
  private modeEnd = 0;
  private holdUntil = 0;
  private nudge = { x: 0, y: 0 };
  private nowMs = 0;

  private pair: Phaser.GameObjects.Sprite | null = null;
  private ph: Phaser.GameObjects.Rectangle | null = null;
  private shadow: Phaser.GameObjects.Image | null = null;
  private walkers: { you: Phaser.GameObjects.Sprite; partner: Phaser.GameObjects.Sprite; keys: string[]; from: { x: number; y: number }[]; to: { x: number; y: number }[] } | null = null;
  private refSprite: Phaser.GameObjects.Sprite | null = null;
  private refUntil = 0;
  private refHidden: { sprite: Phaser.GameObjects.Sprite; shadow?: { setVisible(v: boolean): unknown } } | null = null;
  private particles: Particle[] = [];
  private textures: string[] = [];
  private scratch: HTMLCanvasElement | null = null;
  private introMs = 0;
  private sweatAt = 0;
  /** 1 → 0 while a pose change without transition art slides into place, so the swap is not a cut. */
  private slide = 0;
  /** 1 → 0 while a miss stumbles and returns to the same pose. */
  private wobble = 0;
  /** The gag cartoon in progress. The pose stays on `from` until it lands. */
  private cartoon: Cartoon | null = null;
  private cartoonFrom: BjjPositionId = 'de_pe';
  private cartoonAheadTo: 'you' | 'partner' | null = null;
  private cartoonT0 = 0;
  private cartoonMs = 760;
  private cartoonOff = { x: 0, y: 0, rot: 0 };
  private cartoonRead: CartoonRead | null = null;
  private cartoonPuffed = false;
  /** How far a pose change slides. A gag that gained ground travels farther than an ordinary step. */
  private slideAmp = 14;
  private wobbleAmp = 5;

  private popsEl: HTMLElement | null = null;
  /** live cheers: they stay glued to the spectator's head while the camera settles */
  private pops: { el: HTMLElement; wx: number; wy: number; until: number }[] = [];
  private placarEl: HTMLElement | null = null;
  private placarSig = '';
  private placarCells: Record<string, HTMLElement> = {};
  /** The pair glows white until then (a big hit, a blocked attack). */
  private flashUntil = 0;
  /** The held-grip hands on the standing pair, one per fighter and grip. */
  private gripHands = new Map<string, Phaser.GameObjects.Rectangle>();
  /** Where the pair was last drawn (its anchor plus the slide, wobble or lean), so the grip hands stay on the gis. */
  private drawnAt = { x: 0, y: 0 };
  /** The pair is drawn mirrored: after a takedown or a sweep that landed the other way, until the fighters stand again. */
  private flip = false;
  /** The move clip on screen, and the slot-A person of the frames on screen when a clip set them (null: the idle rule). */
  private clip: ClipRun | null = null;
  private clipActor: 'you' | 'partner' | null = null;
  /** The match atlas (the clips and the standing grip loops): loaded when a match starts. */
  private matchAtlas: 'none' | 'loading' | 'ready' = 'none';
  /** Particles crawl until then (the slow-motion beat of the finishing move). */
  private slowUntil = 0;

  constructor(private readonly h: StageHost) {}

  /** true while the bout owns the mat (the camera zooms in, the player's own avatar is hidden) */
  get active(): boolean {
    return boutFeed.active;
  }

  /** whole art px the camera is shoved this frame (hit-stop kick); zero under reduced motion */
  cameraNudge(): { x: number; y: number } {
    return this.nudge;
  }

  // ------------------------------------------------------------------ textures
  private readPixels(d: SpriteDef): ImageData | null {
    const t = this.h.scene.textures.get(d.atlas);
    if (!t || t.key === '__MISSING') return null;
    const f = t.get(d.frame);
    if (!f || (f.name === '__BASE' && d.frame !== '__BASE')) return null;
    const src = f.source.image as CanvasImageSource | undefined;
    if (!src) return null;
    this.scratch ??= document.createElement('canvas');
    const c = this.scratch;
    c.width = f.realWidth;
    c.height = f.realHeight;
    const g = c.getContext('2d', { willReadFrequently: true });
    if (!g) return null;
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(src, f.cutX, f.cutY, f.cutWidth, f.cutHeight, f.x, f.y, f.cutWidth, f.cutHeight);
    return g.getImageData(0, 0, c.width, c.height);
  }

  /** Texture name of a manifest frame with `swap` applied (built once per palette signature), or null when the art is missing. */
  private tex(key: string, swap: PairSwap, sig: string): string | null {
    const d = this.h.manifest.sprites[key];
    if (!d) {
      this.h.noteMissing(key);
      return null;
    }
    const name = `bjj:${sig}:${key}`;
    if (this.h.scene.textures.exists(name)) return name;
    const px = this.readPixels(d);
    if (!px) return null;
    applySwap(px.data, swap);
    const c = document.createElement('canvas');
    c.width = px.width;
    c.height = px.height;
    c.getContext('2d')?.putImageData(px, 0, 0);
    this.h.scene.textures.addCanvas(name, c);
    this.textures.push(name);
    return name;
  }

  private colors(top: 'you' | 'partner' | null): PairColors | null {
    const a = this.h.playerAppearance();
    const p = boutFeed.partner;
    if (!a || !p) return null;
    const fighter = (ap: Appearance) => ({
      skin: SKIN_TONES[ap.skin] ?? SKIN_TONES[3]!,
      hair: HAIR_COLORS[ap.hairColor] ?? HAIR_COLORS[0]!,
      style: ap.hair,
      beard: ap.extra === 'barba',
    });
    return { you: fighter(a), partner: fighter(p.appearance), belt: boutFeed.belt, partnerBelt: p.belt ?? boutFeed.belt, partnerGi: partnerGi(p.id), top };
  }

  /** Start loading the match atlas (once); until it is in, the idle frames and the old lean stand in for the clips. */
  private loadMatchAtlas(): void {
    if (this.matchAtlas !== 'none') return;
    if (this.h.scene.textures.exists(MATCH_ATLAS)) {
      this.matchAtlas = 'ready';
      return;
    }
    if (!this.h.manifest.atlases[MATCH_ATLAS]) return;
    this.matchAtlas = 'loading';
    this.h.loadAtlas(MATCH_ATLAS, () => {
      this.matchAtlas = this.h.scene.textures.exists(MATCH_ATLAS) ? 'ready' : 'none';
    });
  }

  /** Every key is in the manifest and its atlas is loaded. */
  private haveAll(keys: readonly string[]): boolean {
    return keys.every((k) => {
      const d = this.h.manifest.sprites[k];
      return !!d && (d.atlas !== MATCH_ATLAS || this.matchAtlas === 'ready');
    });
  }

  // ------------------------------------------------------------------ lifecycle
  private ensureObjects(): void {
    const s = this.h.scene;
    if (!this.pair) {
      this.pair = this.h.world(s.add.sprite(0, 0, '__DEFAULT')).setVisible(false).setOrigin(0.5, 1);
      const sh = this.h.manifest.sprites['fx/shadow_32'];
      if (sh) this.shadow = this.h.world(s.add.image(0, 0, sh.atlas, sh.frame)).setOrigin(...originOf(sh)).setDepth(DEPTH.shadowContact + 1).setVisible(false).setScale(1.45, 1).setAlpha(0.55);
    }
    if (!this.popsEl) {
      this.popsEl = document.createElement('div');
      this.popsEl.id = 'bout-pops';
      this.popsEl.setAttribute('aria-hidden', 'true');
      // `position: fixed` layers paint in DOM order: the cheers go over the world and its labels, under the overlay (#ui)
      const ui = document.getElementById('ui');
      if (ui?.parentElement) ui.parentElement.insertBefore(this.popsEl, ui);
      else document.body.append(this.popsEl);
    }
    if (!this.placarEl) {
      const el = document.createElement('div');
      el.id = 'bout-placar';
      el.setAttribute('aria-hidden', 'true');
      for (const k of Object.keys(PLACAR_CELLS)) {
        const c = document.createElement('div');
        c.className = `pc pc-${k}`;
        el.append(c);
        this.placarCells[k] = c;
      }
      // under the nameplates and bubbles of the world labels, over the canvas
      const labels = document.getElementById('world-labels');
      if (labels?.parentElement) labels.parentElement.insertBefore(el, labels);
      else document.body.append(el);
      this.placarEl = el;
    }
  }

  private start(): void {
    this.ensureObjects();
    this.epoch = boutFeed.epoch;
    this.mode = 'fight';
    this.pos = 'de_pe';
    this.top = null;
    this.frames = [];
    this.nudge = { x: 0, y: 0 };
    this.flip = false;
    this.clipActor = null;
    this.clearCartoon();
    this.pair!.setRotation(0).setScale(1).setVisible(false);
    this.loadMatchAtlas();
    this.showRef(null);
  }

  private stop(): void {
    this.mode = 'off';
    this.clearCartoon();
    this.flip = false;
    this.clipActor = null;
    this.pair?.setRotation(0).setScale(1).setVisible(false);
    this.ph?.setVisible(false);
    this.shadow?.setVisible(false);
    this.killWalkers();
    this.showRef(null);
    for (const p of this.particles) p.r.setVisible(false);
    for (const r of this.gripHands.values()) r.setVisible(false);
    this.flashUntil = 0;
    this.pair?.clearTint();
    for (const n of this.textures) if (this.h.scene.textures.exists(n)) this.h.scene.textures.remove(n);
    this.textures = [];
    this.nudge = { x: 0, y: 0 };
    if (this.popsEl) this.popsEl.replaceChildren();
    this.pops = [];
    if (this.placarEl) this.placarEl.style.display = 'none';
    this.placarSig = '';
  }

  private killWalkers(): void {
    if (!this.walkers) return;
    for (const k of this.walkers.keys) this.h.releaseSheet(k);
    this.walkers.you.destroy();
    this.walkers.partner.destroy();
    this.walkers = null;
  }

  // ------------------------------------------------------------------ per frame
  update(dt: number, nowMs: number): void {
    this.nowMs = nowMs;
    if (!boutFeed.active) {
      if (this.mode !== 'off') this.stop();
      this.updatePlacar(false);
      return;
    }
    const mat = this.h.mat();
    if (!mat) return;
    if (this.epoch !== boutFeed.epoch) this.start();
    for (const c of boutFeed.drain()) this.onCue(c, mat);
    const hold = nowMs < this.holdUntil;
    this.nudge = this.h.reduced() ? { x: 0, y: 0 } : { x: Math.round(this.nudge.x * 0.6), y: Math.round(this.nudge.y * 0.6) };
    this.advance(hold ? 0 : dt, mat);
    this.updateRef(mat);
    this.updateParticles(nowMs < this.slowUntil ? dt * SLOW_PARTICLES : dt);
    this.updateSweat(dt, mat);
    this.updatePops(nowMs);
    this.updateGrips(mat);
    this.updatePlacar(true);
  }

  private anchor(mat: { x: number; y: number }): { x: number; y: number } {
    return { x: Math.round(mat.x), y: Math.round(mat.y + PAIR_DROP) };
  }

  /** The fighters' colours for the current frame family. */
  private pairColors(): { c: PairColors; sig: string; swap: PairSwap } | null {
    // a clip's frames (and the tap loop after a finish) carry the mover in slot A; the idle frames the one on top
    const c = this.colors(this.clipActor ?? this.top);
    if (!c) return null;
    return { c, sig: colorsSig(c), swap: pairSwap(c) };
  }

  private setFrames(keys: string[], fps: number, loop: boolean, t = 0): void {
    this.frames = keys;
    this.fps = fps;
    this.loop = loop;
    this.t = t;
  }

  private advance(dt: number, mat: { x: number; y: number }): void {
    const a = this.anchor(mat);
    const now = this.nowMs;
    // the intro: walkers -> face off -> fist bump -> fight
    if (this.mode === 'walkin') {
      this.stepWalkers(now, a);
      if (now >= this.modeEnd) {
        this.killWalkers();
        this.mode = 'face';
        this.top = null;
        this.setFrames(presentFrames((k) => !!this.h.manifest.sprites[k], Array.from({ length: FRAMES.faceOff }, (_, i) => faceOffKey(i))), 2, true);
        this.modeEnd = now + this.introMs * 0.2;
      }
    } else if (this.mode === 'face' && now >= this.modeEnd) {
      this.mode = 'bump';
      this.setFrames(presentFrames((k) => !!this.h.manifest.sprites[k], Array.from({ length: FRAMES.fistbump }, (_, i) => fistbumpKey(i))), 5, false);
      this.modeEnd = now + this.introMs * 0.26;
      this.puff(a.x, a.y - 14, 4);
    } else if (this.mode === 'bump' && now >= this.modeEnd) this.goFight();
    else if (this.mode === 'trans' && this.isDone()) this.goFight();
    else if (this.mode === 'cartoon') this.stepCartoon(now, a);
    else if (this.mode === 'clip') this.stepClip(now, a);

    // the snapshot is the truth: if the pair is not where the server says (a missed cue, a reconnect), cut to it.
    // While a cartoon is holding, the snapshot is still the pose the move started from.
    const snap = boutFeed.snap;
    if (this.mode === 'fight' && !boutFeed.holding && snap && (snap.position !== this.pos || snap.ahead !== this.top)) {
      this.pos = snap.position;
      this.top = snap.ahead;
      if (this.pos === 'de_pe') this.flip = false;
      this.setFrames(this.idleFrames(), 4, true);
    }
    // standing, the loop follows the grips held (a fist on the lapel, a fist on the sleeve)
    if (this.mode === 'fight' && this.pos === 'de_pe') {
      const want = this.idleFrames();
      if (want[0] !== this.frames[0]) this.setFrames(want, 4, true, this.t);
    }

    // draw the current frame
    if (this.mode === 'walkin') {
      this.pair?.setVisible(false);
      this.ph?.setVisible(false);
      this.shadow?.setVisible(false);
      return;
    }
    if (this.slide > 0) this.slide = Math.max(0, this.slide - dt * 0.7);
    if (this.wobble > 0) this.wobble = Math.max(0, this.wobble - dt * 0.9);
    this.t += dt;
    if (this.mode === 'clip' && this.clip) {
      const c = this.clip;
      this.drawFrame(c.keys[c.shown] ?? c.keys[0]!, a);
      return;
    }
    const keys = this.frames.length ? this.frames : pairFrames(this.pos);
    const n = keys.length;
    const idx = this.loop ? Math.floor(this.t * this.fps) % Math.max(1, n) : Math.min(n - 1, Math.floor(this.t * this.fps));
    this.drawFrame(keys[idx] ?? keys[0] ?? '', a);
  }

  /** The idle loop of the current position: standing, the grips each fighter holds are drawn in (when the match atlas is in). */
  private idleFrames(): string[] {
    if (this.pos === 'de_pe') {
      const g = boutFeed.snap?.grips;
      const you = standGrip(g?.you), them = standGrip(g?.partner);
      const keys = Array.from({ length: STAND_FRAMES }, (_, i) => standKey(you, them, i));
      if (this.haveAll(keys)) return keys;
    }
    return pairFrames(this.pos);
  }

  private isDone(): boolean {
    return !this.loop && this.t * this.fps >= this.frames.length - 0.001;
  }

  private goFight(): void {
    this.mode = 'fight';
    this.clipActor = null;
    this.top = this.top === null && this.pos === 'de_pe' ? null : this.top;
    if (this.pos === 'de_pe') this.flip = false;
    this.setFrames(this.idleFrames(), 4, true);
  }

  private clearCartoon(): void {
    this.clip = null;
    this.cartoon = null;
    this.cartoonOff = { x: 0, y: 0, rot: 0 };
    this.cartoonRead = null;
    this.cartoonPuffed = false;
    this.slide = 0;
    this.slideAmp = 14;
    this.wobble = 0;
    this.wobbleAmp = 5;
  }

  /** Sample the gag. The pose stays put until the cartoon finishes, then a hit slides and a miss wobbles. */
  private stepCartoon(now: number, a: { x: number; y: number }): void {
    const played = this.cartoon;
    if (!played) {
      this.goFight();
      return;
    }
    const u = (now - this.cartoonT0) / this.cartoonMs;
    if (u >= 1) {
      this.landCartoon(played, a);
      return;
    }
    const s = sampleCartoon(played.path, u);
    this.cartoonOff = { x: s.x, y: s.y, rot: s.rot };
    this.pos = s.pose;
    if (!this.cartoonPuffed && u >= 0.36) {
      this.cartoonPuffed = true;
      this.puff(a.x + s.x, a.y - 10, played.read === 'stumble' ? 5 : 8);
      this.kick(played.read === 'gain' ? 2 : 1);
    }
  }

  /**
   * Play the move's baked clip (bjjClips.ts) when there is one and the match atlas is in: the mover is slot A; from standing the clip is
   * mirrored when the partner moves (they stay on the right); on the ground it keeps the pair's current mirroring.
   */
  private startClip(c: Extract<StageCue, { t: 'cartoon' }>, now: number): boolean {
    const def = clipDef(c.move, c.from);
    if (!def || this.matchAtlas !== 'ready') return false;
    const keys = Array.from({ length: CLIP_FRAMES }, (_, i) => clipKey(def.move, def.from, c.hit, i));
    if (!this.haveAll(keys)) return false;
    const actor = c.actor ?? 'you';
    this.clearCartoon();
    this.clip = {
      def,
      keys,
      hit: c.hit,
      actor,
      flip: c.from === 'de_pe' ? actor === 'partner' : this.flip,
      slow: !!c.finale && !this.h.reduced(),
      to: c.to,
      aheadTo: c.aheadTo,
      t0: now,
      ms: Math.max(1, c.ms),
      shown: 0,
    };
    this.clipActor = actor;
    this.mode = 'clip';
    this.pos = c.from;
    return true;
  }

  /** Tatame v3: a move driven by the taps (the clip's wind-up shows, frame by command). False when there is no clip to drive. */
  private startDriven(c: Extract<StageCue, { t: 'windup' }>, now: number): boolean {
    const def = clipDef(c.move, c.from);
    if (!def || this.matchAtlas !== 'ready') return false;
    const keys = Array.from({ length: CLIP_FRAMES }, (_, i) => clipKey(def.move, def.from, true, i));
    const missKeys = Array.from({ length: CLIP_FRAMES }, (_, i) => clipKey(def.move, def.from, false, i));
    if (!this.haveAll(keys)) return false;
    this.clearCartoon();
    this.clip = {
      def,
      keys,
      missKeys: this.haveAll(missKeys) ? missKeys : undefined,
      hit: true,
      actor: c.actor,
      flip: c.from === 'de_pe' ? c.actor === 'partner' : this.flip,
      slow: false,
      to: c.from,
      aheadTo: c.aheadFrom,
      t0: now,
      ms: 1,
      shown: 0,
      driven: true,
      autoMs: c.ms ?? 0,
    };
    this.clipActor = c.actor;
    this.mode = 'clip';
    this.pos = c.from;
    this.top = c.from === 'de_pe' ? null : c.aheadFrom;
    return true;
  }

  /** Step the clip: frame by beat; the grip snap kicks the camera, a landing throws the mat dust, the end hands over to the idle loop. */
  private stepClip(now: number, a: { x: number; y: number }): void {
    const c = this.clip;
    if (!c) return this.goFight();
    if (c.driven) {
      // the wind-up holds on its frame until the next command (or plays by itself over the partner's wind-up)
      if (c.autoMs && c.autoMs > 0) {
        const f = Math.min(3, Math.floor(((now - c.t0) / c.autoMs) * 4));
        if (f > c.shown) {
          c.shown = f;
          if (f === 3) this.kick(1);
        }
      }
      return;
    }
    const u = (now - c.t0) / c.ms;
    if (u >= 1) return this.landClip(c);
    const from = c.landFrom ?? -1;
    const i = from >= 0 ? Math.min(CLIP_FRAMES - 1, from + Math.floor(u * (CLIP_FRAMES - from))) : clipFrameAt(u, c.slow);
    if (i === c.shown) return;
    c.shown = i;
    const side = c.flip ? -1 : 1;
    if (i === IMPACT) {
      this.kick(c.hit ? 2 : 1);
      if (c.slow && c.hit) this.slowUntil = this.nowMs + c.ms * 0.4;
      if (c.def.family === 'grip' || c.def.family === 'posture') this.puff(a.x + side * 6, a.y - 18, c.hit ? 4 : 2);
    }
    if (i === LAND) {
      const slam = c.hit && SLAM_FAMILIES.includes(c.def.family);
      // the mat dust: a wide cloud along the body that hit the mat, a small one for a step or a miss
      if (slam) {
        this.dust(a.x + side * 4, a.y - 2, 26, 16);
        if (!this.h.reduced()) this.holdUntil = now + HITSTOP_MS * (c.slow ? 3 : 1.5);
      } else this.puff(a.x, a.y - 4, c.hit ? 6 : 4);
      this.kick(slam ? 2 : 1);
    }
  }

  private landClip(c: ClipRun): void {
    this.clip = null;
    this.mode = 'fight';
    const endMirrored = c.hit ? !!c.def.mirror : !!c.def.missTo;
    // a finish that landed: keep the last two frames (the tap) looping until the match ends
    if (c.hit && c.def.family === 'sub') {
      this.mode = 'finish';
      this.flip = c.flip;
      this.setFrames([c.keys[CLIP_FRAMES - 2]!, c.keys[CLIP_FRAMES - 1]!], 4, true);
      return;
    }
    this.clipActor = null;
    this.pos = c.to;
    this.top = c.to === 'de_pe' ? null : c.aheadTo;
    this.flip = c.to === 'de_pe' ? false : c.flip !== endMirrored;
    this.setFrames(this.idleFrames(), 4, true);
  }

  private landCartoon(played: Cartoon, a: { x: number; y: number }): void {
    const from = this.cartoonFrom;
    const aheadTo = this.cartoonAheadTo;
    this.cartoon = null;
    this.cartoonOff = { x: 0, y: 0, rot: 0 };
    this.pos = played.then;
    this.top = played.then === 'de_pe' ? null : aheadTo;
    this.mode = 'fight';
    this.setFrames(pairFrames(this.pos), 4, true);
    this.cartoonRead = null;
    if (played.then !== from) {
      this.slideAmp = played.read === 'gain' ? 36 : 22;
      this.slide = 1;
      this.wobble = 0;
      this.puff(a.x, a.y - 4, played.read === 'gain' ? 9 : 6);
      this.kick(played.read === 'gain' ? 2 : 1);
    } else if (played.read === 'stumble') {
      this.slide = 0;
      this.wobbleAmp = 16;
      this.wobble = 1;
      this.kick(1);
    } else {
      this.slide = 0;
      this.wobble = 0;
    }
  }

  private drawFrame(key: string, a: { x: number; y: number }): void {
    const pc = this.pairColors();
    const depth = a.y + 0.4;
    if (this.shadow) this.shadow.setPosition(a.x, a.y - 1).setVisible(true);
    const d = this.h.manifest.sprites[key];
    const tex = pc && d ? this.tex(key, pc.swap, pc.sig) : null;
    if (!d || !tex) {
      this.h.noteMissing(key || `bjj/pair_${this.pos}_0`);
      this.pair?.setVisible(false);
      const w = PAIR_SIZE.w;
      const h = PAIR_SIZE.h;
      if (!this.ph) this.ph = this.h.world(this.h.scene.add.rectangle(0, 0, w, h, 0xff00ff, 0.35)).setStrokeStyle(1, 0xff00ff, 1);
      this.ph.setPosition(a.x, a.y - h / 2).setDepth(depth).setVisible(true);
      return;
    }
    this.ph?.setVisible(false);
    const p = this.pair!;
    if (p.texture.key !== tex) p.setTexture(tex);
    // the art moves the bodies; the sprite itself only slides (a pose change with no clip) or shakes (a miss with no clip), never tilts
    const ox = Math.round(this.cartoonOff.x * 0.35 + (this.slide > 0 ? Math.sin(this.slide * Math.PI) * this.slideAmp : this.wobble > 0 ? Math.sin(this.wobble * 24) * this.wobbleAmp : 0));
    const oy = Math.round(this.cartoonOff.y * 0.25);
    if (this.nowMs < this.flashUntil) p.setTintFill(0xffffff);
    else if (p.isTinted) p.clearTint();
    this.drawnAt = { x: a.x + ox, y: a.y - oy };
    // a mirrored frame flips about its anchor (a trimmed clip frame's anchor is not its middle)
    const flip = this.mode === 'clip' && this.clip ? this.clip.flip : this.flip;
    p.setFlipX(flip)
      .setOrigin(flip ? 1 - d.ax / d.w : d.ax / d.w, d.ay / d.h)
      .setPosition(a.x + ox, a.y - oy)
      .setRotation(0)
      .setScale(1)
      .setDepth(depth)
      .setVisible(true);
  }

  // ------------------------------------------------------------------ cues
  private onCue(c: StageCue, mat: { x: number; y: number; x0: number; x1: number }): void {
    const now = this.nowMs;
    const a = this.anchor(mat);
    switch (c.t) {
      case 'intro': {
        this.introMs = c.ms;
        if (c.ms < 1500 || this.h.reduced() || this.h.instant()) {
          this.goFight();
          break;
        }
        this.startWalkers(mat);
        this.mode = 'walkin';
        this.modeEnd = now + c.ms * 0.36;
        this.walkStart = now;
        break;
      }
      case 'fight':
        if (this.mode !== 'walkin' && this.mode !== 'face' && this.mode !== 'bump') this.goFight();
        break;
      case 'transition': {
        this.clip = null;
        this.clipActor = null;
        this.top = topSide(c.rungFrom, c.rungTo);
        const frames = transFrames(c.from, c.to);
        const have = frames ? presentFrames((k) => !!this.h.manifest.sprites[k], frames) : [];
        this.pos = c.to;
        if (!this.h.reduced()) this.holdUntil = now + HITSTOP_MS;
        this.kick(c.gain ? 2 : 1);
        this.puff(a.x, a.y - 4, c.gain ? 9 : 5);
        if (have.length) {
          this.mode = 'trans';
          this.setFrames(have, 9, false);
        } else {
          // no baked clip for this step: slide the pair into the new pose instead of cutting
          this.mode = 'fight';
          this.slide = 1;
          this.setFrames(pairFrames(c.to), 4, true);
        }
        // the ladder is standing again: nobody is on top in the neutral frame
        if (c.to === 'de_pe') {
          this.top = null;
          this.flip = false;
        }
        break;
      }
      case 'ref':
        this.showRef(c.signal as RefArt);
        break;
      case 'crowd':
        this.crowd(c.cue);
        break;
      case 'finish':
        // a finish clip already loops its own tap
        if (this.mode === 'finish' && this.clipActor) break;
        this.clip = null;
        this.clipActor = null;
        this.top = c.winner;
        this.mode = 'finish';
        this.pos = 'montada';
        this.setFrames(presentFrames((k) => !!this.h.manifest.sprites[k], Array.from({ length: FRAMES.finishTap }, (_, i) => finishTapKey(i))), 6, true);
        this.kick(2);
        this.puff(a.x, a.y - 6, 10);
        break;
      case 'escaped':
        this.top = null;
        this.mode = 'fight';
        this.kick(1);
        this.puff(a.x, a.y - 6, 8);
        break;
      case 'end': {
        if (c.winner === 'none') break;
        this.clip = null;
        this.clipActor = null;
        this.flip = false;
        this.top = c.winner === 'partner' ? 'partner' : null;
        if (c.winner === 'draw') {
          this.mode = 'draw';
          this.setFrames(presentFrames((k) => !!this.h.manifest.sprites[k], Array.from({ length: FRAMES.fistbump }, (_, i) => fistbumpKey(i))), 5, false);
        } else {
          this.mode = 'win';
          this.setFrames(presentFrames((k) => !!this.h.manifest.sprites[k], Array.from({ length: FRAMES.winRaise }, (_, i) => winRaiseKey(i))), 3, false);
        }
        break;
      }
      case 'windup': {
        if (this.startDriven(c, now)) break;
        // no clip for this move (or the match atlas is still loading): hold the pose; the landing plays the cartoon
        this.clip = null;
        this.mode = 'fight';
        break;
      }
      case 'step': {
        const d = this.clip;
        if (!d?.driven) break;
        const f = Math.max(d.shown, Math.min(3, c.frame));
        if (f !== d.shown) {
          d.shown = f;
          this.kick(1);
          if (d.def.family === 'grip' && f === 3) this.puff(a.x + (d.flip ? -6 : 6), a.y - 18, 2);
        }
        break;
      }
      case 'land': {
        const d = this.clip;
        if (d?.driven && d.def.move === c.move) {
          d.driven = false;
          d.autoMs = 0;
          d.hit = c.hit;
          if (!c.hit && d.missKeys) d.keys = d.missKeys;
          // a hit goes on from the big frame (the impact); a miss stumbles on from where it broke
          d.landFrom = c.hit ? Math.min(d.shown + 1, 4) : d.shown;
          d.to = c.to;
          d.aheadTo = c.aheadTo;
          d.slow = !!c.finale && c.hit && !this.h.reduced();
          d.t0 = now;
          d.ms = Math.max(1, c.ms * (d.slow ? 1.6 : 1));
          break;
        }
        this.onCue({ t: 'cartoon', move: c.move, hit: c.hit, from: c.from, to: c.to, aheadFrom: c.aheadFrom, aheadTo: c.aheadTo, ms: c.ms, actor: c.actor, finale: c.finale }, mat);
        break;
      }
      case 'cartoon': {
        if (this.startClip(c, now)) break;
        const played = cartoonFor(c.move, c.hit, c.from, c.to);
        this.cartoon = played;
        this.cartoonFrom = c.from;
        this.cartoonAheadTo = c.aheadTo;
        this.cartoonT0 = now;
        this.cartoonMs = Math.max(1, c.ms);
        this.cartoonOff = { x: 0, y: 0, rot: 0 };
        this.cartoonRead = played.read;
        this.cartoonPuffed = false;
        this.slide = 0;
        this.wobble = 0;
        this.mode = 'cartoon';
        this.pos = c.from;
        this.top = c.from === 'de_pe' ? null : c.aheadFrom;
        this.setFrames(pairFrames(c.from), 8, true);
        break;
      }
      case 'hit':
        if (!this.h.reduced()) this.holdUntil = now + HITSTOP_MS * c.strength;
        this.kick(c.strength);
        this.puff(a.x, a.y - 4, 4 + 3 * c.strength);
        break;
      case 'miss':
        this.kick(1);
        this.wobble = 1;
        break;
      case 'long':
        this.sweatAt = now;
        break;
      case 'flash':
        if (!this.h.reduced()) this.flashUntil = now + FLASH_MS * c.strength;
        this.kick(c.strength);
        break;
      case 'pop':
        this.word(a, c.side === 'you' ? -WORD_SIDE : WORD_SIDE, `bout-word kind-${c.kind} side-${c.side}`, c.text);
        if (c.kind === 'vantagem') this.puff(a.x + (c.side === 'you' ? -6 : 6), a.y - 8, 6);
        break;
      case 'ground':
        // needs_br: true — Ganhou! / Perdeu! (the ground of the move, from the player's seat)
        this.word(a, 0, `bout-word bout-groundpop ${c.dir}`, c.dir === 'gain' ? '▲ Ganhou!' : '▼ Perdeu!', true);
        break;
    }
  }

  /**
   * A word that follows the camera like the crowd's cheers: over the heads (Vantagem!, a grip), stacking up when several land together,
   * or under the feet (`feet`: the ground arrow, so it never hides behind the scoreboard).
   */
  private word(a: { x: number; y: number }, dx: number, cls: string, text: string, feet = false): void {
    if (!this.popsEl) return;
    const live = feet ? 0 : this.pops.filter((p) => p.el.classList.contains('bout-word') && !p.el.classList.contains('bout-groundpop') && p.until > this.nowMs).length;
    const el = document.createElement('div');
    el.className = cls;
    el.textContent = text;
    const wx = a.x + dx;
    // the figures fill the lower ~30 px of the frame: heads are about 31 px over the anchor
    const wy = feet ? a.y + 7 : a.y - 33 - live * 7;
    const { px, py } = this.h.toCanvas(wx, wy);
    el.style.left = `${Math.round(px)}px`;
    el.style.top = `${Math.round(py)}px`;
    this.popsEl.append(el);
    this.pops.push({ el, wx, wy, until: this.nowMs + WORD_MS });
  }

  /** The held grips as little hands on the standing pair (gold for yours, red for theirs); a grip about to slip blinks. */
  private updateGrips(mat: { x: number; y: number }): void {
    const snap = boutFeed.snap;
    const show = !!snap?.grips && this.pos === 'de_pe' && (this.mode === 'fight' || this.mode === 'trans') && !this.cartoon && !!this.pair?.visible;
    const a = this.anchor(mat);
    for (const side of ['you', 'partner'] as const) {
      for (const g of ['collar', 'sleeve'] as const) {
        const key = `${side}:${g}`;
        // the art draws every held grip (a fist on the gi); the little hand only blinks over a grip that is about to slip
        // (or stands in for the grips while the match atlas is still loading)
        const inArt = this.frames[0]?.startsWith('bjj/stand_');
        const held = show && !!snap!.grips![side][g] && (!inArt || snap!.grips![side].age[g] >= 2);
        let r = this.gripHands.get(key);
        if (!held) {
          r?.setVisible(false);
          continue;
        }
        if (!r) {
          r = this.h.world(this.h.scene.add.rectangle(0, 0, 3, 3, side === 'you' ? 0xf2c230 : 0xe0523a, 1)).setStrokeStyle(1, 0x14101a, 1);
          this.gripHands.set(key, r);
        }
        const spot = GRIP_SPOT[side][g];
        const age = snap!.grips![side].age[g];
        const blink = age >= 2 && !this.h.reduced() && Math.floor(this.nowMs / 180) % 2 === 0;
        r.setPosition(Math.round(this.drawnAt.x + spot.x), Math.round(this.drawnAt.y + spot.y)).setDepth(a.y + 1).setAlpha(blink ? 0.35 : 1).setVisible(true);
      }
    }
  }

  private kick(strength: 1 | 2): void {
    if (this.h.reduced()) return;
    this.nudge = { x: strength * (Math.random() < 0.5 ? -1 : 1), y: strength };
  }

  // ------------------------------------------------------------------ walk-in
  private walkStart = 0;

  private startWalkers(mat: { x: number; y: number; x0: number; x1: number }): void {
    this.killWalkers();
    const me = this.h.playerAppearance();
    const p = boutFeed.partner;
    if (!me || !p) return;
    const gi = (ap: Appearance, color: number): Look => lookForAppearance({ ...ap, top: 'camisa', topColor: color, bottom: 'calca', bottomColor: color, garb: undefined }, { gi: true });
    const lookYou = gi(me, 4);
    const lookPartner = gi(cpuLook(p.name).appearance, 2);
    const ky = this.h.acquireSheet(lookYou);
    const kp = this.h.acquireSheet(lookPartner);
    const s = this.h.scene;
    const y = Math.round(mat.y + PAIR_DROP);
    const you = this.h.world(s.add.sprite(0, 0, ky, 0)).setOrigin(0.5, 1);
    const partner = this.h.world(s.add.sprite(0, 0, kp, 0)).setOrigin(0.5, 1);
    you.play({ key: animKey(ky, 'walk', 'W'), startFrame: 0 });
    partner.play({ key: animKey(kp, 'walk', 'E'), startFrame: 2 });
    this.walkers = {
      you,
      partner,
      keys: [ky, kp],
      from: [
        { x: Math.round(mat.x1 + 4), y },
        { x: Math.round(mat.x0 - 4), y },
      ],
      to: [
        { x: Math.round(mat.x + 11), y },
        { x: Math.round(mat.x - 11), y },
      ],
    };
  }

  private stepWalkers(now: number, a: { x: number; y: number }): void {
    const w = this.walkers;
    if (!w) return;
    const u = Math.max(0, Math.min(1, (now - this.walkStart) / Math.max(1, this.modeEnd - this.walkStart)));
    const e = 1 - (1 - u) * (1 - u);
    const put = (spr: Phaser.GameObjects.Sprite, i: number, face: 'W' | 'E', key: string) => {
      const from = w.from[i]!;
      const to = w.to[i]!;
      const x = Math.round(from.x + (to.x - from.x) * e);
      spr.setPosition(x, a.y).setDepth(a.y + 0.4 + i * 0.01);
      if (u >= 1) {
        // arrived: stand, facing each other
        const want = animKey(key, 'idle', face);
        if (spr.anims.currentAnim?.key !== want) spr.play({ key: want });
      }
    };
    put(w.you, 0, 'W', w.keys[0]!);
    put(w.partner, 1, 'E', w.keys[1]!);
  }

  // ------------------------------------------------------------------ Bia as the referee
  /**
   * During a match Professora Bia is the referee: her avatar steps aside and her referee frames stand at the referee's spot, off the mat's
   * east edge and under the scoreboard (watching between calls, `espera`). A call shows its signal for a moment. Off the mat she is back.
   */
  private showRef(signal: RefArt | null): void {
    const onMat = this.mode !== 'off';
    if (!onMat) {
      this.refUntil = 0;
      this.refSprite?.setVisible(false);
      if (this.refHidden) {
        this.refHidden.sprite.setVisible(true);
        this.refHidden.shadow?.setVisible(true);
        this.refHidden = null;
      }
      return;
    }
    const bia = this.h.bia();
    if (!bia) return;
    const key = refKey(signal ?? 'espera');
    const d = this.h.manifest.sprites[key];
    const ap = { skin: SKIN_TONES[4]!, hair: HAIR_COLORS[0]! };
    const tex = d ? this.tex(key, { table: refTable(ap), clear: new Set() }, `ref${ap.skin}`) : null;
    if (!d || !tex) this.h.noteMissing(key);
    const s = this.h.scene;
    if (!this.refSprite) this.refSprite = this.h.world(s.add.sprite(0, 0, '__DEFAULT')).setOrigin(0.5, 1).setVisible(false);
    if (d && tex) {
      this.refSprite.setTexture(tex).setOrigin(d.ax / d.w, d.ay / d.h).setVisible(true);
      this.refHidden = { sprite: bia.sprite, shadow: bia.shadow };
      bia.sprite.setVisible(false);
      bia.shadow?.setVisible(false);
    }
    this.refUntil = signal ? this.nowMs + REF_SHOW_MS : 0;
  }

  /** The referee's spot: off the mat's east edge, under the scoreboard, a step in front of the fighters (world px of her feet). */
  private refSpot(mat: { x: number; y: number; x1: number }): { x: number; y: number } {
    return { x: Math.round(mat.x1 + REF_GAP), y: Math.round(mat.y + PAIR_DROP + 16) };
  }

  private updateRef(mat: { x: number; y: number; x1: number }): void {
    if (this.mode === 'off') return;
    if (!this.refSprite?.visible) this.showRef(null);
    const at = this.refSpot(mat);
    this.refSprite?.setPosition(at.x, at.y).setDepth(at.y + 0.2);
    if (this.refUntil && this.nowMs >= this.refUntil) this.showRef(null);
  }

  // ------------------------------------------------------------------ dust and sweat
  private puff(x: number, y: number, n: number): void {
    if (this.h.reduced()) return;
    const s = this.h.scene;
    for (let i = 0; i < n; i++) {
      let p = this.particles.find((q) => q.life <= 0);
      if (!p) {
        if (this.particles.length >= 40) return;
        const r = this.h.world(s.add.rectangle(0, 0, 2, 2, 0xe9ddc6, 1)).setDepth(y + 2);
        p = { r, vx: 0, vy: 0, life: 0, max: 1, g: 0 };
        this.particles.push(p);
      }
      const ang = Math.random() * Math.PI * 2;
      const sp = 12 + Math.random() * 22;
      p.vx = Math.cos(ang) * sp;
      p.vy = Math.sin(ang) * sp * 0.45 - 8;
      p.g = 26;
      p.life = p.max = 0.35 + Math.random() * 0.3;
      const big = Math.random() < 0.35;
      p.r.setSize(big ? 3 : 2, big ? 3 : 2).setPosition(Math.round(x + (Math.random() - 0.5) * 22), Math.round(y)).setAlpha(0.9).setVisible(true).setDepth(y + 2);
    }
  }

  /** Mat dust from a body slamming down: a low cloud along `width` px that rolls outward and settles. */
  private dust(x: number, y: number, width: number, n: number): void {
    if (this.h.reduced()) return;
    const s = this.h.scene;
    for (let i = 0; i < n; i++) {
      let p = this.particles.find((q) => q.life <= 0);
      if (!p) {
        if (this.particles.length >= 48) return;
        const r = this.h.world(s.add.rectangle(0, 0, 2, 2, 0xe9ddc6, 1)).setDepth(y + 2);
        p = { r, vx: 0, vy: 0, life: 0, max: 1, g: 0 };
        this.particles.push(p);
      }
      const off = (Math.random() - 0.5) * width;
      p.vx = Math.sign(off || 1) * (10 + Math.random() * 26);
      p.vy = -6 - Math.random() * 12;
      p.g = 18;
      p.life = p.max = 0.5 + Math.random() * 0.45;
      const big = Math.random() < 0.5;
      p.r.setFillStyle(Math.random() < 0.3 ? 0xf6efe0 : 0xe9ddc6, 1).setSize(big ? 3 : 2, big ? 3 : 2).setPosition(Math.round(x + off), Math.round(y - Math.random() * 3)).setAlpha(0.95).setVisible(true).setDepth(y + 2);
    }
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.r.setVisible(false);
        continue;
      }
      p.vy += p.g * dt;
      p.r.setPosition(Math.round(p.r.x + p.vx * dt), Math.round(p.r.y + p.vy * dt)).setAlpha(Math.max(0, p.life / p.max));
    }
  }

  /** A few white sparkles by the heads during a long scramble. */
  private updateSweat(dt: number, mat: { x: number; y: number }): void {
    void dt;
    if (this.h.reduced() || !this.sweatAt || this.nowMs - this.sweatAt > 3500) return;
    if (this.nowMs - this.lastSpark < 260) return;
    this.lastSpark = this.nowMs;
    const a = this.anchor(mat);
    const s = this.h.scene;
    const x = Math.round(a.x + (hash01(this.nowMs | 0) - 0.5) * 30);
    const y = Math.round(a.y - 34 - hash01((this.nowMs | 0) + 7) * 6);
    const r = this.h.world(s.add.rectangle(x, y, 1, 1, 0xffffff, 1)).setDepth(a.y + 3);
    const r2 = this.h.world(s.add.rectangle(x, y - 1, 1, 3, 0xffffff, 0.8)).setDepth(a.y + 3);
    s.tweens.add({ targets: [r, r2], alpha: 0, y: '-=4', duration: 480, onComplete: () => { r.destroy(); r2.destroy(); } });
  }
  private lastSpark = 0;

  // ------------------------------------------------------------------ the crowd
  private crowd(cue: CrowdCue): void {
    const table = CROWD[cue];
    const spots = this.h.crowd();
    if (!table || !spots.length || !this.popsEl) return;
    const pick = <T,>(arr: readonly T[], seed: number): T => arr[Math.floor(hash01(seed) * arr.length) % arr.length]!;
    const n = Math.min(spots.length, cue === 'start' || cue === 'end' ? 3 : 2);
    const order = [...spots].sort((a, b) => hash01(this.nowMs + a.x * 7) - hash01(this.nowMs + b.x * 7));
    for (let i = 0; i < n; i++) {
      const sp = order[i]!;
      const el = document.createElement('div');
      el.className = 'bout-pop';
      const ic = document.createElement('span');
      ic.className = 'ic';
      ic.textContent = pick(table.icons, this.nowMs + i);
      el.append(ic);
      if (i === 0 || Math.random() < 0.5) {
        const sh = document.createElement('span');
        sh.className = 'sh';
        sh.textContent = pick(table.shouts, this.nowMs + i * 3);
        el.append(sh);
      }
      el.style.animationDelay = `${i * 110}ms`;
      const { px, py } = this.h.toCanvas(sp.x, sp.y);
      el.style.left = `${Math.round(px)}px`;
      el.style.top = `${Math.round(py)}px`;
      this.popsEl.append(el);
      this.pops.push({ el, wx: sp.x, wy: sp.y, until: this.nowMs + CROWD_MS + 400 + i * 110 });
    }
  }

  private updatePops(now: number): void {
    if (!this.pops.length) return;
    this.pops = this.pops.filter((p) => {
      if (now >= p.until) {
        p.el.remove();
        return false;
      }
      const { px, py } = this.h.toCanvas(p.wx, p.wy);
      p.el.style.left = `${Math.round(px)}px`;
      p.el.style.top = `${Math.round(py)}px`;
      return true;
    });
  }

  // ------------------------------------------------------------------ the mat scoreboard
  private updatePlacar(on: boolean): void {
    const el = this.placarEl;
    if (!el) return;
    const p = on ? this.h.placar() : null;
    const snap = boutFeed.snap;
    if (!p || !snap || !this.h.manifest.sprites[PLACAR_KEY]) {
      el.style.display = 'none';
      return;
    }
    el.style.display = 'block';
    const k = this.h.cssScale();
    // the sprite's top-left in world px: anchor (24, 42) of a 48x44 frame
    const x0 = p.wx - 24;
    const y0 = p.wy - 42;
    const sig = `${snap.points.you}|${snap.adv.you}|${snap.points.partner}|${snap.adv.partner}|${Math.ceil(snap.clockMs / 1000)}|${k}|${Math.round(this.h.toCanvas(x0, y0).px)}|${Math.round(this.h.toCanvas(x0, y0).py)}`;
    if (sig === this.placarSig) return;
    this.placarSig = sig;
    const text: Record<string, string> = {
      clock: formatBoutClock(snap.clockMs),
      youPoints: String(snap.points.you),
      youAdv: String(snap.adv.you),
      partnerPoints: String(snap.points.partner),
      partnerAdv: String(snap.adv.partner),
    };
    for (const [name, rect] of Object.entries(PLACAR_CELLS)) {
      const cell = this.placarCells[name]!;
      const { px, py } = this.h.toCanvas(x0 + rect[0], y0 + rect[1]);
      cell.style.left = `${px}px`;
      cell.style.top = `${py}px`;
      cell.style.width = `${rect[2] * k}px`;
      cell.style.height = `${rect[3] * k}px`;
      cell.style.fontSize = `${rect[3] * k * (name === 'clock' ? 1.05 : 1.15)}px`;
      cell.style.lineHeight = `${rect[3] * k}px`;
      cell.textContent = text[name] ?? '';
    }
  }

  /** For the shots and the e2e (`__tb.renderer.info().bout`): what the stage is showing. */
  info() {
    return {
      mode: this.mode,
      pos: this.pos,
      top: this.top,
      frame: this.pair?.texture.key ?? null,
      clip: this.clip ? `${this.clip.def.move}@${this.clip.def.from}:${this.clip.driven ? 'windup' : this.clip.hit ? 'hit' : 'miss'}:${this.clip.shown}` : null,
      flip: this.flip,
      matchAtlas: this.matchAtlas,
      visible: !!this.pair?.visible,
      placeholder: !!this.ph?.visible,
      ref: !!this.refSprite?.visible,
      walkers: !!this.walkers,
      particles: this.particles.filter((p) => p.life > 0).length,
      grips: [...this.gripHands.entries()].filter(([, r]) => r.visible).map(([k]) => k),
      words: this.pops.filter((p) => p.el.classList.contains('bout-word')).map((p) => p.el.textContent ?? ''),
    };
  }

  destroy(): void {
    this.stop();
    this.popsEl?.remove();
    this.placarEl?.remove();
    this.popsEl = null;
    this.placarEl = null;
  }
}

export type { RefSignal };
