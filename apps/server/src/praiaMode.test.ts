import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, type ClientMsg, type ServerMsg } from '@tudobem/shared';
import { World, type Session } from './world.js';
import { ProfileStore } from './store.js';
import { memoryPraia } from './praiaStore.js';
import { AuthoredNpcDialogue, InMemoryStudentModel, JevStubSafety, MemoryModerationQueue, PhrasebookGloss } from './services/stubs.js';

let clock = 1_000_000;
const now = () => clock;

function makeWorld(raw?: unknown) {
  return new World(
    new ProfileStore(null),
    { safety: new JevStubSafety(), gloss: new PhrasebookGloss(), npc: new AuthoredNpcDialogue(), student: new InMemoryStudentModel(), moderation: new MemoryModerationQueue() },
    { now, schedule: () => {}, praia: memoryPraia(raw) },
  );
}

let n = 0;
async function client(world: World) {
  const inbox: ServerMsg[] = [];
  const s: Session = world.connect(`p${n++}`, (m) => inbox.push(m), () => {});
  const send = (m: ClientMsg) => world.handle(s, m);
  await send({ t: 'hello' });
  await send({ t: 'createProfile', name: `Bia${n}`, pronoun: 'ela', appearance: DEFAULT_APPEARANCE });
  const last = <T extends ServerMsg['t']>(t: T) => [...inbox].reverse().find((m) => m.t === t) as Extract<ServerMsg, { t: T }> | undefined;
  return { s, inbox, send, last };
}

describe('the Praia on the server (PRAIA-PLAN.md 1.1, 1.2)', () => {
  beforeEach(() => {
    clock = 1_000_000;
  });

  it('the 875 bus goes from Rua dos Ipês to the beach and back', async () => {
    const world = makeWorld();
    const c = await client(world);
    world.join(c.s, 'rua_leste', {}, { tile: { x: 5, y: 13 }, dir: 'SW' });
    await c.send({ t: 'portal', portalId: 'rua_praia' });
    expect(c.last('roomState')?.room).toBe('praia');
    await c.send({ t: 'portal', portalId: 'praia_vila' });
    expect(c.last('roomState')?.room).toBe('rua_leste');
  });

  it('a closed beach refuses the bus and the map, and an admin closing it walks everyone back to the Vila', async () => {
    const world = makeWorld();
    const c = await client(world);
    await c.send({ t: 'join', room: 'praia' });
    expect(c.last('roomState')?.room).toBe('praia');
    world.setPraia({ mode: 'closed' });
    expect(c.last('praia')).toMatchObject({ mode: 'closed', allowed: false });
    expect(c.last('roomState')?.room).toBe('rua_leste');
    await c.send({ t: 'join', room: 'praia' });
    expect(c.last('error')).toMatchObject({ code: 'praia', pt: 'A praia ainda não abriu.' });
    expect(c.last('roomState')?.room).toBe('rua_leste');
    await c.send({ t: 'portal', portalId: 'rua_praia' });
    expect(c.last('roomState')?.room).toBe('rua_leste');
    world.setPraia({ mode: 'open' });
    expect(c.last('praia')).toMatchObject({ mode: 'open', allowed: true });
    await c.send({ t: 'join', room: 'praia' });
    expect(c.last('roomState')?.room).toBe('praia');
  });

  it('a stored closed switch is told on sign-in, and a remembered beach lands at the Vila bus stop', async () => {
    const world = makeWorld({ mode: 'closed', partyBoat: false });
    const c = await client(world);
    expect(c.last('praia')).toMatchObject({ mode: 'closed', partyBoat: false, allowed: false });
    await c.send({ t: 'join', room: 'praia' });
    expect(c.last('roomState')?.room).toBe('rua_leste');
  });

  it('the in-game admin door sets the mode and the party boat; a bad mode is refused', async () => {
    const world = makeWorld();
    const c = await client(world);
    c.s.admin = true;
    await c.send({ t: 'admin', action: 'praiaSet', partyBoat: false });
    expect(world.praia.config()).toEqual({ mode: 'open', partyBoat: false });
    await c.send({ t: 'admin', action: 'praiaSet', mode: 'nope' as never });
    expect(c.last('error')?.code).toBe('admin');
    expect(world.praia.config().mode).toBe('open');
    c.s.admin = false;
    await c.send({ t: 'admin', action: 'praiaSet', mode: 'closed' });
    expect(world.praia.config().mode).toBe('open');
  });
});
