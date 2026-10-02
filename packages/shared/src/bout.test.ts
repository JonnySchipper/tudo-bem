import { describe, expect, it } from 'vitest';
import {
  ADJACENT_POSITIONS,
  BOUT_CLOCK_MS,
  CLOCK_RATE,
  CROWD,
  CROWD_SHOUTS,
  ESCAPE_BASE_MS,
  FAST_AT,
  INTENTS,
  MAX_EXCHANGES,
  MOMENTUM_CARRY,
  MOMENTUM_NEAR,
  MOMENTUM_THRESHOLD,
  PARTNERS,
  PEGADA_MAX,
  POINTS_FOR_RUNG,
  REF_LINES,
  RESOLVE_MS,
  RUNG_MAX,
  boutOffer,
  canFinish,
  challengeLimitMs,
  clockCost,
  decide,
  endLine,
  escapeLimitMs,
  escapeWorked,
  finishFailed,
  finishPlan,
  formatBoutClock,
  intentPickMs,
  intentSet,
  mulberry32,
  newBoutState,
  nextStep,
  partnerById,
  partnerFinishDrive,
  partnerTurn,
  positionOf,
  resolveExchange,
  rungOfPosition,
  signalForPoints,
  simulateBout,
  speedFactor,
  spendClock,
  timerScale,
  type BoutState,
  type ExchangeInput,
  type SimPlayer,
} from './index.js';

const mateus = partnerById('mateus')!;
const rafael = partnerById('rafael')!;

/** A partner that never pushes: isolates the player's side of the maths. */
/** An rng that always rolls high: the idle partner always misses and picks its safe intent. */
const quiet = () => 0.99;
const idle = { ...mateus, accuracy: 0, speed: 0.05, aggression: 0, defense: 0 };

const input = (over: Partial<ExchangeInput> = {}): ExchangeInput => ({ intent: 'puxar', correct: true, elapsedMs: 1000, limitMs: 14000, spentMs: 5000, ...over });

describe('position ladder', () => {
  it('maps the rung to the seven positions, with the side that is ahead', () => {
    const at = (rung: number, top: 'montada' | 'costas' = 'montada') => positionOf({ rung, top });
    expect(at(0)).toEqual({ id: 'de_pe', ahead: null });
    expect(at(1)).toEqual({ id: 'guarda_fechada', ahead: 'you' });
    expect(at(-1)).toEqual({ id: 'meia_guarda', ahead: 'partner' });
    expect(at(2).id).toBe('cem_quilos');
    expect(at(-2).id).toBe('cem_quilos');
    expect(at(3).id).toBe('joelho');
    expect(at(4)).toEqual({ id: 'montada', ahead: 'you' });
    expect(at(4, 'costas')).toEqual({ id: 'costas', ahead: 'you' });
    expect(at(-4, 'costas')).toEqual({ id: 'costas', ahead: 'partner' });
    const seen = new Set([-4, -3, -2, -1, 0, 1, 2, 3, 4].flatMap((r) => [at(r).id, at(r, 'costas').id]));
    expect([...seen].sort()).toEqual(['costas', 'cem_quilos', 'de_pe', 'guarda_fechada', 'joelho', 'meia_guarda', 'montada'].sort());
  });

  it('adjacent positions are exactly the one-rung steps (the transition art list)', () => {
    expect(ADJACENT_POSITIONS).toHaveLength(7);
    for (const [a, b] of ADJACENT_POSITIONS) expect(Math.abs(rungOfPosition(a) - rungOfPosition(b))).toBe(1);
    // every step the ladder can take is in the list, in one direction or the other
    const has = (a: string, b: string) => ADJACENT_POSITIONS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
    for (const top of ['montada', 'costas'] as const)
      for (let r = -3; r <= 3; r++) {
        const a = positionOf({ rung: r, top }).id;
        const b = positionOf({ rung: r + 1, top }).id;
        if (a === b) continue;
        expect(has(a, b), `${a} <-> ${b}`).toBe(true);
      }
  });
});

describe('intents', () => {
  it('six A1 verbs with a risk and reward: the bolder the intent, the more it gains and the more a miss costs', () => {
    expect(Object.values(INTENTS).map((i) => i.pt).sort()).toEqual(['Empurrar', 'Esperar', 'Girar', 'Levantar', 'Puxar', 'Segurar']);
    const order = ['esperar', 'segurar', 'puxar', 'empurrar', 'levantar', 'girar'] as const;
    for (let i = 1; i < order.length; i++) {
      expect(INTENTS[order[i]!].power).toBeGreaterThanOrEqual(INTENTS[order[i - 1]!].power);
      expect(INTENTS[order[i]!].miss).toBeGreaterThanOrEqual(INTENTS[order[i - 1]!].miss);
    }
    expect(INTENTS.esperar.miss).toBe(0);
    for (const i of Object.values(INTENTS)) {
      expect([1, 2, 3]).toContain(i.risk);
      expect(i.en.length).toBeGreaterThan(0);
    }
  });

  it('every rung offers two or three intents, a safe one first, no repeats', () => {
    for (let r = -RUNG_MAX; r <= RUNG_MAX; r++) {
      const set = intentSet(r);
      expect(set.length).toBeGreaterThanOrEqual(2);
      expect(set.length).toBeLessThanOrEqual(3);
      expect(new Set(set.map((i) => i.id)).size).toBe(set.length);
      expect(set[0]!.risk).toBe(1);
      expect(set.at(-1)!.risk).toBeGreaterThanOrEqual(set[0]!.risk);
    }
    // behind: you wait; ahead: you hold
    expect(intentSet(-2)[0]!.id).toBe('esperar');
    expect(intentSet(2)[0]!.id).toBe('segurar');
    // out-of-range input still gives a set
    expect(intentSet(99).length).toBeGreaterThan(1);
    expect(intentSet(Number.NaN).length).toBeGreaterThan(1);
  });
});

describe('timers: generous at the start, shrinking only with the level', () => {
  it('scale is 1 for a new player and floors at 0.55', () => {
    expect(timerScale(0)).toBe(1);
    expect(timerScale(2)).toBeCloseTo(0.88);
    expect(timerScale(8)).toBe(0.55);
    expect(timerScale(99)).toBe(0.55);
    expect(timerScale(-5)).toBe(1);
  });

  it('challenge limits shrink with the level and never below a readable time', () => {
    for (const k of ['cloze', 'choice', 'listening', 'typed', 'reorder'] as const) {
      expect(challengeLimitMs(k, 0)).toBeGreaterThanOrEqual(14_000);
      let prev = Infinity;
      for (let level = 0; level <= 8; level++) {
        const t = challengeLimitMs(k, level);
        expect(t).toBeLessThanOrEqual(prev);
        prev = t;
      }
      expect(challengeLimitMs(k, 8)).toBeGreaterThanOrEqual(7_000);
    }
    expect(intentPickMs(0)).toBeGreaterThan(intentPickMs(8));
    expect(intentPickMs(8)).toBeGreaterThanOrEqual(7_000);
    expect(escapeLimitMs(0)).toBe(ESCAPE_BASE_MS);
    expect(escapeLimitMs(8)).toBeLessThan(escapeLimitMs(0));
  });

  it('the finalização is tighter than a normal prompt, tighter still against a defender', () => {
    const rng = () => 0.1;
    const soft = finishPlan(partnerById('felipe')!, 0, rng);
    const hard = finishPlan(partnerById('daniel')!, 0, rng);
    expect(soft.mode).toBe('reorder');
    expect(soft.limitMs[0]!).toBeLessThan(challengeLimitMs('reorder', 0));
    // the hardest defender always gets the three quick prompts
    for (const r of [0.1, 0.9]) expect(finishPlan(partnerById('daniel')!, 0, () => r).mode).toBe('triple');
    expect(hard.limitMs).toHaveLength(3);
    const triple = finishPlan(partnerById('felipe')!, 0, () => 0.9);
    expect(triple.mode).toBe('triple');
    expect(hard.limitMs[0]!).toBeLessThan(triple.limitMs[0]!);
  });

  it('speed: full inside the grace share, zero at the limit, in between linear', () => {
    expect(speedFactor(0, 10_000)).toBe(1);
    expect(speedFactor(2_000, 10_000)).toBe(1);
    expect(speedFactor(10_000, 10_000)).toBe(0);
    expect(speedFactor(20_000, 10_000)).toBe(0);
    expect(speedFactor(5_000, 10_000)).toBeGreaterThan(speedFactor(7_000, 10_000));
    expect(speedFactor(5_000, 0)).toBe(0);
    expect(speedFactor(-5, 10_000)).toBe(1);
    // "fast" (a pegada point) is about the first half of the time
    expect(speedFactor(4_500, 10_000)).toBeGreaterThanOrEqual(FAST_AT);
    expect(speedFactor(6_000, 10_000)).toBeLessThan(FAST_AT);
  });
});

describe('one exchange: momentum, speed, risk', () => {
  it('a right answer pushes toward you, a miss pushes away: the bolder, the harder both ways', () => {
    const up = (intent: 'esperar' | 'segurar' | 'puxar' | 'levantar' | 'girar') => resolveExchange(newBoutState(), input({ intent }), idle, quiet).delta;
    expect(up('girar')).toBeGreaterThan(up('levantar'));
    expect(up('levantar')).toBeGreaterThan(up('puxar'));
    expect(up('puxar')).toBeGreaterThan(up('segurar'));
    expect(up('segurar')).toBeGreaterThan(up('esperar'));
    const miss = (intent: 'esperar' | 'segurar' | 'puxar' | 'levantar' | 'girar') => resolveExchange(newBoutState(), input({ intent, correct: false }), idle, quiet).delta;
    expect(miss('esperar')).toBeGreaterThanOrEqual(0); // waiting never costs you (the idle partner adds nothing)
    expect(miss('girar')).toBeLessThan(miss('levantar'));
    expect(miss('levantar')).toBeLessThan(miss('puxar'));
    expect(miss('puxar')).toBeLessThan(0);
  });

  it('speed matters: a quick right answer pushes harder than a slow one', () => {
    const rng = mulberry32(2);
    const fast = resolveExchange(newBoutState(), input({ elapsedMs: 1500 }), idle, rng);
    const slow = resolveExchange(newBoutState(), input({ elapsedMs: 13_000 }), idle, rng);
    expect(fast.yours.speed).toBe(1);
    expect(fast.yours.fast).toBe(true);
    expect(slow.yours.fast).toBe(false);
    expect(fast.delta).toBeGreaterThan(slow.delta);
    // a slow right answer still beats a miss
    expect(slow.delta).toBeGreaterThan(resolveExchange(newBoutState(), input({ correct: false }), idle, rng).delta);
  });

  it('momentum decays toward the middle when nothing happens', () => {
    const st: BoutState = { ...newBoutState(), momentum: 20 };
    const r = resolveExchange(st, input({ intent: 'esperar', correct: false }), idle, mulberry32(3));
    expect(r.state.momentum).toBeLessThan(20);
    expect(r.state.momentum).toBeGreaterThan(0);
  });

  it('crossing the threshold moves one rung, leaves a carry, and never moves two', () => {
    const st: BoutState = { ...newBoutState(), momentum: MOMENTUM_THRESHOLD - 1 };
    const r = resolveExchange(st, input({ intent: 'girar', elapsedMs: 500 }), idle, mulberry32(4));
    expect(r.state.rung).toBe(1);
    expect(r.state.momentum).toBe(MOMENTUM_CARRY);
    const t = r.events.find((e) => e.type === 'transition');
    expect(t).toMatchObject({ type: 'transition', from: 'de_pe', to: 'guarda_fechada', rungFrom: 0, rungTo: 1, gain: 'you' });
    // an enormous push still takes one rung
    const big = resolveExchange({ ...newBoutState(), momentum: 100 }, input({ intent: 'girar' }), idle, mulberry32(5));
    expect(big.state.rung).toBe(1);
  });

  it('the top of the ladder holds: no rung beyond 4, and the intent names the top position', () => {
    const top = { ...newBoutState(), rung: 3, momentum: 90 };
    const montada = resolveExchange(top, input({ intent: 'levantar' }), idle, mulberry32(6));
    expect(montada.state.rung).toBe(4);
    expect(montada.state.top).toBe('montada');
    const costas = resolveExchange(top, input({ intent: 'girar' }), idle, mulberry32(6));
    expect(costas.state.top).toBe('costas');
    expect(positionOf(costas.state).id).toBe('costas');
    const more = resolveExchange({ ...top, rung: 4, momentum: 90 }, input({ intent: 'girar' }), idle, mulberry32(7));
    expect(more.state.rung).toBe(4);
  });

  it('the partner pushing you back crosses the other way (and the bottom of the ladder holds)', () => {
    const strong = { ...rafael, accuracy: 1, speed: 1 };
    let st: BoutState = newBoutState();
    const rng = mulberry32(8);
    for (let i = 0; i < 40; i++) st = resolveExchange(st, input({ intent: 'segurar', correct: false, elapsedMs: 14_000 }), strong, rng).state;
    expect(st.rung).toBe(-RUNG_MAX);
    expect(st.points.partner).toBeGreaterThan(0);
    expect(st.points.you).toBe(0);
  });

  it('is deterministic for a seed and never mutates its input', () => {
    const st = newBoutState();
    const frozen = JSON.stringify(st);
    const a = resolveExchange(st, input(), mateus, mulberry32(9));
    const b = resolveExchange(st, input(), mateus, mulberry32(9));
    expect(a).toEqual(b);
    expect(JSON.stringify(st)).toBe(frozen);
  });
});

describe('scoring in the manner of BJJ, announced in Portuguese', () => {
  const climb = (from: number): { events: ReturnType<typeof resolveExchange>['events']; state: BoutState } =>
    resolveExchange({ ...newBoutState(), rung: from, momentum: 80 }, input({ intent: 'levantar' }), idle, mulberry32(10));

  it('2 for the takedown, 3 for the pass, 2 for the knee, 4 for the top', () => {
    expect(POINTS_FOR_RUNG).toEqual({ 1: 2, 2: 3, 3: 2, 4: 4 });
    for (const [from, pts, signal] of [[0, 2, 'pontos2'], [1, 3, 'pontos3'], [2, 2, 'pontos2'], [3, 4, 'pontos4']] as const) {
      const r = climb(from);
      expect(r.state.points.you, `rung ${from} -> ${from + 1}`).toBe(pts);
      expect(r.events.find((e) => e.type === 'points')).toMatchObject({ type: 'points', side: 'you', pts, signal, line: REF_LINES[signal] });
    }
  });

  it('the partner scores when it climbs; backing off scores nothing', () => {
    const r = resolveExchange({ ...newBoutState(), rung: -1, momentum: -80 }, input({ intent: 'esperar', correct: false }), { ...rafael, accuracy: 1, speed: 1 }, mulberry32(11));
    expect(r.state.rung).toBe(-2);
    expect(r.state.points.partner).toBe(3);
    // you push the partner back from -2 to -1: no points to anyone
    const back = resolveExchange({ ...newBoutState(), rung: -2, momentum: 80 }, input({ intent: 'levantar' }), idle, mulberry32(12));
    expect(back.state.rung).toBe(-1);
    expect(back.state.points).toEqual({ you: 0, partner: 0 });
    expect(back.events.some((e) => e.type === 'points')).toBe(false);
    expect(back.events.find((e) => e.type === 'transition')).toMatchObject({ gain: null });
    // from +1 back to standing: nothing
    const stand = resolveExchange({ ...newBoutState(), rung: 1, momentum: -80 }, input({ intent: 'esperar', correct: false }), { ...rafael, accuracy: 1, speed: 1 }, mulberry32(13));
    expect(stand.state.rung).toBe(0);
    expect(stand.state.points).toEqual({ you: 0, partner: 0 });
  });

  it('an advantage for pressing close, once per rung and side', () => {
    const st = { ...newBoutState(), momentum: MOMENTUM_NEAR - 3 };
    const r = resolveExchange(st, input({ intent: 'puxar', elapsedMs: 800 }), idle, mulberry32(14));
    if (r.state.rung === 0) {
      expect(r.state.adv.you).toBe(1);
      expect(r.events.find((e) => e.type === 'advantage')).toMatchObject({ side: 'you', line: REF_LINES.vantagem });
      const again = resolveExchange(r.state, input({ intent: 'puxar', elapsedMs: 800 }), idle, mulberry32(15));
      expect(again.state.adv.you).toBe(1);
    } else {
      expect(r.state.points.you).toBe(2);
    }
    // a transition resets it: you can earn another one at the next rung
    const t = resolveExchange({ ...newBoutState(), momentum: 80 }, input({ intent: 'girar' }), idle, mulberry32(16));
    expect(t.state.nearGiven).toEqual({ you: false, partner: false });
  });

  it('Bia calls the points in Portuguese, doubling as number practice', () => {
    expect(REF_LINES.pontos2.pt).toBe('Dois pontos!');
    expect(REF_LINES.pontos3.pt).toBe('Três pontos!');
    expect(REF_LINES.pontos4.pt).toBe('Quatro pontos!');
    expect(REF_LINES.vantagem.pt).toBe('Vantagem!');
    expect(REF_LINES.combate.pt).toBe('Combate!');
    expect([2, 3, 4].map(signalForPoints)).toEqual(['pontos2', 'pontos3', 'pontos4']);
  });

  it('the decision: points, then advantages, then a draw', () => {
    const s = (py: number, pp: number, ay: number, ap: number): BoutState => ({ ...newBoutState(), points: { you: py, partner: pp }, adv: { you: ay, partner: ap } });
    expect(decide(s(4, 2, 0, 5))).toEqual({ winner: 'you', reason: 'pontos' });
    expect(decide(s(2, 4, 5, 0))).toEqual({ winner: 'partner', reason: 'pontos' });
    expect(decide(s(3, 3, 2, 1))).toEqual({ winner: 'you', reason: 'vantagens' });
    expect(decide(s(3, 3, 1, 2))).toEqual({ winner: 'partner', reason: 'vantagens' });
    expect(decide(s(0, 0, 0, 0))).toEqual({ winner: 'draw', reason: 'empate' });
  });

  it('end lines read well in Portuguese and carry no Oss / rola / Gracie', () => {
    const lines = [
      endLine('you', 'finalizacao'),
      endLine('partner', 'finalizacao'),
      endLine('you', 'pontos'),
      endLine('partner', 'pontos'),
      endLine('you', 'vantagens'),
      endLine('partner', 'vantagens'),
      endLine('draw', 'empate'),
      endLine('draw', 'quit'),
      ...Object.values(REF_LINES),
    ];
    for (const l of lines) {
      expect(l.pt.length).toBeGreaterThan(3);
      expect(l.en.length).toBeGreaterThan(3);
      expect(l.pt + l.en).not.toMatch(/\boss\b|\brola\b|gracie/i);
    }
  });
});

describe('pegada, finalização and escape', () => {
  it('fast right answers fill the pegada, a miss drains it, holding fills it even when slower', () => {
    const rng = mulberry32(20);
    let st = newBoutState();
    st = resolveExchange(st, input({ elapsedMs: 800 }), idle, rng).state;
    expect(st.pegada).toBe(1);
    st = resolveExchange(st, input({ elapsedMs: 13_000 }), idle, rng).state;
    expect(st.pegada).toBe(1); // slow: no change
    st = resolveExchange(st, input({ intent: 'segurar', elapsedMs: 13_000 }), idle, rng).state;
    expect(st.pegada).toBe(2);
    st = resolveExchange(st, input({ correct: false }), idle, rng).state;
    expect(st.pegada).toBe(1);
    for (let i = 0; i < 6; i++) st = resolveExchange(st, input({ elapsedMs: 500 }), idle, rng).state;
    expect(st.pegada).toBeLessThanOrEqual(PEGADA_MAX);
    for (let i = 0; i < 6; i++) st = resolveExchange(st, input({ correct: false }), idle, rng).state;
    expect(st.pegada).toBeGreaterThanOrEqual(0);
  });

  it('the finalização chance is the top of the ladder with a full pegada, and nothing less', () => {
    expect(canFinish({ rung: 4, pegada: PEGADA_MAX })).toBe(true);
    expect(canFinish({ rung: 4, pegada: PEGADA_MAX - 1 })).toBe(false);
    expect(canFinish({ rung: 3, pegada: PEGADA_MAX })).toBe(false);
    expect(canFinish({ rung: -4, pegada: PEGADA_MAX })).toBe(false);
    expect(boutOffer({ ...newBoutState(), rung: 4, pegada: PEGADA_MAX }).finish).toBe(true);
    expect(boutOffer(newBoutState()).finish).toBe(false);
    expect(boutOffer(newBoutState()).intents.length).toBeGreaterThanOrEqual(2);
  });

  it('a failed finalização sends the partner back to guard and empties the pegada', () => {
    const st = finishFailed({ ...newBoutState(), rung: 4, pegada: PEGADA_MAX, momentum: 50, points: { you: 11, partner: 0 } });
    expect(st.rung).toBe(1);
    expect(st.pegada).toBe(0);
    expect(st.momentum).toBe(0);
    expect(st.points.you).toBe(11);
    expect(positionOf(st).id).toBe('guarda_fechada');
  });

  it('a pinned player faces an escape only with the partner at the top and its pegada full, by its drive', () => {
    const base = { ...newBoutState(), rung: -4, pegadaB: PEGADA_MAX };
    expect(nextStep({ ...base, pegadaB: PEGADA_MAX - 1 }, rafael, () => 0)).toBe('intent');
    expect(nextStep({ ...base, rung: -3 }, rafael, () => 0)).toBe('intent');
    expect(nextStep(base, rafael, () => 0)).toBe('escape');
    expect(nextStep(base, rafael, () => 0.999)).toBe('intent');
    expect(partnerFinishDrive(rafael)).toBeGreaterThan(partnerFinishDrive(partnerById('daniel')!));
    expect(partnerFinishDrive(rafael)).toBeLessThanOrEqual(1);
    const out = escapeWorked(base);
    expect(out.rung).toBe(-2);
    expect(out.pegadaB).toBe(0);
  });

  it('partners fill their own pegada by winning exchanges', () => {
    const strong = { ...rafael, accuracy: 1, speed: 1, aggression: 1 };
    let st = newBoutState();
    const rng = mulberry32(21);
    for (let i = 0; i < 8; i++) st = resolveExchange(st, input({ correct: false, intent: 'segurar' }), strong, rng).state;
    expect(st.pegadaB).toBeGreaterThanOrEqual(1);
  });
});

describe('the clock', () => {
  it('runs faster than real time, and a quick bout still ends by the exchange cap', () => {
    expect(BOUT_CLOCK_MS).toBe(300_000);
    expect(CLOCK_RATE).toBeGreaterThan(1);
    expect(clockCost(10_000)).toBe((10_000 + RESOLVE_MS) * CLOCK_RATE);
    // a very fast exchange costs at least BOUT_CLOCK_MS / MAX_EXCHANGES
    expect(clockCost(0) * MAX_EXCHANGES).toBeGreaterThanOrEqual(BOUT_CLOCK_MS);
    let st = newBoutState();
    const rng = mulberry32(22);
    for (let i = 0; i < MAX_EXCHANGES; i++) st = resolveExchange(st, input({ spentMs: 0 }), mateus, rng).state;
    expect(st.clockMs).toBe(0);
    expect(nextStep(st, mateus, rng)).toBe('end');
    expect(spendClock(newBoutState(), 10_000).clockMs).toBeLessThan(BOUT_CLOCK_MS);
    expect(formatBoutClock(BOUT_CLOCK_MS)).toBe('5:00');
    expect(formatBoutClock(61_000)).toBe('1:01');
    expect(formatBoutClock(-4)).toBe('0:00');
  });
});

describe('partner profiles', () => {
  it('a partner turn follows its profile: aggression picks bold intents, accuracy and speed show', () => {
    const count = (p: typeof rafael, n = 800) => {
      const rng = mulberry32(31);
      let bold = 0;
      let right = 0;
      let speed = 0;
      for (let i = 0; i < n; i++) {
        const t = partnerTurn(p, 0, rng);
        if (INTENTS[t.intent].risk >= 2) bold++;
        if (t.correct) right++;
        speed += t.speed;
      }
      return { bold: bold / n, right: right / n, speed: speed / n };
    };
    const calm = count(partnerById('helena')!);
    const hot = count(rafael);
    expect(hot.bold).toBeGreaterThan(calm.bold);
    expect(count(partnerById('helena')!).right).toBeGreaterThan(count(partnerById('felipe')!).right);
    expect(count(partnerById('felipe')!).speed).toBeGreaterThan(count(partnerById('helena')!).speed);
    for (const p of PARTNERS) {
      const t = partnerTurn(p, 2, mulberry32(5));
      expect(t.speed).toBeGreaterThan(0);
      expect(t.speed).toBeLessThanOrEqual(1);
      expect(Object.keys(INTENTS)).toContain(t.intent);
    }
  });

  it('a defender blunts your push when you are already ahead (and barely at all at standing)', () => {
    const daniel = partnerById('daniel')!;
    const flat = { ...daniel, defense: 0 };
    const at = (rung: number, p: typeof daniel) => resolveExchange({ ...newBoutState(), rung }, input({ intent: 'levantar', elapsedMs: 500 }), { ...p, accuracy: 0 }, mulberry32(40)).yours.force;
    expect(at(3, daniel)).toBeLessThan(at(3, flat));
    expect(at(0, daniel)).toBeCloseTo(at(0, flat));
  });
});

describe('balance (simulated over seeds: the numbers the design promises)', () => {
  const win = (partner: string, p: SimPlayer, level = 0, n = 400) => {
    let w = 0;
    let secs = 0;
    for (let i = 0; i < n; i++) {
      const r = simulateBout(500 + i, partnerById(partner)!, p, level);
      if (r.winner === 'you') w++;
      secs += r.realMs / 1000;
    }
    return { rate: w / n, secs: secs / n };
  };
  const learner: SimPlayer = { accuracy: 0.75, usedShare: 0.45, policy: 'mixed' };
  const good: SimPlayer = { accuracy: 0.9, usedShare: 0.3, policy: 'bold' };
  const weak: SimPlayer = { accuracy: 0.5, usedShare: 0.6, policy: 'mixed' };

  it('a careless player mostly loses, a learner is competitive, a good bold player mostly wins, against every partner', () => {
    for (const p of PARTNERS) {
      expect(win(p.id, weak).rate, `${p.id} weak`).toBeLessThan(0.25);
      expect(win(p.id, good).rate, `${p.id} good`).toBeGreaterThan(0.8);
    }
    const first = win('mateus', learner).rate;
    expect(first).toBeGreaterThan(0.4);
    expect(first).toBeLessThan(0.85);
    // the precise and the aggressive partners are the harder ones for the same learner
    expect(win('helena', learner).rate).toBeLessThan(first);
    expect(win('rafael', learner).rate).toBeLessThan(first);
  });

  it('a match lasts two to three minutes of real play', () => {
    for (const player of [learner, good, weak]) {
      const { secs } = win('mateus', player, 0, 150);
      expect(secs).toBeGreaterThan(100);
      expect(secs).toBeLessThan(190);
    }
  });

  it('bold play is a real gamble: it scores more and finishes more than waiting does', () => {
    const rate = (policy: SimPlayer['policy']) => {
      let pts = 0;
      let fin = 0;
      for (let i = 0; i < 300; i++) {
        const r = simulateBout(900 + i, mateus, { ...good, policy });
        pts += r.state.points.you;
        if (r.reason === 'finalizacao' && r.winner === 'you') fin++;
      }
      return { pts: pts / 300, fin: fin / 300 };
    };
    expect(rate('bold').pts).toBeGreaterThan(rate('safe').pts * 3);
    expect(rate('bold').fin).toBeGreaterThan(rate('safe').fin);
  });

  it('is deterministic for a seed', () => {
    expect(simulateBout(5, rafael, learner)).toEqual(simulateBout(5, rafael, learner));
  });
});

describe('crowd cues are short Portuguese shouts and reaction icons', () => {
  it('only the four shouts from the brief, and the three icons', () => {
    expect([...CROWD_SHOUTS].sort()).toEqual(['Boa!', 'Isso!', 'Segura!', 'Vai!']);
    const icons = new Set(Object.values(CROWD).flatMap((c) => c.icons));
    expect([...icons].sort()).toEqual(['🔥', '👏', '😮'].sort());
    for (const c of Object.values(CROWD)) for (const s of c.shouts) expect(CROWD_SHOUTS).toContain(s);
  });
});
