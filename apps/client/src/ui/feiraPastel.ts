/**
 * Pastel, the made-to-order Feira cart game, on the Feira stage (feiraStage.ts).
 *
 * The server dealt the seed. Orders come from shared `pastelOrders(seed)`, so the customers who walk up are the
 * ones the server will score; this view only reports each order's quality and time.
 *
 * Behind the cart: the stack of massa, a floured board, the fork, a vitrine of filling trays, a steel fryer
 * with two places in the oil (a third after 4 serves), the draining rack and a bin.
 *
 *   1. Tap the massa: a sheet of dough lands on the board. Tap (or drag) the fillings onto it: two for a combo.
 *   2. Tap the fork: the sheet folds over and the fork crimps the edges.
 *   3. Drag it into the oil (or tap an empty place). It puffs and blisters: raw, golden, dark, black, a charcoal
 *      brick, then fire. Tap it while it is golden: the skimmer lifts it onto the rack. Tap a fire to put it out.
 *   4. Drag it from the rack to the customer (or tap them).
 *
 * Burnt is a soft fail and a wrong filling is a miss; nothing ends the run early.
 *
 * needs_br: true (order lines, pops, labels, end card).
 */
import {
  PASTEL_DURATION_MS,
  PASTEL_PARTS,
  PASTEL_PART_LABEL,
  PASTEL_POP,
  PASTEL_RACK,
  PASTEL_RECIPE,
  pastelDoneness,
  pastelFromParts,
  pastelFry,
  pastelOrders,
  pastelServeQuality,
  pastelSlots,
  type FeiraOrderOutcome,
  type PastelDoneness,
  type PastelFilling,
  type PastelOrder,
  type PastelPart,
} from '@tudobem/shared';
import { stallEndCard, type StallEnd } from './feiraStall';
import { C, FeiraStage, blit, fill, inEllipse, paint, type Ctx, type DragPayload, type StageCustomer, type StageLayout } from './feiraStage';

export type PastelEnd = StallEnd;

export interface PastelHooks {
  finish: (outcomes: FeiraOrderOutcome[]) => void;
  quit: () => void;
  again: () => void;
}

/** needs_br: true */
const HINT = {
  board: { pt: 'A tábua está ocupada.', en: 'The board is busy.' },
  two: { pt: 'Só cabem dois recheios.', en: 'Two fillings at most.' },
  empty: { pt: 'Põe o recheio primeiro.', en: 'Add a filling first.' },
  none: { pt: 'Nenhum pastel no escorredor.', en: 'No pastel on the rack.' },
  full: { pt: 'Não tem lugar no óleo.', en: 'No room in the oil.' },
  locked: { pt: 'Esse lugar abre depois.', en: 'This spot opens later.' },
  drag: { pt: 'Ninguém pediu esse. Arrasta até o freguês.', en: 'Nobody ordered that one. Drag it to a customer.' },
};

const FILL_INK: Record<PastelPart, { base: string; hi: string; lo: string }> = {
  carne: { base: '#8a3a22', hi: '#c06a3e', lo: '#5a2414' },
  queijo: { base: '#f2c230', hi: '#fff59a', lo: '#c48a14' },
  pizza: { base: '#e63f38', hi: '#ffd04a', lo: '#a82b2d' },
  calabresa: { base: '#cb2a2a', hi: '#f07a5a', lo: '#7a1a1a' },
  palmito: { base: '#f0e2b8', hi: '#ffffff', lo: '#c8b47e' },
  frango: { base: '#e8b56a', hi: '#fff0b8', lo: '#b07c3a' },
  camarao: { base: '#ff8a6a', hi: '#ffd2b8', lo: '#d0503a' },
  catupiry: { base: '#fff6e6', hi: '#ffffff', lo: '#e0d4b8' },
  goiabada: { base: '#b8323a', hi: '#e06a6a', lo: '#7a1a24' },
  banana: { base: '#f6d860', hi: '#fff8b0', lo: '#c8a030' },
  canela: { base: '#8a5a2c', hi: '#b8844a', lo: '#5a3818' },
};

/** Dough by doneness: base, light blister, shade. */
const CRUST: Record<PastelDoneness | 'folded', { base: string; hi: string; lo: string }> = {
  folded: { base: '#f6e6b4', hi: '#fff8dc', lo: '#d8c08a' },
  raw: { base: '#f3dc9c', hi: '#fff3c4', lo: '#d6b46e' },
  golden: { base: '#eba73a', hi: '#ffd47a', lo: '#b8741c' },
  dark: { base: '#a8622a', hi: '#d08a44', lo: '#6b3a16' },
  black: { base: '#3a2a26', hi: '#5a4440', lo: '#1a120c' },
  block: { base: '#2a2233', hi: '#565972', lo: '#1a120c' },
  fire: { base: '#2a2233', hi: '#565972', lo: '#1a120c' },
};

const PW = 30;
const PH = 16;

/** Scattered blister spots (a hash, so they do not line up in a grid). */
function blister(x: number, y: number): boolean {
  if (x < 3 || x > PW - 4 || y < 3 || y > PH - 5) return false;
  const hsh = Math.imul(x * 374761393 + y * 668265263, 1274126177) >>> 0;
  return hsh % 11 === 0;
}

// ---------------------------------------------------------------- sprites

/** A crimped pastel at a doneness: a fat rectangle with fork marks on three edges and blisters on top. */
function pastelSprite(stage: PastelDoneness | 'folded'): HTMLCanvasElement {
  const ink = CRUST[stage];
  return paint(`ps-pastel-${stage}`, PW, PH, (x, y) => {
    // rounded corners
    if ((x === 0 || x === PW - 1) && (y === 0 || y === PH - 1)) return null;
    const edge = x <= 1 || x >= PW - 2 || y >= PH - 2;
    const fold = y <= 1;
    if (stage === 'block' || stage === 'fire') {
      // a charcoal brick with a glowing crack
      if ((y === 6 || y === 10) && x > 4 && x < PW - 5 && x % 3 !== 0) return stage === 'fire' ? '#f2b22b' : '#cb2a2a';
      return (x + y) % 5 === 0 ? ink.hi : (x * 3 + y) % 7 === 0 ? ink.lo : ink.base;
    }
    if (edge) return (x + y) % 2 === 0 ? ink.lo : ink.base; // fork marks
    if (fold) return ink.hi;
    // blisters: little domes, lit on top with a shadow under them
    if (stage !== 'folded') {
      if (blister(x, y)) return ink.hi;
      if (blister(x, y - 1) || blister(x - 1, y - 1)) return ink.lo;
    }
    if (y >= PH - 4) return ink.lo;
    return x < 6 && y < 6 ? ink.hi : ink.base;
  });
}

/** The open sheet of dough on the board, with what has been spooned on so far. */
function sheetSprite(parts: readonly PastelPart[]): HTMLCanvasElement {
  const w = PW + 2;
  const hh = PH * 2 - 2;
  return paint(`ps-sheet-${parts.join('+')}`, w, hh, (x, y) => {
    if ((x === 0 || x === w - 1) && (y === 0 || y === hh - 1)) return null;
    // the fillings sit on the near half
    const mid = hh / 2 + 1;
    for (let k = 0; k < parts.length; k++) {
      const p = parts[k]!;
      const cx = parts.length === 1 ? w / 2 : w / 2 + (k === 0 ? -6 : 6);
      if (inEllipse(x, y, cx, mid + 6, parts.length === 1 ? 9 : 6, 4.5)) {
        const ink = FILL_INK[p];
        return (x + y) % 3 === 0 ? ink.hi : (x * 2 + y) % 5 === 0 ? ink.lo : ink.base;
      }
    }
    if (y === Math.floor(hh / 2)) return '#e8d29a'; // the fold line
    const flour = (x * 5 + y * 3) % 17 === 0;
    return flour ? '#ffffff' : x === 0 || y === 0 ? '#fff3c4' : x === w - 1 || y === hh - 1 ? '#d6b46e' : '#f6e6b4';
  });
}

/** A steel gastronorm tray of one filling. */
function traySprite(part: PastelPart): HTMLCanvasElement {
  const ink = FILL_INK[part];
  return paint(`ps-tray-${part}`, 20, 11, (x, y) => {
    if (y <= 1) return x === 0 || x === 19 ? null : y === 0 ? C.steelHi : C.steel;
    if (y >= 9) return x === 0 || x === 19 ? null : C.steelLo;
    if (x <= 1 || x >= 18) return x <= 1 ? C.steel : C.steelMid;
    const n = (x * 7 + y * 5) % 9;
    if (part === 'calabresa' || part === 'pizza') {
      if ((x + y * 3) % 6 === 0) return ink.hi;
    }
    if (part === 'camarao' && (x + y) % 4 === 0) return ink.lo;
    return n === 0 ? ink.hi : n === 4 ? ink.lo : ink.base;
  });
}

/** Little bowl icon of a part for the bubble ticket. */
function partIcon(part: PastelPart): HTMLCanvasElement {
  const ink = FILL_INK[part];
  return paint(`ps-picon-${part}`, 14, 9, (x, y) => {
    if (y <= 3) return inEllipse(x, y, 7, 4, 5.5, 3) ? ((x + y) % 3 ? ink.base : ink.hi) : null;
    if (inEllipse(x, y, 7, 3, 7, 6)) return y === 4 ? '#ffffff' : x < 6 ? '#f8f8f8' : '#c6c8d4';
    return null;
  });
}

function massaSprite(): HTMLCanvasElement {
  return paint('ps-massa', 34, 18, (x, y) => {
    // a stack of square sheets, a little crooked, dusted with flour
    for (let k = 0; k < 5; k++) {
      const top = 3 + k * 3;
      const off = k % 2 ? 1 : 0;
      if (y === top && x >= 1 + off && x <= 32 - off) return '#fff3c4';
      if (y === top + 1 && x >= 1 + off && x <= 32 - off) return k === 4 ? '#d6b46e' : '#f3dc9c';
      if (y === top + 2 && x >= 1 + off && x <= 32 - off) return '#e8d29a';
    }
    if (y <= 2 && x >= 2 && x <= 31) return (x * 3) % 7 === 0 ? '#ffffff' : '#f6e6b4';
    return null;
  });
}

function forkSprite(): HTMLCanvasElement {
  return paint('ps-fork', 8, 26, (x, y) => {
    if (y < 9) return x % 2 === 1 && x < 7 ? (x < 3 ? C.steelHi : C.steel) : null;
    if (y < 11) return x >= 1 && x <= 6 ? C.steel : null;
    if (y < 13) return x >= 3 && x <= 4 ? C.steelMid : null;
    return x >= 2 && x <= 5 ? (x === 2 ? C.woodHi : y % 4 === 0 ? C.woodLo : C.wood) : null;
  });
}

function binSprite(): HTMLCanvasElement {
  return paint('ps-bin', 18, 20, (x, y) => {
    if (y <= 2) return x >= 1 && x <= 16 ? (y === 0 ? '#8fd18a' : C.green) : null;
    if (y <= 3) return x >= 7 && x <= 10 ? C.greenLo : null;
    const inset = Math.floor((y - 3) / 6);
    if (x < 2 + inset || x > 15 - inset) return null;
    return (x - inset) % 4 === 0 ? C.greenLo : x < 6 ? '#5fc76a' : C.green;
  });
}

// ---------------------------------------------------------------- state

type BoardStep = 'empty' | 'sheet' | 'crimping' | 'crimped';

interface Fry {
  phase: 'empty' | 'frying';
  at: number;
  filling: PastelFilling | null;
  parts: PastelPart[];
  combo: boolean;
  x: number;
  y: number;
  /** performance.now of the splash */
  dropAt: number;
}

interface Racked {
  filling: PastelFilling | null;
  parts: PastelPart[];
  done: PastelDoneness;
  /** performance.now when it landed (for the hop) */
  at: number;
}

export class PastelView {
  private stage: FeiraStage<PastelOrder>;
  private board: { step: BoardStep; parts: PastelPart[]; at: number } = { step: 'empty', parts: [], at: 0 };
  private fry: Fry[] = [0, 1, 2].map(() => ({ phase: 'empty', at: 0, filling: null, parts: [], combo: false, x: 0, y: 0, dropAt: 0 }));
  private rack: (Racked | null)[] = Array.from({ length: PASTEL_RACK }, () => null);
  private served = 0;
  private wasFire = [false, false, false];
  // layout (art px)
  private massa = { x: 0, y: 0 };
  private boardAt = { x: 0, y: 0 };
  private fork = { x: 0, y: 0 };
  private bin = { x: 0, y: 0 };
  private fryer = { x: 0, y: 0, w: 0, h: 0 };
  private rackAt = { x: 0, y: 0, w: 0, h: 0 };
  private trays: { part: PastelPart; x: number; y: number }[] = [];
  private top: HTMLCanvasElement | null = null;
  private topKey = '';
  private bubbleAt = 0;

  constructor(
    seed: number,
    private readonly hooks: PastelHooks,
  ) {
    this.stage = new FeiraStage<PastelOrder>({
      game: 'pastel',
      prefix: 'pastel',
      title: 'Pastel',
      orders: pastelOrders(seed),
      durationMs: PASTEL_DURATION_MS,
      palette: { awningA: '#f2c230', awningB: '#cb2a2a', plaque: '#c48a14' },
      icons: (o) => [pastelSprite('golden'), ...PASTEL_RECIPE[o.filling].parts.map(partIcon)],
      layout: (L) => this.layout(L),
      update: (_dt, t) => this.update(t),
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

  showEnd(end: PastelEnd) {
    this.stage.showEnd(stallEndCard({ game: 'pastel', prefix: 'pastel', cls: 'ps', title: 'Pastel', end, again: () => this.hooks.again(), quit: () => this.hooks.quit() }));
  }

  // ---------------------------------------------------------------- layout

  private layout(L: StageLayout) {
    const { W, work, portrait } = L;
    if (portrait) {
      // fryer and rack on top, the board row, then the vitrine of trays (two rows)
      const content = 64 + 46 + 76;
      const y0 = work.y + Math.max(6, Math.round((work.h - content) * 0.35));
      this.fryer = { x: 6, y: y0, w: Math.round(W * 0.68), h: 54 };
      this.rackAt = { x: this.fryer.x + this.fryer.w + 6, y: y0 + 2, w: W - this.fryer.w - 18, h: 50 };
      const rowY = y0 + 64 + 18;
      this.massa = { x: 24, y: rowY };
      this.boardAt = { x: Math.round(W / 2) - 6, y: rowY };
      this.fork = { x: Math.round(W / 2) + 34, y: rowY };
      this.bin = { x: W - 16, y: rowY + 2 };
      const ty = rowY + 40;
      const per = 6;
      const cw = (W - 8) / per;
      this.trays = PASTEL_PARTS.map((part, i) => ({ part, x: Math.round(4 + cw * (i % per) + cw / 2), y: ty + Math.floor(i / per) * 38 }));
    } else {
      const y0 = work.y + 6;
      const leftW = Math.round(W * 0.46);
      this.massa = { x: 24, y: y0 + 18 };
      this.boardAt = { x: Math.round(leftW / 2 + 14), y: y0 + 18 };
      this.fork = { x: this.boardAt.x + 32, y: y0 + 18 };
      this.bin = { x: leftW - 8, y: y0 + 22 };
      this.fryer = { x: leftW + 6, y: y0, w: Math.round(W * 0.36), h: Math.min(52, Math.max(40, work.h - 58)) };
      this.rackAt = { x: this.fryer.x + this.fryer.w + 8, y: y0 + 2, w: W - (this.fryer.x + this.fryer.w) - 14, h: this.fryer.h - 10 };
      const per = 11;
      const cw = (W - 8) / per;
      const rowsY = Math.max(this.fryer.y + this.fryer.h + 14, work.y + work.h - 26);
      this.trays = PASTEL_PARTS.map((part, i) => ({ part, x: Math.round(4 + cw * i + cw / 2), y: rowsY }));
    }
    const n = 3;
    this.fry.forEach((f, i) => {
      f.x = Math.round(this.fryer.x + (this.fryer.w / n) * (i + 0.5));
      f.y = Math.round(this.fryer.y + this.fryer.h / 2 - 2);
    });
    this.top = null;
  }

  private rackSpot(i: number): { x: number; y: number } {
    // three stacked down the wire rack, overlapping a little when it is short
    const r = this.rackAt;
    const step = Math.min(14, (r.h - 16) / 2);
    return { x: Math.round(r.x + r.w / 2), y: Math.round(r.y + 8 + i * step) };
  }

  // ---------------------------------------------------------------- rules

  private open(): number {
    return pastelSlots(this.served);
  }

  private update(t: number) {
    // oil bubbles, smoke from anything past golden, sparks from a fire
    if (t - this.bubbleAt < 90) return;
    this.bubbleAt = t;
    const st = this.stage;
    const f0 = this.fryer;
    st.puff(f0.x + 4 + Math.random() * (f0.w - 8), f0.y + 8 + Math.random() * (f0.h - 14), Math.random() < 0.5 ? '#ffe7a0' : '#f2c230', { vy: -3, life: 0.25 });
    this.fry.forEach((f, i) => {
      if (f.phase !== 'frying') return;
      const d = pastelDoneness(t - f.at, f.combo);
      st.puff(f.x + (Math.random() - 0.5) * PW, f.y + 6, '#fff3c4', { vy: -4, life: 0.25 });
      if (d === 'dark' || d === 'black' || d === 'block') st.puff(f.x + (Math.random() - 0.5) * 18, f.y - 6, d === 'dark' ? '#a2a6be' : '#565972', { vy: -16, life: 1.3, size: 2 });
      if (d === 'fire') {
        st.puff(f.x + (Math.random() - 0.5) * 22, f.y - 6, Math.random() < 0.5 ? '#f2b22b' : '#e63f38', { vy: -30, life: 0.5, size: 2 });
        st.puff(f.x + (Math.random() - 0.5) * 18, f.y - 16, '#3a3a50', { vy: -20, life: 1.4, size: 3 });
        if (!this.wasFire[i]) {
          this.wasFire[i] = true;
          st.pop(PASTEL_POP.fire, 'bad');
          st.sfx('burnt');
          st.shake(2, 300);
        }
      }
    });
  }

  private takeDough() {
    if (this.stage.over) return;
    if (this.board.step !== 'empty') {
      this.stage.pop(HINT.board);
      return;
    }
    this.board = { step: 'sheet', parts: [], at: performance.now() };
    this.stage.sfx('slap');
    this.stage.burst(this.boardAt.x, this.boardAt.y, 8, ['#ffffff', '#fff3c4'], { up: 8, spread: 18, life: 0.5, gravity: 30 });
  }

  private addPart(part: PastelPart): boolean {
    if (this.stage.over) return false;
    if (this.board.step === 'empty') {
      this.stage.pop(PASTEL_POP.dough);
      return false;
    }
    if (this.board.step !== 'sheet') {
      this.stage.pop(HINT.board);
      return false;
    }
    if (this.board.parts.includes(part)) return false;
    if (this.board.parts.length >= 2) {
      this.stage.pop(HINT.two);
      return false;
    }
    this.board.parts.push(part);
    this.stage.sfx('grab');
    const ink = FILL_INK[part];
    this.stage.burst(this.boardAt.x, this.boardAt.y + 4, 6, [ink.base, ink.hi], { up: 14, spread: 12, life: 0.35 });
    return true;
  }

  private crimp() {
    if (this.stage.over) return;
    if (this.board.step === 'empty') {
      this.stage.pop(PASTEL_POP.dough);
      return;
    }
    if (this.board.step !== 'sheet') return;
    if (!this.board.parts.length) {
      this.stage.pop(HINT.empty);
      return;
    }
    this.board.step = 'crimping';
    this.board.at = performance.now();
    this.stage.sfx('paper');
    for (let k = 1; k <= 4; k++) window.setTimeout(() => !this.stage.over && this.stage.sfx('tick'), 90 * k + 120);
    window.setTimeout(() => {
      if (this.board.step === 'crimping') this.board.step = 'crimped';
    }, 520);
  }

  /** The crimped pastel goes into the oil at slot i (or the first free one). */
  private drop(i = -1): boolean {
    if (this.stage.over || this.board.step !== 'crimped') {
      if (this.board.step !== 'crimped' && this.board.step !== 'empty') this.stage.pop(PASTEL_POP.need);
      return false;
    }
    const open = this.open();
    const k = i >= 0 ? i : this.fry.findIndex((f, n) => n < open && f.phase === 'empty');
    const f = this.fry[k];
    if (!f || k >= open) {
      this.stage.pop(k >= open ? HINT.locked : HINT.full);
      return false;
    }
    if (f.phase !== 'empty') return false;
    const filling = pastelFromParts(this.board.parts);
    f.phase = 'frying';
    f.at = this.stage.t;
    f.filling = filling;
    f.parts = this.board.parts.slice();
    f.combo = filling ? PASTEL_RECIPE[filling].combo : this.board.parts.length > 1;
    f.dropAt = performance.now();
    this.wasFire[k] = false;
    this.board = { step: 'empty', parts: [], at: 0 };
    this.stage.sfx('sizzle');
    this.stage.burst(f.x, f.y, 14, ['#ffe7a0', '#f2c230', '#ffffff'], { up: 40, spread: 30, life: 0.45 });
    return true;
  }

  /** Tap a place in the oil: drop the crimped one in, pull a pastel out, or put a fire out. */
  private tapFry(i: number) {
    const f = this.fry[i]!;
    if (this.stage.over) return;
    if (i >= this.open()) {
      this.stage.pop(HINT.locked);
      return;
    }
    if (f.phase === 'empty') {
      if (this.board.step === 'crimped') this.drop(i);
      else this.stage.pop(this.board.step === 'empty' ? PASTEL_POP.dough : PASTEL_POP.need);
      return;
    }
    const done = pastelDoneness(this.stage.t - f.at, f.combo);
    const slot = this.rack.findIndex((r) => r === null);
    if (slot < 0) {
      this.stage.pop(PASTEL_POP.rack, 'bad');
      this.stage.sfx('nope');
      return;
    }
    this.rack[slot] = { filling: f.filling, parts: f.parts, done: done === 'fire' ? 'block' : done, at: performance.now() };
    f.phase = 'empty';
    f.filling = null;
    f.parts = [];
    this.wasFire[i] = false;
    if (done === 'fire') {
      this.stage.pop(PASTEL_POP.out);
      this.stage.sfx('slap');
      this.stage.burst(f.x, f.y - 4, 10, ['#d8d0e0', '#a2a6be', '#ffffff'], { up: 30, spread: 20, life: 0.8, gravity: -10 });
    } else {
      this.stage.pop(done === 'golden' ? PASTEL_POP.perfect : done === 'raw' ? PASTEL_POP.raw : PASTEL_POP.soft, done === 'golden' ? 'good' : 'bad');
      this.stage.sfx(done === 'golden' ? 'ready' : 'burnt');
    }
  }

  private trash(what: 'board' | number) {
    if (what === 'board') {
      if (this.board.step === 'empty') return false;
      this.board = { step: 'empty', parts: [], at: 0 };
    } else {
      if (!this.rack[what]) return false;
      this.rack[what] = null;
    }
    this.stage.pop(PASTEL_POP.trash);
    this.stage.sfx('slap');
    return true;
  }

  private serveTo(c: StageCustomer<PastelOrder>, payload: DragPayload | null) {
    if (!this.stage.servable(c)) return;
    let k = -1;
    if (payload?.kind === 'rack') k = payload.data as number;
    else if (!payload) {
      const ready = this.rack.map((r, i) => ({ r, i })).filter((x) => x.r);
      k = (ready.find((x) => x.r!.filling === c.order.filling) ?? ready[0])?.i ?? -1;
    } else return;
    const r = k >= 0 ? this.rack[k] : null;
    if (!r) {
      if (!payload) this.stage.pop(HINT.none);
      return;
    }
    const fillingOk = r.filling === c.order.filling;
    const quality = pastelServeQuality(r.done, fillingOk, this.stage.patience(c));
    this.stage.record(c, quality, fillingOk ? undefined : PASTEL_POP.wrong);
    if (!fillingOk) this.stage.pop(PASTEL_POP.wrong, 'bad');
    if (quality !== 'miss') {
      this.served += 1;
      if (this.served === 4) {
        this.stage.pop({ pt: 'Mais um lugar no óleo!', en: 'Another spot in the oil!' }, 'good');
        this.stage.sfx('chime');
      }
    }
    this.rack[k] = null;
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
    // stainless top with a brushed grain
    fill(g, 0, work.y, W, work.h, '#bfc3d0');
    g.fillStyle = '#cdd0db';
    for (let y = work.y; y < work.y + work.h; y += 3) g.fillRect(0, y, W, 1);
    g.fillStyle = '#aeb2c2';
    for (let y = work.y + 1; y < work.y + work.h; y += 9) for (let x = (y * 13) % 17; x < W; x += 29) g.fillRect(x, y, 9, 1);
    // the floured wooden board
    const b = this.boardAt;
    fill(g, b.x - 22, b.y - 17, 44, 34, C.ink);
    fill(g, b.x - 21, b.y - 16, 42, 32, C.woodHi);
    fill(g, b.x - 21, b.y + 14, 42, 2, C.wood);
    for (let k = 0; k < 40; k++) g.fillRect(b.x - 19 + ((k * 17) % 38), b.y - 14 + ((k * 7) % 28), 1, 1);
    g.fillStyle = '#ffffff';
    for (let k = 0; k < 24; k++) g.fillRect(b.x - 18 + ((k * 23) % 36), b.y - 13 + ((k * 11) % 26), 1, 1);
    // the vitrine: a steel strip under the trays
    if (this.trays.length) {
      const y0 = Math.min(...this.trays.map((t) => t.y)) - 9;
      const y1 = Math.max(...this.trays.map((t) => t.y)) + 9;
      fill(g, 2, y0, W - 4, y1 - y0, C.steelMid);
      fill(g, 2, y0, W - 4, 1, C.steelHi);
      fill(g, 2, y1 - 1, W - 4, 1, C.steelLo);
    }
    // the fryer: a deep steel tank with a thick rim
    const f = this.fryer;
    fill(g, f.x - 3, f.y - 3, f.w + 6, f.h + 8, C.ink);
    fill(g, f.x - 2, f.y - 2, f.w + 4, f.h + 6, C.steel);
    fill(g, f.x - 2, f.y - 2, f.w + 4, 1, C.steelHi);
    fill(g, f.x - 2, f.y + f.h + 3, f.w + 4, 1, C.steelLo);
    // control box and its dial
    fill(g, f.x + f.w - 18, f.y + f.h + 4, 16, 3, C.steelDk);
    // the rack: a wire grid over a drip tray
    const r = this.rackAt;
    fill(g, r.x - 1, r.y - 1, r.w + 2, r.h + 2, C.ink);
    fill(g, r.x, r.y, r.w, r.h, '#8e92a8');
    g.fillStyle = C.steelHi;
    for (let x = r.x + 2; x < r.x + r.w - 1; x += 3) g.fillRect(x, r.y + 1, 1, r.h - 2);
    for (let y = r.y + 3; y < r.y + r.h - 1; y += 6) g.fillRect(r.x + 1, y, r.w - 2, 1);
    this.top = cv;
    this.topKey = key;
    return cv;
  }

  private draw(g: Ctx, t: number, now: number) {
    g.drawImage(this.workTop(), 0, 0);
    this.drawOil(g, now);
    const open = this.open();
    this.fry.forEach((f, i) => this.drawFry(g, f, i, i >= open, t, now));
    // rack
    this.rack.forEach((r, i) => {
      const p = this.rackSpot(i);
      if (!r) return;
      const hop = Math.max(0, 6 - Math.floor((now - r.at) / 30));
      blit(g, pastelSprite(r.done), p.x, p.y - hop, true);
    });
    // massa, board, fork, bin
    blit(g, massaSprite(), this.massa.x, this.massa.y, true);
    this.drawBoard(g, now);
    const forkLift = this.board.step === 'crimping' ? Math.round(Math.abs(Math.sin((now - this.board.at) / 45)) * 4) : 0;
    if (this.board.step !== 'crimping') blit(g, forkSprite(), this.fork.x, this.fork.y, true);
    else blit(g, forkSprite(), this.boardAt.x - 12 + ((now - this.board.at) / 520) * 24, this.boardAt.y - 12 - forkLift, true);
    blit(g, binSprite(), this.bin.x, this.bin.y, true);
    for (const tr of this.trays) {
      const on = this.board.parts.includes(tr.part);
      if (on) fill(g, tr.x - 12, tr.y - 7, 24, 14, C.gold);
      blit(g, traySprite(tr.part), tr.x, tr.y - (on ? 1 : 0), true);
    }
    this.syncHits();
  }

  private drawOil(g: Ctx, now: number) {
    const f = this.fryer;
    // deep amber oil: darker at the walls, a lighter surface in the middle, slow glints drifting across
    fill(g, f.x, f.y, f.w, f.h, '#b86c10');
    fill(g, f.x + 2, f.y + 3, f.w - 4, f.h - 6, '#cf8618');
    fill(g, f.x + 5, f.y + 7, f.w - 10, f.h - 14, '#dc9524');
    fill(g, f.x, f.y, f.w, 3, '#7a4a12');
    fill(g, f.x, f.y + 3, f.w, 1, '#9a5c12');
    const drift = (now / 55) % (f.w + 30);
    g.fillStyle = '#f2bb4a';
    for (let k = 0; k < 4; k++) {
      const x = f.x + 4 + ((drift + k * 37) % (f.w - 14));
      g.fillRect(Math.round(x), f.y + 8 + k * 8, 7, 1);
      g.fillRect(Math.round(x) + 2, f.y + 9 + k * 8, 3, 1);
    }
    // bubbles: rings that pop in and out
    for (let k = 0; k < 12; k++) {
      const phase = (Math.floor(now / 140) + k * 5) % 9;
      if (phase > 2) continue;
      const x = f.x + 6 + ((k * 41) % (f.w - 12));
      const y = f.y + 8 + ((k * 17) % (f.h - 14));
      g.fillStyle = '#ffe2a0';
      if (phase === 0) g.fillRect(x, y, 1, 1);
      else {
        g.fillRect(x - 1, y, 1, 1);
        g.fillRect(x + 1, y, 1, 1);
        g.fillRect(x, y - 1, 1, 1);
        g.fillRect(x, y + 1, 1, 1);
      }
    }
  }

  private drawFry(g: Ctx, f: Fry, i: number, locked: boolean, t: number, now: number) {
    const st = this.stage;
    if (locked) {
      // a basket hanging up: this place opens later
      fill(g, f.x - 10, f.y - 8, 20, 14, 'rgba(42,34,51,0.35)');
      fill(g, f.x - 3, f.y - 3, 6, 5, C.gold);
      fill(g, f.x - 2, f.y - 6, 4, 1, C.steel);
      fill(g, f.x - 2, f.y - 6, 1, 3, C.steel);
      fill(g, f.x + 1, f.y - 6, 1, 3, C.steel);
      st.dropLabel(`ps-fry-${i}`);
      return;
    }
    if (f.phase === 'empty') {
      // a dashed ring where the next one goes
      g.fillStyle = 'rgba(255,240,190,0.55)';
      for (let x = -PW / 2; x < PW / 2; x += 3) {
        g.fillRect(f.x + x, f.y - PH / 2, 1, 1);
        g.fillRect(f.x + x, f.y + PH / 2, 1, 1);
      }
      st.label(`ps-fry-${i}`, f.x, f.y + PH / 2 + 3, 'Óleo', 'Oil', '');
      return;
    }
    const age = t - f.at;
    const d = pastelDoneness(age, f.combo);
    const fry = pastelFry(f.combo);
    // it puffs up as it fries and bobs on the bubbles
    const bob = Math.round(Math.sin(now / 160 + i) * 1);
    const splash = Math.max(0, 1 - (now - f.dropAt) / 240);
    const spr = pastelSprite(d === 'raw' && age < 500 ? 'folded' : d);
    // a ring of fizz around anything in the oil
    g.fillStyle = '#fff1c0';
    for (let k = 0; k < 10; k++) {
      if ((Math.floor(now / 90) + k * 3) % 4 !== 0) continue;
      const a = (k / 10) * Math.PI * 2;
      g.fillRect(Math.round(f.x + Math.cos(a) * (PW / 2 + 2)), Math.round(f.y + Math.sin(a) * (PH / 2 + 2)), 1, 1);
    }
    blit(g, spr, f.x, f.y + bob - Math.round(splash * 6), true);
    // oil line over the bottom of the pastel
    fill(g, f.x - PW / 2, f.y + bob + PH / 2 - 3, PW, 2, 'rgba(217,150,30,0.85)');
    if (d === 'fire') this.drawFlames(g, f.x, f.y - PH / 2 + bob, now);
    // fry meter: the golden window, a needle
    const mw = PW;
    const mx = f.x - mw / 2;
    const my = f.y - PH / 2 - 7;
    const span = fry.fireAt;
    fill(g, mx - 1, my - 1, mw + 2, 5, C.ink);
    fill(g, mx, my, mw, 3, '#f3dc9c');
    fill(g, mx + (fry.goldenAt / span) * mw, my, ((fry.darkAt - fry.goldenAt) / span) * mw, 3, '#5fc76a');
    fill(g, mx + (fry.darkAt / span) * mw, my, ((fry.blackAt - fry.darkAt) / span) * mw, 3, '#a8622a');
    fill(g, mx + (fry.blackAt / span) * mw, my, mw - (fry.blackAt / span) * mw, 3, '#3a2a26');
    const nx = mx + Math.min(1, age / span) * mw;
    fill(g, nx - 1, my - 2, 2, 7, '#ffffff');
    const lab = d === 'golden' ? ['Tira!', 'Pull it!', 'fst-label-go'] : d === 'raw' ? ['Fritando', 'Frying', ''] : d === 'fire' ? ['Apaga!', 'Put it out!', 'fst-label-hot'] : ['Queimando!', 'Burning!', 'fst-label-hot'];
    st.label(`ps-fry-${i}`, f.x, f.y + PH / 2 + 3, lab[0]!, lab[1]!, lab[2]!);
  }

  private drawFlames(g: Ctx, x: number, y: number, now: number) {
    const k = Math.floor(now / 90);
    [-10, -4, 3, 9].forEach((dx, n) => {
      const hgt = 7 + ((k + n * 2) % 4) * 2;
      for (let j = 0; j < hgt; j++) {
        const w = Math.max(1, Math.round((1 - j / hgt) * 3));
        const c = j > hgt - 3 ? '#fff59a' : j > hgt / 2 ? '#f2b22b' : '#e63f38';
        fill(g, x + dx - Math.floor(w / 2) + ((j + k) % 2), y - j, w, 1, c);
      }
    });
  }

  private drawBoard(g: Ctx, now: number) {
    const b = this.board;
    const at = this.boardAt;
    if (b.step === 'empty') return;
    if (b.step === 'sheet') {
      const drop = Math.max(0, 1 - (now - b.at) / 160);
      blit(g, sheetSprite(b.parts), at.x, at.y - Math.round(drop * 8), true);
      return;
    }
    if (b.step === 'crimping') {
      // the far half folds over, then the fork walks along the edge
      const k = Math.min(1, (now - b.at) / 200);
      if (k < 1) {
        const sheet = sheetSprite(b.parts);
        const hgt = Math.max(1, Math.round(sheet.height * (1 - k / 2)));
        g.drawImage(sheet, 0, sheet.height - hgt, sheet.width, hgt, at.x - sheet.width / 2, at.y - sheet.height / 2 + (sheet.height - hgt), sheet.width, hgt);
        return;
      }
      blit(g, pastelSprite('folded'), at.x, at.y + 4, true);
      const marks = Math.floor(((now - b.at - 200) / 320) * 8);
      for (let m = 0; m < Math.min(8, marks); m++) fill(g, at.x - PW / 2 + 2 + m * 3.5, at.y + 4 + PH / 2 - 2, 1, 2, C.woodLo);
      return;
    }
    blit(g, pastelSprite('folded'), at.x, at.y + 4, true);
  }

  // ---------------------------------------------------------------- hits

  private syncHits() {
    const st = this.stage;
    st.hit({
      id: 'pastel-dough',
      label: 'Massa · Dough',
      rect: { x: this.massa.x - 18, y: this.massa.y - 11, w: 36, h: 22 },
      tap: () => this.takeDough(),
    });
    st.label('ps-massa', this.massa.x, this.massa.y + 11, 'Massa', 'Dough', this.board.step === 'empty' ? 'fst-label-go' : '');
    const crimped = this.board.step === 'crimped';
    st.hit({
      id: 'pastel-board',
      label: crimped ? 'Pastel fechado: pro óleo · Crimped: into the oil' : 'Tábua · Board',
      rect: { x: this.boardAt.x - 22, y: this.boardAt.y - 17, w: 44, h: 34 },
      tap: () => (crimped ? this.drop() : this.board.step === 'empty' ? this.takeDough() : this.crimp()),
      drag: () => (crimped ? { kind: 'board', sprite: pastelSprite('folded') } : null),
      drop: (d) => (d.kind === 'part' ? this.addPart(d.data as PastelPart) : false),
      accepts: (d) => d.kind === 'part' && this.board.step === 'sheet',
    });
    const boardLabel = this.board.step === 'empty' ? null
      : this.board.step === 'sheet' ? (this.board.parts.length ? ['Garfo pra fechar', 'Fork to crimp', ''] : ['Recheio', 'Add a filling', ''])
        : this.board.step === 'crimped' ? ['Pro óleo!', 'Into the oil!', 'fst-label-go'] : ['Fechando…', 'Crimping…', ''];
    if (boardLabel) st.label('ps-board', this.boardAt.x, this.boardAt.y + 17, boardLabel[0]!, boardLabel[1]!, boardLabel[2]!);
    else st.dropLabel('ps-board');
    st.hit({
      id: 'pastel-crimp',
      label: 'Garfo: fechar · Fork: crimp',
      rect: { x: this.fork.x - 7, y: this.fork.y - 14, w: 14, h: 28 },
      tap: () => this.crimp(),
    });
    st.hit({
      id: 'pastel-bin',
      label: 'Lixo · Bin',
      rect: { x: this.bin.x - 10, y: this.bin.y - 11, w: 20, h: 22 },
      tap: () => this.trash('board'),
      drop: (d) => (d.kind === 'board' ? this.trash('board') : d.kind === 'rack' ? this.trash(d.data as number) : false),
      accepts: (d) => d.kind === 'board' || d.kind === 'rack',
    });
    const open = this.open();
    this.fry.forEach((f, i) => {
      st.hit({
        id: `pastel-slot-${i}`,
        label: i >= open ? 'Fechado · Locked' : f.phase === 'empty' ? 'Óleo · Oil' : 'Tirar do óleo · Pull it out',
        rect: { x: f.x - PW / 2 - 3, y: this.fryer.y, w: PW + 6, h: this.fryer.h },
        tap: () => this.tapFry(i),
        drop: (d) => d.kind === 'board' && this.drop(i),
        accepts: (d) => d.kind === 'board' && f.phase === 'empty' && i < open,
      });
    });
    this.rack.forEach((r, i) => {
      const p = this.rackSpot(i);
      if (!r) return;
      st.hit({
        id: `pastel-rack-${i}`,
        label: `Pastel ${r.filling ? PASTEL_RECIPE[r.filling].label.pt : ''} · Pastel on the rack`,
        rect: { x: p.x - PW / 2, y: p.y - 7, w: PW, h: 14 },
        tap: () => {
          // a tap on the rack serves the first customer who ordered it
          const c = st.waiting().find((w) => w.order.filling === r.filling);
          if (c) this.serveTo(c, { kind: 'rack', sprite: pastelSprite(r.done), data: i });
          else st.pop(HINT.drag);
        },
        drag: () => ({ kind: 'rack', sprite: pastelSprite(r.done), data: i }),
        z: 2,
      });
    });
    st.label('ps-rack', this.rackAt.x + this.rackAt.w / 2, this.rackAt.y + this.rackAt.h + 2, 'Escorredor', 'Rack', '');
    for (const tr of this.trays) {
      const lab = PASTEL_PART_LABEL[tr.part];
      st.hit({
        id: `pastel-bowl-${tr.part}`,
        label: `${lab.pt} · ${lab.en}`,
        rect: { x: tr.x - 12, y: tr.y - 8, w: 24, h: 26 },
        tap: () => this.addPart(tr.part),
        drag: () => (this.board.step === 'sheet' ? { kind: 'part', sprite: partIcon(tr.part), data: tr.part } : null),
      });
      st.label(`ps-tray-${tr.part}`, tr.x, tr.y + 7, lab.pt, lab.en, 'fst-label-tray');
    }
  }
}

