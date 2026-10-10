import { beforeEach, describe, expect, it } from 'vitest';
import { CLOCK_OFFSET_MS, DEFAULT_APPEARANCE, GAME_DAY_MS, ROOMS, type ClientMsg, type RoomId, type ServerMsg } from '@tudobem/shared';
import { World, type Session } from './world.js';
import { ProfileStore } from './store.js';
import { FEIRA_RV_CHANGE, FEIRA_RV_EXACT, FEIRA_RV_PER_DAY } from './feira.js';
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

/** A world whose game clock reads `minute` (0..1439) right now. Real time moves it 1 game minute per 2 s, so tests stay within a few seconds. */
function makeWorld(minute: number) {
  const t = (minute / 1440) * GAME_DAY_MS;
  const offsetMs = (((t - ((clock + CLOCK_OFFSET_MS) % GAME_DAY_MS)) % GAME_DAY_MS) + GAME_DAY_MS) % GAME_DAY_MS;
  return new World(
    new ProfileStore(null),
    { safety: new JevStubSafety(), gloss: new PhrasebookGloss(), npc: new AuthoredNpcDialogue(), student: new InMemoryStudentModel(), moderation: new MemoryModerationQueue() },
    { mgGapMs: 0, now: () => clock, clockOffsetMs: offsetMs, schedule: (fn, ms) => pending.push({ fn, at: clock + ms }) },
  );
}

interface Client {
  s: Session;
  inbox: ServerMsg[];
  send: (m: ClientMsg) => Promise<void>;
  last: <T extends ServerMsg['t']>(t: T) => Extract<ServerMsg, { t: T }> | undefined;
}

let n = 0;
async function client(world: World, room: RoomId = 'feira'): Promise<Client> {
  const inbox: ServerMsg[] = [];
  const s = world.connect(`f${n++}`, (m) => inbox.push(m), () => {});
  const c: Client = { s, inbox, send: (m) => world.handle(s, m), last: (t) => [...inbox].reverse().find((m) => m.t === t) as never };
  await c.send({ t: 'hello' });
  await c.send({ t: 'createProfile', name: `Feira${n++}`, pronoun: 'ela', appearance: DEFAULT_APPEARANCE });
  await c.send({ t: 'join', room });
  return c;
}

const feiraMsgs = (c: Client) => c.inbox.filter((m): m is Extract<ServerMsg, { t: 'feira' }> => m.t === 'feira');
const errors = (c: Client) => c.inbox.filter((m): m is Extract<ServerMsg, { t: 'error' }> => m.t === 'error');

async function walkTo(c: Client, x: number, y: number) {
  await c.send({ t: 'move', x, y });
  advance(14_000);
}

// split areas: the stalls and their vendors are in the Feira Livre (a player joining `feira` starts at its gate), Nanda is in the praça, the Hortifrúti crate at the banca on the rua
const tiaLu = ROOMS.feira.npcs.find((x) => x.id === 'tia_lu')!;
const nanda = ROOMS.praca.npcs.find((x) => x.id === 'nanda')!;

describe('feira: "Quanto custa?" and the payment (Phase 9)', () => {
  beforeEach(() => {
    clock = 5_000_000;
    pending.length = 0;
  });

  it('answers a price only next to the vendor, only for what the stall sells', async () => {
    const world = makeWorld(9 * 60);
    const a = await client(world);
    // far away (the spawn is at the gate of the feira)
    await a.send({ t: 'feira', action: 'price', vendor: 'tia_lu', itemId: 'banana' });
    expect(errors(a).at(-1)?.code).toBe('far');
    expect(feiraMsgs(a)).toHaveLength(0);

    await walkTo(a, tiaLu.interact.x, tiaLu.interact.y);
    await a.send({ t: 'feira', action: 'price', vendor: 'tia_lu', itemId: 'banana' });
    const price = feiraMsgs(a).at(-1)!;
    expect(price).toMatchObject({ phase: 'price', vendor: 'tia_lu', itemId: 'banana' });
    if (price.phase !== 'price') throw new Error('phase');
    expect(price.options).toEqual([
      { qty: 1, cents: 200 },
      { qty: 3, cents: 500 },
      { qty: 6, cents: 1000 },
    ]);
    expect(price.line.pt).toContain('dois reais');
    expect(price.line.pt).toContain('Três por cinco reais');

    // a stall does not sell what it does not sell; junk is refused
    const before = errors(a).length;
    await a.send({ t: 'feira', action: 'price', vendor: 'tia_lu', itemId: 'pastel' });
    await a.send({ t: 'feira', action: 'price', vendor: 'nobody' as never, itemId: 'banana' });
    await a.send({ t: 'feira', action: 'price', vendor: 'tia_lu', itemId: 7 as never });
    expect(errors(a).length).toBe(before + 3);
  });

  it('exact payment: the goods go in the bag, a little RV is paid, no change', async () => {
    const world = makeWorld(9 * 60);
    const a = await client(world);
    const p = a.s.profile!;
    await walkTo(a, tiaLu.interact.x, tiaLu.interact.y);
    const coins0 = p.coins;
    // 3 bananas for R$ 5: a five-real note
    await a.send({ t: 'feira', action: 'pay', vendor: 'tia_lu', itemId: 'banana', qty: 3, paid: [500] });
    const r = feiraMsgs(a).at(-1)!;
    expect(r).toMatchObject({ phase: 'pay', result: 'exact', price: 500, paid: 500, rv: FEIRA_RV_EXACT });
    expect(p.bag?.banana).toBe(3);
    expect(p.coins).toBe(coins0 + FEIRA_RV_EXACT);
    expect(r.phase === 'pay' && r.change).toBeUndefined();
  });

  it('overpaying: the vendor gives change in words, the goods are handed over, a smaller reward is paid', async () => {
    const world = makeWorld(9 * 60);
    const a = await client(world);
    const p = a.s.profile!;
    await walkTo(a, tiaLu.interact.x, tiaLu.interact.y);
    const coins0 = p.coins;
    // one banana (R$ 2) with a R$ 5 note and a R$ 0,50 coin: R$ 3,50 back
    await a.send({ t: 'feira', action: 'pay', vendor: 'tia_lu', itemId: 'banana', qty: 1, paid: [500, 50] });
    const r = feiraMsgs(a).at(-1)!;
    expect(r).toMatchObject({ phase: 'pay', result: 'change', price: 200, paid: 550, change: 350, rv: FEIRA_RV_CHANGE });
    expect(r.phase === 'pay' && r.line.pt).toBe('Aqui o seu troco: três reais e cinquenta centavos. Obrigada!');
    expect(p.bag?.banana).toBe(1);
    expect(p.coins).toBe(coins0 + FEIRA_RV_CHANGE);
  });

  it('underpaying: the vendor says what is missing, nothing is bought, nothing is paid', async () => {
    const world = makeWorld(9 * 60);
    const a = await client(world);
    const p = a.s.profile!;
    await walkTo(a, tiaLu.interact.x, tiaLu.interact.y);
    const coins0 = p.coins;
    await a.send({ t: 'feira', action: 'pay', vendor: 'tia_lu', itemId: 'maca', qty: 2, paid: [200, 50] }); // R$ 3 for R$ 2,50
    const r = feiraMsgs(a).at(-1)!;
    expect(r).toMatchObject({ phase: 'pay', result: 'short', price: 300, paid: 250, missing: 50, rv: 0 });
    expect(r.phase === 'pay' && r.line.pt).toBe('Faltam cinquenta centavos.');
    expect(p.bag?.maca).toBeUndefined();
    expect(p.coins).toBe(coins0);
  });

  it('refuses a tray that is not made of tray pieces, an empty tray, and a quantity the vendor does not offer', async () => {
    const world = makeWorld(9 * 60);
    const a = await client(world);
    await walkTo(a, tiaLu.interact.x, tiaLu.interact.y);
    const base = { t: 'feira', action: 'pay', vendor: 'tia_lu', itemId: 'banana' } as const;
    const before = errors(a).length;
    await a.send({ ...base, qty: 1, paid: [333] });
    await a.send({ ...base, qty: 1, paid: [] });
    await a.send({ ...base, qty: 1, paid: 'lots' as never });
    await a.send({ ...base, qty: 2, paid: [500] });
    await a.send({ ...base, qty: 1, paid: Array(41).fill(50) });
    expect(errors(a).length).toBe(before + 5);
    expect(a.s.profile!.bag?.banana).toBeUndefined();
  });

  it('pays RV for the first four purchases of a real day only (the goods always come)', async () => {
    const world = makeWorld(9 * 60);
    const a = await client(world);
    const p = a.s.profile!;
    await walkTo(a, tiaLu.interact.x, tiaLu.interact.y);
    const rvs: number[] = [];
    for (let i = 0; i < FEIRA_RV_PER_DAY + 2; i++) {
      await a.send({ t: 'feira', action: 'pay', vendor: 'tia_lu', itemId: 'laranja', qty: 1, paid: [100] });
      const r = feiraMsgs(a).at(-1)!;
      rvs.push(r.phase === 'pay' ? r.rv : -1);
    }
    expect(rvs).toEqual([5, 5, 5, 5, 0, 0]);
    expect(p.bag?.laranja).toBe(FEIRA_RV_PER_DAY + 2);
    // a new real day pays again
    advance(24 * 3600_000);
    await a.send({ t: 'feira', action: 'pay', vendor: 'tia_lu', itemId: 'laranja', qty: 1, paid: [100] });
    const r = feiraMsgs(a).at(-1)!;
    expect(r.phase === 'pay' && r.rv).toBe(FEIRA_RV_EXACT);
  });

  it('a purchase finishes a recado: pedir tia_lu banana, then hand it to Nanda', async () => {
    const world = makeWorld(9 * 60);
    const a = await client(world);
    const p = a.s.profile!;
    p.recados!.offered = ['tia_lu_banana_pra_nanda'];
    await a.send({ t: 'recados', action: 'accept', id: 'tia_lu_banana_pra_nanda' });
    expect(p.recados!.active).toEqual([{ id: 'tia_lu_banana_pra_nanda', step: 0 }]);
    await walkTo(a, tiaLu.interact.x, tiaLu.interact.y);
    await a.send({ t: 'feira', action: 'pay', vendor: 'tia_lu', itemId: 'banana', qty: 1, paid: [200] });
    expect(p.recados!.active).toEqual([{ id: 'tia_lu_banana_pra_nanda', step: 1 }]);
    expect(p.bag?.banana).toBe(1);

    // out through the gate (a walk that ends on the west edge carries you into the praça), then to Nanda's stall
    await walkTo(a, 0, 8);
    expect(a.last('roomState')?.room).toBe('praca');
    await walkTo(a, nanda.interact.x, nanda.interact.y);
    const coins = p.coins;
    await a.send({ t: 'give', npc: 'nanda', itemId: 'banana' });
    expect(p.recados!.done).toContain('tia_lu_banana_pra_nanda');
    expect(p.bag?.banana).toBeUndefined();
    expect(p.coins).toBe(coins + 10);
  });

  it('Dona Rosa\'s flowers count as Tia Lu\'s for a recado (pedir tia_lu flores)', async () => {
    const world = makeWorld(9 * 60);
    const a = await client(world);
    const p = a.s.profile!;
    p.bond = { tia_lu: 10 };
    p.recados!.offered = ['tia_lu_flores_pra_julia'];
    await a.send({ t: 'recados', action: 'accept', id: 'tia_lu_flores_pra_julia' });
    const rosa = ROOMS.feira.npcs.find((x) => x.id === 'rosa')!;
    await walkTo(a, rosa.interact.x, rosa.interact.y);
    await a.send({ t: 'feira', action: 'pay', vendor: 'rosa', itemId: 'flores', qty: 1, paid: [1000, 200] });
    expect(p.recados!.active).toEqual([{ id: 'tia_lu_flores_pra_julia', step: 1 }]);
    expect(p.bag?.flores).toBe(1);
  });
});

describe('feira: the purchase RV cap counts the player day (D1)', () => {
  beforeEach(() => {
    clock = 5_000_000;
    pending.length = 0;
  });

  it('a key from the older UTC day is yesterday (it pays again); a key on the player day holds the cap', async () => {
    const world = makeWorld(9 * 60);
    const inbox: ServerMsg[] = [];
    const s = world.connect(`f${n++}`, (m) => inbox.push(m), () => {});
    const a: Client = { s, inbox, send: (m) => world.handle(s, m), last: (t) => [...inbox].reverse().find((m) => m.t === t) as never };
    // clock 5_000_000 is 01:23 UTC on 1970-01-01, still 1969-12-31 in São Paulo (UTC-3)
    await a.send({ t: 'hello', tz: -180 });
    await a.send({ t: 'createProfile', name: `Feira${n++}`, pronoun: 'ela', appearance: DEFAULT_APPEARANCE });
    await a.send({ t: 'join', room: 'feira' });
    const p = a.s.profile!;
    await walkTo(a, tiaLu.interact.x, tiaLu.interact.y);
    const pay = async () => {
      await a.send({ t: 'feira', action: 'pay', vendor: 'tia_lu', itemId: 'laranja', qty: 1, paid: [100] });
      const r = feiraMsgs(a).at(-1)!;
      return r.phase === 'pay' ? r.rv : -1;
    };
    p.feira = { date: '1970-01-01', n: FEIRA_RV_PER_DAY };
    expect(await pay()).toBe(FEIRA_RV_EXACT);
    expect(p.feira).toEqual({ date: '1969-12-31', n: 1 });
    p.feira = { date: '1969-12-31', n: FEIRA_RV_PER_DAY };
    expect(await pay()).toBe(0);
  });
});

describe('feira: hours and the Hortifrúti corner (D12: every learning activity at every hour)', () => {
  beforeEach(() => {
    clock = 5_000_000;
    pending.length = 0;
  });

  it('the stalls are closed at 15:00: the vendor is away and the stall refuses, with the note', async () => {
    const world = makeWorld(15 * 60);
    const a = await client(world);
    // Tia Lu sits on a bench in the afternoon, so even next to her stall there is nobody serving
    await walkTo(a, tiaLu.interact.x, tiaLu.interact.y);
    await a.send({ t: 'feira', action: 'price', vendor: 'tia_lu', itemId: 'banana' });
    expect(errors(a).at(-1)).toMatchObject({ code: 'feira_closed', pt: 'A feira volta amanhã às 6h. O hortifrúti da banca está aberto!' });
    await a.send({ t: 'feira', action: 'pay', vendor: 'chico', itemId: 'pastel', qty: 1, paid: [500, 100] });
    expect(errors(a).at(-1)?.code).toBe('feira_closed');
    expect(a.s.profile!.bag?.pastel).toBeUndefined();
  });

  it('the Hortifrúti corner at the banca sells fruit, vegetables and flowers at 15:00 (and finishes the recado)', async () => {
    const world = makeWorld(15 * 60);
    const a = await client(world, 'rua');
    const p = a.s.profile!;
    p.recados!.offered = ['tia_lu_banana_pra_nanda'];
    await a.send({ t: 'recados', action: 'accept', id: 'tia_lu_banana_pra_nanda' });
    const crate = ROOMS.rua.props.find((x) => x.vendor === 'banca')!;
    // far from the crates: refused
    await a.send({ t: 'feira', action: 'price', vendor: 'banca', itemId: 'banana' });
    expect(errors(a).at(-1)?.code).toBe('far');
    await walkTo(a, crate.interact!.x, crate.interact!.y);
    await a.send({ t: 'feira', action: 'price', vendor: 'banca', itemId: 'tomate' });
    expect(feiraMsgs(a).at(-1)).toMatchObject({ phase: 'price', vendor: 'banca', itemId: 'tomate' });
    // hot food is not sold there
    const before = errors(a).length;
    await a.send({ t: 'feira', action: 'price', vendor: 'banca', itemId: 'pastel' });
    expect(errors(a).length).toBe(before + 1);
    await a.send({ t: 'feira', action: 'pay', vendor: 'banca', itemId: 'banana', qty: 1, paid: [200] });
    expect(feiraMsgs(a).at(-1)).toMatchObject({ phase: 'pay', result: 'exact' });
    expect(p.recados!.active).toEqual([{ id: 'tia_lu_banana_pra_nanda', step: 1 }]);
  });

  it('the vendors are out at their stalls at 06:00-13:00 and gone after', async () => {
    const morning = makeWorld(9 * 60);
    const a = await client(morning);
    const here = a.inbox.find((m) => m.t === 'roomState');
    const npcIds = here && here.t === 'roomState' ? here.avatars.flatMap((x) => (x.npc ? [x.npc] : [])) : [];
    for (const id of ['tia_lu', 'ze', 'chico', 'rosa']) expect(npcIds, id).toContain(id);
    const night = makeWorld(21 * 60);
    const b = await client(night);
    const there = b.inbox.find((m) => m.t === 'roomState');
    const nightIds = there && there.t === 'roomState' ? there.avatars.flatMap((x) => (x.npc ? [x.npc] : [])) : [];
    for (const id of ['tia_lu', 'ze', 'chico', 'rosa']) expect(nightIds, id).not.toContain(id);
  });
});
