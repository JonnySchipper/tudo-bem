import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, FURNITURE, ROOMS, furnitureById, giftFor, hearts, storyOf, type ClientMsg, type ServerMsg } from '@tudobem/shared';
import { World, type Session } from './world.js';
import { ProfileStore, normalizeProfile, type StoredProfile } from './store.js';
import { AuthoredNpcDialogue, InMemoryStudentModel, JevStubSafety, MemoryModerationQueue, PhrasebookGloss } from './services/stubs.js';

/**
 * Friendship milestones (HOWTO Phase 8 step 4): 2 hearts = the NPC knows your name, 4 = they tell you their story (a bate-papo), 6 = a
 * furniture gift (once). The effects run wherever bond is paid (talk, recado, bate-papo), through `RecadoTracker.gain`.
 */
let clock = 12 * 60 * 60 * 1000;
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
    { mgGapMs: 0, now: () => clock, schedule: (fn, ms) => pending.push({ fn, at: clock + ms }), clockOffsetMs: 0 },
  );
}

interface Client {
  s: Session;
  inbox: ServerMsg[];
  send: (m: ClientMsg) => Promise<void>;
  notices: (tag?: string) => Extract<ServerMsg, { t: 'notice' }>[];
}

let n = 0;
async function client(world: World): Promise<Client> {
  const inbox: ServerMsg[] = [];
  const s = world.connect(`m${n++}`, (m) => inbox.push(m), () => {});
  await world.handle(s, { t: 'hello' });
  await world.handle(s, { t: 'createProfile', name: `Mil${n}`, pronoun: 'ela', appearance: DEFAULT_APPEARANCE });
  await world.handle(s, { t: 'join', room: 'praca' });
  return {
    s,
    inbox,
    send: (m) => world.handle(s, m),
    notices: (tag) => inbox.filter((m): m is Extract<ServerMsg, { t: 'notice' }> => m.t === 'notice' && (tag ? m.tag === tag : true)),
  };
}

/** Bond with Nanda goes up by talking to her (the daily +2). Stand next to her and open her greeting. */
async function talkToNanda(c: Client) {
  const nanda = ROOMS.praca.npcs.find((x) => x.id === 'nanda')!;
  await c.send({ t: 'move', x: nanda.interact.x, y: nanda.interact.y });
  advance(120_000);
  await c.send({ t: 'talk', npc: 'nanda' });
}

describe('bond milestones', () => {
  beforeEach(() => {
    clock = 12 * 60 * 60 * 1000;
    pending.length = 0;
  });

  it('every NPC has a gift in the furniture catalog', () => {
    for (const npc of ['carlos', 'graca', 'nanda', 'julia', 'prof', 'tia_lu', 'ze', 'chico', 'rosa'] as const) expect(furnitureById(giftFor(npc)), npc).toBeDefined();
    expect(FURNITURE.length).toBeGreaterThan(6);
  });

  it('2 hearts: a notice says the NPC knows your name now', async () => {
    const world = makeWorld();
    const a = await client(world);
    a.s.profile!.bond = { nanda: 19 };
    await talkToNanda(a);
    expect(a.s.profile!.bond?.nanda).toBe(21);
    expect(hearts(a.s.profile!.bond!.nanda!)).toBe(2);
    const notes = a.notices('bond');
    expect(notes).toHaveLength(1);
    expect(notes[0]!.pt).toContain('Nanda já sabe o seu nome');
    expect(a.s.profile!.furniture.tapete).toBeUndefined();
  });

  it('4 hearts: the NPC wants to tell you their story (their 4-heart bate-papo), named in the notice', async () => {
    const world = makeWorld();
    const a = await client(world);
    a.s.profile!.bond = { nanda: 39 };
    await talkToNanda(a);
    expect(hearts(a.s.profile!.bond!.nanda!)).toBe(4);
    const notes = a.notices('bond');
    expect(notes).toHaveLength(1);
    expect(notes[0]!.pt).toContain(storyOf('nanda')!.title.pt);
    expect(notes[0]!.en).toContain(storyOf('nanda')!.title.en);
  });

  it('6 hearts: a furniture gift lands in the inventory once, with a notice; crossing the line again gives nothing more', async () => {
    const world = makeWorld();
    const a = await client(world);
    const p = a.s.profile!;
    p.bond = { nanda: 59 };
    const before = p.furniture.tapete ?? 0;
    await talkToNanda(a);
    expect(hearts(p.bond!.nanda!)).toBe(6);
    expect(p.furniture.tapete).toBe(before + 1);
    expect(p.bondGifts).toEqual(['nanda']);
    const gift = a.notices('bond').find((x) => x.pt.includes('presente'));
    expect(gift?.pt).toContain('Tapete colorido');
    expect(gift?.en).toContain('Colorful rug');

    // friendship can only fall through a hand-edited save; the gift is still spent
    p.bond = { nanda: 59 };
    advance(48 * 60 * 1000); // next game day: the talk bond is paid again
    await talkToNanda(a);
    expect(hearts(p.bond!.nanda!)).toBe(6);
    expect(p.furniture.tapete).toBe(before + 1);
    expect(a.notices('bond').filter((x) => x.pt.includes('presente'))).toHaveLength(1);
  });

  it('a bate-papo talked through (never graded): a talk, +3 bond once a game day, remembered as heard, the praça cartela stamp', async () => {
    const world = makeWorld();
    const a = await client(world);
    const p = a.s.profile!;
    const nanda = ROOMS.praca.npcs.find((x) => x.id === 'nanda')!;
    // too far away: nothing counts
    await a.send({ t: 'papo', npc: 'nanda', id: 'nanda.sol' });
    expect(p.papos ?? []).toEqual([]);
    await a.send({ t: 'move', x: nanda.interact.x, y: nanda.interact.y });
    advance(120_000);
    // the story is not open before 4 hearts, and a papo of someone else is refused
    await a.send({ t: 'papo', npc: 'nanda', id: 'nanda.historia' });
    await a.send({ t: 'papo', npc: 'nanda', id: 'julia.ipe' });
    expect(p.papos ?? []).toEqual([]);
    await a.send({ t: 'papo', npc: 'nanda', id: 'nanda.sol' });
    expect(p.papos).toEqual(['nanda.sol']);
    expect(p.bond?.nanda).toBe(2 + 3); // the day's talk + the bate-papo
    expect(a.inbox.some((m) => m.t === 'cartela' && m.activity === 'conversa')).toBe(true);
    await a.send({ t: 'papo', npc: 'nanda', id: 'nanda.fonte' });
    expect(p.papos).toEqual(['nanda.sol', 'nanda.fonte']);
    expect(p.bond?.nanda).toBe(5); // once per game day
  });

  it('an old save without bondGifts loads with an empty list', () => {
    const old = { bond: { nanda: 12 } } as unknown as StoredProfile;
    normalizeProfile(old);
    expect(old.bondGifts).toEqual([]);
    const dirty = { bondGifts: ['nanda', 'nanda', 'nobody', 7] } as unknown as StoredProfile;
    expect(normalizeProfile(dirty).bondGifts).toEqual(['nanda']);
  });
});
