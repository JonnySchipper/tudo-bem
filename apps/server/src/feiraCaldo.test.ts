import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, ROOMS, caldoOrders, todayEastern, type ServerMsg } from '@tudobem/shared';
import { type Session } from './world.js';
import { ProfileStore, type StoredProfile } from './store.js';
import { FeiraGamesEngine, memoryFeiraGames, type FeiraGamesDeps } from './feiraGames.js';

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

function engineFor(now: () => number, ana: StoredProfile, store: ProfileStore, sent: ServerMsg[]) {
  const games = memoryFeiraGames(now);
  const s = {
    id: 's',
    profile: ana,
    send: (m: ServerMsg) => sent.push(m),
    instance: { def: ROOMS.feira },
  } as unknown as Session;
  const engine = new FeiraGamesEngine({
    now,
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
    rng: () => 0.33,
  } satisfies FeiraGamesDeps);
  return { engine, games, s };
}

describe('caldo de cana on the server', () => {
  it('stays closed until an admin enables it, then deals caldo', () => {
    let now = Date.parse('2026-10-08T16:00:00.000Z');
    const store = new ProfileStore(null);
    const ana = profile('lia', 'Lia');
    store.add(ana);
    const sent: ServerMsg[] = [];
    const { engine, games, s } = engineFor(() => now, ana, store, sent);
    expect(engine.toggles().find((t) => t.id === 'caldo')?.on).toBe(false);
    engine.handle(s, { t: 'feiraGame', action: 'start' });
    expect(sent.some((m) => m.t === 'error' && m.code === 'closed')).toBe(true);
    expect(s.feiraGame).toBeUndefined();

    expect(engine.setEnabled('caldo', true)).toBe(true);
    expect(engine.toggles().find((t) => t.id === 'caldo')?.on).toBe(true);
    expect(engine.toggles().find((t) => t.id === 'tapioca')?.on).toBe(false);
    sent.length = 0;
    engine.handle(s, { t: 'feiraGame', action: 'start' });
    const start = sent.find((m) => m.t === 'feiraGame' && m.phase === 'start');
    expect(start && start.t === 'feiraGame' && start.phase === 'start' && start.game).toBe('caldo');
    if (!start || start.t !== 'feiraGame' || start.phase !== 'start') return;
    const orders = caldoOrders(start.seed);
    now += 20_000;
    const outcomes = orders.filter((o) => o.at <= 18_000).slice(0, 2).map((o) => ({
      i: orders.indexOf(o),
      quality: 'perfect' as const,
      atMs: o.at + 400,
    }));
    const before = ana.coins;
    engine.handle(s, { t: 'feiraGame', action: 'finish', outcomes });
    expect(ana.coins).toBeGreaterThan(before);
    expect(ana.coins - before).toBeLessThanOrEqual(25);
    expect(games.state.scores.lia!.game).toBe('caldo');
    expect(games.state.enabled.caldo).toBe(true);
  });

  it('keeps the caldo switch on when the ET day rolls', () => {
    let now = Date.parse('2026-10-08T20:00:00.000Z');
    const store = new ProfileStore(null);
    const games = memoryFeiraGames(() => now);
    games.state.day = todayEastern(now);
    games.state.enabled = { caldo: true };
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
    expect(engine.tick().rolled).toBe(true);
    expect(games.state.scores).toEqual({});
    expect(games.state.enabled.caldo).toBe(true);
    expect(engine.toggles().find((t) => t.id === 'caldo')?.on).toBe(true);
  });
});
