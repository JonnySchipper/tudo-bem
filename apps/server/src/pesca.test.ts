import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, ROOMS, type ClientMsg, type ServerMsg, type Tile } from '@tudobem/shared';
import { World, type Session } from './world.js';
import { ProfileStore } from './store.js';
import { AuthoredNpcDialogue, InMemoryStudentModel, JevStubSafety, MemoryModerationQueue, PhrasebookGloss } from './services/stubs.js';

let clock = 1_000_000;
const now = () => clock;

function makeWorld(pin = true) {
  return new World(
    new ProfileStore(null),
    { safety: new JevStubSafety(), gloss: new PhrasebookGloss(), npc: new AuthoredNpcDialogue(), student: new InMemoryStudentModel(), moderation: new MemoryModerationQueue() },
    { now, schedule: () => {}, pescaPin: pin, rng: () => 0.42 },
  );
}

let n = 0;
async function client(world: World) {
  const inbox: ServerMsg[] = [];
  const s: Session = world.connect(`f${n++}`, (m) => inbox.push(m), () => {});
  const send = (m: ClientMsg) => world.handle(s, m);
  await send({ t: 'hello' });
  await send({ t: 'createProfile', name: `Rui${n}`, pronoun: 'ele', appearance: DEFAULT_APPEARANCE });
  const last = <T extends ServerMsg['t']>(t: T) => [...inbox].reverse().find((m) => m.t === t) as Extract<ServerMsg, { t: T }> | undefined;
  const at = (tile: Tile) => world.join(s, 'praia', {}, { tile, dir: 'SW' });
  return { s, inbox, send, last, at };
}

const spot = (id: string) => ROOMS.praia.props.find((p) => p.id === id)!;
const standAt = (id: string): Tile => spot(id).interact ?? { x: spot(id).x, y: spot(id).y - 1 };
const pescaMsg = <P extends string>(c: { inbox: ServerMsg[] }, phase: P) =>
  [...c.inbox].reverse().find((m) => m.t === 'pesca' && (m as { phase: string }).phase === phase) as Extract<ServerMsg, { t: 'pesca'; phase: P }> | undefined;

describe('fishing on the server (PRAIA-PLAN.md 2.4, 7.1)', () => {
  beforeEach(() => {
    clock = 1_000_000;
  });

  it('opens a free spot only from close by', async () => {
    const world = makeWorld();
    const c = await client(world);
    c.at({ x: 3, y: 4 });
    await c.send({ t: 'pesca', action: 'open', spotId: 'pesca_praia_1' });
    expect(c.last('error')?.code).toBe('far');
    c.at(standAt('pesca_praia_1'));
    await c.send({ t: 'pesca', action: 'open', spotId: 'pesca_praia_1' });
    expect(pescaMsg(c, 'spot')).toMatchObject({ spotId: 'pesca_praia_1', water: 'praia', canCast: true });
  });

  it('a boat spot needs a rented trip', async () => {
    const world = makeWorld();
    const c = await client(world);
    c.at(standAt('pesca_remo'));
    await c.send({ t: 'pesca', action: 'open', spotId: 'pesca_remo' });
    expect(pescaMsg(c, 'spot')).toMatchObject({ water: 'remo', canCast: false });
    await c.send({ t: 'pesca', action: 'cast', spotId: 'pesca_remo', power: 0.5 });
    expect(pescaMsg(c, 'cast')).toBeUndefined();
  });

  it('cast, hook, reel: the bagre goes in the bucket and the log, its word and the moment words are taught, and nothing is paid', async () => {
    const world = makeWorld();
    const c = await client(world);
    c.at(standAt('pesca_praia_1'));
    const coins = c.s.profile!.coins;
    await c.send({ t: 'pesca', action: 'cast', spotId: 'pesca_praia_1', power: 0.6 });
    const cast = pescaMsg(c, 'cast')!;
    expect(cast).toMatchObject({ water: 'praia', power: 0.6, pinned: { catch: 'bagre', biteAtMs: 1500 } });
    clock += 6000;
    await c.send({ t: 'pesca', action: 'result', seq: cast.seq, events: [{ k: 'hook', ms: 1600 }, { k: 'hold', down: true, ms: 1600 }] });
    const res = pescaMsg(c, 'result')!;
    expect(res.outcome).toMatchObject({ kind: 'caught', fish: 'bagre', cm: 30 });
    expect(res.newSpecies).toBe(true);
    const p = c.s.profile!;
    expect(p.pesca?.balde.bagre).toBe(1);
    expect(p.pesca?.log.bagre).toMatchObject({ n: 1, bestCm: 30, firstWater: 'praia' });
    expect(p.diary).toEqual(expect.arrayContaining(['diary.praia.bagre', 'diary.praia.anzol', 'diary.praia.isca', 'diary.praia.vara']));
    expect(res.words.map((w) => w.pt)).toEqual(expect.arrayContaining(['bagre', 'vara']));
    expect(p.coins).toBe(coins);
    // the same result again is dropped; a new cast waits 2 s
    await c.send({ t: 'pesca', action: 'result', seq: cast.seq, events: [{ k: 'hook', ms: 1600 }, { k: 'hold', down: true, ms: 1600 }] });
    expect(p.pesca?.balde.bagre).toBe(1);
  });

  it('a forged result changes nothing: too fast, a hook outside the bite, a junk list', async () => {
    const world = makeWorld();
    const c = await client(world);
    c.at(standAt('pesca_praia_1'));
    const tryResult = async (events: unknown, wait: number) => {
      clock += 3000;
      await c.send({ t: 'pesca', action: 'cast', spotId: 'pesca_praia_1', power: 0.5 });
      const cast = pescaMsg(c, 'cast')!;
      clock += wait;
      await c.send({ t: 'pesca', action: 'result', seq: cast.seq, events: events as never });
      return pescaMsg(c, 'result')!.outcome.kind;
    };
    expect(await tryResult([{ k: 'hook', ms: 1600 }, { k: 'hold', down: true, ms: 1600 }], 1000)).toBe('rejected');
    expect(await tryResult([{ k: 'hook', ms: 900 }], 6000)).toBe('early');
    expect(await tryResult([{ k: 'hook', ms: 9000 }], 12000)).toBe('late');
    expect(await tryResult([{ k: 'fish', ms: 1600, fish: 'marlim' }], 6000)).toBe('rejected');
    expect(c.s.profile!.pesca?.balde ?? {}).toEqual({});
    expect(c.s.profile!.pesca?.catches ?? 0).toBe(0);
  });

  it('Jô buys the bucket at her kiosk, through the reward path, under the day’s cap', async () => {
    const world = makeWorld();
    const c = await client(world);
    c.at(standAt('pesca_praia_1'));
    for (let i = 0; i < 2; i++) {
      clock += 3000;
      await c.send({ t: 'pesca', action: 'cast', spotId: 'pesca_praia_1', power: 0.5 });
      const cast = pescaMsg(c, 'cast')!;
      clock += 6000;
      await c.send({ t: 'pesca', action: 'result', seq: cast.seq, events: [{ k: 'hook', ms: 1600 }, { k: 'hold', down: true, ms: 1600 }] });
    }
    const p = c.s.profile!;
    expect(p.pesca?.balde.bagre).toBe(2);
    await c.send({ t: 'pesca', action: 'sell' });
    expect(c.last('error')?.code).toBe('far');
    c.at(ROOMS.praia.npcs.find((x) => x.id === 'jo')!.interact);
    await c.send({ t: 'pesca', action: 'tray' });
    expect(pescaMsg(c, 'tray')).toMatchObject({ fish: [{ id: 'bagre', n: 2, price: 1 }], capLeft: 60 });
    const coins = p.coins;
    p.pesca!.sales = { date: p.pesca!.sales.date || '2000-01-01', rv: 0 };
    await c.send({ t: 'pesca', action: 'sell', fish: 'bagre' });
    expect(c.last('reward')).toMatchObject({ amount: 2 });
    expect(p.coins).toBe(coins + 2);
    expect(p.pesca?.balde.bagre).toBeUndefined();
    expect(pescaMsg(c, 'sold')).toMatchObject({ rv: 2, capLeft: 58 });
    // the cap holds for the rest of the day
    p.pesca!.balde.bagre = 3;
    p.pesca!.sales.rv = 60;
    await c.send({ t: 'pesca', action: 'sell' });
    expect(c.last('error')?.code).toBe('pesca_cap');
    expect(p.pesca?.balde.bagre).toBe(3);
  });

  it('the line does not follow you out of the room', async () => {
    const world = makeWorld();
    const c = await client(world);
    c.at(standAt('pesca_praia_1'));
    await c.send({ t: 'pesca', action: 'cast', spotId: 'pesca_praia_1', power: 0.5 });
    const cast = pescaMsg(c, 'cast')!;
    world.join(c.s, 'rua_leste');
    clock += 6000;
    await c.send({ t: 'pesca', action: 'result', seq: cast.seq, events: [{ k: 'hook', ms: 1600 }, { k: 'hold', down: true, ms: 1600 }] });
    expect(pescaMsg(c, 'result')).toBeUndefined();
  });
});
