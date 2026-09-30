import { beforeEach, describe, expect, it } from 'vitest';
import {
  CLOCK_OFFSET_MS,
  DEFAULT_APPEARANCE,
  GAME_DAY_MS,
  isCpuId,
  legsBetween,
  MS_PER_GAME_MINUTE,
  npcAvatarId,
  SCHEDULES,
  type ClientMsg,
  type PublicAvatar,
  type RoomId,
  type ServerMsg,
} from '@tudobem/shared';
import { World, type Session } from './world.js';
import { ProfileStore } from './store.js';
import { AuthoredNpcDialogue, InMemoryStudentModel, JevStubSafety, MemoryModerationQueue, PhrasebookGloss } from './services/stubs.js';

let clock = 0;
const pending: { fn: () => void; at: number }[] = [];
/** Sets the wall clock so the GAME clock reads `h:mm` (plus `sec` real seconds) on game day 3. */
function setGameTime(h: number, m = 0, sec = 0) {
  clock = 3 * GAME_DAY_MS + (h * 60 + m) * MS_PER_GAME_MINUTE + sec * 1000 - CLOCK_OFFSET_MS;
  pending.length = 0;
}
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
/** Advance in 1 s steps so the NPC tick (which reschedules itself every second) keeps running. */
function run(ms: number) {
  for (let t = 0; t < ms; t += 1000) advance(1000);
}

function makeWorld(extra: { clockOffsetMs?: number } = {}) {
  return new World(
    new ProfileStore(null),
    { safety: new JevStubSafety(), gloss: new PhrasebookGloss(), npc: new AuthoredNpcDialogue(), student: new InMemoryStudentModel(), moderation: new MemoryModerationQueue() },
    { mgGapMs: 0, now: () => clock, schedule: (fn, ms) => pending.push({ fn, at: clock + ms }), ...extra },
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
async function client(world: World, room: RoomId = 'praca'): Promise<Client> {
  const inbox: ServerMsg[] = [];
  const s = world.connect(`n${n++}`, (m) => inbox.push(m), () => {});
  const c: Client = {
    s,
    inbox,
    send: (m) => world.handle(s, m),
    last: (t) => [...inbox].reverse().find((m) => m.t === t) as never,
    all: (t) => inbox.filter((m) => m.t === t) as never,
  };
  await c.send({ t: 'hello' });
  await c.send({ t: 'createProfile', name: `Npc${n++}`, pronoun: 'ela', appearance: DEFAULT_APPEARANCE });
  await c.send({ t: 'join', room });
  return c;
}

const npcsOf = (c: Client): PublicAvatar[] => (c.last('roomState')?.avatars ?? []).filter((a) => a.npc);
const npcIdsIn = (c: Client) => npcsOf(c).map((a) => a.npc).sort();
const errors = (c: Client) => c.all('error').map((e) => e.code);
async function walkTo(c: Client, x: number, y: number) {
  await c.send({ t: 'move', x, y });
  run(60_000);
}

describe('NPCs on the server: positions from the schedule', () => {
  beforeEach(() => setGameTime(12));

  it('roomState carries each NPC of the room as a flagged avatar at its schedule tile (noon)', async () => {
    const world = makeWorld();
    const a = await client(world, 'praca');
    expect(npcIdsIn(a)).toEqual(['julia', 'nanda']);
    const nanda = npcsOf(a).find((v) => v.npc === 'nanda')!;
    expect(nanda).toMatchObject({ id: npcAvatarId('nanda'), name: 'Nanda', x: 35, y: 13, sitting: false, activity: 'trabalhando', npcInteract: { x: 34, y: 15 }, nameplate: 'verde' });
    expect(nanda.cpu).toBeUndefined();
    expect(isCpuId(nanda.id)).toBe(false);
    expect(npcsOf(a).find((v) => v.npc === 'julia')).toMatchObject({ x: 22, y: 19, activity: 'trabalhando', npcInteract: { x: 22, y: 20 } });
    await a.send({ t: 'join', room: 'padaria' });
    expect(npcIdsIn(a)).toEqual(['carlos']);
    expect(npcsOf(a)[0]).toMatchObject({ x: 3, y: 1, npcInteract: { x: 3, y: 3 } });
    await a.send({ t: 'join', room: 'academia' });
    expect(npcIdsIn(a)).toEqual(['prof']);
    expect(npcsOf(a)[0]).toMatchObject({ name: 'Professora Bia', x: 8, y: 4, npcInteract: { x: 8, y: 5 } });
    await a.send({ t: 'join', room: 'kitnet' });
    expect(npcIdsIn(a)).toEqual([]);
  });

  it('the players list never contains NPCs as other players: they are flagged and their ids are not player ids', async () => {
    const world = makeWorld();
    const a = await client(world, 'padaria');
    const players = a.last('roomState')!.avatars.filter((v) => !v.npc && !v.cpu);
    expect(players.map((v) => v.id)).toEqual([a.s.profile!.id]);
  });

  it('night falls: at 23:00 the padaria is staffed by Dona Graça and Nanda has gone home', async () => {
    setGameTime(23, 15);
    const world = makeWorld();
    const a = await client(world, 'padaria');
    expect(npcIdsIn(a)).toEqual(['graca']);
    expect(npcsOf(a)[0]).toMatchObject({ name: 'Dona Graça', x: 3, y: 1, activity: 'trabalhando', npcInteract: { x: 3, y: 3 } });
    await a.send({ t: 'join', room: 'praca' });
    // Júlia by the banca, Carlos on his bench, Nanda gone
    expect(npcIdsIn(a)).toEqual(['carlos', 'julia']);
    expect(npcsOf(a).find((v) => v.npc === 'carlos')).toMatchObject({ x: 28, y: 17, sitting: true, activity: 'sentado' });
    expect(npcsOf(a).find((v) => v.npc === 'julia')).toMatchObject({ x: 21, y: 6, activity: 'passeando' });
  });

  it('the world clock offset (test only) moves the schedules and the serverNow the client clock follows', async () => {
    setGameTime(12);
    // 11 game hours = 660 game minutes = 1320 real seconds
    const offset = 11 * 60 * MS_PER_GAME_MINUTE;
    const a = await client(makeWorld({ clockOffsetMs: offset }), 'padaria');
    expect(npcIdsIn(a)).toEqual(['graca']); // 12:00 + 11 h = 23:00
    expect(a.last('roomState')!.serverNow).toBe(clock + offset);
  });
});

describe('NPCs walk between slots and every instance sees it', () => {
  it('at 22:00 Seu Carlos leaves the padaria and appears in the praça at the door; Graça takes the counter', async () => {
    setGameTime(21, 59);
    const world = makeWorld();
    const inPadaria = await client(world, 'padaria');
    const inPraca = await client(world, 'praca');
    expect(npcIdsIn(inPadaria)).toEqual(['carlos', 'graca']); // Graça is having her evening coffee at a table
    const carlosStart = legsBetween(SCHEDULES.carlos![1]!, SCHEDULES.carlos![2]!);
    run(30_000);
    // the padaria saw Carlos start to walk to the door and then leave; Graça (sitting until 22:00) started her walk to the counter
    const moved = inPadaria.all('avatarMoved').filter((m) => m.id === npcAvatarId('carlos'));
    expect(moved.length).toBeGreaterThanOrEqual(1);
    expect(moved[0]!.path.at(-1)).toEqual({ x: 0, y: 6 });
    expect(inPadaria.all('avatarLeft').some((m) => m.id === npcAvatarId('carlos'))).toBe(true);
    const gracaJoin = inPadaria.all('avatarJoined').find((m) => m.avatar.npc === 'graca');
    expect(gracaJoin).toBeUndefined(); // she was in the padaria already (at her table)
    expect(inPadaria.all('avatarMoved').some((m) => m.id === npcAvatarId('graca') && m.path.at(-1)!.x === 3 && m.path.at(-1)!.y === 1)).toBe(true);
    // the praça saw him arrive at the padaria door tile (16,6) and walk to the bench, and sit
    const joined = inPraca.all('avatarJoined').find((m) => m.avatar.npc === 'carlos');
    expect(joined).toBeTruthy();
    expect(joined!.avatar).toMatchObject({ x: 16, y: 6, activity: 'sentado' });
    const walk = inPraca.all('avatarMoved').find((m) => m.id === npcAvatarId('carlos'))!;
    expect(walk.sit).toBe(true);
    expect(walk.path.at(-1)).toEqual({ x: 28, y: 17 });
    expect(carlosStart[0]!.ms).toBeGreaterThan(0);
  });

  it('a player who joins in the middle of a walk gets the rest of it', async () => {
    setGameTime(22, 0, 1);
    const world = makeWorld();
    const first = await client(world, 'praca'); // keeps the world ticking
    run(3000);
    const late = await client(world, 'padaria');
    const carlos = npcsOf(late).find((v) => v.npc === 'carlos')!;
    expect(carlos).toBeTruthy();
    const moved = late.all('avatarMoved').find((m) => m.id === npcAvatarId('carlos'));
    expect(moved).toBeTruthy();
    expect(moved!.from).toEqual({ x: carlos.x, y: carlos.y });
    expect(moved!.path.at(-1)).toEqual({ x: 0, y: 6 });
    expect(moved!.path.length).toBeGreaterThan(0);
    void first;
  });

  it('a reconnecting client (new session, same account) gets the same walk state', async () => {
    setGameTime(5, 59);
    const world = makeWorld();
    const a = await client(world, 'padaria');
    run(2000);
    const again = await client(world, 'padaria');
    const carlosA = npcsOf(a).find((v) => v.npc === 'carlos');
    expect(carlosA).toBeUndefined(); // he was not yet in the world when `a` joined
    const carlos = npcsOf(again).find((v) => v.npc === 'carlos')!;
    expect(carlos).toBeTruthy();
    const moved = again.all('avatarMoved').find((m) => m.id === npcAvatarId('carlos'))!;
    expect(moved.path.at(-1)).toEqual({ x: 3, y: 1 });
    // `a`, who was in the room, was told when he came in
    expect(a.all('avatarJoined').some((m) => m.avatar.npc === 'carlos')).toBe(true);
    run(20_000);
    expect(a.all('avatarLeft').some((m) => m.id === npcAvatarId('graca'))).toBe(true);
  });
});

describe('NPC tiles block the player, where the NPC is now', () => {
  it('a player cannot walk onto an NPC; the tile frees when the NPC has gone', async () => {
    setGameTime(12);
    const world = makeWorld();
    const a = await client(world, 'praca');
    await a.send({ t: 'move', x: 35, y: 13 }); // Nanda's tile
    expect(a.all('avatarMoved').filter((m) => m.id === a.s.profile!.id)).toHaveLength(0);
    // Júlia's tile too
    await a.send({ t: 'move', x: 22, y: 19 });
    expect(a.all('avatarMoved').filter((m) => m.id === a.s.profile!.id)).toHaveLength(0);
    // ...but the tile next to her (her interact tile) is fine
    await a.send({ t: 'move', x: 22, y: 20 });
    expect(a.all('avatarMoved').filter((m) => m.id === a.s.profile!.id)).toHaveLength(1);
    // at night Nanda is gone and (35,13) is walkable
    setGameTime(21);
    const b = await client(makeWorld(), 'praca');
    await b.send({ t: 'move', x: 35, y: 13 });
    expect(b.all('avatarMoved').filter((m) => m.id === b.s.profile!.id)).toHaveLength(1);
  });

  it('Júlia\'s bench seat is blocked while she sits on it (evening) and free in the morning', async () => {
    setGameTime(19);
    const world = makeWorld();
    const a = await client(world, 'praca');
    await a.send({ t: 'move', x: 21, y: 17, sit: true });
    expect(a.all('avatarMoved').filter((m) => m.id === a.s.profile!.id)).toHaveLength(0);
    await a.send({ t: 'move', x: 20, y: 17, sit: true }); // the other half of the bench
    expect(a.all('avatarMoved').filter((m) => m.id === a.s.profile!.id)).toHaveLength(1);
    setGameTime(9);
    const b = await client(makeWorld(), 'praca');
    await b.send({ t: 'move', x: 21, y: 17, sit: true });
    expect(b.all('avatarMoved').filter((m) => m.id === b.s.profile!.id)).toHaveLength(1);
  });

  it('Professora Bia never moves: her tile is blocked at every hour', async () => {
    for (const h of [3, 12, 22]) {
      setGameTime(h);
      const a = await client(makeWorld(), 'academia');
      await a.send({ t: 'move', x: 8, y: 4 });
      expect(a.all('avatarMoved').filter((m) => m.id === a.s.profile!.id), `hour ${h}`).toHaveLength(0);
      await a.send({ t: 'move', x: 8, y: 5 });
      expect(a.all('avatarMoved').filter((m) => m.id === a.s.profile!.id), `hour ${h}`).toHaveLength(1);
    }
  });
});

describe('D12 at night: the breakfast scene and Me vê um work with Dona Graça', () => {
  it('the Carlos scene starts with either baker id, only in the padaria, and the talk bond goes to the baker on duty', async () => {
    setGameTime(23);
    const world = makeWorld();
    const a = await client(world, 'padaria');
    await a.send({ t: 'scene', action: 'start', npc: 'carlos' });
    expect(errors(a)).toEqual([]);
    expect(a.last('scene')!.view.line.pt.length).toBeGreaterThan(0);
    for (let i = 0; i < 5; i++) await a.send({ t: 'scene', action: 'choose', chip: 0 });
    expect(a.last('scene')!.view.end).toBe(true);
    expect(a.s.profile!.bond).toEqual({ graca: 2 });
    expect(a.s.profile!.tutorial.carlos).toBe(true);
    // the same scene when the client asks for Dona Graça by name
    const b = await client(world, 'padaria');
    await b.send({ t: 'scene', action: 'start', npc: 'graca' });
    expect(errors(b)).toEqual([]);
    expect(b.last('scene')).toBeTruthy();
    // and from the praça it is refused
    const c = await client(world, 'praca');
    await c.send({ t: 'scene', action: 'start', npc: 'carlos' });
    expect(errors(c)).toEqual(['scene']);
    await c.send({ t: 'scene', action: 'start', npc: 'nanda' as never });
    expect(errors(c)).toEqual(['scene', 'scene']);
  });

  it('by day the bond goes to Seu Carlos', async () => {
    setGameTime(9);
    const a = await client(makeWorld(), 'padaria');
    await a.send({ t: 'scene', action: 'start', npc: 'carlos' });
    expect(a.s.profile!.bond).toEqual({ carlos: 2 });
  });
});

describe('recados follow the NPC: give uses where the NPC is now', () => {
  async function withRecado(h: number) {
    setGameTime(h);
    const a = await client(makeWorld(), 'praca');
    const p = a.s.profile!;
    p.bag = { pao_na_chapa: 1 };
    p.recados!.offered = ['graca_pao_pra_julia'];
    await a.send({ t: 'recados', action: 'accept', id: 'graca_pao_pra_julia' });
    p.recados!.active[0]!.step = 1; // skip the order: the next step is to hand the bread to Júlia
    return a;
  }

  it('by day Júlia stands at the kiosk end of the path: giving from the banca is too far, from her interact tile it works', async () => {
    const a = await withRecado(12);
    await walkTo(a, 20, 6); // where Júlia stands at dawn and at night
    await a.send({ t: 'give', npc: 'julia', itemId: 'pao_na_chapa' });
    expect(errors(a)).toEqual(['far']);
    await walkTo(a, 22, 20);
    await a.send({ t: 'give', npc: 'julia', itemId: 'pao_na_chapa' });
    expect(errors(a)).toEqual(['far']);
    expect(a.s.profile!.recados!.done).toContain('graca_pao_pra_julia');
  });

  it('at 23:30 Júlia is at the banca: the old spot no longer works and the banca does', async () => {
    const a = await withRecado(23);
    await walkTo(a, 22, 20);
    await a.send({ t: 'give', npc: 'julia', itemId: 'pao_na_chapa' });
    expect(errors(a)).toEqual(['far']);
    expect(a.s.profile!.bag).toEqual({ pao_na_chapa: 1 });
    await walkTo(a, 20, 6);
    await a.send({ t: 'give', npc: 'julia', itemId: 'pao_na_chapa' });
    expect(errors(a)).toEqual(['far']);
    expect(a.s.profile!.recados!.done).toContain('graca_pao_pra_julia');
  });

  it('an NPC who has gone home is not here: Nanda at night', async () => {
    setGameTime(21);
    const a = await client(makeWorld(), 'praca');
    a.s.profile!.bag = { coxinha: 1 };
    await a.send({ t: 'give', npc: 'nanda', itemId: 'coxinha' });
    expect(a.all('error').at(-1)!.pt).toContain('não está aqui');
  });

  it('Professora Bia takes the water at the academia at any hour (graca_agua_pra_academia)', async () => {
    for (const h of [3, 14]) {
      setGameTime(h);
      const a = await client(makeWorld(), 'academia');
      const p = a.s.profile!;
      p.bag = { agua: 1 };
      p.bond = { graca: 10 };
      p.recados!.offered = ['graca_agua_pra_academia'];
      await a.send({ t: 'recados', action: 'accept', id: 'graca_agua_pra_academia' });
      p.recados!.active[0]!.step = 2; // ordered and been to the academia: hand the water over
      await a.send({ t: 'give', npc: 'prof', itemId: 'agua' });
      expect(errors(a), `hour ${h}`).toEqual(['far']);
      await walkTo(a, 8, 5);
      await a.send({ t: 'give', npc: 'prof', itemId: 'agua' });
      expect(errors(a), `hour ${h}`).toEqual(['far']);
      expect(p.recados!.done, `hour ${h}`).toContain('graca_agua_pra_academia');
      expect(p.bag?.agua).toBeUndefined();
    }
  });
});
