/**
 * Tapioca, the relaxing Feira cart game.
 *
 * The server dealt the seed (`feiraGame` start). Orders come from shared `tapiocaOrders(seed)`, so what
 * the player sees is what the server will score. This view only collects per-order quality and timing;
 * it never sends a score.
 *
 * One pan to start, a second after 3 serves, a third after 6. A mistimed flip tears or sticks (drawn),
 * and only soft-fails the order. Mouse and touch: every control is a button, so a tap and a click are the same.
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
import { npcPortrait } from './pixelArt';
import { pixelSvg } from './pixelSvg';
import type { Expression } from './pixelArt';

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

const INK = '#2a2233';
const CREAM = '#fbf1e3';
const GOLD = '#e2b340';
const WHITE = '#fffdf8';
const LACE = '#f0d090';
const BROWN = '#8a4b24';
const TEAR = '#c45c26';
const GREEN = '#2f5d50';

const FILL_INK: Record<TapiocaFilling, string> = {
  queijo: '#f2c230',
  coco: '#fff6e6',
  chocolate: '#6b3a22',
  goiabada: '#c44536',
};

function panArt(pan: Pan, now: number): SVGSVGElement {
  const age = pan.phase === 'cooking' || pan.phase === 'spread' ? now - pan.spreadAt : TAPIOCA_COOK.cookMs;
  const lace = pan.phase === 'cooking' && age > TAPIOCA_COOK.cookMs - 400;
  const stuck = pan.flip === 'late';
  const torn = pan.flip === 'early';
  const rows: string[] = [];
  const W = 22;
  const H = 16;
  const blank = '.'.repeat(W);
  for (let y = 0; y < H; y++) rows.push(blank);
  const put = (x: number, y: number, c: string) => {
    if (y < 0 || y >= H || x < 0 || x >= W) return;
    const row = rows[y]!;
    rows[y] = row.slice(0, x) + c + row.slice(x + 1);
  };
  // pan ring
  for (let x = 2; x < 18; x++) {
    put(x, 3, 'k');
    put(x, 13, 'k');
  }
  for (let y = 4; y < 13; y++) {
    put(2, y, 'k');
    put(17, y, 'k');
  }
  put(18, 8, 'k');
  put(19, 8, 'k');
  put(20, 8, 'h');
  if (pan.phase === 'empty') {
    for (let y = 5; y < 13; y++) for (let x = 4; x < 16; x++) put(x, y, 'p');
  } else {
    const disc = torn ? 't' : stuck ? 'b' : lace || pan.phase !== 'spread' ? 'l' : 'w';
    for (let y = 5; y < 13; y++) {
      for (let x = 4; x < 16; x++) {
        const edge = y === 5 || y === 12 || x === 4 || x === 15;
        if (torn && ((x + y) % 5 === 0)) {
          put(x, y, 'p');
          continue;
        }
        put(x, y, edge ? (stuck ? 'b' : 'l') : disc);
      }
    }
    if (pan.filling && (pan.phase === 'filled' || pan.phase === 'rolled')) {
      const mark = pan.filling === 'queijo' ? 'q' : pan.filling === 'coco' ? 'c' : pan.filling === 'chocolate' ? 'h' : 'g';
      if (pan.phase === 'rolled') {
        for (let y = 7; y < 11; y++) for (let x = 6; x < 14; x++) put(x, y, mark);
      } else {
        for (let y = 7; y < 11; y++) for (let x = 7; x < 13; x++) put(x, y, mark);
      }
    }
    // steam pixels while it cooks
    if (pan.phase === 'cooking') {
      const puff = Math.floor(now / 180) % 3;
      put(6 + puff, 2, 's');
      put(10, 1, 's');
      put(13 - puff, 2, 's');
    }
  }
  return pixelSvg(rows, {
    k: INK,
    h: '#6b4a32',
    p: '#c4a574',
    w: WHITE,
    l: LACE,
    b: BROWN,
    t: TEAR,
    q: FILL_INK.queijo,
    c: FILL_INK.coco,
    g: FILL_INK.goiabada,
    s: '#d8e4ea',
    '.': 'transparent',
  }, 'tp-pan-svg');
}

function patiencePips(frac: number): HTMLElement {
  const n = 4;
  const lit = Math.max(0, Math.min(n, Math.ceil(frac * n)));
  return h(
    'div',
    { class: 'tp-pips', 'aria-label': `${lit} of ${n}` },
    ...Array.from({ length: n }, (_, i) => h('i', { class: i < lit ? 'on' : '' })),
  );
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
  private pop: HTMLElement | null = null;
  private selected: TapiocaFilling | null = null;
  private dragFrom: number | null = null;

  constructor(
    private readonly seed: number,
    private readonly hooks: TapiocaHooks,
  ) {
    this.orders = tapiocaOrders(seed);
    this.started = performance.now();
    this.root = h('div', { id: 'tapioca-root', class: 'tp-root' });
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
    const elapsed = now - this.started;
    const left = Math.max(0, TAPIOCA_DURATION_MS - elapsed);
    const want = tapiocaPans(this.served);
    while (this.pans.length < want) this.pans.push({ phase: 'empty', spreadAt: 0, flip: null, filling: null });
    const hud = h('div', { class: 'tp-hud', id: 'tapioca-hud' },
      h('span', { class: 'tp-title' }, 'Tapioca'),
      h('span', { id: 'tapioca-timer' }, `${Math.ceil(left / 1000)}s`),
      h('span', { id: 'tapioca-live-score' }, String(this.scoreGuess)),
      h('button', { type: 'button', class: 'ghost tp-quit', id: 'tapioca-quit', onclick: () => this.abandon() }, 'Sair'),
    );
    const queue = h('div', { class: 'tp-queue', id: 'tapioca-queue' },
      ...this.liveCustomers().map((c) => this.customerEl(c, now)),
      this.liveCustomers().length ? null : h('p', { class: 'tp-wait' }, 'Aguardando…', en('Waiting…')),
    );
    const griddle = h('div', { class: 'tp-griddle', id: 'tapioca-griddle' },
      ...this.pans.map((pan, i) => this.panEl(pan, i, now)),
    );
    const bowls = h('div', { class: 'tp-bowls', id: 'tapioca-bowls' },
      ...TAPIOCA_FILLINGS.map((f) => {
        const lab = TAPIOCA_FILLING_LABEL[f];
        return h('button', {
          type: 'button',
          class: `tp-bowl${this.selected === f ? ' on' : ''}`,
          'data-filling': f,
          id: `tapioca-bowl-${f}`,
          onclick: () => this.pickFilling(f),
        }, h('i', { class: `tp-dot tp-dot-${f}` }), lab.pt, en(lab.en));
      }),
    );
    this.root.replaceChildren(hud, queue, griddle, bowls, this.pop ?? h('span', { class: 'tp-pop-slot' }));
  }

  private customerEl(c: LiveCustomer, now: number): HTMLElement {
    const frac = Math.max(0, 1 - (now - c.shownAt) / c.order.patienceMs);
    const expr: Expression = frac < 0.28 ? 'pensativo' : 'neutro';
    return h('div', { class: 'tp-customer', 'data-order': String(c.index) },
      npcPortrait(c.order.who, expr, 'tp-portrait'),
      h('div', { class: 'tp-order' },
        h('b', null, c.order.name),
        patiencePips(frac),
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
  }

  private panEl(pan: Pan, index: number, now: number): HTMLElement {
    const label = pan.phase === 'empty' ? 'Goma' : pan.phase === 'cooking' || pan.phase === 'spread' ? 'Virar' : pan.phase === 'flipped' ? 'Recheio' : pan.phase === 'filled' ? 'Enrolar' : 'Pronta';
    const hint = pan.phase === 'empty' ? 'Spread' : pan.phase === 'cooking' || pan.phase === 'spread' ? 'Flip' : pan.phase === 'flipped' ? 'Filling' : pan.phase === 'filled' ? 'Roll' : 'Ready';
    return h('button', {
      type: 'button',
      class: `tp-pan tp-${pan.phase}${pan.flip ? ` tp-flip-${pan.flip}` : ''}`,
      'data-pan': String(index),
      id: `tapioca-pan-${index}`,
      ontouchstart: (e: Event) => this.onPanDown(index, e),
      onmousedown: (e: Event) => this.onPanDown(index, e),
      onclick: () => this.onPan(index),
    }, panArt(pan, now), h('span', { class: 'tp-pan-label' }, label, en(hint)));
  }

  private onPanDown(index: number, e: Event) {
    const pan = this.pans[index];
    if (!pan || pan.phase !== 'rolled') return;
    this.dragFrom = index;
    const up = () => {
      this.dragFrom = null;
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchend', up);
    };
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
    e.preventDefault?.();
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
      return;
    }
  }

  private pickFilling(f: TapiocaFilling) {
    this.selected = this.selected === f ? null : f;
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
    this.pop = h('div', { class: `tp-pop tp-pop-${kind}`, id: 'tapioca-pop' }, line.pt, en(line.en));
    window.setTimeout(() => {
      if (this.pop?.id === 'tapioca-pop') this.pop = null;
    }, 700);
  }

  private abandon() {
    this.finish();
  }

  private finish() {
    if (this.over) return;
    this.over = true;
    cancelAnimationFrame(this.raf);
    // customers still waiting count as left, so the server sees the same set the clock would
    const now = Math.round(this.elapsed());
    for (const c of this.customers) {
      if (c.gone) continue;
      if (this.outcomes.some((o) => o.i === c.index)) continue;
      this.outcomes.push({ i: c.index, quality: 'miss' as FeiraQuality, atMs: now });
    }
    this.hooks.finish(this.outcomes);
  }
}
