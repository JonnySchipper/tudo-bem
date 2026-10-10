import { beforeEach, describe, expect, it } from 'vitest';
import { CADERNO_GROUP_RV, cadernoGroups, DEFAULT_APPEARANCE, HOTSPOTS, ROOMS, type ClientMsg, type ServerMsg } from '@tudobem/shared';
import { World, type Session } from './world.js';
import { ProfileStore, type PersistenceAdapter, type StoredProfile } from './store.js';
import { AuthoredNpcDialogue, InMemoryStudentModel, JevStubSafety, MemoryModerationQueue, PhrasebookGloss } from './services/stubs.js';

let clock = 5_000_000;

function makeWorld(store = new ProfileStore(null)) {
  return new World(
    store,
    { safety: new JevStubSafety(), gloss: new PhrasebookGloss(), npc: new AuthoredNpcDialogue(), student: new InMemoryStudentModel(), moderation: new MemoryModerationQueue() },
    { mgGapMs: 0, now: () => clock, schedule: () => {} },
  );
}

interface Client {
  s: Session;
  inbox: ServerMsg[];
  send: (m: ClientMsg) => Promise<void>;
  last: <T extends ServerMsg['t']>(t: T) => Extract<ServerMsg, { t: T }> | undefined;
  all: <T extends ServerMsg['t']>(t: T) => Extract<ServerMsg, { t: T }>[];
}

let n = 0;
async function client(world: World, name = `Cad${n++}`): Promise<Client> {
  const inbox: ServerMsg[] = [];
  const s = world.connect(`c${n++}`, (m) => inbox.push(m), () => {});
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

const errors = (c: Client) => c.all('error').map((e) => e.code);
const social = () => cadernoGroups().find((g) => g.id === 'social')!;

describe('Caderno de palavras on the server', () => {
  beforeEach(() => {
    clock = 5_000_000;
  });

  it('a new player starts with an empty caderno', async () => {
    const a = await client(makeWorld());
    expect(a.s.profile!.caderno).toEqual({});
    expect(a.s.profile!.cadernoPaid).toEqual([]);
    expect(a.s.profile!.papos).toEqual([]);
  });

  it('seen: the Carlos scene view marks the cards in his line, and each new line as it arrives', async () => {
    const a = await client(makeWorld());
    const p = a.s.profile!;
    await a.send({ t: 'join', room: 'padaria' });
    await a.send({ t: 'scene', action: 'start', npc: 'carlos' });
    const first = a.last('scene')!.view.line.pt;
    expect(first).toMatch(/Bom dia|Pois não|Oi/);
    const seenNow = Object.entries(p.caderno!).filter(([, e]) => e.seen > 0);
    expect(seenNow.length).toBeGreaterThan(0);
    for (const [, e] of seenNow) expect(e).toMatchObject({ heard: 0, used: 0, firstAt: clock });
    expect(a.last('profile')!.profile.caderno).toEqual(p.caderno);

    const before = Object.values(p.caderno!).reduce((sum, e) => sum + e.seen, 0);
    await a.send({ t: 'scene', action: 'choose', chip: 0 });
    const after = Object.values(p.caderno!).reduce((sum, e) => sum + e.seen, 0);
    expect(after).toBeGreaterThanOrEqual(before);
    expect(Object.values(p.caderno!).every((e) => e.used === 0)).toBe(true); // chips are not typed
  });

  it('used: an accepted typed answer counts; a rejected or unsafe one does not', async () => {
    const a = await client(makeWorld());
    const p = a.s.profile!;
    await a.send({ t: 'join', room: 'padaria' });
    await a.send({ t: 'scene', action: 'start', npc: 'carlos' });
    await a.send({ t: 'scene', action: 'type', text: 'Me vê uma cerveja' }); // blocked by safety
    await a.send({ t: 'scene', action: 'type', text: 'Tudo e com voce?' }); // no chip matches
    expect(Object.values(p.caderno!).every((e) => e.used === 0)).toBe(true);
    await a.send({ t: 'scene', action: 'type', text: 'Bom dia, Seu Carlos!' });
    expect(a.last('scene')!.lastScore).toBe(3);
    expect(p.caderno!['lex.social.bom_dia']!.used).toBe(1);
    expect(p.caderno!['lex.social.bom_dia']!.seen).toBeGreaterThanOrEqual(1);
  });

  it('used: a chat line containing a card form counts, once per line', async () => {
    const a = await client(makeWorld());
    const p = a.s.profile!;
    await a.send({ t: 'chat', text: 'Boa tarde, tudo bem?' });
    expect(p.caderno!['lex.social.boa_tarde']).toMatchObject({ used: 1, seen: 0 });
    expect(p.caderno!['lex.social.tudo_bem']!.used).toBe(1);
    await a.send({ t: 'chat', text: 'lalala' });
    expect(Object.keys(p.caderno!).sort()).toEqual(['lex.social.boa_tarde', 'lex.social.tudo_bem']);
    // a blocked line counts for nothing
    await a.send({ t: 'chat', text: 'me liga 11 98765-4321 obrigado' });
    expect(p.caderno!['lex.social.obrigado']).toBeUndefined();
  });

  it('heard: records known cards, validates the message, rate-limits per session', async () => {
    const a = await client(makeWorld());
    const p = a.s.profile!;
    await a.send({ t: 'heard', cardIds: ['lex.padaria.pao', 'lex.padaria.pao', 'lex.social.oi'] });
    expect(p.caderno!['lex.padaria.pao']).toMatchObject({ heard: 1, seen: 0, used: 0 });
    expect(p.caderno!['lex.social.oi']!.heard).toBe(1);
    expect(errors(a)).toEqual([]);

    const bad: unknown[] = [
      [], // empty
      'lex.padaria.pao', // not an array
      ['lex.padaria.nao_existe'], // unknown id
      ['lex.padaria.pao', 42], // wrong type
      cadernoGroups()[0]!.cardIds.slice(0, 11), // more than 10
      undefined,
    ];
    clock += 5000;
    for (const cardIds of bad) await a.send({ t: 'heard', cardIds } as unknown as ClientMsg);
    expect(errors(a)).toEqual(Array(bad.length).fill('heard'));
    expect(p.caderno!['lex.padaria.pao']!.heard).toBe(1);

    // exactly 10 ids is fine
    clock += 5000;
    await a.send({ t: 'heard', cardIds: cadernoGroups()[0]!.cardIds.slice(0, 10) });
    expect(errors(a)).toHaveLength(bad.length);

    // Rate limit: a burst in one second keeps only the first few, the rest are dropped without an error.
    clock += 5000;
    const before = p.caderno!['lex.padaria.bolo']?.heard ?? 0;
    for (let i = 0; i < 12; i++) await a.send({ t: 'heard', cardIds: ['lex.padaria.bolo'] });
    const gained = p.caderno!['lex.padaria.bolo']!.heard - before;
    expect(gained).toBeGreaterThanOrEqual(1);
    expect(gained).toBeLessThan(12);
    expect(errors(a)).toHaveLength(bad.length);
    clock += 1500; // the window passes
    await a.send({ t: 'heard', cardIds: ['lex.padaria.bolo'] });
    expect(p.caderno!['lex.padaria.bolo']!.heard).toBe(before + gained + 1);
  });

  it('heard is per session: one player’s burst does not starve another', async () => {
    const world = makeWorld();
    const a = await client(world);
    const b = await client(world);
    for (let i = 0; i < 10; i++) await a.send({ t: 'heard', cardIds: ['lex.padaria.pao'] });
    await b.send({ t: 'heard', cardIds: ['lex.padaria.pao'] });
    expect(b.s.profile!.caderno!['lex.padaria.pao']!.heard).toBe(1);
  });

  it('a finished group pays RV exactly once and is remembered in the profile', async () => {
    const world = makeWorld();
    const a = await client(world);
    const p = a.s.profile!;
    const cards = social().cardIds;
    // Everything but 'tchau' is already learned.
    p.caderno = Object.fromEntries(cards.filter((id) => id !== 'lex.social.tchau').map((id) => [id, { seen: 1, heard: 1, used: 0, firstAt: 1 }]));
    const coins = p.coins;
    const rewards = a.all('reward').length;

    await a.send({ t: 'chat', text: 'oi' }); // not the missing one
    expect(p.coins).toBe(coins);
    await a.send({ t: 'heard', cardIds: ['lex.social.tchau'] }); // heard alone is not enough
    expect(p.coins).toBe(coins);
    expect(p.cadernoPaid).toEqual([]);
    await a.send({ t: 'chat', text: 'Tchau!' }); // seen never happened, but used learns it
    expect(p.coins).toBe(coins + CADERNO_GROUP_RV);
    expect(p.cadernoPaid).toEqual(['social']);
    expect(a.all('reward')).toHaveLength(rewards + 1);
    expect(a.last('reward')).toMatchObject({ amount: CADERNO_GROUP_RV, coins: coins + CADERNO_GROUP_RV });
    expect(a.last('reward')!.reason.pt).toContain('Cumprimentos');
    expect(a.last('profile')!.profile.cadernoPaid).toEqual(['social']);

    // Doing it all again pays nothing more.
    await a.send({ t: 'chat', text: 'Tchau, bom dia, boa noite!' });
    await a.send({ t: 'heard', cardIds: cards });
    expect(p.coins).toBe(coins + CADERNO_GROUP_RV);
    expect(a.all('reward')).toHaveLength(rewards + 1);
  });

  it('a group that was paid stays paid across a reconnect (same profile)', async () => {
    const store = new ProfileStore(null);
    const world = makeWorld(store);
    const a = await client(world);
    const p = a.s.profile!;
    p.caderno = Object.fromEntries(social().cardIds.map((id) => [id, { seen: 0, heard: 0, used: 1, firstAt: 1 }]));
    await a.send({ t: 'heard', cardIds: ['lex.social.oi'] });
    expect(p.cadernoPaid).toEqual(['social']);
    const coins = p.coins;
    world.disconnect(a.s);
    const s2 = world.connect('again', () => {}, () => {});
    await world.handle(s2, { t: 'hello', token: (store.get(p.id) as StoredProfile).token });
    await world.handle(s2, { t: 'heard', cardIds: ['lex.social.oi'] });
    expect(store.get(p.id)!.coins).toBe(coins);
  });

  it('read: a sign counts its cards and the cards found in its text as seen', async () => {
    const spawn = ROOMS.praca.spawn;
    HOTSPOTS.push({ id: 'teste_caderno', room: 'praca', x: spawn.x, y: spawn.y - 1, pt: 'PADARIA — Bom dia! Pão na chapa R$ 6', en: 'BAKERY', cards: ['lex.padaria.coxinha'] });
    try {
      const a = await client(makeWorld());
      const p = a.s.profile!;
      await a.send({ t: 'read', hotspotId: 'teste_caderno' });
      expect(errors(a)).toEqual([]);
      expect(p.caderno!['lex.padaria.coxinha']!.seen).toBe(1);
      expect(p.caderno!['lex.social.bom_dia']!.seen).toBe(1);
      expect(p.caderno!['lex.padaria.pao_na_chapa']!.seen).toBe(1);
      expect(p.caderno!['lex.num.6']!.seen).toBe(1);
      // a refused read (unknown sign) records nothing
      const total = Object.keys(p.caderno!).length;
      await a.send({ t: 'read', hotspotId: 'nao_existe' });
      expect(Object.keys(p.caderno!)).toHaveLength(total);
    } finally {
      HOTSPOTS.splice(HOTSPOTS.findIndex((h) => h.id === 'teste_caderno'), 1);
    }
  });

  it('loads old saves without the new fields (and hand-edited junk) with defaults', async () => {
    const old: Record<string, unknown> = {
      id: 'old001',
      token: 'tok-cad-old',
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
    const messy = {
      ...old,
      id: 'old002',
      token: 'tok-cad-messy',
      caderno: { 'lex.padaria.pao': { seen: 3, heard: 'x', used: -2 }, ghost: { seen: 1 } },
      cadernoPaid: ['padaria', 'ghost', 7],
      npcMemory: { carlos: 'Pediu um pão.', ghost: 'x', nanda: 3 },
    };
    const adapter: PersistenceAdapter = { describe: () => 'test', load: () => JSON.parse(JSON.stringify([old, messy])) as StoredProfile[], save: () => {} };
    const world = makeWorld(new ProfileStore(adapter));

    const expected: Record<string, unknown>[] = [
      { caderno: {}, cadernoPaid: [], papos: [] },
      { caderno: { 'lex.padaria.pao': { seen: 3, heard: 0, used: 0, firstAt: 0 } }, cadernoPaid: ['padaria'], papos: [] },
    ];
    for (const [i, token] of ['tok-cad-old', 'tok-cad-messy'].entries()) {
      const inbox: ServerMsg[] = [];
      const s = world.connect(`old-${token}`, (m) => inbox.push(m), () => {});
      await world.handle(s, { t: 'hello', token });
      const welcome = inbox.find((m) => m.t === 'welcome') as Extract<ServerMsg, { t: 'welcome' }>;
      expect(welcome.profile.coins).toBe(42);
      expect(welcome.profile).toMatchObject(expected[i]!);
      // the old Conversa memory (removed in #229) is dropped on load
      expect('npcMemory' in welcome.profile).toBe(false);
      // it still plays: a heard message works on the defaulted profile
      await world.handle(s, { t: 'join', room: 'praca' });
      await world.handle(s, { t: 'heard', cardIds: ['lex.padaria.bolo'] });
      expect(s.profile!.caderno!['lex.padaria.bolo']!.heard).toBe(1);
    }
  });
});
