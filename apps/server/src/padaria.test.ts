import { beforeEach, describe, expect, it } from 'vitest';
import {
  COUNTER_ALWAYS,
  CLOCK_OFFSET_MS,
  counterMenu,
  counterPrice,
  counterSells,
  DEFAULT_APPEARANCE,
  GAME_DAY_MS,
  MS_PER_GAME_MINUTE,
  ROOMS,
  buildGrid,
  isWalkable,
  type ClientMsg,
  type ServerMsg,
} from '@tudobem/shared';
import { World, type Session } from './world.js';
import { ProfileStore } from './store.js';
import { AuthoredNpcDialogue, InMemoryStudentModel, JevStubSafety, MemoryModerationQueue, PhrasebookGloss } from './services/stubs.js';

let clock = 0;
const pending: { fn: () => void; at: number }[] = [];
function setGameTime(h: number, m = 0) {
  clock = 3 * GAME_DAY_MS + (h * 60 + m) * MS_PER_GAME_MINUTE - CLOCK_OFFSET_MS;
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
function run(ms: number) {
  for (let t = 0; t < ms; t += 1000) advance(1000);
}

function makeWorld() {
  return new World(
    new ProfileStore(null),
    { safety: new JevStubSafety(), gloss: new PhrasebookGloss(), npc: new AuthoredNpcDialogue(), student: new InMemoryStudentModel(), moderation: new MemoryModerationQueue() },
    { mgGapMs: 0, now: () => clock, schedule: (fn, ms) => pending.push({ fn, at: clock + ms }) },
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
async function client(world: World): Promise<Client> {
  const inbox: ServerMsg[] = [];
  const s = world.connect(`pd${n++}`, (m) => inbox.push(m), () => {});
  const c: Client = {
    s,
    inbox,
    send: (m) => world.handle(s, m),
    last: (t) => [...inbox].reverse().find((m) => m.t === t) as never,
    all: (t) => inbox.filter((m) => m.t === t) as never,
  };
  await c.send({ t: 'hello' });
  await c.send({ t: 'createProfile', name: `Pad${n++}`, pronoun: 'ela', appearance: DEFAULT_APPEARANCE });
  await c.send({ t: 'join', room: 'praca' });
  return c;
}

async function walkTo(c: Client, x: number, y: number) {
  await c.send({ t: 'move', x, y });
  run(60_000);
}


/** Into the padaria and up to the baker on duty. */
async function toCounter(c: Client, baker: 'carlos' | 'graca' = 'carlos') {
  await c.send({ t: 'join', room: 'padaria' });
  const npc = ROOMS.padaria.npcs.find((q) => q.id === baker) ?? ROOMS.padaria.npcs.find((q) => q.id === 'carlos')!;
  await walkTo(c, npc.interact.x, npc.interact.y);
}

describe('the padaria counter', () => {
  beforeEach(() => setGameTime(9));

  it('always offers coxinha and café, plus what an errand asks the baker for', () => {
    expect(counterMenu(undefined)).toEqual([...COUNTER_ALWAYS]);
    expect(counterMenu([{ id: 'carlos_cafe_pra_nanda', step: 0 }])).toEqual(['coxinha', 'cafe', 'cafe_com_leite']);
  });

  it('charges the price, puts it in your hand and in the bag, and counts as ordering for the recados', async () => {
    const world = makeWorld();
    const a = await client(world);
    a.s.profile!.coins = 30;
    a.s.profile!.recados = { ...a.s.profile!.recados!, active: [{ id: 'carlos_cafe_pra_nanda', step: 0 }] };
    await toCounter(a);
    await a.send({ t: 'padaria', action: 'buy', itemId: 'cafe_com_leite' });
    expect(a.s.profile!.coins).toBe(30 - counterPrice('cafe_com_leite'));
    expect(a.s.carry).toBe('cafe_com_leite');
    expect(a.s.profile!.bag?.cafe_com_leite).toBe(1);
    expect(a.s.profile!.recados!.active.find((r) => r.id === 'carlos_cafe_pra_nanda')?.step).toBe(1);
    expect(a.s.profile!.tutorial.carlos).toBe(true);
    // a coxinha replaces the café in your hand
    await a.send({ t: 'padaria', action: 'buy', itemId: 'coxinha' });
    expect(a.s.carry).toBe('coxinha');
  });

  it('the pastel favor: the pastel joins the menu while Júlia asks for one, the baker sells it, and Nanda gets it', async () => {
    const favor = [{ id: 'julia_pastel_pra_nanda', step: 0 }];
    expect(counterMenu(favor)).toContain('pastel');
    expect(counterSells('pastel', favor)).toBe(true);
    expect(counterSells('pastel', undefined)).toBe(false);
    expect(counterSells('pastel', [{ id: 'julia_pastel_pra_nanda', step: 1 }])).toBe(false);
    setGameTime(12);
    const world = makeWorld();
    const a = await client(world);
    const p = a.s.profile!;
    p.coins = 30;
    p.recados!.offered = ['julia_pastel_pra_nanda'];
    await a.send({ t: 'recados', action: 'accept', id: 'julia_pastel_pra_nanda' });
    expect(p.recados!.active.find((r) => r.id === 'julia_pastel_pra_nanda')?.step).toBe(0);
    await toCounter(a);
    await a.send({ t: 'padaria', action: 'buy', itemId: 'pastel' });
    expect(p.coins).toBe(30 - counterPrice('pastel'));
    expect(a.s.carry).toBe('pastel');
    expect(p.bag?.pastel).toBe(1);
    expect(p.recados!.active.find((r) => r.id === 'julia_pastel_pra_nanda')?.step).toBe(1);
    // once the pastel is ordered the counter stops selling it
    await a.send({ t: 'padaria', action: 'buy', itemId: 'pastel' });
    expect(p.bag?.pastel).toBe(1);
    await a.send({ t: 'join', room: 'praca' });
    const nanda = ROOMS.praca.npcs.find((q) => q.id === 'nanda')!;
    await walkTo(a, nanda.interact.x, nanda.interact.y);
    await a.send({ t: 'give', npc: 'nanda', itemId: 'pastel' });
    expect(p.recados!.done).toContain('julia_pastel_pra_nanda');
  });

  it('refuses without enough RV, from across the room, outside the padaria, and for things not on the menu', async () => {
    const world = makeWorld();
    const a = await client(world);
    a.s.profile!.coins = 30;
    await a.send({ t: 'padaria', action: 'buy', itemId: 'coxinha' });
    expect(a.s.carry).toBeNull();
    await a.send({ t: 'join', room: 'padaria' });
    await walkTo(a, 8, 7);
    await a.send({ t: 'padaria', action: 'buy', itemId: 'coxinha' });
    expect(a.last('error')?.code).toBe('far');
    await toCounter(a);
    await a.send({ t: 'padaria', action: 'buy', itemId: 'pastel' });
    expect(a.s.carry).toBeNull();
    a.s.profile!.coins = 1;
    await a.send({ t: 'padaria', action: 'buy', itemId: 'coxinha' });
    expect(a.last('error')?.code).toBe('coins');
    expect(a.s.carry).toBeNull();
  });
});
