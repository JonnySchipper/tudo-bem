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
  SHELF_OF,
  SUCO_ITEMS,
  chapaFrame,
  chapaPhase,
  juicerStep,
  npcDefById,
  patienceStage,
  pourFrame,
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
  BAG_SPOT,
  BAKER_SPOT,
  BELL_SPOT,
  BOARD,
  BOARD_SHELF_TOP,
  BOARD_TOWER_X,
  CRATE_KEY,
  HOPPER_NEXT,
  JUICER_SPOT,
  JUICE_CHAMBER,
  JUICE_GAUGE,
  JUICE_GLASS_SPOT,
  JUICE_LINE_ROWS,
  JUICE_SPOUT,
  PEEL_BIN,
  juiceGlassKey,
  juiceRows,
  juicerKey,
  orangeKey,
  type JuicerFrame,
  CHAPA_ITEM_SCALE,
  CHAPA_SLOTS,
  CHAPA_SPOT,
  COFFEE_SPOT,
  DOOR_SPOT,
  ITEM_SCALE,
  ITEM_SPOTS,
  PLATE_SPOT,
  QUEUE_SPOTS,
  REGISTER_SPOT,
  SPOUT,
  TIPJAR_SPOT,
  TRAY_ITEM_SCALE,
  TRAY_SPOT,
  bellKey,
  chapaKey,
  coffeeKey,
  itemKey,
  patienceKey,
  sizeOfKey,
  steamKey,
  tipjarKey,
  traySlot,
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
  private pops: { el: HTMLElement; wx: number; wy: number; until: number }[] = [];
  private hotEl: HTMLElement | null = null;
  private popsEl: HTMLElement | null = null;
  private hot = new Map<string, { el: HTMLButtonElement; spot: Spot; w: number; h: number }>();
  private hotSig = '';
  private hotSnap = '';
  private pouring = false;

  constructor(private readonly h: CounterHost) {}

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
    this.drawBoard();
    for (const i of MG_ITEMS) this.items.set(i.id, this.img(shelfKey(i.id), ITEM_SPOTS[i.id]!, D.item));
    this.juicer = this.img(juicerKey('idle'), JUICER_SPOT, D.piece);
    this.glass = new Piece(this.h, D.item + 5, JUICE_GLASS_SPOT);
    this.nextOrange = new Piece(this.h, D.item + 4, HOPPER_NEXT);
    this.trayBase = this.img(ART.tray, TRAY_SPOT, D.tray);
    this.bag = this.img(ART.bag, BAG_SPOT, D.piece);
    this.plate = this.img(ART.plate, PLATE_SPOT, D.piece);
    this.chapa = this.img(chapaKey('idle'), CHAPA_SPOT, D.piece);
    this.coffee = this.img(coffeeKey('idle'), COFFEE_SPOT, D.piece);
    this.register = this.img(ART.register, REGISTER_SPOT, D.piece);
    this.bell = this.img(bellKey(0), BELL_SPOT, D.piece);
    this.jar = this.img(tipjarKey(0), TIPJAR_SPOT, D.piece);
    this.cup = new Piece(this.h, D.item + 5, SPOUT);
    this.ensureDom();
  }

  /** The flat wooden plate the pieces stand on: planks, a lip and a few rail lines. Code-drawn surface, never stands in for missing art. */
  private drawBoard(): void {
    const g = this.board!;
    const { x0, y0, x1, y1 } = BOARD;
    // the shelf part stops at BOARD_SHELF_TOP; the station column (the juicer on top) rises to y0
    const sy = BOARD_SHELF_TOP;
    const tx = BOARD_TOWER_X;
    g.clear();
    g.fillStyle(0x3b2314, 1).fillRect(x0 - 2, sy - 2, x1 - x0 + 4, y1 - sy + 4);
    g.fillStyle(0x3b2314, 1).fillRect(tx - 2, y0 - 2, x1 - tx + 4, sy - y0 + 2);
    g.fillStyle(0xcf9b62, 1).fillRect(x0, sy, x1 - x0, y1 - sy);
    g.fillStyle(0xcf9b62, 1).fillRect(tx, y0, x1 - tx, sy - y0);
    // planks
    for (let y = y0 + 8; y < y1; y += 14) {
      const from = y < sy ? tx : x0;
      g.fillStyle(0xbd8850, 1).fillRect(from, y, x1 - from, 1);
    }
    g.fillStyle(0xe2b97e, 1).fillRect(x0, sy, tx - x0, 2);
    g.fillStyle(0xe2b97e, 1).fillRect(tx, y0, x1 - tx, 2);
    g.fillStyle(0x8a5a32, 1).fillRect(x0, y1 - 3, x1 - x0, 3);
    // a rail under each shelf row
    for (const ry of [-5, 27, 59]) g.fillStyle(0x9c6a3a, 1).fillRect(x0 + 6, ry + 9, 104, 1);
    // the station column (the juicer over the coffee machine over the chapa)
    g.fillStyle(0xb98048, 1).fillRect(117, y0 + 5, x1 - 117 - 3, 140);
    g.fillStyle(0x8a5a32, 1).fillRect(117, y0 + 5, 1, 140);
    // the service strip along the front (pack row and register row)
    g.fillStyle(0xc28c54, 1).fillRect(x0 + 3, 76, 110, 52);
    g.fillStyle(0x8a5a32, 1).fillRect(x0 + 3, 76, 110, 1);
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
      this.hot.set(id, { el: b, spot, w, h });
    };
    for (const it of MG_ITEMS) {
      const id = it.id;
      const spot = ITEM_SPOTS[id]!;
      const isCup = CAFE_ITEMS.includes(id);
      const isJuice = SUCO_ITEMS.includes(id);
      // the crate in suco's cell feeds the juicer, like a tap on the machine
      const labels = isJuice ? { pt: 'laranjas', en: 'oranges' } : { pt: it.card.form, en: it.card.gloss_en };
      btn(`item-${id}`, `cr-item shelf-${SHELF_OF[id]}`, spot, 25, 22, labels.pt, labels.en, {
        click: isCup ? () => togglePour(id) : isJuice ? () => on.on.juiceDrop() : () => (CHAPA_ITEMS.includes(id) ? on.on.chapaPut(id) : on.on.grab(id)),
      });
    }
    btn('machine', 'cr-machine', { x: COFFEE_SPOT.x, y: COFFEE_SPOT.y }, 32, 40, 'Cafeteira', 'Tap to pour', {
      click: () => togglePour(),
    });
    // the espremedor: a tap anywhere on it drops one orange; the glass on its tray is its own target (tap it at the line)
    btn('juicer', 'cr-juicer', JUICER_SPOT, 40, 42, 'Espremedor', 'Juicer · 1 tap = 1 orange', { click: () => on.on.juiceDrop() });
    btn('juice-glass', 'cr-glass', { x: JUICE_GLASS_SPOT.x, y: JUICE_GLASS_SPOT.y + 1 }, 16, 14, '', 'Glass: tap it at the line', { click: () => on.on.juiceTake() });
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
    for (let i = 0; i < 2; i++) btn(`grill-${i}`, 'cr-grill', CHAPA_SLOTS[i]!, 16, 16, '', '', { click: () => on.on.chapaTake(i) });
    btn('bag', 'cr-pack', BAG_SPOT, 24, 30, 'Sacola', 'Bag (to go)', { click: () => on.on.pack('bag') });
    btn('plate', 'cr-pack', PLATE_SPOT, 28, 14, 'Prato', 'Plate (for here)', { click: () => on.on.pack('plate') });
    btn('tray', 'cr-tray', TRAY_SPOT, 64, 18, '', 'Tray (tap to empty it)', { click: () => on.on.clear() });
    btn('bell', 'cr-bell', BELL_SPOT, 22, 16, 'Entregar', 'Serve', { click: () => on.on.serve() });
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

  /** Items are lit up when the player can use them: dimmed when they are not on this shift's menu. An empty menu (old snap) leaves the shelf open. */
  private drawPieces(snap: CorreriaSnap, age: number): void {
    const open = snap.menu?.length ? new Set(snap.menu) : null;
    for (const it of MG_ITEMS) {
      const lock = !!open && !open.has(it.id);
      const p = this.items.get(it.id)!;
      p.set(shelfKey(it.id), { alpha: lock ? 0.28 : 1, scale: ITEM_SCALE });
      const hot = this.hot.get(`item-${it.id}`);
      if (hot) hot.el.disabled = lock;
    }
    const machine = this.hot.get('machine');
    if (machine) {
      const live = !!snap.pour || this.pouring;
      machine.el.disabled = !!open && !open.has('cafe') && !open.has('cafe_com_leite');
      const pt = machine.el.querySelector('.cr-lab');
      const en = machine.el.querySelector('.cr-lab-en');
      if (pt) pt.textContent = live ? 'Toque de novo' : 'Cafeteira';
      if (en) en.textContent = live ? 'Tap again at the right time' : 'Tap to pour';
      machine.el.setAttribute('aria-label', live ? 'Toque de novo (Tap again at the right time)' : 'Cafeteira (Tap to pour)');
    }
    // the tray: the base plus a miniature per item (a full one past five)
    const tray = snap.tray;
    this.trayBase!.set(tray.length >= 7 ? ART.trayFull : ART.tray);
    while (this.trayMinis.length < tray.length) this.trayMinis.push(new Piece(this.h, D.item + 1, TRAY_SPOT));
    this.trayMinis.forEach((m, i) => {
      // a juice glass still flying over from the machine lands in its slot before the miniature shows
      if (i >= tray.length || this.flight?.idx === i) return m.hide();
      m.set(itemKey(tray[i]!), { scale: TRAY_ITEM_SCALE, spot: traySlot(i) });
    });
    if (tray.length > this.lastTray.length) {
      const idx = tray.length - 1;
      const m = this.trayMinis[idx];
      if (m && !this.h.reduced()) this.hop.push({ piece: m, t: 0, dur: 0.28 });
    }
    this.lastTray = [...tray];
    // bag and plate: the chosen one lifts and glows
    this.bag!.set(ART.bag, { alpha: snap.pack === 'plate' ? 0.55 : 1, dy: snap.pack === 'bag' ? -3 : 0 });
    this.plate!.set(ART.plate, { alpha: snap.pack === 'bag' ? 0.55 : 1, dy: snap.pack === 'plate' ? -3 : 0 });
    // the chapa: the busiest slot decides the frame, its items sit on the grill
    const slots = snap.chapa;
    let worst: 'idle' | 'sizzle_0' | 'sizzle_1' | 'sizzle_2' | 'burnt' = 'idle';
    const rank = { idle: 0, sizzle_0: 1, sizzle_1: 2, sizzle_2: 3, burnt: 4 } as const;
    while (this.chapaItems.length < slots.length) this.chapaItems.push(new Piece(this.h, D.item + 2, CHAPA_SLOTS[this.chapaItems.length]!));
    slots.forEach((s, i) => {
      const gp = this.chapaItems[i]!;
      if (!s) return gp.hide();
      const a = s.age + age;
      const f = chapaFrame(a);
      if (rank[f] > rank[worst]) worst = f;
      gp.set(itemKey(s.item), { scale: CHAPA_ITEM_SCALE, alpha: f === 'burnt' ? 0.55 : 1 });
    });
    this.chapa!.set(chapaKey(worst));
    // the machine: the pour frames while a pour runs, with the cup under the spout
    if (snap.pour) {
      const fill = (snap.pour.age + age) / snap.pourMs;
      this.coffee!.set(coffeeKey(pourFrame(Math.min(1.2, fill))));
      this.cup!.set(itemKey(snap.pour.item), { scale: 0.7, dy: 2 });
    } else {
      this.coffee!.set(coffeeKey('idle'));
      this.cup!.hide();
    }
    this.drawJuicer(snap, age, open);
    this.register!.set(ART.register);
    this.bell!.set(bellKey(this.nowMs < this.bellUntil ? 1 : 0));
    const jar = tipJarStage(snap.stats.tips);
    this.jar!.set(tipjarKey(jar));
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
  private drawJuicer(snap: CorreriaSnap, age: number, open: Set<string> | null): void {
    const locked = !!open && !SUCO_ITEMS.some((id) => open.has(id));
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
    this.juicer!.set(juicerKey(frame), { alpha: locked ? 0.4 : 1 });
    if (step === 'press' && this.lastStep !== 'press') this.splash();
    if (step === 'peel' && this.lastStep !== 'peel') this.peelDrop();
    this.lastStep = step;
    // the beat when the pour ends: this orange either brought the glass to the line or took it over the rim
    const t = j ? j.age + age : this.ghost ? this.nowMs - this.ghost.at : 0;
    const poured = reduced || t >= JUICE.cycleMs * 0.84;
    if (j && poured && j.prev < JUICE.goodMin && j.fill >= JUICE.goodMin && this.lineCheered !== j.oranges) {
      this.lineCheered = j.oranges;
      this.popWord(JUICE_GLASS_SPOT.x, JUICE_GLASS_SPOT.y - 14, 'na linha!', 'at the line', 'good');
      this.sparkle(JUICE_GLASS_SPOT.x, JUICE_GLASS_SPOT.y - 12, 0x8ff0a4);
    }
    if (!j) this.lineCheered = -1;
    const g = this.ghost;
    if (g && !g.spilt && poured) {
      g.spilt = true;
      this.overflow();
    }
    // the next orange waits on the feeder (while one rolls in, the machine frame draws it)
    const next = snap.hopper?.[0];
    if (next && !locked && step !== 'roll') this.nextOrange!.set(orangeKey(next));
    else this.nextOrange!.hide();
    // the glass: the overflow frame after a spill, a tipped-out glass running down, else the level (eased while it pours, whole rows)
    const fill = this.shownFill(snap, age);
    this.lastFill = j ? fill : 0;
    if (this.nowMs < this.spillUntil) this.glass!.set(juiceGlassKey('spill'));
    else if (g || j || this.drain) this.glass!.set(juiceGlassKey(juiceRows(fill)));
    else if (!locked) this.glass!.set(juiceGlassKey(0));
    else this.glass!.hide();
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
      const img = this.h.world(s.add.rectangle(JUICE_CHAMBER.x + (i - 1.5) * 2, JUICE_CHAMBER.y, 1, 1, i % 2 ? 0xffb43a : 0xf6a021, 1)).setOrigin(0, 0);
      img.setDepth(D.fx);
      this.particles.push({ img, vx: (i - 1.5) * 9, vy: -14 - Math.random() * 6, life: 0, max: 0.35, grav: 120 });
    }
  }

  /** The glass overflows: the spill frame for a moment, juice running over the rim and down onto the drip tray, a shake, a 💦. */
  private overflow(): void {
    this.spillUntil = this.nowMs + SPILL_MS;
    this.kick();
    this.popAt(JUICE_GLASS_SPOT.x, JUICE_GLASS_SPOT.y - 16, '💦');
    if (this.h.reduced()) return;
    const s = this.h.scene;
    for (let i = 0; i < 8; i++) {
      const side = i % 2 ? 1 : -1;
      const img = this.h.world(s.add.rectangle(JUICE_GLASS_SPOT.x + side * (6 + (i % 3)), JUICE_GLASS_SPOT.y - 11 + (i >> 1), 1, 1, i % 3 ? 0xf6a021 : 0xffd778, 1)).setOrigin(0, 0);
      img.setDepth(D.fx);
      this.particles.push({ img, vx: side * (6 + Math.random() * 10), vy: -8 - Math.random() * 10, life: 0, max: 0.55, grav: 140 });
    }
  }

  /** A short glass tipped out: it runs down to nothing, a few drops fall off the tray. */
  private tipOut(from: number): void {
    this.drain = { from, at: this.nowMs };
    this.popAt(JUICE_GLASS_SPOT.x, JUICE_GLASS_SPOT.y - 16, '…');
    if (this.h.reduced()) return;
    const s = this.h.scene;
    for (let i = 0; i < 3; i++) {
      const img = this.h.world(s.add.rectangle(JUICE_GLASS_SPOT.x - 3 + i * 3, JUICE_GLASS_SPOT.y, 1, 1, 0xf6a021, 1)).setOrigin(0, 0);
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
    const from = { x: JUICE_GLASS_SPOT.x, y: JUICE_GLASS_SPOT.y };
    const img = this.h.world(this.h.scene.add.image(from.x, from.y, d.atlas, d.frame)).setOrigin(...originOf(d)).setDepth(D.fx);
    this.flight = { img, from, to: traySlot(idx), t: 0, dur: 0.46, idx };
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
      m.set(itemKey(correriaFeed.snap?.tray[idx] ?? 'suco_de_laranja'), { scale: TRAY_ITEM_SCALE, spot: traySlot(idx) });
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
      const img = this.h.world(s.add.rectangle(PEEL_BIN.x + i * 2, PEEL_BIN.y - 4 + i, 2, 1, i ? 0xb4520e : 0xe07a14, 1)).setOrigin(0, 0);
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
    const front = snap.customers.filter((c) => c.state === 'front' || c.state === 'asking');
    const rest = snap.customers.filter((c) => c.state !== 'front' && c.state !== 'asking');
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
        const spr = this.h.world(s.add.sprite(DOOR_SPOT.x, DOOR_SPOT.y, sheet, 0)).setOrigin(0.5, 1);
        const shadow = this.h.world(s.add.ellipse(0, 0, 13, 5, 0x000000, 0.28)).setDepth(D.customer - 1);
        const bubble = document.createElement('div');
        bubble.className = 'cr-bubble';
        bubble.style.display = 'none';
        this.popsEl!.append(bubble);
        const tag = document.createElement('div');
        tag.className = `cr-tag${cv.regular ? ' regular' : ''}`;
        tag.textContent = `${cv.regular ? '♥ ' : ''}${cv.who.name}`;
        this.popsEl!.append(tag);
        c = { id: cv.id, sheet, spr, shadow, meter: new Piece(this.h, D.hud + 1, DOOR_SPOT), x: this.h.instant() ? QUEUE_SPOTS[Math.min(slot, 2)]!.x : DOOR_SPOT.x, y: QUEUE_SPOTS[Math.min(slot, 2)]!.y, face: 'E', moving: true, leaving: false, who: cv.who, bubble, tag, bubbleSig: '', speakUntil: 0, slot, state: cv.state };
        this.customers.set(cv.id, c);
      }
      c.slot = slot;
      c.state = cv.state;
      const to = QUEUE_SPOTS[Math.min(slot, QUEUE_SPOTS.length - 1)]!;
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
      this.walk(c, { x: DOOR_SPOT.x, y: c.y }, dt);
      if (c.x <= DOOR_SPOT.x + 1 || this.h.instant()) {
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
    const want = `${cv.regular ? '♥ ' : ''}${cv.who.name}${cv.state === 'front' && cv.mode === 'listening' ? ' 🔊' : ''}`;
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
      const sp = CHAPA_SLOTS[i]!;
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
    // coffee: a vertical fill bar beside the machine, the good zone marked
    if (snap.pour) {
      const fill = Math.min(1.15, (snap.pour.age + age) / snap.pourMs);
      const x = 117;
      const top = COFFEE_SPOT.y - 38;
      const hgt = 34;
      g.fillStyle(0x1b1210, 0.9).fillRect(x - 1, top - 1, 5, hgt + 2);
      g.fillStyle(0x2e8a55, 0.9).fillRect(x, top + Math.round(hgt * (1 - 1.0)), 3, Math.round(hgt * 0.3));
      const col = fill < 0.7 ? 0xf2c230 : fill <= 1.08 ? 0x66d27f : 0xc0392b;
      const hh = Math.round(hgt * Math.min(1, fill));
      g.fillStyle(col, 1).fillRect(x, top + hgt - hh, 3, hh);
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
    const fill = spilling ? JUICE_GAUGE.max : this.shownFill(snap, age);
    const { x, y, w, h, max } = JUICE_GAUGE;
    const rows = Math.round((h * Math.min(max, Math.max(0, fill))) / max);
    if (rows > 0) {
      const col = fill > JUICE.spillAt ? 0xd93232 : fill >= JUICE.goodMin ? 0x4fd06a : 0xf6a021;
      g.fillStyle(col, 1).fillRect(x, y + h - rows, w, rows);
      // the meniscus: a pale top row
      g.fillStyle(fill > JUICE.spillAt ? 0xff8575 : fill >= JUICE.goodMin ? 0xc8ffd0 : 0xffd778, 1).fillRect(x, y + h - rows, w, 1);
    }
    // the stream from the spout into the glass while this orange pours
    if ((j || this.ghost) && !this.h.reduced() && this.juiceStep(snap, age) === 'pour') {
      const surface = JUICE_GLASS_SPOT.y - 2 - juiceRows(fill);
      g.fillStyle(0xf6a021, 1).fillRect(JUICE_SPOUT.x, JUICE_SPOUT.y, 1, Math.max(1, surface - JUICE_SPOUT.y));
    }
  }

  // ------------------------------------------------------------------ events (juice)
  private onCue(c: StageCue, snap: CorreriaSnap): void {
    if (c.t === 'shake') return this.kick();
    if (c.t === 'cheer') return this.baker_say(c.pt, c.en);
    const e: CEvent = c.e;
    switch (e.k) {
      case 'chapa_put':
        this.puff(CHAPA_SLOTS[e.slot]!.x, CHAPA_SLOTS[e.slot]!.y - 6, 1);
        break;
      case 'chapa_ok':
        this.puff(CHAPA_SLOTS[e.slot]!.x, CHAPA_SLOTS[e.slot]!.y - 8, 3);
        break;
      case 'chapa_burnt':
        this.puff(CHAPA_SLOTS[e.slot]!.x, CHAPA_SLOTS[e.slot]!.y - 8, 4, true);
        this.popAt(CHAPA_SPOT.x, CHAPA_SPOT.y - 44, '💨');
        break;
      case 'chapa_trash':
        this.puff(CHAPA_SLOTS[e.slot]!.x, CHAPA_SLOTS[e.slot]!.y - 4, 2, true);
        break;
      case 'pour_ok':
        this.pouring = false;
        this.popAt(COFFEE_SPOT.x, COFFEE_SPOT.y - 40, '☕');
        break;
      case 'pour_bad':
        this.pouring = false;
        this.popAt(COFFEE_SPOT.x, COFFEE_SPOT.y - 40, e.why === 'spill' ? '💦' : '…');
        break;
      case 'juice_ok':
        // the glass is won: it hops off the drip tray onto the tray
        this.popAt(JUICE_GLASS_SPOT.x, JUICE_GLASS_SPOT.y - 16, '🍊');
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
      case 'ask_result':
        this.popAt(REGISTER_SPOT.x, REGISTER_SPOT.y - 26, e.ok ? '💰' : '🧾');
        break;
      case 'ask':
        this.popAt(REGISTER_SPOT.x, REGISTER_SPOT.y - 26, '🧾');
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
        if (s && chapaPhase(s.age + (this.nowMs - correriaFeed.snapAt)) !== 'raw') this.puff(CHAPA_SLOTS[i]!.x, CHAPA_SLOTS[i]!.y - 10, 1);
      });
      if (snap.pour) this.puff(SPOUT.x, SPOUT.y - 4, 1);
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
      if (id.startsWith('grill-')) {
        const i = Number(id.slice(6));
        h.el.style.display = i < slotCount ? '' : 'none';
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
        const { px, py } = this.h.toCanvas(BAKER_SPOT.x, BAKER_SPOT.y);
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
