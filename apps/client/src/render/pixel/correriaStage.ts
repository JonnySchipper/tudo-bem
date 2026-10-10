/**
 * "Correria no Balcão" in the world (Phaser side). Everything happens behind the padaria counter, no modal:
 *  - a wooden work board over the counter area with the shelves, the estufa, the geladeira, the chapa, the coffee machine, the
 *    espremedor (the orange juicer: one tap, one orange through roll / cut / press / pour / peel, the glass with its line), the
 *    register, the tip jar, the bell, the tray, the bag and the plate (`correriaArt.ts` is the art contract and the layout);
 *  - every piece is a transparent DOM button over its sprite (taps work on phones, the keyboard can focus them, e2e can click them);
 *  - the customers queue at the front on the character sheets, with a patience meter and a speech bubble;
 *  - juice: the tray hop, the chapa sizzle and steam, the coffee stream and meter, emote pops, the tip jar clink, the bell, a nudge on
 *    a combo, and the baker cheering from the side (all off under `reducedMotion()`).
 * It reads `correriaFeed` (written by ui/correria.ts); missing art is a magenta box and a note in `artMissing` (HOWTO 5.10).
 */
import Phaser from 'phaser';
import {
  CHAPA,
  CHAPA_ITEMS,
  CAFE_ITEMS,
  JUICE,
  MG_ITEMS,
  POUR,
  SHELF_OF,
  SUCO_ITEMS,
  chapaFrame,
  chapaPhase,
  juicerStep,
  npcDefById,
  patienceStage,
  pourFrame,
  pourZone,
  tipJarStage,
  whoAppearance,
  type CEvent,
  type CustomerView,
  type CorreriaSnap,
} from '@tudobem/shared';
import type { Manifest } from './manifest';
import { animKey } from './charsheet';
import { lookForAppearance, lookForNpc, type Look } from './looks';
import { correriaFeed, type StageCue } from './correriaFeed';
import { game } from '../../state';
import { originOf } from './spriteUtil';
import { DEPTH } from './props';
import {
  ART,
  BOARD,
  CRATE_KEY,
  JUICE_LINE_ROWS,
  juiceGlassKey,
  juiceRows,
  juicerKey,
  orangeKey,
  type JuicerFrame,
  CHAPA_ITEM_SCALE,
  ITEM_SCALE,
  TRAY_ITEM_SCALE,
  bellKey,
  chapaKey,
  coffeeKey,
  counterLayout,
  itemKey,
  patienceKey,
  sizeOfKey,
  steamKey,
  tipjarKey,
  traySlot,
  type CounterLayout,
  type Spot,
} from './correriaArt';

export interface CounterHost {
  scene: Phaser.Scene;
  world: <G extends Phaser.GameObjects.GameObject>(o: G) => G;
  manifest: Manifest;
  noteMissing: (key: string) => void;
  acquireSheet: (look: Look) => string;
  releaseSheet: (key: string) => void;
  toCanvas: (wx: number, wy: number) => { px: number; py: number };
  cssScale: () => number;
  reduced: () => boolean;
  /** the screenshots hook: no waiting for walk-ins */
  instant: () => boolean;
}

/** Depths: above every prop and avatar of the room (they run 0..~150), below the overhead and lighting layers. */
const D = { board: 2000, piece: 2010, tray: 2020, item: 2030, customer: 2100, fx: 2300, hud: 2400 } as const;
const WALK_PX_S = 46;
const POP_MS = 1500;
/** How long an overflowed glass shows its spill frame, and how long a short glass takes to run out. */
const SPILL_MS = 1100;
const DRAIN_MS = 420;

type Img = Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;

/** Suco's shelf cell holds a crate of oranges (the juice itself comes out of the espremedor). */
const shelfKey = (id: string): string => (SUCO_ITEMS.includes(id) ? CRATE_KEY : itemKey(id));
/** The next orange's size, said on the machine: pequena / média / grande. */
const SIZE_WORD = { p: { pt: 'pequena', en: 'small' }, m: { pt: 'média', en: 'medium' }, g: { pt: 'grande', en: 'big' } } as const;
/** The coffee machine's tap label through a pour (needs_br: "Extra quente!"). */
const MACHINE_LABELS = {
  idle: { pt: 'Cafeteira', en: 'Tap to pour' },
  filling: { pt: 'Enchendo…', en: 'Filling… wait for green' },
  agora: { pt: 'Agora!', en: 'Tap now!' },
  quente: { pt: 'Extra quente!', en: 'Extra hot!' },
  over: { pt: 'Derramando!', en: 'Spilling!' },
} as const;

/** A sprite that can change its manifest key; a missing key is a magenta box of the contracted size. */
class Piece {
  private img: Img | null = null;
  private key = '';
  constructor(
    private readonly h: CounterHost,
    private readonly depth: number,
    private readonly spot: Spot,
  ) {}

  set(key: string, opts: { scale?: number; alpha?: number; dx?: number; dy?: number; spot?: Spot } = {}): void {
    const scene = this.h.scene;
    const at = opts.spot ?? this.spot;
    const x = Math.round(at.x + (opts.dx ?? 0));
    const y = Math.round(at.y + (opts.dy ?? 0));
    if (key !== this.key || !this.img) {
      this.img?.destroy();
      this.key = key;
      const d = this.h.manifest.sprites[key];
      if (d) this.img = this.h.world(scene.add.image(x, y, d.atlas, d.frame)).setOrigin(...originOf(d));
      else {
        this.h.noteMissing(key);
        const [w, hh, ax, ay] = sizeOfKey(key) ?? [16, 16, 8, 16];
        this.img = this.h.world(scene.add.rectangle(x, y, w, hh, 0xff00ff, 0.4)).setOrigin(ax / w, ay / hh).setStrokeStyle(1, 0xff00ff, 1);
      }
    }
    const i = this.img!;
    i.setPosition(x, y).setDepth(this.depth + y / 1000).setScale(opts.scale ?? 1).setAlpha(opts.alpha ?? 1).setVisible(true);
  }

  hide(): void {
    this.img?.setVisible(false);
  }

  destroy(): void {
    this.img?.destroy();
    this.img = null;
    this.key = '';
  }

  get obj(): Img | null {
    return this.img;
  }
}

interface CustomerView2 {
  id: number;
  sheet: string;
  spr: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  meter: Piece;
  x: number;
  y: number;
  face: 'S' | 'E' | 'W';
  moving: boolean;
  leaving: boolean;
  who: CustomerView['who'];
  bubble: HTMLElement;
  tag: HTMLElement;
  bubbleSig: string;
  speakUntil: number;
  slot: number;
  state: CustomerView['state'];
}

interface Particle {
  img: Img;
  vx: number;
  vy: number;
  life: number;
  max: number;
  /** Juice drops and peels fall (px/s²) and snap to whole pixels; steam floats. */
  grav?: number;
  fx?: number;
  fy?: number;
}

export class CounterStage {
  private epoch = -1;
  private nowMs = 0;
  private built = false;
  private board: Phaser.GameObjects.Graphics | null = null;
  private meters: Phaser.GameObjects.Graphics | null = null;
  private items = new Map<string, Piece>();
  private trayBase: Piece | null = null;
  private trayMinis: Piece[] = [];
  private bag: Piece | null = null;
  private plate: Piece | null = null;
  private chapa: Piece | null = null;
  private chapaItems: Piece[] = [];
  private coffee: Piece | null = null;
  private cup: Piece | null = null;
  private juicer: Piece | null = null;
  private glass: Piece | null = null;
  private nextOrange: Piece | null = null;
  /** The glass just overflowed (a server `juice_bad` spill): show the overflow frame until then. */
  private spillUntil = 0;
  /**
   * The orange that overflowed the glass. The server empties the glass at once, so the stage plays that orange through the machine
   * here: the glass rises past the line to the rim, and when the pour ends it spills (`spillUntil`, drips, a shake).
   */
  private ghost: { prev: number; fill: number; at: number; spilt: boolean } | null = null;
  /** A short glass tipped out (a server `juice_bad` short): its level runs down to nothing from `from`. */
  private drain: { from: number; at: number } | null = null;
  /** A finished glass on its way from the drip tray to its slot on the tray (the slot's miniature waits until it lands). */
  private flight: { img: Img; from: Spot; to: Spot; t: number; dur: number; idx: number } | null = null;
  /** The glass level drawn on the last frame (a spill or a toss starts from it). */
  private lastFill = 0;
  /** The orange count whose arrival at the line was already cheered (one "na linha" per glass). */
  private lineCheered = -1;
  /** The last juicer step drawn (a splash on entering the press). */
  private lastStep = 'idle';
  private register: Piece | null = null;
  private bell: Piece | null = null;
  private jar: Piece | null = null;
  private customers = new Map<number, CustomerView2>();
  private baker: { id: string; bubble: HTMLElement } | null = null;
  private particles: Particle[] = [];
  private hop: { piece: Piece; t: number; dur: number }[] = [];
  private textures: string[] = [];
  private nudge = { x: 0, y: 0 };
  private bellUntil = 0;
  private steamAt = 0;
  private lastTray: string[] = [];
  private lastTips = 0;
  /** Items made at least once this shift: their NOVO badge goes away. */
  private tried = new Set<string>();
  private pops: { el: HTMLElement; wx: number; wy: number; until: number }[] = [];
  private hotEl: HTMLElement | null = null;
  private popsEl: HTMLElement | null = null;
  /** Tap targets; `on` is false for a piece this shift's layout leaves off the board. */
  private hot = new Map<string, { el: HTMLButtonElement; spot: Spot; w: number; h: number; on: boolean }>();
  private hotSig = '';
  private hotSnap = '';
  private pouring = false;
  /** Where everything stands this shift (only what is on the menu, in this room). */
  private L: CounterLayout = counterLayout(null);
  private layoutSig = '';

  constructor(private readonly h: CounterHost) {}

  // this shift's spots of the stations (a juice or coffee effect only ever plays while that station is on the board)
  private get jg(): Spot {
    return this.L.juiceGlass ?? this.L.tray;
  }
  private get jc(): Spot {
    return this.L.juiceChamber ?? this.L.tray;
  }
  private get pb(): Spot {
    return this.L.peelBin ?? this.L.tray;
  }
  private get jsp(): Spot {
    return this.L.juiceSpout ?? this.L.tray;
  }
  private get cs(): Spot {
    return this.L.coffee ?? this.L.tray;
  }
  private get cps(): Spot {
    return this.L.chapa ?? this.L.tray;
  }

  get active(): boolean {
    return correriaFeed.active;
  }

  cameraNudge(): { x: number; y: number } {
    return this.nudge;
  }

  // ------------------------------------------------------------------ build
  private img(key: string, spot: Spot, depth: number, opts: { scale?: number } = {}): Piece {
    const p = new Piece(this.h, depth, spot);
    p.set(key, opts);
    return p;
  }

  private build(): void {
    if (this.built) return;
    this.built = true;
    const s = this.h.scene;
    this.board = this.h.world(s.add.graphics()).setDepth(D.board);
    this.meters = this.h.world(s.add.graphics()).setDepth(D.hud);
    const L = this.L;
    const nowhere: Spot = { x: L.w / 2, y: L.h / 2 };
    for (const i of MG_ITEMS) this.items.set(i.id, this.img(shelfKey(i.id), L.cells[i.id] ?? nowhere, D.item));
    this.juicer = new Piece(this.h, D.piece, nowhere);
    this.glass = new Piece(this.h, D.item + 5, nowhere);
    this.nextOrange = new Piece(this.h, D.item + 4, nowhere);
    this.trayBase = this.img(ART.tray, L.tray, D.tray);
    this.bag = new Piece(this.h, D.piece, nowhere);
    this.plate = new Piece(this.h, D.piece, nowhere);
    this.chapa = new Piece(this.h, D.piece, nowhere);
    this.coffee = new Piece(this.h, D.piece, nowhere);
    this.register = this.img(ART.register, L.register, D.piece);
    this.bell = this.img(bellKey(0), L.bell, D.piece);
    this.jar = this.img(tipjarKey(0), L.tipjar, D.piece);
    this.cup = new Piece(this.h, D.item + 5, nowhere);
    this.ensureDom();
  }

  /** This shift's board (its menu, this room): the layout, the camera frame, the planks and where each tap target goes. */
  private relayout(snap: CorreriaSnap): void {
    const room = game.roomDef;
    const dims = room ? { cols: room.cols, rows: room.rows } : undefined;
    const sig = `${(snap.menu ?? []).join(',')}|${dims?.cols ?? ''}x${dims?.rows ?? ''}`;
    if (sig === this.layoutSig) return;
    this.layoutSig = sig;
    const L = (this.L = counterLayout(snap.menu, dims));
    correriaFeed.frame = { focus: L.focus, need: L.need };
    this.drawBoard();
    const at = (id: string): Spot | null => {
      if (id.startsWith('item-')) return L.cells[id.slice(5)] ?? null;
      if (id.startsWith('grill-')) return L.chapaSlots[Number(id.slice(6))] ?? null;
      if (id === 'juice-glass') return L.juiceGlass ? { x: L.juiceGlass.x, y: L.juiceGlass.y + 1 } : null;
      return ({ machine: L.coffee, juicer: L.juicer, bag: L.bag, plate: L.plate, tray: L.tray, bell: L.bell } as Record<string, Spot | null>)[id] ?? null;
    };
    for (const [id, h] of this.hot) {
      const s = at(id);
      h.on = !!s;
      if (s) h.spot = s;
    }
    this.hotSnap = '';
  }

  /** The flat wooden plate the pieces stand on: planks, a lip and a few rail lines. Code-drawn surface, never stands in for missing art. */
  private drawBoard(): void {
    const g = this.board;
    if (!g) return;
    const L = this.L;
    const { x0, y0, x1, y1 } = L.board;
    // the shelf part stops at the shelf top; the station column (the juicer on top) rises to y0
    const sy = L.shelfTop;
    const tx = L.towerX;
    g.clear();
    g.fillStyle(0x3b2314, 1).fillRect(x0 - 2, sy - 2, x1 - x0 + 4, y1 - sy + 4);
    if (sy > y0) g.fillStyle(0x3b2314, 1).fillRect(tx - 2, y0 - 2, x1 - tx + 4, sy - y0 + 2);
    g.fillStyle(0xcf9b62, 1).fillRect(x0, sy, x1 - x0, y1 - sy);
    if (sy > y0) g.fillStyle(0xcf9b62, 1).fillRect(tx, y0, x1 - tx, sy - y0);
    // planks
    for (let y = y0 + 8; y < y1; y += 14) {
      const from = y < sy ? tx : x0;
      g.fillStyle(0xbd8850, 1).fillRect(from, y, x1 - from, 1);
    }
    g.fillStyle(0xe2b97e, 1).fillRect(x0, sy, tx - x0, 2);
    g.fillStyle(0xe2b97e, 1).fillRect(tx, y0, x1 - tx, 2);
    g.fillStyle(0x8a5a32, 1).fillRect(x0, y1 - 3, x1 - x0, 3);
    // a rail under each shelf row
    for (const ry of L.rails) g.fillStyle(0x9c6a3a, 1).fillRect(x0 + 6, ry, L.railW, 1);
    // the station column (the juicer over the coffee machine over the chapa)
    const low = Math.max(L.chapa?.y ?? -Infinity, L.coffee?.y ?? -Infinity, L.juicer?.y ?? -Infinity);
    if (Number.isFinite(low)) {
      const ch = low + 4 - (y0 + 5);
      g.fillStyle(0xb98048, 1).fillRect(tx + 2, y0 + 5, x1 - tx - 5, ch);
      g.fillStyle(0x8a5a32, 1).fillRect(tx + 2, y0 + 5, 1, ch);
    }
    // the service strip along the front (pack row and register row)
    const strip = L.h - 68;
    g.fillStyle(0xc28c54, 1).fillRect(x0 + 3, strip, tx - 5, y1 - 1 - strip);
    g.fillStyle(0x8a5a32, 1).fillRect(x0 + 3, strip, tx - 5, 1);
  }

  private ensureDom(): void {
    const mk = (id: string, cls: string): HTMLElement => {
      document.getElementById(id)?.remove();
      const el = document.createElement('div');
      el.id = id;
      el.className = cls;
      return el;
    };
    this.popsEl = mk('cr-pops', 'cr-pops');
    this.popsEl.setAttribute('aria-hidden', 'true');
    this.hotEl = mk('cr-hot', 'cr-hot');
    this.hotEl.setAttribute('role', 'group');
    this.hotEl.setAttribute('aria-label', 'Balcão');
    const ui = document.getElementById('ui');
    // `position: fixed` layers paint in DOM order: the taps go over the world and its labels, under the overlay (#ui)
    for (const el of [this.hotEl, this.popsEl]) {
      if (ui?.parentElement) ui.parentElement.insertBefore(el, ui);
      else document.body.append(el);
    }
    const on = correriaFeed;
    /** Tap starts the pour; the cup fills alone; a second tap stops it. Not a pointer hold. */
    const togglePour = (itemId?: string) => {
      if (this.pouring) {
        this.pouring = false;
        on.on.pourEnd();
        return;
      }
      const id = itemId || on.cup || 'cafe';
      on.cup = id;
      this.pouring = true;
      on.on.pourStart(id);
    };
    const btn = (id: string, cls: string, spot: Spot, w: number, h: number, label: string, labelEn: string, handlers: Partial<Record<'click' | 'down' | 'up', () => void>>): void => {
      const b = document.createElement('button');
      b.type = 'button';
      b.id = `cr-${id}`;
      b.className = `cr-hit ${cls}`;
      b.dataset.hit = id;
      b.setAttribute('aria-label', labelEn ? `${label} (${labelEn})` : label);
      if (label) {
        const pt = document.createElement('span');
        pt.className = 'cr-lab';
        pt.textContent = label;
        b.append(pt);
        if (labelEn) {
          const en = document.createElement('span');
          en.className = 'cr-lab-en';
          en.textContent = labelEn;
          b.append(en);
        }
      }
      if (handlers.click) b.addEventListener('click', handlers.click);
      if (handlers.down) {
        const down = (e: Event) => {
          e.preventDefault();
          handlers.down!();
        };
        b.addEventListener('pointerdown', down);
        b.addEventListener('keydown', (e) => {
          if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) down(e);
        });
      }
      if (handlers.up) {
        b.addEventListener('pointerup', handlers.up);
        b.addEventListener('pointercancel', handlers.up);
        b.addEventListener('pointerleave', () => {
          if (this.pouring) handlers.up!();
        });
        b.addEventListener('keyup', (e) => {
          if (e.key === ' ' || e.key === 'Enter') handlers.up!();
        });
      }
      this.hotEl!.append(b);
      this.hot.set(id, { el: b, spot, w, h, on: true });
    };
    // every target is made once; `relayout` moves them to this shift's spots and hides the ones off the board
    const spot: Spot = { x: 0, y: 0 };
    for (const it of MG_ITEMS) {
      const id = it.id;
      const isCup = CAFE_ITEMS.includes(id);
      const isJuice = SUCO_ITEMS.includes(id);
      // the crate in suco's cell feeds the juicer, like a tap on the machine
      const labels = isJuice ? { pt: 'laranjas', en: 'oranges' } : { pt: it.card.form, en: it.card.gloss_en };
      btn(`item-${id}`, `cr-item shelf-${SHELF_OF[id]}`, spot, 25, 22, labels.pt, labels.en, {
        click: isCup ? () => togglePour(id) : isJuice ? () => on.on.juiceDrop() : () => (CHAPA_ITEMS.includes(id) ? on.on.chapaPut(id) : on.on.grab(id)),
      });
    }
    btn('machine', 'cr-machine', spot, 32, 40, 'Cafeteira', 'Tap to pour', {
      click: () => togglePour(),
    });
    // the espremedor: a tap anywhere on it drops one orange; the glass on its tray is its own target (tap it at the line)
    btn('juicer', 'cr-juicer', spot, 40, 42, 'Espremedor', 'Juicer · 1 tap = 1 orange', { click: () => on.on.juiceDrop() });
    btn('juice-glass', 'cr-glass', spot, 16, 14, '', 'Glass: tap it at the line', { click: () => on.on.juiceTake() });
    {
      const glass = this.hot.get('juice-glass')!.el;
      glass.setAttribute('aria-label', 'Copo de suco: toque na linha (Juice glass: tap it at the line)');
      // the line's name beside its red ticks, and the next orange's size over the hopper
      const line = document.createElement('span');
      line.className = 'cr-word cr-line-word';
      // the hit box is 14 rows over the glass's 12 (from row 2), and the line is glass row 9 - 7 + 1
      line.style.top = `${(((2 + (9 - JUICE_LINE_ROWS + 1)) / 14) * 100).toFixed(1)}%`;
      line.innerHTML = '<b>linha</b><i>line</i>';
      glass.append(line);
      const juicer = this.hot.get('juicer')!.el;
      const next = document.createElement('span');
      next.className = 'cr-word cr-next-word';
      juicer.append(next);
      const bin = document.createElement('span');
      bin.className = 'cr-word cr-bin-word';
      bin.innerHTML = '<b>bagaço</b><i>peels</i>';
      juicer.append(bin);
    }
    for (let i = 0; i < 2; i++) btn(`grill-${i}`, 'cr-grill', spot, 16, 16, '', '', { click: () => on.on.chapaTake(i) });
    btn('bag', 'cr-pack', spot, 24, 30, 'Sacola', 'Bag (to go)', { click: () => on.on.pack('bag') });
    btn('plate', 'cr-pack', spot, 28, 14, 'Prato', 'Plate (for here)', { click: () => on.on.pack('plate') });
    btn('tray', 'cr-tray', spot, 64, 18, '', 'Tray (tap to empty it)', { click: () => on.on.clear() });
    btn('bell', 'cr-bell', spot, 22, 16, 'Entregar', 'Serve', { click: () => on.on.serve() });
    this.layoutSig = '';
    this.hotEl!.style.display = 'none';
  }

  // ------------------------------------------------------------------ lifecycle
  private start(): void {
    this.build();
    this.epoch = correriaFeed.epoch;
    this.clearCustomers();
    this.clearParticles();
    this.lastTray = [];
    this.lastTips = 0;
    this.tried.clear();
    this.bellUntil = 0;
    this.pouring = false;
    this.spillUntil = 0;
    this.ghost = null;
    this.drain = null;
    this.dropFlight();
    this.lastFill = 0;
    this.lineCheered = -1;
    this.lastStep = 'idle';
    this.nudge = { x: 0, y: 0 };
  }

  private stop(): void {
    if (!this.built) return;
    this.hotEl && (this.hotEl.style.display = 'none');
    this.board?.setVisible(false);
    this.meters?.clear();
    for (const p of [...this.items.values(), this.trayBase, this.bag, this.plate, this.chapa, this.coffee, this.cup, this.juicer, this.glass, this.nextOrange, this.register, this.bell, this.jar, ...this.trayMinis, ...this.chapaItems]) p?.hide();
    this.clearCustomers();
    this.clearParticles();
    this.dropFlight();
    if (this.baker) {
      this.baker.bubble.remove();
      this.baker = null;
    }
    this.popsEl?.replaceChildren();
    this.pops = [];
    this.nudge = { x: 0, y: 0 };
  }

  private clearCustomers(): void {
    for (const c of this.customers.values()) this.dropCustomer(c);
    this.customers.clear();
  }

  private dropCustomer(c: CustomerView2): void {
    this.h.releaseSheet(c.sheet);
    c.spr.destroy();
    c.shadow.destroy();
    c.meter.destroy();
    c.bubble.remove();
    c.tag.remove();
  }

  private clearParticles(): void {
    for (const p of this.particles) p.img.destroy();
    this.particles = [];
  }

  // ------------------------------------------------------------------ per frame
  update(dt: number, nowMs: number): void {
    this.nowMs = nowMs;
    if (!correriaFeed.active) {
      if (this.epoch !== -1) {
        this.stop();
        this.epoch = -1;
      }
      return;
    }
    if (this.epoch !== correriaFeed.epoch) this.start();
    const snap = correriaFeed.snap;
    if (!snap) return;
    this.relayout(snap);
    this.board!.setVisible(true);
    this.hotEl!.style.display = '';
    for (const c of correriaFeed.drain()) this.onCue(c, snap);
    const reduced = this.h.reduced();
    this.nudge = reduced ? { x: 0, y: 0 } : { x: Math.round(this.nudge.x * 0.6), y: Math.round(this.nudge.y * 0.6) };
    const age = (nowMs - correriaFeed.snapAt) * 1; // ms since the snapshot arrived
    this.drawPieces(snap, age);
    this.syncCustomers(snap, dt, age);
    this.syncBaker(snap);
    this.drawMeters(snap, age);
    this.stepParticles(dt);
    this.stepFlight(dt);
    this.stepHops(dt);
    this.placeHot(snap);
    this.stepPops();
  }

  /** Only what is on this shift's menu stands on the board (`relayout`): a locked item is not there at all, not even greyed out. */
  private drawPieces(snap: CorreriaSnap, age: number): void {
    const L = this.L;
    // what this shift added wears a NOVO badge until it is first made
    const fresh = new Set((snap.ladder?.fresh ?? []).filter((id) => !this.tried.has(id)));
    for (const it of MG_ITEMS) {
      const p = this.items.get(it.id)!;
      const cell = L.cells[it.id];
      if (cell) p.set(shelfKey(it.id), { scale: ITEM_SCALE, spot: cell });
      else p.hide();
      this.hot.get(`item-${it.id}`)?.el.classList.toggle('cr-new', fresh.has(it.id));
    }
    this.hot.get('juicer')?.el.classList.toggle('cr-new', SUCO_ITEMS.some((id) => fresh.has(id)));
    this.hot.get('machine')?.el.classList.toggle('cr-new', CAFE_ITEMS.some((id) => fresh.has(id)));
    const machine = this.hot.get('machine');
    if (machine) {
      const live = !!snap.pour || this.pouring;
      // idle → filling ("espere…") → "Agora!" in the green → "Extra quente!" in the red → "Derramando!" past it
      const zone = snap.pour ? pourZone((snap.pour.age + age) / snap.pourMs) : live ? 'filling' : 'idle';
      const lab = MACHINE_LABELS[zone];
      if (machine.el.dataset.zone !== zone) {
        machine.el.dataset.zone = zone;
        const pt = machine.el.querySelector('.cr-lab');
        const en = machine.el.querySelector('.cr-lab-en');
        if (pt) pt.textContent = lab.pt;
        if (en) en.textContent = lab.en;
        machine.el.setAttribute('aria-label', `${lab.pt} (${lab.en})`);
      }
    }
    // the tray: the base plus a miniature per item (a full one past five)
    const tray = snap.tray;
    this.trayBase!.set(tray.length >= 7 ? ART.trayFull : ART.tray, { spot: L.tray });
    while (this.trayMinis.length < tray.length) this.trayMinis.push(new Piece(this.h, D.item + 1, L.tray));
    this.trayMinis.forEach((m, i) => {
      // a juice glass still flying over from the machine lands in its slot before the miniature shows
      if (i >= tray.length || this.flight?.idx === i) return m.hide();
      m.set(itemKey(tray[i]!), { scale: TRAY_ITEM_SCALE, spot: traySlot(i, L.tray) });
    });
    if (tray.length > this.lastTray.length) {
      const idx = tray.length - 1;
      const m = this.trayMinis[idx];
      if (m && !this.h.reduced()) this.hop.push({ piece: m, t: 0, dur: 0.28 });
    }
    this.lastTray = [...tray];
    // bag and plate (once packing is on the orders): the chosen one lifts and glows
    if (L.bag) this.bag!.set(ART.bag, { alpha: snap.pack === 'plate' ? 0.55 : 1, dy: snap.pack === 'bag' ? -3 : 0, spot: L.bag });
    else this.bag!.hide();
    if (L.plate) this.plate!.set(ART.plate, { alpha: snap.pack === 'bag' ? 0.55 : 1, dy: snap.pack === 'plate' ? -3 : 0, spot: L.plate });
    else this.plate!.hide();
    // the chapa: the busiest slot decides the frame, its items sit on the grill
    const slots = snap.chapa;
    let worst: 'idle' | 'sizzle_0' | 'sizzle_1' | 'sizzle_2' | 'burnt' = 'idle';
    const rank = { idle: 0, sizzle_0: 1, sizzle_1: 2, sizzle_2: 3, burnt: 4 } as const;
    while (this.chapaItems.length < slots.length) this.chapaItems.push(new Piece(this.h, D.item + 2, L.tray));
    slots.forEach((s, i) => {
      const gp = this.chapaItems[i]!;
      const at = L.chapaSlots[i];
      if (!s || !at) return gp.hide();
      const a = s.age + age;
      const f = chapaFrame(a);
      if (rank[f] > rank[worst]) worst = f;
      gp.set(itemKey(s.item), { scale: CHAPA_ITEM_SCALE, alpha: f === 'burnt' ? 0.55 : 1, spot: at });
    });
    if (L.chapa) this.chapa!.set(chapaKey(worst), { spot: L.chapa });
    else this.chapa!.hide();
    // the machine: the pour frames while a pour runs, with the cup under the spout
    if (!L.coffee || !L.spout) {
      this.coffee!.hide();
      this.cup!.hide();
    } else if (snap.pour) {
      const fill = (snap.pour.age + age) / snap.pourMs;
      this.coffee!.set(coffeeKey(pourFrame(Math.min(1.2, fill))), { spot: L.coffee });
      this.cup!.set(itemKey(snap.pour.item), { scale: 0.7, dy: 2, spot: L.spout });
    } else {
      this.coffee!.set(coffeeKey('idle'), { spot: L.coffee });
      this.cup!.hide();
    }
    this.drawJuicer(snap, age);
    this.register!.set(ART.register, { spot: L.register });
    this.bell!.set(bellKey(this.nowMs < this.bellUntil ? 1 : 0), { spot: L.bell });
    const jar = tipJarStage(snap.stats.tips);
    this.jar!.set(tipjarKey(jar), { spot: L.tipjar });
    if (snap.stats.tips > this.lastTips && !this.h.reduced()) this.hop.push({ piece: this.jar!, t: 0, dur: 0.22 });
    this.lastTips = snap.stats.tips;
  }

  /** Where the juicer is in its cycle for this frame ('idle' when no orange is going through); a spilling orange plays through too. */
  private juiceStep(snap: CorreriaSnap, age: number): ReturnType<typeof juicerStep> {
    if (snap.juice) return juicerStep(snap.juice.age + age);
    return this.ghost ? juicerStep(this.nowMs - this.ghost.at) : 'idle';
  }

  /**
   * The espremedor: the machine frame by the step of its cycle (roll, cut, press, pour, peel; `ready` with the green lamp once the
   * glass is at the line), the glass filling from the level before this orange to the new one while it pours, the next orange waiting
   * on the feeder, and the beats that win or lose the glass: "na linha" when it reaches the line, the overflow (the orange plays
   * through, the glass rises to the rim and spills), a short glass tipped out. Under reduced motion the cycle is not played: the
   * machine stays idle (or ready) and the glass shows the server's level at once.
   */
  private drawJuicer(snap: CorreriaSnap, age: number): void {
    const L = this.L;
    if (!L.juicer || !L.juiceGlass || !L.hopperNext) {
      // no suco on this menu: no juicer on the board
      this.juicer!.hide();
      this.glass!.hide();
      this.nextOrange!.hide();
      return;
    }
    const locked = false;
    const reduced = this.h.reduced();
    const j = snap.juice;
    // a new orange (the server's glass is back) ends a spill or a toss still on screen
    if (j) {
      this.ghost = null;
      this.drain = null;
    }
    const step = reduced ? 'idle' : this.juiceStep(snap, age);
    if (this.ghost && step === 'idle') this.ghost = null;
    const atLine = !!j && step === 'idle' && j.fill >= JUICE.goodMin;
    const frame: JuicerFrame = atLine ? 'ready' : step;
    this.juicer!.set(juicerKey(frame), { spot: L.juicer });
    if (step === 'press' && this.lastStep !== 'press') this.splash();
    if (step === 'peel' && this.lastStep !== 'peel') this.peelDrop();
    this.lastStep = step;
    // the beat when the pour ends: this orange either brought the glass to the line or took it over the rim
    const t = j ? j.age + age : this.ghost ? this.nowMs - this.ghost.at : 0;
    const poured = reduced || t >= JUICE.cycleMs * 0.84;
    if (j && poured && j.prev < JUICE.goodMin && j.fill >= JUICE.goodMin && this.lineCheered !== j.oranges) {
      this.lineCheered = j.oranges;
      this.popWord(L.juiceGlass.x, L.juiceGlass.y - 14, 'na linha!', 'at the line', 'good');
      this.sparkle(L.juiceGlass.x, L.juiceGlass.y - 12, 0x8ff0a4);
    }
    if (!j) this.lineCheered = -1;
    const g = this.ghost;
    if (g && !g.spilt && poured) {
      g.spilt = true;
      this.overflow();
    }
    // the next orange waits on the feeder (while one rolls in, the machine frame draws it)
    const next = snap.hopper?.[0];
    if (next && !locked && step !== 'roll') this.nextOrange!.set(orangeKey(next), { spot: L.hopperNext });
    else this.nextOrange!.hide();
    // the glass: the overflow frame after a spill, a tipped-out glass running down, else the level (eased while it pours, whole rows)
    const fill = this.shownFill(snap, age);
    this.lastFill = j ? fill : 0;
    if (this.nowMs < this.spillUntil) this.glass!.set(juiceGlassKey('spill'), { spot: L.juiceGlass });
    else if (g || j || this.drain) this.glass!.set(juiceGlassKey(juiceRows(fill)), { spot: L.juiceGlass });
    else this.glass!.set(juiceGlassKey(0), { spot: L.juiceGlass });
    const hot = this.hot.get('juicer');
    if (hot) {
      hot.el.disabled = locked;
      hot.el.dataset.step = step;
      hot.el.dataset.frame = frame;
      const word = hot.el.querySelector<HTMLElement>('.cr-next-word');
      const w = next ? SIZE_WORD[next] : null;
      const text = w ? `${w.pt}|${w.en}` : '';
      if (word && word.dataset.v !== text) {
        word.dataset.v = text;
        word.innerHTML = w ? `<b>${w.pt}</b><i>${w.en}</i>` : '';
      }
    }
    const glass = this.hot.get('juice-glass');
    if (glass) {
      glass.el.disabled = locked;
      const fill = j?.fill ?? 0;
      glass.el.dataset.state = !j ? 'empty' : fill >= JUICE.goodMin ? 'ready' : 'short';
      // what the glass is showing besides its level (e2e and shots): an overflow, a tipped-out glass
      glass.el.dataset.fx = this.nowMs < this.spillUntil ? 'spill' : this.ghost ? 'overfill' : this.drain ? 'drain' : '';
    }
  }

  /** The juice level to draw: the server's, or on its way there while this orange pours (a spilling one too, a tipped-out one running down). */
  private shownFill(snap: CorreriaSnap, age: number): number {
    const j = snap.juice;
    const src = j ? { prev: j.prev, fill: j.fill, t: j.age + age } : this.ghost ? { prev: this.ghost.prev, fill: this.ghost.fill, t: this.nowMs - this.ghost.at } : null;
    if (!src) {
      const d = this.drain;
      if (!d) return 0;
      const u = (this.nowMs - d.at) / DRAIN_MS;
      if (u >= 1 || this.h.reduced()) {
        this.drain = null;
        return 0;
      }
      return d.from * (1 - u);
    }
    if (this.h.reduced()) return src.fill;
    const a = JUICE.cycleMs * 0.58;
    const b = JUICE.cycleMs * 0.84;
    if (src.t <= a) return src.prev;
    if (src.t >= b) return src.fill;
    return src.prev + ((src.fill - src.prev) * (src.t - a)) / (b - a);
  }

  /** A few juice drops off the press (crisp 1 px squares, no tween of the sprite itself). */
  private splash(): void {
    if (this.h.reduced()) return;
    const s = this.h.scene;
    for (let i = 0; i < 4; i++) {
      const img = this.h.world(s.add.rectangle(this.jc.x + (i - 1.5) * 2, this.jc.y, 1, 1, i % 2 ? 0xffb43a : 0xf6a021, 1)).setOrigin(0, 0);
      img.setDepth(D.fx);
      this.particles.push({ img, vx: (i - 1.5) * 9, vy: -14 - Math.random() * 6, life: 0, max: 0.35, grav: 120 });
    }
  }

  /** The glass overflows: the spill frame for a moment, juice running over the rim and down onto the drip tray, a shake, a 💦. */
  private overflow(): void {
    this.spillUntil = this.nowMs + SPILL_MS;
    this.kick();
    this.popAt(this.jg.x, this.jg.y - 16, '💦');
    if (this.h.reduced()) return;
    const s = this.h.scene;
    for (let i = 0; i < 8; i++) {
      const side = i % 2 ? 1 : -1;
      const img = this.h.world(s.add.rectangle(this.jg.x + side * (6 + (i % 3)), this.jg.y - 11 + (i >> 1), 1, 1, i % 3 ? 0xf6a021 : 0xffd778, 1)).setOrigin(0, 0);
      img.setDepth(D.fx);
      this.particles.push({ img, vx: side * (6 + Math.random() * 10), vy: -8 - Math.random() * 10, life: 0, max: 0.55, grav: 140 });
    }
  }

  /** A short glass tipped out: it runs down to nothing, a few drops fall off the tray. */
  private tipOut(from: number): void {
    this.drain = { from, at: this.nowMs };
    this.popAt(this.jg.x, this.jg.y - 16, '…');
    if (this.h.reduced()) return;
    const s = this.h.scene;
    for (let i = 0; i < 3; i++) {
      const img = this.h.world(s.add.rectangle(this.jg.x - 3 + i * 3, this.jg.y, 1, 1, 0xf6a021, 1)).setOrigin(0, 0);
      img.setDepth(D.fx);
      this.particles.push({ img, vx: (i - 1) * 4, vy: 4, life: 0, max: 0.4, grav: 90 });
    }
  }

  /** A little burst of pixels (the glass at the line, a glass landing on the tray). */
  private sparkle(x: number, y: number, color: number): void {
    if (this.h.reduced()) return;
    const s = this.h.scene;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const img = this.h.world(s.add.rectangle(Math.round(x), Math.round(y), 1, 1, i % 2 ? color : 0xfff2d0, 1)).setOrigin(0, 0);
      img.setDepth(D.fx);
      this.particles.push({ img, vx: Math.cos(a) * 26, vy: Math.sin(a) * 26 - 8, life: 0, max: 0.4, grav: 40 });
    }
  }

  /** The finished glass leaves the drip tray in a hop and lands in its slot on the tray. */
  private flyGlass(fill: number, idx: number): void {
    this.dropFlight();
    if (this.h.reduced() || idx < 0) return;
    const d = this.h.manifest.sprites[juiceGlassKey(juiceRows(fill))];
    if (!d) return;
    const from = { x: this.jg.x, y: this.jg.y };
    const img = this.h.world(this.h.scene.add.image(from.x, from.y, d.atlas, d.frame)).setOrigin(...originOf(d)).setDepth(D.fx);
    this.flight = { img, from, to: traySlot(idx, this.L.tray), t: 0, dur: 0.46, idx };
  }

  private stepFlight(dt: number): void {
    const f = this.flight;
    if (!f) return;
    f.t += dt;
    const u = Math.min(1, f.t / f.dur);
    // an arc over the counter, shrinking to the tray's miniature size as it lands
    const x = f.from.x + (f.to.x - f.from.x) * u;
    const y = f.from.y + (f.to.y - f.from.y) * u - Math.sin(u * Math.PI) * 26;
    f.img.setPosition(Math.round(x), Math.round(y)).setScale(1 - (1 - TRAY_ITEM_SCALE * 1.4) * u);
    if (u < 1) return;
    const idx = f.idx;
    this.dropFlight();
    this.sparkle(f.to.x, f.to.y - 6, 0xffd778);
    const m = this.trayMinis[idx];
    if (m) {
      m.set(itemKey(correriaFeed.snap?.tray[idx] ?? 'suco_de_laranja'), { scale: TRAY_ITEM_SCALE, spot: traySlot(idx, this.L.tray) });
      this.hop.push({ piece: m, t: 0, dur: 0.24 });
    }
  }

  private dropFlight(): void {
    this.flight?.img.destroy();
    this.flight = null;
  }

  /** A short word that rises off a piece, Portuguese first with the gloss under it when English is on (`good` green, `bad` red). */
  private popWord(wx: number, wy: number, pt: string, en: string, tone: 'good' | 'bad'): void {
    if (!this.popsEl) return;
    const el = document.createElement('div');
    el.className = `cr-pop cr-pop-word ${tone}`;
    const b = document.createElement('b');
    b.textContent = pt;
    el.append(b);
    if (correriaFeed.showEn) {
      const i = document.createElement('i');
      i.textContent = en;
      el.append(i);
    }
    const { px, py } = this.h.toCanvas(wx, wy);
    el.style.left = `${Math.round(px)}px`;
    el.style.top = `${Math.round(py)}px`;
    this.popsEl.append(el);
    this.pops.push({ el, wx, wy, until: this.nowMs + POP_MS });
  }

  /** The two spent peels tumble the last pixels into the bin (bagaço). */
  private peelDrop(): void {
    if (this.h.reduced()) return;
    const s = this.h.scene;
    for (let i = 0; i < 2; i++) {
      const img = this.h.world(s.add.rectangle(this.pb.x + i * 2, this.pb.y - 4 + i, 2, 1, i ? 0xb4520e : 0xe07a14, 1)).setOrigin(0, 0);
      img.setDepth(D.fx);
      this.particles.push({ img, vx: -4, vy: 6, life: 0, max: 0.3, grav: 60 });
    }
  }

  private stepHops(dt: number): void {
    this.hop = this.hop.filter((h) => {
      h.t += dt;
      const u = Math.min(1, h.t / h.dur);
      const o = h.piece.obj;
      if (o) o.y += -Math.sin(u * Math.PI) * 6;
      return u < 1;
    });
  }

  // ------------------------------------------------------------------ customers
  private slotOrder(snap: CorreriaSnap): CustomerView[] {
    const front = snap.customers.filter((c) => c.state === 'front');
    const rest = snap.customers.filter((c) => c.state !== 'front');
    return [...front, ...rest];
  }

  private lookOf(w: CustomerView['who']): Look {
    const { appearance, hat } = whoAppearance(w);
    return w.npc ? lookForNpc(w.npc, appearance, hat) : lookForAppearance(appearance, { hat });
  }

  private syncCustomers(snap: CorreriaSnap, dt: number, age: number): void {
    const order = this.slotOrder(snap);
    const seen = new Set<number>();
    order.forEach((cv, slot) => {
      seen.add(cv.id);
      let c = this.customers.get(cv.id);
      if (!c) {
        const sheet = this.h.acquireSheet(this.lookOf(cv.who));
        const s = this.h.scene;
        const spr = this.h.world(s.add.sprite(this.L.door.x, this.L.door.y, sheet, 0)).setOrigin(0.5, 1);
        const shadow = this.h.world(s.add.ellipse(0, 0, 13, 5, 0x000000, 0.28)).setDepth(D.customer - 1);
        const bubble = document.createElement('div');
        bubble.className = 'cr-bubble';
        bubble.style.display = 'none';
        this.popsEl!.append(bubble);
        const tag = document.createElement('div');
        tag.className = `cr-tag${cv.regular ? ' regular' : ''}`;
        tag.textContent = `${cv.regular ? '♥ ' : ''}${cv.who.name}`;
        this.popsEl!.append(tag);
        c = { id: cv.id, sheet, spr, shadow, meter: new Piece(this.h, D.hud + 1, this.L.door), x: this.h.instant() ? this.L.queue[Math.min(slot, 2)]!.x : this.L.door.x, y: this.L.queue[Math.min(slot, 2)]!.y, face: 'E', moving: true, leaving: false, who: cv.who, bubble, tag, bubbleSig: '', speakUntil: 0, slot, state: cv.state };
        this.customers.set(cv.id, c);
      }
      c.slot = slot;
      c.state = cv.state;
      const to = this.L.queue[Math.min(slot, this.L.queue.length - 1)]!;
      this.walk(c, to, dt);
      // patience meter over the head (frozen while they walk in and once served)
      const left = cv.patience - cv.rate * age;
      const frac = cv.patienceMax ? Math.max(0, left / cv.patienceMax) : 0;
      const showMeter = cv.state === 'front' || cv.state === 'queue';
      if (showMeter) c.meter.set(patienceKey(patienceStage(frac)));
      else c.meter.hide();
      const mo = c.meter.obj;
      if (mo) mo.setPosition(Math.round(c.x), Math.round(c.y - 37)).setDepth(D.hud + 1);
      this.bubbleFor(c, cv);
    });
    for (const c of [...this.customers.values()]) {
      if (seen.has(c.id)) continue;
      // gone from the snapshot: served or walked out. They head for the door, then vanish.
      c.leaving = true;
      c.state = 'walk';
      c.bubble.style.display = 'none';
      c.tag.style.display = 'none';
      c.meter.hide();
      this.walk(c, { x: this.L.door.x, y: c.y }, dt);
      if (c.x <= this.L.door.x + 1 || this.h.instant()) {
        this.dropCustomer(c);
        this.customers.delete(c.id);
      }
    }
  }

  private walk(c: CustomerView2, to: Spot, dt: number): void {
    const dx = to.x - c.x;
    const dy = to.y - c.y;
    const dist = Math.hypot(dx, dy);
    const step = WALK_PX_S * dt;
    let moving = dist > 0.6;
    if (moving) {
      const k = Math.min(1, step / dist);
      c.x += dx * k;
      c.y += dy * k;
      c.face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'E' : 'W') : 'S';
    } else {
      c.x = to.x;
      c.y = to.y;
      c.face = 'S';
    }
    moving = moving && dist > step * 0.5;
    c.moving = moving;
    const want = animKey(c.sheet, moving ? 'walk' : 'idle', c.face);
    if (c.spr.anims.currentAnim?.key !== want && this.h.scene.anims.exists(want)) c.spr.play({ key: want });
    const px = Math.round(c.x);
    const py = Math.round(c.y);
    c.spr.setPosition(px, py).setDepth(D.customer + py / 1000);
    c.shadow.setPosition(px, py - 1);
  }

  /** A name tag over every customer (a heart for a regular, a speaker while a listening order is open) and a short bubble only when
   *  they say something extra: a regular's greeting or a follow-up. The order itself is in the overlay, so the board stays clear. */
  private bubbleFor(c: CustomerView2, cv: CustomerView): void {
    const tag = c.tag;
    const here = !c.leaving && !c.moving;
    const want = `${cv.regular ? '♥ ' : ''}${cv.who.name}${cv.state === 'front' && cv.mode === 'listening' ? ' 🔊' : ''}${cv.state === 'front' && cv.hot ? ' ☕🔥' : ''}`;
    if (tag.textContent !== want) tag.textContent = want;
    const tp = this.h.toCanvas(c.x, c.y - 47);
    tag.style.display = here ? '' : 'none';
    tag.style.left = `${Math.round(tp.px)}px`;
    tag.style.top = `${Math.round(tp.py)}px`;
    const el = c.bubble;
    const say = cv.state === 'front' ? [cv.greet ? cv.greet.pt : '', cv.follow?.pt ?? ''] : ['', ''];
    const sig = say.join('|');
    if (sig !== c.bubbleSig) {
      c.bubbleSig = sig;
      el.replaceChildren();
      el.className = 'cr-bubble';
      for (const [i, t] of say.entries()) {
        if (!t) continue;
        const d = document.createElement('div');
        d.className = i === 0 ? 'pt' : 'follow';
        d.textContent = t;
        el.append(d);
      }
      c.speakUntil = sig.replace('|', '') ? this.nowMs + 4200 : 0;
    }
    if (!here || this.nowMs > c.speakUntil) {
      el.style.display = 'none';
      return;
    }
    const { px, py } = this.h.toCanvas(c.x, c.y - 56);
    el.style.display = '';
    el.style.left = `${Math.round(px)}px`;
    el.style.top = `${Math.round(py)}px`;
  }

  // ------------------------------------------------------------------ the baker, from the side
  private syncBaker(snap: CorreriaSnap): void {
    const id = snap.baker;
    if (this.baker && this.baker.id !== id) {
      this.baker.bubble.remove();
      this.baker = null;
    }
    if (!this.baker) {
      const d = npcDefById(id);
      if (!d) return;
      const bubble = document.createElement('div');
      bubble.className = 'cr-bubble baker';
      bubble.style.display = 'none';
      // a player-owned padaria has no baker on duty: the cheers come from the regulars at the counter
      bubble.dataset.who = game.room?.padaria ? 'Freguesia' : d.name;
      this.popsEl!.append(bubble);
      this.baker = { id, bubble };
    }
  }

  private baker_say(pt: string, en: string): void {
    const b = this.baker;
    if (!b) return;
    b.bubble.replaceChildren();
    const who = document.createElement('div');
    who.className = 'who';
    who.textContent = b.bubble.dataset.who ?? '';
    b.bubble.append(who);
    const p = document.createElement('div');
    p.className = 'pt';
    p.textContent = pt;
    b.bubble.append(p);
    if (correriaFeed.showEn) {
      const e = document.createElement('div');
      e.className = 'en';
      e.textContent = en;
      b.bubble.append(e);
    }
    b.bubble.style.display = '';
    b.bubble.dataset.until = String(this.nowMs + 1800);
  }

  // ------------------------------------------------------------------ meters (chapa clock, pour meter)
  private drawMeters(snap: CorreriaSnap, age: number): void {
    const g = this.meters!;
    g.clear();
    // chapa: a bar over each item, the green window between ready and burnt
    snap.chapa.forEach((s, i) => {
      if (!s) return;
      const sp = this.L.chapaSlots[i]!;
      const a = s.age + age;
      const w = 16;
      const x = Math.round(sp.x - w / 2);
      const y = Math.round(sp.y - 19);
      g.fillStyle(0x1b1210, 0.85).fillRect(x - 1, y - 1, w + 2, 4);
      const ready = CHAPA.cookMs / CHAPA.burnMs;
      g.fillStyle(0x2e8a55, 1).fillRect(x + Math.round(w * ready), y, w - Math.round(w * ready), 2);
      g.fillStyle(0x9c6a3a, 1).fillRect(x, y, Math.round(w * ready), 2);
      const u = Math.min(1, a / CHAPA.burnMs);
      const phase = chapaPhase(a);
      g.fillStyle(phase === 'burnt' ? 0xc0392b : 0xfff2c2, 1).fillRect(x + Math.round(w * u), y - 1, 1, 4);
    });
    // coffee: a vertical bar beside the machine, the server's windows on it: green (POUR.goodMin..spillAt) lands a coffee, red above it
    // (..hotMax) an extra-hot one, past the red it is too late. The bar blinks in the window it is in (steady under reduced motion). When
    // the order at the counter wants extra quente, a flame marker points at the red, from the first tap.
    if (snap.pour && this.L.coffee) {
      const fill = (snap.pour.age + age) / snap.pourMs;
      const zone = pourZone(fill);
      const x = this.L.towerX + 2;
      const top = this.cs.y - 40;
      const hgt = 38;
      const max = 1.6;
      const yOf = (f: number) => top + hgt - Math.round((hgt * Math.min(max, Math.max(0, f))) / max);
      g.fillStyle(0x1b1210, 0.9).fillRect(x - 1, top - 1, 6, hgt + 2);
      g.fillStyle(0x2e8a55, 0.9).fillRect(x, yOf(POUR.spillAt), 4, yOf(POUR.goodMin) - yOf(POUR.spillAt));
      g.fillStyle(0x9c2a1e, 0.95).fillRect(x, yOf(POUR.hotMax), 4, yOf(POUR.spillAt) - yOf(POUR.hotMax));
      const blink = (zone === 'agora' || zone === 'quente') && !this.h.reduced() && Math.floor(this.nowMs / 120) % 2 === 0;
      const col = zone === 'filling' ? 0xf2c230 : zone === 'agora' ? (blink ? 0xc8ffd2 : 0x66d27f) : zone === 'quente' ? (blink ? 0xffc0a8 : 0xff5a36) : 0x6b4a3a;
      const yy = yOf(fill);
      g.fillStyle(col, 1).fillRect(x, yy, 4, top + hgt - yy);
      g.fillStyle(0xfff2c2, 1).fillRect(x - 1, yOf(POUR.spillAt), 6, 1);
      g.fillStyle(0x1b1210, 1).fillRect(x - 1, yOf(POUR.hotMax), 6, 1);
      if (zone === 'agora' || zone === 'quente') g.fillStyle(0xfff2c2, 1).fillRect(x - 3, yy, 2, 1);
      // the order wants it extra hot: a flame-coloured arrow pointing at the middle of the red
      const front = snap.customers.find((c) => c.state === 'front');
      if (front?.hot) {
        const my = yOf((POUR.spillAt + POUR.hotMax) / 2);
        g.fillStyle(0xff7a1a, 1).fillRect(x - 6, my - 2, 1, 5).fillRect(x - 5, my - 1, 1, 3).fillRect(x - 4, my, 1, 1);
      }
    }
    this.drawJuiceMeter(g, snap, age);
  }

  /**
   * Juicer: the sight gauge on the machine fills with the glass (orange under the line, green in the good band, red over it; the art
   * marks the band and the line on the tube), and the stream runs from the spout while an orange pours.
   */
  private drawJuiceMeter(g: Phaser.GameObjects.Graphics, snap: CorreriaSnap, age: number): void {
    const j = snap.juice;
    const spilling = this.nowMs < this.spillUntil;
    if (!j && !spilling && !this.ghost && !this.drain) return;
    const gauge = this.L.juiceGauge;
    if (!gauge) return;
    const fill = spilling ? gauge.max : this.shownFill(snap, age);
    const { x, y, w, h, max } = gauge;
    const rows = Math.round((h * Math.min(max, Math.max(0, fill))) / max);
    if (rows > 0) {
      const col = fill > JUICE.spillAt ? 0xd93232 : fill >= JUICE.goodMin ? 0x4fd06a : 0xf6a021;
      g.fillStyle(col, 1).fillRect(x, y + h - rows, w, rows);
      // the meniscus: a pale top row
      g.fillStyle(fill > JUICE.spillAt ? 0xff8575 : fill >= JUICE.goodMin ? 0xc8ffd0 : 0xffd778, 1).fillRect(x, y + h - rows, w, 1);
    }
    // the stream from the spout into the glass while this orange pours
    if ((j || this.ghost) && !this.h.reduced() && this.juiceStep(snap, age) === 'pour') {
      const surface = this.jg.y - 2 - juiceRows(fill);
      g.fillStyle(0xf6a021, 1).fillRect(this.jsp.x, this.jsp.y, 1, Math.max(1, surface - this.jsp.y));
    }
  }

  // ------------------------------------------------------------------ events (juice)
  private onCue(c: StageCue, snap: CorreriaSnap): void {
    if (c.t === 'shake') return this.kick();
    if (c.t === 'cheer') return this.baker_say(c.pt, c.en);
    const e: CEvent = c.e;
    if (e.k === 'grab' || e.k === 'chapa_ok' || e.k === 'pour_ok' || e.k === 'juice_ok') this.tried.add(e.item);
    switch (e.k) {
      case 'chapa_put':
        this.puff(this.L.chapaSlots[e.slot]!.x, this.L.chapaSlots[e.slot]!.y - 6, 1);
        break;
      case 'chapa_ok':
        this.puff(this.L.chapaSlots[e.slot]!.x, this.L.chapaSlots[e.slot]!.y - 8, 3);
        break;
      case 'chapa_burnt':
        this.puff(this.L.chapaSlots[e.slot]!.x, this.L.chapaSlots[e.slot]!.y - 8, 4, true);
        this.popAt(this.cps.x, this.cps.y - 44, '💨');
        break;
      case 'chapa_trash':
        this.puff(this.L.chapaSlots[e.slot]!.x, this.L.chapaSlots[e.slot]!.y - 4, 2, true);
        break;
      case 'pour_ok':
        this.pouring = false;
        this.popAt(this.cs.x, this.cs.y - 40, '☕');
        break;
      case 'pour_bad':
        this.pouring = false;
        this.popAt(this.cs.x, this.cs.y - 40, e.why === 'spill' ? '💦' : '…');
        break;
      case 'juice_ok':
        // the glass is won: it hops off the drip tray onto the tray
        this.popAt(this.jg.x, this.jg.y - 16, '🍊');
        this.flyGlass(Math.max(this.lastFill, e.fill), snap.tray.lastIndexOf(e.item));
        break;
      case 'juice_bad':
        if (e.why === 'spill') {
          // the server already emptied the glass: play this orange through the machine, then spill (at once under reduced motion)
          this.ghost = { prev: this.lastFill, fill: e.fill, at: this.nowMs, spilt: false };
          if (this.h.reduced()) {
            this.ghost = null;
            this.overflow();
          }
        } else this.tipOut(this.lastFill);
        break;
      case 'no':
        if (this.pouring && !snap.pour) this.pouring = false;
        break;
      case 'serve':
        this.bellUntil = this.nowMs + 450;
        this.emoteAt(e.id, e.emote, snap);
        if (e.outcome === 'perfeito' && e.combo >= 3) this.kick();
        break;
      case 'correct':
        this.emoteAt(e.id, '🤷', snap);
        this.kick();
        break;
      case 'leave':
        this.emoteAt(e.id, e.emote, snap);
        break;
      default:
        break;
    }
  }

  private emoteAt(id: number, emote: string, snap: CorreriaSnap): void {
    void snap;
    const c = this.customers.get(id);
    if (c) this.popAt(c.x, c.y - 46, emote);
  }

  private kick(): void {
    if (this.h.reduced()) return;
    this.nudge = { x: Math.random() < 0.5 ? -1 : 1, y: 1 };
  }

  private puff(x: number, y: number, n: number, dark = false): void {
    if (this.h.reduced()) return;
    for (let i = 0; i < n; i++) {
      const d = this.h.manifest.sprites[steamKey(i + Math.floor(this.nowMs / 150))];
      let img: Img;
      if (d) img = this.h.world(this.h.scene.add.image(x + (Math.random() - 0.5) * 8, y, d.atlas, d.frame)).setOrigin(...originOf(d));
      else {
        this.h.noteMissing(steamKey(i));
        img = this.h.world(this.h.scene.add.rectangle(x, y, 8, 12, 0xff00ff, 0.35));
      }
      img.setDepth(D.fx).setAlpha(dark ? 0.9 : 0.8);
      if (dark && 'setTint' in img) (img as Phaser.GameObjects.Image).setTint(0x555555);
      this.particles.push({ img, vx: (Math.random() - 0.5) * 6, vy: -(10 + Math.random() * 8), life: 0, max: 0.9 + Math.random() * 0.4 });
    }
  }

  private stepParticles(dt: number): void {
    // steady steam off a ready chapa and the machine while pouring
    const snap = correriaFeed.snap;
    if (snap && !this.h.reduced() && this.nowMs - this.steamAt > 420) {
      this.steamAt = this.nowMs;
      snap.chapa.forEach((s, i) => {
        if (s && chapaPhase(s.age + (this.nowMs - correriaFeed.snapAt)) !== 'raw') this.puff(this.L.chapaSlots[i]!.x, this.L.chapaSlots[i]!.y - 10, 1);
      });
      if (snap.pour && this.L.spout) this.puff(this.L.spout.x, this.L.spout.y - 4, 1);
    }
    this.particles = this.particles.filter((p) => {
      p.life += dt;
      if (p.grav !== undefined) {
        // a falling bit of juice or peel: exact position kept aside, drawn on whole pixels, fully opaque
        p.fx = (p.fx ?? p.img.x) + p.vx * dt;
        p.fy = (p.fy ?? p.img.y) + p.vy * dt;
        p.vy += p.grav * dt;
        p.img.setPosition(Math.round(p.fx), Math.round(p.fy));
      } else {
        p.img.x += p.vx * dt;
        p.img.y += p.vy * dt;
        p.img.setAlpha(Math.max(0, 0.8 * (1 - p.life / p.max)));
      }
      if (p.life >= p.max) {
        p.img.destroy();
        return false;
      }
      return true;
    });
  }

  // ------------------------------------------------------------------ DOM: taps and pops
  private placeHot(snap: CorreriaSnap): void {
    const k = this.h.cssScale();
    // below about 2 css px per world px the shelf labels would collide: the names come as a line when an item is tapped instead
    this.hotEl!.classList.toggle('small', k < 2.2);
    this.hotEl!.classList.toggle('cr-show-en', correriaFeed.showEn);
    this.hotEl!.style.setProperty('--cr-fs', `${Math.max(7, Math.min(11, k * 2.9)).toFixed(1)}px`);
    const sig = `${Math.round(this.h.toCanvas(0, 0).px)}|${Math.round(this.h.toCanvas(0, 0).py)}|${k.toFixed(3)}|${correriaFeed.showEn}`;
    // the grill spots only exist as many as the chapa has slots
    const slotCount = snap.chapa.length;
    const ssig = `${sig}|${slotCount}|${snap.pack}|${snap.chapa.map((c) => (c ? chapaPhase(c.age + (this.nowMs - correriaFeed.snapAt)) : '-')).join('')}`;
    if (ssig === this.hotSnap) return;
    this.hotSnap = ssig;
    this.hotSig = sig;
    for (const [id, h] of this.hot) {
      const { px, py } = this.h.toCanvas(h.spot.x, h.spot.y);
      const w = h.w * k;
      const hh = h.h * k;
      h.el.style.left = `${Math.round(px - w / 2)}px`;
      h.el.style.top = `${Math.round(py - hh)}px`;
      h.el.style.width = `${Math.round(w)}px`;
      h.el.style.height = `${Math.round(hh)}px`;
      // a piece this shift's board leaves off has no tap target either
      h.el.style.display = h.on ? '' : 'none';
      h.el.disabled = !h.on;
      if (id.startsWith('grill-')) {
        const i = Number(id.slice(6));
        h.el.style.display = h.on && i < slotCount ? '' : 'none';
        const s = snap.chapa[i];
        h.el.dataset.state = s ? chapaPhase(s.age + (this.nowMs - correriaFeed.snapAt)) : 'empty';
      }
      if (id === 'bag' || id === 'plate') h.el.classList.toggle('on', snap.pack === id);
    }
  }

  /** Called every frame; hot positions only change with the camera, so the signature above skips most. */
  private popAt(wx: number, wy: number, text: string): void {
    if (!this.popsEl) return;
    const el = document.createElement('div');
    el.className = 'cr-pop';
    el.textContent = text;
    const { px, py } = this.h.toCanvas(wx, wy);
    el.style.left = `${Math.round(px)}px`;
    el.style.top = `${Math.round(py)}px`;
    this.popsEl.append(el);
    this.pops.push({ el, wx, wy, until: this.nowMs + POP_MS });
  }

  private stepPops(): void {
    this.pops = this.pops.filter((p) => {
      if (this.nowMs >= p.until) {
        p.el.remove();
        return false;
      }
      const { px, py } = this.h.toCanvas(p.wx, p.wy);
      p.el.style.left = `${Math.round(px)}px`;
      p.el.style.top = `${Math.round(py)}px`;
      return true;
    });
    const b = this.baker?.bubble;
    if (b && b.style.display !== 'none') {
      if (this.nowMs > Number(b.dataset.until ?? 0)) b.style.display = 'none';
      else {
        const { px, py } = this.h.toCanvas(this.L.baker.x, this.L.baker.y);
        b.style.left = `${Math.round(px)}px`;
        b.style.top = `${Math.round(py)}px`;
      }
    }
  }

  /** A fresh camera / layout: the taps re-measure on the next frame. */
  invalidate(): void {
    this.hotSnap = '';
  }

  info(): { active: boolean; customers: number; textures: number } {
    return { active: correriaFeed.active, customers: this.customers.size, textures: this.textures.length };
  }

  /** The tap targets by id (e2e and shots). */
  hotIds(): string[] {
    return [...this.hot.keys()];
  }
}

export const COUNTER_BOARD = BOARD;
export { DEPTH };
