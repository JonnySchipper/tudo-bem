import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, PET_MAX_OWNED, grantTestSubscription, revokeTestSubscription, type ClientMsg, type ServerMsg } from '@tudobem/shared';
import { World, type Session } from './world.js';
import { ProfileStore, normalizeProfile, type StoredProfile } from './store.js';
import { AuthoredNpcDialogue, InMemoryStudentModel, JevStubSafety, MemoryModerationQueue, PhrasebookGloss } from './services/stubs.js';

let clock = 1_000_000;
const pending: { fn: () => void; at: number }[] = [];
function run(ms: number) {
  for (let t = 0; t < ms; t += 250) {
    clock += 250;
    for (const p of pending.filter((q) => q.at <= clock)) {
      pending.splice(pending.indexOf(p), 1);
      p.fn();
    }
  }
}

function makeWorld() {
  return new World(
    new ProfileStore(null),
    { safety: new JevStubSafety(), gloss: new PhrasebookGloss(), npc: new AuthoredNpcDialogue(), student: new InMemoryStudentModel(), moderation: new MemoryModerationQueue() },
    { roomCap: 16, now: () => clock, schedule: (fn, ms) => pending.push({ fn, at: clock + ms }) },
  );
}

interface Client {
  s: Session;
  inbox: ServerMsg[];
  send: (m: ClientMsg) => Promise<void>;
  last: <T extends ServerMsg['t']>(t: T) => Extract<ServerMsg, { t: T }> | undefined;
}

let n = 0;
async function client(world: World, room: 'petshop' | 'praca' = 'petshop'): Promise<Client> {
  const inbox: ServerMsg[] = [];
  const s = world.connect(`p${n++}`, (m) => inbox.push(m), () => {});
  const c: Client = { s, inbox, send: (m) => world.handle(s, m), last: (t) => [...inbox].reverse().find((m) => m.t === t) as never };
  await c.send({ t: 'hello' });
  await c.send({ t: 'createProfile', name: `Pet${n++}`, pronoun: 'ela', appearance: DEFAULT_APPEARANCE });
  await c.send({ t: 'join', room });
  return c;
}

async function walkTo(c: Client, x: number, y: number) {
  await c.send({ t: 'move', x, y });
  run(20_000);
}

const p = (c: Client) => c.s.profile! as StoredProfile;
const lastErr = (c: Client) => c.last('error');

describe('Pet Shop do Seu Dito on the server (#234)', () => {
  beforeEach(() => {
    clock = 1_000_000;
    pending.length = 0;
  });

  it('adoption needs a subscription and the shop; a comp works; the name is moderated', async () => {
    const world = makeWorld();
    const a = await client(world);
    await walkTo(a, 2, 3);
    await a.send({ t: 'pet', action: 'adopt', breed: 'vira_lata_caramelo', coat: 'caramelo', name: 'Paçoca' });
    expect(lastErr(a)?.code).toBe('petshop');
    expect(p(a).pets ?? []).toHaveLength(0);

    grantTestSubscription(p(a), clock);
    await a.send({ t: 'pet', action: 'adopt', breed: 'vira_lata_caramelo', coat: 'caramelo', name: 'Rex2' });
    expect(lastErr(a)?.code).toBe('petName');
    expect(p(a).pets ?? []).toHaveLength(0);

    await a.send({ t: 'pet', action: 'adopt', breed: 'vira_lata_caramelo', coat: 'caramelo', name: 'Paçoca' });
    expect(p(a).pets).toHaveLength(1);
    expect(p(a).pets![0]).toMatchObject({ breed: 'vira_lata_caramelo', name: 'Paçoca' });
    expect(p(a).activePetId).toBe(p(a).pets![0]!.id);
    expect(a.last('petshop')).toMatchObject({ phase: 'adopted' });
    expect(a.last('avatarUpdated')!.avatar).toMatchObject({ pet: 'dog', petName: 'Paçoca', petBreed: 'vira_lata_caramelo', petCoat: 'caramelo' });
    // unknown breeds and coats are ignored
    await a.send({ t: 'pet', action: 'adopt', breed: 'nope', coat: 'x', name: '' });
    expect(p(a).pets).toHaveLength(1);
  });

  it('refuses from far away, caps at six, switches the active pet, and a lapse keeps every pet at home', async () => {
    const world = makeWorld();
    const a = await client(world);
    grantTestSubscription(p(a), clock);
    await a.send({ t: 'pet', action: 'adopt', breed: 'siames', coat: 'seal', name: '' });
    expect(lastErr(a)?.code).toBe('petshop'); // at the door, too far from the counter
    await walkTo(a, 2, 3);
    for (let i = 0; i < PET_MAX_OWNED; i++) await a.send({ t: 'pet', action: 'adopt', breed: 'siames', coat: 'seal', name: '' });
    expect(p(a).pets).toHaveLength(PET_MAX_OWNED);
    await a.send({ t: 'pet', action: 'adopt', breed: 'siames', coat: 'seal', name: '' });
    expect(p(a).pets).toHaveLength(PET_MAX_OWNED);
    expect(lastErr(a)?.pt).toMatch(/matilha/);

    const first = p(a).pets![0]!.id;
    await a.send({ t: 'pet', action: 'active', petId: first });
    expect(p(a).activePetId).toBe(first);
    await a.send({ t: 'pet', action: 'active', petId: null });
    expect(p(a).activePetId).toBeNull();
    expect(a.last('avatarUpdated')!.avatar.pet).toBeNull();

    await a.send({ t: 'pet', action: 'active', petId: first });
    revokeTestSubscription(p(a), clock);
    world.syncEntitlements(p(a).id);
    expect(p(a).pets).toHaveLength(PET_MAX_OWNED);
    // the pet shows no more, and cannot be taken out again
    expect(a.last('avatarUpdated')!.avatar.pet).toBeNull();
    await a.send({ t: 'pet', action: 'active', petId: first });
    expect(lastErr(a)?.code).toBe('petshop');
  });

  it('the lojinha: in the shop, near the counter, earned RV; equip the right kind only', async () => {
    const world = makeWorld();
    const a = await client(world);
    p(a).coins = 25;
    await a.send({ t: 'pet', action: 'buy', itemId: 'coleira_vermelha' });
    expect(lastErr(a)?.pt).toMatch(/balcão/);
    await walkTo(a, 2, 3);
    await a.send({ t: 'pet', action: 'buy', itemId: 'coleira_vermelha' });
    expect(p(a).coins).toBe(17);
    expect(p(a).petItems).toEqual(['coleira_vermelha']);
    await a.send({ t: 'pet', action: 'buy', itemId: 'caminha_cesta' });
    expect(lastErr(a)?.code).toBe('coins');
    await a.send({ t: 'pet', action: 'buy', itemId: 'saco_racao' });
    expect(p(a).furniture.saco_racao).toBe(1);
    // the atelier does not sell the shop's pieces
    await a.send({ t: 'buy', kind: 'furniture', itemId: 'caminha_azul' } as ClientMsg);
    expect(p(a).furniture.caminha_azul).toBeUndefined();

    grantTestSubscription(p(a), clock);
    await a.send({ t: 'pet', action: 'adopt', breed: 'labrador', coat: 'preto', name: '' });
    const id = p(a).pets![0]!.id;
    await a.send({ t: 'pet', action: 'equip', petId: id, slot: 'toy', itemId: 'coleira_vermelha' });
    expect(p(a).pets![0]!.toy).toBeNull();
    await a.send({ t: 'pet', action: 'equip', petId: id, slot: 'collar', itemId: 'coleira_vermelha' });
    expect(p(a).pets![0]!.collar).toBe('coleira_vermelha');
    expect(a.last('avatarUpdated')!.avatar.petCollar).toBe('coleira_vermelha');
  });

  it('a carinho is free, near the pen, once per animal per visit, and earns its line', async () => {
    const world = makeWorld();
    const a = await client(world);
    await a.send({ t: 'pet', action: 'carinho', penId: 'cercadinho', slot: 0 });
    expect(a.last('npcSay')).toBeUndefined();
    await walkTo(a, 7, 2);
    await a.send({ t: 'pet', action: 'carinho', penId: 'cercadinho', slot: 0 });
    const said = a.last('npcSay')!;
    expect(said).toMatchObject({ npc: 'dito' });
    expect(said.anchor).toMatch(/^dito\.pen_dog_[123]$/);
    const count = a.inbox.filter((m) => m.t === 'npcSay').length;
    await a.send({ t: 'pet', action: 'carinho', penId: 'cercadinho', slot: 0 });
    expect(a.inbox.filter((m) => m.t === 'npcSay').length).toBe(count);
    await a.send({ t: 'pet', action: 'carinho', penId: 'cercadinho', slot: 9 });
    expect(a.inbox.filter((m) => m.t === 'npcSay').length).toBe(count);
  });

  it('the kitnet shows the resting pets, and re-sends them when one goes out', async () => {
    const world = makeWorld();
    const a = await client(world);
    grantTestSubscription(p(a), clock);
    await walkTo(a, 2, 3);
    await a.send({ t: 'pet', action: 'adopt', breed: 'labrador', coat: 'preto', name: '' });
    await a.send({ t: 'pet', action: 'adopt', breed: 'persa', coat: 'branco', name: '' });
    await a.send({ t: 'join', room: 'kitnet' });
    const rs = a.last('roomState')!;
    expect(rs.homePets).toHaveLength(1);
    expect(rs.homePets![0]!.look.shape).toBe('grande');
    await a.send({ t: 'pet', action: 'active', petId: null });
    expect(a.last('homePets')!.pets).toHaveLength(2);
  });

  it('the old Cachorro / Gato button still gives the caramelo and the orange cat; an old save migrates on load', async () => {
    const world = makeWorld();
    const a = await client(world, 'praca');
    grantTestSubscription(p(a), clock);
    await a.send({ t: 'perk', action: 'pet', pet: 'cat' });
    expect(p(a).pets).toMatchObject([{ id: 'legacy_cat', breed: 'gato_laranja' }]);
    expect(a.last('avatarUpdated')!.avatar).toMatchObject({ pet: 'cat', petBreed: 'gato_laranja' });

    // a captured pre-#234 profile: a named dog out, a named cat at home
    const old = { ...p(a), pets: undefined, activePetId: undefined, petItems: undefined, pet: 'dog', petNames: { dog: 'Caramelo', cat: 'Mel' } } as unknown as StoredProfile;
    normalizeProfile(old);
    expect(old.pets!.map((q) => [q.id, q.name])).toEqual([['legacy_dog', 'Caramelo'], ['legacy_cat', 'Mel']]);
    expect(old.activePetId).toBe('legacy_dog');
    const again = JSON.stringify(normalizeProfile(JSON.parse(JSON.stringify(old)) as StoredProfile).pets);
    expect(again).toBe(JSON.stringify(old.pets));
  });
});
