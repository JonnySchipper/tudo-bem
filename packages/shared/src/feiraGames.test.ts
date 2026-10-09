import { describe, expect, it } from 'vitest';
import { todayEastern } from './cartela.js';
import { DIARY_PLACEMENTS } from './diaryWorld.js';
import { HOTSPOTS } from './hotspots.js';
import { RECADOS } from './recados.js';
import { ROOMS, buildGrid, isWalkable, key } from './rooms.js';
import {
  FEIRA_CART_ART,
  FEIRA_CART_WORLD_IDS,
  FEIRA_DAILY_PAID_RUNS,
  FEIRA_GAME_MAX_SCORE,
  FEIRA_IMPLEMENTED_GAMES,
  FEIRA_MIN_ELAPSED_MS,
  FEIRA_ROTATION_ORDER,
  crownHolder,
  daysSinceEpochET,
  emptyFeiraCartConfig,
  enabledFeiraGameIds,
  featuredEnabled,
  featuredGame,
  featuredGameAt,
  feiraCartAdminView,
  feiraCartCatalog,
  feiraCartShown,
  feiraGameActive,
  feiraPayout,
  feiraRoomFor,
  judgeFeiraResult,
  medalTallies,
  medalsForDay,
  normalizeFeiraCartConfig,
  normalizeFeiraGames,
  placeOf,
  rankFeiraDay,
  rotationSlot,
  withFeiraCartMode,
  withoutHiddenFeiraCart,
  type FeiraDayScore,
} from './feiraGames.js';
import { pastelOrders } from './feiraPastel.js';
import { caldoOrders } from './feiraCaldo.js';
import { TAPIOCA_SPREAD, tapiocaOrders, tapiocaServeQuality, tapiocaSpread } from './feiraTapioca.js';
import './feiraPastel.js';
import './feiraCaldo.js';

describe('feira rotation', () => {
  it('is daysSinceEpoch(ET) mod 3 over a fixed order', () => {
    expect(FEIRA_ROTATION_ORDER).toEqual(['tapioca', 'pastel', 'caldo']);
    const day = '2026-10-08';
    const n = daysSinceEpochET(day);
    expect(rotationSlot(day)).toBe(FEIRA_ROTATION_ORDER[((n % 3) + 3) % 3]);
    expect(rotationSlot('1970-01-01')).toBe('tapioca');
    expect(rotationSlot('1970-01-02')).toBe('pastel');
    expect(rotationSlot('1970-01-03')).toBe('caldo');
    expect(rotationSlot('1970-01-04')).toBe('tapioca');
  });

  it('is the same game for the whole ET date, including the 23:30 vs 00:30 boundary', () => {
    // 2026-10-08 23:30 ET is 2026-10-09 03:30 UTC (EDT, UTC-4)
    const late = Date.parse('2026-10-09T03:30:00.000Z');
    // 2026-10-09 00:30 ET is 2026-10-09 04:30 UTC
    const early = Date.parse('2026-10-09T04:30:00.000Z');
    expect(todayEastern(late)).toBe('2026-10-08');
    expect(todayEastern(early)).toBe('2026-10-09');
    expect(featuredGameAt(late)).toBe(featuredGame('2026-10-08'));
    expect(featuredGameAt(early)).toBe(featuredGame('2026-10-09'));
    // the slot still changes across midnight even when the fallback lands on the same game
    expect(rotationSlot('2026-10-08')).not.toBe(rotationSlot('2026-10-09'));
  });

  it('uses the ET date across the spring-forward and fall-back hours', () => {
    // 2026-03-08 is the US spring-forward day. 01:30 ET does not exist; 03:30 ET is 07:30 UTC.
    expect(todayEastern(Date.parse('2026-03-08T07:30:00.000Z'))).toBe('2026-03-08');
    // 2026-11-01 is the fall-back day. 01:30 ET happens twice; both are still Nov 1.
    expect(todayEastern(Date.parse('2026-11-01T05:30:00.000Z'))).toBe('2026-11-01');
    expect(todayEastern(Date.parse('2026-11-01T06:30:00.000Z'))).toBe('2026-11-01');
    expect(featuredGame('2026-11-01')).toBe(featuredGameAt(Date.parse('2026-11-01T05:30:00.000Z')));
  });

  it('features every built game on its own slot', () => {
    expect(FEIRA_IMPLEMENTED_GAMES).toEqual(['tapioca', 'pastel', 'caldo']);
    expect(featuredGame('1970-01-01')).toBe('tapioca');
    expect(featuredGame('1970-01-02')).toBe('pastel');
    expect(featuredGame('1970-01-03')).toBe('caldo');
    for (const day of ['2026-10-08', '2026-10-09', '2026-10-10', '2026-01-01', '2026-07-04']) {
      expect(featuredGame(day)).toBe(rotationSlot(day));
    }
    // with only some games switched on, the server passes that subset
    const all = ['tapioca', 'pastel', 'caldo'] as const;
    expect(featuredGame('1970-01-01', all)).toBe('tapioca');
    expect(featuredGame('1970-01-02', all)).toBe('pastel');
    expect(featuredGame('1970-01-03', all)).toBe('caldo');
    // pastel off: that slot falls back to tapioca (the previous switched-on game)
    expect(featuredGame('1970-01-02', ['tapioca', 'caldo'])).toBe('tapioca');
    expect(featuredGame('1970-01-03', ['tapioca', 'caldo'])).toBe('caldo');
    // caldo off: that slot falls back to pastel
    expect(featuredGame('1970-01-03', ['tapioca', 'pastel'])).toBe('pastel');
  });
});

describe('feira scoring and payout', () => {
  it('recomputes the score from outcomes and hard-caps it', () => {
    const seed = 42;
    const orders = tapiocaOrders(seed);
    const outcomes = orders.map((o, i) => ({ i, quality: 'perfect' as const, atMs: o.at + 1000 }));
    const judged = judgeFeiraResult('tapioca', seed, outcomes, 90_000);
    expect(judged.ok).toBe(true);
    if (!judged.ok) return;
    expect(judged.score).toBeLessThanOrEqual(FEIRA_GAME_MAX_SCORE);
    expect(judged.score).toBeGreaterThan(0);
    expect(judged.served).toBe(orders.length);
  });

  it('clamps a forged result: extra orders, a client score, and a too-fast finish', () => {
    const seed = 7;
    const forged = [
      { i: 0, quality: 'perfect' as const, atMs: 2000 },
      { i: 99, quality: 'perfect' as const, atMs: 2000 },
      { i: 0, quality: 'perfect' as const, atMs: 2000 },
    ];
    const judged = judgeFeiraResult('tapioca', seed, forged, 20_000);
    expect(judged.ok).toBe(true);
    if (!judged.ok) return;
    expect(judged.served).toBeLessThanOrEqual(tapiocaOrders(seed).filter((o) => o.at <= 20_000).length);
    expect(judged.score).toBeLessThanOrEqual(FEIRA_GAME_MAX_SCORE);
    expect(judgeFeiraResult('tapioca', seed, forged, 500).ok).toBe(false);
    expect(judgeFeiraResult('tapioca', seed, forged, FEIRA_MIN_ELAPSED_MS - 1).ok).toBe(false);
  });

  it('pays in the Correria band, scaled by score, and nothing when nobody was served', () => {
    expect(feiraPayout(0, 0)).toBe(0);
    expect(feiraPayout(10, 0)).toBe(0);
    const thin = feiraPayout(40, 1);
    const full = feiraPayout(FEIRA_GAME_MAX_SCORE, 8);
    expect(thin).toBeGreaterThanOrEqual(5);
    expect(thin).toBeLessThanOrEqual(25);
    expect(full).toBeGreaterThan(thin);
    expect(full).toBeLessThanOrEqual(25);
    expect(FEIRA_DAILY_PAID_RUNS).toBe(3);
  });

  it('treats a wrong filling as a miss and a mistimed flip as a soft fail, never a game over', () => {
    expect(tapiocaServeQuality('perfect', false, 0.8)).toBe('miss');
    expect(tapiocaServeQuality('early', true, 0.8)).toBe('soft');
    expect(tapiocaServeQuality('late', true, 0.8)).toBe('soft');
    expect(tapiocaServeQuality('perfect', true, 0.8)).toBe('perfect');
  });

  it('judges the goma spread: holes or a spill over the rim cap the order at soft', () => {
    expect(tapiocaSpread(0.2)).toBe('thin');
    expect(tapiocaSpread(TAPIOCA_SPREAD.evenFrom)).toBe('even');
    expect(tapiocaSpread(1)).toBe('even');
    expect(tapiocaSpread(TAPIOCA_SPREAD.evenTo)).toBe('even');
    expect(tapiocaSpread(TAPIOCA_SPREAD.evenTo + 0.01)).toBe('thick');
    expect(tapiocaServeQuality('perfect', true, 0.8, 'thin')).toBe('soft');
    expect(tapiocaServeQuality('perfect', true, 0.8, 'thick')).toBe('soft');
    expect(tapiocaServeQuality('perfect', false, 0.8, 'thin')).toBe('miss');
    expect(tapiocaServeQuality('perfect', true, 0.8, 'even')).toBe('perfect');
    // about a second of holding lands an even disc
    expect(tapiocaSpread(TAPIOCA_SPREAD.fillPerSec * 0.9)).toBe('even');
  });
});

describe('medals, crown and ties', () => {
  const row = (name: string, best: number, at: number): FeiraDayScore => ({ name, best, game: 'tapioca', at });

  it('gives the crown to the live leader, and a tie to whoever got there first', () => {
    const scores = {
      ana: row('Ana', 200, 5_000),
      bia: row('Bia', 200, 4_000),
      caio: row('Caio', 100, 1_000),
    };
    expect(crownHolder(scores)).toBe('bia');
    expect(placeOf(scores, 'bia')).toBe(1);
    expect(placeOf(scores, 'ana')).toBe(2);
    const awards = medalsForDay('2026-10-08', scores);
    expect(awards.map((a) => [a.id, a.award.medal])).toEqual([
      ['bia', 'gold'],
      ['ana', 'silver'],
      ['caio', 'bronze'],
    ]);
  });

  it('clears the crown when the board is empty, and keeps medals across a normalize', () => {
    expect(crownHolder({})).toBeNull();
    const raw = normalizeFeiraGames(
      {
        day: '2026-10-07',
        scores: {},
        medals: { bia: [{ day: '2026-10-07', game: 'tapioca', medal: 'gold', score: 200 }] },
        paid: {},
      },
      '2026-10-08',
    );
    expect(raw.medals.bia).toHaveLength(1);
    expect(medalTallies(raw.medals, { bia: 'Bia' })[0]).toMatchObject({ gold: 1, name: 'Bia' });
    expect(rankFeiraDay(raw.scores)).toEqual([]);
  });
});

describe('feira cart switch', () => {
  it('defaults every game to off, and the catalog is the rotation registry', () => {
    const cfg = normalizeFeiraCartConfig(null);
    expect(cfg.games).toEqual({});
    expect(enabledFeiraGameIds(cfg, '2026-10-08')).toEqual([]);
    expect(featuredEnabled('2026-10-08', [])).toBeNull();
    expect(feiraCartCatalog().map((g) => g.id)).toEqual(['tapioca', 'pastel', 'caldo']);
    expect(feiraCartAdminView(cfg, '2026-10-08')).toMatchObject({
      featured: null,
      games: [
        { id: 'tapioca', mode: 'off', implemented: true },
        { id: 'pastel', mode: 'off', implemented: true },
        { id: 'caldo', mode: 'off', implemented: true },
      ],
    });
    expect(withFeiraCartMode(cfg, 'not-a-game', 'on')).toBeNull();
  });

  it('features one enabled game every day, and rotates only over the ones that are on', () => {
    const only = withFeiraCartMode(emptyFeiraCartConfig(), 'tapioca', 'on')!;
    for (const day of ['1970-01-01', '1970-01-02', '1970-01-03', '2026-10-08']) {
      expect(featuredEnabled(day, enabledFeiraGameIds(only, day))).toBe('tapioca');
    }
    const both = withFeiraCartMode(only, 'caldo', 'on')!;
    const built = ['tapioca', 'pastel', 'caldo'];
    // pastel stays off, so the cycle is tapioca, caldo (not the full 3-day order)
    expect(featuredEnabled('1970-01-01', enabledFeiraGameIds(both, '1970-01-01'), built)).toBe('tapioca');
    expect(featuredEnabled('1970-01-02', enabledFeiraGameIds(both, '1970-01-02'), built)).toBe('caldo');
    expect(featuredEnabled('1970-01-03', enabledFeiraGameIds(both, '1970-01-03'), built)).toBe('tapioca');
    // pastel switched on before a build can start it: skipped, tapioca still every day
    const pastelOn = withFeiraCartMode(emptyFeiraCartConfig(), 'pastel', 'on')!;
    const tapiocaToo = withFeiraCartMode(pastelOn, 'tapioca', 'on')!;
    expect(featuredEnabled('1970-01-02', enabledFeiraGameIds(pastelOn, '1970-01-02'), ['tapioca'])).toBeNull();
    expect(featuredEnabled('1970-01-02', enabledFeiraGameIds(tapiocaToo, '1970-01-02'), ['tapioca'])).toBe('tapioca');
    // this build can start Pastel, so turning that toggle on features Pastel
    expect(featuredEnabled('1970-01-02', enabledFeiraGameIds(pastelOn, '1970-01-02'))).toBe('pastel');
  });

  it('keeps a rotation window for later, and leaves the game off until that window matches', () => {
    const cfg = withFeiraCartMode(emptyFeiraCartConfig(), 'tapioca', 'rotation', { weekdays: [4] })!;
    expect(feiraGameActive(cfg.games.tapioca, '1970-01-01')).toBe(true);
    expect(feiraGameActive(cfg.games.tapioca, '1970-01-02')).toBe(false);
    expect(featuredEnabled('1970-01-02', enabledFeiraGameIds(cfg, '1970-01-02'))).toBeNull();
    const waiting = withFeiraCartMode(emptyFeiraCartConfig(), 'tapioca', 'rotation')!;
    expect(feiraGameActive(waiting.games.tapioca, '1970-01-01')).toBe(false);
    const kept = withFeiraCartMode(cfg, 'tapioca', 'off')!;
    expect(kept.games.tapioca).toMatchObject({ mode: 'off', schedule: { weekdays: [4] } });
    const back = withFeiraCartMode(kept, 'tapioca', 'on')!;
    expect(feiraGameActive(back.games.tapioca, '1970-01-02')).toBe(true);
  });

  it('normalizes a saved file without dropping an unknown future game', () => {
    const cfg = normalizeFeiraCartConfig({
      version: 1,
      games: {
        tapioca: { mode: 'yes-please' },
        future_game: { mode: 'on', schedule: { weekdays: [1, 1, 9], from: '2026-01-01' } },
      },
    });
    expect(cfg.games.tapioca?.mode).toBe('off');
    expect(cfg.games.future_game).toEqual({ mode: 'on', schedule: { from: '2026-01-01', weekdays: [1] } });
  });

  it('hides the cart and the sign when nothing is featured, including outside a rotation window', () => {
    const off = { closed: true as const, game: null };
    expect(feiraCartShown(off)).toBe(false);
    expect(feiraCartShown(null)).toBe(false);
    const hidden = withoutHiddenFeiraCart(ROOMS.feira, false);
    for (const id of FEIRA_CART_WORLD_IDS) expect(hidden.props.some((p) => p.id === id)).toBe(false);
    // stall carts, Seu Chico, and the coconut cart's cousins stay
    expect(hidden.props.some((p) => p.id === 'carrinho_feira_1')).toBe(true);
    expect(hidden.props.some((p) => p.id === 'feira_chico' && p.vendor === 'chico')).toBe(true);
    const grid = buildGrid(hidden);
    expect(isWalkable(grid, 21, 7)).toBe(true);
    expect(isWalkable(grid, 18, 7)).toBe(true);
    expect(isWalkable(grid, 22, 7)).toBe(true);
    const shown = withoutHiddenFeiraCart(ROOMS.feira, true);
    expect(shown).toBe(ROOMS.feira);
    const blocked = buildGrid(shown);
    expect(blocked.blocked.has(key(21, 7))).toBe(true);
    expect(blocked.blocked.has(key(18, 7))).toBe(true);
    expect(feiraCartShown({ closed: false, game: 'pastel' })).toBe(true);

    // Thursday is in the window; Friday is not, so Friday hides the cart the same way
    const cfg = withFeiraCartMode(emptyFeiraCartConfig(), 'pastel', 'rotation', { weekdays: [4] })!;
    expect(featuredEnabled('1970-01-01', enabledFeiraGameIds(cfg, '1970-01-01'))).toBe('pastel');
    expect(featuredEnabled('1970-01-02', enabledFeiraGameIds(cfg, '1970-01-02'))).toBeNull();
    expect(feiraCartShown({ closed: true, game: null })).toBe(false);
  });

  it('dresses the cart for the featured game, so a Pastel or Caldo day never shows the TAPIOCA plaque', () => {
    const art = (game: (typeof FEIRA_IMPLEMENTED_GAMES)[number]) =>
      feiraRoomFor(ROOMS.feira, { closed: false, game }).props.find((p) => p.id === 'carrinho_jogos')!.art;
    expect(art('tapioca')).toBe('props/carrinho_feira');
    expect(art('pastel')).toBe('props/carrinho_feira_pastel');
    expect(art('caldo')).toBe('props/carrinho_feira_caldo');
    expect(new Set(FEIRA_IMPLEMENTED_GAMES.map((g) => FEIRA_CART_ART[g])).size).toBe(FEIRA_IMPLEMENTED_GAMES.length);
    // nothing featured: no cart at all; another room is untouched
    const hidden = feiraRoomFor(ROOMS.feira, { closed: true, game: null });
    for (const id of FEIRA_CART_WORLD_IDS) expect(hidden.props.some((p) => p.id === id)).toBe(false);
    expect(feiraRoomFor(ROOMS.praca, { closed: false, game: 'pastel' })).toBe(ROOMS.praca);
    // only the cart's art changes: same props, same blocking
    const pastel = feiraRoomFor(ROOMS.feira, { closed: false, game: 'pastel' });
    expect(pastel.props.map((p) => p.id)).toEqual(ROOMS.feira.props.map((p) => p.id));
  });

  it('keeps lamps out of the cart plaque, and marks free slots with a lettered VAGA slate (never a blank board)', () => {
    const cart = ROOMS.feira.props.find((p) => p.id === 'carrinho_jogos')!;
    for (const lamp of ROOMS.feira.props.filter((p) => p.kind === 'poste')) {
      const inFront = lamp.y > cart.y && lamp.y <= cart.y + 3 && lamp.x >= cart.x - 1 && lamp.x <= cart.x + 3;
      expect(inFront, lamp.id).toBe(false);
    }
    for (const p of ROOMS.feira.props.filter((q) => q.id.startsWith('vaga_'))) expect(p.art).toBe('feira/vaga');
  });

  it('does not point a recado, a readable sign, or a diary object at a hidden cart game', () => {
    const ids = new Set<string>(FEIRA_CART_WORLD_IDS);
    for (const d of RECADOS) {
      for (const step of d.steps) {
        if (step.kind === 'ler') expect(ids.has(step.hotspotId), d.id).toBe(false);
      }
    }
    for (const h of HOTSPOTS) expect(ids.has(h.id), h.id).toBe(false);
    for (const p of DIARY_PLACEMENTS) expect(ids.has(p.id), p.id).toBe(false);
  });
});

describe('cart customers', () => {
  it('never puts the same regular at the counter twice among any three in a row', () => {
    for (const seed of [1, 7, 42, 99, 12345, 0xdeadbeef]) {
      for (const orders of [tapiocaOrders(seed), pastelOrders(seed), caldoOrders(seed)]) {
        for (let i = 2; i < orders.length; i++) {
          const three = new Set([orders[i - 2]!.who, orders[i - 1]!.who, orders[i]!.who]);
          expect(three.size).toBe(3);
        }
      }
    }
  });
});
