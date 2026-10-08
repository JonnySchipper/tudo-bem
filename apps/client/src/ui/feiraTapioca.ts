/**
 * Tapioca, the relaxing Feira cart game.
 *
 * The server dealt the seed (`feiraGame` start). Orders come from shared `tapiocaOrders(seed)`, so what
 * the player sees is what the server will score. This view only collects per-order quality and timing;
 * it never sends a score.
 *
 * The stall is built once. A frame only rewrites text, classes and a cook bar, so a mouse click lands
 * on the same button that received the press. One pan to start, a second after 3 serves, a third after 6.
 * A mistimed flip tears or sticks, and only soft-fails the order.
 *
 * needs_br: true (order lines, pops, end card).
 */
import {
  TAPIOCA_COOK,
  TAPIOCA_DURATION_MS,
  TAPIOCA_FILLINGS,
  TAPIOCA_FILLING_LABEL,
  TAPIOCA_POP,
  TAPIOCA_WRONG,
  tapiocaFlip,
  tapiocaOrders,
  tapiocaPans,
  tapiocaServeQuality,
  type FeiraOrderOutcome,
  type FeiraQuality,
  type FlipVerdict,
  type TapiocaFilling,
  type TapiocaOrder,
} from '@tudobem/shared';
import { h, en } from './dom';
import { npcPortrait, portraitKey, type Expression } from './pixelArt';
import { imageUrl } from '../render/pixel/manifest';

export interface TapiocaEnd {
  score: number;
  coins: number;
  dailyBlocked: boolean;
  served: number;
  perfect: number;
  left: number;
  bestToday: number;
  place: number;
  crown: boolean;
  linePt: string;
  lineEn: string;
}

export interface TapiocaHooks {
  finish: (outcomes: FeiraOrderOutcome[]) => void;
  quit: () => void;
  again: () => void;
}

type PanPhase = 'empty' | 'spread' | 'cooking' | 'flipped' | 'filled' | 'rolled';

interface Pan {
  phase: PanPhase;
  /** performance.now() when the goma went on. */
  spreadAt: number;
  flip: FlipVerdict | null;
  filling: TapiocaFilling | null;
}

interface LiveCustomer {
  order: TapiocaOrder;
  index: number;
  /** performance.now() when they became visible. */
  shownAt: number;
  gone: boolean;
}

interface PanNode {
  btn: HTMLButtonElement;
  svg: SVGSVGElement;
  meter: HTMLElement;
  pt: Text;
  en: Text;
  phase: PanPhase;
  flip: FlipVerdict | null;
  filling: TapiocaFilling | null;
  visual: string;
}

interface CustomerNode {
  root: HTMLElement;
  pips: HTMLElement[];
  img: HTMLImageElement | null;
  expr: Expression;
}

const NS = 'http://www.w3.org/2000/svg';
const PW = 48;
const PH = 34;
const PCX = 16;
const PCY = 17;

const FILL_INK: Record<TapiocaFilling, { base: string; hi: string; dark: string }> = {
  queijo: { base: '#f2c230', hi: '#fff59a', dark: '#c48a14' },
  coco: { base: '#fff6e6', hi: '#ffffff', dark: '#e0d0b2' },
  chocolate: { base: '#6b3a22', hi: '#a85f46', dark: '#3a1e12' },
  goiabada: { base: '#c44536', hi: '#e07070', dark: '#8a2a22' },
};

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string> = {}): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function addPx(g: SVGGElement, cells: [number, number, string][]) {
  for (const [x, y, fill] of cells) {
    if (x < 0 || y < 0 || x >= PW || y >= PH) continue;
    g.append(svgEl('rect', { x: String(x), y: String(y), width: '1', height: '1', fill }));
  }
}

function inDisc(x: number, y: number, cx: number, cy: number, r: number) {
  const dx = x + 0.5 - cx;
  const dy = y + 0.5 - cy;
  return dx * dx + dy * dy <= r * r;
}

/** The tapioqueira: an aluminium pan, a goma disc, lace / tear / stuck, and each filling. Built once. */
function buildPanSvg(): SVGSVGElement {
  const svg = svgEl('svg', { viewBox: `0 0 ${PW} ${PH}`, class: 'tp-pan-svg st-empty', 'shape-rendering': 'crispEdges' });
  const base = svgEl('g', { class: 'g-base' });
  const disc = svgEl('g', { class: 'g-disc' });
  const lace = svgEl('g', { class: 'g-lace' });
  const tear = svgEl('g', { class: 'g-tear' });
  const stuck = svgEl('g', { class: 'g-stuck' });
  const roll = svgEl('g', { class: 'g-roll' });
  const steam = svgEl('g', { class: 'g-steam' });
  const pan: [number, number, string][] = [];
  const goma: [number, number, string][] = [];
  const lacePx: [number, number, string][] = [];
  const tearPx: [number, number, string][] = [];
  const stuckPx: [number, number, string][] = [];
  const rollPx: [number, number, string][] = [];
  for (let y = 0; y < PH; y++) {
    for (let x = 0; x < PW; x++) {
      const dx = x + 0.5 - PCX;
      const dy = y + 0.5 - PCY;
      const r2 = dx * dx + dy * dy;
      const handle = x >= 26 && x <= 45 && y >= 15 && y <= 19 && !inDisc(x, y, 42, 17, 2.2);
      const hole = inDisc(x, y, 42, 17, 2.2) && x >= 39;
      if (hole) continue;
      if (r2 <= 13 * 13 || handle) {
        const rim = r2 > 10.5 * 10.5 && r2 <= 13 * 13;
        const lit = dx < -2 && dy < -1;
        let c = rim ? (lit ? '#f8f8f8' : dx > 4 ? '#6c6e85' : '#c6c8d4') : lit ? '#d8d0e0' : '#8b8bab';
        if (handle) c = y === 15 ? '#daa463' : y === 19 ? '#6b4c2c' : x % 5 === 0 ? '#916e41' : '#a9764f';
        if (rim && (x + y) % 9 === 0) c = '#f8f8f8';
        pan.push([x, y, c]);
      }
      if (r2 <= 9 * 9) {
        const edge = r2 > 7.2 * 7.2;
        const bubble = (x * 3 + y * 5) % 11 === 0 && r2 < 36;
        goma.push([x, y, edge ? '#f0d090' : bubble ? '#fff59a' : '#fffdf8']);
        if (edge) lacePx.push([x, y, '#e2b340']);
        else if ((x + y) % 6 === 0) lacePx.push([x, y, '#f2c230']);
        if ((x + y) % 5 === 0) tearPx.push([x, y, '#6c6e85']);
        if (edge || (x * 2 + y) % 4 === 0) stuckPx.push([x, y, edge ? '#573c2c' : '#8a4b24']);
      }
      if (y >= 14 && y <= 20 && x >= 10 && x <= 24) {
        rollPx.push([x, y, y === 14 || y === 20 ? '#e2b340' : x % 4 === 0 ? '#f0d090' : '#fffdf8']);
      }
    }
  }
  // a rivet where the handle meets the pan, and a shine on the empty metal
  pan.push([26, 16, '#f8f8f8'], [26, 18, '#565972'], [12, 10, '#ffffff'], [13, 10, '#ffffff'], [12, 11, '#f8f8f8']);
  addPx(base, pan);
  addPx(disc, goma);
  addPx(lace, lacePx);
  addPx(tear, tearPx);
  addPx(stuck, stuckPx);
  addPx(roll, rollPx);
  for (const [sx, sy] of [[10, 6], [16, 4], [22, 7]] as const) {
    const puff = svgEl('g', { class: 'puff' });
    addPx(puff, [[sx, sy, '#f8f8f8'], [sx + 1, sy, '#d8e4ea'], [sx, sy + 1, '#d8e4ea']]);
    steam.append(puff);
  }
  svg.append(base, disc, lace, tear, stuck, roll, steam);
  for (const f of TAPIOCA_FILLINGS) {
    const ink = FILL_INK[f];
    const heap = svgEl('g', { class: `g-heap g-heap-${f}` });
    const bar = svgEl('g', { class: `g-rfill g-rfill-${f}` });
    const heapPx: [number, number, string][] = [];
    const barPx: [number, number, string][] = [];
    for (let y = 0; y < PH; y++) {
      for (let x = 0; x < PW; x++) {
        if (inDisc(x, y, PCX, PCY, 4.2)) {
          const speck = (x + y * 2) % 3 === 0;
          heapPx.push([x, y, speck ? ink.hi : (x + y) % 5 === 0 ? ink.dark : ink.base]);
        }
        if (y >= 15 && y <= 19 && x >= 12 && x <= 22) barPx.push([x, y, y === 15 ? ink.hi : ink.base]);
      }
    }
    addPx(heap, heapPx);
    addPx(bar, barPx);
    svg.append(heap, bar);
  }
  return svg;
}

/** A ceramic bowl of one filling. Built once per button. */
function bowlSvg(f: TapiocaFilling): SVGSVGElement {
  const ink = FILL_INK[f];
  const w = 28;
  const h = 18;
  const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, class: 'tp-bowl-svg', 'shape-rendering': 'crispEdges' });
  const g = svgEl('g');
  const cells: [number, number, string][] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const bowl = inDisc(x, y, 14, 11, 11) && y >= 6 && inDisc(x, y, 14, 8, 12);
      const rim = y >= 5 && y <= 8 && inDisc(x, y, 14, 7, 12) && !inDisc(x, y, 14, 7, 8);
      if (rim) cells.push([x, y, x < 8 ? '#ffffff' : '#c6bdd5']);
      else if (bowl && y >= 8) {
        const heap = inDisc(x, y, 14, 10, 7);
        cells.push([x, y, heap ? ((x + y) % 3 === 0 ? ink.hi : ink.base) : y > 14 ? '#d8d0e0' : '#f8f8f8']);
      }
    }
  }
  for (const [x, y, fill] of cells) g.append(svgEl('rect', { x: String(x), y: String(y), width: '1', height: '1', fill }));
  svg.append(g);
  return svg;
}

const PAN_LABEL: Record<PanPhase, { pt: string; en: string }> = {
  empty: { pt: 'Goma', en: 'Spread' },
  spread: { pt: 'Virar', en: 'Flip' },
  cooking: { pt: 'Virar', en: 'Flip' },
  flipped: { pt: 'Recheio', en: 'Filling' },
  filled: { pt: 'Enrolar', en: 'Roll' },
  rolled: { pt: 'Pronta', en: 'Ready' },
};

function visualKey(pan: Pan, lace: boolean): string {
  if (pan.phase === 'empty') return 'empty';
  if (pan.phase === 'cooking' || pan.phase === 'spread') return lace ? 'lace' : 'pale';
  if (pan.flip === 'early') return 'tear';
  if (pan.flip === 'late') return 'stuck';
  if (pan.phase === 'rolled') return `roll-${pan.filling ?? ''}`;
  if (pan.phase === 'filled') return `fill-${pan.filling ?? ''}-${pan.flip === 'perfect' ? 'lace' : pan.flip ?? 'pale'}`;
  return `flipped-${pan.flip ?? 'pale'}`;
}

export class TapiocaView {
  readonly root: HTMLElement;
  private orders: TapiocaOrder[];
  private pans: Pan[] = [{ phase: 'empty', spreadAt: 0, flip: null, filling: null }];
  private customers: LiveCustomer[] = [];
  private nextSpawn = 0;
  private outcomes: FeiraOrderOutcome[] = [];
  private served = 0;
  private scoreGuess = 0;
  private started: number;
  private raf = 0;
  private over = false;
  private selected: TapiocaFilling | null = null;
  private dragFrom: number | null = null;
  private timerEl: HTMLElement;
  private scoreEl: HTMLElement;
  private queueEl: HTMLElement;
  private griddleEl: HTMLElement;
  private popEl: HTMLElement;
  private panNodes: PanNode[] = [];
  private customerNodes = new Map<number, CustomerNode>();
  private bowlButtons = new Map<TapiocaFilling, HTMLButtonElement>();
  private waitEl: HTMLElement;
  private shownSecond = -1;

  constructor(
    private readonly seed: number,
    private readonly hooks: TapiocaHooks,
  ) {
    this.orders = tapiocaOrders(seed);
    this.started = performance.now();
    this.timerEl = h('span', { id: 'tapioca-timer' }, '90s');
    this.scoreEl = h('span', { id: 'tapioca-live-score' }, '0');
    this.queueEl = h('div', { class: 'tp-queue', id: 'tapioca-queue' });
    this.griddleEl = h('div', { class: 'tp-griddle pans-1', id: 'tapioca-griddle' });
    this.waitEl = h('p', { class: 'tp-wait' }, 'Aguardando…', en('Waiting…'));
    this.queueEl.append(this.waitEl);
    this.popEl = h('div', { class: 'tp-pop', id: 'tapioca-pop' });
    this.popEl.hidden = true;
    const bowls = h('div', { class: 'tp-bowls', id: 'tapioca-bowls' });
    for (const f of TAPIOCA_FILLINGS) {
      const lab = TAPIOCA_FILLING_LABEL[f];
      const btn = h('button', {
        type: 'button',
        class: 'tp-bowl',
        'data-filling': f,
        id: `tapioca-bowl-${f}`,
        onclick: () => this.pickFilling(f),
      }, bowlSvg(f), h('span', { class: 'tp-bowl-name' }, lab.pt, en(lab.en))) as HTMLButtonElement;
      this.bowlButtons.set(f, btn);
      bowls.append(btn);
    }
    this.root = h('div', { id: 'tapioca-root', class: 'tp-root' },
      h('div', { class: 'tp-sky', 'aria-hidden': 'true' }),
      h('div', { class: 'tp-bunting', 'aria-hidden': 'true' }),
      h('header', { class: 'tp-hud', id: 'tapioca-hud' },
        h('span', { class: 'tp-title' }, 'Tapioca'),
        this.timerEl,
        this.scoreEl,
        h('button', { type: 'button', class: 'ghost tp-quit', id: 'tapioca-quit', onclick: () => this.abandon() }, 'Sair'),
      ),
      h('div', { class: 'tp-awning', 'aria-hidden': 'true' },
        h('span', { class: 'tp-awning-title' }, 'Tapioca da feira'),
      ),
      this.queueEl,
      h('div', { class: 'tp-stall' },
        h('div', { class: 'tp-chapa' },
          h('div', { class: 'tp-splash', 'aria-hidden': 'true' }),
          this.griddleEl,
          h('div', { class: 'tp-cabinet', 'aria-hidden': 'true' },
            h('i', { class: 'tp-dial hot' }),
            h('i', { class: 'tp-dial' }),
            h('i', { class: 'tp-dial' }),
            h('i', { class: 'tp-pilot' }),
          ),
        ),
        h('div', { class: 'tp-counter', 'aria-hidden': 'true' }),
      ),
      bowls,
      h('div', { class: 'tp-floor', 'aria-hidden': 'true' }),
      this.popEl,
    );
    this.ensurePans(1);
    document.body.classList.add('tp-on');
    document.getElementById('ui')?.append(this.root);
    this.frame();
  }

  destroy() {
    this.over = true;
    cancelAnimationFrame(this.raf);
    document.body.classList.remove('tp-on');
    this.root.remove();
  }

  showEnd(end: TapiocaEnd) {
    this.over = true;
    cancelAnimationFrame(this.raf);
    const crown = end.crown
      ? h('p', { class: 'tp-crown-line', id: 'tapioca-crown' }, 'Fada da Feira', en('You lead today’s board.'))
      : null;
    this.root.replaceChildren(
      h('div', { class: 'tp-end', id: 'tapioca-end' },
        h('h2', null, 'Tapioca'),
        h('p', { class: 'tp-score', id: 'tapioca-score' }, String(end.score), en('points')),
        h('p', { class: 'tp-line' }, end.linePt, en(end.lineEn)),
        h('p', { class: 'tp-meta', id: 'tapioca-meta' },
          `${end.coins} RV`,
          en(end.dailyBlocked ? 'Board only — today’s paid runs are used.' : end.coins ? 'virtual reais' : 'no RV this round'),
        ),
        h('p', { class: 'tp-meta' }, `Melhor hoje: ${end.bestToday}`, en(`Best today: ${end.bestToday}`)),
        h('p', { class: 'tp-meta', id: 'tapioca-place' }, end.place ? `${end.place}º no placar` : 'Fora do placar', en(end.place ? `Place ${end.place} today` : 'Not on the board')),
        crown,
        h('div', { class: 'tp-end-actions' },
          h('button', { type: 'button', class: 'primary', id: 'tapioca-again', onclick: () => this.hooks.again() }, 'Jogar de novo', en('Play again')),
          h('button', { type: 'button', class: 'ghost', id: 'tapioca-close', onclick: () => this.hooks.quit() }, 'Fechar', en('Close')),
        ),
      ),
    );
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
      }
    }
    this.paint(now);
    if (elapsed >= TAPIOCA_DURATION_MS) {
      this.finish();
      return;
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private liveCustomers() {
    return this.customers.filter((c) => !c.gone).slice(0, 3);
  }

  private paint(now: number) {
    const left = Math.max(0, Math.ceil((TAPIOCA_DURATION_MS - (now - this.started)) / 1000));
    if (left !== this.shownSecond) {
      this.shownSecond = left;
      this.timerEl.textContent = `${left}s`;
    }
    if (this.scoreEl.textContent !== String(this.scoreGuess)) this.scoreEl.textContent = String(this.scoreGuess);
    this.syncCustomers(now);
    this.ensurePans(tapiocaPans(this.served));
    this.panNodes.forEach((node, i) => this.syncPan(node, this.pans[i]!, now));
  }

  private ensurePans(want: number) {
    while (this.panNodes.length < want) this.addPan(this.panNodes.length);
    this.griddleEl.classList.toggle('pans-1', want === 1);
    this.griddleEl.classList.toggle('pans-2', want === 2);
    this.griddleEl.classList.toggle('pans-3', want === 3);
  }

  private addPan(index: number) {
    const svg = buildPanSvg();
    const meter = h('i');
    const pt = document.createTextNode(PAN_LABEL.empty.pt);
    const gloss = document.createTextNode(PAN_LABEL.empty.en);
    const btn = h('button', {
      type: 'button',
      class: 'tp-pan tp-empty',
      'data-pan': String(index),
      id: `tapioca-pan-${index}`,
      onclick: () => this.onPan(index),
    },
      h('span', { class: 'tp-pan-art' }, svg, h('span', { class: 'tp-meter' }, meter)),
      h('span', { class: 'tp-pan-label' }, pt, en('')),
    ) as HTMLButtonElement;
    const glossEl = btn.querySelector('.tp-pan-label .en')!;
    glossEl.textContent = '';
    glossEl.append(gloss);
    btn.addEventListener('pointerdown', () => {
      if (this.pans[index]?.phase === 'rolled') this.dragFrom = index;
    });
    const node: PanNode = { btn, svg, meter, pt, en: gloss, phase: 'empty', flip: null, filling: null, visual: '' };
    this.panNodes.push(node);
    this.griddleEl.append(btn);
  }

  private syncPan(node: PanNode, pan: Pan, now: number) {
    const age = pan.phase === 'cooking' || pan.phase === 'spread' ? now - pan.spreadAt : 0;
    const lace = pan.phase === 'cooking' && age > TAPIOCA_COOK.cookMs - 400;
    const ready = pan.phase === 'cooking'
      && age >= TAPIOCA_COOK.cookMs - TAPIOCA_COOK.earlyMs
      && age <= TAPIOCA_COOK.cookMs + TAPIOCA_COOK.lateMs;
    const label = PAN_LABEL[pan.phase];
    if (node.pt.data !== label.pt) node.pt.data = label.pt;
    if (node.en.data !== label.en) node.en.data = label.en;
    if (node.phase !== pan.phase) {
      node.btn.classList.remove(`tp-${node.phase}`);
      node.btn.classList.add(`tp-${pan.phase}`);
      node.phase = pan.phase;
    }
    if (node.flip !== pan.flip) {
      if (node.flip) node.btn.classList.remove(`tp-flip-${node.flip}`);
      if (pan.flip) node.btn.classList.add(`tp-flip-${pan.flip}`);
      node.flip = pan.flip;
    }
    node.btn.classList.toggle('tp-ready', ready);
    const visual = visualKey(pan, lace);
    if (node.visual !== visual || node.filling !== pan.filling) {
      node.visual = visual;
      node.filling = pan.filling;
      const st = visual.startsWith('roll') ? 'st-roll'
        : visual.startsWith('fill') ? 'st-fill'
          : visual === 'lace' ? 'st-lace'
            : visual === 'tear' ? 'st-tear'
              : visual === 'stuck' ? 'st-stuck'
                : visual === 'empty' ? 'st-empty'
                  : 'st-pale';
      const bits = ['tp-pan-svg', st];
      if (pan.filling) bits.push(`fill-${pan.filling}`);
      if (pan.flip) bits.push(`flip-${pan.flip}`);
      node.svg.setAttribute('class', bits.join(' '));
    }
    const cooking = pan.phase === 'cooking';
    node.meter.parentElement!.hidden = !cooking;
    if (cooking) {
      const span = TAPIOCA_COOK.cookMs + TAPIOCA_COOK.lateMs;
      node.meter.style.width = `${Math.max(4, Math.min(100, Math.round((age / span) * 100)))}%`;
    }
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
    }
  }

  private makeCustomer(c: LiveCustomer): CustomerNode {
    const pips = [0, 1, 2, 3].map(() => h('i', { class: 'on' }));
    const face = npcPortrait(c.order.who, 'neutro', 'tp-portrait');
    const root = h('div', { class: 'tp-customer', 'data-order': String(c.index) },
      face,
      h('div', { class: 'tp-order' },
        h('b', null, c.order.name),
        h('div', { class: 'tp-pips', 'aria-label': '4 of 4' }, ...pips),
        h('p', { class: 'tp-pt', lang: 'pt-BR' }, c.order.line.pt),
        h('p', { class: 'en' }, c.order.line.en),
      ),
      h('button', {
        type: 'button',
        class: 'tp-serve',
        'data-serve': String(c.index),
        id: `tapioca-serve-${c.index}`,
        onclick: () => this.serveTo(c),
      }, 'Servir', en('Serve')),
    );
    return { root, pips, img: face.querySelector('img'), expr: 'neutro' };
  }

  private onPan(index: number) {
    const pan = this.pans[index];
    if (!pan || this.over) return;
    if (pan.phase === 'empty') {
      pan.phase = 'cooking';
      pan.spreadAt = performance.now();
      pan.flip = null;
      pan.filling = null;
      return;
    }
    if (pan.phase === 'cooking') {
      pan.flip = tapiocaFlip(performance.now() - pan.spreadAt);
      pan.phase = 'flipped';
      this.flash(pan.flip === 'perfect' ? 'perfect' : 'soft');
      return;
    }
    if (pan.phase === 'flipped') {
      if (!this.selected) return;
      pan.filling = this.selected;
      pan.phase = 'filled';
      return;
    }
    if (pan.phase === 'filled') {
      pan.phase = 'rolled';
    }
  }

  private pickFilling(f: TapiocaFilling) {
    this.selected = this.selected === f ? null : f;
    for (const [id, btn] of this.bowlButtons) btn.classList.toggle('on', id === this.selected);
    const flipped = this.pans.findIndex((p) => p.phase === 'flipped');
    if (flipped >= 0 && this.selected) {
      this.pans[flipped]!.filling = this.selected;
      this.pans[flipped]!.phase = 'filled';
    }
  }

  private serveTo(c: LiveCustomer) {
    if (c.gone || this.over) return;
    const from = this.dragFrom ?? this.pans.findIndex((p) => p.phase === 'rolled');
    const pan = from >= 0 ? this.pans[from] : undefined;
    if (!pan || pan.phase !== 'rolled' || !pan.filling || !pan.flip) return;
    const frac = Math.max(0, 1 - (performance.now() - c.shownAt) / c.order.patienceMs);
    const fillingOk = pan.filling === c.order.filling;
    const quality = tapiocaServeQuality(pan.flip, fillingOk, frac);
    this.outcomes.push({ i: c.index, quality, atMs: Math.round(this.elapsed()) });
    c.gone = true;
    pan.phase = 'empty';
    pan.flip = null;
    pan.filling = null;
    this.dragFrom = null;
    if (quality !== 'miss') this.served += 1;
    this.scoreGuess += quality === 'perfect' ? 48 : quality === 'ok' ? 32 : quality === 'soft' ? 16 : 0;
    this.flash(quality === 'miss' ? 'miss' : quality === 'perfect' ? 'perfect' : 'soft', fillingOk ? undefined : 'wrong');
  }

  private flash(kind: 'perfect' | 'soft' | 'miss', why?: 'wrong') {
    const line = why === 'wrong' ? TAPIOCA_WRONG : kind === 'perfect' ? TAPIOCA_POP.perfect : kind === 'soft' ? TAPIOCA_POP.soft : TAPIOCA_POP.miss;
    this.popEl.replaceChildren(document.createTextNode(line.pt), en(line.en));
    this.popEl.className = `tp-pop tp-pop-${kind}`;
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
