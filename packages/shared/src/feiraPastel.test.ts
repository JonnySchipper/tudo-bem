import { describe, expect, it } from 'vitest';
import { FEIRA_GAME_MAX_SCORE, judgeFeiraResult } from './feiraGames.js';
import {
  PASTEL_COMBO_FROM,
  PASTEL_FRY,
  PASTEL_RECIPE,
  pastelComboTurn,
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
    expect(pastelDoneness(2_000, true)).toBe('golden');
    expect(pastelDoneness(2_000, false)).toBe('raw');
    expect(pastelDoneness(6_800, true)).toBe('fire');
    expect(pastelDoneness(6_800, false)).toBe('black');
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
    const judged = judgeFeiraResult('pastel', seed, outcomes, 90_000);
    expect(judged.ok).toBe(true);
    if (!judged.ok) return;
    expect(judged.served).toBe(orders.length);
    expect(judged.perfect).toBe(orders.length);
    expect(judged.score).toBe(FEIRA_GAME_MAX_SCORE);
    expect(scorePastel(seed, outcomes, 90_000).score).toBe(FEIRA_GAME_MAX_SCORE);
  });

  it('pays a burnt run less than a golden one, and still accepts it', () => {
    const seed = 9;
    const orders = pastelOrders(seed);
    const burnt = orders.map((o, i) => ({ i, quality: 'soft' as const, atMs: o.at + 800 }));
    const golden = orders.map((o, i) => ({ i, quality: 'perfect' as const, atMs: o.at + 800 }));
    const soft = judgeFeiraResult('pastel', seed, burnt, 90_000);
    const perfect = judgeFeiraResult('pastel', seed, golden, 90_000);
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
