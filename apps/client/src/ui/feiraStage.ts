/**
 * The Feira cart stage: the full-screen pixel scene that Tapioca, Pastel and Caldo de cana play on.
 *
 * You stand behind the cart. The feira street is up top (sky, the other barracas, bunting), the regulars walk up
 * to the counter on their real character sheets, and the cart's work top fills the bottom of the screen. Each game
 * draws its own stations on the work top; this file owns everything they share:
 *
 *   - a canvas at an integer zoom that fills the window (`layout`: landscape or portrait zones, in art px);
 *   - a transparent DOM button over every piece you can use (`hit`): taps, holds and drags work with a mouse, a
 *     finger or the keyboard, and the e2e scripts click the same ids;
 *   - the customers: walk in, wait at one of three spots with a speech bubble (the Portuguese line, the English
 *     gloss, the order as pixel icons) and a patience bar, then dance, thank you or storm off;
 *   - juice: particles, floating points, screen shake, the synthesized feira sounds, a 3-2-1 before the clock
 *     starts and a "Fechou!" when it stops;
 *   - the HUD (game, clock, freguesia, score, combo, Sair).
 *
 * Display and timing only. The server scores the run from the per-order outcomes this collects.
 *
 * needs_br: true (HUD labels, countdown, banners, reactions).
 */
import {
  FEIRA_CROWD_LABEL,
  feiraCrowd,
  whoAppearance,
  type FeiraCustomerOrder,
  type FeiraGameId,
  type FeiraOrderOutcome,
  type FeiraQuality,
  type NpcId,
} from '@tudobem/shared';
import { h, en } from './dom';
import { game } from '../state';
import { ambience } from '../ambience';
import { readShowEnglish } from './dialogueLogic';
import { reducedMotion } from '../render/pixel/perf';
import { sharedCharAssets, type CharAssets } from '../render/pixel/charAssets';
import { composeLook } from '../render/pixel/composeLook';
import { lookForAppearance, lookForNpc } from '../render/pixel/looks';

// ---------------------------------------------------------------- pixel kit

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Ctx = CanvasRenderingContext2D;

/** The LimeZu-ish palette the rest of the game uses. Light comes from the upper left. */
export const C = {
  ink: '#2a2233',
  navy: '#3a3a50',
  white: '#f8f8f8',
  paper: '#fffdf6',
  cream: '#fff6e6',
  mist: '#d8d0e0',
  steelHi: '#e4e6ee',
  steel: '#c6c8d4',
  steelMid: '#a2a6be',
  steelLo: '#6c6e85',
  steelDk: '#4a4c63',
  iron: '#3a3a50',
  woodHi: '#daa463',
  wood: '#a9764f',
  woodMid: '#916e41',
  woodLo: '#6b4c2c',
  woodDk: '#4a3220',
  gold: '#f2c230',
  goldHi: '#fff59a',
  goldLo: '#c48a14',
  red: '#e63f38',
  redLo: '#a82b2d',
  green: '#3d9a4a',
  greenHi: '#8fd18a',
  greenLo: '#1f6b32',
  blue: '#4995e3',
  blueLo: '#2f6db5',
  sky: '#9fd4f2',
  skyHi: '#cfeefa',
} as const;

const hexCache = new Map<string, [number, number, number]>();
function rgb(hex: string): [number, number, number] {
  let v = hexCache.get(hex);
  if (!v) {
    const n = parseInt(hex.slice(1), 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    hexCache.set(hex, v);
  }
  return v;
}

const spriteCache = new Map<string, HTMLCanvasElement>();

/**
 * A cached sprite drawn pixel by pixel: `fn(x, y)` returns a colour or null. `outline` rings the silhouette
 * (the 1 px dark edge every sprite in the game has).
 */
export function paint(key: string, w: number, hgt: number, fn: (x: number, y: number) => string | null | undefined, outline: string | null = C.ink): HTMLCanvasElement {
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const pad = outline ? 1 : 0;
  const cw = w + pad * 2;
  const ch = hgt + pad * 2;
  const cv = document.createElement('canvas');
  cv.width = cw;
  cv.height = ch;
  const ctx = cv.getContext('2d');
  if (!ctx) return cv;
  const img = ctx.createImageData(cw, ch);
  const on = new Uint8Array(cw * ch);
  for (let y = 0; y < hgt; y++) {
    for (let x = 0; x < w; x++) {
      const c = fn(x, y);
      if (!c) continue;
      const i = (y + pad) * cw + (x + pad);
      const [r, g, b] = rgb(c);
      img.data[i * 4] = r;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = b;
      img.data[i * 4 + 3] = 255;
      on[i] = 1;
    }
  }
  if (outline) {
    const [r, g, b] = rgb(outline);
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const i = y * cw + x;
        if (on[i]) continue;
        const near = (x > 0 && on[i - 1] === 1) || (x < cw - 1 && on[i + 1] === 1) || (y > 0 && on[i - cw] === 1) || (y < ch - 1 && on[i + cw] === 1);
        if (!near) continue;
        img.data[i * 4] = r;
        img.data[i * 4 + 1] = g;
        img.data[i * 4 + 2] = b;
        img.data[i * 4 + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  spriteCache.set(key, cv);
  return cv;
}

/** A sprite from rows of palette letters ('.' is clear). */
export function rows(key: string, lines: string[], pal: Record<string, string>, outline: string | null = null): HTMLCanvasElement {
  const w = Math.max(...lines.map((l) => l.length));
  return paint(key, w, lines.length, (x, y) => {
    const ch = lines[y]?.[x];
    return ch && ch !== '.' ? pal[ch] ?? null : null;
  }, outline);
}

export const inDisc = (x: number, y: number, cx: number, cy: number, r: number) => {
  const dx = x + 0.5 - cx;
  const dy = y + 0.5 - cy;
  return dx * dx + dy * dy <= r * r;
};

export const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => {
  const dx = (x + 0.5 - cx) / rx;
  const dy = (y + 0.5 - cy) / ry;
  return dx * dx + dy * dy <= 1;
};

export function fill(g: Ctx, x: number, y: number, w: number, hh: number, c: string) {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(hh));
}

/** Blit a sprite with its top-left at (x, y), or centred when `center`. */
export function blit(g: Ctx, s: CanvasImageSource & { width: number; height: number }, x: number, y: number, center = false) {
  g.drawImage(s, Math.round(center ? x - s.width / 2 : x), Math.round(center ? y - s.height / 2 : y));
}

/** A filled pixel disc (no anti-aliasing). */
export function disc(g: Ctx, cx: number, cy: number, r: number, c: string) {
  g.fillStyle = c;
  const rr = r * r;
  for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
    const span = Math.floor(Math.sqrt(Math.max(0, rr - dy * dy)));
    if (span <= 0 && Math.abs(dy) > r - 0.5) continue;
    g.fillRect(Math.round(cx - span), Math.round(cy + dy), span * 2 + 1, 1);
  }
}

/** A filled pixel ellipse. */
export function oval(g: Ctx, cx: number, cy: number, rx: number, ry: number, c: string) {
  g.fillStyle = c;
  for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
    const t = 1 - (dy * dy) / (ry * ry);
    if (t < 0) continue;
    const span = Math.floor(rx * Math.sqrt(t));
    g.fillRect(Math.round(cx - span), Math.round(cy + dy), span * 2 + 1, 1);
  }
}

/** A ring of `n` pixels on a circle (timers, sweet spots). `from`/`to` are 0..1 of a turn from 12 o'clock. */
export function arc(g: Ctx, cx: number, cy: number, r: number, from: number, to: number, c: string, thick = 1) {
  g.fillStyle = c;
  const steps = Math.max(8, Math.ceil(Math.PI * 2 * r * 1.6 * Math.max(0, to - from)));
  for (let i = 0; i <= steps; i++) {
    const a = (from + (to - from) * (i / steps)) * Math.PI * 2 - Math.PI / 2;
    for (let k = 0; k < thick; k++) {
      g.fillRect(Math.round(cx + Math.cos(a) * (r - k)), Math.round(cy + Math.sin(a) * (r - k)), 1, 1);
    }
  }
}

/** Copy a sprite into a small DOM canvas (bubble tickets, end card). */
export function spriteEl(s: HTMLCanvasElement, cls = 'fst-icon'): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = s.width;
  c.height = s.height;
  c.className = cls;
  c.getContext('2d')?.drawImage(s, 0, 0);
  return c;
}

// ---------------------------------------------------------------- particles

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ay: number;
  life: number;
  max: number;
  c: string;
  s: number;
}

// ---------------------------------------------------------------- emotes over a customer's head (9x9)

const EMOTES: Record<'heart' | 'note' | 'anger' | 'sweat' | 'meh', string[]> = {
  heart: [
    '.rr...rr.',
    'rRRr.rRRr',
    'rRwRrRRRr',
    'rRRRRRRRr',
    '.rRRRRRr.',
    '..rRRRr..',
    '...rRr...',
    '....r....',
  ],
  note: [
    '...kkkkk.',
    '...kyyyk.',
    '...k...k.',
    '...k...k.',
    '...k...k.',
    '.kkk.kkk.',
    'kyyk.kyyk',
    '.kk...kk.',
  ],
  anger: [
    '.rr...rr.',
    'rRRr.rRRr',
    '.rRRrRRr.',
    '...r.r...',
    '.rRRrRRr.',
    'rRRr.rRRr',
    '.rr...rr.',
  ],
  sweat: [
    '....b....',
    '...bBb...',
    '..bBwBb..',
    '..bBBBb..',
    '..bBBBb..',
    '...bbb...',
  ],
  meh: [
    '.........',
    'kk.kk.kk.',
    'kk.kk.kk.',
  ],
};
const EMOTE_PAL = { r: '#a82b2d', R: '#e63f38', w: '#ffffff', k: C.ink, y: '#c48a14', b: '#2f6db5', B: '#9fd4f2' };
type Emote = keyof typeof EMOTES;

// ---------------------------------------------------------------- customers

export type CustomerMood = 'walk' | 'wait' | 'happy' | 'ok' | 'meh' | 'angry' | 'leave';

export interface StageCustomer<O extends FeiraCustomerOrder> {
  order: O;
  /** index into the seed's order list */
  index: number;
  /** the counter spot (0..2), or -1 while queued */
  spot: number;
  /** art-px position of the feet */
  x: number;
  /** run ms when they reached the counter (patience starts here) */
  arrivedAt: number;
  mood: CustomerMood;
  /** when the current mood started (performance.now) */
  moodAt: number;
  emote: Emote | null;
  emoteAt: number;
  done: boolean;
  bubble: HTMLElement | null;
  hit: HTMLButtonElement | null;
}

interface Sheet {
  canvas: HTMLCanvasElement;
  idleSpeed: number;
}

// ---------------------------------------------------------------- hits (transparent buttons over the art)

export interface DragPayload {
  kind: string;
  /** what the ghost looks like under the pointer */
  sprite: HTMLCanvasElement;
  data?: unknown;
}

export interface HitSpec {
  id: string;
  /** Portuguese name, read by screen readers with the English after a dot */
  label: string;
  rect: Rect;
  /** a click, a tap, Enter/Space */
  tap?: () => void;
  /** pointer held down / let go (spreading, cranking) */
  press?: (down: boolean) => void;
  /** start a drag from here; null when there is nothing to carry */
  drag?: () => DragPayload | null;
  /** something was dropped here; true when it was taken */
  drop?: (p: DragPayload) => boolean;
  /** highlight while a drag that this would take is over it */
  accepts?: (p: DragPayload) => boolean;
  disabled?: boolean;
  /** stacking for overlapping hits: higher wins */
  z?: number;
  /** a round piece (pan, bowl): the hover ring is a circle */
  round?: boolean;
}

interface HitNode {
  spec: HitSpec;
  btn: HTMLButtonElement;
  key: string;
}

// ---------------------------------------------------------------- layout

export interface StageLayout {
  W: number;
  H: number;
  zoom: number;
  portrait: boolean;
  /** art px under the DOM HUD */
  hudH: number;
  /** y of the top of the counter's front plank (customers stand behind it) */
  counterY: number;
  /** the cart's work top, under the plank */
  work: Rect;
  /** feet x of the three counter spots */
  spots: number[];
  /** where a bubble sits, per spot */
  bubbles: Rect[];
}

export interface StagePalette {
  /** awning stripes */
  awningA: string;
  awningB: string;
  /** the plaque on the counter front */
  plaque: string;
}

export interface StageConfig<O extends StageOrder> {
  game: FeiraGameId;
  prefix: string;
  title: string;
  orders: O[];
  durationMs: number;
  palette: StagePalette;
  /** pixel icons of what this customer asked for (shown in the bubble) */
  icons(order: O): HTMLCanvasElement[];
  layout(L: StageLayout): void;
  /** t = run ms (0 before the 3-2-1 ends) */
  update(dt: number, t: number): void;
  /** the cart's work top and every station on it */
  draw(g: Ctx, t: number, now: number): void;
  /** a tap on a customer (payload null) or something dropped on them */
  serve(c: StageCustomer<O>, payload: DragPayload | null): void;
  finish(outcomes: FeiraOrderOutcome[]): void;
}

const POINTS: Record<FeiraQuality, number> = { perfect: 48, ok: 32, soft: 16, miss: 0 };
const WALK_SPEED = 120; // art px per second
/** Feet sit this far under the top of the counter plank: waist up shows over it. */
const FEET = 6;
const MIN_ART = 180;

export type StageSfx = Parameters<typeof ambience.sfx>[0];

export type StageOrder = FeiraCustomerOrder & { line: { pt: string; en: string } };

export class FeiraStage<O extends StageOrder> {
  readonly root: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly g: Ctx;
  L: StageLayout = { W: 320, H: 200, zoom: 4, portrait: false, hudH: 11, counterY: 84, work: { x: 0, y: 92, w: 320, h: 108 }, spots: [40, 146, 252], bubbles: [] };
  /** run clock, ms (0 until the 3-2-1 is over) */
  t = 0;
  over = false;
  started = false;
  customers: StageCustomer<O>[] = [];
  outcomes: FeiraOrderOutcome[] = [];
  served = 0;
  left = 0;
  score = 0;
  combo = 0;
  drag: { payload: DragPayload; x: number; y: number } | null = null;

  private cfg: StageConfig<O>;
  private hitsEl: HTMLElement;
  private textEl: HTMLElement;
  private hits = new Map<string, HitNode>();
  private hitsSeen = new Set<string>();
  private particles: Particle[] = [];
  private shakeUntil = 0;
  private shakeMag = 0;
  private raf = 0;
  private last = 0;
  private runStart = 0;
  private nextSpawn = 0;
  private sheets = new Map<string, Sheet>();
  private assets: CharAssets | null = null;
  private backdrop: HTMLCanvasElement | null = null;
  private backdropKey = '';
  private timerEl: HTMLElement;
  private scoreEl: HTMLElement;
  private comboEl: HTMLElement;
  private crowdMark: HTMLElement;
  private crowdFill: HTMLElement;
  private bannerEl: HTMLElement;
  private queueChip: HTMLElement;
  private shownSecond = -1;
  private ro: ResizeObserver | null = null;
  private onResize = () => this.resize();
  private reduced = reducedMotion();
  private showEn = readShowEnglish();
  private pointer: { id: number; node: HitNode; x0: number; y0: number; pressed: boolean; moved: boolean } | null = null;
  private overHit: HitNode | null = null;

  constructor(cfg: StageConfig<O>) {
    this.cfg = cfg;
    this.canvas = h('canvas', { class: 'fst-canvas', 'aria-hidden': 'true' }) as HTMLCanvasElement;
    const g = this.canvas.getContext('2d');
    if (!g) throw new Error('2d canvas unavailable');
    this.g = g;
    this.hitsEl = h('div', { class: 'fst-hits' });
    this.textEl = h('div', { class: 'fst-text' });
    this.timerEl = h('b', { class: 'fst-clock', id: `${cfg.prefix}-timer` }, `${Math.ceil(cfg.durationMs / 1000)}s`);
    this.scoreEl = h('b', { class: 'fst-score', id: `${cfg.prefix}-live-score` }, '0');
    this.comboEl = h('span', { class: 'fst-combo', hidden: true });
    this.crowdMark = h('i', { class: 'fst-crowd-mark' });
    this.crowdFill = h('i', { class: 'fst-crowd-fill' });
    this.bannerEl = h('div', { class: 'fst-banner', hidden: true });
    this.queueChip = h('span', { class: 'fst-queue-chip', hidden: true });
    const hud = h('header', { class: 'fst-hud', id: `${cfg.prefix}-hud` },
      h('span', { class: 'fst-hud-title' }, cfg.title),
      h('span', { class: 'fst-hud-clock' }, h('i', { class: 'fst-clock-icon', 'aria-hidden': 'true' }), this.timerEl),
      h('div', { class: 'fst-crowd', id: `${cfg.prefix}-crowd` },
        h('span', { class: 'fst-crowd-label' }, FEIRA_CROWD_LABEL.pt, en(FEIRA_CROWD_LABEL.en)),
        h('span', { class: 'fst-crowd-bar' }, this.crowdFill, this.crowdMark),
      ),
      h('span', { class: 'fst-hud-score' }, this.scoreEl, h('small', null, 'pts'), this.comboEl),
      h('button', { type: 'button', class: 'fst-quit', id: `${cfg.prefix}-quit`, onclick: () => this.endRun() }, 'Sair', en('Quit')),
    );
    this.root = h('div', { id: `${cfg.prefix}-root`, class: `fst-root fst-game-${cfg.game}${this.showEn ? '' : ' fst-no-en'}` },
      this.canvas, this.hitsEl, this.textEl, hud, this.queueChip, this.bannerEl,
    );
    this.root.addEventListener('pointermove', (e) => this.pointerMove(e));
    this.root.addEventListener('pointerup', (e) => this.pointerUp(e));
    this.root.addEventListener('pointercancel', () => this.pointerCancel());
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
    document.body.classList.add('fst-on');
    document.getElementById('ui')?.append(this.root);
    window.addEventListener('resize', this.onResize);
    if (typeof ResizeObserver === 'function') {
      this.ro = new ResizeObserver(this.onResize);
      this.ro.observe(this.root);
    }
    // dev builds: the play scripts read the run's outcomes from here
    if (import.meta.env.DEV) (window as unknown as { __feiraStage?: unknown }).__feiraStage = this;
    void sharedCharAssets().then((a) => {
      this.assets = a;
    }, () => undefined);
    this.resize();
    this.paintCrowd();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    void this.countIn();
  }

  // ---------------------------------------------------------------- lifecycle

  destroy() {
    this.over = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.ro?.disconnect();
    document.body.classList.remove('fst-on');
    this.root.remove();
  }

  /** Swap the stage for the end card (the server's numbers). */
  showEnd(card: HTMLElement) {
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.root.classList.add('fst-ended');
    this.root.replaceChildren(card);
  }

  /** The 3-2-1. Waits while the how-to card is open, so nobody loses patience while you read. */
  private async countIn() {
    const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
    await wait(450);
    while (!this.over && document.getElementById('howto-card')) await wait(150);
    if (this.over) return;
    const beats: [string, string][] = [['3', ''], ['2', ''], ['1', ''], ['Abriu!', 'Open!']];
    for (const [pt, gl] of beats) {
      if (this.over) return;
      this.banner(pt, gl, 'count');
      this.sfx(pt === 'Abriu!' ? 'chime' : 'tick');
      await wait(pt === 'Abriu!' ? 650 : 520);
    }
    this.bannerEl.hidden = true;
    this.runStart = performance.now();
    this.started = true;
  }

  private banner(pt: string, gloss: string, kind: string) {
    this.bannerEl.className = `fst-banner fst-banner-${kind}`;
    this.bannerEl.replaceChildren(h('b', null, pt), gloss ? en(gloss) : '');
    this.bannerEl.hidden = false;
    void this.bannerEl.offsetWidth;
    this.bannerEl.classList.add('fst-banner-in');
  }

  /**
   * Stop the run (time up or Sair). Anyone at the counter or in line counts as gone; customers the seed had not
   * sent yet are not ours to report (the server counts arrivals by its own clock).
   */
  endRun() {
    if (this.over) return;
    this.over = true;
    const at = Math.round(this.t);
    for (const c of this.customers) {
      if (c.done) continue;
      if (this.outcomes.some((o) => o.i === c.index)) continue;
      this.outcomes.push({ i: c.index, quality: 'miss', atMs: at });
    }
    this.cfg.finish(this.outcomes);
  }

  // ---------------------------------------------------------------- frame

  private frame = (now: number) => {
    if (this.over) return;
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (this.started && !this.closing) {
      this.t = now - this.runStart;
      this.spawn(now);
      this.tickCustomers(now);
      this.cfg.update(dt, this.t);
      this.paintHud();
      if (this.t >= this.cfg.durationMs) {
        // time is up: the stalls close, a beat to read it, then the result goes to the server
        this.closing = true;
        this.banner('Fechou!', 'Closing time!', 'close');
        this.sfx('chime');
        window.setTimeout(() => this.endRun(), 1100);
      }
    }
    this.walk(dt, now);
    this.tickParticles(dt);
    this.draw(now);
    this.syncHits();
    this.raf = requestAnimationFrame(this.frame);
  };

  /** True from "Fechou!" until the result is sent: the clock and the stations stop. */
  closing = false;

  // ---------------------------------------------------------------- layout

  private resize() {
    const vw = Math.max(1, this.root.clientWidth || window.innerWidth);
    const vh = Math.max(1, this.root.clientHeight || window.innerHeight);
    const zoom = Math.max(1, Math.floor(Math.min(vw, vh) / MIN_ART));
    const W = Math.ceil(vw / zoom);
    const H = Math.ceil(vh / zoom);
    const portrait = W / H < 1.05;
    const hudH = Math.ceil((portrait ? 50 : 46) / zoom);
    let counterY: number;
    const spots: number[] = [];
    const bubbles: Rect[] = [];
    if (portrait) {
      const slot = W / 3;
      counterY = Math.round(Math.min(H * 0.42, hudH + 10 + Math.max(44, 168 / zoom) + 48));
      for (let i = 0; i < 3; i++) {
        const cx = Math.round(slot * i + slot / 2);
        spots.push(cx);
        bubbles.push({ x: Math.round(slot * i + 2), y: counterY - 50, w: Math.floor(slot - 4), h: 0 });
      }
    } else {
      counterY = Math.round(Math.max(hudH + 62, Math.min(H * 0.44, hudH + 80)));
      const slot = W / 3;
      for (let i = 0; i < 3; i++) {
        const x0 = slot * i;
        spots.push(Math.round(x0 + 22));
        bubbles.push({ x: Math.round(x0 + 40), y: hudH + 10, w: Math.floor(slot - 44), h: 0 });
      }
    }
    const workY = counterY + 9;
    this.L = { W, H, zoom, portrait, hudH, counterY, work: { x: 0, y: workY, w: W, h: H - workY }, spots, bubbles };
    this.canvas.width = W;
    this.canvas.height = H;
    this.canvas.style.width = `${W * zoom}px`;
    this.canvas.style.height = `${H * zoom}px`;
    this.root.style.setProperty('--z', String(zoom));
    this.root.classList.toggle('fst-portrait', portrait);
    this.g.imageSmoothingEnabled = false;
    this.cfg.layout(this.L);
    this.label('plaque', W / 2, counterY + 3, this.cfg.title, '', 'fst-plaque');
    for (const c of this.customers) this.placeBubble(c);
  }

  // ---------------------------------------------------------------- customers

  private spawn(now: number) {
    const orders = this.cfg.orders;
    while (this.nextSpawn < orders.length && orders[this.nextSpawn]!.at <= this.t) {
      const order = orders[this.nextSpawn]!;
      const c: StageCustomer<O> = {
        order,
        index: this.nextSpawn,
        spot: -1,
        x: this.L.W + 30 + this.customers.filter((k) => !k.done && k.spot < 0).length * 22,
        arrivedAt: 0,
        mood: 'walk',
        moodAt: now,
        emote: null,
        emoteAt: 0,
        done: false,
        bubble: null,
        hit: null,
      };
      this.customers.push(c);
      this.nextSpawn += 1;
    }
  }

  /** Customers at the counter, in spot order. */
  waiting(): StageCustomer<O>[] {
    return this.customers.filter((c) => !c.done && c.spot >= 0 && c.mood === 'wait').sort((a, b) => a.spot - b.spot);
  }

  /** True while this customer is at the counter waiting (a serve now counts). */
  servable(c: StageCustomer<O>): boolean {
    return !c.done && c.mood === 'wait' && !this.over && !this.closing;
  }

  /** 1 → 0 as patience runs out. */
  patience(c: StageCustomer<O>): number {
    if (c.mood !== 'wait') return 1;
    return Math.max(0, 1 - (this.t - c.arrivedAt) / c.order.patienceMs);
  }

  private tickCustomers(now: number) {
    // a free spot takes the next in line
    const taken = new Set(this.customers.filter((c) => !c.done && c.spot >= 0 && (c.mood === 'walk' || c.mood === 'wait')).map((c) => c.spot));
    for (const c of this.customers) {
      if (c.done || c.spot >= 0 || c.mood !== 'walk') continue;
      // the spot nearest the street end they walk in from
      const free = [2, 1, 0].find((s) => !taken.has(s));
      if (free === undefined) break;
      c.spot = free;
      taken.add(free);
    }
    let queued = 0;
    for (const c of this.customers) {
      if (c.done) continue;
      if (c.spot < 0) queued += 1;
      if (c.mood !== 'wait') continue;
      const p = this.patience(c);
      if (p <= 0) {
        this.outcomes.push({ i: c.index, quality: 'miss', atMs: Math.round(this.t) });
        this.left += 1;
        this.combo = 0;
        this.react(c, 'miss');
        this.floatAt(this.L.spots[c.spot]!, this.L.counterY - 34, 'Foi embora', 'miss');
        this.sfx('nope');
        this.paintCrowd();
      } else if (p < 0.3 && c.emote !== 'sweat' && c.emote !== 'anger') {
        this.emote(c, 'sweat', now);
      }
      if (c.bubble) c.bubble.classList.toggle('fst-hurry', p < 0.3);
    }
    this.queueChip.hidden = queued === 0;
    if (queued) this.queueChip.textContent = `+${queued} na fila`;
  }

  private walk(dt: number, now: number) {
    for (const c of this.customers) {
      if (c.done) continue;
      if (c.mood === 'walk') {
        const target = c.spot >= 0 ? this.L.spots[c.spot]! : this.L.W + 14 + this.queuePos(c) * 18;
        const dx = target - c.x;
        const step = WALK_SPEED * dt * (this.reduced ? 3 : 1);
        if (Math.abs(dx) <= step) {
          c.x = target;
          if (c.spot >= 0 && this.started) {
            c.mood = 'wait';
            c.moodAt = now;
            c.arrivedAt = this.t;
            this.openBubble(c);
          }
        } else c.x += Math.sign(dx) * step;
      } else if (c.mood === 'leave') {
        c.x -= WALK_SPEED * 1.25 * dt * (this.reduced ? 3 : 1);
        if (c.x < -30) {
          c.done = true;
          c.hit?.remove();
          c.hit = null;
        }
      } else if (c.mood !== 'wait' && now - c.moodAt > (c.mood === 'angry' ? 700 : 1200)) {
        c.mood = 'leave';
        c.moodAt = now;
      }
    }
  }

  private queuePos(c: StageCustomer<O>): number {
    let n = 0;
    for (const k of this.customers) {
      if (k === c) return n;
      if (!k.done && k.spot < 0) n += 1;
    }
    return n;
  }

  private openBubble(c: StageCustomer<O>) {
    const icons = this.cfg.icons(c.order).map((s) => spriteEl(s));
    const pips = h('span', { class: 'fst-patience', 'aria-hidden': 'true' }, h('i'));
    c.bubble = h('div', { class: 'fst-bubble', 'data-order': String(c.index), id: `${this.cfg.prefix}-order-${c.index}` },
      h('span', { class: 'fst-bubble-who' }, c.order.name, pips),
      h('p', { class: 'fst-bubble-pt', lang: 'pt-BR' }, c.order.line.pt),
      h('p', { class: 'en fst-bubble-en' }, c.order.line.en),
      h('span', { class: 'fst-ticket', 'aria-hidden': 'true' }, ...icons),
    );
    this.textEl.append(c.bubble);
    this.placeBubble(c);
    this.sfx('pop');
  }

  private placeBubble(c: StageCustomer<O>) {
    if (!c.bubble || c.spot < 0) return;
    const z = this.L.zoom;
    const b = this.L.bubbles[c.spot]!;
    c.bubble.style.left = `${b.x * z}px`;
    c.bubble.style.width = `${b.w * z}px`;
    if (this.L.portrait) {
      c.bubble.style.top = '';
      c.bubble.style.bottom = `${(this.L.H - (this.L.counterY - 56)) * z}px`;
    } else {
      c.bubble.style.bottom = '';
      c.bubble.style.top = `${b.y * z}px`;
    }
  }

  private closeBubble(c: StageCustomer<O>) {
    const b = c.bubble;
    c.bubble = null;
    if (!b) return;
    b.classList.add('fst-bubble-out');
    window.setTimeout(() => b.remove(), 260);
  }

  private emote(c: StageCustomer<O>, e: Emote, now = performance.now()) {
    c.emote = e;
    c.emoteAt = now;
  }

  /** Mark the customer served (or not) and play their reaction. Returns the points the server will give. */
  record(c: StageCustomer<O>, quality: FeiraQuality, why?: { pt: string; en: string }): number {
    if (!this.servable(c)) return 0;
    this.outcomes.push({ i: c.index, quality, atMs: Math.round(this.t) });
    const before = this.score;
    if (quality === 'perfect') {
      this.combo += 1;
      this.score += POINTS.perfect + Math.min(12, (this.combo - 1) * 4);
    } else {
      this.combo = 0;
      this.score += POINTS[quality];
    }
    const pts = this.score - before;
    const x = this.L.spots[c.spot]!;
    const y = this.L.counterY - 34;
    if (quality === 'miss') {
      this.left += 1;
      this.floatAt(x, y, why?.pt ?? 'Ih…', 'miss');
      this.sfx('nope');
      this.shake(2, 220);
    } else {
      this.served += 1;
      this.floatAt(x, y, `+${pts}`, quality);
      if (why) this.floatAt(x, y + 10, why.pt, 'soft');
      this.sfx(quality === 'perfect' ? 'cash' : 'ding');
      if (quality === 'perfect' && this.combo >= 2) window.setTimeout(() => this.sfx('combo'), 160);
      this.burst(x, this.L.counterY - 20, quality === 'perfect' ? 14 : 8, [C.gold, C.goldHi, '#ffffff']);
    }
    this.react(c, quality);
    this.paintCrowd();
    return pts;
  }

  private react(c: StageCustomer<O>, quality: FeiraQuality) {
    const now = performance.now();
    c.mood = quality === 'perfect' ? 'happy' : quality === 'ok' ? 'ok' : quality === 'soft' ? 'meh' : 'angry';
    c.moodAt = now;
    this.emote(c, quality === 'perfect' ? 'heart' : quality === 'ok' ? 'note' : quality === 'soft' ? 'meh' : 'anger', now);
    this.closeBubble(c);
  }

  // ---------------------------------------------------------------- sheets

  private sheetFor(c: StageCustomer<O>): Sheet | null {
    if (!this.assets) return null;
    const id = c.order.who;
    let sheet = this.sheets.get(id);
    if (sheet) return sheet;
    try {
      const { appearance, hat } = whoAppearance({ name: c.order.name, npc: id as NpcId });
      const look = id ? lookForNpc(id, appearance, hat) : lookForAppearance(appearance, { hat });
      const cv = document.createElement('canvas');
      cv.width = this.assets.sheetW;
      cv.height = this.assets.sheetH;
      cv.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(composeLook(this.assets, look)), this.assets.sheetW, this.assets.sheetH), 0, 0);
      sheet = { canvas: cv, idleSpeed: look.idle.speed };
      this.sheets.set(id, sheet);
      return sheet;
    } catch {
      return null;
    }
  }

  private drawCustomer(c: StageCustomer<O>, now: number) {
    const g = this.g;
    const feet = this.L.counterY + FEET;
    const sheet = this.sheetFor(c);
    const meta = this.assets?.manifest.sheet;
    const x = Math.round(c.x);
    // a soft shadow on the street
    g.fillStyle = 'rgba(42,34,51,0.22)';
    g.fillRect(x - 11, feet - 3, 22, 3);
    if (!sheet || !meta) {
      fill(g, x - 8, feet - 56, 16, 56, C.navy);
      disc(g, x, feet - 50, 7, C.woodHi);
      return;
    }
    const [fw, fh] = meta.frame;
    const a = meta.anims;
    let row = a.idle.rows![0]!;
    let col = Math.floor((now / 1000) * (a.idle.fps ?? 5) * sheet.idleSpeed) % a.idle.frames;
    const since = now - c.moodAt;
    if (c.mood === 'walk' || c.mood === 'leave') {
      row = a.walk.rows![1]!; // facing W: they come in from the right and leave to the left
      col = Math.floor((now / 1000) * (a.walk.fps ?? 10)) % a.walk.frames;
    } else if (c.mood === 'happy') {
      row = a.dancar.row ?? 13;
      col = Math.floor((since / 1000) * (a.dancar.fps ?? 8)) % a.dancar.frames;
    } else if (c.mood === 'ok') {
      row = a.valeu.row ?? 15;
      col = Math.min(a.valeu.frames - 1, Math.floor((since / 1000) * (a.valeu.fps ?? 8)));
    } else if (c.mood === 'meh') {
      row = a.oi.row ?? 12;
      col = Math.floor((since / 1000) * (a.oi.fps ?? 8)) % a.oi.frames;
    } else if (c.mood === 'angry') {
      row = a.desculpa.row ?? 16;
      col = Math.min(a.desculpa.frames - 1, Math.floor((since / 1000) * (a.desculpa.fps ?? 8)));
    } else if (c.mood === 'wait' && this.patience(c) < 0.3) {
      // tapping a foot: the idle runs fast
      col = Math.floor((now / 1000) * (a.idle.fps ?? 5) * 2.4) % a.idle.frames;
    }
    const shake = c.mood === 'angry' && since < 400 ? (Math.floor(since / 50) % 2 ? 1 : -1) : 0;
    const hop = c.mood === 'happy' && !this.reduced ? -Math.round(Math.abs(Math.sin(since / 110)) * 3) : 0;
    g.drawImage(sheet.canvas, col * fw, row * fh, fw, fh, x - fw + shake, feet - fh * 2 + hop, fw * 2, fh * 2);
  }

  private drawCustomerTop(c: StageCustomer<O>, now: number) {
    const g = this.g;
    const x = Math.round(c.x);
    // the 16x32 frame has a little air over the hair; the head starts about 10 art px down at 2x
    const head = this.L.counterY + FEET - 52;
    if (c.mood === 'wait') {
      // patience: a little bar over the head, green → yellow → red
      const p = this.patience(c);
      const w = 22;
      fill(g, x - w / 2 - 1, head - 6, w + 2, 4, C.ink);
      fill(g, x - w / 2, head - 5, w, 2, '#5a4a5e');
      const col = p > 0.55 ? '#5fc76a' : p > 0.3 ? C.gold : C.red;
      fill(g, x - w / 2, head - 5, Math.max(1, Math.round(w * p)), 2, col);
      if (p < 0.3 && Math.floor(now / 220) % 2) fill(g, x - w / 2, head - 5, Math.max(1, Math.round(w * p)), 2, '#ffffff');
    }
    if (c.emote) {
      const age = now - c.emoteAt;
      if (age > 1600 && c.emote !== 'sweat') c.emote = null;
      else {
        const e = rows(`emote-${c.emote}`, EMOTES[c.emote], EMOTE_PAL, null);
        const rise = this.reduced ? 0 : Math.min(6, Math.floor(age / 60));
        const bob = c.emote === 'sweat' ? Math.floor(now / 300) % 2 : 0;
        blit(g, e, x + 6, head - 14 - rise + bob);
      }
    }
  }

  // ---------------------------------------------------------------- drawing

  private draw(now: number) {
    const g = this.g;
    g.save();
    if (now < this.shakeUntil && !this.reduced) {
      const m = this.shakeMag;
      g.translate(Math.round((Math.random() * 2 - 1) * m), Math.round((Math.random() * 2 - 1) * m));
    }
    g.drawImage(this.backdropCanvas(), 0, 0);
    // customers stand on the street, in front of the stalls, behind the cart
    const order = this.customers.filter((c) => !c.done).sort((a, b) => (a.spot < 0 ? 1 : 0) - (b.spot < 0 ? 1 : 0));
    for (const c of order) this.drawCustomer(c, now);
    this.drawCartFront();
    this.cfg.draw(g, this.t, now);
    for (const c of order) this.drawCustomerTop(c, now);
    this.drawParticles();
    if (this.drag) {
      const s = this.drag.payload.sprite;
      g.globalAlpha = 0.92;
      blit(g, s, this.drag.x, this.drag.y - 4, true);
      g.globalAlpha = 1;
    }
    g.restore();
  }

  /** Sky, the other barracas, bunting and the cart's awning. Cached per size. */
  private backdropCanvas(): HTMLCanvasElement {
    const { W, H, counterY, hudH } = this.L;
    const key = `${W}x${H}:${counterY}:${hudH}`;
    if (this.backdrop && this.backdropKey === key) return this.backdrop;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d')!;
    const p = this.cfg.palette;
    // sky: two bands with a dithered seam
    const skyBottom = counterY;
    fill(g, 0, 0, W, skyBottom, C.sky);
    fill(g, 0, 0, W, Math.round(skyBottom * 0.45), '#8cc8ec');
    for (let x = 0; x < W; x += 2) g.fillRect(x + ((Math.round(skyBottom * 0.45) / 1) % 2), Math.round(skyBottom * 0.45), 1, 1);
    // clouds
    g.fillStyle = C.white;
    const cloud = (cx: number, cy: number, s: number) => {
      oval(g, cx, cy, 9 * s, 3 * s, C.white);
      oval(g, cx - 6 * s, cy + 1, 6 * s, 2.5 * s, C.white);
      oval(g, cx + 5 * s, cy - 2 * s, 5 * s, 3 * s, C.white);
      fill(g, cx - 12 * s, cy + 2 * s, 22 * s, 1, C.skyHi);
    };
    cloud(W * 0.18, hudH + 10, 1);
    cloud(W * 0.72, hudH + 16, 0.8);
    // far trees and roofs
    const horizon = counterY - 30;
    for (let x = -4; x < W + 8; x += 11) {
      const r = 7 + ((x * 7) % 5);
      disc(g, x, horizon - 4 + ((x * 3) % 4), r, '#5aa85a');
      disc(g, x - 2, horizon - 6 + ((x * 3) % 4), r - 3, '#7cc472');
    }
    fill(g, 0, horizon, W, counterY - horizon, '#c9b08a');
    // the other barracas across the street: posts, striped awnings, crates
    const stallColors: [string, string][] = [['#e63f38', '#fffdf6'], ['#4995e3', '#fffdf6'], ['#f2c230', '#e07a2c'], ['#3d9a4a', '#fff59a'], ['#c44536', '#f2c230']];
    let sx = -10;
    let k = 0;
    while (sx < W + 10) {
      const sw = 44 + ((k * 13) % 14);
      const [a, b] = stallColors[k % stallColors.length]!;
      const top = horizon - 16;
      fill(g, sx + 2, top + 8, 2, 22, C.woodLo);
      fill(g, sx + sw - 4, top + 8, 2, 22, C.woodLo);
      for (let i = 0; i < sw; i += 4) fill(g, sx + i, top, 4, 7, Math.floor(i / 4) % 2 ? b : a);
      for (let i = 0; i < sw; i += 4) fill(g, sx + i + 1, top + 7, 2, 1, Math.floor(i / 4) % 2 ? b : a);
      fill(g, sx, top - 1, sw, 1, C.ink);
      fill(g, sx + 4, top + 18, sw - 8, 7, C.woodMid);
      fill(g, sx + 4, top + 18, sw - 8, 1, C.woodHi);
      for (let i = 6; i < sw - 8; i += 5) disc(g, sx + i, top + 16, 2, ['#e63f38', '#f2c230', '#3d9a4a', '#ed931e'][(i + k) % 4]!);
      sx += sw + 6;
      k += 1;
    }
    // the street
    fill(g, 0, horizon + 14, W, counterY - horizon - 14, '#d9c29a');
    for (let x = 0; x < W; x += 7) for (let y = horizon + 16; y < counterY; y += 5) g.fillRect(x + (y % 2) * 3, y, 2, 1);
    g.fillStyle = '#c9b08a';
    // bunting strung across
    const by = hudH + 4;
    for (let x = 0; x < W; x++) {
      const sag = Math.round(Math.sin((x / W) * Math.PI) * 6);
      g.fillStyle = C.ink;
      g.fillRect(x, by + sag, 1, 1);
      if (x % 9 === 0) {
        const cols = ['#e63f38', '#f2c230', '#3d9a4a', '#4995e3', '#ed931e'];
        const c = cols[(x / 9) % cols.length]!;
        for (let r = 0; r < 5; r++) fill(g, x + Math.floor(r / 2), by + sag + 1 + r, 5 - r, 1, c);
      }
    }
    // the cart's awning along the very top (under the HUD)
    const aw = hudH + 1;
    for (let x = 0; x < W; x += 8) {
      const c = Math.floor(x / 8) % 2 ? p.awningB : p.awningA;
      fill(g, x, 0, 8, aw, c);
      // scallops
      for (let r = 0; r < 3; r++) fill(g, x + r, aw + r, 8 - r * 2, 1, c);
    }
    fill(g, 0, aw - 1, W, 1, 'rgba(42,34,51,0.35)');
    // the cart's posts at the sides
    fill(g, 0, aw, 4, counterY - aw, C.woodMid);
    fill(g, W - 4, aw, 4, counterY - aw, C.woodMid);
    fill(g, 3, aw, 1, counterY - aw, C.woodLo);
    fill(g, W - 4, aw, 1, counterY - aw, C.woodHi);
    this.backdrop = cv;
    this.backdropKey = key;
    return cv;
  }

  /** The counter's front plank (customers are cut off behind it) with the game's plaque. */
  private drawCartFront() {
    const g = this.g;
    const { W, counterY } = this.L;
    const p = this.cfg.palette;
    fill(g, 0, counterY, W, 9, C.wood);
    fill(g, 0, counterY, W, 1, C.woodHi);
    fill(g, 0, counterY + 1, W, 1, '#c79260');
    fill(g, 0, counterY + 8, W, 1, C.woodDk);
    for (let x = 18; x < W; x += 36) fill(g, x, counterY + 2, 1, 6, C.woodLo);
    // plaque
    const pw = Math.min(56, Math.round(W * 0.26));
    const px0 = Math.round(W / 2 - pw / 2);
    fill(g, px0 - 1, counterY - 3, pw + 2, 12, C.ink);
    fill(g, px0, counterY - 2, pw, 10, p.plaque);
    fill(g, px0, counterY - 2, pw, 1, 'rgba(255,255,255,0.45)');
    // the title is DOM text over the plaque (crisp at any zoom)
  }

  // ---------------------------------------------------------------- hits

  /** Declare (or update) a hit for this frame. Hits not declared in a frame are removed. */
  hit(spec: HitSpec) {
    this.hitsSeen.add(spec.id);
    let node = this.hits.get(spec.id);
    if (!node) {
      const btn = h('button', { type: 'button', class: 'fst-hit', id: spec.id }) as HTMLButtonElement;
      node = { spec, btn, key: '' };
      const n = node;
      btn.addEventListener('pointerdown', (e) => this.pointerDown(e, n));
      btn.addEventListener('click', (e) => {
        // keyboard (and synthetic clicks) arrive as click with no pointer press in progress
        if ((e as MouseEvent).detail === 0 && this.started && !this.over && !this.closing) n.spec.tap?.();
      });
      this.hitsEl.append(btn);
      this.hits.set(spec.id, node);
    }
    node.spec = spec;
    const z = this.L.zoom;
    const r = spec.rect;
    const key = `${r.x},${r.y},${r.w},${r.h},${z},${spec.label},${spec.disabled ? 1 : 0},${spec.z ?? 0},${spec.round ? 1 : 0}`;
    if (key !== node.key) {
      node.key = key;
      const b = node.btn;
      b.style.left = `${r.x * z}px`;
      b.style.top = `${r.y * z}px`;
      b.style.width = `${r.w * z}px`;
      b.style.height = `${r.h * z}px`;
      b.style.zIndex = String(spec.z ?? 0);
      b.setAttribute('aria-label', spec.label);
      b.title = spec.label;
      b.disabled = !!spec.disabled;
      b.classList.toggle('fst-round', !!spec.round);
    }
  }

  private syncHits() {
    // customer hits are declared here so every game gets them for free
    for (const c of this.customers) {
      if (c.done || c.mood !== 'wait') continue;
      // the whole column is theirs: drop on the person or on their bubble
      const slot = this.L.W / 3;
      const top = this.L.hudH + 2;
      this.hit({
        id: `${this.cfg.prefix}-serve-${c.index}`,
        label: `Servir ${c.order.name} · Serve`,
        rect: { x: Math.round(slot * c.spot) + 2, y: top, w: Math.floor(slot) - 4, h: this.L.counterY + FEET - top },
        tap: () => this.cfg.serve(c, null),
        drop: (p) => {
          this.cfg.serve(c, p);
          return true;
        },
        accepts: () => true,
        z: 1,
      });
    }
    for (const [id, node] of this.hits) {
      if (this.hitsSeen.has(id)) continue;
      node.btn.remove();
      this.hits.delete(id);
    }
    this.hitsSeen.clear();
  }

  private toArt(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / this.L.zoom, y: (e.clientY - r.top) / this.L.zoom };
  }

  private pointerDown(e: PointerEvent, node: HitNode) {
    // nothing to touch before the 3-2-1 is over, or once the stalls close
    if (this.over || this.closing || !this.started || node.spec.disabled) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    this.pointer = { id: e.pointerId, node, x0: e.clientX, y0: e.clientY, pressed: false, moved: false };
    if (node.spec.press) {
      this.pointer.pressed = true;
      node.spec.press(true);
    }
    node.btn.classList.add('fst-down');
  }

  private pointerMove(e: PointerEvent) {
    const p = this.pointer;
    if (!p || p.id !== e.pointerId) return;
    const dist = Math.hypot(e.clientX - p.x0, e.clientY - p.y0);
    if (!p.moved && dist > 8 && p.node.spec.drag) {
      const payload = p.node.spec.drag();
      if (payload) {
        p.moved = true;
        if (p.pressed) {
          p.pressed = false;
          p.node.spec.press?.(false);
        }
        this.drag = { payload, ...this.toArt(e) };
        this.root.classList.add('fst-dragging');
        this.sfx('grab');
      }
    }
    if (this.drag) {
      const a = this.toArt(e);
      this.drag.x = a.x;
      this.drag.y = a.y;
      const over = this.hitAt(a.x, a.y, this.drag.payload);
      if (over !== this.overHit) {
        this.overHit?.btn.classList.remove('fst-over');
        over?.btn.classList.add('fst-over');
        this.overHit = over;
      }
    }
  }

  private hitAt(x: number, y: number, payload: DragPayload): HitNode | null {
    let best: HitNode | null = null;
    for (const node of this.hits.values()) {
      const s = node.spec;
      if (!s.drop || s.disabled) continue;
      if (s.accepts && !s.accepts(payload)) continue;
      const r = s.rect;
      if (x < r.x || y < r.y || x > r.x + r.w || y > r.y + r.h) continue;
      if (!best || (s.z ?? 0) > (best.spec.z ?? 0)) best = node;
    }
    return best;
  }

  private pointerUp(e: PointerEvent) {
    const p = this.pointer;
    if (!p || p.id !== e.pointerId) return;
    this.pointer = null;
    p.node.btn.classList.remove('fst-down');
    if (this.drag) {
      const d = this.drag;
      this.drag = null;
      this.root.classList.remove('fst-dragging');
      this.overHit?.btn.classList.remove('fst-over');
      this.overHit = null;
      const a = this.toArt(e);
      const target = this.hitAt(a.x, a.y, d.payload);
      if (!target || !target.spec.drop?.(d.payload)) this.sfx('slap');
      return;
    }
    if (p.pressed) p.node.spec.press?.(false);
    else if (!p.moved) p.node.spec.tap?.();
  }

  private pointerCancel() {
    const p = this.pointer;
    this.pointer = null;
    if (p?.pressed) p.node.spec.press?.(false);
    p?.node.btn.classList.remove('fst-down');
    this.drag = null;
    this.root.classList.remove('fst-dragging');
  }

  // ---------------------------------------------------------------- juice

  sfx(kind: StageSfx) {
    if (game.sound) ambience.sfx(kind);
  }

  shake(mag = 2, ms = 200) {
    this.shakeMag = mag;
    this.shakeUntil = performance.now() + ms;
  }

  /** Little squares flying out from a point. */
  burst(x: number, y: number, n: number, colors: string[], opts: { up?: number; spread?: number; gravity?: number; life?: number; size?: number } = {}) {
    if (this.reduced) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (opts.spread ?? 40) * (0.4 + Math.random() * 0.6);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - (opts.up ?? 30),
        ay: opts.gravity ?? 120,
        life: 0,
        max: (opts.life ?? 0.7) * (0.6 + Math.random() * 0.5),
        c: colors[i % colors.length]!,
        s: opts.size ?? 1,
      });
    }
  }

  /** One drifting particle (steam, smoke, goma dust, juice drops). */
  puff(x: number, y: number, c: string, opts: { vx?: number; vy?: number; ay?: number; life?: number; size?: number } = {}) {
    if (this.reduced && Math.random() < 0.6) return;
    this.particles.push({ x, y, vx: opts.vx ?? (Math.random() - 0.5) * 6, vy: opts.vy ?? -10, ay: opts.ay ?? 0, life: 0, max: opts.life ?? 0.9, c, s: opts.size ?? 1 });
  }

  private tickParticles(dt: number) {
    for (const p of this.particles) {
      p.life += dt;
      p.vy += p.ay * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life < p.max);
    if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400);
  }

  private drawParticles() {
    const g = this.g;
    for (const p of this.particles) {
      const k = 1 - p.life / p.max;
      g.globalAlpha = Math.max(0, Math.min(1, k * 1.6));
      g.fillStyle = p.c;
      g.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
    }
    g.globalAlpha = 1;
  }

  /** Floating text at an art-px point (crisp DOM text). */
  floatAt(x: number, y: number, text: string, kind: FeiraQuality | 'info' | 'bad' = 'info') {
    const z = this.L.zoom;
    const el = h('span', { class: `fst-float fst-float-${kind}`, 'aria-hidden': 'true' }, text);
    el.style.left = `${x * z}px`;
    el.style.top = `${y * z}px`;
    this.textEl.append(el);
    window.setTimeout(() => el.remove(), 1200);
  }

  /** A short bilingual pop in the middle of the work top. */
  pop(line: { pt: string; en: string }, kind: 'good' | 'bad' | 'info' = 'info') {
    const z = this.L.zoom;
    const el = h('div', { class: `fst-pop fst-pop-${kind}`, role: 'status' }, h('b', null, line.pt), en(line.en));
    el.style.left = `${(this.L.W / 2) * z}px`;
    el.style.top = `${(this.L.work.y + 4) * z}px`;
    this.textEl.querySelectorAll('.fst-pop').forEach((n) => n.remove());
    this.textEl.append(el);
    window.setTimeout(() => el.remove(), 1300);
  }

  /** A small DOM label pinned to an art-px point, for station names (kept until removed). */
  label(id: string, x: number, y: number, pt: string, gloss: string, cls = ''): HTMLElement {
    let el = this.textEl.querySelector<HTMLElement>(`[data-label="${id}"]`);
    if (!el) {
      el = h('span', { class: `fst-label ${cls}`.trim(), 'data-label': id, 'aria-hidden': 'true' }, h('b', null, pt), en(gloss));
      this.textEl.append(el);
    }
    const z = this.L.zoom;
    const pos = `${Math.round(x * z)},${Math.round(y * z)}`;
    if (el.dataset.pos !== pos) {
      el.dataset.pos = pos;
      el.style.left = `${Math.round(x * z)}px`;
      el.style.top = `${Math.round(y * z)}px`;
    }
    const b = el.querySelector('b');
    if (b && b.textContent !== pt) {
      b.textContent = pt;
      const e = el.querySelector('.en');
      if (e) e.textContent = gloss;
    }
    const want = `fst-label ${cls}`.trim();
    if (el.className !== want) el.className = want;
    return el;
  }

  dropLabel(id: string) {
    this.textEl.querySelector(`[data-label="${id}"]`)?.remove();
  }

  private paintHud() {
    const left = Math.max(0, Math.ceil((this.cfg.durationMs - this.t) / 1000));
    if (left !== this.shownSecond) {
      this.shownSecond = left;
      this.timerEl.textContent = `${left}s`;
      this.timerEl.classList.toggle('fst-late', left <= 10);
      if (left <= 5 && left > 0) this.sfx('tick');
    }
    const s = String(this.score);
    if (this.scoreEl.textContent !== s) {
      this.scoreEl.textContent = s;
      this.scoreEl.classList.remove('fst-bump');
      void this.scoreEl.offsetWidth;
      this.scoreEl.classList.add('fst-bump');
    }
    const combo = this.combo >= 2 ? `×${this.combo}` : '';
    if (this.comboEl.textContent !== combo) {
      this.comboEl.textContent = combo;
      this.comboEl.hidden = !combo;
    }
  }

  private paintCrowd() {
    const pos = Math.round(feiraCrowd(this.served, this.left) * 100);
    this.crowdMark.style.left = `${pos}%`;
    this.crowdFill.style.left = `${Math.min(50, pos)}%`;
    this.crowdFill.style.width = `${Math.abs(pos - 50)}%`;
    const meter = this.crowdMark.closest('.fst-crowd');
    meter?.classList.toggle('fst-up', pos > 50);
    meter?.classList.toggle('fst-down', pos < 50);
  }
}
