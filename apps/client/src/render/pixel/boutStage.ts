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
import { swapKeys } from './palette';
import { animKey } from './charsheet';
import { lookForAppearance, type Look } from './looks';
import { boutFeed, type StageCue } from './boutFeed';
import { DEPTH } from './props';
import { originOf } from './spriteUtil';
import {
  FRAMES,
  PAIR_SIZE,
  PLACAR_CELLS,
  PLACAR_KEY,
  colorsSig,
  faceOffKey,
  finishTapKey,
  fistbumpKey,
  pairFrames,
  pairTable,
  presentFrames,
  refKey,
  refTable,
  topSide,
  transFrames,
  winRaiseKey,
  type PairColors,
  type RefArt,
} from './bjjArt';

type Mode = 'off' | 'walkin' | 'face' | 'bump' | 'fight' | 'trans' | 'finish' | 'win' | 'draw';

export interface StageHost {
  scene: Phaser.Scene;
  world: <G extends Phaser.GameObjects.GameObject>(o: G) => G;
  manifest: Manifest;
  noteMissing: (key: string) => void;
  acquireSheet: (look: Look) => string;
  releaseSheet: (key: string) => void;
  /** the player's own appearance (the local avatar) */
  playerAppearance: () => Appearance | null;
  /** Professora Bia's avatar view, to swap her for a referee frame */
  bia: () => { sprite: Phaser.GameObjects.Sprite; wx: number; wy: number; depth: number } | null;
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
const HITSTOP_MS = 80;
const CROWD_MS = 1500;

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
  private refHidden: Phaser.GameObjects.Sprite | null = null;
  private particles: Particle[] = [];
  private textures: string[] = [];
  private scratch: HTMLCanvasElement | null = null;
  private introMs = 0;
  private sweatAt = 0;

  private popsEl: HTMLElement | null = null;
  /** live cheers: they stay glued to the spectator's head while the camera settles */
  private pops: { el: HTMLElement; wx: number; wy: number; until: number }[] = [];
  private placarEl: HTMLElement | null = null;
  private placarSig = '';
  private placarCells: Record<string, HTMLElement> = {};

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

  /** Texture name of a manifest frame with `table` swapped in (built once per palette signature), or null when the art is missing. */
  private tex(key: string, table: Map<number, number>, sig: string): string | null {
    const d = this.h.manifest.sprites[key];
    if (!d) {
      this.h.noteMissing(key);
      return null;
    }
    const name = `bjj:${sig}:${key}`;
    if (this.h.scene.textures.exists(name)) return name;
    const px = this.readPixels(d);
    if (!px) return null;
    swapKeys(px.data, table);
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
    return {
      you: { skin: SKIN_TONES[a.skin] ?? SKIN_TONES[3]!, hair: HAIR_COLORS[a.hairColor] ?? HAIR_COLORS[0]! },
      partner: { skin: SKIN_TONES[p.appearance.skin] ?? SKIN_TONES[3]!, hair: HAIR_COLORS[p.appearance.hairColor] ?? HAIR_COLORS[0]! },
      belt: boutFeed.belt,
      top,
    };
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
    this.pair!.setVisible(false);
  }

  private stop(): void {
    this.mode = 'off';
    this.pair?.setVisible(false);
    this.ph?.setVisible(false);
    this.shadow?.setVisible(false);
    this.killWalkers();
    this.showRef(null);
    for (const p of this.particles) p.r.setVisible(false);
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
    this.updateRef();
    this.updateParticles(dt);
    this.updateSweat(dt, mat);
    this.updatePops(nowMs);
    this.updatePlacar(true);
  }

  private anchor(mat: { x: number; y: number }): { x: number; y: number } {
    return { x: Math.round(mat.x), y: Math.round(mat.y + PAIR_DROP) };
  }

  /** The fighters' colours for the current frame family. */
  private pairColors(): { c: PairColors; sig: string; table: Map<number, number> } | null {
    const c = this.colors(this.top);
    if (!c) return null;
    return { c, sig: colorsSig(c), table: pairTable(c) };
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

    // the snapshot is the truth: if the pair is not where the server says (a missed cue, a reconnect), cut to it
    const snap = boutFeed.snap;
    if (this.mode === 'fight' && snap && (snap.position !== this.pos || snap.ahead !== this.top)) {
      this.pos = snap.position;
      this.top = snap.ahead;
      this.setFrames(pairFrames(this.pos), 4, true);
    }

    // draw the current frame
    if (this.mode === 'walkin') {
      this.pair?.setVisible(false);
      this.ph?.setVisible(false);
      this.shadow?.setVisible(false);
      return;
    }
    this.t += dt;
    const keys = this.frames.length ? this.frames : pairFrames(this.pos);
    const n = keys.length;
    const idx = this.loop ? Math.floor(this.t * this.fps) % Math.max(1, n) : Math.min(n - 1, Math.floor(this.t * this.fps));
    this.drawFrame(keys[idx] ?? keys[0] ?? '', a);
  }

  private isDone(): boolean {
    return !this.loop && this.t * this.fps >= this.frames.length - 0.001;
  }

  private goFight(): void {
    this.mode = 'fight';
    this.top = this.top === null && this.pos === 'de_pe' ? null : this.top;
    this.setFrames(pairFrames(this.pos), 4, true);
  }

  private drawFrame(key: string, a: { x: number; y: number }): void {
    const pc = this.pairColors();
    const depth = a.y + 0.4;
    if (this.shadow) this.shadow.setPosition(a.x, a.y - 1).setVisible(true);
    const d = this.h.manifest.sprites[key];
    const tex = pc && d ? this.tex(key, pc.table, pc.sig) : null;
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
    p.setOrigin(d.ax / d.w, d.ay / d.h).setPosition(a.x, a.y).setDepth(depth).setVisible(true);
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
          // no art for this step: cut straight to the new position
          this.mode = 'fight';
          this.setFrames(pairFrames(c.to), 4, true);
        }
        // the ladder is standing again: nobody is on top in the neutral frame
        if (c.to === 'de_pe') this.top = null;
        break;
      }
      case 'ref':
        this.showRef(c.signal as RefArt);
        break;
      case 'crowd':
        this.crowd(c.cue);
        break;
      case 'finish':
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
      case 'hit':
        if (!this.h.reduced()) this.holdUntil = now + HITSTOP_MS * c.strength;
        this.kick(c.strength);
        this.puff(a.x, a.y - 4, 4 + 3 * c.strength);
        break;
      case 'miss':
        this.kick(1);
        break;
      case 'long':
        this.sweatAt = now;
        break;
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

  // ------------------------------------------------------------------ Bia as a referee
  private showRef(signal: RefArt | null): void {
    if (!signal) {
      this.refUntil = 0;
      this.refSprite?.setVisible(false);
      if (this.refHidden) {
        this.refHidden.setVisible(true);
        this.refHidden = null;
      }
      return;
    }
    const bia = this.h.bia();
    if (!bia) return;
    const key = refKey(signal);
    const d = this.h.manifest.sprites[key];
    const ap = { skin: SKIN_TONES[4]!, hair: HAIR_COLORS[0]! };
    const tex = d ? this.tex(key, refTable(ap), `ref${ap.skin}`) : null;
    if (!d || !tex) {
      this.h.noteMissing(key);
    }
    const s = this.h.scene;
    if (!this.refSprite) this.refSprite = this.h.world(s.add.sprite(0, 0, '__DEFAULT')).setOrigin(0.5, 1).setVisible(false);
    if (d && tex) {
      this.refSprite.setTexture(tex).setOrigin(d.ax / d.w, d.ay / d.h);
      this.refSprite.setVisible(true);
      this.refHidden = bia.sprite;
      bia.sprite.setVisible(false);
    }
    this.refUntil = this.nowMs + REF_SHOW_MS;
  }

  private updateRef(): void {
    const bia = this.h.bia();
    if (this.refSprite?.visible && bia) this.refSprite.setPosition(bia.wx, bia.wy).setDepth(bia.depth + 0.01);
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
    return { mode: this.mode, pos: this.pos, top: this.top, frame: this.pair?.texture.key ?? null, visible: !!this.pair?.visible, placeholder: !!this.ph?.visible, ref: !!this.refSprite?.visible, walkers: !!this.walkers, particles: this.particles.filter((p) => p.life > 0).length };
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
