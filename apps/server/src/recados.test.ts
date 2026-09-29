import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_APPEARANCE,
  GAME_DAY_MS,
  gameDay,
  gameMinutes,
  greetingFor,
  HOTSPOTS,
  mgPerfectBuilt,
  RECADOS,
  ROOMS,
  type ClientMsg,
  type ServerMsg,
} from '@tudobem/shared';
import { World, type Session } from './world.js';
import { ProfileStore, type PersistenceAdapter, type StoredProfile } from './store.js';
import { AuthoredNpcDialogue, InMemoryStudentModel, JevStubSafety, MemoryModerationQueue, PhrasebookGloss } from './services/stubs.js';

let clock = 5_000_000;
const pending: { fn: () => void; at: number }[] = [];
function advance(ms: number) {
  clock += ms;
  for (let guard = 0; guard < 200; guard++) {
    const ready = pending.filter((p) => p.at <= clock);
    if (!ready.length) break;
    for (const p of ready) {
      pending.splice(pending.indexOf(p), 1);
      p.fn();
    }
  }
}

function makeWorld(store = new ProfileStore(null)) {
  const world = new World(
    store,
    { safety: new JevStubSafety(), gloss: new PhrasebookGloss(), npc: new AuthoredNpcDialogue(), student: new InMemoryStudentModel(), moderation: new MemoryModerationQueue() },
    { mgGapMs: 0, now: () => clock, schedule: (fn, ms) => pending.push({ fn, at: clock + ms }) },
  );
  return world;
}

interface Client {
  s: Session;
  inbox: ServerMsg[];
  send: (m: ClientMsg) => Promise<void>;
  last: <T extends ServerMsg['t']>(t: T) => Extract<ServerMsg, { t: T }> | undefined;
  all: <T extends ServerMsg['t']>(t: T) => Extract<ServerMsg, { t: T }>[];
}

let n = 0;
async function client(world: World, name = `Rec${n++}`): Promise<Client> {
  const inbox: ServerMsg[] = [];
  const s = world.connect(`r${n++}`, (m) => inbox.push(m), () => {});
  const c: Client = {
    s,
    inbox,
    send: (m) => world.handle(s, m),
    last: (t) => [...inbox].reverse().find((m) => m.t === t) as never,
    all: (t) => inbox.filter((m) => m.t === t) as never,
  };
  await c.send({ t: 'hello' });
  await c.send({ t: 'createProfile', name, pronoun: 'ela', appearance: DEFAULT_APPEARANCE });
  await c.send({ t: 'join', room: 'praca' });
  return c;
}

const nanda = ROOMS.praca.npcs.find((x) => x.id === 'nanda')!;

/** Walk to a tile and let the walk finish. */
async function walkTo(c: Client, x: number, y: number) {
  await c.send({ t: 'move', x, y });
  advance(120_000);
}

const errors = (c: Client) => c.all('error').map((e) => e.code);

/** The daily offer is random (5 recados unlock at bond 0); pin it so a test can accept a specific one. */
const offer = (c: Client, ...ids: string[]) => {
  c.s.profile!.recados!.offered = ids;
};

/** Recados a brand-new player can be offered today: bond 0 and no feature flag (feira, dialogue). */
const NEW_PLAYER_POOL = ['carlos_cafe_pra_nanda', 'nanda_coxinha', 'julia_cumprimento_certo', 'graca_pao_pra_julia', 'nanda_um_oi_pro_carlos'];

describe('recados on the server', () => {
  beforeEach(() => {
    clock = 5_000_000;
    pending.length = 0;
  });

  it('a new player gets defaults and a board of three; unknown ids and a fourth active are refused', async () => {
    const world = makeWorld();
    const a = await client(world);
    const p = a.s.profile!;
    expect(p.bag).toEqual({});
    expect(p.bond).toEqual({});
    expect(p.recados).toMatchObject({ day: gameDay(clock), active: [], done: [] });
    expect(p.recados!.offered).toHaveLength(3);
    // the join already sent the board
    const board = a.last('recados')!;
    expect(board.day).toBe(gameDay(clock));
    expect(new Set(board.offered.map((o) => o.id)).size).toBe(3);
    for (const o of board.offered) expect(NEW_PLAYER_POOL).toContain(o.id);
    expect(board.active).toEqual([]);

    await a.send({ t: 'recados', action: 'accept', id: 'carlos_agua_pra_julia' }); // locked (needs 1 heart)
    await a.send({ t: 'recados', action: 'accept', id: 'nope' });
    await a.send({ t: 'recados', action: 'accept' });
    expect(errors(a)).toEqual(['recado', 'recado', 'recado']);

    await a.send({ t: 'recados', action: 'accept', id: 'tia_lu_banana_pra_nanda' }); // gated by the feira flag: never offered
    expect(errors(a)).toHaveLength(4);
    offer(a, 'nanda_coxinha', 'carlos_cafe_pra_nanda', 'julia_cumprimento_certo');
    await a.send({ t: 'recados', action: 'accept', id: 'nanda_coxinha' });
    await a.send({ t: 'recados', action: 'accept', id: 'nanda_coxinha' }); // already active
    expect(errors(a)).toHaveLength(5);
    expect(a.last('recados')!.active.map((r) => r.id)).toEqual(['nanda_coxinha']);
    expect(a.last('recados')!.offered.map((o) => o.id)).not.toContain('nanda_coxinha');
    expect(a.last('recados')!.active[0]).toMatchObject({ step: 0, steps: 2, giver: 'nanda' });
    await a.send({ t: 'recados', action: 'list' });
    expect(a.last('recados')!.active).toHaveLength(1);
  });

  it('accept → order at the padaria → give to the NPC → rewarded once', async () => {
    const world = makeWorld();
    const a = await client(world);
    const p = a.s.profile!;
    const coins = p.coins;
    offer(a, 'carlos_cafe_pra_nanda');
    await a.send({ t: 'recados', action: 'accept', id: 'carlos_cafe_pra_nanda' });

    // Order at the padaria (the Carlos scene ends with a café com leite in the order).
    await a.send({ t: 'join', room: 'padaria' });
    await a.send({ t: 'scene', action: 'start', npc: 'carlos' });
    for (let i = 0; i < 5; i++) await a.send({ t: 'scene', action: 'choose', chip: 0 });
    expect(a.last('scene')!.view.end).toBe(true);
    expect(p.bag?.cafe_com_leite).toBe(1);
    expect(p.recados!.active).toEqual([{ id: 'carlos_cafe_pra_nanda', step: 1 }]);
    expect(a.last('notice')).toBeTruthy();
    expect(a.all('notice').some((m) => m.pt.startsWith('✓ Peça'))).toBe(true);
    // Talking to Carlos earned the daily talk bond (+2), once.
    expect(p.bond).toEqual({ carlos: 2 });

    // Hand it over to Nanda in the praça.
    await a.send({ t: 'join', room: 'praca' });
    await walkTo(a, nanda.interact.x, nanda.interact.y);
    const coinsBefore = p.coins;
    const rewardsBefore = a.all('reward').length;
    await a.send({ t: 'give', npc: 'nanda', itemId: 'cafe_com_leite' });
    expect(errors(a)).toEqual([]);
    const done = RECADOS.find((d) => d.id === 'carlos_cafe_pra_nanda')!;
    expect(p.coins).toBe(coinsBefore + done.reward.rv);
    expect(coinsBefore).toBeGreaterThanOrEqual(coins);
    expect(a.all('reward')).toHaveLength(rewardsBefore + 1);
    expect(a.last('reward')).toMatchObject({ amount: done.reward.rv, coins: p.coins });
    expect(p.bag?.cafe_com_leite).toBeUndefined();
    expect(p.bond?.carlos).toBe(2 + done.reward.bond);
    expect(p.recados!.active).toEqual([]);
    expect(p.recados!.done).toEqual(['carlos_cafe_pra_nanda']);
    expect(a.all('notice').some((m) => m.level === 'reward' && m.pt.includes(done.thanks.pt) && m.pt.startsWith('Seu Carlos'))).toBe(true);
    expect(a.last('profile')!.profile.bond?.carlos).toBe(2 + done.reward.bond);
    expect(a.last('recados')!.done).toEqual(['carlos_cafe_pra_nanda']);

    // Giving again pays nothing: it is no longer offered, the item is gone.
    await a.send({ t: 'give', npc: 'nanda', itemId: 'cafe_com_leite' });
    expect(errors(a)).toEqual(['bag']);
    expect(p.coins).toBe(coinsBefore + done.reward.rv);
    await a.send({ t: 'recados', action: 'accept', id: 'carlos_cafe_pra_nanda' });
    expect(errors(a).at(-1)).toBe('recado');
    expect(a.last('recados')!.offered.map((o) => o.id)).not.toContain('carlos_cafe_pra_nanda');
  });

  it('a correct Me vê um order also puts the items in the bag and can complete an order step', async () => {
    const world = makeWorld();
    const a = await client(world);
    const p = a.s.profile!;
    await a.send({ t: 'join', room: 'padaria' });
    await a.send({ t: 'mg', action: 'start' });
    const order = world.debugOrder(a.s)!;
    const tray = Object.fromEntries(order.lines.map((l) => [l.itemId, l.qty]));
    clock += 1000;
    await a.send({ t: 'mg', action: 'submit', tray, mods: order.mods, built: mgPerfectBuilt(order) });
    for (const l of order.lines) expect(p.bag?.[l.itemId]).toBe(l.qty);
  });

  it('give is refused when not next to the NPC or the item is missing, and takes nothing', async () => {
    const world = makeWorld();
    const a = await client(world);
    const p = a.s.profile!;
    p.bag = { coxinha: 1 };
    offer(a, 'nanda_coxinha');
    await a.send({ t: 'recados', action: 'accept', id: 'nanda_coxinha' });
    p.recados!.active[0]!.step = 1; // skip the order step: the next step is to hand the coxinha to Nanda

    // At the spawn, far from Nanda.
    await a.send({ t: 'give', npc: 'nanda', itemId: 'coxinha' });
    expect(errors(a)).toEqual(['far']);
    expect(p.bag).toEqual({ coxinha: 1 });
    // Wrong room: Carlos is not in the praça.
    await a.send({ t: 'give', npc: 'carlos', itemId: 'coxinha' });
    expect(errors(a)).toEqual(['far', 'far']);

    await walkTo(a, nanda.interact.x, nanda.interact.y);
    // Nothing in the bag for that item.
    await a.send({ t: 'give', npc: 'nanda', itemId: 'pastel' });
    expect(errors(a).at(-1)).toBe('bag');
    // Junk from the network.
    await a.send({ t: 'give', npc: 'ghost' as never, itemId: 'coxinha' });
    await a.send({ t: 'give', npc: 'nanda', itemId: { $gt: '' } as never });
    await a.send({ t: 'give', npc: 'nanda', itemId: 'nao_existe' });
    expect(errors(a).slice(-3)).toEqual(['give', 'give', 'give']);
    expect(p.bag).toEqual({ coxinha: 1 });
    expect(p.recados!.active).toHaveLength(1);
    expect(p.coins).toBe(10);

    // An item no active step wants is not taken.
    p.bag = { pastel: 1 };
    await a.send({ t: 'give', npc: 'nanda', itemId: 'pastel' });
    expect(p.bag).toEqual({ pastel: 1 });
    expect(a.last('notice')!.level).toBe('info');

    // Next to her (one tile off the stall spot) it works.
    p.bag = { coxinha: 1 };
    await walkTo(a, nanda.interact.x + 1, nanda.interact.y);
    await a.send({ t: 'give', npc: 'nanda', itemId: 'coxinha' });
    expect(p.bag).toEqual({});
    expect(p.recados!.done).toEqual(['nanda_coxinha']);
    expect(p.bond?.nanda).toBe(4);
  });

  it('read is refused for unknown ids and out-of-range signs, and counts within 3 tiles', async () => {
    const world = makeWorld();
    const a = await client(world);
    await a.send({ t: 'read', hotspotId: 'nao_existe' });
    await a.send({ t: 'read', hotspotId: 42 as never });
    expect(errors(a)).toEqual(['hotspot', 'hotspot']);
    expect(HOTSPOTS).toEqual([]);

    HOTSPOTS.push({ id: 'teste_placa', room: 'praca', x: ROOMS.praca.spawn.x, y: ROOMS.praca.spawn.y - 6, pt: 'PLACA', en: 'SIGN' });
    try {
      await a.send({ t: 'read', hotspotId: 'teste_placa' }); // 6 tiles away
      expect(errors(a).at(-1)).toBe('far');
      await walkTo(a, ROOMS.praca.spawn.x, ROOMS.praca.spawn.y - 3);
      const before = a.all('error').length;
      await a.send({ t: 'read', hotspotId: 'teste_placa' });
      expect(a.all('error')).toHaveLength(before);
    } finally {
      HOTSPOTS.length = 0;
    }
  });

  it('greetings, entering rooms and talking advance the right steps (Júlia’s greeting recado)', async () => {
    const world = makeWorld();
    const a = await client(world);
    const b = await client(world);
    const p = a.s.profile!;
    offer(a, 'julia_cumprimento_certo');
    await a.send({ t: 'recados', action: 'accept', id: 'julia_cumprimento_certo' });

    // The greeting that does not fit the time of day does not count (and 'oi' never counts for a timed step).
    const fits = greetingFor(gameMinutes(clock));
    const wrong = fits === 'bom dia' ? 'boa noite' : 'bom dia';
    await a.send({ t: 'chat', text: `${wrong}, pessoal!` });
    await a.send({ t: 'chat', text: 'oi!' });
    expect(p.recados!.active).toEqual([{ id: 'julia_cumprimento_certo', step: 0 }]);
    await a.send({ t: 'chat', text: `${fits}, pessoal!` });
    expect(p.recados!.active).toEqual([{ id: 'julia_cumprimento_certo', step: 1 }]);

    // Then walk into the padaria.
    await a.send({ t: 'join', room: 'padaria' });
    expect(p.recados!.done).toEqual(['julia_cumprimento_certo']);
    expect(p.bond?.julia).toBe(4);
    expect(b.s.profile!.recados!.done).toEqual([]);
  });

  it('the day rolls over by game day: new offer, done cleared, bond unlocks the next recado', async () => {
    const world = makeWorld();
    const a = await client(world);
    const p = a.s.profile!;
    const day0 = gameDay(clock);
    const offered0 = [...p.recados!.offered];
    p.recados!.done = ['nanda_coxinha'];
    p.bond = { carlos: 10 };

    clock += 1000; // same game day: nothing changes
    await a.send({ t: 'recados', action: 'list' });
    expect(p.recados!.day).toBe(day0);
    expect(p.recados!.offered).toEqual(offered0);
    expect(p.recados!.done).toEqual(['nanda_coxinha']);

    clock += GAME_DAY_MS;
    await a.send({ t: 'recados', action: 'list' });
    expect(p.recados!.day).toBe(gameDay(clock));
    expect(p.recados!.day).toBeGreaterThan(day0);
    expect(p.recados!.done).toEqual([]);
    expect(a.last('recados')!.done).toEqual([]);
    expect(a.last('recados')!.offered).toHaveLength(3);
    // The daily talk bond is available again the next game day.
    await a.send({ t: 'join', room: 'padaria' });
    await a.send({ t: 'scene', action: 'start', npc: 'carlos' });
    expect(p.bond?.carlos).toBe(12);
    await a.send({ t: 'scene', action: 'close' });
    await a.send({ t: 'scene', action: 'start', npc: 'carlos' });
    expect(p.bond?.carlos).toBe(12); // once per game day
  });

  it('a Conversa that ends with a pass counts as a talk and earns +3 bond once per game day', async () => {
    const world = makeWorld();
    const a = await client(world);
    const p = a.s.profile!;
    world.conversaEnded(p.id, 'carlos', 'almost');
    expect(p.bond).toEqual({ carlos: 2 });
    world.conversaEnded(p.id, 'carlos', 'pass');
    expect(p.bond).toEqual({ carlos: 5 });
    world.conversaEnded(p.id, 'carlos', 'pass');
    expect(p.bond).toEqual({ carlos: 5 });
    world.conversaEnded(p.id, 'carlos', 'pass', { drink: 'cafe_com_leite', food: 'nada' });
    expect(p.bag).toEqual({ cafe_com_leite: 1 });
    world.conversaEnded('nobody', 'carlos', 'pass'); // offline / unknown player: ignored
  });

  it('keeps the daily mission, tutorial and its rewards exactly as before while recados run alongside', async () => {
    const world = makeWorld();
    const a = await client(world);
    await a.send({ t: 'mission', action: 'take' });
    expect(a.s.profile!.mission?.taken).toBe(true);
    expect(a.last('profile')!.profile.mission?.taken).toBe(true);
    expect(a.last('profile')!.profile.bag).toEqual({});
  });
});

describe('old profiles', () => {
  it('load without the Phase 8 fields and get defaults, on the wire too', async () => {
    const old: Record<string, unknown> = {
      id: 'abc123',
      token: 'tok-old',
      ageGate18: true,
      name: 'Velha',
      pronoun: 'ela',
      appearance: DEFAULT_APPEARANCE,
      nameplate: 'verde',
      coins: 42,
      hats: [],
      hat: null,
      furniture: {},
      apartment: [],
      parrotOwned: false,
      parrotEquipped: false,
      friends: [],
      tutorial: { andar: true, sentar: false, acenar: false, conversar: false, carlos: false, meveum: false, chapeu: false, cadeira: false },
      tutorialRewarded: false,
      createdAt: 1,
      daily: { date: '2026-01-01', sceneClears: {} },
      lastSeen: 1,
    };
    // Also a save that has garbage in the new fields (hand-edited).
    const messy = { ...old, id: 'def456', token: 'tok-messy', bag: 'oops', recados: { day: 'x', active: [{ id: 1 }] }, bond: [3] };
    const adapter: PersistenceAdapter = { describe: () => 'test', load: () => JSON.parse(JSON.stringify([old, messy])) as StoredProfile[], save: () => {} };
    const store = new ProfileStore(adapter);
    const world = makeWorld(store);

    for (const token of ['tok-old', 'tok-messy']) {
      const inbox: ServerMsg[] = [];
      const s = world.connect(`old-${token}`, (m) => inbox.push(m), () => {});
      await world.handle(s, { t: 'hello', token });
      const welcome = inbox.find((m) => m.t === 'welcome') as Extract<ServerMsg, { t: 'welcome' }>;
      expect(welcome.profile.coins).toBe(42);
      expect(welcome.profile.bag).toEqual({});
      expect(welcome.profile.bond).toEqual({});
      expect(welcome.profile.recados).toEqual({ day: -1, offered: [], active: [], done: [], talked: [], graded: [] });
      await world.handle(s, { t: 'join', room: 'praca' });
      const board = inbox.filter((m) => m.t === 'recados').at(-1) as Extract<ServerMsg, { t: 'recados' }>;
      expect(board.offered).toHaveLength(3);
    }
  });
});
