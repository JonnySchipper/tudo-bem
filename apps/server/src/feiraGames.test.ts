import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, ROOMS, todayEastern, type ServerMsg } from '@tudobem/shared';
import { World, type Session } from './world.js';
import { ProfileStore, type StoredProfile } from './store.js';
import { AuthoredNpcDialogue, InMemoryStudentModel, JevStubSafety, PhrasebookGloss } from './services/stubs.js';
import { FeiraGamesEngine, memoryFeiraGames, type FeiraGamesDeps } from './feiraGames.js';
import { pastelOrders, tapiocaOrders, type FeiraGameId } from '@tudobem/shared';
import { memoryFeiraCart } from './feiraCart.js';

function ordersFor(game: FeiraGameId, seed: number): { at: number }[] {
  return game === 'pastel' ? pastelOrders(seed) : tapiocaOrders(seed);
}

function cartOn(...ids: string[]) {
  const cart = memoryFeiraCart();
  for (const id of ids) cart.setMode(id, 'on');
  return cart;
}

function profile(id: string, name: string): StoredProfile {
  return {
    id,
    token: `t-${id}`,
    name,
    pronoun: 'ela',
    appearance: DEFAULT_APPEARANCE,
    nameplate: 'verde',
    coins: 10,
    hats: [],
    hat: null,
    furniture: {},
    apartment: [],
    parrotOwned: false,
    parrotEquipped: false,
    friends: [],
    tutorial: { andar: true, sentar: true, acenar: true, conversar: true, carlos: true, meveum: true, chapeu: true, cadeira: true },
    tutorialRewarded: true,
    createdAt: 1,
    ageGate18: true,
    daily: { date: '2026-10-08', sceneClears: {} },
    lastSeen: 1,
  };
}

describe('feira games server', () => {
  it('pays the first 3 runs of an ET day and then blocks, while the score still counts', () => {
    let now = Date.parse('2026-10-08T16:00:00.000Z');
    const store = new ProfileStore(null);
    const ana = profile('ana', 'Ana');
    store.add(ana);
    const games = memoryFeiraGames(() => now);
    const sent: ServerMsg[] = [];
    const s = {
      id: 's',
      profile: ana,
      send: (m: ServerMsg) => sent.push(m),
      instance: { def: ROOMS.feira },
    } as unknown as Session;
    const engine = new FeiraGamesEngine({
      now: () => now,
      store,
      games,
      reward: (sess, amount) => {
        sess.profile!.coins += amount;
      },
      pushProfile: () => {},
      err: (_s, code) => sent.push({ t: 'error', code, pt: '', en: '' }),
      tileOf: () => ({ x: 22, y: 9, room: 'feira' }),
      broadcastAll: () => {},
      broadcastAvatar: () => {},
      rng: () => 0.42,
      cart: cartOn('tapioca'),
    } satisfies FeiraGamesDeps);

    const play = (scoreOutcomes: 'perfect' | 'ok') => {
      sent.length = 0;
      engine.handle(s, { t: 'feiraGame', action: 'start' });
      const start = sent.find((m) => m.t === 'feiraGame' && m.phase === 'start');
      expect(start && start.t === 'feiraGame' && start.phase === 'start').toBeTruthy();
      if (!start || start.t !== 'feiraGame' || start.phase !== 'start') return;
      const orders = ordersFor(start.game, start.seed);
      now += 20_000;
      const outcomes = orders.filter((o) => o.at <= 18_000).slice(0, 2).map((o, i) => ({
        i: orders.indexOf(o),
        quality: scoreOutcomes,
        atMs: o.at + 500,
      }));
      engine.handle(s, { t: 'feiraGame', action: 'finish', outcomes });
    };

    const coins = () => ana.coins;
    const before = coins();
    play('perfect');
    expect(coins()).toBeGreaterThan(before);
    const paid1 = coins() - before;
    expect(paid1).toBeGreaterThanOrEqual(5);
    expect(paid1).toBeLessThanOrEqual(25);
    play('ok');
    play('ok');
    const after3 = coins();
    expect(after3).toBeGreaterThan(before);
    play('perfect');
    expect(coins()).toBe(after3);
    const end = [...sent].reverse().find((m) => m.t === 'feiraGame' && m.phase === 'end');
    expect(end && end.t === 'feiraGame' && end.phase === 'end' && end.dailyBlocked).toBe(true);
    expect(games.state.scores.ana!.best).toBeGreaterThan(0);
  });

  it('rejects a forged finish and does not pay it', () => {
    let now = Date.parse('2026-10-08T16:00:00.000Z');
    const store = new ProfileStore(null);
    const ana = profile('bia', 'Bia');
    store.add(ana);
    const games = memoryFeiraGames(() => now);
    const sent: ServerMsg[] = [];
    const s = { id: 's', profile: ana, send: (m: ServerMsg) => sent.push(m), instance: { def: ROOMS.feira } } as unknown as Session;
    const engine = new FeiraGamesEngine({
      now: () => now,
      store,
      games,
      reward: (sess, amount) => {
        sess.profile!.coins += amount;
      },
      pushProfile: () => {},
      err: () => {},
      tileOf: () => ({ x: 22, y: 9, room: 'feira' }),
      broadcastAll: () => {},
      broadcastAvatar: () => {},
      rng: () => 0.2,
      cart: cartOn('tapioca'),
    });
    engine.handle(s, { t: 'feiraGame', action: 'start' });
    now += 400;
    const before = ana.coins;
    engine.handle(s, { t: 'feiraGame', action: 'finish', outcomes: [{ i: 0, quality: 'perfect', atMs: 100 }] });
    expect(ana.coins).toBe(before);
    expect(games.state.scores.bia?.best ?? 0).toBe(0);
  });

  it('finalizes medals at midnight ET, clears the board and the crown, and keeps medals', () => {
    let now = Date.parse('2026-10-08T20:00:00.000Z'); // 16:00 ET
    const store = new ProfileStore(null);
    const ana = profile('ana', 'Ana');
    const bia = profile('bia', 'Bia');
    store.add(ana);
    store.add(bia);
    const games = memoryFeiraGames(() => now);
    games.state.day = todayEastern(now);
    games.state.scores = {
      bia: { name: 'Bia', best: 180, game: 'tapioca', at: now - 5_000 },
      ana: { name: 'Ana', best: 180, game: 'tapioca', at: now - 1_000 },
    };
    const crowns: (string | null)[] = [];
    const engine = new FeiraGamesEngine({
      now: () => now,
      store,
      games,
      reward: () => {},
      pushProfile: () => {},
      err: () => {},
      tileOf: () => ({ x: 22, y: 9, room: 'feira' }),
      broadcastAll: (m) => {
        if (m.t === 'feiraGame' && m.phase === 'crown') crowns.push(m.id);
      },
      broadcastAvatar: () => {},
    });
    expect(engine.crownId()).toBe('bia');
    // still the same ET day
    now = Date.parse('2026-10-09T03:30:00.000Z'); // 23:30 ET Oct 8
    expect(engine.tick().rolled).toBe(false);
    expect(engine.crownId()).toBe('bia');
    // 00:30 ET Oct 9
    now = Date.parse('2026-10-09T04:30:00.000Z');
    const rolled = engine.tick();
    expect(rolled.rolled).toBe(true);
    expect(rolled.awards.map((a) => [a.id, a.award.medal])).toEqual([
      ['bia', 'gold'],
      ['ana', 'silver'],
    ]);
    expect(games.state.scores).toEqual({});
    expect(games.state.paid).toEqual({});
    expect(engine.crownId()).toBeNull();
    expect(crowns).toEqual([null]);
    expect(games.state.medals.bia).toHaveLength(1);
    expect(ana.feiraMedals?.[0]?.medal).toBe('silver');
    expect(bia.feiraMedals?.[0]?.medal).toBe('gold');
    // a second tick the same day does not mint medals again
    expect(engine.tick().rolled).toBe(false);
    expect(games.state.medals.bia).toHaveLength(1);
  });

  it('refuses a start away from the cart', () => {
    const now = Date.parse('2026-10-08T16:00:00.000Z');
    const store = new ProfileStore(null);
    const ana = profile('ana', 'Ana');
    store.add(ana);
    const sent: ServerMsg[] = [];
    const s = { id: 's', profile: ana, send: (m: ServerMsg) => sent.push(m), instance: { def: ROOMS.feira } } as unknown as Session;
    const engine = new FeiraGamesEngine({
      now: () => now,
      store,
      games: memoryFeiraGames(() => now),
      reward: () => {},
      pushProfile: () => {},
      err: (_s, code) => sent.push({ t: 'error', code, pt: 'x', en: 'y' }),
      tileOf: () => ({ x: 2, y: 2, room: 'feira' }),
      broadcastAll: () => {},
      broadcastAvatar: () => {},
    });
    engine.handle(s, { t: 'feiraGame', action: 'start' });
    expect(sent.some((m) => m.t === 'error' && m.code === 'far')).toBe(true);
    expect(s.feiraGame).toBeUndefined();
  });

  it('starts closed: a start and a score submit are rejected until a game is turned on', () => {
    let now = Date.parse('2026-10-08T16:00:00.000Z');
    const store = new ProfileStore(null);
    const ana = profile('ana', 'Ana');
    store.add(ana);
    const cart = memoryFeiraCart();
    const games = memoryFeiraGames(() => now);
    const sent: ServerMsg[] = [];
    const s = { id: 's', profile: ana, send: (m: ServerMsg) => sent.push(m), instance: { def: ROOMS.feira } } as unknown as Session;
    const engine = new FeiraGamesEngine({
      now: () => now,
      store,
      games,
      cart,
      reward: (sess, amount) => {
        sess.profile!.coins += amount;
      },
      pushProfile: () => {},
      err: (_s, code, pt, en) => sent.push({ t: 'error', code, pt, en }),
      tileOf: () => ({ x: 22, y: 9, room: 'feira' }),
      broadcastAll: () => {},
      broadcastAvatar: () => {},
    });
    expect(engine.featuredNow()).toBeNull();
    engine.handle(s, { t: 'feiraGame', action: 'start' });
    expect(sent.some((m) => m.t === 'error' && m.code === 'far')).toBe(true);
    expect(s.feiraGame).toBeUndefined();
    const before = ana.coins;
    engine.handle(s, { t: 'feiraGame', action: 'finish', outcomes: [{ i: 0, quality: 'perfect', atMs: 12_000 }] });
    expect(ana.coins).toBe(before);
    expect(games.state.scores.ana).toBeUndefined();

    cart.setMode('tapioca', 'on');
    sent.length = 0;
    engine.handle(s, { t: 'feiraGame', action: 'start' });
    expect(sent.some((m) => m.t === 'feiraGame' && m.phase === 'start')).toBe(true);
    cart.setMode('tapioca', 'off');
    now += 20_000;
    const coins = ana.coins;
    engine.handle(s, { t: 'feiraGame', action: 'finish', outcomes: [{ i: 0, quality: 'perfect', atMs: 12_000 }] });
    expect(sent.some((m) => m.t === 'error' && m.code === 'feira_closed')).toBe(true);
    expect(ana.coins).toBe(coins);
    expect(games.state.scores.ana).toBeUndefined();
  });

  it('pastel is its own switch and stays off until it is turned on', () => {
    // 1970-01-02 is Pastel's calendar slot. Implemented is not the same as on.
    const now = Date.parse('1970-01-02T17:00:00.000Z');
    const store = new ProfileStore(null);
    const ana = profile('ana', 'Ana');
    store.add(ana);
    const cart = memoryFeiraCart();
    const sent: ServerMsg[] = [];
    const s = { id: 's', profile: ana, send: (m: ServerMsg) => sent.push(m), instance: { def: ROOMS.feira } } as unknown as Session;
    const engine = new FeiraGamesEngine({
      now: () => now,
      store,
      games: memoryFeiraGames(() => now),
      cart,
      reward: () => {},
      pushProfile: () => {},
      err: (_s, code) => sent.push({ t: 'error', code, pt: 'x', en: 'y' }),
      tileOf: () => ({ x: 22, y: 9, room: 'feira' }),
      broadcastAll: () => {},
      broadcastAvatar: () => {},
    });
    expect(engine.featuredNow()).toBeNull();
    engine.handle(s, { t: 'feiraGame', action: 'start' });
    expect(sent.some((m) => m.t === 'error' && m.code === 'far')).toBe(true);
    cart.setMode('pastel', 'on');
    sent.length = 0;
    engine.handle(s, { t: 'feiraGame', action: 'start' });
    const start = sent.find((m) => m.t === 'feiraGame' && m.phase === 'start');
    expect(start && start.t === 'feiraGame' && start.phase === 'start' && start.game).toBe('pastel');
  });

  it('a test pin switches pastel on even when today is tapioca and the saved flags are off', () => {
    // 1970-01-01 17:00 UTC is still Jan 1 in ET, and that slot is tapioca.
    const now = Date.parse('1970-01-01T17:00:00.000Z');
    const store = new ProfileStore(null);
    const ana = profile('ana', 'Ana');
    store.add(ana);
    const sent: ServerMsg[] = [];
    const s = { id: 's', profile: ana, send: (m: ServerMsg) => sent.push(m), instance: { def: ROOMS.feira } } as unknown as Session;
    const engine = new FeiraGamesEngine({
      now: () => now,
      store,
      games: memoryFeiraGames(() => now),
      reward: () => {},
      pushProfile: () => {},
      err: () => {},
      tileOf: () => ({ x: 22, y: 9, room: 'feira' }),
      broadcastAll: () => {},
      broadcastAvatar: () => {},
      pin: 'pastel',
    });
    expect(engine.featuredNow()).toBe('pastel');
    engine.handle(s, { t: 'feiraGame', action: 'start' });
    const start = sent.find((m) => m.t === 'feiraGame' && m.phase === 'start');
    expect(start && start.t === 'feiraGame' && start.phase === 'start' && start.game).toBe('pastel');
  });

  it('does not mint medals on a day nobody played', () => {
    let now = Date.parse('2026-10-08T16:00:00.000Z');
    const store = new ProfileStore(null);
    const games = memoryFeiraGames(() => now);
    games.state.day = todayEastern(now);
    games.state.scores = {};
    const engine = new FeiraGamesEngine({
      now: () => now,
      store,
      games,
      reward: () => {},
      pushProfile: () => {},
      err: () => {},
      tileOf: () => ({ x: 22, y: 9, room: 'feira' }),
      broadcastAll: () => {},
      broadcastAvatar: () => {},
    });
    now = Date.parse('2026-10-09T04:30:00.000Z');
    const rolled = engine.tick();
    expect(rolled.rolled).toBe(true);
    expect(rolled.awards).toEqual([]);
    expect(games.state.medals).toEqual({});
    expect(engine.crownId()).toBeNull();
  });

  it('does not open the sign when the cart is hidden, and still keeps medals on the tally', () => {
    const now = Date.parse('2026-10-08T16:00:00.000Z');
    const store = new ProfileStore(null);
    const ana = profile('ana', 'Ana');
    store.add(ana);
    const games = memoryFeiraGames(() => now);
    games.state.medals = { ana: [{ day: '2026-10-07', game: 'tapioca', medal: 'gold', score: 40 }] };
    const sent: ServerMsg[] = [];
    const s = { id: 's', profile: ana, send: (m: ServerMsg) => sent.push(m), instance: { def: ROOMS.feira } } as unknown as Session;
    const engine = new FeiraGamesEngine({
      now: () => now,
      store,
      games,
      reward: () => {},
      pushProfile: () => {},
      err: (_s, code) => sent.push({ t: 'error', code, pt: 'x', en: 'y' }),
      tileOf: () => ({ x: 19, y: 8, room: 'feira' }),
      broadcastAll: () => {},
      broadcastAvatar: () => {},
    });
    engine.handle(s, { t: 'feiraGame', action: 'board' });
    expect(sent.some((m) => m.t === 'feiraGame' && m.phase === 'board')).toBe(false);
    expect(sent.some((m) => m.t === 'error' && m.code === 'far')).toBe(true);
    expect(games.state.medals.ana?.[0]).toMatchObject({ medal: 'gold' });
  });

  it('leaves a testUser off the public board, the crown, and the medals', () => {
    let now = Date.parse('2026-10-08T16:00:00.000Z');
    const store = new ProfileStore(null);
    const ana = profile('ana', 'Ana');
    const jonny = profile('jonny', 'Jonny');
    jonny.testUser = true;
    jonny.feiraMedals = [{ day: '2026-10-07', game: 'tapioca', medal: 'gold', score: 50 }];
    store.add(ana);
    store.add(jonny);
    const games = memoryFeiraGames(() => now);
    games.state.day = todayEastern(now);
    games.state.scores = {
      jonny: { name: 'Jonny', best: 900, game: 'tapioca', at: now - 5_000 },
      ana: { name: 'Ana', best: 100, game: 'tapioca', at: now - 1_000 },
    };
    games.state.medals = { jonny: [{ day: '2026-10-07', game: 'tapioca', medal: 'gold', score: 50 }] };
    const sent: ServerMsg[] = [];
    const crowns: (string | null)[] = [];
    const s = { id: 's', profile: jonny, send: (m: ServerMsg) => sent.push(m), instance: { def: ROOMS.feira } } as unknown as Session;
    const engine = new FeiraGamesEngine({
      now: () => now,
      store,
      games,
      reward: (sess, amount) => {
        sess.profile!.coins += amount;
      },
      pushProfile: () => {},
      err: () => {},
      tileOf: () => ({ x: 22, y: 9, room: 'feira' }),
      broadcastAll: (m) => {
        if (m.t === 'feiraGame' && m.phase === 'crown') crowns.push(m.id);
      },
      broadcastAvatar: () => {},
      rng: () => 0.42,
      cart: cartOn('tapioca'),
    });
    expect(engine.crownId()).toBe('ana');
    expect(games.state.scores.jonny).toBeUndefined();
    expect(games.state.scores.ana?.best).toBe(100);
    expect(games.state.medals.jonny).toBeUndefined();
    expect(jonny.feiraMedals).toEqual([]);

    sent.length = 0;
    engine.handle(s, { t: 'feiraGame', action: 'start' });
    const start = sent.find((m) => m.t === 'feiraGame' && m.phase === 'start');
    expect(start && start.t === 'feiraGame' && start.phase === 'start').toBeTruthy();
    if (!start || start.t !== 'feiraGame' || start.phase !== 'start') return;
    const orders = ordersFor(start.game, start.seed);
    now += 20_000;
    const outcomes = orders.filter((o) => o.at <= 18_000).slice(0, 2).map((o) => ({
      i: orders.indexOf(o),
      quality: 'perfect' as const,
      atMs: o.at + 500,
    }));
    const before = jonny.coins;
    engine.handle(s, { t: 'feiraGame', action: 'finish', outcomes });
    expect(jonny.coins).toBeGreaterThan(before);
    expect(jonny.testFeiraPaid?.n).toBe(1);
    expect(games.state.scores.jonny).toBeUndefined();
    expect(games.state.paid.jonny).toBeUndefined();
    expect(engine.crownId()).toBe('ana');
    const end = [...sent].reverse().find((m) => m.t === 'feiraGame' && m.phase === 'end');
    expect(end && end.t === 'feiraGame' && end.phase === 'end' && end.crown).toBe(false);
    expect(end && end.t === 'feiraGame' && end.phase === 'end' && end.place).toBe(0);
    expect(crowns.at(-1)).toBe('ana');

    engine.handle(s, { t: 'feiraGame', action: 'board' });
    const board = [...sent].reverse().find((m) => m.t === 'feiraGame' && m.phase === 'board');
    expect(board && board.t === 'feiraGame' && board.phase === 'board' && board.top.some((row) => row.id === 'jonny')).toBe(false);
    expect(board && board.t === 'feiraGame' && board.phase === 'board' && board.top.some((row) => row.id === 'ana')).toBe(true);
    expect(board && board.t === 'feiraGame' && board.phase === 'board' && board.medals.some((row) => row.id === 'jonny')).toBe(false);
    expect(board && board.t === 'feiraGame' && board.phase === 'board' && board.crownId).toBe('ana');

    now = Date.parse('2026-10-09T05:00:00.000Z');
    const rolled = engine.tick();
    expect(rolled.awards.map((a) => a.id)).toEqual(['ana']);
    expect(ana.feiraMedals?.[0]?.medal).toBe('gold');
    expect(jonny.feiraMedals).toEqual([]);
    expect(games.state.medals.jonny).toBeUndefined();
    expect(games.state.medals.ana?.[0]?.medal).toBe('gold');
  });
});
