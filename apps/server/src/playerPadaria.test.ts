import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, fundarCostRv } from '@tudobem/shared';
import { World, type Session } from './world.js';
import { ProfileStore } from './store.js';
import { PadariaStore } from './padariaStore.js';
import { AuthoredNpcDialogue, InMemoryStudentModel, JevStubSafety, MemoryModerationQueue, PhrasebookGloss } from './services/stubs.js';
import type { ClientMsg, ServerMsg } from '@tudobem/shared';

function makeWorld(padarias = new PadariaStore(null)) {
  return new World(
    new ProfileStore(null),
    { safety: new JevStubSafety(), gloss: new PhrasebookGloss(), npc: new AuthoredNpcDialogue(), student: new InMemoryStudentModel(), moderation: new MemoryModerationQueue() },
    { padarias, padariaOwnership: true, now: () => 1_700_000_000_000, schedule: () => {} },
  );
}

async function player(world: World, name: string, coins: number) {
  const inbox: ServerMsg[] = [];
  const s = world.connect(`p-${name}`, (m) => inbox.push(m), () => {});
  await world.handle(s, { t: 'hello' });
  await world.handle(s, { t: 'createProfile', name, pronoun: 'ela', appearance: DEFAULT_APPEARANCE });
  s.profile!.coins = coins;
  await world.handle(s, { t: 'join', room: 'praca' });
  return {
    s,
    send: (m: ClientMsg) => world.handle(s, m),
    last: <T extends ServerMsg['t']>(t: T) => [...inbox].reverse().find((m) => m.t === t) as Extract<ServerMsg, { t: T }> | undefined,
  };
}

describe('player-owned padaria', () => {
  it('Fundar spends 900 RV and opens an owned instance with Correria allowed', async () => {
    const padarias = new PadariaStore(null);
    const world = makeWorld(padarias);
    const p = await player(world, 'Bia', fundarCostRv());
    await p.send({ t: 'padariaOwn', action: 'door' });
    const door = p.last('padariaOwn')!;
    expect(door.phase).toBe('door');
    if (door.phase === 'door') expect(door.door.canFundar).toBe(true);
    await p.send({ t: 'padariaOwn', action: 'found', name: 'Padaria da Bia' });
    const room = p.last('roomState')!;
    expect(room.instanceId.startsWith('padaria@')).toBe(true);
    expect(room.padaria?.name).toBe('Padaria da Bia');
    expect(p.s.profile!.coins).toBe(0);
    expect(p.s.profile!.hats).toContain('chapeu_padeiro_casa');
    await p.send({ t: 'mg', action: 'start' });
    expect(p.last('mg')?.phase).toBe('state');
  });

  it('a short owner is refused an upgrade and the row stays as it was', async () => {
    const padarias = new PadariaStore(null);
    const world = makeWorld(padarias);
    const p = await player(world, 'Lia', fundarCostRv());
    await p.send({ t: 'padariaOwn', action: 'found', name: 'Padaria da Lia' });
    const row = padarias.ownedBy(p.s.profile!.id)!;
    p.s.profile!.coins = 100;
    await p.send({ t: 'padariaOwn', action: 'upgrade', kind: 'size2' });
    expect(p.last('error')?.code).toBe('coins');
    expect(row.size).toBe(1);
    expect(p.s.profile!.coins).toBe(100);
    p.s.profile!.coins = 1500;
    await p.send({ t: 'padariaOwn', action: 'upgrade', kind: 'size2' });
    expect(row.size).toBe(2);
    expect(p.s.profile!.coins).toBe(0);
    expect(p.last('padariaOwn')).toMatchObject({ phase: 'floor', padaria: { size: 2, sweets: {} } });
    await p.send({ t: 'padariaOwn', action: 'upgrade', kind: 'brigadeiro' });
    expect(p.last('error')?.code).toBe('coins');
    expect(row.sweets.brigadeiro).toBeUndefined();
  });

  it('an owned padaria is its own room: small at the Balcão (Correria with café and pão only), bigger after the Padaria upgrade', async () => {
    const padarias = new PadariaStore(null);
    const world = makeWorld(padarias);
    const p = await player(world, 'Gil', fundarCostRv() + 1500);
    await p.send({ t: 'padariaOwn', action: 'found', name: 'Padaria do Gil' });
    const small = p.s.instance!.def;
    expect([small.cols, small.rows]).toEqual([8, 7]);
    expect(small.npcs).toEqual([]);
    expect(small.props.some((q) => q.id === 'padaria_porta_fundar')).toBe(false);
    await p.send({ t: 'mg', action: 'start' });
    const st = p.last('mg');
    expect(st?.phase === 'state' && [...st.snap.menu].sort()).toEqual(['cafe', 'pao']);
    await p.send({ t: 'mg', action: 'quit' });
    // a guest inside moves into the bigger room with the owner
    const guest = await player(world, 'Ana', 0);
    await guest.send({ t: 'padariaOwn', action: 'visit', id: padarias.ownedBy(p.s.profile!.id)!.id });
    await p.send({ t: 'padariaOwn', action: 'upgrade', kind: 'size2' });
    for (const who of [p, guest]) {
      expect([who.s.instance!.def.cols, who.s.instance!.def.rows]).toEqual([10, 9]);
      expect(who.last('roomState')?.padaria?.size).toBe(2);
    }
    expect(p.s.instance).toBe(guest.s.instance);
    expect(p.s.instance!.members.size).toBe(2);
  });

  it('the profile carries the owned padaria so the client can take the owner home', async () => {
    const world = makeWorld();
    const p = await player(world, 'Rui', fundarCostRv());
    expect(p.last('profile')?.profile.padaria).toBeUndefined();
    await p.send({ t: 'padariaOwn', action: 'found', name: 'Padaria do Rui' });
    expect(p.last('profile')?.profile.padaria).toMatchObject({ name: 'Padaria do Rui', size: 1 });
  });

  it("a visitor's purchase at the house counter goes to the owner's till", async () => {
    const padarias = new PadariaStore(null);
    const world = makeWorld(padarias);
    const owner = await player(world, 'Dona', fundarCostRv() + 1500 + 300);
    await owner.send({ t: 'padariaOwn', action: 'found', name: 'Padaria da Dona' });
    await owner.send({ t: 'padariaOwn', action: 'upgrade', kind: 'size2' });
    const id = padarias.ownedBy(owner.s.profile!.id)!.id;
    const guest = await player(world, 'Leo', 50);
    await guest.send({ t: 'padariaOwn', action: 'visit', id });
    // brigadeiro is not on the menu until the owner buys it
    await guest.send({ t: 'padaria', action: 'buy', itemId: 'brigadeiro' });
    expect(guest.s.profile!.coins).toBe(50);
    await owner.send({ t: 'padariaOwn', action: 'upgrade', kind: 'brigadeiro' });
    expect(owner.s.profile!.coins).toBe(0);
    await guest.send({ t: 'padaria', action: 'buy', itemId: 'brigadeiro' });
    expect(guest.s.profile!.coins).toBe(45);
    expect(owner.s.profile!.coins).toBe(5);
    expect(owner.last('notice')?.pt).toContain('Leo comprou');
  });

  it('the founder hat is earned, never sold at the stall', async () => {
    const world = makeWorld();
    const p = await player(world, 'Ivo', 5000);
    await p.send({ t: 'buy', kind: 'hat', itemId: 'chapeu_padeiro_casa' });
    expect(p.s.profile!.hats).not.toContain('chapeu_padeiro_casa');
    expect(p.s.profile!.coins).toBe(5000);
  });

  it('door cofre opens on the rua facade', async () => {
    const world = makeWorld();
    const p = await player(world, 'Rua', 100);
    await p.send({ t: 'join', room: 'rua' });
    await p.send({ t: 'padariaOwn', action: 'door' });
    const door = p.last('padariaOwn');
    expect(door?.phase).toBe('door');
  });

  it('flag-off keeps shared Correria and disables Fundar UI', async () => {
    const world = new World(
      new ProfileStore(null),
      { safety: new JevStubSafety(), gloss: new PhrasebookGloss(), npc: new AuthoredNpcDialogue(), student: new InMemoryStudentModel(), moderation: new MemoryModerationQueue() },
      { padariaOwnership: false, now: () => 0, schedule: () => {} },
    );
    const p = await player(world, 'Ana', 1000);
    await p.send({ t: 'join', room: 'padaria' });
    await p.send({ t: 'mg', action: 'start' });
    expect(p.last('mg')?.phase).toBe('state');
    await p.send({ t: 'padariaOwn', action: 'door' });
    expect(p.last('error')?.code).toBe('padaria');
  });
});
