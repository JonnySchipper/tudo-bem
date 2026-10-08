import { describe, expect, it } from 'vitest';
import {
  FEIRA_GAME_MAX_SCORE,
  FEIRA_IMPLEMENTED_GAMES,
  FEIRA_MIN_ELAPSED_MS,
  emptyFeiraCartConfig,
  enabledFeiraGameIds,
  featuredEnabled,
  judgeFeiraResult,
  rotationSlot,
  withFeiraCartMode,
} from './feiraGames.js';
import { CALDO_FLAVORS, caldoOrders, caldoServeQuality } from './feiraCaldo.js';

describe('caldo de cana orders and score', () => {
  it('deals seeded orders in Portuguese with an English hint, gelo or puro', () => {
    const orders = caldoOrders(7);
    expect(orders.length).toBeGreaterThan(8);
    expect(orders[0]!.at).toBeLessThan(orders[1]!.at);
    const again = caldoOrders(7);
    expect(again.map((o) => o.line.pt)).toEqual(orders.map((o) => o.line.pt));
    for (const o of orders) {
      expect(o.line.pt.startsWith('Um caldo de cana') || o.line.pt.startsWith('Me vê um caldo de cana')).toBe(true);
      expect(o.line.en.toLowerCase()).toContain('sugarcane juice');
      expect(o.ice === 'gelo' || o.ice === 'puro').toBe(true);
      expect(CALDO_FLAVORS).toContain(o.flavor);
      if (o.ice === 'gelo') expect(o.line.pt).toContain('com gelo');
      else expect(o.line.pt).toContain('puro');
    }
    let found = false;
    for (let seed = 0; seed < 50 && !found; seed++) {
      const hit = caldoOrders(seed).find((o) => o.flavor === 'limao' && o.ice === 'gelo' && o.line.pt.startsWith('Um caldo'));
      if (!hit) continue;
      expect(hit.line.pt).toBe('Um caldo de cana com limão, com gelo, por favor.');
      expect(hit.line.en).toBe('A sugarcane juice with lime, with ice, please.');
      found = true;
    }
    expect(found).toBe(true);
  });

  it('recomputes the score from outcomes and hard-caps it', () => {
    const seed = 42;
    const orders = caldoOrders(seed);
    const outcomes = orders.map((o, i) => ({ i, quality: 'perfect' as const, atMs: o.at + 800 }));
    const judged = judgeFeiraResult('caldo', seed, outcomes, 90_000);
    expect(judged.ok).toBe(true);
    if (!judged.ok) return;
    expect(judged.score).toBeLessThanOrEqual(FEIRA_GAME_MAX_SCORE);
    expect(judged.score).toBeGreaterThan(0);
    expect(judged.served).toBe(orders.length);
    expect(judged.perfect).toBe(orders.length);
  });

  it('drops forged rows and rejects a finish that is too fast', () => {
    const seed = 3;
    const forged = [
      { i: 0, quality: 'perfect' as const, atMs: 2_000 },
      { i: 99, quality: 'perfect' as const, atMs: 2_000 },
      { i: 0, quality: 'perfect' as const, atMs: 2_000 },
    ];
    const judged = judgeFeiraResult('caldo', seed, forged, 20_000);
    expect(judged.ok).toBe(true);
    if (!judged.ok) return;
    expect(judged.served).toBeLessThanOrEqual(caldoOrders(seed).filter((o) => o.at <= 20_000).length);
    expect(judged.score).toBeLessThanOrEqual(FEIRA_GAME_MAX_SCORE);
    expect(judgeFeiraResult('caldo', seed, forged, FEIRA_MIN_ELAPSED_MS - 1).ok).toBe(false);
  });

  it('treats a wrong flavor as a miss and a spill or wrong ice as a soft fail', () => {
    expect(caldoServeQuality({ flavorOk: false, iceOk: true, spilled: false, patienceLeft: 0.8 })).toBe('miss');
    expect(caldoServeQuality({ flavorOk: true, iceOk: false, spilled: false, patienceLeft: 0.8 })).toBe('soft');
    expect(caldoServeQuality({ flavorOk: true, iceOk: true, spilled: true, patienceLeft: 0.8 })).toBe('soft');
    expect(caldoServeQuality({ flavorOk: true, iceOk: true, spilled: false, patienceLeft: 0.2 })).toBe('ok');
    expect(caldoServeQuality({ flavorOk: true, iceOk: true, spilled: false, patienceLeft: 0.8 })).toBe('perfect');
    expect(caldoServeQuality({ flavorOk: true, iceOk: true, spilled: false, patienceLeft: 0 })).toBe('miss');
  });

  it('ships off until an admin enables it, then can be the featured game on its own', () => {
    expect(FEIRA_IMPLEMENTED_GAMES).toContain('caldo');
    const off = emptyFeiraCartConfig();
    expect(off.games.caldo).toBeUndefined();
    expect(enabledFeiraGameIds(off, '2026-10-08')).toEqual([]);
    expect(featuredEnabled('2026-10-08', enabledFeiraGameIds(off, '2026-10-08'))).toBeNull();
    const on = withFeiraCartMode(off, 'caldo', 'on');
    expect(on).not.toBeNull();
    if (!on) return;
    expect(enabledFeiraGameIds(on, '2026-10-08')).toEqual(['caldo']);
    // one game switched on is featured every day, including a pastel slot
    expect(rotationSlot('1970-01-02')).toBe('pastel');
    expect(featuredEnabled('1970-01-02', enabledFeiraGameIds(on, '1970-01-02'))).toBe('caldo');
    expect(featuredEnabled('1970-01-03', enabledFeiraGameIds(on, '1970-01-03'))).toBe('caldo');
    const again = withFeiraCartMode(on, 'caldo', 'off');
    expect(again && enabledFeiraGameIds(again, '2026-10-08')).toEqual([]);
  });
});
