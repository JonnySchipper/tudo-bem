/**
 * The Feira cart games' shared stall: the wooden roof with the FEIRA sign, the scalloped awning,
 * cart posts and wheels, a shelf of props, the freguesia meter, floaters and the end card.
 *
 * Tapioca, Pastel and Caldo each build their own work area; this file is only the cart around it
 * and the beats that read as ground gained or lost. Built once per run; a frame never rebuilds it.
 *
 * needs_br: true (crowd label, exit floaters, end card).
 */
import type { Bilingual } from '@tudobem/shared';
import { h, en } from './dom';
import { pixelSvg } from './pixelSvg';
import {
  CROWD_HEADS,
  CROWD_LABEL,
  END_BEAT,
  EXIT_LINE,
  crowdAfter,
  crowdHeads,
  endTier,
  type FeiraExit,
} from './feiraStallLogic';

/** LimeZu-style ink shared by every prop. Light from the upper left, 1px navy edge. */
const INK: Record<string, string> = {
  n: '#2a2233',
  w: '#f8f8f8',
  g: '#c6c8d4',
  d: '#8b8bab',
  y: '#f2c230',
  Y: '#c48a14',
  o: '#ed931e',
  l: '#daa463',
  b: '#a9764f',
  B: '#6b4c2c',
  r: '#e63f38',
  R: '#a82b2d',
  G: '#3d9a4a',
  L: '#8fd18a',
  D: '#1f6b32',
  u: '#4995e3',
  U: '#2a5f9e',
  c: '#fbf1e3',
  k: '#1a120c',
};

/** 5×7 capitals for the sign. */
const GLYPH: Record<string, string[]> = {
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
};

/** A wood board with FEIRA painted on it and a nail in each top corner. */
export function feiraSignSvg(word = 'FEIRA'): SVGSVGElement {
  const pad = 3;
  const glyphs = [...word].map((ch) => GLYPH[ch] ?? GLYPH.I!);
  const textW = glyphs.reduce((w, g) => w + g[0]!.length, 0) + glyphs.length - 1;
  const W = textW + pad * 2 + 2;
  const H = 7 + pad * 2;
  const grid: string[][] = [];
  for (let y = 0; y < H; y++) {
    const row: string[] = [];
    for (let x = 0; x < W; x++) {
      const edge = x === 0 || y === 0 || x === W - 1 || y === H - 1;
      row.push(edge ? 'n' : y === 1 ? 'l' : y === H - 2 ? 'B' : (x * 7 + y * 3) % 13 === 0 ? 'B' : 'b');
    }
    grid.push(row);
  }
  let gx = pad + 1;
  for (const g of glyphs) {
    g.forEach((line, gy) => {
      for (let i = 0; i < line.length; i++) {
        if (line[i] !== '#') continue;
        const x = gx + i;
        const y = pad + gy;
        grid[y]![x] = 'c';
        if (grid[y + 1]?.[x + 1] && grid[y + 1]![x + 1] !== 'c' && y + 1 < H - 1 && x + 1 < W - 1) grid[y + 1]![x + 1] = 'k';
      }
    });
    gx += g[0]!.length + 1;
  }
  grid[1]![1] = 'g';
  grid[1]![W - 2] = 'g';
  return pixelSvg(grid.map((r) => r.join('')), INK, 'fs-sign-svg');
}

/** Props on the counter shelf, one per stall. 16 px wide; pixelSvg keeps them crisp. */
const PROPS: Record<string, string[]> = {
  goma: [
    '................',
    '.....wwwwww.....',
    '...wwwgwwwwww...',
    '..nnnnnnnnnnnn..',
    '..nuuuuuuuuuUn..',
    '..nuwuuuuuuuUn..',
    '..nuwuuuuuuuUn..',
    '..nUUUUUUUUUUn..',
    '...nuuuuuuuUn...',
    '...nuwuuuuuUn...',
    '...nuuuuuuuUn...',
    '....nnnnnnnn....',
  ],
  peneira: [
    '................',
    '................',
    '................',
    '................',
    '..nnnnnnnnnnnn..',
    '.nllllllllllllnn',
    '.nbbbbbbbbbbbbnB',
    '..ndgdgdgdgdgn.B',
    '...ngdgdgdgdn..B',
    '....nnnnnnnn...n',
    '................',
    '................',
  ],
  pratos: [
    '................',
    '................',
    '................',
    '................',
    '.nnnnnnnnnnnnnn.',
    'nwwwwwwwwwwwwwgn',
    '.nggggggggggggn.',
    'nwwwwwwwwwwwwwgn',
    '.nggggggggggggn.',
    'nwwwwwwwwwwwwwgn',
    '.nnnnnnnnnnnnnn.',
    '................',
  ],
  guardanapo: [
    '................',
    '.....nnnnnn.....',
    '.....nwwwwn.....',
    '....nwwwwwwn....',
    '...nwwwwwwwwn...',
    '..nnnnnnnnnnnn..',
    '..nrwwrrrrrrRn..',
    '..nrrrrrrrrrRn..',
    '..nrrrrrrrrrRn..',
    '..nRRRRRRRRRRn..',
    '..nnnnnnnnnnnn..',
    '................',
  ],
  oleo: [
    '.....nnnn.......',
    '.....nggn.......',
    '...nnnnnnnnn....',
    '...nwyyyyyyYn...',
    '...nyyyyyyyYn...',
    '...nrrrrrrrRn...',
    '...nrwwwwwrRn...',
    '...nrrrrrrrRn...',
    '...nyyyyyyyYn...',
    '...nyyyyyyyYn...',
    '...nYYYYYYYYn...',
    '...nnnnnnnnnn...',
  ],
  rolo: [
    '................',
    '................',
    '................',
    '................',
    '................',
    'nn..nnnnnnnn..nn',
    'nBnnllllllllnnBn',
    'nBbbbbbbbbbbbbBn',
    'nn.nBBBBBBBBn.nn',
    '....nnnnnnnn....',
    '................',
    '................',
  ],
  pimenta: [
    '......nnn.......',
    '......nGn.......',
    '.....nnnnn......',
    '.....nwrRn......',
    '....nrrrrRn.....',
    '....nrwrrRn.....',
    '....nrwrrRn.....',
    '....nrrrrRn.....',
    '....nrrrrRn.....',
    '....nRRRRRn.....',
    '....nnnnnnn.....',
    '................',
  ],
  cana: [
    '...L.....L......',
    '..nGn..LnGn.L...',
    '..nGnnnnGnnGn...',
    '..nyYnnyYnyYn...',
    '..nGDnnGDnGDn...',
    '..nGDnnGDnGDn...',
    '.nnnnnnnnnnnnn..',
    '.nBllllllllllBn.',
    '..nGDnnGDnGDn...',
    '..nyYnnyYnyYn...',
    '..nGDnnGDnGDn...',
    '..nnnnnnnnnnn...',
  ],
  limoes: [
    '................',
    '................',
    '...nn..nn..nn...',
    '..nLGnnLGnnLGn..',
    '..nGGnnGGnnGDn..',
    '.nnnnnnnnnnnnnn.',
    '.nllllllllllllBn',
    '.nbbbbbbbbbbbbBn',
    '.nBnnnnnnnnnnBBn',
    '.nllllllllllllBn',
    '.nbbbbbbbbbbbbBn',
    '.nnnnnnnnnnnnnnn',
  ],
  copos: [
    '................',
    '.....nnnnnn.....',
    '.....nwwwgn.....',
    '.....nwwwgn.....',
    '....nnnnnnnn....',
    '....nwwwwwgn....',
    '....nwwwwwgn....',
    '....nnnnnnnn....',
    '....nwwwwwgn....',
    '....nwwwwwgn....',
    '.....nwwwgn.....',
    '.....nnnnnn.....',
  ],
  isopor: [
    '................',
    '................',
    '..nnnnnnnnnnnn..',
    '..nuuuuuuuuuUn..',
    '..nUUUUUUUUUUn..',
    '..nnnnnnnnnnnn..',
    '..nwwwwwwwwwgn..',
    '..nwrrwwwwwwgn..',
    '..nwwwwwwwwwgn..',
    '..nwwwwwwwwwgn..',
    '..nggggggggggn..',
    '..nnnnnnnnnnnn..',
  ],
};

export type StallProp = keyof typeof PROPS;

export function propSvg(id: StallProp): SVGSVGElement {
  return pixelSvg(PROPS[id]!, INK, `fs-prop fs-prop-${id}`);
}

/** A 12×12 cart wheel. */
function wheelSvg(): SVGSVGElement {
  return pixelSvg([
    '....nnnn....',
    '..nnBBBBnn..',
    '.nBblllbBBn.',
    '.nBl.nn.lBn.',
    'nBl..nn..lBn',
    'nBnnnyynnnBn',
    'nBnnnyynnnBn',
    'nBl..nn..lBn',
    '.nBl.nn.lBn.',
    '.nBBlllbBBn.',
    '..nnBBBBnn..',
    '....nnnn....',
  ], INK, 'fs-wheel-svg');
}

/** Roof plank, scalloped awning, the FEIRA board and the stall's name plaque. `theme` picks the stripes. */
export function stallTop(theme: 'tp' | 'ps' | 'cd', name: string): HTMLElement {
  return h('div', { class: `fs-top fs-theme-${theme}`, 'aria-hidden': 'true' },
    h('div', { class: 'fs-roof' }),
    h('div', { class: 'fs-awning' }),
    h('div', { class: 'fs-sign' }, feiraSignSvg(), h('span', { class: 'fs-plaque' }, name)),
  );
}

/** Posts down each side of the cart. Pure decoration, behind the work area. */
export function cartPosts(): HTMLElement[] {
  return [
    h('i', { class: 'fs-post l', 'aria-hidden': 'true' }),
    h('i', { class: 'fs-post r', 'aria-hidden': 'true' }),
  ];
}

/** The cobbled floor with the cart's two wheels and axle. `cls` keeps the game's own floor class. */
export function cartFloor(cls: string): HTMLElement {
  return h('div', { class: `${cls} fs-floor`, 'aria-hidden': 'true' },
    h('i', { class: 'fs-axle' }),
    h('span', { class: 'fs-wheel l' }, wheelSvg()),
    h('span', { class: 'fs-wheel r' }, wheelSvg()),
  );
}

/** The counter shelf: a wood plank with this stall's props standing on it. */
export function propShelf(ids: StallProp[], extraClass = ''): HTMLElement {
  return h('div', { class: `fs-shelf ${extraClass}`.trim(), 'aria-hidden': 'true' },
    ...ids.map((id) => h('span', { class: 'fs-prop-wrap' }, propSvg(id))),
  );
}

/** A speech bubble over a customer's order with what they want, as pixel icons. */
export function wantBubble(...icons: Node[]): HTMLElement {
  return h('span', { class: 'fs-want', 'aria-hidden': 'true' }, ...icons);
}

/** Restart a one-shot CSS animation on `el`. */
export function jolt(el: Element | null | undefined, cls = 'fs-shake') {
  if (!el) return;
  el.classList.remove(cls);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(cls);
  window.setTimeout(() => el.classList.remove(cls), 520);
}

/**
 * The run's juice: the freguesia meter in the HUD and the floaters over customers.
 * `exit` is the only way the meter moves: a serve brings people over, a walk-out sends them away.
 */
export class StallJuice {
  readonly crowd: HTMLElement;
  private heads: HTMLElement[] = [];
  private ground = 0;
  private host: HTMLElement | null = null;
  private lit = -1;

  constructor() {
    for (let i = 0; i < CROWD_HEADS; i++) this.heads.push(h('i', { class: `fs-head fs-head-${i % 5}` }));
    this.crowd = h('span', { class: 'fs-crowd', role: 'meter', 'aria-label': CROWD_LABEL.en, 'aria-valuemin': '0', 'aria-valuemax': String(CROWD_HEADS) },
      h('span', { class: 'fs-crowd-label' }, CROWD_LABEL.pt),
      h('span', { class: 'fs-heads' }, ...this.heads),
    );
    this.paint();
  }

  /** The overlay root floaters are drawn in (position: fixed inset 0). */
  attach(host: HTMLElement) {
    this.host = host;
  }

  get value() {
    return this.ground;
  }

  /**
   * One customer is done. `at` is their card (or anything to float over), `points` the client's guess,
   * and `line` overrides the stock floater (each game has its own "wrong order" line).
   */
  exit(at: Element | null, exit: FeiraExit, points = 0, line: Bilingual = EXIT_LINE[exit]) {
    const before = this.ground;
    this.ground = crowdAfter(this.ground, exit);
    this.paint();
    const kind = exit === 'perfect' ? 'good' : exit === 'ok' ? 'good' : exit === 'soft' ? 'meh' : 'bad';
    this.float(at, line, kind, points > 0 ? `+${points}` : undefined);
    if (this.ground > before) jolt(this.crowd, 'fs-gain');
    else if (this.ground < before) jolt(this.crowd, 'fs-loss');
  }

  /** A floater rising from `at`. `badge` is a small number above the line (the points). */
  float(at: Element | null, line: Bilingual, kind: 'good' | 'meh' | 'bad', badge?: string) {
    if (!this.host) return;
    const box = at?.getBoundingClientRect();
    const x = box ? box.left + box.width / 2 : window.innerWidth / 2;
    const y = box ? box.top + Math.min(box.height / 2, 40) : window.innerHeight / 3;
    const el = h('span', { class: `fs-float fs-float-${kind}`, style: `left:${Math.round(x)}px;top:${Math.round(y)}px`, 'aria-hidden': 'true' },
      badge ? h('b', null, badge) : null,
      line.pt,
      en(line.en),
    );
    this.host.append(el);
    window.setTimeout(() => el.remove(), 1100);
  }

  private paint() {
    const n = crowdHeads(this.ground);
    if (n === this.lit) return;
    this.lit = n;
    this.heads.forEach((head, i) => head.classList.toggle('on', i < n));
    this.crowd.setAttribute('aria-valuenow', String(n));
  }
}

export interface FeiraEndView {
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
 * The end card all three stalls share. Ids keep the game's prefix (`tapioca-score`, `pastel-again`…)
 * so the smoke scripts and the server-sent numbers land where they always did.
 */
export function feiraEndCard(prefix: string, cls: string, title: string, end: FeiraEndView, hooks: { again: () => void; quit: () => void }): HTMLElement {
  const tier = endTier(end);
  const beat = END_BEAT[tier];
  const crown = end.crown
    ? h('p', { class: `${cls}-crown-line fs-crown-line`, id: `${prefix}-crown` }, 'Fada da Feira', en('You lead today’s board.'))
    : null;
  return h('div', { class: `${cls}-end fs-end fs-end-${tier}`, id: `${prefix}-end`, 'data-tier': tier },
    h('div', { class: 'fs-end-sign', 'aria-hidden': 'true' }, feiraSignSvg()),
    h('h2', null, title),
    h('p', { class: `fs-stamp fs-stamp-${tier}`, id: `${prefix}-stamp` }, beat.stamp.pt, en(beat.stamp.en)),
    h('p', { class: `${cls}-score fs-score`, id: `${prefix}-score` }, String(end.score), en('points')),
    h('p', { class: 'fs-tally', id: `${prefix}-tally` },
      h('span', { class: 'fs-tally-in' }, `Atendidos ${end.served}`, en(`Served ${end.served}`)),
      h('span', { class: 'fs-tally-out' }, `Foram embora ${end.left}`, en(`Walked off ${end.left}`)),
    ),
    h('p', { class: 'fs-beat' }, beat.line.pt, en(beat.line.en)),
    h('p', { class: `${cls}-line` }, end.linePt, en(end.lineEn)),
    h('p', { class: `${cls}-meta`, id: `${prefix}-meta` },
      `${end.coins} RV`,
      en(end.dailyBlocked ? 'Board only — today’s paid runs are used.' : end.coins ? 'virtual reais' : 'no RV this round'),
    ),
    h('p', { class: `${cls}-meta` }, `Melhor hoje: ${end.bestToday}`, en(`Best today: ${end.bestToday}`)),
    h('p', { class: `${cls}-meta`, id: `${prefix}-place` }, end.place ? `${end.place}º no placar` : 'Fora do placar', en(end.place ? `Place ${end.place} today` : 'Not on the board')),
    crown,
    h('div', { class: `${cls}-end-actions fs-end-actions` },
      h('button', { type: 'button', class: 'primary', id: `${prefix}-again`, onclick: () => hooks.again() }, 'Jogar de novo', en('Play again')),
      h('button', { type: 'button', class: 'ghost', id: `${prefix}-close`, onclick: () => hooks.quit() }, 'Fechar', en('Close')),
    ),
  );
}
