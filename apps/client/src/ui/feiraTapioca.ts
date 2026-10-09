/**
 * Tapioca, the relaxing Feira cart game, on the Feira stage (feiraStage.ts).
 *
 * The server dealt the seed. Orders come from shared `tapiocaOrders(seed)`, so the customers who walk up are the
 * ones the server will score; this view only reports each order's quality and time.
 *
 * Behind the cart: a steel chapa with up to three tapioqueiras (one to start, a second after 3 serves, a third
 * after 6), the goma tub on the left and four filling bowls on the right.
 *
 *   1. Hold a pan: the sieve shakes goma onto it and the white disc grows. Let go when it reaches the rim
 *      (short leaves holes, too long runs over the edge).
 *   2. It sets: wet, then white, then the edges go lacy and gold. Tap to flip inside the ring's green arc
 *      (early tears it, late sticks).
 *   3. Drag a filling onto it (or tap a bowl), tap to fold it, then drag it to the customer (or tap them).
 *
 * A bad spread or flip only caps that order at soft. Nothing ends the run early.
 *
 * needs_br: true (order lines, pops, labels, end card).
 */
import {
  TAPIOCA_COOK,
  TAPIOCA_DURATION_MS,
  TAPIOCA_FILLINGS,
  TAPIOCA_FILLING_LABEL,
  TAPIOCA_FLIP_POP,
  TAPIOCA_PAN_UNLOCK,
  TAPIOCA_SPREAD,
  TAPIOCA_SPREAD_POP,
  TAPIOCA_WRONG,
  tapiocaFlip,
  tapiocaOrders,
  tapiocaPans,
  tapiocaServeQuality,
  tapiocaSpread,
  type FeiraOrderOutcome,
  type FlipVerdict,
  type SpreadVerdict,
  type TapiocaFilling,
  type TapiocaOrder,
} from '@tudobem/shared';
import { stallEndCard, type StallEnd } from './feiraStall';
import {
  C,
  FeiraStage,
  arc,
  blit,
  disc,
  fill,
  inDisc,
  oval,
  paint,
  type Ctx,
  type DragPayload,
  type StageCustomer,
  type StageLayout,
} from './feiraStage';

export type TapiocaEnd = StallEnd;

export interface TapiocaHooks {
  finish: (outcomes: FeiraOrderOutcome[]) => void;
  quit: () => void;
  again: () => void;
}

/** needs_br: true */
const HINT = {
  hold: { pt: 'Segura pra espalhar a goma.', en: 'Hold to spread the batter.' },
  pick: { pt: 'Escolhe o recheio.', en: 'Pick a filling.' },
  none: { pt: 'Nenhuma tapioca pronta.', en: 'No tapioca is ready.' },
  locked: { pt: 'Essa panela abre depois.', en: 'This pan opens later.' },
};

const FILL_INK: Record<TapiocaFilling, { base: string; hi: string; dark: string }> = {
  queijo: { base: '#f2c230', hi: '#fff59a', dark: '#c48a14' },
  coco: { base: '#fff6e6', hi: '#ffffff', dark: '#d8c6a4' },
  chocolate: { base: '#6b3a22', hi: '#a85f46', dark: '#3a1e12' },
  goiabada: { base: '#c44536', hi: '#e07070', dark: '#8a2a22' },
};

/** The cook ring runs a little past the late edge so the stuck side shows too. */
const SPAN = TAPIOCA_COOK.cookMs + TAPIOCA_COOK.lateMs + 900;
const WIN_FROM = (TAPIOCA_COOK.cookMs - TAPIOCA_COOK.earlyMs) / SPAN;
const WIN_TO = (TAPIOCA_COOK.cookMs + TAPIOCA_COOK.lateMs) / SPAN;

type Phase = 'empty' | 'spreading' | 'cooking' | 'flipped' | 'filled' | 'folded';

interface Pan {
  phase: Phase;
  coverage: number;
  spread: SpreadVerdict;
  /** run ms when the goma went down */
  cookAt: number;
  flip: FlipVerdict | null;
  filling: TapiocaFilling | null;
  /** performance.now of the last flip / fold, for the little animations */
  animAt: number;
  /** keyboard: fill to an even disc on its own */
  auto: boolean;
  /** performance.now when the hold started (coverage follows the wall clock, not the frame rate) */
  holdAt: number;
  x: number;
  y: number;
}

const newPan = (): Pan => ({ phase: 'empty', coverage: 0, spread: 'even', cookAt: 0, flip: null, filling: null, animAt: 0, auto: false, holdAt: 0, x: 0, y: 0 });

// ---------------------------------------------------------------- sprites

function bowlSprite(f: TapiocaFilling, big = false): HTMLCanvasElement {
  const ink = FILL_INK[f];
  const w = big ? 26 : 14;
  const hh = big ? 16 : 9;
  const cx = w / 2;
  return paint(`tp-bowl-${f}-${big}`, w, hh, (x, y) => {
    const rimY = big ? 5 : 3;
    const inBowl = y >= rimY && inDisc(x, y * (big ? 1.6 : 1.55), cx, rimY * 1.6, w / 2);
    if (!inBowl) {
      // the heap above the rim
      const heap = (x + 0.5 - cx) ** 2 / ((w / 2 - (big ? 3 : 2)) ** 2) + (y + 0.5 - rimY) ** 2 / ((big ? 4.5 : 2.6) ** 2) <= 1 && y < rimY + 1;
      if (heap) return (x + y) % 4 === 0 ? ink.hi : (x * 3 + y) % 7 === 0 ? ink.dark : ink.base;
      return null;
    }
    if (y === rimY) return x < cx ? '#ffffff' : '#d8d0e0';
    const lit = x < cx - 2;
    return y > hh - 3 ? '#a2a6be' : lit ? '#f8f8f8' : '#c6c8d4';
  });
}

/** The goma tub: a blue bucket heaped with white starch, the sieve leaning on it. */
function tubSprite(): HTMLCanvasElement {
  return paint('tp-tub', 30, 26, (x, y) => {
    // sieve: a ring with mesh, top right
    const sv = inDisc(x, y, 21, 7, 7) && !inDisc(x, y, 21, 7, 5.2);
    if (sv) return x < 20 ? C.woodHi : C.woodLo;
    if (inDisc(x, y, 21, 7, 5.2)) return (x + y) % 2 ? '#a2a6be' : '#e4e6ee';
    if (x >= 27 && x <= 29 && y >= 9 && y <= 13) return C.wood;
    // bucket
    if (y >= 11 && y <= 25 && x >= 2 + (y - 11) * 0.12 && x <= 25 - (y - 11) * 0.12) {
      if (y === 11 || y === 12) return y === 11 ? '#9fd4f2' : C.blue;
      if (y === 18) return C.blueLo;
      return x < 8 ? '#6fb4f0' : x > 20 ? C.blueLo : C.blue;
    }
    // heap of goma
    if (y >= 6 && y <= 11 && inDisc(x, y * 1.5, 13.5, 16.5, 11.5)) return (x * 5 + y * 3) % 9 === 0 ? '#e0dcd2' : '#fffdf8';
    return null;
  });
}

/** One tapioqueira at radius r: an iron disc with a lit rim and two little ears. */
function panSprite(r: number): HTMLCanvasElement {
  const d = r * 2 + 6;
  const c = d / 2;
  return paint(`tp-pan-${r}`, d, d, (x, y) => {
    const ear = (Math.abs(y + 0.5 - c) <= 1.5 && (x <= 2 || x >= d - 3));
    if (ear) return x <= 2 ? C.steelMid : C.steelLo;
    if (!inDisc(x, y, c, c, r)) return null;
    const dx = x + 0.5 - c;
    const dy = y + 0.5 - c;
    const rim = !inDisc(x, y, c, c, r - 2);
    if (rim) return dx + dy < -r * 0.6 ? C.steelHi : dx + dy > r * 0.6 ? C.steelDk : C.steelMid;
    const inner = !inDisc(x, y, c, c, r - 3);
    if (inner) return C.iron;
    const glint = dx < -r * 0.35 && dy < -r * 0.35 && (x + y) % 5 === 0;
    return glint ? '#565972' : '#43435c';
  });
}

/** The folded tapioca: a half-moon of lacy white with the filling peeking out. */
function foldedSprite(f: TapiocaFilling, r: number, flip: FlipVerdict): HTMLCanvasElement {
  const ink = FILL_INK[f];
  const w = r * 2;
  const hh = r + 3;
  return paint(`tp-fold-${f}-${r}-${flip}`, w, hh, (x, y) => {
    const dx = x + 0.5 - r;
    const dy = y + 0.5 - 3;
    if (dy < 0) {
      // filling peeking over the fold
      if (y >= 1 && Math.abs(dx) < r - 3 && (x + y) % 3 !== 0) return y === 1 ? ink.hi : ink.base;
      return null;
    }
    if (dx * dx + dy * dy > r * r) return null;
    const edge = dx * dx + dy * dy > (r - 1.6) ** 2;
    if (flip === 'late' && (x * 3 + y * 5) % 7 === 0) return '#8a4b24';
    if (flip === 'early' && ((x + y * 2) % 9 === 0 || (x - y) % 11 === 0)) return C.steelLo;
    if (edge) return '#e2b340';
    if (y <= 1) return '#f0d090';
    return (x * 3 + y * 7) % 13 === 0 ? '#f2c230' : (x + y) % 5 === 0 ? '#fff6d8' : '#fffdf8';
  });
}

/** A folded tapioca on a paper napkin: what you carry to a customer, and the bubble's ticket icon. */
function carrySprite(f: TapiocaFilling, flip: FlipVerdict = 'perfect'): HTMLCanvasElement {
  const fold = foldedSprite(f, 9, flip);
  const px = fold.getContext('2d')!.getImageData(0, 0, fold.width, fold.height).data;
  return paint(`tp-carry-${f}-${flip}`, 22, 16, (x, y) => {
    const fx = x - 2;
    const fy = y - 2;
    if (fx >= 0 && fy >= 0 && fx < fold.width && fy < fold.height) {
      const i = (fy * fold.width + fx) * 4;
      if (px[i + 3]) return `#${[px[i]!, px[i + 1]!, px[i + 2]!].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    }
    const napkin = y >= 8 && x >= 1 && x <= 20 && y <= 15 && !(y === 15 && (x === 1 || x === 20));
    if (napkin) return (x + y) % 6 === 0 ? '#e8e0f0' : '#ffffff';
    return null;
  });
}

// ---------------------------------------------------------------- the view

export class TapiocaView {
  private stage: FeiraStage<TapiocaOrder>;
  private pans: Pan[] = [newPan(), newPan(), newPan()];
  private selected: TapiocaFilling | null = null;
  private served = 0;
  private pressing = -1;
  private r = 19;
  private bowls: { f: TapiocaFilling; x: number; y: number }[] = [];
  private tub = { x: 0, y: 0 };
  private chapa = { x: 0, y: 0, w: 0, h: 0 };
  private top: HTMLCanvasElement | null = null;
  private topKey = '';
  private steamAt = 0;

  constructor(
    seed: number,
    private readonly hooks: TapiocaHooks,
  ) {
    this.stage = new FeiraStage<TapiocaOrder>({
      game: 'tapioca',
      prefix: 'tapioca',
      title: 'Tapioca',
      orders: tapiocaOrders(seed),
      durationMs: TAPIOCA_DURATION_MS,
      palette: { awningA: '#d8432f', awningB: '#fffdf6', plaque: '#c0392b' },
      icons: (o) => [carrySprite(o.filling), bowlSprite(o.filling, true)],
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

  showEnd(end: TapiocaEnd) {
    this.stage.showEnd(stallEndCard({ game: 'tapioca', prefix: 'tapioca', cls: 'tp', title: 'Tapioca', end, again: () => this.hooks.again(), quit: () => this.hooks.quit() }));
  }

  // ---------------------------------------------------------------- layout

  private layout(L: StageLayout) {
    const { W, work, portrait } = L;
    this.r = portrait ? Math.min(26, Math.floor((W - 24) / 6.6)) : Math.max(16, Math.min(22, Math.floor(work.h / 4.6)));
    const r = this.r;
    const gap = r * 2 + (portrait ? 8 : 10);
    if (portrait) {
      // chapa, then the goma and the bowls under it, the pair centred in the tall work top
      const content = r * 2 + 30 + 34 + 30;
      const top = work.y + Math.max(8, Math.round((work.h - content) * 0.4));
      this.chapa = { x: 4, y: top, w: W - 8, h: r * 2 + 30 };
      const cy = this.chapa.y + 12 + r;
      this.pans.forEach((p, i) => {
        p.x = Math.round(W / 2 + (i - 1) * gap);
        p.y = cy;
      });
      const rowY = this.chapa.y + this.chapa.h + 34;
      this.tub = { x: 26, y: rowY };
      const bw = (W - 56) / 4;
      this.bowls = TAPIOCA_FILLINGS.map((f, i) => ({ f, x: Math.round(56 + bw * i + bw / 2 - 4), y: rowY + 4 }));
    } else {
      const cw = gap * 3 + 14;
      this.chapa = { x: Math.round(W / 2 - cw / 2), y: work.y + 8, w: cw, h: r * 2 + 30 };
      const cy = this.chapa.y + 12 + r;
      this.pans.forEach((p, i) => {
        p.x = Math.round(W / 2 + (i - 1) * gap);
        p.y = cy;
      });
      this.tub = { x: Math.round(this.chapa.x / 2), y: cy - 2 };
      const right = this.chapa.x + this.chapa.w;
      const colW = (W - right) / 2;
      this.bowls = TAPIOCA_FILLINGS.map((f, i) => ({
        f,
        x: Math.round(right + colW * (i % 2) + colW / 2),
        y: Math.round(cy - 16 + Math.floor(i / 2) * 32),
      }));
    }
    this.top = null;
  }

  // ---------------------------------------------------------------- rules

  private open(): number {
    return tapiocaPans(this.served);
  }

  private update(_dt: number, t: number) {
    for (const p of this.pans) {
      if (p.phase !== 'spreading') continue;
      p.coverage = this.coverage(p);
      if (p.auto && p.coverage >= 1) this.setDown(this.pans.indexOf(p));
      // goma dust falling from the sieve
      if (Math.random() < 0.8) {
        const a = Math.random() * Math.PI * 2;
        const rr = Math.random() * this.r * 0.8;
        this.stage.puff(p.x + Math.cos(a) * rr, p.y - 12 + Math.sin(a) * rr * 0.5, '#fffdf8', { vy: 26, vx: 0, life: 0.35 });
      }
    }
    // steam over the cooking pans
    if (t - this.steamAt > 160) {
      this.steamAt = t;
      for (const p of this.pans) {
        if (p.phase === 'cooking' || p.phase === 'flipped' || p.phase === 'filled') {
          this.stage.puff(p.x + (Math.random() - 0.5) * this.r, p.y - 4, Math.random() < 0.5 ? '#ffffff' : '#e4e6ee', { vy: -14, life: 1.1 });
        }
        if (p.phase === 'cooking' && t - p.cookAt > TAPIOCA_COOK.cookMs + TAPIOCA_COOK.lateMs) {
          this.stage.puff(p.x + (Math.random() - 0.5) * this.r, p.y - 6, '#8a8296', { vy: -18, life: 1.2, size: 2 });
        }
      }
    }
  }

  /** Pointer down on a pan (or a key): the next step for that pan. */
  private panDown(i: number, keyboard = false) {
    const p = this.pans[i]!;
    if (i >= this.open()) {
      this.stage.pop(HINT.locked);
      return;
    }
    if (p.phase === 'empty') {
      Object.assign(p, newPan(), { x: p.x, y: p.y, phase: 'spreading', auto: keyboard, holdAt: performance.now() });
      this.pressing = keyboard ? -1 : i;
      this.stage.sfx('grab');
      return;
    }
    if (p.phase === 'cooking') {
      p.flip = tapiocaFlip(this.stage.t - p.cookAt);
      p.phase = 'flipped';
      p.animAt = performance.now();
      const good = p.flip === 'perfect';
      this.stage.pop(TAPIOCA_FLIP_POP[p.flip], good ? 'good' : 'bad');
      this.stage.sfx(good ? 'ready' : 'burnt');
      this.stage.burst(p.x, p.y, good ? 12 : 6, good ? ['#ffffff', '#fff59a', '#f0d090'] : ['#8a8296', '#d8d0e0'], { up: 30, spread: 30, life: 0.6 });
      if (!good) this.stage.shake(1, 160);
      return;
    }
    if (p.phase === 'flipped') {
      if (!this.selected) {
        this.stage.pop(HINT.pick);
        return;
      }
      this.fill(i, this.selected);
      return;
    }
    if (p.phase === 'filled') {
      p.phase = 'folded';
      p.animAt = performance.now();
      this.stage.sfx('paper');
    }
  }

  private panUp(i: number) {
    if (this.pressing !== i) return;
    this.pressing = -1;
    const p = this.pans[i]!;
    if (p.phase !== 'spreading') return;
    this.setDown(i);
  }

  private coverage(p: Pan): number {
    const rate = TAPIOCA_SPREAD.fillPerSec * (p.auto ? 1.15 : 1);
    return Math.min(TAPIOCA_SPREAD.max, ((performance.now() - p.holdAt) / 1000) * rate);
  }

  /** The goma is down: judge the spread and start the cook clock. */
  private setDown(i: number) {
    const p = this.pans[i]!;
    if (p.phase !== 'spreading') return;
    p.coverage = p.auto ? Math.min(1, this.coverage(p)) : this.coverage(p);
    if (p.coverage < 0.12) {
      // a quick tap: nothing went down, teach the hold
      p.phase = 'empty';
      p.coverage = 0;
      this.stage.pop(HINT.hold);
      return;
    }
    p.spread = tapiocaSpread(p.coverage);
    p.phase = 'cooking';
    p.cookAt = this.stage.t;
    p.auto = false;
    this.stage.sfx('sizzle');
    if (p.spread !== 'even') this.stage.pop(TAPIOCA_SPREAD_POP[p.spread], 'bad');
  }

  private fill(i: number, f: TapiocaFilling): boolean {
    const p = this.pans[i];
    if (!p || p.phase !== 'flipped') return false;
    p.filling = f;
    p.phase = 'filled';
    p.animAt = performance.now();
    this.stage.sfx('grab');
    this.stage.burst(p.x, p.y, 6, [FILL_INK[f].base, FILL_INK[f].hi], { up: 10, spread: 14, life: 0.4 });
    return true;
  }

  private tapBowl(f: TapiocaFilling) {
    if (this.stage.over) return;
    // a pan waiting for a filling takes the bowl you tap
    const waiting = this.pans.findIndex((p, i) => i < this.open() && p.phase === 'flipped');
    if (waiting >= 0) {
      this.selected = f;
      this.fill(waiting, f);
      return;
    }
    this.selected = this.selected === f ? null : f;
    this.stage.sfx('tick');
  }

  private serveTo(c: StageCustomer<TapiocaOrder>, payload: DragPayload | null) {
    if (!this.stage.servable(c)) return;
    let i = -1;
    if (payload?.kind === 'tapioca') i = payload.data as number;
    else if (!payload) {
      const ready = this.pans.map((p, k) => ({ p, k })).filter((x) => x.p.phase === 'folded');
      i = (ready.find((x) => x.p.filling === c.order.filling) ?? ready[0])?.k ?? -1;
    }
    const p = i >= 0 ? this.pans[i] : undefined;
    if (!p || p.phase !== 'folded' || !p.filling || !p.flip) {
      if (!payload) this.stage.pop(HINT.none);
      return;
    }
    const fillingOk = p.filling === c.order.filling;
    const quality = tapiocaServeQuality(p.flip, fillingOk, this.stage.patience(c), p.spread);
    this.stage.record(c, quality, fillingOk ? undefined : TAPIOCA_WRONG);
    if (!fillingOk) this.stage.pop(TAPIOCA_WRONG, 'bad');
    if (quality !== 'miss') this.served += 1;
    const unlocked = this.served === TAPIOCA_PAN_UNLOCK[1] || this.served === TAPIOCA_PAN_UNLOCK[2];
    if (unlocked && quality !== 'miss') {
      this.stage.pop({ pt: 'Mais uma panela!', en: 'Another pan!' }, 'good');
      this.stage.sfx('chime');
    }
    Object.assign(p, newPan(), { x: p.x, y: p.y });
  }

  // ---------------------------------------------------------------- drawing

  private workTop(): HTMLCanvasElement {
    const L = this.stage.L;
    const key = `${L.W}x${L.H}:${L.work.y}:${this.r}`;
    if (this.top && this.topKey === key) return this.top;
    const cv = document.createElement('canvas');
    cv.width = L.W;
    cv.height = L.H;
    const g = cv.getContext('2d')!;
    const { work, W } = L;
    // a warm wooden counter top, boards running left to right
    fill(g, 0, work.y, W, work.h, '#c99561');
    for (let y = work.y; y < work.y + work.h; y += 7) {
      fill(g, 0, y, W, 1, '#a9764f');
      for (let x = ((y / 7) % 3) * 23; x < W; x += 61) fill(g, x, y + 1, 1, 6, '#b5835a');
      for (let x = 7 + (y % 11); x < W; x += 37) fill(g, x, y + 3, 3, 1, '#d8a670');
    }
    // the chapa: dark steel with a bright front lip and the burner glow underneath
    const c = this.chapa;
    fill(g, c.x - 2, c.y - 2, c.w + 4, c.h + 4, C.ink);
    fill(g, c.x, c.y, c.w, c.h, '#4a4c63');
    fill(g, c.x, c.y, c.w, 2, '#6c6e85');
    fill(g, c.x, c.y + c.h - 7, c.w, 7, C.steelMid);
    fill(g, c.x, c.y + c.h - 7, c.w, 1, C.steelHi);
    fill(g, c.x, c.y + c.h - 1, c.w, 1, C.steelLo);
    for (let x = c.x + 10; x < c.x + c.w - 6; x += 16) {
      disc(g, x, c.y + c.h - 4, 2, C.ink);
      disc(g, x, c.y + c.h - 4, 1, x % 3 ? '#e63f38' : C.steel);
    }
    g.fillStyle = '#565972';
    for (let x = c.x + 3; x < c.x + c.w - 3; x += 5) g.fillRect(x, c.y + 4 + ((x * 7) % 3), 1, 1);
    this.top = cv;
    this.topKey = key;
    return cv;
  }

  private draw(g: Ctx, t: number, now: number) {
    const st = this.stage;
    g.drawImage(this.workTop(), 0, 0);
    // burner glow pulses under the plate
    const c = this.chapa;
    g.globalAlpha = 0.18 + Math.sin(now / 300) * 0.06;
    fill(g, c.x + 4, c.y + c.h - 9, c.w - 8, 2, '#ff7a2c');
    g.globalAlpha = 1;
    const open = this.open();
    const pan = panSprite(this.r);
    this.pans.forEach((p, i) => {
      blit(g, pan, p.x, p.y, true);
      if (i >= open) this.drawLocked(g, p);
      else this.drawPan(g, p, i, t, now);
    });
    // goma tub and bowls
    blit(g, tubSprite(), this.tub.x, this.tub.y, true);
    for (const b of this.bowls) {
      const on = this.selected === b.f;
      if (on) {
        fill(g, b.x - 15, b.y - 11, 30, 23, C.gold);
        fill(g, b.x - 14, b.y - 10, 28, 21, '#fff59a');
      }
      blit(g, bowlSprite(b.f, true), b.x, b.y - 1 + (on ? -1 : 0), true);
    }
    this.syncHits();
  }

  private drawLocked(g: Ctx, p: Pan) {
    // a wooden cover with a padlock: it opens after a few serves
    disc(g, p.x, p.y, this.r - 2, C.woodLo);
    disc(g, p.x, p.y, this.r - 4, C.wood);
    for (let k = -this.r + 6; k < this.r - 4; k += 5) fill(g, p.x + k, p.y - this.r + 6, 1, this.r * 2 - 12, C.woodMid);
    fill(g, p.x - 4, p.y - 2, 9, 7, C.gold);
    fill(g, p.x - 4, p.y - 2, 9, 1, C.goldHi);
    fill(g, p.x - 3, p.y - 6, 1, 4, C.steel);
    fill(g, p.x + 3, p.y - 6, 1, 4, C.steel);
    fill(g, p.x - 3, p.y - 7, 7, 1, C.steel);
    fill(g, p.x, p.y + 1, 1, 2, C.ink);
  }

  private drawPan(g: Ctx, p: Pan, i: number, t: number, now: number) {
    const r = this.r;
    const rin = r - 3;
    if (p.phase === 'empty') {
      // heat shimmer over an empty pan
      if (Math.floor(now / 400 + i) % 3 === 0) fill(g, p.x - 3, p.y - 2, 6, 1, '#565972');
      return;
    }
    if (p.phase === 'spreading') {
      // the target ring, the growing disc, the sieve shaking over it
      for (let a = 0; a < 40; a++) {
        if (a % 2) continue;
        const ang = (a / 40) * Math.PI * 2;
        g.fillStyle = '#fff59a';
        g.fillRect(Math.round(p.x + Math.cos(ang) * (rin - 1)), Math.round(p.y + Math.sin(ang) * (rin - 1)), 1, 1);
      }
      const rr = Math.max(1, rin * Math.sqrt(p.coverage));
      disc(g, p.x, p.y, rr, p.coverage > TAPIOCA_SPREAD.evenTo ? '#f6eedd' : '#f4f1ea');
      for (let k = 0; k < 7; k++) {
        const a = (k * 2.4 + now / 300) % (Math.PI * 2);
        const d = (k / 7) * rr;
        g.fillStyle = '#e4ddd0';
        g.fillRect(Math.round(p.x + Math.cos(a) * d), Math.round(p.y + Math.sin(a) * d), 1, 1);
      }
      this.drawSieve(g, p.x + Math.round(Math.sin(now / 45) * 2), p.y - 13);
      const verdict = tapiocaSpread(p.coverage);
      this.stage.label(`tp-${i}`, p.x, p.y + r + 2, verdict === 'thin' ? 'Segura…' : verdict === 'even' ? 'Solta!' : 'Passou!', verdict === 'thin' ? 'Hold…' : verdict === 'even' ? 'Let go!' : 'Too much!', verdict === 'even' ? 'fst-label-go' : verdict === 'thick' ? 'fst-label-hot' : '');
      return;
    }
    if (p.phase === 'cooking') {
      const age = t - p.cookAt;
      const k = age / TAPIOCA_COOK.cookMs;
      this.drawDisc(g, p, k);
      // the cook ring: grey track, green window, white progress
      arc(g, p.x, p.y, r + 2, 0, 1, '#5a4a5e');
      arc(g, p.x, p.y, r + 2, WIN_FROM, WIN_TO, '#5fc76a', 2);
      const pr = Math.min(1, age / SPAN);
      const inWin = pr >= WIN_FROM && pr <= WIN_TO;
      arc(g, p.x, p.y, r + 3, 0, pr, inWin ? '#ffffff' : pr > WIN_TO ? C.red : C.gold, 2);
      if (inWin && Math.floor(now / 160) % 2) this.sparkle(g, p.x + r - 4, p.y - r + 2);
      const late = pr > WIN_TO;
      this.stage.label(`tp-${i}`, p.x, p.y + r + 4, late ? 'Grudando!' : inWin ? 'Vira!' : 'Cozinhando', late ? 'Sticking!' : inWin ? 'Flip!' : 'Cooking', late ? 'fst-label-hot' : inWin ? 'fst-label-go' : '');
      return;
    }
    // flipped, filled, folded: the flip / fold play as short squash animations
    const since = now - p.animAt;
    if (p.phase === 'folded') {
      const f = foldedSprite(p.filling!, rin, p.flip ?? 'perfect');
      const k = Math.min(1, since / 180);
      const lift = Math.round(Math.sin(k * Math.PI) * 3);
      blit(g, f, p.x, p.y - lift + 3, true);
      this.stage.label(`tp-${i}`, p.x, p.y + r + 4, 'Pronta!', 'Ready! Serve it', 'fst-label-go');
      return;
    }
    let sy = 1;
    let lift = 0;
    if (p.phase === 'flipped' && since < 320) {
      const k = since / 320;
      sy = Math.abs(Math.cos(k * Math.PI));
      lift = Math.round(Math.sin(k * Math.PI) * 10);
    }
    this.drawFlipped(g, p, sy, lift);
    if (p.phase === 'filled' && p.filling) {
      const ink = FILL_INK[p.filling];
      for (let y = -4; y <= 4; y++) {
        for (let x = -rin + 4; x <= rin - 4; x++) {
          if (x * x / ((rin - 4) ** 2) + (y * y) / 16 > 1) continue;
          g.fillStyle = (x + y) % 4 === 0 ? ink.hi : (x * 3 + y) % 7 === 0 ? ink.dark : ink.base;
          g.fillRect(p.x + x, p.y + y - 2, 1, 1);
        }
      }
      this.stage.label(`tp-${i}`, p.x, p.y + r + 4, 'Dobra', 'Tap to fold', 'fst-label-go');
    } else {
      this.stage.label(`tp-${i}`, p.x, p.y + r + 4, 'Recheio', 'Add a filling', '');
    }
  }

  /** The goma disc while it cooks: wet, set, lacy, then browning. */
  private drawDisc(g: Ctx, p: Pan, k: number) {
    const rin = this.r - 3;
    const rr = Math.min(this.r - 1, rin * Math.sqrt(p.coverage));
    const wet = k < 0.45;
    const base = wet ? '#ece8df' : '#fffdf8';
    disc(g, p.x, p.y, rr, base);
    if (p.coverage > TAPIOCA_SPREAD.evenTo) {
      // goma over the rim burns on the steel
      for (let a = 0; a < 24; a++) {
        const ang = (a / 24) * Math.PI * 2;
        g.fillStyle = a % 3 ? '#c8a878' : '#8a6a40';
        g.fillRect(Math.round(p.x + Math.cos(ang) * rr), Math.round(p.y + Math.sin(ang) * rr), 1, 1);
      }
    }
    if (p.spread === 'thin') {
      // holes where the sieve did not reach
      for (const [hx, hy] of [[-0.45, -0.2], [0.3, 0.35], [0.1, -0.5], [-0.2, 0.5]] as const) disc(g, p.x + hx * rr, p.y + hy * rr, 2, '#43435c');
    }
    if (k > 0.55) {
      // lace: a golden edge that creeps inward
      const lace = Math.min(1, (k - 0.55) / 0.5);
      for (let a = 0; a < 60; a++) {
        const ang = (a / 60) * Math.PI * 2;
        const d = rr - 1 - (a % 3 === 0 ? lace * 2 : 0);
        g.fillStyle = k > 1.25 ? '#8a5a2c' : '#e2b340';
        g.fillRect(Math.round(p.x + Math.cos(ang) * d), Math.round(p.y + Math.sin(ang) * d), 1, 1);
      }
    }
    if (!wet && k < 1.3 && Math.random() < 0.08) {
      // a bubble rises and pops
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * rr * 0.7;
      this.stage.puff(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, '#ffffff', { vy: -6, life: 0.3 });
    }
    if (k > 1.25) {
      // past the window: brown patches spread
      const burn = Math.min(1, (k - 1.25) / 0.6);
      for (let n = 0; n < Math.floor(burn * 18); n++) {
        const ang = n * 2.39;
        const d = ((n * 7) % 10) / 10 * rr * 0.85;
        disc(g, p.x + Math.cos(ang) * d, p.y + Math.sin(ang) * d, 1.5, n % 2 ? '#8a5a2c' : '#6b4c2c');
      }
    }
  }

  /** The flipped side: golden lace on a clean flip, torn on an early one, brown and stuck on a late one. */
  private drawFlipped(g: Ctx, p: Pan, sy: number, lift: number) {
    const rin = this.r - 3;
    const rr = Math.min(this.r - 1, rin * Math.sqrt(p.coverage));
    const ry = Math.max(1, rr * sy);
    const cy = p.y - lift;
    if (lift) oval(g, p.x, p.y + 1, rr * 0.8, rr * 0.3, 'rgba(42,34,51,0.35)');
    oval(g, p.x, cy, rr, ry, '#fffdf8');
    if (sy < 0.35) return;
    for (let y = -Math.floor(ry); y <= ry; y++) {
      for (let x = -Math.floor(rr); x <= rr; x++) {
        if ((x * x) / (rr * rr) + (y * y) / (ry * ry) > 1) continue;
        const n = (x * 7 + y * 13 + 101) % 17;
        let c: string | null = null;
        if (p.flip === 'perfect') c = n === 0 || n === 9 ? '#f2c230' : n === 4 ? '#f0d090' : null;
        else if (p.flip === 'late') c = n < 4 ? '#8a5a2c' : n < 6 ? '#6b4c2c' : null;
        else c = (x - y) % 7 === 0 && Math.abs(x) < rr - 2 ? '#43435c' : n === 3 ? '#f0d090' : null;
        if (c) {
          g.fillStyle = c;
          g.fillRect(p.x + x, cy + y, 1, 1);
        }
      }
    }
    // a golden ring on the edge
    for (let a = 0; a < 56; a++) {
      const ang = (a / 56) * Math.PI * 2;
      g.fillStyle = p.flip === 'late' ? '#6b4c2c' : '#e2b340';
      g.fillRect(Math.round(p.x + Math.cos(ang) * rr), Math.round(cy + Math.sin(ang) * ry), 1, 1);
    }
  }

  private drawSieve(g: Ctx, x: number, y: number) {
    disc(g, x, y, 8, C.woodLo);
    disc(g, x, y, 7, C.woodHi);
    disc(g, x, y, 6, '#c6c8d4');
    for (let k = -5; k <= 5; k += 2) {
      fill(g, x + k, y - 5, 1, 11, '#a2a6be');
      fill(g, x - 5, y + k, 11, 1, '#a2a6be');
    }
    fill(g, x + 7, y - 1, 7, 3, C.wood);
    fill(g, x + 7, y - 1, 7, 1, C.woodHi);
  }

  private sparkle(g: Ctx, x: number, y: number) {
    fill(g, x, y - 2, 1, 5, '#ffffff');
    fill(g, x - 2, y, 5, 1, '#ffffff');
    fill(g, x, y, 1, 1, C.gold);
  }

  // ---------------------------------------------------------------- hits

  private syncHits() {
    const st = this.stage;
    const r = this.r;
    const open = this.open();
    this.pans.forEach((p, i) => {
      const lab = i >= open ? 'Panela fechada · Locked pan'
        : p.phase === 'empty' ? 'Espalhar a goma (segure) · Spread the batter (hold)'
          : p.phase === 'cooking' || p.phase === 'spreading' ? 'Virar · Flip'
            : p.phase === 'flipped' ? 'Pôr o recheio · Add the filling'
              : p.phase === 'filled' ? 'Dobrar · Fold'
                : 'Tapioca pronta · Ready tapioca';
      if (i >= open) st.dropLabel(`tp-${i}`);
      else if (p.phase === 'empty') st.label(`tp-${i}`, p.x, p.y + r + 4, 'Segura', 'Hold to spread', '');
      st.hit({
        id: `tapioca-pan-${i}`,
        label: lab,
        rect: { x: p.x - r - 2, y: p.y - r - 2, w: r * 2 + 4, h: r * 2 + 4 },
        round: true,
        press: (down) => (down ? this.panDown(i) : this.panUp(i)),
        tap: () => this.panDown(i, true),
        drag: () => (p.phase === 'folded' && p.filling ? { kind: 'tapioca', sprite: carrySprite(p.filling, p.flip ?? 'perfect'), data: i } : null),
        drop: (d) => d.kind === 'filling' && this.fill(i, d.data as TapiocaFilling),
        accepts: (d) => d.kind === 'filling' && p.phase === 'flipped',
      });
    });
    for (const b of this.bowls) {
      const lab = TAPIOCA_FILLING_LABEL[b.f];
      st.hit({
        id: `tapioca-bowl-${b.f}`,
        label: `${lab.pt} · ${lab.en}`,
        rect: { x: b.x - 15, y: b.y - 11, w: 30, h: 24 },
        round: true,
        tap: () => this.tapBowl(b.f),
        drag: () => ({ kind: 'filling', sprite: bowlSprite(b.f), data: b.f }),
      });
      st.label(`tpb-${b.f}`, b.x, b.y + 11, lab.pt, lab.en, this.selected === b.f ? 'fst-label-go' : '');
    }
    st.label('tp-tub', this.tub.x, this.tub.y + 14, 'Goma', 'Batter', '');
  }
}
