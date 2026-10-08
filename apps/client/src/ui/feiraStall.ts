/**
 * The Feira stall kit: what Tapioca, Pastel and Caldo de cana share so the three carts read as one feira.
 *
 *   stallRoof     the cart roof: a pixel FEIRA plate, the game's own banner, a scalloped awning
 *   counterProps  little pixel props along the counter (goma tub and sieve, rolling pin, cane and cups)
 *   ticket        the order bubble on a customer card (an icon of what they asked for)
 *   StallKit      the freguesia meter, floating +pts, "foi embora", shake
 *   meterWindow   the sweet spot painted on a cook meter
 *   stallEndCard  the end card: a stamp for ground gained or lost, then the server's score and RV
 *
 * Display only: the server scores the run, and every number on the end card comes from it.
 *
 * needs_br: true (labels, stamps).
 */
import {
  FEIRA_CROWD_LABEL,
  FEIRA_END_STAMP,
  feiraCrowd,
  feiraEndTier,
  type FeiraGameId,
  type FeiraMeterWindow,
} from '@tudobem/shared';
import { h, en } from './dom';
import { pixelSvg } from './pixelSvg';

const BANNER: Record<FeiraGameId, string> = { tapioca: 'Tapioca', pastel: 'Pastel', caldo: 'Caldo de cana' };

/** The cart roof over every stall screen: FEIRA plate, the game's banner, the awning in the game's colours. */
export function stallRoof(game: FeiraGameId): HTMLElement {
  return h('div', { class: `fs-roof fs-game-${game}`, 'aria-hidden': 'true' },
    h('div', { class: 'fs-beam' },
      h('span', { class: 'fs-plate' }, 'Feira'),
      h('span', { class: 'fs-banner', 'data-game': game }, BANNER[game]),
    ),
    h('div', { class: 'fs-awning' }),
  );
}

// ---------------------------------------------------------------- counter props (LimeZu palette, light from the upper left)
const P = {
  n: '#2a2233', w: '#f8f8f8', l: '#d8d0e0', m: '#a2a6be', s: '#6c6e85',
  b: '#4995e3', B: '#2f6db5', y: '#f2c230', Y: '#fff59a', o: '#c48a14',
  t: '#daa463', T: '#a9764f', d: '#6b4c2c', g: '#8fd18a', G: '#3d9a4a', k: '#1f6b32',
  r: '#e63f38', R: '#a82b2d', c: '#fff6e6', j: '#d4e56a', J: '#8fb83a',
};

const PROPS: Record<FeiraGameId, { rows: string[]; label: string }[]> = {
  tapioca: [
    {
      label: 'goma',
      rows: [
        '..nnnnnnnnnnnn..',
        '.nwwwcwwwwcwwwn.',
        '.nwcwwwwcwwwcwn.',
        'nbbbbbbbbbbbbbbn',
        'nbwbbbbbbbbbbBbn',
        '.nbbbbbbbbbbbBn.',
        '.nbbbbbbbbbbbBn.',
        '.nBBBBBBBBBBBBn.',
        '..nnnnnnnnnnnn..',
      ],
    },
    {
      label: 'peneira',
      rows: [
        '..nnnnnnnnnnn...',
        '.ntttttttttttn..',
        'ntmsmsmsmsmsmtnnn',
        'ntsmsmsmsmsmstTTn',
        '.ntttttttttttnnn.',
        '..nnnnnnnnnnn....',
      ],
    },
    {
      label: 'pratos',
      rows: [
        '.nnnnnnnnnnnnnn.',
        'nwwwwwwwwwwwwwln',
        '.nnnnnnnnnnnnnn.',
        'nwwwwwwwwwwwwwln',
        '.nnnnnnnnnnnnnn.',
        'nwwwwwwwwwwwwwln',
        '.nnnnnnnnnnnnnn.',
      ],
    },
  ],
  pastel: [
    {
      label: 'rolo',
      rows: [
        '.....nnnn.......',
        '..nnnccccnnn....',
        'nntTnccccccnTtnn',
        'nntTncccccllnTtn',
        '..nnnllllllnnn..',
        '.....nnnnnn.....',
      ],
    },
    {
      label: 'vinagrete',
      rows: [
        '..nnnnnnnnnn..',
        '.nwwwwwwwwwwn.',
        'nwrGwrrGwGrwln',
        'nwGrrGwrGrwrln',
        'nwrwGrrGwrGwln',
        '.nllllllllllnn',
        '..nnnnnnnnnn..',
      ],
    },
    {
      label: 'molho',
      rows: [
        '...nn....nn...',
        '...nn....nn...',
        '..nRRn..nyyn..',
        '.nRrRRnnyYyyn.',
        '.nrRRRnnYyyon.',
        '.nRRRRnnyyyon.',
        '.nRRRRnnyyyon.',
        '..nnnn..nnnn..',
      ],
    },
  ],
  caldo: [
    {
      label: 'cana',
      rows: [
        '.ng..ng..ng..',
        '.nG.nGk.nGk..',
        '.nGknGknGk...',
        '.nyonyonyo...',
        '.nGknGknGk...',
        '.nGknGknGk...',
        '.nyonyonyo...',
        '.nGknGknGk...',
        '.nnnnnnnnn...',
      ],
    },
    {
      label: 'copos',
      rows: [
        '.nnnnnnn.nnnnnnn',
        '.nwlllln.nwlllln',
        '.nwjjjjn.nwlllln',
        '.nwjJjjn.nwlllln',
        '..nJjjn...nllln.',
        '..nnnnn...nnnnn.',
      ],
    },
    {
      label: 'limões',
      rows: [
        '...nnnn..nnnn...',
        '..ngggGnnjjjJn..',
        '..nggGGnnjjJJn..',
        'nnnnGGnnnnJJnnnn',
        'ntttttttttttttTn',
        '.nTTTTTTTTTTTTn.',
        '..nnnnnnnnnnnn..',
      ],
    },
  ],
};

/** A strip of little pixel props in front of the stall (decoration, never a click target). */
export function counterProps(game: FeiraGameId): HTMLElement {
  return h('div', { class: `fs-props fs-game-${game}`, 'aria-hidden': 'true' },
    ...PROPS[game].map((p) => pixelSvg(p.rows, P, `fs-prop fs-prop-${p.label}`)),
  );
}

/** The order bubble on a customer card: what they asked for, as pixel icons, before you read the line. */
export function ticket(...icons: (SVGElement | HTMLElement)[]): HTMLElement {
  return h('div', { class: 'fs-ticket', 'aria-hidden': 'true' }, ...icons);
}

/** Paint the sweet spot on a cook meter (`.tp-meter` / `.ps-meter`): a band the fill has to land in. */
export function meterWindow(meter: HTMLElement, w: FeiraMeterWindow): HTMLElement {
  const band = h('b', { class: 'fs-sweet', style: `left:${(w.from * 100).toFixed(1)}%;width:${((w.to - w.from) * 100).toFixed(1)}%` });
  meter.classList.add('fs-meter');
  meter.prepend(band);
  return band;
}

/** Restart a one-shot CSS animation on `el` (shake, pop, splash). */
export function replay(el: Element | null | undefined, cls: string, ms = 420) {
  if (!el) return;
  el.classList.remove(cls);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(cls);
  window.setTimeout(() => el.classList.remove(cls), ms);
}

export type FloatKind = 'perfect' | 'ok' | 'soft' | 'miss';

/**
 * Per-run juice: the freguesia meter in the HUD, floating points over the customer you served,
 * "Foi embora" over one who left, and a shake on the thing that went wrong.
 */
export class StallKit {
  readonly meter: HTMLElement;
  private mark: HTMLElement;
  private fill: HTMLElement;
  private root: HTMLElement | null = null;
  private served = 0;
  private left = 0;

  constructor(prefix: string) {
    this.mark = h('i', { class: 'fs-crowd-mark' });
    this.fill = h('i', { class: 'fs-crowd-fill' });
    this.meter = h('div', { class: 'fs-crowd', id: `${prefix}-crowd`, 'data-pos': '50' },
      h('span', { class: 'fs-crowd-label' }, FEIRA_CROWD_LABEL.pt, en(FEIRA_CROWD_LABEL.en)),
      h('span', { class: 'fs-crowd-bar' }, this.fill, this.mark),
    );
    this.paint();
  }

  mount(root: HTMLElement) {
    this.root = root;
  }

  /** A customer left happy: +pts over them, the meter moves right. */
  gain(at: Element | null | undefined, points: number, kind: FloatKind) {
    this.served += 1;
    this.float(at, points > 0 ? `+${points}` : '+0', kind);
    this.paint();
    replay(this.meter, 'fs-bump-up');
  }

  /** A customer left without what they wanted (timed out, or the wrong order): the meter moves left. */
  lose(at: Element | null | undefined) {
    this.left += 1;
    this.float(at, 'Foi embora', 'miss');
    this.paint();
    replay(this.meter, 'fs-bump-down');
  }

  shake(el: Element | null | undefined) {
    replay(el, 'fs-shake');
  }

  private paint() {
    const pos = Math.round(feiraCrowd(this.served, this.left) * 100);
    this.meter.dataset.pos = String(pos);
    this.mark.style.left = `${pos}%`;
    this.fill.style.left = `${Math.min(50, pos)}%`;
    this.fill.style.width = `${Math.abs(pos - 50)}%`;
    this.meter.classList.toggle('fs-up', pos > 50);
    this.meter.classList.toggle('fs-down', pos < 50);
  }

  private float(at: Element | null | undefined, text: string, kind: FloatKind) {
    if (!this.root) return;
    const box = (at ?? this.meter).getBoundingClientRect();
    const el = h('span', { class: `fs-float fs-float-${kind}`, 'aria-hidden': 'true' }, text);
    el.style.left = `${Math.round(box.left + box.width / 2)}px`;
    el.style.top = `${Math.round(box.top + Math.min(box.height / 2, 40))}px`;
    this.root.append(el);
    window.setTimeout(() => el.remove(), 1100);
  }
}

export interface StallEnd {
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

/**
 * The end card. The stamp reads as ground gained or lost (served vs. left); the score, RV, best and
 * place are the server's. Ids keep the old `<prefix>-end / -score / -meta / -place / -again / -close`.
 */
export function stallEndCard(o: {
  game: FeiraGameId;
  prefix: string;
  cls: string;
  title: string;
  end: StallEnd;
  again: () => void;
  quit: () => void;
}): HTMLElement {
  const { end, prefix, cls } = o;
  const tier = feiraEndTier(end);
  const stamp = FEIRA_END_STAMP[tier];
  const pos = Math.round(feiraCrowd(end.served, end.left) * 100);
  const crowd = h('div', { class: `fs-crowd fs-crowd-end ${pos > 50 ? 'fs-up' : pos < 50 ? 'fs-down' : ''}`, 'data-pos': String(pos) },
    h('span', { class: 'fs-crowd-label' }, FEIRA_CROWD_LABEL.pt, en(FEIRA_CROWD_LABEL.en)),
    h('span', { class: 'fs-crowd-bar' },
      h('i', { class: 'fs-crowd-fill', style: `left:${Math.min(50, pos)}%;width:${Math.abs(pos - 50)}%` }),
      h('i', { class: 'fs-crowd-mark', style: `left:${pos}%` }),
    ),
  );
  const crown = end.crown
    ? h('p', { class: `${cls}-crown-line fs-crown`, id: `${prefix}-crown` }, 'Fada da Feira', en('You lead today’s board.'))
    : null;
  return h('div', { class: `fs-end ${cls}-end fs-tier-${tier}`, id: `${prefix}-end`, 'data-tier': tier },
    stallRoof(o.game),
    h('div', { class: 'fs-end-body' },
      h('h2', null, o.title),
      h('p', { class: `fs-stamp fs-stamp-${tier}`, id: `${prefix}-stamp` }, stamp.stamp.pt, en(stamp.stamp.en)),
      h('p', { class: `${cls}-score fs-end-score`, id: `${prefix}-score` }, String(end.score), en('points')),
      h('ul', { class: 'fs-tally' },
        h('li', { class: 'fs-tally-served' }, h('b', null, String(end.served)), ' atendidos', en('served')),
        h('li', { class: 'fs-tally-perfect' }, h('b', null, String(end.perfect)), ' perfeitos', en('perfect')),
        h('li', { class: 'fs-tally-left' }, h('b', null, String(end.left)), ' foram embora', en('left')),
      ),
      crowd,
      h('p', { class: 'fs-end-line' }, stamp.line.pt, en(stamp.line.en)),
      h('p', { class: `${cls}-line` }, end.linePt, en(end.lineEn)),
      h('p', { class: `${cls}-meta`, id: `${prefix}-meta` },
        `${end.coins} RV`,
        en(end.dailyBlocked ? 'Board only — today’s paid runs are used.' : end.coins ? 'virtual reais' : 'no RV this round'),
      ),
      h('p', { class: `${cls}-meta` }, `Melhor hoje: ${end.bestToday}`, en(`Best today: ${end.bestToday}`)),
      h('p', { class: `${cls}-meta`, id: `${prefix}-place` }, end.place ? `${end.place}º no placar` : 'Fora do placar', en(end.place ? `Place ${end.place} today` : 'Not on the board')),
      crown,
      h('div', { class: `${cls}-end-actions fs-end-actions` },
        h('button', { type: 'button', class: 'primary', id: `${prefix}-again`, onclick: () => o.again() }, 'Jogar de novo', en('Play again')),
        h('button', { type: 'button', class: 'ghost', id: `${prefix}-close`, onclick: () => o.quit() }, 'Fechar', en('Close')),
      ),
    ),
  );
}
