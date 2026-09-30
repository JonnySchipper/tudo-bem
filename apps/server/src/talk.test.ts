import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, ROOMS, type ClientMsg, type ServerMsg } from '@tudobem/shared';
import { World, type Session } from './world.js';
import { ProfileStore } from './store.js';
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
}

let n = 0;
async function client(world: World): Promise<Client> {
  const inbox: ServerMsg[] = [];
  const s = world.connect(`t${n++}`, (m) => inbox.push(m), () => {});
  const c: Client = { s, inbox, send: (m) => world.handle(s, m) };
  await c.send({ t: 'hello' });
  await c.send({ t: 'createProfile', name: `Talk${n++}`, pronoun: 'ela', appearance: DEFAULT_APPEARANCE });
  await c.send({ t: 'join', room: 'praca' });
  return c;
}

const nanda = ROOMS.praca.npcs.find((x) => x.id === 'nanda')!;

describe('talk: the greeting dialogue with Nanda and Júlia (Phase 7)', () => {
  beforeEach(() => {
    clock = 5_000_000;
    pending.length = 0;
  });

  it('counts as a talk only next to the NPC, gives the daily bond once, finishes a falar recado and marks the greeting as seen', async () => {
    const world = makeWorld();
    const a = await client(world);
    const p = a.s.profile!;
    p.bond = { julia: 10 };
    p.recados!.offered = ['julia_conhecer_nanda'];
    await a.send({ t: 'recados', action: 'accept', id: 'julia_conhecer_nanda' });

    // far away (the spawn is about 14 tiles from her stall): nothing happens
    await a.send({ t: 'talk', npc: 'nanda' });
    expect(p.bond?.nanda).toBeUndefined();
    expect(p.recados!.active).toEqual([{ id: 'julia_conhecer_nanda', step: 0 }]);

    await a.send({ t: 'move', x: nanda.interact.x, y: nanda.interact.y });
    advance(120_000);
    await a.send({ t: 'talk', npc: 'carlos' }); // Carlos has his own flows (and is not in this room)
    await a.send({ t: 'talk', npc: 'nope' as never });
    expect(p.bond?.nanda).toBeUndefined();
    await a.send({ t: 'talk', npc: 'nanda' });
    expect(p.bond?.nanda).toBe(2);
    expect(p.recados!.done).toEqual(['julia_conhecer_nanda']);
    // the greeting line counts as seen in the Caderno (Oi / Tudo bem)
    expect(p.caderno?.['lex.social.oi']?.seen).toBe(1);
    expect(p.caderno?.['lex.social.tudo_bem']?.seen).toBe(1);

    await a.send({ t: 'talk', npc: 'nanda' }); // the daily talk bond is paid once
    expect(p.bond?.nanda).toBe(2);
  });
});
