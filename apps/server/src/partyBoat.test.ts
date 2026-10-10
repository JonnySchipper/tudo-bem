import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, PRAIA_PARTY_PIER, ROOMS, type ClientMsg, type ServerMsg, type Tile } from '@tudobem/shared';
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
  const s: Session = world.connect(`pb${n++}`, (m) => inbox.push(m), () => {});
  const send = (m: ClientMsg) => world.handle(s, m);
  await send({ t: 'hello' });
  await send({ t: 'createProfile', name: `Marujo${n}`, pronoun: 'ela', appearance: DEFAULT_APPEARANCE });
  const last = <T extends ServerMsg['t']>(t: T) => [...inbox].reverse().find((m) => m.t === t) as Extract<ServerMsg, { t: T }> | undefined;
  const at = (tile: Tile) => world.join(s, 'praia', {}, { tile, dir: 'SW' });
  return { s, inbox, send, last, at, p: s.profile! };
}
type C = Awaited<ReturnType<typeof client>>;
const party = <P extends string>(c: { inbox: ServerMsg[] }, phase: P) =>
  [...c.inbox].reverse().find((m) => m.t === 'party' && (m as { phase: string }).phase === phase) as Extract<ServerMsg, { t: 'party'; phase: P }> | undefined;
const pesca = <P extends string>(c: { inbox: ServerMsg[] }, phase: P) =>
  [...c.inbox].reverse().find((m) => m.t === 'pesca' && (m as { phase: string }).phase === phase) as Extract<ServerMsg, { t: 'pesca'; phase: P }> | undefined;
const BENTO = ROOMS.praia.npcs.find((x) => x.id === 'bento')!.interact;
const befriend = (a: C, b: C) => {
  a.p.friends.push(b.p.id);
  b.p.friends.push(a.p.id);
};
const room = (c: C) => c.s.instance?.def.id;

async function sail(world: World) {
  const host = await client(world);
  const guest = await client(world);
  befriend(host, guest);
  host.p.coins = 200;
  host.at(BENTO);
  await host.send({ t: 'party', action: 'create' });
  return { host, guest, trip: party(host, 'state')! };
}

async function landRobalo(c: C, spotId: string) {
  const spot = ROOMS.barco_festa.props.find((p) => p.id === spotId)!;
  world_join_tile(c, spot.interact ?? { x: spot.x, y: spot.y });
  await c.send({ t: 'pesca', action: 'open', spotId });
  await c.send({ t: 'pesca', action: 'cast', spotId, power: 0.5 });
  const cast = pesca(c, 'cast')!;
  advance(8000);
  await c.send({ t: 'pesca', action: 'result', seq: cast.seq, events: [{ k: 'hook', ms: 1600 }, { k: 'hold', down: true, ms: 1600 }, { k: 'hold', down: false, ms: 1990 }, { k: 'hold', down: true, ms: 2350 }] });
  return pesca(c, 'result')!;
}
/** Stand on a deck tile (the avatar's resting tile, as a walk would leave it). */
function world_join_tile(c: C, tile: Tile) {
  c.s.avatar = { ...c.s.avatar!, from: tile, path: [], start: clock };
}

describe('the party boat (PRAIA-PLAN.md 5)', () => {
  beforeEach(() => {
    clock = 1_000_000;
    pending = [];
  });

  it('create pays the festa price once, near Bento, and boards the host onto their own deck', async () => {
    const world = makeWorld();
    const host = await client(world);
    host.p.coins = 200;
    host.at({ x: 3, y: 4 });
    await host.send({ t: 'party', action: 'create' });
    expect(host.last('error')?.code).toBe('far');
    host.at(BENTO);
    host.p.coins = 100;
    await host.send({ t: 'party', action: 'create' });
    expect(host.last('error')?.code).toBe('coins');
    host.p.coins = 200;
    await host.send({ t: 'party', action: 'create' });
    expect(host.p.coins).toBe(50);
    expect(room(host)).toBe('barco_festa');
    expect(host.s.instance!.id).toMatch(/^festa@/);
    expect(host.s.instance!.id.endsWith('#1')).toBe(false);
    expect(host.p.diary).toContain('diary.praia.capitao');
    expect(host.p.pesca?.party.hosted).toBe(1);
    await host.send({ t: 'party', action: 'create' });
    expect(host.p.coins).toBe(50);
  });

  it('is never a public shard: a stranger cannot join the deck, nor can a friend who was not invited', async () => {
    const world = makeWorld();
    const { host, guest, trip } = await sail(world);
    world.join(guest.s, 'barco_festa', { instanceId: trip.tripId });
    expect(room(guest)).not.toBe('barco_festa');
    expect(guest.last('error')?.pt).toBe('Esse barco é de outra turma.');
    world.join(guest.s, 'barco_festa');
    expect(room(guest)).not.toBe('barco_festa');
    expect(room(host)).toBe('barco_festa');
  });

  it('invite rules: friends only, online only, not blocked, not busy; the boat counts pending invites against the cap', async () => {
    const config = new GameConfig();
    config.set('partyBoatCap', 2);
    const world = makeWorld(config);
    const { host, guest } = await sail(world);
    const stranger = await client(world);
    await host.send({ t: 'party', action: 'invite', targetId: stranger.p.id });
    expect(host.last('error')?.pt).toBe('Só dá pra chamar amigos.');
    expect(party(stranger, 'invite')).toBeUndefined();
    await host.send({ t: 'party', action: 'invite', targetId: guest.p.id });
    expect(party(guest, 'invite')).toMatchObject({ fromId: host.p.id, fromName: host.p.name });
    // one pending invite fills a boat of two
    const third = await client(world);
    befriend(host, third);
    await host.send({ t: 'party', action: 'invite', targetId: third.p.id });
    expect(host.last('error')?.pt).toBe('O barco está lotado!');
    // an invite expires in 90 seconds, then the seat is free again
    advance(91_000);
    expect(host.last('notice')?.pt).toContain('não respondeu');
    await host.send({ t: 'party', action: 'invite', targetId: third.p.id });
    expect(party(third, 'invite')).toBeDefined();
    // blocked by the target: it looks sent, nothing arrives
    const shy = await client(world);
    befriend(host, shy);
    shy.p.blocked = [host.p.id];
    config.set('partyBoatCap', 6);
    await host.send({ t: 'party', action: 'invite', targetId: shy.p.id });
    expect(host.last('notice')?.pt).toContain('Convite enviado');
    expect(party(shy, 'invite')).toBeUndefined();
  });

  it('accept fast-travels the guest aboard from anywhere; both are in one instance and the music word reaches both', async () => {
    const world = makeWorld();
    const { host, guest, trip } = await sail(world);
    world.join(guest.s, 'praca');
    await host.send({ t: 'party', action: 'invite', targetId: guest.p.id });
    await guest.send({ t: 'party', action: 'accept', tripId: party(guest, 'invite')!.tripId });
    expect(room(guest)).toBe('barco_festa');
    expect(guest.s.instance).toBe(host.s.instance);
    expect(guest.p.diary).toEqual(expect.arrayContaining(['diary.praia.convidado', 'diary.praia.tripulacao', 'diary.praia.festa']));
    expect(host.p.diary).toContain('diary.praia.festa');
    const st = party(host, 'state')!;
    expect(st.tripId).toBe(trip.tripId);
    expect(st.members.map((m) => m.name)).toEqual([host.p.name, guest.p.name]);
    expect(st.music).toBe(true);
    // a second accept of a used invite does nothing
    await guest.send({ t: 'party', action: 'accept', tripId: trip.tripId });
    expect(guest.last('error')?.code).toBe('party');
  });

  it('chat on deck is delivered verbatim', async () => {
    const world = makeWorld();
    const { host, guest } = await sail(world);
    await host.send({ t: 'party', action: 'invite', targetId: guest.p.id });
    await guest.send({ t: 'party', action: 'accept', tripId: party(guest, 'invite')!.tripId });
    await host.send({ t: 'chat', text: 'Bora pescar!' } as ClientMsg);
    const got = [...guest.inbox].reverse().find((m) => m.t === 'chat') as Extract<ServerMsg, { t: 'chat' }> | undefined;
    expect(got?.text).toBe('Bora pescar!');
  });

  it('a catch aboard teaches its word to everyone aboard; the catcher keeps the fish', async () => {
    const world = makeWorld();
    const { host, guest } = await sail(world);
    await host.send({ t: 'party', action: 'invite', targetId: guest.p.id });
    await guest.send({ t: 'party', action: 'accept', tripId: party(guest, 'invite')!.tripId });
    const r = await landRobalo(guest, 'pesca_festa_n1');
    expect(r.outcome).toMatchObject({ kind: 'caught', fish: 'robalo' });
    expect(guest.p.pesca?.balde.robalo).toBe(1);
    expect(host.p.pesca?.balde.robalo ?? 0).toBe(0);
    expect(host.p.diary).toContain('diary.praia.robalo');
    expect(pesca(host, 'aboard')).toMatchObject({ by: guest.p.name, fish: 'robalo' });
    // someone not aboard cannot fish the festa water
    const outsider = await client(world);
    outsider.at(BENTO);
    await outsider.send({ t: 'pesca', action: 'open', spotId: 'pesca_festa_n1' });
    expect(pesca(outsider, 'spot')).toBeUndefined();
  });

  it('the host ends it: everyone lands on the pier with the trip card; the cap, the shell and the net are granted once', async () => {
    const world = makeWorld();
    const { host, guest } = await sail(world);
    await host.send({ t: 'party', action: 'invite', targetId: guest.p.id });
    await guest.send({ t: 'party', action: 'accept', tripId: party(guest, 'invite')!.tripId });
    await landRobalo(host, 'pesca_festa_n1');
    await landRobalo(guest, 'pesca_festa_s1');
    await landRobalo(host, 'pesca_festa_n2');
    // the pinned test relaxes "five minutes with company" to five seconds; the casts above took longer
    await host.send({ t: 'party', action: 'end' });
    for (const c of [host, guest]) {
      expect(room(c)).toBe('praia');
      expect(world['currentTile'](c.s).tile).toEqual(PRAIA_PARTY_PIER);
      const end = party(c, 'ended')!;
      expect(end.why).toBe('host');
      expect(end.summary!.members).toEqual([host.p.name, guest.p.name]);
      expect(end.summary!.fish).toHaveLength(3);
      expect(c.p.hats).toContain('chapeu_capitao');
      expect(c.p.furniture.concha_grande).toBe(1);
    }
    expect(host.p.furniture.rede_pesca_parede).toBe(1);
    expect(guest.p.furniture.rede_pesca_parede ?? 0).toBe(0);
    expect(party(host, 'ended')!.summary!.earned).toEqual(expect.arrayContaining(['chapeu_capitao', 'concha_grande', 'rede_pesca_parede']));
    // the deck instance is gone once empty
    expect([...world['instances'].keys()].some((id) => id.startsWith('festa@'))).toBe(false);
    // once per player: a second trip grants nothing new
    host.at(BENTO);
    host.p.coins = 200;
    await host.send({ t: 'party', action: 'create' });
    await host.send({ t: 'party', action: 'end' });
    expect(host.p.hats.filter((h) => h === 'chapeu_capitao')).toHaveLength(1);
    expect(party(host, 'ended')!.summary!.earned).toEqual([]);
  });

  it('a solo trip earns no cap; the trip ends on time', async () => {
    const world = makeWorld();
    const { host } = await sail(world);
    advance(15 * 60_000 + 100);
    expect(room(host)).toBe('praia');
    expect(party(host, 'ended')).toMatchObject({ why: 'time' });
    expect(host.p.hats).not.toContain('chapeu_capitao');
  });

  it('a guest leaves alone (one tap, or the gangway); the host leaving ends it for everyone', async () => {
    const world = makeWorld();
    const { host, guest } = await sail(world);
    await host.send({ t: 'party', action: 'invite', targetId: guest.p.id });
    await guest.send({ t: 'party', action: 'accept', tripId: party(guest, 'invite')!.tripId });
    await guest.send({ t: 'party', action: 'leave' });
    expect(room(guest)).toBe('praia');
    expect(party(guest, 'ended')).toMatchObject({ why: 'left' });
    expect(room(host)).toBe('barco_festa');
    expect(party(host, 'state')!.members).toHaveLength(1);
    // back aboard, then the host walks off the gangway into the praia: everyone goes back
    await host.send({ t: 'party', action: 'invite', targetId: guest.p.id });
    await guest.send({ t: 'party', action: 'accept', tripId: party(guest, 'invite')!.tripId });
    expect(room(guest)).toBe('barco_festa');
    world.join(host.s, 'praia', {}, { tile: PRAIA_PARTY_PIER, dir: 'SW' });
    expect(room(guest)).toBe('praia');
    expect(party(guest, 'ended')).toMatchObject({ why: 'host' });
    expect(world.parties.byId.size).toBe(0);
  });

  it('the host can send a guest ashore (a neutral notice), and a host who blocks a guest sends them ashore too', async () => {
    const world = makeWorld();
    const { host, guest } = await sail(world);
    const third = await client(world);
    befriend(host, third);
    for (const g of [guest, third]) {
      await host.send({ t: 'party', action: 'invite', targetId: g.p.id });
      await g.send({ t: 'party', action: 'accept', tripId: party(g, 'invite')!.tripId });
    }
    await guest.send({ t: 'party', action: 'remove', targetId: third.p.id });
    expect(room(third)).toBe('barco_festa');
    await host.send({ t: 'party', action: 'remove', targetId: third.p.id });
    expect(room(third)).toBe('praia');
    expect(party(third, 'ended')).toMatchObject({ why: 'removed' });
    expect(party(third, 'ended')!.summary).toBeUndefined();
    expect(third.last('notice')?.pt).toBe('Você desembarcou no píer.');
    await host.send({ t: 'block', action: 'block', targetId: guest.p.id } as ClientMsg);
    expect(room(guest)).toBe('praia');
    expect(room(host)).toBe('barco_festa');
  });

  it('the admin switch off brings every trip back and the chip refuses new ones', async () => {
    const world = makeWorld();
    const { host } = await sail(world);
    world.setPraia({ partyBoat: false });
    expect(room(host)).toBe('praia');
    expect(party(host, 'ended')).toMatchObject({ why: 'off' });
    host.at(BENTO);
    host.p.coins = 200;
    await host.send({ t: 'party', action: 'create' });
    expect(host.last('error')?.pt).toBe('O barco de festa ainda não está saindo.');
    expect(host.p.coins).toBe(200);
  });

  it('a disconnect of a guest frees their seat; of the host, ends the trip', async () => {
    const world = makeWorld();
    const { host, guest } = await sail(world);
    await host.send({ t: 'party', action: 'invite', targetId: guest.p.id });
    await guest.send({ t: 'party', action: 'accept', tripId: party(guest, 'invite')!.tripId });
    world.disconnect(guest.s);
    expect(party(host, 'state')!.members).toHaveLength(1);
    world.disconnect(host.s);
    expect(world.parties.byId.size).toBe(0);
    expect([...world['instances'].keys()].some((id) => id.startsWith('festa@'))).toBe(false);
  });
});
