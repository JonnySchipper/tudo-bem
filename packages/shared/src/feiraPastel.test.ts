import { describe, expect, it } from 'vitest';
import { FEIRA_GAME_MAX_SCORE, judgeFeiraResult } from './feiraGames.js';
import {
  PASTEL_COMBO_FROM,
  PASTEL_DURATION_MS,
  PASTEL_FRY,
  PASTEL_FRY_COMBO,
  PASTEL_PARTS,
  PASTEL_RECIPE,
  PASTEL_SIMPLE,
  pastelComboTurn,
  pastelParts,
  pastelRules,
  pastelDoneness,
  pastelFromParts,
  pastelOrders,
  pastelServeQuality,
  scorePastel,
} from './feiraPastel.js';

describe('pastel orders', () => {
  it('deals a stable queue, simple fillings first and combos later', () => {
    const a = pastelOrders(7);
    expect(a).toHaveLength(11);
    expect(pastelOrders(7)).toEqual(a);
    expect(a.every((o, i) => (i === 0 ? o.at > 0 : o.at > a[i - 1]!.at))).toBe(true);
    for (let i = 0; i < a.length; i++) {
      expect(PASTEL_RECIPE[a[i]!.filling].combo).toBe(pastelComboTurn(i));
    }
    expect(a.some((o) => PASTEL_RECIPE[o.filling].combo)).toBe(true);
    expect(a.slice(0, PASTEL_COMBO_FROM).every((o) => !PASTEL_RECIPE[o.filling].combo)).toBe(true);
  });

  it('orders in Portuguese with an English hint, including a beef pastel', () => {
    let sawBeef = false;
    for (let seed = 0; seed < 40; seed++) {
      for (const o of pastelOrders(seed)) {
        expect(o.line.pt.toLowerCase()).toContain('pastel');
        expect(o.line.en.toLowerCase()).toContain('pastel');
        expect(o.line.pt).toContain(PASTEL_RECIPE[o.filling].label.pt);
        if (o.line.pt === 'Um pastel de carne, por favor.') {
          expect(o.line.en).toBe('A beef pastel, please.');
          sawBeef = true;
        }
      }
    }
    expect(sawBeef).toBe(true);
  });

  it('matches a recipe from its parts, in any order', () => {
    expect(pastelFromParts(['carne'])).toBe('carne');
    expect(pastelFromParts(['catupiry', 'frango'])).toBe('frango_catupiry');
    expect(pastelFromParts(['goiabada', 'queijo'])).toBe('romeu_julieta');
    expect(pastelFromParts(['banana', 'canela'])).toBe('banana_canela');
    expect(pastelFromParts(['camarao', 'catupiry'])).toBe('camarao_catupiry');
    expect(pastelFromParts(['frango'])).toBeNull();
    expect(pastelFromParts(['carne', 'queijo'])).toBeNull();
  });
});

describe('pastel fry ladder', () => {
  it('goes golden, dark, black, block, then fire', () => {
    expect(pastelDoneness(0)).toBe('raw');
    expect(pastelDoneness(PASTEL_FRY.goldenAt - 1)).toBe('raw');
    expect(pastelDoneness(PASTEL_FRY.goldenAt)).toBe('golden');
    expect(pastelDoneness(PASTEL_FRY.darkAt - 1)).toBe('golden');
    expect(pastelDoneness(PASTEL_FRY.darkAt)).toBe('dark');
    expect(pastelDoneness(PASTEL_FRY.blackAt)).toBe('black');
    expect(pastelDoneness(PASTEL_FRY.blockAt)).toBe('block');
    expect(pastelDoneness(PASTEL_FRY.fireAt - 1)).toBe('block');
    expect(pastelDoneness(PASTEL_FRY.fireAt)).toBe('fire');
  });

  it('gives a combo a shorter golden window', () => {
    expect(PASTEL_FRY_COMBO.goldenAt).toBeLessThan(PASTEL_FRY.goldenAt);
    expect(pastelDoneness(PASTEL_FRY_COMBO.goldenAt, true)).toBe('golden');
    expect(pastelDoneness(PASTEL_FRY_COMBO.goldenAt, false)).toBe('raw');
    expect(pastelDoneness(PASTEL_FRY_COMBO.fireAt, true)).toBe('fire');
    expect(pastelDoneness(PASTEL_FRY_COMBO.fireAt, false)).not.toBe('fire');
  });

  it('fries slowly enough to work a second pastel while one is in the oil', () => {
    expect(PASTEL_FRY.goldenAt).toBeGreaterThanOrEqual(4_500);
    expect(PASTEL_FRY.darkAt - PASTEL_FRY.goldenAt).toBeGreaterThanOrEqual(3_000);
    expect(PASTEL_FRY_COMBO.darkAt - PASTEL_FRY_COMBO.goldenAt).toBeGreaterThanOrEqual(2_500);
  });

  it('scores a burnt pastel as a soft fail and never ends the run', () => {
    expect(pastelServeQuality('golden', true, 0.8)).toBe('perfect');
    expect(pastelServeQuality('golden', true, 0.2)).toBe('ok');
    expect(pastelServeQuality('raw', true, 0.8)).toBe('soft');
    expect(pastelServeQuality('dark', true, 0.8)).toBe('soft');
    expect(pastelServeQuality('black', true, 0.8)).toBe('soft');
    expect(pastelServeQuality('block', true, 0.8)).toBe('soft');
    expect(pastelServeQuality('fire', true, 0.8)).toBe('soft');
    expect(pastelServeQuality('golden', false, 0.8)).toBe('miss');
    expect(pastelServeQuality('fire', true, 0)).toBe('miss');
  });
});

describe('pastel scoring', () => {
  it('recomputes from outcomes and hard-caps a flawless run', () => {
    const seed = 4;
    const orders = pastelOrders(seed);
    const outcomes = orders.map((o, i) => ({ i, quality: 'perfect' as const, atMs: o.at + 800 }));
    const judged = judgeFeiraResult('pastel', seed, outcomes, PASTEL_DURATION_MS);
    expect(judged.ok).toBe(true);
    if (!judged.ok) return;
    expect(judged.served).toBe(orders.length);
    expect(judged.perfect).toBe(orders.length);
    expect(judged.score).toBe(FEIRA_GAME_MAX_SCORE);
    expect(scorePastel(seed, outcomes, PASTEL_DURATION_MS).score).toBe(FEIRA_GAME_MAX_SCORE);
  });

  it('pays a burnt run less than a golden one, and still accepts it', () => {
    const seed = 9;
    const orders = pastelOrders(seed);
    const burnt = orders.map((o, i) => ({ i, quality: 'soft' as const, atMs: o.at + 800 }));
    const golden = orders.map((o, i) => ({ i, quality: 'perfect' as const, atMs: o.at + 800 }));
    const soft = judgeFeiraResult('pastel', seed, burnt, PASTEL_DURATION_MS);
    const perfect = judgeFeiraResult('pastel', seed, golden, PASTEL_DURATION_MS);
    expect(soft.ok && perfect.ok).toBe(true);
    if (!soft.ok || !perfect.ok) return;
    expect(soft.score).toBeGreaterThan(0);
    expect(soft.score).toBeLessThan(perfect.score);
    expect(soft.served).toBe(orders.length);
  });

  it('drops a forged row and a pastel the seed has not dealt yet', () => {
    const seed = 3;
    const judged = judgeFeiraResult(
      'pastel',
      seed,
      [
        { i: 0, quality: 'perfect', atMs: 2_000 },
        { i: 40, quality: 'perfect', atMs: 2_000 },
        { i: 0, quality: 'soft', atMs: 2_000 },
      ],
      20_000,
    );
    expect(judged.ok).toBe(true);
    if (!judged.ok) return;
    const possible = pastelOrders(seed).filter((o) => o.at <= 20_000).length;
    expect(judged.served).toBeLessThanOrEqual(possible);
    expect(judged.served).toBe(1);
  });
});

describe('pastel staged by the player\'s runs', () => {
  it('has no combos before the 3rd run, and no charcoal block or fire in the 1st', () => {
    expect(pastelRules(0)).toEqual({ combos: false, fire: false });
    expect(pastelRules(1)).toEqual({ combos: false, fire: true });
    expect(pastelRules(2)).toEqual({ combos: true, fire: true });
    expect(pastelRules(40)).toEqual({ combos: true, fire: true });
    // an older caller (no run count) gets the full game
    expect(pastelRules()).toEqual({ combos: true, fire: true });
    for (const seed of [1, 7, 99, 12345]) {
      for (const runs of [0, 1]) {
        expect(pastelOrders(seed, runs).every((o) => !PASTEL_RECIPE[o.filling].combo), `seed ${seed} run ${runs + 1}`).toBe(true);
      }
      expect(pastelOrders(seed, 2)).toEqual(pastelOrders(seed));
    }
    // the trays on the counter follow: five one-word fillings until combos arrive
    expect(pastelParts(pastelRules(0))).toEqual(PASTEL_SIMPLE);
    expect(pastelParts(pastelRules(2))).toEqual(PASTEL_PARTS);
    // a forgotten pastel in the 1st run stops at black
    const first = pastelRules(0);
    expect(pastelDoneness(PASTEL_FRY.fireAt + 10_000, false, first)).toBe('black');
    expect(pastelDoneness(PASTEL_FRY_COMBO.blockAt + 1, true, first)).toBe('black');
    expect(pastelDoneness(PASTEL_FRY.goldenAt, false, first)).toBe('golden');
    expect(pastelDoneness(PASTEL_FRY.fireAt, false, pastelRules(1))).toBe('fire');
  });

  it('keeps arrivals and patience on the seed alone, so the server scores a first run the same way', () => {
    for (const seed of [3, 7, 2026]) {
      const shape = (runs?: number) => pastelOrders(seed, runs).map((o) => [o.at, o.patienceMs, o.who]);
      expect(shape(0)).toEqual(shape());
      expect(shape(1)).toEqual(shape());
    }
  });
});
