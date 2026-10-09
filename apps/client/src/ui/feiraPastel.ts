/**
 * Pastel, the made-to-order Feira cart game.
 *
 * The server dealt the seed. Orders come from shared `pastelOrders(seed)`, so what the player sees
 * is what the server will score. This view only collects per-order quality and timing.
 *
 * The stall is built once. A frame only rewrites text, classes, a cook bar and which pixel layer
 * is showing, so a mouse click lands on the same button that received the press.
 *
 * Grab dough, tap the filling (two taps for a combo), crimp with the fork, drop it in the oil.
 * Pull it while it is golden. Leave it and it goes dark, black, a charcoal block, then fire.
 * "Apaga!" puts the fire out. Burnt is a soft fail, never a game over.
 *
 * needs_br: true (order lines, pops, the sheepish aside, the end card).
 */
import {
  PASTEL_DURATION_MS,
  PASTEL_PARTS,
  PASTEL_PART_LABEL,
  PASTEL_POP,
  PASTEL_RECIPE,
  PASTEL_SHEEPISH,
  feiraMeterWindow,
  pastelDoneness,
  pastelFromParts,
  pastelFry,
  pastelOrders,
  pastelServeQuality,
  pastelSlots,
  type FeiraOrderOutcome,
  type FeiraQuality,
  type PastelDoneness,
  type PastelFilling,
  type PastelOrder,
  type PastelPart,
} from '@tudobem/shared';
import { h, en, bi } from './dom';
import { pixelSvg } from './pixelSvg';
import { npcPortrait, portraitKey, type Expression } from './pixelArt';
import { imageUrl } from '../render/pixel/manifest';
import { StallKit, counterProps, meterWindow, stallEndCard, stallRoof, ticket, type StallEnd } from './feiraStall';

export type PastelEnd = StallEnd;

export interface PastelHooks {
  finish: (outcomes: FeiraOrderOutcome[]) => void;
  quit: () => void;
  again: () => void;
}

/** LimeZu palette (apps/client/assets-src/custom/kit.mjs C / K). Light comes from the upper left. */
const NAVY = '#3a3a50';
const INK = {
  raw: { hi: '#fff59a', mid: '#f0efde', shade: '#e0d0b2', dark: '#c78c59' },
  golden: { hi: '#fff59a', mid: '#f2b22b', shade: '#ed931e', dark: '#66451e' },
  dark: { hi: '#ed931e', mid: '#66451e', shade: '#573c2c', dark: '#381a08' },
  black: { hi: '#565972', mid: '#3a3a50', shade: '#2a2233', dark: '#1a120c' },
} as const;

const FILL_INK: Record<PastelPart, { base: string; hi: string }> = {
  carne: { base: '#a82b2d', hi: '#e07070' },
  queijo: { base: '#f2c230', hi: '#fff59a' },
  pizza: { base: '#e63f38', hi: '#ff8575' },
  calabresa: { base: '#cb2a2a', hi: '#fc5c46' },
  palmito: { base: '#c78c59', hi: '#f2bd7a' },
  frango: { base: '#f2bd7a', hi: '#fff59a' },
  camarao: { base: '#ff8575', hi: '#fff59a' },
  catupiry: { base: '#fff6e6', hi: '#ffffff' },
  goiabada: { base: '#c44536', hi: '#e07070' },
  banana: { base: '#f2b22b', hi: '#fff59a' },
  canela: { base: '#6b4c2c', hi: '#a9764f' },
};

const NS = 'http://www.w3.org/2000/svg';
const PW = 48;
const PH = 42;
const CX = 24;
const CY = 27;

type AsmStep = 'empty' | 'dough' | 'open' | 'crimped';

interface Assembly {
  step: AsmStep;
  parts: PastelPart[];
}

interface FrySlot {
  /** empty, in the oil, or pulled and waiting to be served. Fire is derived from age. */
  phase: 'empty' | 'frying' | 'ready';
  droppedAt: number;
  filling: PastelFilling | null;
  combo: boolean;
  /** Doneness at the moment it left the oil (a pull, or Apaga). */
  pulled: PastelDoneness | null;
}

interface LiveCustomer {
  order: PastelOrder;
  index: number;
  shownAt: number;
  gone: boolean;
}

interface SlotNode {
  wrap: HTMLElement;
  btn: HTMLButtonElement;
  svg: SVGSVGElement;
  meter: HTMLElement;
  apaga: HTMLButtonElement;
  pt: Text;
  gloss: Text;
  visual: string;
  /** The golden window on the fry meter; it moves for a combo (shorter golden). */
  sweet: HTMLElement;
  sweetCombo: boolean | null;
  fire: boolean;
}

function goldenWindow(combo: boolean) {
  const fry = pastelFry(combo);
  return feiraMeterWindow(fry.goldenAt, fry.darkAt, fry.fireAt);
}

interface CustomerNode {
  root: HTMLElement;
  pips: HTMLElement[];
  img: HTMLImageElement | null;
  expr: Expression;
  react: HTMLElement;
}

type PopKind = keyof typeof PASTEL_POP;

const STAGE_LABEL: Record<PastelDoneness | 'empty' | 'ready', { pt: string; en: string }> = {
  empty: { pt: 'Óleo', en: 'Oil' },
  raw: { pt: 'Fritando', en: 'Frying' },
  golden: { pt: 'Dourado!', en: 'Golden!' },
  dark: { pt: 'Escuro', en: 'Dark' },
  black: { pt: 'Preto', en: 'Black' },
  block: { pt: 'Tijolo', en: 'A brick' },
  fire: { pt: 'Fogo!', en: 'Fire!' },
  ready: { pt: 'Pronto', en: 'Ready' },
};

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string> = {}): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function addPx(g: SVGGElement, cells: [number, number, string][]) {
  const seen = new Set<string>();
  for (const [x, y, fill] of cells) {
    if (x < 0 || y < 0 || x >= PW || y >= PH) continue;
    const k = `${x},${y}`;
    if (seen.has(k)) continue;
    seen.add(k);
    g.append(svgEl('rect', { x: String(x), y: String(y), width: '1', height: '1', fill }));
  }
}

/** Navy ring in the transparent pixels touching the shape. */
function outline(body: [number, number, string][]): [number, number, string][] {
  const on = new Set(body.map(([x, y]) => `${x},${y}`));
  const out = body.slice();
  for (const [x, y] of body) {
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ] as const) {
      const k = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= PW || ny >= PH || on.has(k)) continue;
      on.add(k);
      out.push([nx, ny, NAVY]);
    }
  }
  return out;
}

/** Open wrapper: a round disc of dough. Sealed pastel: a half-moon with the crimp along the top. */
function turnover(ink: { hi: string; mid: string; shade: string; dark: string }, sealed: boolean): [number, number, string][] {
  const body: [number, number, string][] = [];
  const ox = CX;
  const oy = sealed ? 16 : CY - 2;
  const rx = 16;
  const ry = sealed ? 14 : 11;
  for (let y = 0; y < PH; y++) {
    for (let x = 0; x < PW; x++) {
      const dx = (x + 0.5 - ox) / rx;
      const dy = (y + 0.5 - oy) / ry;
      if (sealed && dy < -0.02) continue;
      const r = dx * dx + dy * dy;
      if (r > 1) continue;
      const edge = r > 0.82 || (sealed && dy < 0.12);
      const lit = dx < -0.15 && dy < 0.35;
      const shade = dx > 0.35 || dy > 0.62;
      let c = lit ? ink.hi : shade ? ink.dark : r > 0.45 ? ink.shade : ink.mid;
      if (edge) c = ink.dark;
      else if ((x * 3 + y * 5) % 17 === 0) c = ink.hi;
      body.push([x, y, c]);
    }
  }
  return outline(body);
}

function crimpMarks(): [number, number, string][] {
  const cells: [number, number, string][] = [];
  for (let x = CX - 14; x <= CX + 14; x += 3) {
    const dx = (x + 0.5 - CX) / 16;
    if (Math.abs(dx) > 0.96) continue;
    const y = 15;
    cells.push([x, y, NAVY], [x, y + 1, '#f8f8f8'], [x + 1, y, NAVY], [x, y - 1, NAVY]);
  }
  return cells;
}

function charcoal(): [number, number, string][] {
  const body: [number, number, string][] = [];
  for (let y = 16; y <= 36; y++) {
    for (let x = 10; x <= 38; x++) {
      const edge = x <= 11 || x >= 37 || y <= 17 || y >= 35;
      const lit = x < 18 && y < 22;
      let c = edge ? NAVY : lit ? '#565972' : (x + y) % 5 === 0 ? '#1a120c' : '#2a2233';
      if (!edge && (y === 24 || y === 29) && x > 14 && x < 34 && x % 2 === 0) c = '#cb2a2a';
      body.push([x, y, c]);
    }
  }
  return body;
}

function flames(shift: number): [number, number, string][] {
  const cells: [number, number, string][] = [];
  [14, 22, 30, 36].forEach((x, i) => {
    const h = 10 + ((i + shift) % 3) * 3;
    for (let k = 0; k < h; k++) {
      const y = 16 - k;
      const c = k > h - 3 ? '#fff59a' : k > 4 ? '#f2b22b' : '#e63f38';
      const w = k % 2 === 0 ? 1 : 0;
      cells.push([x, y, c], [x + w, y, k < 3 ? '#ed931e' : c], [x - w, y, '#f8d239']);
    }
  });
  return cells;
}

function smokePuffs(): SVGGElement {
  const g = svgEl('g', { class: 'g-smoke' });
  [[8, 8], [20, 3], [33, 7], [14, 12]].forEach(([sx, sy], i) => {
    const puff = svgEl('g', { class: 'puff' });
    puff.setAttribute('style', `animation-delay:${i * 0.2}s`);
    addPx(puff, [
      [sx, sy, '#d8d0e0'],
      [sx + 1, sy, '#f8f8f8'],
      [sx + 2, sy, '#a2a6be'],
      [sx, sy + 1, '#a2a6be'],
      [sx + 1, sy + 1, '#f8f8f8'],
    ]);
    g.append(puff);
  });
  return g;
}

function blob(part: PastelPart, side: 'one' | 'a' | 'b'): [number, number, string][] {
  const ink = FILL_INK[part];
  const cells: [number, number, string][] = [];
  const rx = side === 'one' ? 7 : 5.5;
  for (let y = 0; y < PH; y++) {
    for (let x = 0; x < PW; x++) {
      if (side === 'a' && x > CX) continue;
      if (side === 'b' && x <= CX) continue;
      const dx = (x + 0.5 - CX) / rx;
      const dy = (y + 0.5 - (CY + 1)) / 4.6;
      if (dx * dx + dy * dy > 1) continue;
      cells.push([x, y, (x + y) % 3 === 0 ? ink.hi : ink.base]);
    }
  }
  return cells;
}

/** One pastel picture: dough stages, the charcoal block, flames, smoke, and every filling. Built once. */
function buildPastelSvg(): SVGSVGElement {
  const svg = svgEl('svg', {
    viewBox: `0 0 ${PW} ${PH}`,
    class: 'ps-pas st-empty',
    'shape-rendering': 'crispEdges',
  });
  const layers: [string, [number, number, string][]][] = [
    ['g-raw', turnover(INK.raw, false)],
    ['g-folded', turnover(INK.raw, true)],
    ['g-golden', turnover(INK.golden, true)],
    ['g-dark', turnover(INK.dark, true)],
    ['g-black', turnover(INK.black, true)],
    ['g-block', charcoal()],
    ['g-crimp', crimpMarks()],
    ['g-flame g-flame-a', flames(0)],
    ['g-flame g-flame-b', flames(1)],
    ['g-flame g-flame-c', flames(2)],
  ];
  for (const [cls, cells] of layers) {
    const g = svgEl('g', { class: cls });
    addPx(g, cells);
    svg.append(g);
  }
  svg.append(smokePuffs());
  for (const part of PASTEL_PARTS) {
    for (const side of ['one', 'a', 'b'] as const) {
      const g = svgEl('g', { class: `g-fill g-fill-${side}-${part}` });
      addPx(g, blob(part, side));
      svg.append(g);
    }
  }
  return svg;
}

/** A small bowl, one per filling part. pixelSvg keeps the pixels crisp. */
function bowlSvg(part: PastelPart): SVGSVGElement {
  const ink = FILL_INK[part];
  const rows = [
    '................',
    '....nnnnnnnn....',
    '...nppppppppn...',
    '..nppppppppppn..',
    '..npffffffffpn..',
    '.nppffffffffppn.',
    '.nppffhhffffppn.',
    '.nppffffffffppn.',
    '..nppppppppppn..',
    '...nnnnnnnnnn...',
    '................',
    '................',
  ];
  return pixelSvg(rows, { n: NAVY, p: '#f8f8f8', f: ink.base, h: ink.hi }, 'ps-bowl-svg');
}

function oilBubbles(): HTMLElement {
  const el = h('div', { class: 'ps-bubbles', 'aria-hidden': 'true' });
  const spots: [number, number][] = [
    [8, 62],
    [18, 38],
    [30, 74],
    [44, 28],
    [58, 66],
    [70, 40],
    [82, 72],
    [90, 34],
    [24, 52],
    [50, 48],
  ];
  spots.forEach(([x, y], i) => {
    el.append(h('i', { style: `left:${x}%;top:${y}%;animation-delay:${(i * 0.17).toFixed(2)}s` }));
  });
  return el;
}

export class PastelView {
  readonly root: HTMLElement;
  private orders: PastelOrder[];
  private asm: Assembly = { step: 'empty', parts: [] };
  private slots: FrySlot[] = [0, 1, 2].map(() => ({ phase: 'empty', droppedAt: 0, filling: null, combo: false, pulled: null }));
  private customers: LiveCustomer[] = [];
  private nextSpawn = 0;
  private outcomes: FeiraOrderOutcome[] = [];
  private served = 0;
  private scoreGuess = 0;
  private combo = 0;
  private started: number;
  private raf = 0;
  private over = false;
  private shownSecond = -1;
  private timerEl: HTMLElement;
  private scoreEl: HTMLElement;
  private queueEl: HTMLElement;
  private waitEl: HTMLElement;
  private popEl: HTMLElement;
  private slotsEl: HTMLElement;
  private asmSvg: SVGSVGElement;
  private doughBtn: HTMLButtonElement;
  private crimpBtn: HTMLButtonElement;
  private slotNodes: SlotNode[] = [];
  private customerNodes = new Map<number, CustomerNode>();
  private bowlButtons = new Map<PastelPart, HTMLButtonElement>();
  private asmVisual = '';
  private kit = new StallKit('pastel');

  constructor(
    private readonly seed: number,
    private readonly hooks: PastelHooks,
  ) {
    this.orders = pastelOrders(seed);
    this.started = performance.now();
    this.timerEl = h('span', { id: 'pastel-timer' }, '90s');
    this.scoreEl = h('span', { id: 'pastel-live-score' }, '0');
    this.queueEl = h('div', { class: 'ps-queue', id: 'pastel-queue' });
    this.waitEl = h('p', { class: 'ps-wait' }, 'Aguardando…', en('Waiting…'));
    this.queueEl.append(this.waitEl);
    this.popEl = h('div', { class: 'ps-pop', id: 'pastel-pop' });
    this.popEl.hidden = true;
    this.asmSvg = buildPastelSvg();
    this.doughBtn = h('button', {
      type: 'button',
      class: 'ps-act',
      id: 'pastel-dough',
      onclick: () => this.grabDough(),
    }, 'Massa', en('Dough')) as HTMLButtonElement;
    this.crimpBtn = h('button', {
      type: 'button',
      class: 'ps-act',
      id: 'pastel-crimp',
      onclick: () => this.crimp(),
    }, 'Garfo', en('Crimp')) as HTMLButtonElement;
    this.slotsEl = h('div', { class: 'ps-slots slots-2', id: 'pastel-slots' });
    const bowls = h('div', { class: 'ps-bowls', id: 'pastel-bowls' });
    for (const part of PASTEL_PARTS) {
      const lab = PASTEL_PART_LABEL[part];
      const btn = h('button', {
        type: 'button',
        class: 'ps-bowl',
        'data-part': part,
        id: `pastel-bowl-${part}`,
        onclick: () => this.addPart(part),
      }, bowlSvg(part), h('span', { class: 'ps-bowl-name' }, lab.pt, en(lab.en))) as HTMLButtonElement;
      this.bowlButtons.set(part, btn);
      bowls.append(btn);
    }
    this.root = h('div', { id: 'pastel-root', class: 'ps-root' },
      h('div', { class: 'ps-sky', 'aria-hidden': 'true' }),
      h('div', { class: 'ps-bunting', 'aria-hidden': 'true' }),
      h('header', { class: 'ps-hud', id: 'pastel-hud' },
        h('span', { class: 'ps-title' }, 'Pastel'),
        this.timerEl,
        this.scoreEl,
        this.kit.meter,
        h('button', { type: 'button', class: 'ghost ps-quit', id: 'pastel-quit', onclick: () => this.abandon() }, bi('Sair', 'Leave')),
      ),
      stallRoof('pastel'),
      this.queueEl,
      h('div', { class: 'ps-stall' },
        h('div', { class: 'ps-board', id: 'pastel-board' },
          this.doughBtn,
          h('div', { class: 'ps-assembly', id: 'pastel-assembly' }, this.asmSvg),
          this.crimpBtn,
        ),
        h('div', { class: 'ps-fryer', id: 'pastel-fryer' },
          h('div', { class: 'ps-vat' },
            h('div', { class: 'ps-oil' }, oilBubbles(), this.slotsEl),
            h('div', { class: 'ps-vat-lip', 'aria-hidden': 'true' }),
          ),
        ),
        counterProps('pastel'),
        h('div', { class: 'ps-counter', 'aria-hidden': 'true' }),
      ),
      bowls,
      h('div', { class: 'ps-floor', 'aria-hidden': 'true' }),
      this.popEl,
    );
    this.kit.mount(this.root);
    for (let i = 0; i < 3; i++) this.addSlot(i);
    document.body.classList.add('ps-on');
    document.getElementById('ui')?.append(this.root);
    this.frame();
  }

  destroy() {
    this.over = true;
    cancelAnimationFrame(this.raf);
    document.body.classList.remove('ps-on');
    this.root.remove();
  }

  showEnd(end: PastelEnd) {
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.root.replaceChildren(stallEndCard({
      game: 'pastel',
      prefix: 'pastel',
      cls: 'ps',
      title: 'Pastel',
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
        this.combo = 0;
        this.kit.lose(this.customerNodes.get(c.index)?.root);
      }
    }
    this.paint(now);
    if (elapsed >= PASTEL_DURATION_MS) {
      this.finish();
      return;
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private liveCustomers() {
    return this.customers.filter((c) => !c.gone).slice(0, 3);
  }

  private onFire(now: number): boolean {
    return this.slots.some((s) => s.phase === 'frying' && pastelDoneness(now - s.droppedAt, s.combo) === 'fire');
  }

  private paint(now: number) {
    const left = Math.max(0, Math.ceil((PASTEL_DURATION_MS - (now - this.started)) / 1000));
    if (left !== this.shownSecond) {
      this.shownSecond = left;
      this.timerEl.textContent = `${left}s`;
    }
    if (this.scoreEl.textContent !== String(this.scoreGuess)) this.scoreEl.textContent = String(this.scoreGuess);
    this.syncAssembly();
    const open = pastelSlots(this.served);
    this.slotsEl.classList.toggle('slots-2', open === 2);
    this.slotsEl.classList.toggle('slots-3', open === 3);
    const fire = this.onFire(now);
    this.slotNodes.forEach((node, i) => this.syncSlot(node, this.slots[i]!, i >= open, now));
    this.syncCustomers(now, fire);
  }

  private syncAssembly() {
    const parts = this.asm.parts;
    const bits = ['ps-pas'];
    if (this.asm.step === 'empty') bits.push('st-empty');
    else if (this.asm.step === 'crimped') bits.push('st-folded', 'crimped');
    else bits.push('st-raw', 'open', `parts-${parts.length}`);
    if (parts[0]) bits.push(`fill-a-${parts[0]}`);
    if (parts[1]) bits.push(`fill-b-${parts[1]}`);
    const visual = bits.join(' ');
    if (visual !== this.asmVisual) {
      this.asmVisual = visual;
      this.asmSvg.setAttribute('class', visual);
    }
    this.doughBtn.classList.toggle('on', this.asm.step !== 'empty');
    this.crimpBtn.classList.toggle('on', this.asm.step === 'crimped');
    for (const [id, btn] of this.bowlButtons) btn.classList.toggle('on', parts.includes(id));
  }

  private addSlot(index: number) {
    const svg = buildPastelSvg();
    const meter = h('i');
    const pt = document.createTextNode(STAGE_LABEL.empty.pt);
    const gloss = document.createTextNode(STAGE_LABEL.empty.en);
    const btn = h('button', {
      type: 'button',
      class: 'ps-slot is-empty',
      'data-slot': String(index),
      'data-state': 'empty',
      'data-doneness': 'empty',
      id: `pastel-slot-${index}`,
      onclick: () => this.onSlot(index),
    },
      h('span', { class: 'ps-slot-art' }, svg, h('i', { class: 'ps-meniscus', 'aria-hidden': 'true' })),
      h('span', { class: 'ps-meter' }, meter),
      h('span', { class: 'ps-slot-label' }, pt, en('')),
    ) as HTMLButtonElement;
    const glossEl = btn.querySelector('.ps-slot-label .en')!;
    glossEl.textContent = '';
    glossEl.append(gloss);
    const apaga = h('button', {
      type: 'button',
      class: 'ps-apaga',
      id: `pastel-apaga-${index}`,
      hidden: true,
      onclick: (ev: Event) => {
        ev.stopPropagation();
        this.apaga(index);
      },
    }, 'Apaga!', en('Put it out!')) as HTMLButtonElement;
    const wrap = h('div', { class: 'ps-slot-wrap', id: `pastel-wrap-${index}` }, btn, apaga);
    const sweet = meterWindow(meter.parentElement!, goldenWindow(false));
    const node: SlotNode = { wrap, btn, svg, meter, apaga, pt, gloss, visual: '', sweet, sweetCombo: false, fire: false };
    this.slotNodes.push(node);
    this.slotsEl.append(wrap);
  }

  private syncSlot(node: SlotNode, slot: FrySlot, locked: boolean, now: number) {
    node.wrap.hidden = locked;
    const age = slot.phase === 'frying' ? now - slot.droppedAt : 0;
    const live = slot.phase === 'frying' ? pastelDoneness(age, slot.combo) : slot.pulled;
    const state = slot.phase === 'empty' ? 'empty' : slot.phase === 'ready' ? 'ready' : live === 'fire' ? 'fire' : 'frying';
    const labelKey = state === 'empty' ? 'empty' : state === 'ready' ? 'ready' : (live ?? 'raw');
    const label = STAGE_LABEL[labelKey];
    if (node.pt.data !== label.pt) node.pt.data = label.pt;
    if (node.gloss.data !== label.en) node.gloss.data = label.en;
    if (node.btn.getAttribute('data-state') !== state) node.btn.setAttribute('data-state', state);
    const doneness = state === 'empty' ? 'empty' : state === 'ready' ? (slot.pulled ?? 'ready') : (live ?? 'raw');
    if (node.btn.getAttribute('data-doneness') !== doneness) node.btn.setAttribute('data-doneness', doneness);
    node.btn.classList.toggle('is-empty', state === 'empty');
    node.btn.classList.toggle('is-frying', state === 'frying');
    node.btn.classList.toggle('is-fire', state === 'fire');
    node.btn.classList.toggle('is-ready', state === 'ready');
    node.btn.classList.toggle('is-golden', live === 'golden' && state === 'frying');
    node.apaga.hidden = state !== 'fire';
    // catching fire shakes the pan once, so it reads before the label does
    if (state === 'fire' && !node.fire) this.kit.shake(node.wrap);
    node.fire = state === 'fire';
    if (slot.phase === 'frying' && node.sweetCombo !== slot.combo) {
      node.sweetCombo = slot.combo;
      const w = goldenWindow(slot.combo);
      node.sweet.style.left = `${(w.from * 100).toFixed(1)}%`;
      node.sweet.style.width = `${((w.to - w.from) * 100).toFixed(1)}%`;
    }
    const stage = state === 'empty' ? 'empty' : state === 'ready' ? (slot.pulled ?? 'golden') : (live ?? 'raw');
    const visual = `ps-pas st-${stage === 'empty' ? 'empty' : stage}`;
    if (node.visual !== visual) {
      node.visual = visual;
      node.svg.setAttribute('class', visual);
    }
    const cooking = state === 'frying' || state === 'fire';
    node.meter.parentElement!.hidden = !cooking;
    if (cooking) {
      const span = pastelFry(slot.combo).fireAt;
      node.meter.style.width = `${Math.max(6, Math.min(100, Math.round((age / span) * 100)))}%`;
      node.meter.dataset.stage = live ?? 'raw';
    }
  }

  private syncCustomers(now: number, fire: boolean) {
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
      const expr: Expression = fire || frac < 0.28 ? 'pensativo' : 'neutro';
      if (node.img && node.expr !== expr) {
        node.expr = expr;
        node.img.src = imageUrl(portraitKey(c.order.who, expr));
      }
      node.react.hidden = !fire;
      node.root.classList.toggle('ps-sheepish', fire);
      node.root.classList.toggle('fs-hurry', frac < 0.28);
    }
  }

  private makeCustomer(c: LiveCustomer): CustomerNode {
    const pips = [0, 1, 2, 3].map(() => h('i', { class: 'on' }));
    const face = npcPortrait(c.order.who, 'neutro', 'ps-portrait');
    const react = h('p', { class: 'ps-react', hidden: true }, PASTEL_SHEEPISH.pt, en(PASTEL_SHEEPISH.en));
    // the ticket shows each part of the order, so a combo reads as two bowls before the line does
    const icons = PASTEL_RECIPE[c.order.filling].parts.map((part) => {
      const icon = bowlSvg(part);
      icon.setAttribute('class', 'fs-ticket-icon');
      return icon;
    });
    const root = h('div', { class: 'ps-customer fs-arrive', 'data-order': String(c.index) },
      face,
      ticket(...icons),
      h('div', { class: 'ps-order' },
        h('b', null, c.order.name),
        h('div', { class: 'ps-pips', 'aria-label': '4 of 4' }, ...pips),
        h('p', { class: 'ps-pt', lang: 'pt-BR' }, c.order.line.pt),
        h('p', { class: 'en' }, c.order.line.en),
        react,
      ),
      h('button', {
        type: 'button',
        class: 'ps-serve',
        'data-serve': String(c.index),
        id: `pastel-serve-${c.index}`,
        onclick: () => this.serveTo(c),
      }, 'Servir', en('Serve')),
    );
    return { root, pips, img: face.querySelector('img'), expr: 'neutro', react };
  }

  private grabDough() {
    if (this.over || this.asm.step !== 'empty') return;
    this.asm = { step: 'dough', parts: [] };
  }

  private addPart(part: PastelPart) {
    if (this.over) return;
    if (this.asm.step !== 'dough' && this.asm.step !== 'open') return;
    if (this.asm.parts.includes(part) || this.asm.parts.length >= 2) return;
    this.asm.parts.push(part);
    this.asm.step = 'open';
  }

  private crimp() {
    if (this.over || this.asm.step !== 'open' || this.asm.parts.length === 0) return;
    this.asm.step = 'crimped';
  }

  private onSlot(index: number) {
    const slot = this.slots[index];
    if (!slot || this.over || this.slotNodes[index]?.wrap.hidden) return;
    if (slot.phase === 'empty') {
      if (this.asm.step !== 'crimped') {
        this.flash('need');
        return;
      }
      const filling = pastelFromParts(this.asm.parts);
      slot.phase = 'frying';
      slot.droppedAt = performance.now();
      slot.filling = filling;
      slot.combo = filling ? PASTEL_RECIPE[filling].combo : this.asm.parts.length > 1;
      slot.pulled = null;
      this.asm = { step: 'empty', parts: [] };
      return;
    }
    if (slot.phase !== 'frying') return;
    const done = pastelDoneness(performance.now() - slot.droppedAt, slot.combo);
    if (done === 'fire') {
      this.flash('fire');
      this.kit.shake(this.slotNodes[index]?.wrap);
      return;
    }
    slot.phase = 'ready';
    slot.pulled = done;
    this.flash(done === 'golden' ? 'perfect' : done === 'raw' ? 'raw' : 'soft');
  }

  private apaga(index: number) {
    const slot = this.slots[index];
    if (!slot || this.over || slot.phase !== 'frying') return;
    if (pastelDoneness(performance.now() - slot.droppedAt, slot.combo) !== 'fire') return;
    slot.phase = 'ready';
    slot.pulled = 'block';
    this.flash('out');
  }

  private serveTo(c: LiveCustomer) {
    if (c.gone || this.over) return;
    const ready = this.slots
      .map((s, i) => ({ s, i }))
      .filter((x) => x.s.phase === 'ready' && !this.slotNodes[x.i]!.wrap.hidden);
    const match = ready.find((x) => x.s.filling === c.order.filling) ?? ready[0];
    if (!match || !match.s.pulled) return;
    const frac = Math.max(0, 1 - (performance.now() - c.shownAt) / c.order.patienceMs);
    const fillingOk = match.s.filling === c.order.filling;
    const quality = pastelServeQuality(match.s.pulled, fillingOk, frac);
    this.outcomes.push({ i: c.index, quality, atMs: Math.round(this.elapsed()) });
    c.gone = true;
    const pulled = match.s.pulled;
    match.s.phase = 'empty';
    match.s.filling = null;
    match.s.pulled = null;
    match.s.combo = false;
    const before = this.scoreGuess;
    if (quality === 'perfect') {
      this.combo += 1;
      this.scoreGuess += 48 + Math.min(12, (this.combo - 1) * 4);
    } else {
      this.combo = 0;
      this.scoreGuess += quality === 'ok' ? 32 : quality === 'soft' ? 16 : 0;
    }
    if (quality !== 'miss') this.served += 1;
    const at = this.customerNodes.get(c.index)?.root;
    if (quality === 'miss') this.kit.lose(at);
    else this.kit.gain(at, this.scoreGuess - before, quality);
    if (!fillingOk) this.flash('wrong');
    else if (quality === 'perfect') this.flash('perfect');
    else if (quality === 'ok') this.flash('ok');
    else this.flash(pulled === 'raw' ? 'raw' : 'soft');
  }

  private flash(kind: PopKind) {
    const line = PASTEL_POP[kind];
    this.popEl.replaceChildren(document.createTextNode(line.pt), en(line.en));
    this.popEl.className = `ps-pop ps-pop-${kind}`;
    this.popEl.hidden = false;
    window.setTimeout(() => {
      this.popEl.hidden = true;
    }, 900);
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
