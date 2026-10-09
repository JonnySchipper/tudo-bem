/**
 * Caldo de cana, the multitasking Feira cart game.
 *
 * The stall is built once. A frame only rewrites text, classes and a juice level, so a mouse or
 * finger drag lands on the same nodes that received the press. Cane goes into the press, the lever
 * turns, a cup catches the spout (a miss spills), a flavor pump and the ice bucket finish the order.
 *
 * needs_br: true (order lines, pops, end card).
 */
import {
  CALDO_DURATION_MS,
  CALDO_FLAVOR_LABEL,
  CALDO_FLAVORS,
  CALDO_OVERFLOW,
  CALDO_POP,
  CALDO_PRESS,
  CALDO_THANKS,
  CALDO_SPILL,
  CALDO_WRONG_FLAVOR,
  CALDO_WRONG_ICE,
  caldoOrders,
  caldoServeQuality,
  type CaldoFlavor,
  type CaldoOrder,
  type FeiraOrderOutcome,
  type FeiraQuality,
} from '@tudobem/shared';
import { h, en } from './dom';
import { npcPortrait, portraitKey, type Expression } from './pixelArt';
import { imageUrl } from '../render/pixel/manifest';
import { StallKit, counterProps, replay, stallEndCard, stallRoof, ticket, type StallEnd } from './feiraStall';

const POINTS: Record<FeiraQuality, number> = { perfect: 48, ok: 32, soft: 16, miss: 0 };

export interface CaldoHooks {
  finish: (outcomes: FeiraOrderOutcome[]) => void;
  quit: () => void;
  again: () => void;
}

interface CupState {
  juice: number;
  flavor: CaldoFlavor | null;
  ice: boolean;
  spilled: boolean;
  at: 'rack' | 'spout';
}

interface LiveCustomer {
  order: CaldoOrder;
  index: number;
  shownAt: number;
  gone: boolean;
}

interface CustomerNode {
  root: HTMLElement;
  pips: HTMLElement[];
  img: HTMLImageElement | null;
  expr: Expression;
}

const NS = 'http://www.w3.org/2000/svg';
const NAVY = '#2a2233';
const FULL = CALDO_PRESS.cupFull;

const JUICE: Record<CaldoFlavor | 'plain', string> = {
  plain: '#d4e56a',
  limao: '#e4f07a',
  abacaxi: '#f2c230',
  maracuja: '#e0a04a',
  gengibre: '#e8c48a',
  hortela: '#8fce62',
  laranja: '#f09a3a',
  abacaxi_hortela: '#d6d24a',
};

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string> = {}): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function px(g: SVGGElement, cells: [number, number, string][]) {
  for (const [x, y, fill] of cells) g.append(svgEl('rect', { x: String(x), y: String(y), width: '1', height: '1', fill }));
}

function disc(x: number, y: number, cx: number, cy: number, r: number) {
  const dx = x + 0.5 - cx;
  const dy = y + 0.5 - cy;
  return dx * dx + dy * dy <= r * r;
}

/** Green-and-yellow cane press: hopper, flywheel, spout, a window for the juice. Built once. */
function buildPress(): { svg: SVGSVGElement; juice: SVGRectElement; cane: SVGGElement; stream: SVGGElement } {
  const svg = svgEl('svg', { viewBox: '0 0 72 56', class: 'cd-press-svg', 'shape-rendering': 'crispEdges' });
  const body = svgEl('g');
  const cells: [number, number, string][] = [];
  for (let y = 0; y < 56; y++) {
    for (let x = 0; x < 72; x++) {
      const cabinet = x >= 18 && x <= 52 && y >= 20 && y <= 48;
      const band = cabinet && y >= 30 && y <= 36;
      const hopper = y >= 8 && y <= 20 && x >= 24 + Math.floor((20 - y) * 0.35) && x <= 46 - Math.floor((20 - y) * 0.35);
      const spout = x >= 52 && x <= 66 && y >= 38 && y <= 44;
      const wheel = disc(x, y, 12, 34, 9);
      const hub = disc(x, y, 12, 34, 3);
      const lit = x < 32 && y < 28;
      if (wheel) {
        const rim = !disc(x, y, 12, 34, 7);
        cells.push([x, y, hub ? '#f2c230' : rim ? (lit ? '#daa463' : '#6b4c2c') : lit ? '#f8f8f8' : '#8b8bab']);
      } else if (hopper) {
        const edge = y === 8 || x <= 25 || x >= 45;
        cells.push([x, y, edge ? NAVY : lit ? '#8fd18a' : '#2f7a45']);
      } else if (spout) {
        cells.push([x, y, y === 38 ? '#f8f8f8' : y === 44 ? '#6c6e85' : '#c6c8d4']);
      } else if (cabinet) {
        const edge = x === 18 || x === 52 || y === 20 || y === 48;
        const color = edge ? NAVY : band ? (lit ? '#ffe58a' : x > 44 ? '#c48a14' : '#f2c230') : lit ? '#8fd18a' : x > 44 ? '#1f6b32' : '#3d9a4a';
        cells.push([x, y, color]);
      }
    }
  }
  // rivets and a highlight on the yellow band, upper-left light
  cells.push([22, 24, '#f8f8f8'], [23, 24, '#f8f8f8'], [22, 25, '#d8f0c8'], [48, 44, NAVY], [20, 46, '#1a120c'], [50, 46, '#1a120c']);
  px(body, cells);
  const cane = svgEl('g', { class: 'g-cane' });
  const stalks: [number, number, string][] = [];
  for (let i = 0; i < 3; i++) {
    const sx = 30 + i * 4;
    for (let y = 10; y <= 18; y++) {
      stalks.push([sx, y, y % 3 === 0 ? '#f2c230' : '#6fbf6a'], [sx + 1, y, y % 3 === 0 ? '#c48a14' : '#2f7a45']);
    }
  }
  px(cane, stalks);
  const stream = svgEl('g', { class: 'g-stream' });
  px(stream, [[60, 45, '#d4e56a'], [60, 47, '#f7f8d8'], [61, 46, '#8fb83a'], [60, 49, '#d4e56a'], [59, 50, '#f7f8d8']]);
  const juice = svgEl('rect', { x: '32', y: '42', width: '12', height: '0', fill: '#d4e56a' });
  svg.append(body, cane, stream, juice);
  return { svg, juice, cane, stream };
}

function cupArt(): { svg: SVGSVGElement; juice: SVGRectElement; ice: SVGGElement; foam: SVGGElement } {
  const svg = svgEl('svg', { viewBox: '0 0 18 26', class: 'cd-cup-svg', 'shape-rendering': 'crispEdges' });
  const glass = svgEl('g');
  const cells: [number, number, string][] = [];
  for (let y = 4; y < 24; y++) {
    const inset = y > 18 ? 1 : 0;
    for (let x = 2 + inset; x < 16 - inset; x++) {
      const edge = x === 2 + inset || x === 15 - inset || y === 23;
      const rim = y === 4 || y === 5;
      cells.push([x, y, rim ? (x < 8 ? '#ffffff' : '#c6c8d4') : edge ? NAVY : x < 6 && y < 12 ? '#f8f8f8' : '#e7eef2']);
    }
  }
  px(glass, cells);
  const juice = svgEl('rect', { x: '4', y: '20', width: '10', height: '0', fill: '#d4e56a' });
  const foam = svgEl('g', { class: 'g-foam' });
  px(foam, [[5, 12, '#f7f8d8'], [6, 12, '#ffffff'], [8, 11, '#f7f8d8'], [10, 12, '#ffffff'], [12, 12, '#f7f8d8']]);
  const ice = svgEl('g', { class: 'g-ice' });
  px(ice, [[6, 14, '#f8f8f8'], [7, 14, '#d8e4ea'], [7, 15, '#f8f8f8'], [11, 15, '#f8f8f8'], [12, 15, '#d8e4ea'], [11, 16, '#f8f8f8']]);
  svg.append(glass, juice, foam, ice);
  return { svg, juice, ice, foam };
}

function caneArt(): SVGSVGElement {
  const svg = svgEl('svg', { viewBox: '0 0 28 36', class: 'cd-cane-svg', 'shape-rendering': 'crispEdges' });
  const g = svgEl('g');
  const cells: [number, number, string][] = [];
  for (let i = 0; i < 3; i++) {
    const sx = 6 + i * 6;
    for (let y = 4; y < 32; y++) {
      const node = y % 6 === 0;
      const lit = i === 0;
      cells.push([sx, y, node ? '#f2c230' : lit ? '#8fd18a' : '#3d9a4a'], [sx + 1, y, node ? '#c48a14' : '#1f6b32'], [sx + 2, y, NAVY]);
    }
    cells.push([sx, 3, '#2f7a45'], [sx + 1, 2, '#8fd18a']);
  }
  px(g, cells);
  svg.append(g);
  return svg;
}

function fruitArt(flavor: CaldoFlavor): SVGSVGElement {
  const svg = svgEl('svg', { viewBox: '0 0 16 16', class: 'cd-fruit', 'shape-rendering': 'crispEdges' });
  const g = svgEl('g');
  const cells: [number, number, string][] = [];
  const dot = (x: number, y: number, c: string) => cells.push([x, y, c]);
  if (flavor === 'limao') {
    for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) if (disc(x, y, 8, 8, 5)) dot(x, y, x < 7 && y < 7 ? '#f4f8a8' : '#c6d84a');
    dot(8, 2, '#3d9a4a');
  } else if (flavor === 'abacaxi' || flavor === 'abacaxi_hortela') {
    for (let y = 6; y < 14; y++) for (let x = 4; x < 12; x++) if (disc(x, y, 8, 10, 4.2)) dot(x, y, (x + y) % 2 === 0 ? '#f2c230' : '#e0ae3c');
    for (let x = 6; x <= 10; x++) dot(x, 3, '#3d9a4a');
    dot(8, 2, '#8fd18a');
    dot(5, 4, '#2f7a45');
    dot(11, 4, '#2f7a45');
    if (flavor === 'abacaxi_hortela') {
      dot(12, 6, '#1f6b32');
      dot(13, 5, '#8fd18a');
      dot(13, 7, '#3d9a4a');
    }
  } else if (flavor === 'maracuja') {
    for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) if (disc(x, y, 8, 8, 5)) dot(x, y, x < 7 && y < 7 ? '#f6d48a' : '#d0892c');
    dot(6, 7, NAVY);
    dot(10, 8, NAVY);
    dot(8, 10, '#6b3a22');
  } else if (flavor === 'gengibre') {
    for (const [x, y] of [[4, 8], [5, 7], [6, 6], [7, 6], [8, 5], [9, 6], [10, 7], [11, 8], [8, 8], [7, 9], [6, 9], [9, 9]]) dot(x, y, x < 8 ? '#f0d2a4' : '#d2a36a');
    dot(5, 6, '#f8e2c4');
  } else if (flavor === 'hortela') {
    for (let y = 4; y < 12; y++) for (let x = 3; x < 8; x++) if (disc(x, y, 5, 8, 3.2)) dot(x, y, y < 7 ? '#8fd18a' : '#2f7a45');
    for (let y = 3; y < 11; y++) for (let x = 8; x < 14; x++) if (disc(x, y, 11, 7, 3.2)) dot(x, y, y < 6 ? '#c6e8a0' : '#3d9a4a');
    dot(8, 12, '#1f6b32');
    dot(8, 13, '#1f6b32');
  } else {
    for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) if (disc(x, y, 8, 8, 5)) dot(x, y, x < 7 && y < 7 ? '#ffc56a' : '#e07a20');
    dot(8, 2, '#3d9a4a');
  }
  // a 1px navy edge so the fruit reads on the pump
  const edged: [number, number, string][] = [];
  const set = new Set(cells.map(([x, y]) => `${x},${y}`));
  for (const [x, y, c] of cells) {
    edged.push([x, y, c]);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (!set.has(`${x + dx},${y + dy}`)) edged.push([x + dx, y + dy, NAVY]);
    }
  }
  px(g, edged);
  svg.append(g);
  return svg;
}

/** Ticket icon for the ice: cubes for "com gelo", a struck-out cube for "puro". */
function iceIcon(ice: boolean): SVGSVGElement {
  const svg = svgEl('svg', { viewBox: '0 0 16 16', class: 'cd-ice-icon', 'shape-rendering': 'crispEdges' });
  const g = svgEl('g');
  const cells: [number, number, string][] = [];
  for (const [ox, oy] of ice ? [[2, 6], [8, 3], [7, 9]] : [[5, 5]]) {
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 6; x++) {
        const edge = x === 0 || y === 0 || x === 5 || y === 5;
        cells.push([ox + x, oy + y, edge ? NAVY : x < 3 && y < 3 ? '#ffffff' : '#b7e8ea']);
      }
    }
  }
  if (!ice) for (let i = 0; i < 14; i++) cells.push([1 + i, 14 - i, '#e63f38'], [2 + i, 14 - i, '#e63f38']);
  px(g, cells);
  svg.append(g);
  return svg;
}

function emptyCup(): CupState {
  return { juice: 0, flavor: null, ice: false, spilled: false, at: 'rack' };
}

export class CaldoView {
  readonly root: HTMLElement;
  private orders: CaldoOrder[];
  private cups: CupState[] = [emptyCup(), emptyCup()];
  private customers: LiveCustomer[] = [];
  private nextSpawn = 0;
  private outcomes: FeiraOrderOutcome[] = [];
  private served = 0;
  private scoreGuess = 0;
  private started: number;
  private raf = 0;
  private over = false;
  private cane = false;
  private level = 0;
  private puddle = 0;
  private selected: 'cane' | 0 | 1 | null = null;
  private lastPaint = 0;
  private shownSecond = -1;
  private timerEl: HTMLElement;
  private scoreEl: HTMLElement;
  private queueEl: HTMLElement;
  private waitEl: HTMLElement;
  private popEl: HTMLElement;
  private pressEl: HTMLElement;
  private juiceRect: SVGRectElement;
  private caneLayer: SVGGElement;
  private streamLayer: SVGGElement;
  private leverEl: HTMLElement;
  private leverAngle = 0;
  private cupButtons: HTMLButtonElement[] = [];
  private cupJuice: SVGRectElement[] = [];
  private cupIce: SVGGElement[] = [];
  private cupFoam: SVGGElement[] = [];
  private pumpButtons: HTMLButtonElement[] = [];
  private customerNodes = new Map<number, CustomerNode>();
  private ghost: HTMLElement;
  private dragKind: 'cane' | 'cup' | 'lever' | null = null;
  private kit = new StallKit('caldo');
  /** Which cups were full last frame, so "cheio" pops once when a cup fills. */
  private wasFull = [false, false];

  constructor(
    private readonly seed: number,
    private readonly hooks: CaldoHooks,
  ) {
    this.orders = caldoOrders(seed);
    this.started = performance.now();
    this.timerEl = h('span', { id: 'caldo-timer' }, '90s');
    this.scoreEl = h('span', { id: 'caldo-live-score' }, '0');
    this.queueEl = h('div', { class: 'cd-queue', id: 'caldo-queue' });
    this.waitEl = h('p', { class: 'cd-wait' }, 'Aguardando…', en('Waiting…'));
    this.queueEl.append(this.waitEl);
    this.popEl = h('div', { class: 'cd-pop', id: 'caldo-pop' });
    this.popEl.hidden = true;

    const press = buildPress();
    this.juiceRect = press.juice;
    this.caneLayer = press.cane;
    this.streamLayer = press.stream;
    this.leverEl = h('button', {
      type: 'button',
      id: 'caldo-lever',
      class: 'cd-lever',
      'aria-label': 'Virar a manivela',
    }) as HTMLButtonElement;
    const spout = h('div', { id: 'caldo-spout', class: 'cd-spout', 'aria-label': 'Debaixo da bica' });
    const puddle = h('i', { id: 'caldo-puddle', class: 'cd-puddle', 'aria-hidden': 'true' });
    this.pressEl = h('div', { id: 'caldo-press', class: 'cd-press' }, press.svg, this.leverEl, spout, puddle);
    spout.addEventListener('click', () => this.onSpoutClick());
    this.pressEl.addEventListener('click', (e) => {
      const t = e.target as Element;
      if (t.closest('#caldo-lever, .cd-cup, #caldo-spout')) return;
      if (this.selected === 'cane') {
        this.loadCane();
        this.selected = null;
        this.syncPress();
      }
    });

    for (let i = 0; i < 2; i++) {
      const art = cupArt();
      this.cupJuice.push(art.juice);
      this.cupIce.push(art.ice);
      this.cupFoam.push(art.foam);
      const btn = h('button', {
        type: 'button',
        class: 'cd-cup',
        id: `caldo-cup-${i}`,
        'data-cup': String(i),
        'aria-label': i === 0 ? 'Copo 1' : 'Copo 2',
      }, art.svg) as HTMLButtonElement;
      this.cupButtons.push(btn);
      this.pressEl.append(btn);
      this.bindDrag(btn, 'cup', i);
    }
    const caneBtn = h('button', {
      type: 'button',
      id: 'caldo-cane',
      class: 'cd-cane',
      'aria-label': 'Cana',
    }, caneArt(), h('span', null, 'Cana', en('Cane'))) as HTMLButtonElement;
    const iceBtn = h('button', {
      type: 'button',
      id: 'caldo-ice',
      class: 'cd-ice',
      'aria-label': 'Gelo',
      onclick: () => this.toggleIce(),
    }, h('i', { class: 'cd-ice-cubes', 'aria-hidden': 'true' }), h('span', null, 'Gelo', en('Ice'))) as HTMLButtonElement;

    const pumps = h('div', { class: 'cd-pumps', id: 'caldo-pumps' });
    for (const f of CALDO_FLAVORS) {
      const lab = CALDO_FLAVOR_LABEL[f];
      const btn = h('button', {
        type: 'button',
        class: 'cd-pump',
        id: `caldo-pump-${f}`,
        'data-flavor': f,
        onclick: () => this.pump(f),
      }, h('i', { class: 'cd-pump-top', 'aria-hidden': 'true' }), fruitArt(f), h('span', null, lab.pt, en(lab.en))) as HTMLButtonElement;
      this.pumpButtons.push(btn);
      pumps.append(btn);
    }

    this.ghost = h('div', { id: 'caldo-drag', class: 'cd-ghost', 'aria-hidden': 'true' }, caneArt(), cupArt().svg);
    this.ghost.hidden = true;

    this.root = h('div', { id: 'caldo-root', class: 'cd-root' },
      h('div', { class: 'cd-sky', 'aria-hidden': 'true' }),
      h('div', { class: 'cd-bunting', 'aria-hidden': 'true' }),
      h('header', { class: 'cd-hud', id: 'caldo-hud' },
        h('span', { class: 'cd-title' }, 'Caldo de cana'),
        this.timerEl,
        this.scoreEl,
        this.kit.meter,
        h('button', { type: 'button', class: 'ghost cd-quit', id: 'caldo-quit', onclick: () => this.abandon() }, 'Sair'),
      ),
      stallRoof('caldo'),
      this.queueEl,
      h('div', { class: 'cd-stage' },
        h('div', { class: 'cd-work' },
          caneBtn,
          this.pressEl,
          iceBtn,
        ),
        pumps,
      ),
      counterProps('caldo'),
      h('div', { class: 'cd-floor', 'aria-hidden': 'true' }),
      this.popEl,
      this.ghost,
    );
    this.kit.mount(this.root);
    this.bindDrag(caneBtn, 'cane');
    this.bindDrag(this.leverEl, 'lever');
    document.body.classList.add('cd-on');
    document.getElementById('ui')?.append(this.root);
    this.syncPress();
    this.syncCups();
    this.frame();
  }

  destroy() {
    this.over = true;
    cancelAnimationFrame(this.raf);
    document.body.classList.remove('cd-on');
    this.root.remove();
  }

  showEnd(end: StallEnd) {
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.root.replaceChildren(stallEndCard({
      game: 'caldo',
      prefix: 'caldo',
      cls: 'cd',
      title: 'Caldo de cana',
      end,
      again: () => this.hooks.again(),
      quit: () => this.hooks.quit(),
    }));
  }

  private elapsed() {
    return performance.now() - this.started;
  }

  private frame = () => {
    if (this.over) return;
    const now = performance.now();
    const elapsed = now - this.started;
    if (!this.lastPaint) this.lastPaint = now;
    const dt = Math.max(0, (now - this.lastPaint) / 1000);
    this.lastPaint = now;
    this.drain(dt);
    while (this.nextSpawn < this.orders.length && this.orders[this.nextSpawn]!.at <= elapsed) {
      const order = this.orders[this.nextSpawn]!;
      this.customers.push({ order, index: this.nextSpawn, shownAt: now, gone: false });
      this.nextSpawn += 1;
    }
    for (const c of this.customers) {
      if (c.gone) continue;
      if (now - c.shownAt >= c.order.patienceMs) {
        c.gone = true;
        this.outcomes.push({ i: c.index, quality: 'miss', atMs: Math.round(this.elapsed()) });
        this.kit.lose(this.customerNodes.get(c.index)?.root);
      }
    }
    this.paint(now);
    if (elapsed >= CALDO_DURATION_MS) {
      this.finish();
      return;
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private drain(dt: number) {
    if (this.level <= 0 || dt <= 0) return;
    const drip = CALDO_PRESS.drainPerSec * dt;
    const catching = this.cups.find((c) => c.at === 'spout');
    if (catching && catching.juice < FULL) {
      const take = Math.min(drip, FULL - catching.juice, this.level);
      catching.juice += take;
      this.level -= take;
      return;
    }
    if (catching) return;
    const spill = Math.min(drip, this.level);
    this.level -= spill;
    this.puddle = Math.min(3, this.puddle + spill / 14);
  }

  private paint(now: number) {
    const left = Math.max(0, Math.ceil((CALDO_DURATION_MS - (now - this.started)) / 1000));
    if (left !== this.shownSecond) {
      this.shownSecond = left;
      this.timerEl.textContent = `${left}s`;
    }
    if (this.scoreEl.textContent !== String(this.scoreGuess)) this.scoreEl.textContent = String(this.scoreGuess);
    this.syncCustomers(now);
    this.syncPress();
    this.syncCups();
  }

  private syncPress() {
    this.pressEl.classList.toggle('cd-loaded', this.cane);
    this.pressEl.classList.toggle('cd-flow', this.level > 4);
    this.caneLayer.style.display = this.cane ? '' : 'none';
    this.streamLayer.style.display = this.level > 4 ? '' : 'none';
    const h = Math.round((this.level / CALDO_PRESS.overflow) * 10);
    this.juiceRect.setAttribute('height', String(h));
    this.juiceRect.setAttribute('y', String(42 - h));
    const puddle = this.root.querySelector('#caldo-puddle');
    puddle?.setAttribute('data-n', String(Math.min(3, Math.ceil(this.puddle))));
    const caneBtn = this.root.querySelector('#caldo-cane');
    caneBtn?.classList.toggle('cd-selected', this.selected === 'cane');
    caneBtn?.classList.toggle('cd-used', this.cane);
  }

  private syncCups() {
    this.cups.forEach((cup, i) => {
      const btn = this.cupButtons[i]!;
      btn.classList.toggle('at-spout', cup.at === 'spout');
      const full = cup.juice >= FULL;
      btn.classList.toggle('cd-full', full);
      // the cup-full cue: one pop when it fills, so you pull it before the press runs dry onto the floor
      if (full && !this.wasFull[i]) replay(btn, 'fs-glow', 600);
      this.wasFull[i] = full;
      btn.classList.toggle('cd-selected', this.selected === i);
      btn.classList.toggle('cd-iced', cup.ice);
      const flavor = cup.flavor ?? '';
      if (btn.dataset.flavor !== flavor) btn.dataset.flavor = flavor;
      const h = Math.round((Math.min(FULL, cup.juice) / FULL) * 12);
      const rect = this.cupJuice[i]!;
      rect.setAttribute('height', String(h));
      rect.setAttribute('y', String(21 - h));
      rect.setAttribute('fill', JUICE[cup.flavor ?? 'plain']);
      this.cupFoam[i]!.style.display = cup.juice > 16 ? '' : 'none';
      this.cupIce[i]!.style.display = cup.ice ? '' : 'none';
    });
  }

  private liveCustomers() {
    return this.customers.filter((c) => !c.gone).slice(0, 3);
  }

  private syncCustomers(now: number) {
    const live = this.liveCustomers();
    const ids = new Set(live.map((c) => c.index));
    for (const [i, node] of this.customerNodes) {
      if (ids.has(i)) continue;
      node.root.remove();
      this.customerNodes.delete(i);
    }
    this.waitEl.hidden = live.length > 0;
    for (const c of live) {
      let node = this.customerNodes.get(c.index);
      if (!node) {
        node = this.makeCustomer(c);
        this.customerNodes.set(c.index, node);
        this.queueEl.append(node.root);
      }
      const frac = Math.max(0, 1 - (now - c.shownAt) / c.order.patienceMs);
      const lit = Math.max(0, Math.min(4, Math.ceil(frac * 4)));
      node.pips.forEach((pip, i) => pip.classList.toggle('on', i < lit));
      const expr: Expression = frac < 0.28 ? 'pensativo' : 'neutro';
      if (node.img && node.expr !== expr) {
        node.expr = expr;
        node.img.src = imageUrl(portraitKey(c.order.who, expr));
      }
      node.root.classList.toggle('fs-hurry', frac < 0.28);
    }
  }

  private makeCustomer(c: LiveCustomer): CustomerNode {
    const pips = [0, 1, 2, 3].map(() => h('i', { class: 'on' }));
    const face = npcPortrait(c.order.who, 'neutro', 'cd-portrait');
    const fruit = fruitArt(c.order.flavor);
    fruit.setAttribute('class', 'fs-ticket-icon');
    const ice = iceIcon(c.order.ice === 'gelo');
    ice.setAttribute('class', 'fs-ticket-icon');
    const root = h('div', { class: 'cd-customer fs-arrive', 'data-order': String(c.index) },
      face,
      ticket(fruit, ice),
      h('div', { class: 'cd-order' },
        h('b', null, c.order.name),
        h('div', { class: 'cd-pips', 'aria-label': '4 of 4' }, ...pips),
        h('p', { class: 'cd-pt', lang: 'pt-BR' }, c.order.line.pt),
        h('p', { class: 'en' }, c.order.line.en),
      ),
      h('button', {
        type: 'button',
        class: 'cd-serve',
        'data-serve': String(c.index),
        id: `caldo-serve-${c.index}`,
        onclick: () => this.serveTo(c),
      }, 'Servir', en('Serve')),
    );
    return { root, pips, img: face.querySelector('img'), expr: 'neutro' };
  }

  private bindDrag(el: HTMLElement, kind: 'cane' | 'cup' | 'lever', index?: number) {
    el.addEventListener('pointerdown', (e) => {
      if (this.over || e.button > 0) return;
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      let moved = false;
      this.dragKind = kind;
      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (dx * dx + dy * dy > 36) moved = true;
        if (kind === 'lever') {
          this.leverAngle = Math.max(-50, Math.min(55, dx * 0.7));
          this.leverEl.style.transform = `rotate(${this.leverAngle}deg)`;
          return;
        }
        if (!moved) return;
        this.ghost.hidden = false;
        this.ghost.className = kind === 'cane' ? 'cd-ghost cd-ghost-cane' : 'cd-ghost cd-ghost-cup';
        this.ghost.style.transform = `translate(${ev.clientX}px, ${ev.clientY}px)`;
      };
      const onUp = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        this.ghost.hidden = true;
        this.dragKind = null;
        if (kind === 'lever') {
          const travel = Math.abs(this.leverAngle);
          this.leverAngle = 0;
          this.leverEl.style.transform = '';
          if (!moved || travel > 18) this.crank();
          return;
        }
        if (!moved) {
          this.onTap(kind, index);
          return;
        }
        const hit = document.elementFromPoint(ev.clientX, ev.clientY);
        if (kind === 'cane') {
          if (hit?.closest('#caldo-press')) this.loadCane();
          this.selected = null;
        } else if (index !== undefined) {
          if (this.overBox(ev.clientX, ev.clientY, '#caldo-spout') || hit?.closest('#caldo-spout')) this.placeCup(index, 'spout');
          else {
            if (this.level > 2) this.missCup(index);
            this.placeCup(index, 'rack');
          }
          if (index === 0 || index === 1) this.selected = index;
        }
        this.syncPress();
        this.syncCups();
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });
    el.addEventListener('click', (e) => e.stopPropagation());
  }

  private overBox(x: number, y: number, sel: string) {
    const node = this.root.querySelector(sel);
    if (!node) return false;
    const b = node.getBoundingClientRect();
    return x >= b.left - 8 && x <= b.right + 8 && y >= b.top - 8 && y <= b.bottom + 8;
  }

  private onTap(kind: 'cane' | 'cup', index?: number) {
    if (kind === 'cane') {
      this.selected = this.selected === 'cane' ? null : 'cane';
    } else if (index !== undefined) {
      if (index !== 0 && index !== 1) return;
      if (this.selected === index && this.cups[index]!.at === 'spout') this.placeCup(index, 'rack');
      this.selected = index;
    }
    this.syncPress();
    this.syncCups();
  }

  private onSpoutClick() {
    if (typeof this.selected === 'number') this.placeCup(this.selected, 'spout');
    else if (this.selected === 'cane') {
      this.loadCane();
      this.selected = null;
    }
    this.syncPress();
    this.syncCups();
  }

  private loadCane() {
    if (this.cane || this.over) return;
    this.cane = true;
    this.syncPress();
  }

  private crank() {
    if (!this.cane || this.over) return;
    this.cane = false;
    if (this.level + CALDO_PRESS.crankJuice > CALDO_PRESS.overflow) {
      this.level = 0;
      this.puddle = 3;
      this.flash('miss', CALDO_OVERFLOW);
      this.splash();
    } else {
      this.level += CALDO_PRESS.crankJuice;
    }
    this.syncPress();
  }

  private placeCup(index: number, at: 'rack' | 'spout') {
    const cup = this.cups[index];
    if (!cup) return;
    if (at === 'spout') {
      this.cups.forEach((other, i) => {
        if (i !== index && other.at === 'spout') other.at = 'rack';
      });
    }
    cup.at = at;
  }

  private missCup(index: number) {
    const cup = this.cups[index];
    if (!cup) return;
    cup.spilled = true;
    this.puddle = Math.min(3, this.puddle + 1.2);
    this.level = Math.max(0, this.level - 18);
    this.flash('soft', CALDO_SPILL);
    this.splash();
  }

  /** Spill or overflow: the press shakes and juice splashes on the floor. */
  private splash() {
    this.kit.shake(this.pressEl);
    replay(this.root.querySelector('#caldo-puddle'), 'fs-splash', 700);
  }

  private targetCup(): CupState | null {
    if (typeof this.selected === 'number') {
      const cup = this.cups[this.selected]!;
      if (cup.juice > 6) return cup;
    }
    return this.cups.find((c) => c.at === 'spout' && c.juice > 6) ?? this.cups.find((c) => c.juice >= FULL) ?? null;
  }

  private pump(flavor: CaldoFlavor) {
    const cup = this.targetCup();
    if (!cup) return;
    cup.flavor = flavor;
    this.syncCups();
  }

  private toggleIce() {
    const cup = this.targetCup();
    if (!cup) return;
    cup.ice = !cup.ice;
    this.syncCups();
  }

  private serveTo(c: LiveCustomer) {
    if (c.gone || this.over) return;
    const prefer = typeof this.selected === 'number' ? this.cups[this.selected] : undefined;
    const cup = prefer && prefer.juice >= FULL && prefer.flavor ? prefer : this.cups.find((x) => x.juice >= FULL && x.flavor);
    if (!cup) return;
    const frac = Math.max(0, 1 - (performance.now() - c.shownAt) / c.order.patienceMs);
    const flavorOk = cup.flavor === c.order.flavor;
    const iceOk = cup.ice === (c.order.ice === 'gelo');
    const quality = caldoServeQuality({ flavorOk, iceOk, spilled: cup.spilled, patienceLeft: frac });
    this.outcomes.push({ i: c.index, quality, atMs: Math.round(this.elapsed()) });
    c.gone = true;
    cup.juice = 0;
    cup.flavor = null;
    cup.ice = false;
    cup.spilled = false;
    cup.at = 'rack';
    if (quality !== 'miss') this.served += 1;
    this.scoreGuess += POINTS[quality];
    const at = this.customerNodes.get(c.index)?.root;
    if (quality === 'miss') this.kit.lose(at);
    else this.kit.gain(at, POINTS[quality], quality);
    const line = !flavorOk
      ? CALDO_WRONG_FLAVOR
      : !iceOk
        ? CALDO_WRONG_ICE
        : quality === 'perfect'
          ? CALDO_POP.perfect
          : quality === 'ok'
            ? CALDO_THANKS
            : quality === 'soft'
              ? CALDO_POP.soft
              : CALDO_POP.miss;
    this.flash(quality === 'miss' ? 'miss' : quality === 'perfect' ? 'perfect' : 'soft', line);
    this.syncCups();
  }

  private flash(kind: 'perfect' | 'soft' | 'miss', line: { pt: string; en: string }) {
    this.popEl.replaceChildren(document.createTextNode(line.pt), en(line.en));
    this.popEl.className = `cd-pop cd-pop-${kind}`;
    this.popEl.hidden = false;
    window.setTimeout(() => {
      this.popEl.hidden = true;
    }, 700);
  }

  private abandon() {
    this.finish();
  }

  private finish() {
    if (this.over) return;
    this.over = true;
    cancelAnimationFrame(this.raf);
    const now = Math.round(this.elapsed());
    for (const c of this.customers) {
      if (c.gone) continue;
      if (this.outcomes.some((o) => o.i === c.index)) continue;
      this.outcomes.push({ i: c.index, quality: 'miss' as FeiraQuality, atMs: now });
    }
    this.hooks.finish(this.outcomes);
  }
}
