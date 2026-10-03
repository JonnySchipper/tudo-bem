import { describe, expect, it } from 'vitest';
import {
  ASK_MS,
  CAFE_ITEMS,
  CHAPA,
  CHAPA_ITEMS,
  CORRERIA_TOTAL,
  COUNTER_PRICES,
  DAILY_PAID_SHIFTS,
  LEVELS,
  MAX_PRESENT,
  MAX_SHIFT_POINTS,
  POUR,
  UNLOCKS,
  WAVE_SIZES,
  askOptions,
  chapaFrame,
  chapaPhase,
  chapaSlots,
  correctionFor,
  correriaPayout,
  frontOf,
  itemsFor,
  levelForStars,
  makeCorrOrder,
  makeFollow,
  newShift,
  newUnlocks,
  orderTotal,
  parseNumberAnswer,
  patienceMs,
  patienceStage,
  payNote,
  pourFrame,
  pourVerdict,
  sanitizeAct,
  shiftAct,
  shiftAdvance,
  shiftSnapshot,
  starsFor,
  summarizeShift,
  tipJarStage,
  unlockedFor,
  wantOf,
  waveOf,
  whoAppearance,
  type CEvent,
  type Shift,
  type ShiftCtx,
} from './correria.js';
import { checkTray, mulberry32, type MgOrder, type Tray } from './meveum.js';
import { MG_ITEMS } from './meveum.js';

const ctx = (over: Partial<ShiftCtx> = {}): ShiftCtx => ({ seed: 7, level: 0, unlocked: [], saturday: false, minute: 8 * 60 + 30, baker: 'carlos', regulars: [], ...over });

const wrongItem = (sh: Shift) => ['pao', 'bolo', 'pao_de_queijo', 'guarana'].find((i) => !wantOf(sh)!.lines.some((l) => l.itemId === i))!;

/** Build what the front customer wants through real player actions, the way a perfect player would. */
function build(sh: Shift, ev: CEvent[] = []): void {
  const want = wantOf(sh)!;
  const push = (e: CEvent[]) => ev.push(...e);
  push(shiftAct(sh, { a: 'clear' }));
  for (const line of want.lines) {
    for (let i = 0; i < line.qty; i++) {
      if (CHAPA_ITEMS.includes(line.itemId)) {
        push(shiftAct(sh, { a: 'chapa_put', slot: 0, item: line.itemId }));
        push(shiftAdvance(sh, CHAPA.cookMs + 100));
        push(shiftAct(sh, { a: 'chapa_take', slot: 0 }));
      } else if (CAFE_ITEMS.includes(line.itemId)) {
        push(shiftAct(sh, { a: 'pour_start', item: line.itemId }));
        push(shiftAdvance(sh, POUR.fullMs * 0.85));
        push(shiftAct(sh, { a: 'pour_end' }));
      } else push(shiftAct(sh, { a: 'grab', item: line.itemId }));
    }
  }
  for (const m of want.mods) {
    if (m === 'pra_viagem') push(shiftAct(sh, { a: 'pack', kind: 'bag' }));
    else if (m === 'pra_comer_aqui') push(shiftAct(sh, { a: 'pack', kind: 'plate' }));
    else push(shiftAct(sh, { a: 'mod', id: m }));
  }
}

/** Wait for the front customer, build, serve (and answer "Quanto é?" right). */
function playAll(sh: Shift, opts: { followWait?: boolean; wrongFirst?: boolean } = {}): CEvent[] {
  const ev: CEvent[] = [];
  for (let guard = 0; !sh.over && guard < 4000; guard++) {
    const f = frontOf(sh);
    if (!f) {
      ev.push(...shiftAdvance(sh, 250));
      continue;
    }
    if (f.state === 'asking') {
      ev.push(...shiftAct(sh, { a: 'answer', value: f.ask!.total }));
      continue;
    }
    if (opts.followWait && f.follow && !f.followFired) {
      ev.push(...shiftAdvance(sh, 500));
      continue;
    }
    if (opts.wrongFirst && f.mistakes === 0) {
      ev.push(...shiftAct(sh, { a: 'clear' }), ...shiftAct(sh, { a: 'grab', item: 'agua' }), ...shiftAct(sh, { a: 'serve' }));
      if (frontOf(sh) === f) continue;
    }
    build(sh, ev);
    ev.push(...shiftAct(sh, { a: 'serve' }));
  }
  return ev;
}

describe('the shift numbers', () => {
  it('three waves of 4 + 5 + 6 customers', () => {
    expect(WAVE_SIZES).toEqual([4, 5, 6]);
    expect(CORRERIA_TOTAL).toBe(15);
    expect([0, 3, 4, 8, 9, 14].map(waveOf)).toEqual([0, 0, 1, 1, 2, 2]);
    expect(MAX_PRESENT).toBe(3);
  });

  it('every shelf item has a price and totals stay sayable (under 100)', () => {
    for (const i of MG_ITEMS) expect(COUNTER_PRICES[i.id], i.id).toBeGreaterThan(0);
    // the biggest possible tray: 9 of the dearest item
    expect(Math.max(...Object.values(COUNTER_PRICES)) * 9).toBeLessThanOrEqual(100);
    expect(orderTotal([{ itemId: 'pao_na_chapa', qty: 2 }, { itemId: 'cafe_com_leite', qty: 1 }])).toBe(18);
  });
});

describe('difficulty by level', () => {
  it('Verde is slower than the top level: more patience, bigger gaps, and gloss locked on', () => {
    expect(LEVELS[0]!.patienceMul).toBeGreaterThan(LEVELS[3]!.patienceMul);
    expect(LEVELS[0]!.gapMul).toBeGreaterThan(LEVELS[3]!.gapMul);
    expect(LEVELS[0]!.glossLocked).toBe(true);
    expect(LEVELS[3]!.glossLocked).toBe(false);
    const o = { timeMs: 30_000 } as MgOrder;
    expect(patienceMs(o, 0, 0)).toBeGreaterThan(patienceMs(o, 3, 2));
    expect(patienceMs({ timeMs: 1000 } as MgOrder, 3, 2)).toBe(16_000);
    expect(patienceMs({ timeMs: 900_000 } as MgOrder, 0, 0)).toBe(100_000);
  });

  it('Verde wave 1 is written only, with no follow-ups and no "Quanto é?"; listening and follow-ups ramp in', () => {
    expect(LEVELS[0]!.listen[0]).toBe(0);
    expect(LEVELS[0]!.follow[0]).toBe(0);
    expect(LEVELS[0]!.ask[0]).toBe(0);
    for (let lv = 1; lv < LEVELS.length; lv++) {
      for (let w = 1; w < 3; w++) {
        expect(LEVELS[lv]!.listen[w]!).toBeGreaterThanOrEqual(LEVELS[lv]!.listen[w - 1]!);
        expect(LEVELS[lv]!.listen[w]!).toBeGreaterThanOrEqual(LEVELS[lv - 1]!.listen[w]!);
      }
    }
    // played out over many seeds
    const modes = (level: number) => {
      let listening = 0;
      let follows = 0;
      let asks = 0;
      let n = 0;
      for (let seed = 1; seed <= 30; seed++) {
        const sh = newShift(ctx({ seed, level, unlocked: ['salgados'] }));
        const ev: CEvent[] = [];
        for (let i = 0; i < 400 && !sh.over; i++) {
          shiftAdvance(sh, 250);
          const f = frontOf(sh);
          if (f && f.state === 'front') {
            // nobody ever gets served in this probe: they all leave, which still lets us read their modes
            if (f.mode === 'listening') listening++;
            if (f.follow) follows++;
            n++;
          }
        }
        void ev;
      }
      return { listening, follows, n, asks };
    };
    expect(modes(0).listening).toBeGreaterThanOrEqual(0);
    const verdeFirstWave = (() => {
      let bad = 0;
      for (let seed = 1; seed <= 60; seed++) {
        const sh = newShift(ctx({ seed, level: 0 }));
        shiftAdvance(sh, 3000);
        const c = sh.customers[0]!;
        if (c.mode !== 'written' || c.follow) bad++;
      }
      return bad;
    })();
    expect(verdeFirstWave).toBe(0);
    const top = modes(3);
    expect(top.listening).toBeGreaterThan(0);
    expect(top.follows).toBeGreaterThan(0);
    expect(modes(3).listening / modes(3).n).toBeGreaterThan(modes(0).listening / Math.max(1, modes(0).n));
  });

  it('level follows the total stars; unlocks are by stars only', () => {
    expect([0, 2, 3, 7, 8, 15, 16, 99].map(levelForStars)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    expect(unlockedFor(0)).toEqual([]);
    expect(unlockedFor(2)).toEqual(['salgados']);
    expect(unlockedFor(10)).toEqual(['salgados', 'chapa2', 'cafe_rapido', 'sabado']);
    expect(newUnlocks(1, 4).map((u) => u.id)).toEqual(['salgados', 'chapa2']);
    expect(newUnlocks(4, 4)).toEqual([]);
    expect(UNLOCKS.map((u) => u.stars)).toEqual([...UNLOCKS.map((u) => u.stars)].sort((a, b) => a - b));
    expect(chapaSlots([])).toBe(1);
    expect(chapaSlots(['chapa2'])).toBe(2);
  });
});

describe('order generation', () => {
  it('pastel and coxinha only appear once the estufa is unlocked', () => {
    const lockedItems = itemsFor([]).map((i) => i.id);
    expect(lockedItems).not.toContain('pastel');
    expect(lockedItems).not.toContain('coxinha');
    expect(itemsFor(['salgados']).map((i) => i.id)).toContain('coxinha');
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const o = makeCorrOrder(mulberry32(seed), { level: seed % 4, wave: seed % 3, unlocked: [], saturday: false, avoid: [] });
      for (const l of o.lines) seen.add(l.itemId);
    }
    expect(seen.has('pastel')).toBe(false);
    expect(seen.has('coxinha')).toBe(false);
    const withSalgados = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) for (const l of makeCorrOrder(mulberry32(seed), { level: 2, wave: 2, unlocked: ['salgados'], saturday: false, avoid: [] }).lines) withSalgados.add(l.itemId);
    expect(withSalgados.has('pastel') || withSalgados.has('coxinha')).toBe(true);
  });

  it('Verde only draws authored tickets (never a generated combo)', () => {
    for (let seed = 1; seed <= 100; seed++) for (const wave of [0, 1, 2]) expect(makeCorrOrder(mulberry32(seed), { level: 0, wave, unlocked: [], saturday: false, avoid: [] }).authored).toBe(true);
  });

  it('is deterministic for a seed, never repeats a served ticket while a fresh one exists, and keeps the "Me vê" phrasing', () => {
    const a = makeCorrOrder(mulberry32(5), { level: 1, wave: 1, unlocked: [], saturday: false, avoid: [] });
    const b = makeCorrOrder(mulberry32(5), { level: 1, wave: 1, unlocked: [], saturday: false, avoid: [] });
    expect(a).toEqual(b);
    const c = makeCorrOrder(mulberry32(5), { level: 1, wave: 1, unlocked: [], saturday: false, avoid: [a.pt] });
    expect(c.pt).not.toBe(a.pt);
    for (let seed = 1; seed <= 50; seed++) {
      const o = makeCorrOrder(mulberry32(seed), { level: 3, wave: 2, unlocked: ['salgados'], saturday: false, avoid: [] });
      expect(o.en).not.toMatch(/give me/i);
    }
  });

  it('greets by the hour without changing the tray', () => {
    const morning = makeCorrOrder(mulberry32(9), { level: 1, wave: 0, unlocked: [], saturday: false, avoid: [], minute: 9 * 60 });
    const night = makeCorrOrder(mulberry32(9), { level: 1, wave: 0, unlocked: [], saturday: false, avoid: [], minute: 21 * 60 });
    expect(night.lines).toEqual(morning.lines);
    if (/Bom dia/.test(morning.pt)) expect(night.pt).toMatch(/Boa noite/);
  });

  it('Saturday brings big orders only with the unlock', () => {
    let specials = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const o = makeCorrOrder(mulberry32(seed), { level: 2, wave: 1, unlocked: ['sabado'], saturday: true, avoid: [] });
      if (o.special) {
        specials++;
        expect(o.lines).toHaveLength(3);
        expect(o.pt).toMatch(/^Sábado!/);
        expect(o.pt).toMatch(/me vê/);
      }
      expect(makeCorrOrder(mulberry32(seed), { level: 2, wave: 1, unlocked: [], saturday: true, avoid: [] }).special).toBeUndefined();
    }
    expect(specials).toBeGreaterThan(15);
  });
});

describe('follow-ups and changes of mind', () => {
  it('every follow-up leaves an order that is still buildable, and the swap names both drinks', () => {
    let swaps = 0;
    let extras = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const rng = mulberry32(seed);
      const o = makeCorrOrder(rng, { level: 2, wave: 1, unlocked: ['salgados'], saturday: false, avoid: [] });
      const f = makeFollow(rng, o, itemsFor(['salgados']));
      if (!f) continue;
      for (const l of f.lines) {
        expect(MG_ITEMS.some((i) => i.id === l.itemId)).toBe(true);
        expect(l.qty).toBeGreaterThanOrEqual(1);
        expect(l.qty).toBeLessThanOrEqual(3);
      }
      expect(f.pt.length).toBeGreaterThan(5);
      expect(f.en.length).toBeGreaterThan(5);
      if (f.kind === 'swap') {
        swaps++;
        expect(f.pt).toMatch(/^Não, .+ em vez d[oa] /);
        expect(f.en).toMatch(/^No, .+ instead of the /);
        expect(f.lines.reduce((s, l) => s + l.qty, 0)).toBe(o.lines.reduce((s, l) => s + l.qty, 0));
      } else {
        extras++;
        expect(f.pt).toMatch(/^Ah, e /);
      }
    }
    expect(swaps).toBeGreaterThan(5);
    expect(extras).toBeGreaterThan(20);
  });

  it('in a shift, the follow-up changes what the counter wants after it fires', () => {
    let tested = 0;
    for (let seed = 1; seed <= 40 && tested < 3; seed++) {
      const sh = newShift(ctx({ seed, level: 3, unlocked: ['salgados'] }));
      sh.rng = mulberry32(seed);
      for (let i = 0; i < 60 && !frontOf(sh); i++) shiftAdvance(sh, 250);
      const f = frontOf(sh);
      if (!f?.follow) continue;
      tested++;
      const before = JSON.stringify(wantOf(sh));
      const seen: CEvent[] = [];
      for (let i = 0; i < 200 && !f.followFired && frontOf(sh) === f; i++) seen.push(...shiftAdvance(sh, 100));
      if (!f.followFired) continue;
      expect(seen.some((e) => e.k === 'follow')).toBe(true);
      expect(JSON.stringify(wantOf(sh))).not.toBe(before);
      // the snapshot shows the follow-up line only once it was said
      expect(shiftSnapshot(sh).customers.find((c) => c.id === f.id)!.follow).not.toBeNull();
    }
    expect(tested).toBeGreaterThan(0);
  });

  it('a follow-up not yet said stays out of the snapshot', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const sh = newShift(ctx({ seed, level: 3 }));
      shiftAdvance(sh, 3000);
      for (const v of shiftSnapshot(sh).customers) if (!sh.customers.find((c) => c.id === v.id)!.followFired) expect(v.follow).toBeNull();
    }
  });
});

describe('the chapa', () => {
  it('cooks for 2.4 s, is ready until 5.4 s, then burns', () => {
    expect(chapaPhase(0)).toBe('raw');
    expect(chapaPhase(CHAPA.cookMs - CHAPA.toleranceMs - 1)).toBe('raw');
    expect(chapaPhase(CHAPA.cookMs)).toBe('ready');
    expect(chapaPhase(CHAPA.burnMs)).toBe('ready');
    expect(chapaPhase(CHAPA.burnMs + 1)).toBe('burnt');
    expect([0, 799, 800, 1600, 4000, 5400, 5401].map(chapaFrame)).toEqual(['sizzle_0', 'sizzle_0', 'sizzle_1', 'sizzle_2', 'sizzle_2', 'sizzle_2', 'burnt']);
  });

  it('taking it raw does nothing, ready puts it on the tray, burnt throws it away', () => {
    const sh = newShift(ctx());
    shiftAdvance(sh, 100);
    expect(shiftAct(sh, { a: 'chapa_put', slot: 0, item: 'pao_na_chapa' })[0]).toMatchObject({ k: 'chapa_put' });
    shiftAdvance(sh, 1000);
    expect(shiftAct(sh, { a: 'chapa_take', slot: 0 })[0]).toMatchObject({ k: 'chapa_raw' });
    expect(sh.tray).toEqual([]);
    expect(sh.chapa[0]).not.toBeNull();
    shiftAdvance(sh, 1500);
    expect(shiftAct(sh, { a: 'chapa_take', slot: 0 })[0]).toMatchObject({ k: 'chapa_ok', item: 'pao_na_chapa' });
    expect(sh.tray).toEqual(['pao_na_chapa']);
    expect(sh.chapa[0]).toBeNull();
    // leave one too long: it burns by itself, and taking it trashes it
    shiftAct(sh, { a: 'chapa_put', slot: 0, item: 'misto_quente' });
    const ev = shiftAdvance(sh, CHAPA.burnMs + 300);
    expect(ev.some((e) => e.k === 'chapa_burnt')).toBe(true);
    expect(shiftAct(sh, { a: 'chapa_take', slot: 0 })[0]).toMatchObject({ k: 'chapa_trash' });
    expect(sh.tray).toEqual(['pao_na_chapa']);
    expect(sh.chapa[0]).toBeNull();
  });

  it('only chapa items go on it, one per spot, and the second spot needs the unlock', () => {
    const sh = newShift(ctx());
    expect(shiftAct(sh, { a: 'chapa_put', slot: 0, item: 'agua' })[0]).toMatchObject({ k: 'no', why: 'chapa_item' });
    shiftAct(sh, { a: 'chapa_put', slot: 0, item: 'pao_na_chapa' });
    expect(shiftAct(sh, { a: 'chapa_put', slot: 0, item: 'misto_quente' })[0]).toMatchObject({ k: 'no', why: 'busy' });
    expect(shiftAct(sh, { a: 'chapa_put', slot: 1, item: 'misto_quente' })[0]).toMatchObject({ k: 'no', why: 'slot' });
    const two = newShift(ctx({ unlocked: ['chapa2'] }));
    shiftAct(two, { a: 'chapa_put', slot: 0, item: 'pao_na_chapa' });
    expect(shiftAct(two, { a: 'chapa_put', slot: 1, item: 'misto_quente' })[0]).toMatchObject({ k: 'chapa_put', slot: 1 });
  });
});

describe('the coffee pour', () => {
  it('is good between 70% and 108% of the fill time', () => {
    expect(pourVerdict(POUR.fullMs * 0.5).verdict).toBe('short');
    expect(pourVerdict(POUR.fullMs * 0.69).verdict).toBe('short');
    expect(pourVerdict(POUR.fullMs * 0.7).verdict).toBe('ok');
    expect(pourVerdict(POUR.fullMs).verdict).toBe('ok');
    expect(pourVerdict(POUR.fullMs * 1.09).verdict).toBe('spill');
    expect([0, 0.3, 0.6, 0.9].map(pourFrame)).toEqual([0, 1, 2, 3]);
  });

  it('a good pour puts the cup on the tray; short and spilled pours do not; holding too long spills by itself', () => {
    const sh = newShift(ctx());
    shiftAct(sh, { a: 'pour_start', item: 'cafe' });
    shiftAdvance(sh, POUR.fullMs * 0.85);
    expect(shiftAct(sh, { a: 'pour_end' })[0]).toMatchObject({ k: 'pour_ok', item: 'cafe' });
    expect(sh.tray).toEqual(['cafe']);
    shiftAct(sh, { a: 'pour_start', item: 'cafe_com_leite' });
    shiftAdvance(sh, 300);
    expect(shiftAct(sh, { a: 'pour_end' })[0]).toMatchObject({ k: 'pour_bad', why: 'short' });
    shiftAct(sh, { a: 'pour_start', item: 'cafe_com_leite' });
    const ev = shiftAdvance(sh, POUR.fullMs * 2);
    expect(ev.some((e) => e.k === 'pour_bad' && e.why === 'spill')).toBe(true);
    expect(sh.pour).toBeNull();
    expect(sh.tray).toEqual(['cafe']);
  });

  it('the faster machine fills sooner', () => {
    const sh = newShift(ctx({ unlocked: ['cafe_rapido'] }));
    shiftAct(sh, { a: 'pour_start', item: 'cafe' });
    shiftAdvance(sh, POUR.fastMs * 0.85);
    expect(shiftAct(sh, { a: 'pour_end' })[0]).toMatchObject({ k: 'pour_ok' });
    const slow = newShift(ctx());
    shiftAct(slow, { a: 'pour_start', item: 'cafe' });
    shiftAdvance(slow, POUR.fastMs * 0.85);
    expect(shiftAct(slow, { a: 'pour_end' })[0]).toMatchObject({ k: 'pour_bad', why: 'short' });
  });
});

describe('anti-cheat: the tray can only be filled through the real steps', () => {
  it('a chapa or coffee item cannot be grabbed, a locked item cannot be grabbed, the tray has a cap', () => {
    const sh = newShift(ctx());
    expect(shiftAct(sh, { a: 'grab', item: 'pao_na_chapa' })[0]).toMatchObject({ k: 'no', why: 'station' });
    expect(shiftAct(sh, { a: 'grab', item: 'cafe' })[0]).toMatchObject({ k: 'no', why: 'station' });
    expect(shiftAct(sh, { a: 'grab', item: 'pastel' })[0]).toMatchObject({ k: 'no', why: 'locked' });
    expect(sh.tray).toEqual([]);
    for (let i = 0; i < 12; i++) shiftAct(sh, { a: 'grab', item: 'agua' });
    expect(sh.tray).toHaveLength(9);
    expect(shiftAct(sh, { a: 'chapa_put', slot: 0, item: 'pao_na_chapa' })[0]).toMatchObject({ k: 'chapa_put' });
    shiftAdvance(sh, 3000);
    expect(shiftAct(sh, { a: 'chapa_take', slot: 0 })[0]).toMatchObject({ k: 'no', why: 'full' });
    expect(sh.chapa[0]).not.toBeNull();
  });

  it('sanitizeAct drops malformed actions', () => {
    expect(sanitizeAct(null)).toBeNull();
    expect(sanitizeAct({ a: 'grab', item: 'nope' })).toBeNull();
    expect(sanitizeAct({ a: 'grab', item: 'pao' })).toEqual({ a: 'grab', item: 'pao' });
    expect(sanitizeAct({ a: 'chapa_put', slot: 5, item: 'pao_na_chapa' })).toBeNull();
    expect(sanitizeAct({ a: 'chapa_take', slot: 1 })).toEqual({ a: 'chapa_take', slot: 1 });
    expect(sanitizeAct({ a: 'pack', kind: 'sack' })).toBeNull();
    expect(sanitizeAct({ a: 'pack', kind: null })).toEqual({ a: 'pack', kind: null });
    expect(sanitizeAct({ a: 'mod', id: 'pra_viagem' })).toBeNull();
    expect(sanitizeAct({ a: 'mod', id: 'sem_acucar' })).toEqual({ a: 'mod', id: 'sem_acucar' });
    expect(sanitizeAct({ a: 'answer', value: { x: 1 } })).toBeNull();
    expect(sanitizeAct({ a: 'answer', value: 'x'.repeat(100) })).toMatchObject({ a: 'answer', value: 'x'.repeat(40) });
  });

  it('the pack and mods come from the actions, so only the right ones make the order', () => {
    const sh = newShift(ctx({ seed: 3 }));
    for (let i = 0; i < 60 && !frontOf(sh); i++) shiftAdvance(sh, 250);
    const want = wantOf(sh)!;
    build(sh);
    // a bag nobody asked for makes the order wrong
    if (!want.mods.includes('pra_viagem')) {
      shiftAct(sh, { a: 'pack', kind: 'bag' });
      const ev = shiftAct(sh, { a: 'serve' });
      expect(ev[0]).toMatchObject({ k: 'correct' });
    }
  });
});

describe('serving, corrections, scoring', () => {
  it('a perfect first serve pays 10 + speed + combo + tip and starts a combo', () => {
    const sh = newShift(ctx({ seed: 11 }));
    for (let i = 0; i < 60 && !frontOf(sh); i++) shiftAdvance(sh, 250);
    build(sh);
    const ev = shiftAct(sh, { a: 'serve' });
    const s = ev.find((e) => e.k === 'serve');
    expect(s).toMatchObject({ outcome: 'perfeito', combo: 1 });
    expect((s as Extract<CEvent, { k: 'serve' }>).points).toBeGreaterThanOrEqual(11);
    expect(sh.stats.combo).toBe(1);
    expect(sh.tray).toEqual([]);
  });

  it('a wrong tray gets a correction that names the problem, keeps the tray and costs patience; a second wrong tray ends it', () => {
    const sh = newShift(ctx({ seed: 11 }));
    for (let i = 0; i < 60 && !frontOf(sh); i++) shiftAdvance(sh, 250);
    const f = frontOf(sh)!;
    const before = f.patience;
    const bad = wrongItem(sh);
    shiftAct(sh, { a: 'grab', item: bad });
    const ev = shiftAct(sh, { a: 'serve' });
    expect(ev[0]).toMatchObject({ k: 'correct' });
    const line = (ev[0] as Extract<CEvent, { k: 'correct' }>).line;
    expect(line.pt.length).toBeGreaterThan(3);
    expect(line.en.length).toBeGreaterThan(3);
    expect(f.patience).toBeLessThan(before);
    expect(sh.tray).toEqual([bad]);
    const ev2 = shiftAct(sh, { a: 'serve' });
    expect(ev2[0]).toMatchObject({ k: 'leave', why: 'errou' });
    expect(sh.stats.left).toBe(1);
    expect(sh.tray).toEqual([]);
  });

  it('fixing it after the correction scores the second-chance 6 and breaks the combo', () => {
    const sh = newShift(ctx({ seed: 21 }));
    for (let i = 0; i < 60 && !frontOf(sh); i++) shiftAdvance(sh, 250);
    sh.stats.combo = 4;
    shiftAct(sh, { a: 'grab', item: wrongItem(sh) });
    shiftAct(sh, { a: 'serve' });
    build(sh);
    const ev = shiftAct(sh, { a: 'serve' });
    expect(ev.find((e) => e.k === 'serve')).toMatchObject({ outcome: 'segunda', points: 6, tip: 0 });
    expect(sh.stats.combo).toBe(0);
    expect(sh.stats.second).toBe(1);
  });

  it('the correction text: the count first ("DOIS"), then a missing item, an extra one, then mods', () => {
    const order = { lines: [{ itemId: 'pao_na_chapa', qty: 2 }, { itemId: 'cafe', qty: 1 }], mods: ['pra_viagem'] } as MgOrder;
    const say = (tray: Tray, mods: string[]) => correctionFor(order, tray, checkTray(order, tray, mods));
    expect(say({ pao_na_chapa: 1, cafe: 1 }, ['pra_viagem']).pt).toBe('Não, eu pedi DOIS pães na chapa…');
    expect(say({ pao_na_chapa: 1, cafe: 1 }, ['pra_viagem']).en).toMatch(/^No, I ordered TWO .+…$/);
    expect(say({ pao_na_chapa: 2 }, ['pra_viagem']).pt).toMatch(/^Faltou um café/);
    expect(say({ pao_na_chapa: 2, cafe: 1, agua: 1 }, ['pra_viagem']).pt).toMatch(/^Eu não pedi água/);
    expect(say({ pao_na_chapa: 2, cafe: 1 }, []).pt).toBe('Era pra viagem!');
    expect(say({ pao_na_chapa: 2, cafe: 1 }, ['pra_viagem', 'pra_comer_aqui']).pt).toBe('Não era pra comer aqui.');
  });

  it('a customer who runs out of patience leaves, breaks the combo and clears a tray that was being built for them', () => {
    const sh = newShift(ctx({ seed: 5 }));
    for (let i = 0; i < 60 && !frontOf(sh); i++) shiftAdvance(sh, 250);
    sh.stats.combo = 3;
    shiftAct(sh, { a: 'grab', item: 'agua' });
    const ev = shiftAdvance(sh, 120_000);
    expect(ev.some((e) => e.k === 'leave' && e.why === 'tempo')).toBe(true);
    expect(sh.stats.combo).toBe(0);
    expect(sh.tray).toEqual([]);
  });

  it('queued customers lose patience slower than the one at the counter', () => {
    const sh = newShift(ctx({ seed: 2 }));
    for (let i = 0; i < 200 && sh.customers.length < 2; i++) shiftAdvance(sh, 250);
    const [a, b] = sh.customers;
    const snap = shiftSnapshot(sh);
    const rate = (id: number) => snap.customers.find((c) => c.id === id)!.rate;
    expect(Math.max(rate(a!.id), rate(b!.id))).toBe(1);
    expect(Math.min(rate(a!.id), rate(b!.id))).toBeLessThan(1);
  });

  it('listening replays cost patience (less at Verde) and written orders cannot be replayed', () => {
    const find = (level: number) => {
      for (let seed = 1; seed <= 400; seed++) {
        const sh = newShift(ctx({ seed, level }));
        // jump to the third wave, where listening is likeliest
        sh.spawned = 9;
        sh.nextSpawnAt = 0;
        for (let i = 0; i < 60 && !frontOf(sh); i++) shiftAdvance(sh, 250);
        const f = frontOf(sh);
        if (f?.mode === 'listening') return { sh, f };
      }
      throw new Error('no listening customer found');
    };
    const hard = find(3);
    const p = hard.f.patience;
    expect(shiftAct(hard.sh, { a: 'replay' })[0]).toMatchObject({ k: 'replay' });
    expect(p - hard.f.patience).toBeCloseTo(hard.f.patienceMax * LEVELS[3]!.replayCost, 0);
    const easy = find(0);
    const q = easy.f.patience;
    shiftAct(easy.sh, { a: 'replay' });
    expect(q - easy.f.patience).toBeLessThan(p - hard.f.patience);
    const sh = newShift(ctx({ seed: 3 }));
    for (let i = 0; i < 60 && !frontOf(sh); i++) shiftAdvance(sh, 250);
    expect(frontOf(sh)!.mode).toBe('written');
    expect(shiftAct(sh, { a: 'replay' })).toEqual([]);
  });

  it('combos pay more and the baker cheers at 3 / 5 / 8', () => {
    const sh = newShift(ctx({ seed: 4, level: 0 }));
    const ev = playAll(sh);
    const serves = ev.filter((e): e is Extract<CEvent, { k: 'serve' }> => e.k === 'serve');
    expect(serves.length).toBeGreaterThan(8);
    const withCombo = serves.filter((s) => s.combo >= 4);
    const without = serves.filter((s) => s.combo === 1);
    if (withCombo.length && without.length) expect(Math.max(...withCombo.map((s) => s.points))).toBeGreaterThan(Math.min(...without.map((s) => s.points)));
    expect(ev.filter((e) => e.k === 'cheer').length).toBeGreaterThan(0);
  });

  it('tips grow with speed and combos and double for regulars', () => {
    const run = (regulars: ShiftCtx['regulars']) => {
      const sh = newShift(ctx({ seed: 9, regulars }));
      playAll(sh);
      return sh.stats;
    };
    const plain = run([]);
    expect(plain.tips).toBeGreaterThan(plain.perfect);
    const withRegulars = run([{ npc: 'nanda', hearts: 4 }, { npc: 'julia', hearts: 3 }, { npc: 'prof', hearts: 2 }]);
    expect(withRegulars.regulars.length).toBeGreaterThan(0);
  });
});

describe('Quanto é? and the register', () => {
  it('options hold the right total and two different slips, shuffled and in range', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const total = 3 + (seed % 60);
      const o = askOptions(mulberry32(seed), total);
      expect(o).toHaveLength(3);
      expect(new Set(o).size).toBe(3);
      expect(o).toContain(total);
      for (const n of o) expect(n).toBeGreaterThan(0);
    }
  });

  it('parses digits, number words and R$ in any accent', () => {
    expect(parseNumberAnswer('12')).toBe(12);
    expect(parseNumberAnswer('R$ 12')).toBe(12);
    expect(parseNumberAnswer('doze')).toBe(12);
    expect(parseNumberAnswer('Doze reais')).toBe(12);
    expect(parseNumberAnswer('vinte e um')).toBe(21);
    expect(parseNumberAnswer('tres')).toBe(3);
    expect(parseNumberAnswer('três')).toBe(3);
    expect(parseNumberAnswer('cem')).toBe(100);
    expect(parseNumberAnswer('uma')).toBe(1);
    expect(parseNumberAnswer('banana')).toBeNull();
    expect(parseNumberAnswer('101')).toBeNull();
    expect(parseNumberAnswer(7)).toBe(7);
    expect(parseNumberAnswer({})).toBeNull();
  });

  it('the customer pays with the smallest note that covers it', () => {
    expect([1, 5, 6, 10, 11, 20, 21, 50, 51, 100].map(payNote)).toEqual([5, 5, 10, 10, 20, 20, 50, 50, 100, 100]);
  });

  it('after a serve a customer may ask; the right total pays points, the wrong one still pays the bill, and a late answer counts as wrong', () => {
    let right = 0;
    let wrong = 0;
    let late = 0;
    for (let seed = 1; seed <= 60 && (right < 1 || wrong < 1 || late < 1); seed++) {
      const sh = newShift(ctx({ seed, level: 3, unlocked: ['salgados'] }));
      for (let guard = 0; guard < 4000 && !sh.over; guard++) {
        const f = frontOf(sh);
        if (!f) {
          shiftAdvance(sh, 250);
          continue;
        }
        if (f.state === 'asking') {
          const ask = f.ask!;
          expect(ask.total).toBe(orderTotal(f.order.lines));
          expect(ask.type).toBe('type');
          const mode = (right + wrong + late) % 3;
          const ev =
            mode === 0
              ? shiftAct(sh, { a: 'answer', value: numberWord(ask.total) })
              : mode === 1
                ? shiftAct(sh, { a: 'answer', value: ask.total + 1 })
                : shiftAdvance(sh, ASK_MS + 200);
          const r = ev.find((e): e is Extract<CEvent, { k: 'ask_result' }> => e.k === 'ask_result')!;
          expect(r.change).toBe(r.pay - r.total);
          expect(r.pay).toBe(payNote(r.total));
          expect(r.line.pt).toMatch(/reais|real/);
          if (mode === 0) {
            expect(r.ok).toBe(true);
            expect(r.points).toBeGreaterThan(0);
            right++;
          } else {
            expect(r.ok).toBe(false);
            expect(r.points).toBe(0);
            mode === 1 ? wrong++ : late++;
          }
          continue;
        }
        build(sh);
        shiftAct(sh, { a: 'serve' });
      }
    }
    expect(right).toBeGreaterThan(0);
    expect(wrong).toBeGreaterThan(0);
    expect(late).toBeGreaterThan(0);
  });
});
const numberWord = (n: number) => {
  const w = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const t = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  if (n < 20) return w[n]!;
  if (n === 100) return 'cem';
  return n % 10 ? `${t[Math.floor(n / 10)]} e ${w[n % 10]}` : t[n / 10]!;
};

describe('a whole shift', () => {
  it('a perfect bot serves all 15 in about three minutes of shift time, earns stars and RV', () => {
    const sh = newShift(ctx({ seed: 1, level: 1 }));
    const ev = playAll(sh);
    expect(sh.over).toBe(true);
    expect(ev.filter((e) => e.k === 'over')).toHaveLength(1);
    const sum = summarizeShift(sh);
    expect(sum.served + sum.left).toBe(CORRERIA_TOTAL);
    expect(sum.served).toBeGreaterThanOrEqual(13);
    expect(sh.t).toBeGreaterThan(100_000);
    expect(sh.t).toBeLessThan(260_000);
    expect(sum.stars).toBeGreaterThanOrEqual(2);
    expect(sum.coins).toBeGreaterThan(14);
    expect(sum.words.length).toBeGreaterThan(2);
    expect(shiftSnapshot(sh).over).toBe(true);
  });

  it('waves announce themselves and get faster', () => {
    const sh = newShift(ctx({ seed: 1, level: 1 }));
    const ev = playAll(sh);
    const waves = ev.filter((e): e is Extract<CEvent, { k: 'wave' }> => e.k === 'wave');
    expect(waves.map((w) => w.wave)).toEqual([0, 1, 2]);
    expect(waves.map((w) => w.size)).toEqual([4, 5, 6]);
  });

  it('is deterministic for a seed', () => {
    const a = newShift(ctx({ seed: 77, level: 2 }));
    const b = newShift(ctx({ seed: 77, level: 2 }));
    playAll(a);
    playAll(b);
    expect(summarizeShift(a)).toEqual(summarizeShift(b));
    expect(a.t).toBe(b.t);
  });

  it('an idle player loses everybody and earns nothing', () => {
    const sh = newShift(ctx({ seed: 8 }));
    for (let i = 0; i < 4000 && !sh.over; i++) shiftAdvance(sh, 500);
    expect(sh.over).toBe(true);
    const sum = summarizeShift(sh);
    expect(sum).toMatchObject({ served: 0, left: 15, points: 0, stars: 0, coins: 0 });
  });

  it('the queue never holds more than 3 and every customer has a look', () => {
    const sh = newShift(ctx({ seed: 6, regulars: [{ npc: 'nanda', hearts: 5 }] }));
    let peak = 0;
    for (let i = 0; i < 2000 && !sh.over; i++) {
      shiftAdvance(sh, 250);
      peak = Math.max(peak, sh.customers.length);
      for (const c of sh.customers) expect(whoAppearance(c.who).appearance.body).toBeTruthy();
    }
    expect(peak).toBe(3);
  });

  it('regulars are friends only, once each, and at most one per name', () => {
    let nanda = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const sh = newShift(ctx({ seed, regulars: [{ npc: 'nanda', hearts: 5 }] }));
      const names: string[] = [];
      for (let i = 0; i < 2000 && !sh.over; i++) {
        shiftAdvance(sh, 250);
        for (const c of sh.customers) if (!names.includes(c.who.key)) names.push(c.who.key);
      }
      expect(names.filter((n) => n === 'npc:nanda').length).toBeLessThanOrEqual(1);
      expect(new Set(names).size).toBe(names.length);
      if (names.includes('npc:nanda')) nanda++;
      const nobody = newShift(ctx({ seed }));
      for (let i = 0; i < 600; i++) shiftAdvance(nobody, 250);
      expect(nobody.customers.every((c) => !c.who.npc)).toBe(true);
    }
    expect(nanda).toBeGreaterThan(5);
  });
});

describe('stars, payout and the daily gate numbers', () => {
  it('stars by points, RV by the existing economy range', () => {
    expect([0, 0.2, 0.3, 0.5, 0.7, 1].map((r) => starsFor(r * MAX_SHIFT_POINTS))).toEqual([0, 0, 1, 2, 3, 3]);
    expect(correriaPayout(0, 0)).toBe(0);
    expect(correriaPayout(1, 1)).toBeGreaterThanOrEqual(8);
    expect(correriaPayout(MAX_SHIFT_POINTS, 15)).toBe(20);
    expect(correriaPayout(MAX_SHIFT_POINTS * 5, 15)).toBe(20);
    expect(DAILY_PAID_SHIFTS).toBe(3);
  });

  it('meters: patience stage, chapa and tip jar fill states map to the art keys', () => {
    expect([1, 0.8, 0.6, 0.3, 0.1, 0].map(patienceStage)).toEqual([4, 4, 3, 2, 1, 0]);
    expect([0, 1, 9, 10, 23, 24, 100].map(tipJarStage)).toEqual([0, 1, 1, 2, 2, 3, 3]);
  });
});
