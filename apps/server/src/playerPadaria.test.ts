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
