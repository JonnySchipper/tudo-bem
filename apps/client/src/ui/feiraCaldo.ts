/**
 * Caldo de cana, the multitasking Feira cart game, on the Feira stage (feiraStage.ts).
 *
 * The server dealt the seed. Orders come from shared `caldoOrders(seed)`, so the customers who walk up are the
 * ones the server will score; this view only reports each order's quality and time.
 *
 * Behind the cart: a crate of cane, the green moenda with its flywheel and spout, a stack of cups, a tray for
 * two finished cups, the fruit for the flavors and the ice bucket.
 *
 *   1. Tap the cane (or drag it to the press): a stalk goes in. One stalk is about a cup and a half.
 *   2. Hold the flywheel: the rollers turn, the stalk shrinks and juice runs from the spout. Let go when the cup
 *      reaches its line (short, or over the rim, is a soft fail). No cup under the spout and it runs on the counter.
 *   3. Tap the fruit they asked for and, for "com gelo", the ice. They go into the cup you last touched.
 *   4. Drag the cup to the customer (or tap them). Park a cup on the tray to start the next one.
 *
 * A wrong flavor is a miss; wrong ice, a spill or a short cup is soft. Nothing ends the run early.
 *
 * needs_br: true (order lines, pops, labels, end card).
 */
import {
  CALDO_CRANK,
  CALDO_DURATION_MS,
  caldoFlavors,
  CALDO_FLAVOR_LABEL,
  CALDO_LINE,
  CALDO_NO_CANE,
  CALDO_NO_CUP,
  CALDO_OVERFLOW,
  CALDO_SHORT,
  CALDO_WRONG_FLAVOR,
  CALDO_WRONG_ICE,
  caldoFill,
  caldoOrders,
  caldoServeQuality,
  type CaldoFlavor,
  type CaldoOrder,
  type FeiraOrderOutcome,
} from '@tudobem/shared';
import { FEIRA_LOOP_MS } from '../audio/feiraSfx';
import { stallEndCard, type StallEnd } from './feiraStall';
import { C, FeiraStage, blit, disc, fill, inDisc, inEllipse, paint, rows, type Ctx, type DragPayload, type StageCustomer, type StageLayout } from './feiraStage';

export type CaldoEnd = StallEnd;

export interface CaldoHooks {
  finish: (outcomes: FeiraOrderOutcome[]) => void;
  quit: () => void;
  again: () => void;
}

/** needs_br: true */
const HINT = {
  cup: { pt: 'Põe um copo embaixo da bica.', en: 'Put a cup under the spout.' },
  spout: { pt: 'Já tem copo na bica.', en: 'There is already a cup under the spout.' },
  tray: { pt: 'A bandeja está cheia.', en: 'The tray is full.' },
  pick: { pt: 'Toca num copo primeiro.', en: 'Tap a cup first.' },
  none: { pt: 'Nenhum copo pronto.', en: 'No cup is ready.' },
  full: { pt: 'A moenda já tem cana.', en: 'The press already has cane.' },
};

const JUICE: Record<CaldoFlavor | 'plain', string> = {
  plain: '#c9d65a',
  limao: '#d6e46a',
  abacaxi: '#eccb3a',
  maracuja: '#e8a640',
  gengibre: '#dcc070',
  hortela: '#9fcf5a',
  laranja: '#f0a03a',
  abacaxi_hortela: '#cfd24a',
};

// ---------------------------------------------------------------- sprites

const FRUIT_PAL = {
  k: C.ink, g: '#3d9a4a', G: '#8fd18a', d: '#1f6b32', y: '#f2c230', Y: '#fff59a', o: '#c48a14', O: '#ed931e',
  p: '#7a3a6a', P: '#a85a8a', w: '#ffffff', b: '#d8b070', B: '#a87c40', r: '#e07a2c', R: '#f6b06a',
};

const FRUIT: Record<CaldoFlavor, string[]> = {
  limao: [
    '....gggg....',
    '..gGGGGggg..',
    '.gGGwGGGggg.',
    '.gGwGGGggdg.',
    'gGGGGGggggdg',
    'gGGGGgggggdg',
    'gGGGgggggddg',
    '.gGggggggdg.',
    '.ggggggdddg.',
    '..gggddddg..',
    '....gggg....',
  ],
  abacaxi: [
    '...g.gg.g...',
    '....gGgg....',
    '...ggGGgg...',
    '....gggg....',
    '...oyyyyo...',
    '..oyYoyYyo..',
    '..yYoyYoyo..',
    '..oyYoyYyo..',
    '..yYoyYoyo..',
    '..oyyoyyoo..',
    '...ooooo....',
  ],
  maracuja: [
    '.....dd.....',
    '...pppPp....',
    '..pPPPPpp...',
    '.pPwPPpppp..',
    '.pPPPpppppp.',
    '.pPPppppppp.',
    '.pPpppppppp.',
    '..pppppppp..',
    '...pppppp...',
    '....pppp....',
  ],
  gengibre: [
    '..bb........',
    '.bRbb..bb...',
    '.bbbbbbRbb..',
    '..bbBbbbbbb.',
    '...bbbbBbbbb',
    '..bbbBbbbBb.',
    '.bRbbbbbb...',
    '.bbbb.bbb...',
    '..bb...bb...',
  ],
  hortela: [
    '.....g......',
    '....gGg.....',
    '...gGGgg.g..',
    '..gGGgggGGg.',
    '..gGgdggGgg.',
    '.gGgdgggggd.',
    '.ggdggddgd..',
    '..gdgggdd...',
    '...ddddd....',
    '.....d......',
  ],
  laranja: [
    '.....gg.....',
    '...rrgrr....',
    '..rRRRrrr...',
    '.rRwRRrrrr..',
    '.rRRRrrrrrr.',
    '.rRRrrrrrrr.',
    '.rRrrrrrrrr.',
    '..rrrrrrrr..',
    '...rrrrrr...',
    '....rrrr....',
  ],
  abacaxi_hortela: [
    '..g.gg.g..g.',
    '...gGgg..gGg',
    '..ggGGgggGg.',
    '...gggg.gd..',
    '..oyyyyo....',
    '.oyYoyYyo...',
    '.yYoyYoyo...',
    '.oyYoyYyo...',
    '.yYoyYoyo...',
    '..oooooo....',
  ],
};

const fruitSprite = (f: CaldoFlavor) => rows(`cd-fruit-${f}`, FRUIT[f], FRUIT_PAL, C.ink);

function iceSprite(on: boolean): HTMLCanvasElement {
  if (!on) {
    return paint('cd-noice', 12, 12, (x, y) => {
      const ring = inDisc(x, y, 6, 6, 6) && !inDisc(x, y, 6, 6, 4.4);
      const slash = Math.abs(x - (11 - y)) <= 0 && inDisc(x, y, 6, 6, 5);
      if (ring || slash) return '#c0392b';
      if (inDisc(x, y, 6, 6, 4.4) && x > 2 && x < 9 && y > 3 && y < 9) return (x + y) % 3 ? '#d8f0ff' : '#9fd4f2';
      return null;
    });
  }
  return paint('cd-ice', 13, 11, (x, y) => {
    const a = x <= 6 && y >= 3 && y <= 9;
    const b = x >= 5 && y <= 6 && y >= 0 && x <= 12;
    if (b) return x === 5 || y === 0 ? '#ffffff' : (x + y) % 4 === 0 ? '#ffffff' : '#bfe6fa';
    if (a) return x === 0 || y === 3 ? '#ffffff' : '#9fd4f2';
    return null;
  });
}

/** A shallow clay dish the fruit sits in. */
function dishSprite(): HTMLCanvasElement {
  return paint('cd-dish', 22, 7, (x, y) => {
    if (!inEllipse(x, y, 11, 1, 11, 6)) return null;
    if (y === 0) return '#f0b080';
    if (y === 1) return '#a0522d';
    return x < 6 ? '#e08a5a' : x > 16 ? '#a0522d' : '#c8693c';
  });
}

/** The ice bucket: steel, heaped with cubes. */
function bucketSprite(): HTMLCanvasElement {
  return paint('cd-bucket', 26, 20, (x, y) => {
    if (y <= 5) {
      if (!inEllipse(x, y, 13, 6, 12, 5)) return null;
      return (x * 3 + y * 5) % 7 === 0 ? '#ffffff' : (x + y) % 3 === 0 ? '#9fd4f2' : '#d8f0ff';
    }
    const inset = Math.floor((y - 6) / 5);
    if (x < 1 + inset || x > 24 - inset) return null;
    if (y === 6) return C.steelHi;
    if (y === 12) return C.steelLo;
    return x < 7 ? C.steelHi : x > 18 ? C.steelMid : C.steel;
  });
}

/** A crate of cane stalks leaning up. */
function crateSprite(): HTMLCanvasElement {
  return paint('cd-crate', 30, 38, (x, y) => {
    if (y >= 24) {
      if (y === 24 || y === 37) return C.woodLo;
      if (y === 30) return C.woodMid;
      return x % 10 === 0 ? C.woodLo : x < 4 ? C.woodHi : C.wood;
    }
    for (let k = 0; k < 5; k++) {
      const sx = 3 + k * 5 + Math.floor((24 - y) / (9 + k));
      if (x === sx || x === sx + 1 || x === sx + 2) {
        if ((y + k * 3) % 8 === 0) return '#c8a040';
        if (y < 3 + (k % 2) * 2) return x === sx ? '#8fd18a' : '#3d9a4a';
        return x === sx ? '#c8e09a' : x === sx + 1 ? '#8fb83a' : '#5a8a2a';
      }
    }
    return null;
  });
}

function cupStackSprite(): HTMLCanvasElement {
  return paint('cd-cupstack', 16, 26, (x, y) => {
    const inset = Math.floor(y / 9);
    if (x < 1 + inset || x > 14 - inset) return null;
    if (y % 4 === 0) return '#ffffff';
    return x < 4 ? '#f8fbff' : x > 11 - inset ? '#c6d4e0' : '#e8f0f6';
  });
}

/** The moenda: green body with a yellow band, a hopper slot, the spout on the right. Flywheel drawn live. */
function pressSprite(w: number, hgt: number): HTMLCanvasElement {
  return paint(`cd-press-${w}x${hgt}`, w, hgt, (x, y) => {
    const bodyTop = 6;
    // the feed slot on top
    if (y < bodyTop) {
      if (x >= w * 0.3 && x <= w * 0.7) return y === 0 ? '#2f7a45' : y < 3 ? '#1f6b32' : C.ink;
      return null;
    }
    const band = y >= hgt * 0.42 && y <= hgt * 0.56;
    const lit = x < w * 0.3 && y < hgt * 0.4;
    if (y === bodyTop) return '#a8e0a0';
    if (y >= hgt - 3) return y === hgt - 1 ? C.ink : '#1f5a32';
    if (band) return lit ? '#ffe58a' : x > w * 0.75 ? '#c48a14' : '#f2c230';
    if ((x === 3 || x === w - 4) && (y === bodyTop + 3 || y === hgt - 6)) return C.steelHi;
    return lit ? '#5fbf6a' : x > w * 0.8 ? '#1f6b32' : '#3d9a4a';
  });
}

/** A clear cup at its fill: juice (with a foamy top), ice, the fruit on the rim and the line. */
function drawCup(g: Ctx, x: number, bottom: number, cup: Pick<Cup, 'level' | 'flavor' | 'ice' | 'spilled'>, big = false) {
  const w = big ? 16 : 14;
  const hgt = big ? 22 : 19;
  const top = bottom - hgt;
  // juice
  const lvl = Math.min(1.3, cup.level) / CALDO_CRANK.max;
  const jh = Math.round((hgt - 2) * Math.min(1, lvl));
  const juice = JUICE[cup.flavor ?? 'plain'];
  for (let y = 0; y < hgt; y++) {
    const yy = top + y;
    const inset = Math.floor(((hgt - y) / hgt) * 2);
    const left = x - w / 2 + (2 - inset);
    const right = x + w / 2 - (2 - inset);
    // the plastic walls
    g.fillStyle = 'rgba(216,240,255,0.55)';
    g.fillRect(Math.round(left), yy, Math.round(right - left), 1);
    if (y >= hgt - 1 - jh && y < hgt - 1) {
      g.fillStyle = y === hgt - 1 - jh ? '#f4f0c8' : y === hgt - jh ? '#e8eaa8' : juice;
      g.fillRect(Math.round(left) + 1, yy, Math.round(right - left) - 2, 1);
    }
    g.fillStyle = C.ink;
    g.fillRect(Math.round(left) - 1, yy, 1, 1);
    g.fillRect(Math.round(right), yy, 1, 1);
  }
  fill(g, x - w / 2 + 1, bottom - 1, w - 2, 1, C.ink);
  fill(g, x - w / 2 - 1, top - 1, w + 2, 1, '#ffffff');
  fill(g, x - w / 2 + 2, top + 2, 1, hgt - 5, 'rgba(255,255,255,0.8)');
  // the line
  const lineY = Math.round(bottom - 1 - (hgt - 2) * (1 / CALDO_CRANK.max));
  g.fillStyle = '#c0392b';
  for (let k = -w / 2 + 2; k < w / 2 - 1; k += 2) g.fillRect(Math.round(x + k), lineY, 1, 1);
  fill(g, x + w / 2, lineY, 2, 1, '#c0392b');
  if (cup.ice) {
    const cubes: [number, number][] = [[-3, 4], [2, 6], [-1, 9]];
    for (const [cx, cy] of cubes) {
      const yy = Math.max(top + 2, bottom - 1 - jh + cy - 4);
      fill(g, x + cx - 1, yy, 4, 3, '#e8f6ff');
      fill(g, x + cx - 1, yy, 4, 1, '#ffffff');
    }
  }
  if (cup.flavor) {
    // a slice or a leaf on the rim
    const f = cup.flavor;
    const c = f === 'hortela' ? '#3d9a4a' : f === 'abacaxi' || f === 'abacaxi_hortela' ? '#f2c230' : f === 'laranja' ? '#ed931e' : f === 'maracuja' ? '#a85a8a' : f === 'gengibre' ? '#d8b070' : '#8fd18a';
    disc(g, x + w / 2 - 2, top - 1, 3, C.ink);
    disc(g, x + w / 2 - 2, top - 1, 2, c);
    if (f === 'abacaxi_hortela') fill(g, x + w / 2 - 6, top - 3, 2, 3, '#3d9a4a');
  }
  if (cup.spilled) {
    g.fillStyle = juice;
    g.fillRect(x - w / 2 - 1, top + 3, 1, 4);
    g.fillRect(x + w / 2, top + 5, 1, 3);
  }
}

/** A cup at rest as a sprite (for the drag ghost and the bubble ticket). */
function cupSprite(flavor: CaldoFlavor | null, ice: boolean, level = 1): HTMLCanvasElement {
  const key = `cd-cup-${flavor ?? 'plain'}-${ice}-${Math.round(level * 10)}`;
  const cv = paint(key, 18, 24, () => null, null);
  if (!cv.dataset.drawn) {
    cv.dataset.drawn = '1';
    const g = cv.getContext('2d');
    if (g) drawCup(g, 9, 23, { level, flavor, ice, spilled: false });
  }
  return cv;
}

// ---------------------------------------------------------------- state

interface Cup {
  level: number;
  flavor: CaldoFlavor | null;
  ice: boolean;
  spilled: boolean;
  where: 'spout' | 0 | 1;
  /** performance.now of the last change, for the hop */
  at: number;
}

export class CaldoView {
  private stage: FeiraStage<CaldoOrder>;
  private spout: Cup | null = null;
  private tray: (Cup | null)[] = [null, null];
  private selected: Cup | null = null;
  /** cane left in the press, in cups */
  private cane = 0;
  private cranking = false;
  private crankAt = 0;
  private autoCrank = false;
  private wheel = 0;
  private puddle = 0;
  private warnedNoCup = false;
  private warnedNoCane = false;
  private lastNow = 0;
  /** performance.now of the last grind and pour sounds while cranking */
  private crushAt = 0;
  private streamAt = 0;
  // layout
  private crate = { x: 0, y: 0 };
  private press = { x: 0, y: 0, w: 0, h: 0 };
  private wheelAt = { x: 0, y: 0, r: 16 };
  private spoutAt = { x: 0, y: 0 };
  private cupAt = { x: 0, y: 0 };
  private trayAt: { x: number; y: number }[] = [];
  private stack = { x: 0, y: 0 };
  private bucket = { x: 0, y: 0 };
  private fruits: { f: CaldoFlavor; x: number; y: number }[] = [];
  private top: HTMLCanvasElement | null = null;
  private topKey = '';
  /** The bottles on the counter: three in the 1st run, all seven after (shared `caldoFlavors`). */
  private readonly flavors: readonly CaldoFlavor[];

  constructor(
    seed: number,
    private readonly hooks: CaldoHooks,
    /** Caldo runs on the profile before this one (`feiraRuns.caldo`). Omitted: the full game. */
    runs?: number,
  ) {
    this.flavors = caldoFlavors(runs);
    this.stage = new FeiraStage<CaldoOrder>({
      game: 'caldo',
      prefix: 'caldo',
      title: 'Caldo de cana',
      orders: caldoOrders(seed, runs),
      durationMs: CALDO_DURATION_MS,
      palette: { awningA: '#3d9a4a', awningB: '#f2c230', plaque: '#2f7a45' },
      icons: (o) => [cupSprite(o.flavor, o.ice === 'gelo'), fruitSprite(o.flavor), iceSprite(o.ice === 'gelo')],
      layout: (L) => this.layout(L),
      update: (dt, t) => this.update(dt, t),
      draw: (g, t, now) => this.draw(g, t, now),
      serve: (c, p) => this.serveTo(c, p),
      finish: (o) => this.hooks.finish(o),
    });
  }

  get root(): HTMLElement {
    return this.stage.root;
  }

  destroy() {
    this.stage.destroy();
  }

  showEnd(end: CaldoEnd) {
    this.stage.showEnd(stallEndCard({ game: 'caldo', prefix: 'caldo', cls: 'cd', title: 'Caldo de cana', end, again: () => this.hooks.again(), quit: () => this.hooks.quit() }));
  }

  // ---------------------------------------------------------------- layout

  private layout(L: StageLayout) {
    const { W, work, portrait } = L;
    if (portrait) {
      // the press row, then cups / ice / the spout cup / the tray on one counter line, then the fruit
      const content = 64 + 40 + 70;
      const y0 = work.y + Math.max(8, Math.round((work.h - content) * 0.35));
      this.crate = { x: 16, y: y0 + 32 };
      this.wheelAt = { x: 48, y: y0 + 34, r: 15 };
      this.press = { x: 58, y: y0 + 6, w: 72, h: 54 };
      this.spoutAt = { x: this.press.x + this.press.w + 6, y: y0 + 38 };
      const base = y0 + 92;
      this.cupAt = { x: this.spoutAt.x + 6, y: base };
      this.trayAt = [{ x: this.cupAt.x + 24, y: base }, { x: this.cupAt.x + 42, y: base }];
      this.stack = { x: 22, y: base - 13 };
      this.bucket = { x: 62, y: base - 9 };
      const fy = base + 26;
      const per = 4;
      const cw = (W - 12) / per;
      this.fruits = this.flavors.map((f, i) => ({ f, x: Math.round(6 + cw * (i % per) + cw / 2), y: fy + Math.floor(i / per) * 34 }));
    } else {
      const y0 = work.y + 6;
      this.crate = { x: 22, y: y0 + 32 };
      this.wheelAt = { x: 58, y: y0 + 32, r: Math.min(18, Math.floor(work.h / 5.5)) };
      this.press = { x: 70, y: y0 + 4, w: 64, h: 56 };
      this.spoutAt = { x: this.press.x + this.press.w + 6, y: y0 + 36 };
      this.cupAt = { x: this.spoutAt.x + 6, y: Math.min(work.y + work.h - 10, y0 + 76) };
      this.trayAt = [{ x: 172, y: this.cupAt.y }, { x: 192, y: this.cupAt.y }];
      this.stack = { x: 182, y: y0 + 24 };
      const fx0 = 212;
      const per = 4;
      const cw = (W - fx0 - 4) / per;
      this.fruits = this.flavors.map((f, i) => ({ f, x: Math.round(fx0 + cw * (i % per) + cw / 2), y: y0 + 14 + Math.floor(i / per) * 34 }));
      this.bucket = { x: Math.round(fx0 + cw * 3 + cw / 2), y: y0 + 14 + 34 };
    }
    this.top = null;
  }

  // ---------------------------------------------------------------- rules

  private update(_dt: number, _t: number) {
    const now = performance.now();
    const dt = Math.min(0.1, Math.max(0, (now - (this.lastNow || now)) / 1000));
    this.lastNow = now;
    const st = this.stage;
    this.puddle = Math.max(0, this.puddle - dt * 0.05);
    if (!this.cranking) return;
    if (this.cane <= 0) {
      this.stopCrank();
      if (!this.warnedNoCane) {
        this.warnedNoCane = true;
        st.pop(CALDO_NO_CANE, 'bad');
        st.sfx('nope');
      }
      return;
    }
    const flow = CALDO_CRANK.fillPerSec * dt;
    this.cane = Math.max(0, this.cane - flow / CALDO_CRANK.canePerCup);
    this.wheel += dt * 9;
    // the rollers grind and the caldo pours (into the cup, or onto the counter) for as long as the wheel turns
    if (now - this.crushAt >= FEIRA_LOOP_MS.crush) {
      this.crushAt = now;
      st.sfx('crush');
    }
    if (now - this.streamAt >= FEIRA_LOOP_MS.stream) {
      this.streamAt = now;
      st.sfx(this.spout ? 'stream' : 'splat');
    }
    // juice runs from the spout
    const sx = this.spoutAt.x + 4;
    st.puff(sx + (Math.random() - 0.5), this.spoutAt.y + 3, JUICE[this.spout?.flavor ?? 'plain'], { vy: 60, vx: 0, ay: 120, life: 0.25 });
    if (Math.random() < 0.3) st.puff(this.wheelAt.x - this.wheelAt.r + Math.random() * 6, this.press.y + this.press.h - 4, '#c8a040', { vy: 10, vx: -8, ay: 60, life: 0.5 });
    const cup = this.spout;
    if (!cup) {
      this.puddle = Math.min(1, this.puddle + flow);
      // a key press cranks on its own: without a cup it stops after a short splash
      if (this.autoCrank && now - this.crankAt > 600) this.stopCrank();
      if (!this.warnedNoCup) {
        this.warnedNoCup = true;
        st.pop(CALDO_NO_CUP, 'bad');
        st.sfx('nope');
      }
      return;
    }
    const before = cup.level;
    cup.level = Math.min(CALDO_CRANK.max, cup.level + flow);
    if (before < CALDO_CRANK.lineFrom && cup.level >= CALDO_CRANK.lineFrom) st.sfx('line');
    if (cup.level > CALDO_CRANK.overAt) {
      if (!cup.spilled) {
        cup.spilled = true;
        st.pop(CALDO_OVERFLOW, 'bad');
        st.sfx('glug');
      }
      this.puddle = Math.min(1, this.puddle + flow * 0.6);
      st.puff(this.cupAt.x + (Math.random() < 0.5 ? -8 : 8), this.cupAt.y - 18, JUICE[cup.flavor ?? 'plain'], { vy: 20, vx: (Math.random() - 0.5) * 20, ay: 120, life: 0.4 });
    }
    if (this.autoCrank && cup.level >= 0.95) this.stopCrank();
  }

  private startCrank(keyboard = false) {
    if (this.stage.over) return;
    if (this.cane <= 0) {
      this.stage.pop(CALDO_NO_CANE, 'bad');
      this.stage.sfx('nope');
      return;
    }
    this.cranking = true;
    this.autoCrank = keyboard;
    this.crankAt = performance.now();
    this.warnedNoCup = false;
    this.warnedNoCane = false;
    this.lastNow = performance.now();
    // the first grind lands on the press; the pour follows once the juice reaches the spout
    this.crushAt = this.lastNow;
    this.streamAt = this.lastNow - FEIRA_LOOP_MS.stream / 2;
    this.stage.sfx('crush');
  }

  private stopCrank() {
    if (!this.cranking) return;
    this.cranking = false;
    this.autoCrank = false;
    const cup = this.spout;
    if (cup && cup.level > 0.05 && !cup.spilled) {
      const f = caldoFill(cup.level);
      if (f === 'line') {
        this.stage.pop(CALDO_LINE, 'good');
        this.stage.sfx('ding');
        this.stage.burst(this.cupAt.x, this.cupAt.y - 20, 8, ['#ffffff', '#fff59a'], { up: 20, spread: 16, life: 0.5 });
      }
    }
  }

  private loadCane(): boolean {
    if (this.stage.over) return false;
    if (this.cane > 0.35) {
      this.stage.pop(HINT.full);
      return false;
    }
    this.cane = Math.min(CALDO_CRANK.canePerCup * 1.2, this.cane + CALDO_CRANK.canePerCup);
    this.stage.sfx('cane');
    return true;
  }

  private newCup(): boolean {
    if (this.stage.over) return false;
    if (this.spout) {
      // the spout is busy: park it on the tray and put the new cup down
      if (!this.park()) {
        this.stage.pop(HINT.spout);
        return false;
      }
    }
    this.spout = { level: 0, flavor: null, ice: false, spilled: false, where: 'spout', at: performance.now() };
    this.selected = this.spout;
    this.stage.sfx('cup');
    return true;
  }

  /** Move the spout cup to a free tray place. */
  private park(): boolean {
    const cup = this.spout;
    if (!cup) return false;
    const k = this.tray.findIndex((t) => !t);
    if (k < 0) {
      this.stage.pop(HINT.tray);
      return false;
    }
    if (this.cranking) this.stopCrank();
    cup.where = k as 0 | 1;
    cup.at = performance.now();
    this.tray[k] = cup;
    this.spout = null;
    this.stage.sfx('grab');
    return true;
  }

  private flavor(f: CaldoFlavor, target: Cup | null = this.selected) {
    if (this.stage.over) return false;
    const cup = target ?? this.spout ?? this.tray.find((t) => t) ?? null;
    if (!cup) {
      this.stage.pop(HINT.pick);
      return false;
    }
    cup.flavor = f;
    cup.at = performance.now();
    this.selected = cup;
    this.stage.sfx('splash');
    const p = this.cupPos(cup);
    this.stage.burst(p.x, p.y - 22, 6, [JUICE[f], '#ffffff'], { up: 10, spread: 10, life: 0.4 });
    return true;
  }

  private ice(target: Cup | null = this.selected) {
    if (this.stage.over) return false;
    const cup = target ?? this.spout ?? this.tray.find((t) => t) ?? null;
    if (!cup) {
      this.stage.pop(HINT.pick);
      return false;
    }
    cup.ice = !cup.ice;
    cup.at = performance.now();
    this.selected = cup;
    this.stage.sfx(cup.ice ? 'ice' : 'tick');
    return true;
  }

  private cupPos(cup: Cup): { x: number; y: number } {
    if (cup.where === 'spout') return this.cupAt;
    return this.trayAt[cup.where]!;
  }

  private takeCup(cup: Cup) {
    if (cup.where === 'spout') {
      this.spout = null;
      if (this.cranking) this.stopCrank();
    } else this.tray[cup.where] = null;
    if (this.selected === cup) this.selected = null;
  }

  private cupOf(data: unknown): Cup | null {
    if (data === 'spout') return this.spout;
    if (data === 0 || data === 1) return this.tray[data];
    return null;
  }

  private serveTo(c: StageCustomer<CaldoOrder>, payload: DragPayload | null) {
    if (!this.stage.servable(c)) return;
    let cup: Cup | null = null;
    if (payload?.kind === 'cup') cup = this.cupOf(payload.data);
    else if (!payload) {
      const cups = [this.spout, ...this.tray].filter((x): x is Cup => !!x && x.level > 0.1);
      cup = cups.find((x) => x.flavor === c.order.flavor && x.ice === (c.order.ice === 'gelo'))
        ?? cups.find((x) => x.flavor === c.order.flavor)
        ?? (this.selected && cups.includes(this.selected) ? this.selected : null)
        ?? null;
    } else return;
    if (!cup || cup.level <= 0.1) {
      if (!payload) this.stage.pop(HINT.none);
      return;
    }
    const flavorOk = cup.flavor === c.order.flavor;
    const iceOk = cup.ice === (c.order.ice === 'gelo');
    const short = caldoFill(cup.level) === 'short';
    const quality = caldoServeQuality({ flavorOk, iceOk, spilled: cup.spilled, short, patienceLeft: this.stage.patience(c) });
    const why = !flavorOk ? CALDO_WRONG_FLAVOR : !iceOk ? CALDO_WRONG_ICE : short ? CALDO_SHORT : undefined;
    this.stage.record(c, quality, why);
    if (why) this.stage.pop(why, 'bad');
    this.takeCup(cup);
  }

  // ---------------------------------------------------------------- drawing

  private workTop(): HTMLCanvasElement {
    const L = this.stage.L;
    const key = `${L.W}x${L.H}:${L.work.y}`;
    if (this.top && this.topKey === key) return this.top;
    const cv = document.createElement('canvas');
    cv.width = L.W;
    cv.height = L.H;
    const g = cv.getContext('2d')!;
    const { work, W } = L;
    // green-and-white tiles, the caldo cart's counter
    for (let y = work.y; y < work.y + work.h; y += 8) {
      for (let x = 0; x < W; x += 8) {
        const odd = (Math.floor(x / 8) + Math.floor((y - work.y) / 8)) % 2;
        fill(g, x, y, 8, 8, odd ? '#e8f2e0' : '#fdfdf6');
      }
    }
    g.fillStyle = 'rgba(42,34,51,0.08)';
    for (let y = work.y; y < work.y + work.h; y += 8) g.fillRect(0, y, W, 1);
    for (let x = 0; x < W; x += 8) g.fillRect(x, work.y, 1, work.h);
    // the drip grate under the spout
    const c = this.cupAt;
    fill(g, c.x - 12, c.y - 2, 24, 5, C.ink);
    fill(g, c.x - 11, c.y - 1, 22, 3, C.steelMid);
    g.fillStyle = C.steelHi;
    for (let x = c.x - 10; x < c.x + 10; x += 2) g.fillRect(x, c.y - 1, 1, 3);
    // the tray (a wooden board for two cups)
    if (this.trayAt.length) {
      const a = this.trayAt[0]!;
      const b = this.trayAt[1]!;
      fill(g, a.x - 11, a.y - 2, b.x - a.x + 22, 5, C.ink);
      fill(g, a.x - 10, a.y - 1, b.x - a.x + 20, 3, C.wood);
      fill(g, a.x - 10, a.y - 1, b.x - a.x + 20, 1, C.woodHi);
    }
    this.top = cv;
    this.topKey = key;
    return cv;
  }

  private draw(g: Ctx, _t: number, now: number) {
    g.drawImage(this.workTop(), 0, 0);
    // a puddle when juice ran on the counter
    if (this.puddle > 0.02) {
      const r = 4 + this.puddle * 12;
      for (let y = -2; y <= 2; y++) fill(g, this.cupAt.x - r + Math.abs(y) * 2, this.cupAt.y + 4 + y, (r - Math.abs(y) * 2) * 2, 1, 'rgba(201,214,90,0.7)');
    }
    blit(g, crateSprite(), this.crate.x, this.crate.y, true);
    this.drawPress(g, now);
    // cups
    blit(g, cupStackSprite(), this.stack.x, this.stack.y, true);
    if (this.spout) this.drawCupAt(g, this.spout, now);
    for (const cup of this.tray) if (cup) this.drawCupAt(g, cup, now);
    // the stream
    if (this.cranking && this.cane > 0) {
      const sx = this.spoutAt.x + 4;
      const to = this.spout ? this.cupAt.y - 4 - Math.round(19 * Math.min(1, this.spout.level / CALDO_CRANK.max)) : this.cupAt.y + 2;
      for (let y = this.spoutAt.y + 2; y < to; y++) fill(g, sx + ((y + Math.floor(now / 60)) % 3 === 0 ? 1 : 0), y, 2, 1, (y + Math.floor(now / 40)) % 4 === 0 ? '#f4f0c8' : JUICE[this.spout?.flavor ?? 'plain']);
    }
    // fruit, each in its clay dish, and the ice
    for (const fr of this.fruits) {
      blit(g, dishSprite(), fr.x, fr.y + 5, true);
      blit(g, fruitSprite(fr.f), fr.x, fr.y - 1, true);
    }
    blit(g, bucketSprite(), this.bucket.x, this.bucket.y, true);
    this.syncHits();
  }

  private drawCupAt(g: Ctx, cup: Cup, now: number) {
    const p = this.cupPos(cup);
    const hop = Math.max(0, 4 - Math.floor((now - cup.at) / 40));
    if (this.selected === cup) {
      fill(g, p.x - 9, p.y - 24 - hop, 18, 26, 'rgba(242,194,48,0.45)');
    }
    drawCup(g, p.x, p.y - hop, cup);
  }

  private drawPress(g: Ctx, now: number) {
    const p = this.press;
    const w = this.wheelAt;
    // the cane going in: a stalk sticking out of the slot, shorter as it is pressed
    if (this.cane > 0) {
      const len = Math.round(6 + Math.min(1, this.cane / CALDO_CRANK.canePerCup) * 26);
      const cx = Math.round(p.x + p.w / 2) - 2;
      const shake = this.cranking ? Math.floor(now / 50) % 2 : 0;
      for (let y = 0; y < len; y++) {
        const yy = p.y + 2 - y;
        fill(g, cx - 1 + shake, yy, 1, 1, C.ink);
        fill(g, cx + shake, yy, 1, 1, (y + 2) % 7 === 0 ? '#c8a040' : '#c8e09a');
        fill(g, cx + 1 + shake, yy, 2, 1, (y + 2) % 7 === 0 ? '#a07a20' : '#6fa83a');
        fill(g, cx + 3 + shake, yy, 1, 1, C.ink);
      }
      fill(g, cx - 1 + shake, p.y + 2 - len, 5, 1, C.ink);
      fill(g, cx + shake, p.y + 3 - len, 3, 1, '#8fd18a');
    }
    blit(g, pressSprite(p.w, p.h), p.x, p.y);
    // a window into the rollers
    const rx = p.x + Math.round(p.w * 0.3);
    fill(g, rx, p.y + 12, Math.round(p.w * 0.4), 8, C.ink);
    for (let k = 0; k < 4; k++) {
      const off = Math.floor(this.wheel * 2 + k * 3) % 4;
      fill(g, rx + 1 + k * Math.round(p.w * 0.1), p.y + 13 + off, 3, 2, C.steel);
    }
    // the spout
    fill(g, this.spoutAt.x - 8, this.spoutAt.y - 2, 14, 4, C.ink);
    fill(g, this.spoutAt.x - 7, this.spoutAt.y - 1, 12, 2, C.steelHi);
    fill(g, this.spoutAt.x + 3, this.spoutAt.y + 1, 3, 2, C.steelMid);
    // the flywheel: a rim with spokes that turn, the crank handle on the rim
    disc(g, w.x, w.y, w.r + 1, C.ink);
    disc(g, w.x, w.y, w.r, '#c44536');
    disc(g, w.x, w.y, w.r - 2, '#e8e0d0');
    disc(g, w.x, w.y, w.r - 3, '#d0c4ae');
    for (let s = 0; s < 4; s++) {
      const a = this.wheel + (s * Math.PI) / 2;
      for (let k = 2; k < w.r - 2; k++) fill(g, w.x + Math.cos(a) * k, w.y + Math.sin(a) * k, 2, 2, '#a82b2d');
    }
    disc(g, w.x, w.y, 3, C.ink);
    disc(g, w.x, w.y, 2, C.gold);
    const ha = this.wheel;
    const hx = Math.round(w.x + Math.cos(ha) * (w.r - 2));
    const hy = Math.round(w.y + Math.sin(ha) * (w.r - 2));
    disc(g, hx, hy, 3, C.ink);
    disc(g, hx, hy, 2, C.woodHi);
    // cane gauge on the body
    const gw = Math.round(p.w * 0.6);
    const gx = p.x + Math.round(p.w * 0.2);
    const gy = p.y + p.h - 10;
    fill(g, gx - 1, gy - 1, gw + 2, 4, C.ink);
    fill(g, gx, gy, gw, 2, '#1f5a32');
    fill(g, gx, gy, Math.round(gw * Math.min(1, this.cane / (CALDO_CRANK.canePerCup * 1.2))), 2, '#c8e09a');
  }

  // ---------------------------------------------------------------- hits

  private syncHits() {
    const st = this.stage;
    st.hit({
      id: 'caldo-cane',
      label: 'Cana · Cane',
      rect: { x: this.crate.x - 16, y: this.crate.y - 20, w: 32, h: 40 },
      tap: () => this.loadCane(),
      drag: () => ({ kind: 'cane', sprite: crateSprite() }),
    });
    st.label('cd-cane', this.crate.x, this.crate.y + 20, 'Cana', 'Cane', this.cane <= 0 ? 'fst-label-go' : '');
    st.hit({
      id: 'caldo-press',
      label: 'Moenda: segure pra moer · Press: hold to crank',
      rect: { x: this.wheelAt.x - this.wheelAt.r - 2, y: this.press.y - 4, w: this.press.x + this.press.w - (this.wheelAt.x - this.wheelAt.r - 2), h: this.press.h + 6 },
      press: (down) => (down ? this.startCrank() : this.stopCrank()),
      tap: () => this.startCrank(true),
      drop: (d) => (d.kind === 'cane' ? this.loadCane() : false),
      accepts: (d) => d.kind === 'cane',
    });
    const pressLabel = this.cane <= 0 ? ['Põe cana', 'Add cane', ''] : !this.spout ? ['Põe um copo', 'Add a cup', ''] : this.cranking ? (caldoFill(this.spout.level) === 'line' ? ['Solta!', 'Let go!', 'fst-label-go'] : this.spout.level > CALDO_CRANK.overAt ? ['Transbordou!', 'Overflowing!', 'fst-label-hot'] : ['Moendo…', 'Pressing…', '']) : ['Segura a roda', 'Hold the wheel', ''];
    st.label('cd-press', this.press.x + this.press.w / 2, this.press.y + this.press.h + 2, pressLabel[0]!, pressLabel[1]!, pressLabel[2]!);
    st.hit({
      id: 'caldo-cups',
      label: 'Copo · Cup',
      rect: { x: this.stack.x - 9, y: this.stack.y - 14, w: 18, h: 28 },
      tap: () => this.newCup(),
    });
    st.label('cd-cups', this.stack.x, this.stack.y + 14, 'Copos', 'Cups', !this.spout ? 'fst-label-go' : '');
    const cupHit = (cup: Cup | null, id: string, at: { x: number; y: number }, data: 'spout' | 0 | 1) => {
      st.hit({
        id,
        label: cup ? `Copo · Cup${cup.flavor ? ` (${CALDO_FLAVOR_LABEL[cup.flavor].pt})` : ''}` : data === 'spout' ? 'Bica · Spout' : 'Bandeja · Tray',
        rect: { x: at.x - 10, y: at.y - 26, w: 20, h: 28 },
        tap: () => {
          if (!cup) {
            if (data === 'spout') this.newCup();
            else if (this.spout) this.park();
            return;
          }
          this.selected = cup;
          this.stage.sfx('tick');
        },
        drag: () => (cup && cup.level > 0.05 ? { kind: 'cup', sprite: cupSprite(cup.flavor, cup.ice, Math.min(1, cup.level)), data } : null),
        drop: (d) => {
          if (d.kind === 'fruit' && cup) return this.flavor(d.data as CaldoFlavor, cup);
          if (d.kind === 'ice' && cup) return this.ice(cup);
          if (d.kind === 'cup' && !cup && data !== 'spout' && d.data === 'spout') return this.park();
          return false;
        },
        accepts: (d) => ((d.kind === 'fruit' || d.kind === 'ice') && !!cup) || (d.kind === 'cup' && !cup && data !== 'spout' && d.data === 'spout'),
        z: 2,
      });
    };
    cupHit(this.spout, 'caldo-spout', this.cupAt, 'spout');
    this.tray.forEach((cup, k) => cupHit(cup, `caldo-tray-${k}`, this.trayAt[k]!, k as 0 | 1));
    const a = this.trayAt[0]!;
    const b = this.trayAt[1]!;
    st.label('cd-tray', (a.x + b.x) / 2, a.y + 4, 'Bandeja', 'Tray', '');
    for (const fr of this.fruits) {
      const lab = CALDO_FLAVOR_LABEL[fr.f];
      st.hit({
        id: `caldo-pump-${fr.f}`,
        label: `${lab.pt} · ${lab.en}`,
        rect: { x: fr.x - 13, y: fr.y - 10, w: 26, h: 26 },
        round: true,
        tap: () => this.flavor(fr.f),
        drag: () => ({ kind: 'fruit', sprite: fruitSprite(fr.f), data: fr.f }),
      });
      st.label(`cd-fruit-${fr.f}`, fr.x, fr.y + 8, lab.pt, lab.en, 'fst-label-tray');
    }
    st.hit({
      id: 'caldo-ice',
      label: 'Gelo · Ice',
      rect: { x: this.bucket.x - 14, y: this.bucket.y - 11, w: 28, h: 24 },
      round: true,
      tap: () => this.ice(),
      drag: () => ({ kind: 'ice', sprite: iceSprite(true) }),
    });
    st.label('cd-ice', this.bucket.x, this.bucket.y + 10, 'Gelo', 'Ice', 'fst-label-tray');
  }
}
