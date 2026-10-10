import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, ROOMS, type ClientMsg, type ServerMsg, type Tile } from '@tudobem/shared';
import { World, type Session } from './world.js';
import { ProfileStore } from './store.js';
import { GameConfig } from './gameConfig.js';
import { AuthoredNpcDialogue, InMemoryStudentModel, JevStubSafety, MemoryModerationQueue, PhrasebookGloss } from './services/stubs.js';

let clock = 1_000_000;
const now = () => clock;
let pending: { fn: () => void; at: number }[] = [];
function advance(ms: number) {
  clock += ms;
  const ready = pending.filter((p) => p.at <= clock);
  pending = pending.filter((p) => p.at > clock);
  for (const p of ready) p.fn();
}

function makeWorld(config = new GameConfig()) {
  return new World(
    new ProfileStore(null),
    { safety: new JevStubSafety(), gloss: new PhrasebookGloss(), npc: new AuthoredNpcDialogue(), student: new InMemoryStudentModel(), moderation: new MemoryModerationQueue() },
    { now, schedule: (fn, ms) => pending.push({ fn, at: clock + ms }), pescaPin: true, rng: () => 0.42, config },
  );
}

let n = 0;
async function client(world: World) {
  const inbox: ServerMsg[] = [];
  const s: Session = world.connect(`b${n++}`, (m) => inbox.push(m), () => {});
  const send = (m: ClientMsg) => world.handle(s, m);
  await send({ t: 'hello' });
  await send({ t: 'createProfile', name: `Iara${n}`, pronoun: 'ela', appearance: DEFAULT_APPEARANCE });
  const last = <T extends ServerMsg['t']>(t: T) => [...inbox].reverse().find((m) => m.t === t) as Extract<ServerMsg, { t: T }> | undefined;
  const at = (tile: Tile) => world.join(s, 'praia', {}, { tile, dir: 'SW' });
  return { s, inbox, send, last, at };
}
const barco = <P extends string>(c: { inbox: ServerMsg[] }, phase: P) =>
  [...c.inbox].reverse().find((m) => m.t === 'barco' && (m as { phase: string }).phase === phase) as Extract<ServerMsg, { t: 'barco'; phase: P }> | undefined;
const pesca = <P extends string>(c: { inbox: ServerMsg[] }, phase: P) =>
  [...c.inbox].reverse().find((m) => m.t === 'pesca' && (m as { phase: string }).phase === phase) as Extract<ServerMsg, { t: 'pesca'; phase: P }> | undefined;
const BENTO = ROOMS.praia.npcs.find((x) => x.id === 'bento')!.interact;
const spotTile = (id: string) => ROOMS.praia.props.find((p) => p.id === id)!.interact!;

describe('Seu Bento’s boats (PRAIA-PLAN.md 3.3)', () => {
  beforeEach(() => {
    clock = 1_000_000;
    pending = [];
  });

  it('the menu sends the live prices (a dashboard override reaches it) and names the new fish in words', async () => {
    const config = new GameConfig();
    config.set('boatRemoRv', 22);
    const world = makeWorld(config);
    const c = await client(world);
    c.at({ x: 3, y: 4 });
    await c.send({ t: 'barco', action: 'menu' });
    expect(c.last('error')?.code).toBe('far');
    c.at(BENTO);
    await c.send({ t: 'barco', action: 'menu' });
    const m = barco(c, 'menu')!;
    expect(m.tiers.map((t) => [t.tier, t.price])).toEqual([['remo', 22], ['pesca', 40], ['alto_mar', 90], ['festa', 150]]);
    expect(m.tiers[0]!.newFish.map((f) => f.pt)).toEqual(['robalo', 'tainha']);
    expect(m.trip).toBeNull();
  });

  it('renting debits exactly the price, refuses without RV or with a trip running, and opens the boat’s spot', async () => {
    const world = makeWorld();
    const c = await client(world);
    c.at(BENTO);
    const p = c.s.profile!;
    p.coins = 10;
    await c.send({ t: 'barco', action: 'rent', tier: 'remo' });
    expect(c.last('error')?.code).toBe('coins');
    expect(p.coins).toBe(10);
    p.coins = 100;
    await c.send({ t: 'barco', action: 'rent', tier: 'remo' });
    expect(p.coins).toBe(85);
    expect(barco(c, 'trip')).toMatchObject({ tier: 'remo', until: clock + 12 * 60_000 });
    expect(p.pesca?.rentals.remo).toBe(1);
    await c.send({ t: 'barco', action: 'rent', tier: 'pesca' });
    expect(c.last('error')?.code).toBe('barco_trip');
    expect(p.coins).toBe(85);
    // the party boat is not a solo rental
    await c.send({ t: 'barco', action: 'rent', tier: 'festa' as never });
    expect(p.coins).toBe(85);
    // on the rowboat now: its spot opens, its fish and words
    c.at(spotTile('pesca_remo'));
    await c.send({ t: 'pesca', action: 'open', spotId: 'pesca_remo' });
    expect(pesca(c, 'spot')).toMatchObject({ water: 'remo', canCast: true });
    expect(p.diary).toContain('diary.praia.remo');
    await c.send({ t: 'pesca', action: 'cast', spotId: 'pesca_remo', power: 0.5 });
    const cast = pesca(c, 'cast')!;
    expect(cast.pinned?.catch).toBe('robalo');
    advance(8000);
    await c.send({ t: 'pesca', action: 'result', seq: cast.seq, events: [{ k: 'hook', ms: 1600 }, { k: 'hold', down: true, ms: 1600 }, { k: 'hold', down: false, ms: 1990 }, { k: 'hold', down: true, ms: 2350 }] });
    expect(pesca(c, 'result')!.outcome).toMatchObject({ kind: 'caught', fish: 'robalo' });
    expect(p.diary).toEqual(expect.arrayContaining(['diary.praia.robalo', 'diary.praia.remar', 'diary.praia.barquinho']));
  });

  it('the trip ends on time, on return and on leaving the beach; its end word is taught', async () => {
    const world = makeWorld();
    const c = await client(world);
    c.at(BENTO);
    const p = c.s.profile!;
    p.coins = 500;
    await c.send({ t: 'barco', action: 'rent', tier: 'remo' });
    advance(12 * 60_000 + 100);
    expect(barco(c, 'ended')).toMatchObject({ tier: 'remo', why: 'time' });
    expect(p.pesca?.trip).toBeNull();
    expect(p.diary).toContain('diary.praia.enseada');
    c.at(spotTile('pesca_remo'));
    await c.send({ t: 'pesca', action: 'open', spotId: 'pesca_remo' });
    expect(pesca(c, 'spot')?.canCast).toBe(false);

    c.at(BENTO);
    await c.send({ t: 'barco', action: 'rent', tier: 'pesca' });
    await c.send({ t: 'barco', action: 'return' });
    expect(barco(c, 'ended')).toMatchObject({ tier: 'pesca', why: 'returned' });
    expect(p.diary).toContain('diary.praia.pescador');
    // an old trip's timer does not end the next one
    await c.send({ t: 'barco', action: 'rent', tier: 'alto_mar' });
    advance(60_000);
    expect(p.pesca?.trip?.tier).toBe('alto_mar');
    world.join(c.s, 'rua_leste');
    expect(barco(c, 'ended')).toMatchObject({ tier: 'alto_mar', why: 'left' });
    expect(p.pesca?.trip).toBeNull();
    expect(p.coins).toBe(500 - 15 - 40 - 90);
  });
});
