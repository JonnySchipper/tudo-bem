import { describe, expect, it, beforeEach } from 'vitest';
import {
  DEFAULT_APPEARANCE,
  ESCALATE_NOTE,
  SAFETY_NOTES,
  grantTestSubscription,
  revokeTestSubscription,
  type ClientMsg,
  type ServerMsg,
} from '@tudobem/shared';
import { World, type Session, type WorldOptions } from './world.js';
import { ProfileStore } from './store.js';
import { AuthoredNpcDialogue, InMemoryStudentModel, JevStubSafety, MemoryModerationQueue, PhrasebookGloss } from './services/stubs.js';
import { JevModelSafety, type ToxModel, type ToxScores } from './services/jevModel.js';
import type { ChatSafetyService } from './services/interfaces.js';

let clock = 1_000_000;
const now = () => clock;

function makeWorld(safety: ChatSafetyService = new JevStubSafety(), extra: Partial<WorldOptions> = {}) {
  const moderation = new MemoryModerationQueue();
  const world = new World(
    new ProfileStore(null),
    { safety, gloss: new PhrasebookGloss(), npc: new AuthoredNpcDialogue(), student: new InMemoryStudentModel(), moderation },
    { roomCap: 16, now, schedule: () => {}, ...extra },
  );
  return { world, moderation };
}

interface Client {
  s: Session;
  inbox: ServerMsg[];
  send: (m: ClientMsg) => Promise<void>;
  last: <T extends ServerMsg['t']>(t: T) => Extract<ServerMsg, { t: T }> | undefined;
}

let n = 0;
async function client(world: World, name = `Ana${n}`): Promise<Client> {
  const inbox: ServerMsg[] = [];
  const s = world.connect(`c${n++}`, (m) => inbox.push(m), () => {});
  const c: Client = {
    s,
    inbox,
    send: (m) => world.handle(s, m),
    last: (t) => [...inbox].reverse().find((m) => m.t === t) as never,
  };
  await c.send({ t: 'hello' });
  await c.send({ t: 'createProfile', name, pronoun: 'ela', appearance: DEFAULT_APPEARANCE });
  await c.send({ t: 'join', room: 'praca' });
  grantTestSubscription(c.s.profile!, clock);
  return c;
}

const zero: ToxScores = { toxicity: 0, severe_toxicity: 0, obscene: 0, threat: 0, insult: 0, identity_attack: 0, sexual_explicit: 0 };

describe('pet names', () => {
  beforeEach(() => {
    clock = 1_000_000;
    n = 0;
  });

  it('saves a trimmed name per pet, syncs it, and keeps it when the pet is put away', async () => {
    const { world } = makeWorld();
    const a = await client(world, 'Ana');
    const b = await client(world, 'Bia');
    await a.send({ t: 'perk', action: 'pet', pet: 'dog' });
    await a.send({ t: 'perk', action: 'petName', pet: 'dog', name: '  Caramelo  ' });
    expect(a.s.profile!.petNames).toEqual({ dog: 'Caramelo' });
    expect(a.last('profile')!.profile.petNames).toEqual({ dog: 'Caramelo' });
    expect(a.last('avatarUpdated')!.avatar).toMatchObject({ pet: 'dog', petName: 'Caramelo' });
    expect(b.last('avatarUpdated')!.avatar).toMatchObject({ id: a.s.profile!.id, pet: 'dog', petName: 'Caramelo' });

    await a.send({ t: 'perk', action: 'petName', pet: 'cat', name: 'Pipoca' });
    expect(a.s.profile!.petNames).toEqual({ dog: 'Caramelo', cat: 'Pipoca' });
    // The cat is not the pet that is out, so the badge stays the dog's.
    expect(a.last('avatarUpdated')!.avatar.petName).toBe('Caramelo');

    await a.send({ t: 'perk', action: 'pet', pet: null });
    expect(a.s.profile!.petNames).toEqual({ dog: 'Caramelo', cat: 'Pipoca' });
    expect(a.last('avatarUpdated')!.avatar.pet).toBeNull();
    expect(a.last('avatarUpdated')!.avatar.petName).toBeNull();

    await a.send({ t: 'perk', action: 'pet', pet: 'cat' });
    expect(b.last('avatarUpdated')!.avatar).toMatchObject({ pet: 'cat', petName: 'Pipoca' });
  });

  it('rejects a word-filter hit without rewriting it, and does not ask the model', async () => {
    const scored: string[] = [];
    const model: ToxModel = {
      id: 'fake',
      async score(texts) {
        scored.push(...texts);
        return texts.map(() => zero);
      },
    };
    const safety = new JevModelSafety(new JevStubSafety(), model, { timeoutMs: 50 });
    await safety.ready();
    const { world, moderation } = makeWorld(safety);
    const a = await client(world);
    await a.send({ t: 'perk', action: 'pet', pet: 'dog' });
    await a.send({ t: 'perk', action: 'petName', pet: 'dog', name: '  fuck  ' });
    expect(a.s.profile!.petNames).toBeUndefined();
    expect(JSON.stringify(a.s.profile)).not.toMatch(/fuck/i);
    const err = a.last('error')!;
    expect(err.code).toBe('petName');
    expect(err.pt).toBe(SAFETY_NOTES.profanity.pt);
    expect(err.en).toBe(SAFETY_NOTES.profanity.en);
    expect(moderation.recent(1)[0]).toMatchObject({ kind: 'block', surface: 'profile', text: 'fuck' });
    expect(scored).toEqual([]);
    expect(a.last('avatarUpdated')!.avatar.petName ?? null).toBeNull();
  });

  it('rejects a name the moderation model blocks after the word filter allows it', async () => {
    const model: ToxModel = {
      id: 'fake-block',
      async score(texts) {
        return texts.map((t) => (t === 'Bolinha' ? { ...zero, toxicity: 0.99, obscene: 0.99 } : zero));
      },
    };
    const safety = new JevModelSafety(new JevStubSafety(), model, { timeoutMs: 50 });
    await safety.ready();
    const { world, moderation } = makeWorld(safety);
    const a = await client(world);
    await a.send({ t: 'perk', action: 'pet', pet: 'cat' });
    await a.send({ t: 'perk', action: 'petName', pet: 'cat', name: 'Bolinha' });
    expect(a.s.profile!.petNames).toBeUndefined();
    expect(a.last('error')!.code).toBe('petName');
    expect(a.last('error')!.pt).not.toMatch(/Bolinha|\*/);
    const row = moderation.recent(1)[0];
    expect(row).toMatchObject({ kind: 'block', surface: 'profile', text: 'Bolinha' });
    expect(row?.rules?.some((r) => r.startsWith('jev-model'))).toBe(true);
    // A clean name still saves as typed, through the same stack.
    await a.send({ t: 'perk', action: 'petName', pet: 'cat', name: 'Farofa' });
    expect(a.s.profile!.petNames).toEqual({ cat: 'Farofa' });
  });

  it('holds an under-13 warn the way chat does, and rejects a warn for everyone else too', async () => {
    const hang: ToxModel = { id: 'hang', score: () => new Promise(() => {}) };
    const safety = new JevModelSafety(new JevStubSafety(), hang, { timeoutMs: 20 });
    await safety.ready();
    const { world, moderation } = makeWorld(safety);
    const adult = await client(world, 'Adulta');
    await adult.send({ t: 'perk', action: 'pet', pet: 'dog' });
    await adult.send({ t: 'perk', action: 'petName', pet: 'dog', name: 'pelada' });
    expect(adult.s.profile!.petNames).toBeUndefined();
    expect(adult.last('error')!.code).toBe('petName');
    expect(adult.last('error')!.pt).toMatch(/Pelada|futebol/);
    expect(adult.last('error')!.pt).not.toMatch(/\*/);
    expect(moderation.recent(1)[0]).toMatchObject({ kind: 'warn', text: 'pelada' });

    const kid = await client(world, 'Cris');
    kid.s.under13 = true;
    await kid.send({ t: 'perk', action: 'pet', pet: 'dog' });
    await kid.send({ t: 'perk', action: 'petName', pet: 'dog', name: 'pelada' });
    expect(kid.s.profile!.petNames).toBeUndefined();
    expect(kid.last('error')).toMatchObject({ code: 'petName', pt: ESCALATE_NOTE.pt, en: ESCALATE_NOTE.en });
    expect(moderation.recent(1)[0]).toMatchObject({ kind: 'escalate', surface: 'profile', text: 'pelada', status: 'pending' });
  });

  it('refuses a bad shape and a name with no subscription, and keeps names across expiry', async () => {
    const { world } = makeWorld();
    const a = await client(world);
    await a.send({ t: 'perk', action: 'petName', pet: 'dog', name: 'Rex2' });
    expect(a.last('error')!.code).toBe('petName');
    expect(a.s.profile!.petNames).toBeUndefined();

    revokeTestSubscription(a.s.profile!, clock);
    await a.send({ t: 'perk', action: 'petName', pet: 'dog', name: 'Mel' });
    expect(a.last('error')!.code).toBe('petName');

    grantTestSubscription(a.s.profile!, clock + 1);
    await a.send({ t: 'perk', action: 'pet', pet: 'dog' });
    await a.send({ t: 'perk', action: 'petName', pet: 'dog', name: 'Mel' });
    expect(a.s.profile!.petNames?.dog).toBe('Mel');
    revokeTestSubscription(a.s.profile!, clock + 2);
    expect(a.s.profile!.pet).toBeNull();
    expect(a.s.profile!.petNames?.dog).toBe('Mel');
    grantTestSubscription(a.s.profile!, clock + 3);
    await a.send({ t: 'perk', action: 'pet', pet: 'dog' });
    expect(a.last('avatarUpdated')!.avatar).toMatchObject({ pet: 'dog', petName: 'Mel' });
  });
});
