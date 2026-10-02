/**
 * "Correria no Balcão" in the world (Phaser side). Everything happens behind the padaria counter, no modal:
 *  - a wooden work board over the counter area with the shelves, the estufa, the geladeira, the chapa, the coffee machine, the
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
  MG_ITEMS,
  SHELF_OF,
  chapaFrame,
  chapaPhase,
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
import { originOf } from './spriteUtil';
import { DEPTH } from './props';
import {
  ART,
  BAG_SPOT,
  BELL_SPOT,
  BOARD,
  CHAPA_ITEM_SCALE,
  CHAPA_SLOTS,
  CHAPA_SPOT,
  COFFEE_SPOT,
  DOOR_SPOT,
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

type Img = Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;

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
  bubbleSig: string;
  slot: number;
  state: CustomerView['state'];
}

interface Particle {
  img: Img;
  vx: number;
  vy: number;
  life: number;
  max: number;
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
  private register: Piece | null = null;
  private bell: Piece | null = null;
  private jar: Piece | null = null;
  private customers = new Map<number, CustomerView2>();
  private baker: { sheet: string; spr: Phaser.GameObjects.Sprite; id: string; bubble: HTMLElement } | null = null;
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
    for (const i of MG_ITEMS) this.items.set(i.id, this.img(itemKey(i.id), ITEM_SPOTS[i.id]!, D.item));
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
    g.clear();
    g.fillStyle(0x3b2314, 1).fillRect(x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4);
    g.fillStyle(0xcf9b62, 1).fillRect(x0, y0, x1 - x0, y1 - y0);
    // planks
    for (let y = y0 + 8; y < y1; y += 14) g.fillStyle(0xbd8850, 1).fillRect(x0, y, x1 - x0, 1);
    g.fillStyle(0xe2b97e, 1).fillRect(x0, y0, x1 - x0, 2);
    g.fillStyle(0x8a5a32, 1).fillRect(x0, y1 - 3, x1 - x0, 3);
    // shelf rails under each row of items
    for (const ry of [30, 58]) g.fillStyle(0x9c6a3a, 1).fillRect(x0 + 4, ry, 116 - 4, 1);
    // the station column
    g.fillStyle(0xb98048, 1).fillRect(121, y0 + 4, x1 - 121 - 3, y1 - y0 - 30);
    g.fillStyle(0x8a5a32, 1).fillRect(121, y0 + 4, 1, y1 - y0 - 30);
    // the grill plate under the chapa and the machine tray
    g.fillStyle(0x4a4a52, 1).fillRect(123, 82, 34, 11);
    g.fillStyle(0x61616b, 1).fillRect(123, 82, 34, 2);
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
      const labels = { pt: it.card.form, en: it.card.gloss_en };
      btn(`item-${id}`, `cr-item shelf-${SHELF_OF[id]}`, spot, 24, 28, labels.pt, labels.en, {
        click: isCup ? undefined : () => (CHAPA_ITEMS.includes(id) ? on.on.chapaPut(id) : on.on.grab(id)),
        down: isCup
          ? () => {
              on.cup = id;
              this.pouring = true;
              on.on.pourStart(id);
            }
          : undefined,
        up: isCup
          ? () => {
              if (this.pouring) {
                this.pouring = false;
                on.on.pourEnd();
              }
            }
          : undefined,
      });
    }
    btn('machine', 'cr-machine', { x: COFFEE_SPOT.x, y: COFFEE_SPOT.y }, 32, 40, 'Cafeteira', 'Coffee machine', {
      down: () => {
        this.pouring = true;
        on.on.pourStart(on.cup);
      },
      up: () => {
        if (this.pouring) {
          this.pouring = false;
          on.on.pourEnd();
        }
      },
    });
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
    this.nudge = { x: 0, y: 0 };
  }

  private stop(): void {
    if (!this.built) return;
    this.hotEl && (this.hotEl.style.display = 'none');
    this.board?.setVisible(false);
    this.meters?.clear();
    for (const p of [...this.items.values(), this.trayBase, this.bag, this.plate, this.chapa, this.coffee, this.cup, this.register, this.bell, this.jar, ...this.trayMinis, ...this.chapaItems]) p?.hide();
    this.clearCustomers();
    this.clearParticles();
    if (this.baker) {
      this.h.releaseSheet(this.baker.sheet);
      this.baker.spr.destroy();
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
    this.stepHops(dt);
    this.placeHot(snap);
    this.stepPops();
  }

  /** Items are lit up when the player can use them: dimmed when locked. */
  private drawPieces(snap: CorreriaSnap, age: number): void {
    const unlocked = new Set(snap.unlocked);
    for (const it of MG_ITEMS) {
      const lock = (it.id === 'pastel' || it.id === 'coxinha') && !unlocked.has('salgados');
      const p = this.items.get(it.id)!;
      p.set(itemKey(it.id), { alpha: lock ? 0.28 : 1 });
      const hot = this.hot.get(`item-${it.id}`);
      if (hot) hot.el.disabled = lock;
    }
    // the tray: the base plus a miniature per item (a full one past five)
    const tray = snap.tray;
    this.trayBase!.set(tray.length >= 7 ? ART.trayFull : ART.tray);
    while (this.trayMinis.length < tray.length) this.trayMinis.push(new Piece(this.h, D.item + 1, TRAY_SPOT));
    this.trayMinis.forEach((m, i) => {
      if (i >= tray.length) return m.hide();
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
    this.register!.set(ART.register);
    this.bell!.set(bellKey(this.nowMs < this.bellUntil ? 1 : 0));
    const jar = tipJarStage(snap.stats.tips);
    this.jar!.set(tipjarKey(jar));
    if (snap.stats.tips > this.lastTips && !this.h.reduced()) this.hop.push({ piece: this.jar!, t: 0, dur: 0.22 });
    this.lastTips = snap.stats.tips;
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
        c = { id: cv.id, sheet, spr, shadow, meter: new Piece(this.h, D.hud + 1, DOOR_SPOT), x: this.h.instant() ? QUEUE_SPOTS[Math.min(slot, 2)]!.x : DOOR_SPOT.x, y: QUEUE_SPOTS[Math.min(slot, 2)]!.y, face: 'E', moving: true, leaving: false, who: cv.who, bubble, bubbleSig: '', slot, state: cv.state };
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

  private bubbleFor(c: CustomerView2, cv: CustomerView): void {
    const frontNow = cv.state === 'front';
    const el = c.bubble;
    if (!frontNow || c.moving) {
      el.style.display = 'none';
      return;
    }
    const sig = `${cv.mode}|${cv.pt}|${cv.follow?.pt ?? ''}|${correriaFeed.showEn}`;
    if (sig !== c.bubbleSig) {
      c.bubbleSig = sig;
      el.replaceChildren();
      el.className = `cr-bubble ${cv.mode}`;
      const pt = document.createElement('div');
      pt.className = 'pt';
      pt.textContent = cv.mode === 'listening' ? '🔊 …' : cv.pt;
      el.append(pt);
      if (cv.follow) {
        const f = document.createElement('div');
        f.className = 'follow';
        f.textContent = cv.follow.pt;
        el.append(f);
      }
    }
    const { px, py } = this.h.toCanvas(c.x, c.y - 40);
    el.style.display = '';
    el.style.left = `${Math.round(px)}px`;
    el.style.top = `${Math.round(py)}px`;
  }

  // ------------------------------------------------------------------ the baker, from the side
  private syncBaker(snap: CorreriaSnap): void {
    const id = snap.baker;
    if (this.baker && this.baker.id !== id) {
      this.h.releaseSheet(this.baker.sheet);
      this.baker.spr.destroy();
      this.baker.bubble.remove();
      this.baker = null;
    }
    if (!this.baker) {
      const d = npcDefById(id);
      if (!d) return;
      const sheet = this.h.acquireSheet(lookForNpc(id, d.appearance, d.hat));
      const spr = this.h.world(this.h.scene.add.sprite(150, 122, sheet, 0)).setOrigin(0.5, 1).setDepth(D.piece + 1);
      const want = animKey(sheet, 'idle', 'W');
      if (this.h.scene.anims.exists(want)) spr.play({ key: want });
      const bubble = document.createElement('div');
      bubble.className = 'cr-bubble baker';
      bubble.style.display = 'none';
      this.popsEl!.append(bubble);
      this.baker = { sheet, spr, id, bubble };
    }
  }

  private baker_say(pt: string, en: string): void {
    const b = this.baker;
    if (!b) return;
    b.bubble.replaceChildren();
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
      const x = 122;
      const top = 16;
      const hgt = 34;
      g.fillStyle(0x1b1210, 0.9).fillRect(x - 1, top - 1, 5, hgt + 2);
      g.fillStyle(0x2e8a55, 0.9).fillRect(x, top + Math.round(hgt * (1 - 1.0)), 3, Math.round(hgt * 0.3));
      const col = fill < 0.7 ? 0xf2c230 : fill <= 1.08 ? 0x66d27f : 0xc0392b;
      const hh = Math.round(hgt * Math.min(1, fill));
      g.fillStyle(col, 1).fillRect(x, top + hgt - hh, 3, hh);
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
        this.popAt(COFFEE_SPOT.x, COFFEE_SPOT.y - 40, '☕');
        break;
      case 'pour_bad':
        this.popAt(COFFEE_SPOT.x, COFFEE_SPOT.y - 40, e.why === 'spill' ? '💦' : '…');
        break;
      case 'serve':
        this.bellUntil = this.nowMs + 450;
        this.emoteAt(e.id, e.emote, snap);
        if (e.combo >= 3) this.kick();
        break;
      case 'correct':
        this.emoteAt(e.id, '😤', snap);
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
      p.img.x += p.vx * dt;
      p.img.y += p.vy * dt;
      p.img.setAlpha(Math.max(0, 0.8 * (1 - p.life / p.max)));
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
        const { px, py } = this.h.toCanvas(150, 84);
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
