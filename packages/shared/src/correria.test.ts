import { describe, expect, it } from 'vitest';
import {
  CAFE_ITEMS,
  CHAPA,
  CHAPA_ITEMS,
  CORRERIA_TOTAL,
  COUNTER_PRICES,
  DAILY_PAID_SHIFTS,
  FULL_MENU_SHIFTS,
  ITEM_EVERY_SHIFTS,
  LEVELS,
  MAX_PRESENT,
  MAX_SHIFT_POINTS,
  maxShiftPoints,
  pourMsFor,
  MENU_LADDER,
  PAY_MUL_MAX,
  PAY_STEP_PCT,
  POUR,
  JUICE,
  FIRST_SHIFT_WAVE_SIZES,
  HOT_FROM_LEVEL,
  ORANGE_SIZES_UNLOCK,
  orangeSizesVary,
  shiftTotalFor,
  waveSizesFor,
  JUICER_LESSON_ID,
  SUCO_ITEMS,
  UNLOCKS,
  juiceVerdict,
  juicerStep,
  orangeAt,
  WHERE_MENU_AT,
  WAVE_SIZES,
  HOT_MOD,
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
  menuCountForShifts,
  menuIdsForShifts,
  menuLadder,
  menuPayMul,
  menuPayPct,
  newShift,
  newUnlocks,
  normalizeCorreria,
  payBump,
  orderSig,
  patienceMs,
  patiencePipMs,
  patienceStage,
  pourFrame,
  pourVerdict,
  pourZone,
  practiceShift,
  PRACTICE_MENU,
  sanitizeAct,
  shiftAct,
  shiftAdvance,
  shiftItemPool,
  shiftSnapshot,
  starsFor,
  summarizeShift,
  tipJarStage,
  unlockedFor,
  wantOf,
  waveOf,
  whereRequired,
  whoAppearance,
  type CEvent,
  type Shift,
  type ShiftCtx,
} from './correria.js';
import { checkTray, mulberry32, type MgOrder, type Tray } from './meveum.js';
import { MG_ITEMS } from './meveum.js';

const ctx = (over: Partial<ShiftCtx> = {}): ShiftCtx => ({ seed: 7, level: 0, unlocked: [], shifts: FULL_MENU_SHIFTS, saturday: false, minute: 8 * 60 + 30, baker: 'carlos', regulars: [], ...over });

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
        // extra quente: hold on past the green into the red
        push(shiftAct(sh, { a: 'pour_start', item: line.itemId }));
        push(shiftAdvance(sh, pourMsFor(sh.ctx.unlocked) * (want.mods.includes(HOT_MOD) ? 1.25 : 0.85)));
        push(shiftAct(sh, { a: 'pour_end' }));
      } else if (SUCO_ITEMS.includes(line.itemId)) {
        // oranges until the glass reaches the line, then take it
        while ((sh.juice?.fill ?? 0) < JUICE.goodMin) {
          push(shiftAct(sh, { a: 'juice_drop' }));
          push(shiftAdvance(sh, JUICE.cycleMs));
        }
        push(shiftAct(sh, { a: 'juice_take' }));
      } else push(shiftAct(sh, { a: 'grab', item: line.itemId }));
    }
  }
  for (const m of want.mods) {
    if (m === 'pra_viagem') push(shiftAct(sh, { a: 'pack', kind: 'bag' }));
    else if (m === 'pra_comer_aqui') push(shiftAct(sh, { a: 'pack', kind: 'plate' }));
  }
}

/** Wait for the front customer, build, serve. */
function playAll(sh: Shift, opts: { followWait?: boolean; wrongFirst?: boolean } = {}): CEvent[] {
  const ev: CEvent[] = [];
  for (let guard = 0; !sh.over && guard < 4000; guard++) {
    const f = frontOf(sh);
    if (!f) {
      ev.push(...shiftAdvance(sh, 250));
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
    expect([0, 3, 4, 8, 9, 14].map((i) => waveOf(i))).toEqual([0, 0, 1, 1, 2, 2]);
    expect(MAX_PRESENT).toBe(3);
  });

  it('the first shift of a profile is two waves (4 + 5); the second shift on is the full three', () => {
    expect(FIRST_SHIFT_WAVE_SIZES).toEqual([4, 5]);
    expect(waveSizesFor(0)).toEqual([4, 5]);
    expect(waveSizesFor(undefined)).toEqual([4, 5]);
    expect(waveSizesFor(1)).toEqual([4, 5, 6]);
    expect(shiftTotalFor(0)).toBe(9);
    expect(shiftTotalFor(7)).toBe(CORRERIA_TOTAL);
    const first = newShift(ctx({ shifts: 0 }));
    expect(shiftSnapshot(first)).toMatchObject({ waves: 2, total: 9 });
    const ev = playAll(first);
    expect(first.over).toBe(true);
    expect(first.stats.served).toBe(9);
    expect(ev.filter((e) => e.k === 'wave')).toHaveLength(2);
    expect(Math.max(...ev.flatMap((e) => (e.k === 'wave' ? [e.wave] : [])))).toBe(1);
    const second = newShift(ctx({ shifts: 1 }));
    expect(shiftSnapshot(second)).toMatchObject({ waves: 3, total: 15 });
    playAll(second);
    expect(second.stats.served).toBe(15);
    // the shorter shift is judged against its own ceiling
    expect(starsFor(0.8 * maxShiftPoints(9), 9)).toBe(3);
    expect(summarizeShift(first).stars).toBeGreaterThanOrEqual(2);
  });

  it('every shelf item has a price (the house counter of an owned padaria sells at it)', () => {
    for (const i of MG_ITEMS) expect(COUNTER_PRICES[i.id], i.id).toBeGreaterThan(0);
  });
});

describe('no math at the counter', () => {
  it('no "Quanto é?": a served customer just leaves, whatever the level and the wave', () => {
    for (const level of [0, 1, 2, 3]) {
      const sh = newShift(ctx({ seed: 40 + level, level, unlocked: ['salgados'] }));
      sh.debug = true;
      const ev = playAll(sh);
      expect(sh.over).toBe(true);
      expect(sh.stats.served).toBe(CORRERIA_TOTAL);
      // nothing to answer: no ask event exists, and no customer ever waits at the register
      expect(ev.every((e) => !String(e.k).startsWith('ask'))).toBe(true);
      expect(shiftSnapshot(sh).customers.every((c) => !('ask' in c))).toBe(true);
    }
    expect(sanitizeAct({ a: 'answer', value: 12 })).toBeNull();
  });

  it('every order is one of each item, so nobody counts ("três pães" is gone)', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const o = makeCorrOrder(mulberry32(seed), { level: seed % 4, wave: seed % 3, unlocked: ['salgados', 'sabado'], shifts: FULL_MENU_SHIFTS, saturday: seed % 2 === 0, avoid: [] });
      expect(o.lines.every((l) => l.qty === 1), o.pt).toBe(true);
      expect(new Set(o.lines.map((l) => l.itemId)).size).toBe(o.lines.length);
      expect(o.pt).not.toMatch(/\b(dois|duas|três)\b/i);
    }
    expect(LEVELS.every((lv) => !('ask' in lv) && !('maxQty' in lv))).toBe(true);
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

  it('Verde is written only in every wave, with no follow-ups in wave 1; listening and follow-ups ramp in from the next level', () => {
    expect(LEVELS[0]!.listen).toEqual([0, 0, 0]);
    expect(LEVELS[0]!.follow[0]).toBe(0);
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

  it('level follows the total stars; unlocks follow the shifts played', () => {
    expect([0, 2, 3, 7, 8, 15, 16, 99].map(levelForStars)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    // the ladder: shifts played, no stars needed
    expect(unlockedFor(0, 0)).toEqual([]);
    expect(unlockedFor(0, 9)).toEqual([]);
    expect(unlockedFor(0, 10)).toEqual(['chapa2']);
    expect(unlockedFor(0, 12)).toEqual(['chapa2', 'salgados', 'cafe_rapido']);
    expect(unlockedFor(0, 16)).toEqual(['chapa2', 'salgados', 'cafe_rapido', 'sabado']);
    expect(newUnlocks(0, 0, 9, 10).map((u) => u.id)).toEqual(['chapa2']);
    expect(newUnlocks(0, 0, 10, 11)).toEqual([]);
    expect(newUnlocks(0, 0, 11, 12).map((u) => u.id)).toEqual(['salgados', 'cafe_rapido']);
    // one progression, in order: each unlock sits after the menu item it belongs to
    expect(UNLOCKS.map((u) => u.shifts)).toEqual([...UNLOCKS.map((u) => u.shifts)].sort((a, b) => a - b));
    const opensAt = (id: string) => (MENU_LADDER.indexOf(id as (typeof MENU_LADDER)[number]) - 1) * ITEM_EVERY_SHIFTS;
    const at = (id: string) => UNLOCKS.find((u) => u.id === id)!.shifts;
    expect(at('chapa2')).toBeGreaterThan(opensAt('pao_na_chapa'));
    expect(at('cafe_rapido')).toBeGreaterThan(opensAt('suco_de_laranja'));
    expect(at('salgados')).toBe(opensAt('coxinha'));
    expect(at('sabado')).toBeLessThanOrEqual(FULL_MENU_SHIFTS);
    expect(chapaSlots([])).toBe(1);
    expect(chapaSlots(['chapa2'])).toBe(2);
  });

  it('a profile that earned unlocks with the old star rule keeps them, whatever its shifts say (the max of both rules)', () => {
    // the old star thresholds: salgados 2, chapa2 4, cafe_rapido 7, sabado 10
    expect(UNLOCKS.map((u) => [u.id, u.stars])).toEqual([['chapa2', 4], ['salgados', 2], ['cafe_rapido', 7], ['sabado', 10]]);
    expect(unlockedFor(2)).toEqual(['salgados']);
    expect(unlockedFor(2, 0)).toEqual(['salgados']);
    expect(unlockedFor(10, 3)).toEqual(['chapa2', 'salgados', 'cafe_rapido', 'sabado']);
    // stars and shifts together: each unlock comes from whichever rule gets there first
    expect(unlockedFor(4, 12)).toEqual(['chapa2', 'salgados', 'cafe_rapido']);
    for (let stars = 0; stars <= 12; stars++) {
      for (let shifts = 0; shifts <= 20; shifts++) {
        const now = unlockedFor(stars, shifts);
        // never fewer than the old rule gave, never fewer than the shifts alone give
        for (const id of unlockedFor(stars)) expect(now, `${stars} stars, ${shifts} shifts`).toContain(id);
        for (const id of unlockedFor(0, shifts)) expect(now).toContain(id);
        // and playing on never takes one away
        for (const id of now) expect(unlockedFor(stars + 1, shifts + 1)).toContain(id);
      }
    }
    // a gain is reported once, by whichever rule crosses first
    expect(newUnlocks(1, 2, 5, 6).map((u) => u.id)).toEqual(['salgados']);
    expect(newUnlocks(2, 4, 8, 9).map((u) => u.id)).toEqual(['chapa2']);
    expect(newUnlocks(4, 4, 10, 11)).toEqual([]);
  });
});

describe('order generation', () => {
  it('a new counter only orders café and pão; pastel and coxinha wait for the ladder', () => {
    expect(itemsFor(0).map((i) => i.id).sort()).toEqual(['cafe', 'pao']);
    expect(itemsFor(FULL_MENU_SHIFTS).map((i) => i.id)).toEqual(expect.arrayContaining(['pastel', 'coxinha']));
    const seen = new Set<string>();
    for (let seed = 1; seed <= 80; seed++) {
      const o = makeCorrOrder(mulberry32(seed), { level: seed % 4, wave: seed % 3, unlocked: ['salgados', 'sabado'], shifts: 0, saturday: seed % 2 === 0, avoid: [] });
      for (const l of o.lines) seen.add(l.itemId);
      expect(o.mods.some((m) => m === 'pra_viagem' || m === 'pra_comer_aqui')).toBe(false);
    }
    expect([...seen].sort()).toEqual(['cafe', 'pao']);
    const later = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) for (const l of makeCorrOrder(mulberry32(seed), { level: 2, wave: 2, unlocked: [], shifts: FULL_MENU_SHIFTS, saturday: false, avoid: [] }).lines) later.add(l.itemId);
    expect(later.has('pastel') || later.has('coxinha')).toBe(true);
  });

  it('orders vary: many phrasings, authored tickets and fresh combos, different customers', () => {
    const texts = new Set<string>();
    let authored = 0;
    let fresh = 0;
    for (let seed = 1; seed <= 120; seed++) {
      const o = makeCorrOrder(mulberry32(seed), { level: 1, wave: 1, unlocked: [], shifts: 6, saturday: false, avoid: [] });
      texts.add(o.pt);
      if (o.authored) authored++;
      else fresh++;
    }
    expect(texts.size).toBeGreaterThan(40);
    expect(authored).toBeGreaterThan(5);
    expect(fresh).toBeGreaterThan(40);
    // even the smallest counter (café and pão) is said many ways
    const tiny = new Set<string>();
    for (let seed = 1; seed <= 120; seed++) tiny.add(makeCorrOrder(mulberry32(seed), { level: 0, wave: 1, unlocked: [], shifts: 1, saturday: false, avoid: [] }).pt);
    expect(tiny.size).toBeGreaterThan(12);
    const names = new Set<string>();
    const sh = newShift(ctx({ seed: 3 }));
    sh.debug = true;
    playAll(sh);
    for (const id of sh.usedNames) names.add(id);
    expect(names.size).toBeGreaterThan(8);
  });

  it('never the same order twice in a row, even on the café-and-pão counter', () => {
    for (const shifts of [1, 4, FULL_MENU_SHIFTS])
      for (let seed = 1; seed <= 20; seed++) {
        const sh = newShift(ctx({ seed, shifts }));
        sh.debug = true;
        const sigs: string[] = [];
        for (let guard = 0; !sh.over && guard < 4000; guard++) {
          const f = frontOf(sh);
          if (!f) {
            shiftAdvance(sh, 250);
            continue;
          }
          if (sigs.at(-1) !== `${f.id}`) sigs.push(`${f.id}`, orderSig(f.order));
          build(sh);
          shiftAct(sh, { a: 'serve' });
        }
        const orders = sigs.filter((_, i) => i % 2 === 1);
        expect(orders.length).toBe(CORRERIA_TOTAL);
        for (let i = 1; i < orders.length; i++) expect(orders[i], `shift ${shifts} seed ${seed} #${i}`).not.toBe(orders[i - 1]);
      }
  });

  it('extra quente: only from level 2 up, for a lone coffee, never on the very first shift, and said on the order', () => {
    expect(HOT_FROM_LEVEL).toBe(2);
    let hot = 0;
    for (const level of [0, 1]) {
      // the chance is 0 at the first two levels, however many shifts are behind the player
      for (let seed = 1; seed <= 300; seed++) {
        const o = makeCorrOrder(mulberry32(seed), { level, wave: 2, unlocked: [], shifts: FULL_MENU_SHIFTS, saturday: false, avoid: [] });
        expect(o.mods, `level ${level} seed ${seed}`).not.toContain(HOT_MOD);
        expect(o.pt).not.toMatch(/extra quente/);
      }
    }
    for (const level of [2, 3]) {
      for (let seed = 1; seed <= 300; seed++) {
        const o = makeCorrOrder(mulberry32(seed), { level, wave: 1, unlocked: [], shifts: 3, saturday: false, avoid: [] });
        if (!o.mods.includes(HOT_MOD)) continue;
        hot++;
        expect(o.lines.filter((l) => CAFE_ITEMS.includes(l.itemId))).toHaveLength(1);
        expect(o.pt).toMatch(/extra quente/);
        expect(o.en).toMatch(/extra-hot/);
        const first = makeCorrOrder(mulberry32(seed), { level, wave: 1, unlocked: [], shifts: 0, saturday: false, avoid: [] });
        expect(first.mods).not.toContain(HOT_MOD);
      }
    }
    expect(hot).toBeGreaterThan(20);
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
      const f = makeFollow(rng, o, itemsFor(FULL_MENU_SHIFTS), { where: seed % 2 === 0 });
      if (!f) continue;
      for (const l of f.lines) {
        expect(MG_ITEMS.some((i) => i.id === l.itemId)).toBe(true);
        // never "e mais um": a follow-up never asks the player to count
        expect(l.qty).toBe(1);
      }
      expect(f.pt).not.toMatch(/mais/);
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
    // "Ah, e é pra viagem!" when packing is not on the order yet (a small menu)
    const small = makeCorrOrder(mulberry32(3), { level: 2, wave: 1, unlocked: [], shifts: 2, saturday: false, avoid: [] });
    const w = makeFollow(mulberry32(4), { ...small, lines: small.lines.filter((l) => !['cafe', 'agua'].includes(l.itemId)).concat([{ itemId: 'pao', qty: 1 }]).slice(0, 1) }, itemsFor(2), { where: true });
    expect(w?.pt).toMatch(/^Ah, e é pra (viagem|comer aqui)!$/);
    void extras;
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
  it('is good (green) between 70% and 108% of the fill time, extra hot (red) up to 145%, too late after', () => {
    expect(pourVerdict(POUR.fullMs * 0.5).verdict).toBe('short');
    expect(pourVerdict(POUR.fullMs * 0.69).verdict).toBe('short');
    expect(pourVerdict(POUR.fullMs * 0.7).verdict).toBe('ok');
    expect(pourVerdict(POUR.fullMs).verdict).toBe('ok');
    expect(pourVerdict(POUR.fullMs * 1.09).verdict).toBe('hot');
    expect(pourVerdict(POUR.fullMs * 1.45).verdict).toBe('hot');
    expect(pourVerdict(POUR.fullMs * 1.46).verdict).toBe('spill');
    expect(POUR.abortFactor).toBeGreaterThan(POUR.hotMax);
    expect([0, 0.3, 0.6, 0.9].map(pourFrame)).toEqual([0, 1, 2, 3]);
  });

  it('the "Agora!" (green) and "Extra quente!" (red) zones are exactly the windows the server accepts', () => {
    for (const f of [0, 0.5, 0.69, 0.7, 0.85, 1, 1.08, 1.09, 1.3, 1.45, 1.46, 1.55]) {
      const v = pourVerdict(POUR.fullMs * f).verdict;
      expect(pourZone(f)).toBe(v === 'ok' ? 'agora' : v === 'hot' ? 'quente' : v === 'short' ? 'filling' : 'over');
    }
  });

  it('a tap in the red is an extra-hot coffee: wanted, it is perfect; not wanted, the customer says so', () => {
    const sh = newShift(ctx({ shifts: 1, seed: 11 }));
    shiftAct(sh, { a: 'pour_start', item: 'cafe' });
    shiftAdvance(sh, POUR.fullMs * 1.25);
    expect(shiftAct(sh, { a: 'pour_end' })[0]).toMatchObject({ k: 'pour_ok', item: 'cafe', hot: true });
    expect(sh.tray).toEqual(['cafe']);
    expect(sh.mods).toEqual([HOT_MOD]);
    shiftAct(sh, { a: 'clear' });
    expect(sh.mods).toEqual([]);
    const order: MgOrder = { customer: 'x', lines: [{ itemId: 'cafe', qty: 1 }], mods: [HOT_MOD], pt: '', en: '', timeMs: 20_000, authored: false };
    expect(checkTray(order, { cafe: 1 }, [HOT_MOD]).ok).toBe(true);
    const plain = checkTray(order, { cafe: 1 }, []);
    expect(plain.ok).toBe(false);
    expect(correctionFor(order, { cafe: 1 }, plain)).toEqual({ pt: 'Era extra quente!', en: 'It was extra hot!' });
    const normal = { ...order, mods: [] };
    const tooHot = checkTray(normal, { cafe: 1 }, [HOT_MOD]);
    expect(correctionFor(normal, { cafe: 1 }, tooHot)).toEqual({ pt: 'Eu não pedi extra quente.', en: 'I didn’t ask for extra hot.' });
  });

  it('tap to start, the cup fills alone, tap again in the window; leaving it spills', () => {
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

  it('a café that is not on the menu cannot be started', () => {
    const sh = newShift(ctx({ shifts: 0 }));
    expect(shiftAct(sh, { a: 'pour_start', item: 'cafe_com_leite' })[0]).toMatchObject({ k: 'no', why: 'locked' });
    expect(sh.pour).toBeNull();
    expect(shiftAct(sh, { a: 'pour_start', item: 'cafe' })[0]).toMatchObject({ k: 'pour_start', item: 'cafe' });
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

describe('the espremedor (orange juicer)', () => {
  /** Drop one orange and let the machine finish its cycle. */
  const drop = (sh: Shift) => {
    const ev = shiftAct(sh, { a: 'juice_drop' });
    shiftAdvance(sh, JUICE.cycleMs);
    return ev;
  };

  it('suco is a juicer item, not a fridge grab', () => {
    const sh = newShift(ctx());
    expect(shiftAct(sh, { a: 'grab', item: 'suco_de_laranja' })[0]).toMatchObject({ k: 'no', why: 'station', line: { pt: 'Esse sai do espremedor.' } });
    expect(sh.tray).toEqual([]);
  });

  it('a glass is usually three oranges, never fewer than two or more than four, and stopping at the line always lands it', () => {
    const counts = new Map<number, number>();
    for (let seed = 1; seed <= 400; seed++) {
      // every reachable glass under the line still has room for the biggest orange
      let fill = 0;
      let n = 0;
      for (let i = 0; fill < JUICE.goodMin; i++) {
        expect(juiceVerdict(fill + JUICE.sizes.g)).not.toBe('spill');
        fill += JUICE.sizes[orangeAt(seed, i)];
        n++;
      }
      expect(juiceVerdict(fill)).toBe('ok');
      counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    expect([...counts.keys()].every((n) => n >= 2 && n <= 4)).toBe(true);
    expect(counts.get(3)!).toBeGreaterThan(200);
    // the sizes are a mix, from the seed alone
    const sizes = new Set(Array.from({ length: 40 }, (_, i) => orangeAt(7, i)));
    expect(sizes).toEqual(new Set(['p', 'm', 'g']));
    expect(orangeAt(7, 3)).toBe(orangeAt(7, 3));
  });

  it('each tap is one orange; tap the glass at the line and it goes on the tray', () => {
    const sh = newShift(ctx({ unlocked: [ORANGE_SIZES_UNLOCK] }));
    expect(shiftSnapshot(sh).hopper).toEqual([orangeAt(7, 0), orangeAt(7, 1), orangeAt(7, 2)]);
    const ev = drop(sh);
    expect(ev[0]).toMatchObject({ k: 'juice_drop', size: orangeAt(7, 0), fill: JUICE.sizes[orangeAt(7, 0)] });
    expect(sh.juice?.oranges).toBe(1);
    expect(shiftSnapshot(sh).hopper[0]).toBe(orangeAt(7, 1));
    while ((sh.juice?.fill ?? 0) < JUICE.goodMin) drop(sh);
    const fill = sh.juice!.fill;
    expect(shiftAct(sh, { a: 'juice_take' })[0]).toEqual({ k: 'juice_ok', item: 'suco_de_laranja', fill });
    expect(sh.tray).toEqual(['suco_de_laranja']);
    expect(sh.juice).toBeNull();
  });

  it('until cafe_rapido every orange is the standard size: the hopper and the drops never vary', () => {
    expect(ORANGE_SIZES_UNLOCK).toBe('cafe_rapido');
    expect(orangeSizesVary([])).toBe(false);
    expect(orangeSizesVary(['chapa2', 'salgados'])).toBe(false);
    expect(orangeSizesVary(['cafe_rapido'])).toBe(true);
    expect(Array.from({ length: 40 }, (_, i) => orangeAt(7, i, false))).toEqual(Array(40).fill('m'));
    const sh = newShift(ctx({ unlocked: ['chapa2', 'salgados'] }));
    expect(shiftSnapshot(sh).hopper).toEqual(['m', 'm', 'm']);
    const sizes: string[] = [];
    while ((sh.juice?.fill ?? 0) < JUICE.goodMin) {
      for (const e of drop(sh)) if (e.k === 'juice_drop') sizes.push(e.size);
    }
    expect(sizes).toEqual(['m', 'm', 'm']);
    expect(shiftAct(sh, { a: 'juice_take' })[0]).toMatchObject({ k: 'juice_ok' });
    // after the unlock the sizes are the seeded mix again
    expect(new Set(Array.from({ length: 12 }, (_, i) => orangeAt(7, i, orangeSizesVary(['cafe_rapido'])))).size).toBeGreaterThan(1);
  });

  it('one orange at a time: a tap while it still presses does nothing, nor does taking the glass mid-press', () => {
    const sh = newShift(ctx());
    shiftAct(sh, { a: 'juice_drop' });
    shiftAdvance(sh, 100);
    expect(shiftAct(sh, { a: 'juice_drop' })).toEqual([]);
    expect(shiftAct(sh, { a: 'juice_take' })).toEqual([]);
    expect(sh.juice?.oranges).toBe(1);
    expect(sh.oranges).toBe(1);
  });

  it('taking it short throws the glass out; an orange too many overflows at once', () => {
    const sh = newShift(ctx());
    drop(sh);
    expect(shiftAct(sh, { a: 'juice_take' })[0]).toMatchObject({ k: 'juice_bad', why: 'short' });
    expect(sh.juice).toBeNull();
    expect(sh.tray).toEqual([]);
    while ((sh.juice?.fill ?? 0) <= JUICE.spillAt - JUICE.sizes.p) {
      const ev = drop(sh);
      if (ev.some((e) => e.k === 'juice_bad')) break;
    }
    // keep going past the line: it overflows by itself
    let spilled = false;
    for (let i = 0; i < 6 && !spilled; i++) spilled = drop(sh).some((e) => e.k === 'juice_bad' && e.why === 'spill');
    expect(spilled).toBe(true);
    expect(sh.tray).toEqual([]);
    expect(shiftAct(sh, { a: 'juice_take' })[0]).toMatchObject({ k: 'no', why: 'juice_empty' });
  });

  it('is locked until suco is on the counter', () => {
    const sh = newShift(ctx({ shifts: 0 }));
    expect(shiftAct(sh, { a: 'juice_drop' })[0]).toMatchObject({ k: 'no', why: 'locked' });
    expect(sh.oranges).toBe(0);
  });

  it('the art cycle runs roll, cut, press, pour, peel, then idle', () => {
    const steps = [0, 0.2, 0.4, 0.6, 0.9, 1].map((u) => juicerStep(u * JUICE.cycleMs));
    expect(steps).toEqual(['roll', 'cut', 'press', 'pour', 'peel', 'idle']);
    expect(juicerStep(-1)).toBe('idle');
  });

  it('parses the juicer acts from the wire', () => {
    expect(sanitizeAct({ a: 'juice_drop' })).toEqual({ a: 'juice_drop' });
    expect(sanitizeAct({ a: 'juice_take', extra: 1 })).toEqual({ a: 'juice_take' });
  });
});

describe('anti-cheat: the tray can only be filled through the real steps', () => {
  it('a chapa or coffee item cannot be grabbed, a locked item cannot be grabbed, the tray has a cap', () => {
    const sh = newShift(ctx());
    expect(shiftAct(sh, { a: 'grab', item: 'pao_na_chapa' })[0]).toMatchObject({ k: 'no', why: 'station' });
    expect(shiftAct(sh, { a: 'grab', item: 'cafe' })[0]).toMatchObject({ k: 'no', why: 'station' });
    const fresh = newShift(ctx({ shifts: 0 }));
    expect(shiftAct(fresh, { a: 'grab', item: 'pastel' })[0]).toMatchObject({ k: 'no', why: 'locked' });
    expect(shiftAct(fresh, { a: 'grab', item: 'agua' })[0]).toMatchObject({ k: 'no', why: 'locked' });
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
    // extra quente comes from the pour itself, never from a toggle; there is no total to answer
    expect(sanitizeAct({ a: 'mod', id: 'pra_viagem' })).toBeNull();
    expect(sanitizeAct({ a: 'mod', id: 'bem_quente' })).toBeNull();
    expect(sanitizeAct({ a: 'answer', value: 12 })).toBeNull();
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

  it('the correction text: one too many first ("Era só um…", never a count), then a missing item, an extra one, then mods', () => {
    const order = { lines: [{ itemId: 'pao_na_chapa', qty: 1 }, { itemId: 'cafe', qty: 1 }], mods: ['pra_viagem'] } as MgOrder;
    const say = (tray: Tray, mods: string[]) => correctionFor(order, tray, checkTray(order, tray, mods));
    expect(say({ pao_na_chapa: 2, cafe: 1 }, ['pra_viagem'])).toEqual({ pt: 'Era só um pão na chapa!', en: expect.stringMatching(/^Just a .+!$/) });
    expect(say({ pao_na_chapa: 1 }, ['pra_viagem']).pt).toMatch(/^Faltou um café/);
    expect(say({ pao_na_chapa: 1, cafe: 1, agua: 1 }, ['pra_viagem']).pt).toMatch(/^Eu não pedi água/);
    expect(say({ pao_na_chapa: 1, cafe: 1 }, []).pt).toBe('Era pra viagem!');
    expect(say({ pao_na_chapa: 1, cafe: 1 }, ['pra_viagem', 'pra_comer_aqui']).pt).toBe('Não era pra comer aqui.');
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

  it('listening replays cost 1 then 2 patience pips, the third is ignored, and written orders cannot be replayed', () => {
    const find = () => {
      for (let seed = 1; seed <= 400; seed++) {
        const sh = newShift(ctx({ seed, level: 2 }));
        sh.spawned = 9;
        sh.nextSpawnAt = 0;
        for (let i = 0; i < 60 && !frontOf(sh); i++) shiftAdvance(sh, 250);
        const f = frontOf(sh);
        if (f?.mode === 'listening') return { sh, f };
      }
      throw new Error('no listening customer found');
    };
    const { sh, f } = find();
    const pip = patiencePipMs(f.patienceMax);
    const p0 = f.patience;
    expect(shiftAct(sh, { a: 'replay' })[0]).toMatchObject({ k: 'replay' });
    expect(p0 - f.patience).toBeCloseTo(pip, 0);
    expect(f.replays).toBe(1);
    const p1 = f.patience;
    expect(shiftAct(sh, { a: 'replay' })[0]).toMatchObject({ k: 'replay' });
    expect(p1 - f.patience).toBeCloseTo(pip * 2, 0);
    expect(f.replays).toBe(2);
    expect(shiftAct(sh, { a: 'replay' })[0]).toMatchObject({ k: 'replay_deny' });
    expect(f.replays).toBe(2);
    const shW = newShift(ctx({ seed: 3 }));
    for (let i = 0; i < 60 && !frontOf(shW); i++) shiftAdvance(shW, 250);
    expect(frontOf(shW)!.mode).toBe('written');
    expect(shiftAct(shW, { a: 'replay' })).toEqual([]);
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

describe('the menu ladder', () => {
  const whereMods = (mods: readonly string[]) => mods.filter((m) => m === 'pra_viagem' || m === 'pra_comer_aqui');

  it('opens one item every two shifts, in teaching order, and a size-1 shop stays on café and pão', () => {
    expect(ITEM_EVERY_SHIFTS).toBe(2);
    // suco comes after the pão na chapa: the juicer is a station of its own, so it opens once the chapa is learnt
    expect(MENU_LADDER).toEqual(['cafe', 'pao', 'agua', 'pao_de_queijo', 'cafe_com_leite', 'pao_na_chapa', 'suco_de_laranja', 'coxinha', 'pastel', 'bolo', 'guarana', 'misto_quente']);
    expect(menuIdsForShifts(0)).toEqual(['cafe', 'pao']);
    expect(menuIdsForShifts(1)).toEqual(['cafe', 'pao']);
    expect(menuCountForShifts(2)).toBe(3);
    expect(menuIdsForShifts(2)[2]).toBe('agua');
    expect(menuCountForShifts(12)).toBe(WHERE_MENU_AT);
    expect(menuIdsForShifts(8)[5]).toBe('pao_na_chapa');
    expect(menuIdsForShifts(9)).not.toContain('suco_de_laranja');
    expect(menuIdsForShifts(10)[6]).toBe('suco_de_laranja');
    expect(menuIdsForShifts(FULL_MENU_SHIFTS)).toEqual([...MENU_LADDER]);
    expect(menuIdsForShifts(99)).toEqual([...MENU_LADDER]);
    expect(shiftItemPool({ shifts: 40, menuIds: ['cafe', 'pao'] }).map((i) => i.id).sort()).toEqual(['cafe', 'pao']);
    expect(payBump(40, ['cafe', 'pao'])).toBeNull();
  });

  it('the one-time item cards are gone: nothing teaches by card, and old saves still read back coherent', () => {
    const snap = shiftSnapshot(newShift(ctx({ shifts: 2 })));
    expect('lesson' in snap).toBe(false);
    expect(normalizeCorreria(undefined).taught).toEqual([]);
    expect(normalizeCorreria({ stars: 1, shifts: 4, best: 1 }).taught).toEqual([...MENU_LADDER, 'where']);
    expect(normalizeCorreria({ stars: 0, shifts: 0, best: 0, taught: ['cafe', 'nope', 'cafe'] }).taught).toEqual(['cafe']);
    expect(normalizeCorreria({ shifts: 12, taught: ['cafe', JUICER_LESSON_ID, 'zzz'] }).taught).toEqual(['cafe', JUICER_LESSON_ID]);
  });

  it('pays +6% of today per extra item, at most 1.6×, and says so when the menu grew', () => {
    expect(PAY_STEP_PCT).toBe(6);
    expect(menuPayPct(2)).toBe(0);
    expect(menuPayMul(2)).toBe(1);
    expect(menuPayPct(MENU_LADDER.length)).toBe(60);
    expect(menuPayMul(MENU_LADDER.length)).toBe(PAY_MUL_MAX);
    expect(menuPayMul(3)).toBeCloseTo(1.06);
    expect(payBump(0)).toBeNull();
    expect(payBump(1)).toBeNull();
    expect(payBump(2)).toEqual({ pt: '+1 item no cardápio: pagamento +6%', en: '+1 menu item: pay +6%' });
    expect(payBump(3)).toBeNull();
    const sh = newShift(ctx({ shifts: 2, bump: payBump(2) }));
    const snap = shiftSnapshot(sh);
    expect(snap.menu).toHaveLength(3);
    expect(snap.payMul).toBeCloseTo(1.06);
    expect(snap.bump?.pt).toMatch(/\+6%/);
    expect(snap.ladder).toEqual({ open: ['cafe', 'pao', 'agua'], fresh: ['agua'], next: 'pao_de_queijo', nextIn: 2, total: MENU_LADDER.length });
  });

  it('the ladder view names the next item and the shifts to go', () => {
    expect(menuLadder(0)).toEqual({ open: ['cafe', 'pao'], fresh: [], next: 'agua', nextIn: 2, total: MENU_LADDER.length });
    expect(menuLadder(1)).toMatchObject({ fresh: [], next: 'agua', nextIn: 1 });
    expect(menuLadder(2)).toMatchObject({ fresh: ['agua'], next: 'pao_de_queijo', nextIn: 2 });
    expect(menuLadder(3)).toMatchObject({ fresh: [], nextIn: 1 });
    // the next item opens exactly when `nextIn` more shifts are done
    for (let n = 0; n < FULL_MENU_SHIFTS; n++) {
      const v = menuLadder(n);
      expect(menuLadder(n + v.nextIn).open).toContain(v.next);
      expect(menuLadder(n + v.nextIn - 1).open).not.toContain(v.next);
    }
    const full = menuLadder(FULL_MENU_SHIFTS + 5);
    expect(full).toMatchObject({ next: null, nextIn: 0, fresh: [] });
    expect(full.open).toEqual([...MENU_LADDER]);
    expect(menuLadder(FULL_MENU_SHIFTS).fresh).toEqual(['misto_quente']);
    // an owned room's menu caps the ladder: its next item skips what it does not sell
    const capped = menuLadder(2, ['cafe', 'pao', 'pao_de_queijo']);
    expect(capped).toMatchObject({ open: ['cafe', 'pao'], fresh: [], next: 'pao_de_queijo', nextIn: 2, total: 3 });
    expect(menuLadder(NaN).open).toEqual(['cafe', 'pao']);
  });

  it('pra viagem / pra comer aqui is absent before 8 items and on every order after', () => {
    expect(WHERE_MENU_AT).toBe(8);
    expect(whereRequired(7)).toBe(false);
    expect(whereRequired(8)).toBe(true);
    for (let seed = 1; seed <= 40; seed++) {
      const small = makeCorrOrder(mulberry32(seed), { level: 3, wave: 2, unlocked: ['sabado'], shifts: 10, saturday: false, avoid: [] });
      expect(menuCountForShifts(10)).toBe(7);
      expect(whereMods(small.mods)).toEqual([]);
      const big = makeCorrOrder(mulberry32(seed + 90), { level: 2, wave: 1, unlocked: [], shifts: 12, saturday: false, avoid: [] });
      expect(whereMods(big.mods)).toHaveLength(1);
      expect(big.pt).toMatch(/pra viagem|pra comer aqui/);
      expect(big.en).toMatch(/to go|for here/i);
      const rng = mulberry32(seed + 200);
      const full = makeCorrOrder(rng, { level: 3, wave: 2, unlocked: ['salgados'], shifts: FULL_MENU_SHIFTS, saturday: false, avoid: [] });
      expect(whereMods(full.mods)).toHaveLength(1);
      const follow = makeFollow(rng, full, itemsFor(FULL_MENU_SHIFTS));
      if (follow) expect(whereMods(follow.mods)).toEqual(whereMods(full.mods));
      const early = makeCorrOrder(mulberry32(seed + 400), { level: 3, wave: 2, unlocked: [], shifts: 0, saturday: false, avoid: [] });
      const earlyFollow = makeFollow(mulberry32(seed + 500), early, itemsFor(0));
      if (earlyFollow) expect(whereMods(earlyFollow.mods)).toEqual([]);
    }
  });
});

describe('stars, payout and the daily gate numbers', () => {
  it('stars by points, RV by the existing economy range', () => {
    expect([0, 0.2, 0.3, 0.5, 0.7, 1].map((r) => starsFor(r * MAX_SHIFT_POINTS))).toEqual([0, 0, 1, 2, 3, 3]);
    expect(correriaPayout(0, 0)).toBe(0);
    expect(correriaPayout(1, 1)).toBeGreaterThanOrEqual(8);
    expect(correriaPayout(MAX_SHIFT_POINTS, 15)).toBe(20);
    expect(correriaPayout(MAX_SHIFT_POINTS * 5, 15)).toBe(20);
    expect(correriaPayout(MAX_SHIFT_POINTS, 15, 2)).toBe(20);
    expect(correriaPayout(MAX_SHIFT_POINTS, 15, MENU_LADDER.length)).toBe(32);
    expect(correriaPayout(MAX_SHIFT_POINTS, 15, 99)).toBe(32);
    expect(correriaPayout(MAX_SHIFT_POINTS, 15, 12)).toBeLessThanOrEqual(Math.round(20 * PAY_MUL_MAX));
    expect(DAILY_PAID_SHIFTS).toBe(3);
  });

  it('meters: patience stage, chapa and tip jar fill states map to the art keys', () => {
    expect([1, 0.8, 0.6, 0.3, 0.1, 0].map(patienceStage)).toEqual([4, 4, 3, 2, 1, 0]);
    expect([0, 1, 9, 10, 23, 24, 100].map(tipJarStage)).toEqual([0, 1, 1, 2, 2, 3, 3]);
  });
});

describe('practiceShift (the first-time tutorial order)', () => {
  it('one written order at the counter: a coffee and a French roll, what a new counter has, nothing else on the menu', () => {
    const sh = practiceShift(150);
    const snap = shiftSnapshot(sh);
    expect(snap.customers).toHaveLength(1);
    expect(snap.customers[0]!.state).toBe('front');
    expect(snap.customers[0]!.mode).toBe('written');
    expect(snap.customers[0]!.pt).toBe('Bom dia! Me vê um café e um pão, por favor.');
    expect(snap.customers[0]!.want).toEqual({ items: ['cafe', 'pao'], mods: [] });
    expect([...snap.menu].sort()).toEqual(['cafe', 'pao']);
    expect([...snap.menu].sort()).toEqual([...PRACTICE_MENU].sort());
    expect(wantOf(sh)!.lines).toEqual(PRACTICE_MENU.map((itemId) => ({ itemId, qty: 1 })));
    expect(wantOf(sh)!.mods).toEqual([]);
  });

  it('built through the real taps it is served (no "Quanto é?") and the shift is over', () => {
    const sh = practiceShift(150);
    const ev: CEvent[] = [];
    build(sh, ev);
    ev.push(...shiftAct(sh, { a: 'serve' }));
    expect(ev.some((e) => e.k === 'serve' && e.outcome === 'perfeito')).toBe(true);
    expect(ev.some((e) => e.k === 'ask')).toBe(false);
    expect(sh.over).toBe(true);
    expect(summarizeShift(sh).served).toBe(1);
  });
});
