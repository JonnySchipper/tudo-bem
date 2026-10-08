import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, npcAvatarId, type ClientMsg, type ServerMsg } from '@tudobem/shared';
import { AcademyStore } from './academyStore.js';
import { academyFileAdapter } from './fileStore.js';
import { closeDatabase, openDatabase } from './sqliteDb.js';
import { World } from './world.js';
import { ProfileStore } from './store.js';
import { AuthoredNpcDialogue, InMemoryStudentModel, JevStubSafety, MemoryModerationQueue, PhrasebookGloss } from './services/stubs.js';

function makeWorld(academies = new AcademyStore(null)) {
  const world = new World(
    new ProfileStore(null),
    {
      safety: new JevStubSafety(),
      gloss: new PhrasebookGloss(),
      npc: new AuthoredNpcDialogue(),
      student: new InMemoryStudentModel(),
      moderation: new MemoryModerationQueue(),
    },
    { academies, now: () => 1_700_000_000_000 },
  );
  return { world, academies };
}

let n = 0;
function connect(world: World) {
  const inbox: ServerMsg[] = [];
  const s = world.connect(`c${n++}`, (m) => inbox.push(m), () => {});
  const c = {
    s,
    inbox,
    send: (m: ClientMsg) => world.handle(s, m),
    last: <T extends ServerMsg['t']>(t: T) => [...inbox].reverse().find((m) => m.t === t) as Extract<ServerMsg, { t: T }> | undefined,
  };
  return c;
}

async function player(world: World, name: string, wins = 0) {
  const c = connect(world);
  await c.send({ t: 'hello' });
  await c.send({ t: 'createProfile', name, pronoun: 'ela', appearance: DEFAULT_APPEARANCE });
  c.s.profile!.bjj = { belt: 'branca', stripes: 0, wins, unlocked: ['collar_tie'] };
  await c.send({ t: 'join', room: 'academia' });
  return c;
}

const look = { crest: 'ipe' as const, giColor: 'azul' as const, giStamp: 'estrela' as const };

describe('player academy elevator', () => {
  it('walks elevator → empty floor → fund (brown) → member gi, and keeps guests and white belts out of it', async () => {
    const { world } = makeWorld();
    const founder = await player(world, 'Bia', 140);
    const guest = await player(world, 'Ana', 0);
    expect(guest.last('roomState')).toMatchObject({ room: 'academia' });
    expect(guest.last('roomState')!.avatars.some((a) => a.id === npcAvatarId('prof'))).toBe(true);
    expect(guest.last('roomState')!.academy).toBeUndefined();

    await guest.send({ t: 'academy', action: 'directory' });
    expect(guest.last('academy')).toMatchObject({ phase: 'directory', canFound: false, rows: [] });
    await guest.send({ t: 'academy', action: 'found', name: 'Academia Ipê', ...look });
    expect(guest.last('error')).toMatchObject({ code: 'belt' });
    expect(guest.last('roomState')!.room).toBe('academia');

    await founder.send({ t: 'academy', action: 'directory' });
    expect(founder.last('academy')).toMatchObject({ phase: 'directory', canFound: true, ownedId: null });
    await founder.send({ t: 'academy', action: 'found', name: 'Academia Ipê', ...look });
    const floor = founder.last('roomState')!;
    expect(floor.room).toBe('andar');
    expect(floor.instanceId.startsWith('andar@')).toBe(true);
    expect(floor.academy).toMatchObject({
      name: 'Academia Ipê',
      crest: 'ipe',
      giColor: 'azul',
      giStamp: 'estrela',
      size: 1,
      member: true,
      owner: true,
      fees: { pt: 'Grátis' },
      cup: { pt: 'Sem copa' },
    });
    expect(floor.avatars.filter((a) => a.npc || a.cpu)).toEqual([]);
    const self = floor.avatars.find((a) => a.id === founder.s.profile!.id)!;
    expect(self.academyGi).toEqual({ color: 'azul', stamp: 'estrela' });
    expect(self.belt).toBe('marrom');

    await guest.send({ t: 'academy', action: 'visit', id: floor.academy!.id });
    const visit = guest.last('roomState')!;
    expect(visit.room).toBe('andar');
    expect(visit.instanceId).toBe(floor.instanceId);
    const guestAv = visit.avatars.find((a) => a.id === guest.s.profile!.id)!;
    expect(guestAv.academyGi).toBeUndefined();
    expect(guestAv.gi).toBe(false);
    expect(visit.academy).toMatchObject({ member: false, size: 1 });

    guest.s.profile!.giOwned = true;
    await guest.send({ t: 'academy', action: 'visit', id: floor.academy!.id });
    const ownedGi = guest.last('roomState')!.avatars.find((a) => a.id === guest.s.profile!.id)!;
    expect(ownedGi.gi).toBe(true);
    expect(ownedGi.academyGi).toBeUndefined();
    expect(ownedGi.belt).toBe('branca');

    await guest.send({ t: 'academy', action: 'join', id: floor.academy!.id });
    const joined = guest.last('roomState')!;
    expect(joined.avatars.find((a) => a.id === guest.s.profile!.id)!.academyGi).toEqual({ color: 'azul', stamp: 'estrela' });
    expect(joined.academy).toMatchObject({ member: true, size: 2 });

    await guest.send({ t: 'academy', action: 'leave', id: floor.academy!.id });
    const left = [...guest.inbox].reverse().find((m) => m.t === 'avatarUpdated' && m.avatar.id === guest.s.profile!.id);
    expect(left?.t).toBe('avatarUpdated');
    if (left?.t === 'avatarUpdated') {
      expect(left.avatar.academyGi).toBeUndefined();
      expect(left.avatar.gi).toBe(true);
    }
    const floorMsg = guest.last('academy');
    expect(floorMsg).toMatchObject({ phase: 'floor', academy: { member: false, size: 1 } });

    await founder.send({ t: 'join', room: 'academia' });
    const back = founder.last('roomState')!;
    expect(back.room).toBe('academia');
    expect(back.academy).toBeUndefined();
    expect(back.avatars.some((a) => a.id === npcAvatarId('prof'))).toBe(true);
    expect(back.avatars.find((a) => a.id === founder.s.profile!.id)!.academyGi).toBeUndefined();
  });

  it('keeps the name first-come and ignores a belt that the wins do not earn', async () => {
    const { world } = makeWorld();
    const a = await player(world, 'Lia', 140);
    const b = await player(world, 'Teo', 300);
    a.s.profile!.bjj = { belt: 'marrom', stripes: 4, wins: 3, unlocked: ['collar_tie'] };
    await a.send({ t: 'academy', action: 'found', name: 'Academia Ipê', ...look });
    expect(a.last('error')?.code).toBe('belt');

    a.s.profile!.bjj = { belt: 'branca', stripes: 0, wins: 140, unlocked: ['collar_tie'] };
    await a.send({ t: 'academy', action: 'found', name: 'Academia Ipê', ...look });
    expect(a.last('roomState')!.room).toBe('andar');
    await b.send({ t: 'academy', action: 'found', name: 'academia ipe', ...look });
    expect(b.last('error')).toMatchObject({ code: 'name' });
    await a.send({ t: 'join', room: 'academia' });
    await a.send({ t: 'academy', action: 'found', name: 'Outra', crest: 'folha', giColor: 'verde', giStamp: 'folha' });
    expect(a.last('error')).toMatchObject({ code: 'owned' });
  });

  it('refuses the elevator outside Academia do Bairro and decor on the player floor', async () => {
    const { world } = makeWorld();
    const a = await player(world, 'Nanda', 140);
    await a.send({ t: 'join', room: 'praca' });
    await a.send({ t: 'academy', action: 'directory' });
    expect(a.last('error')).toMatchObject({ code: 'academy' });
    await a.send({ t: 'join', room: 'academia' });
    await a.send({ t: 'academy', action: 'found', name: 'Folha', crest: 'folha', giColor: 'verde', giStamp: 'folha' });
    expect(a.last('roomState')!.room).toBe('andar');
    await a.send({ t: 'furniture', action: 'place', itemId: 'cadeira_madeira', x: 3, y: 3, rot: 0 });
    expect(a.last('error')).toMatchObject({ code: 'furniture' });
  });

  it('saves the academy across a restart', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-academies-'));
    const store = new AcademyStore(academyFileAdapter(dir));
    const { world } = makeWorld(store);
    const a = await player(world, 'Rosa', 140);
    await a.send({ t: 'academy', action: 'found', name: 'Sol', crest: 'sol', giColor: 'amarelo', giStamp: 'sol' });
    const id = a.last('roomState')!.academy!.id;
    expect((openDatabase(dir).prepare('SELECT COUNT(*) AS n FROM academies').get() as { n: number }).n).toBe(1);

    const again = new AcademyStore(academyFileAdapter(dir));
    expect(again.get(id)).toMatchObject({ name: 'Sol', crest: 'sol', giColor: 'amarelo', giStamp: 'sol', ownerId: a.s.profile!.id });
    const { world: next } = makeWorld(again);
    const b = await player(next, 'Caio', 0);
    await b.send({ t: 'academy', action: 'directory' });
    const rows = b.last('academy');
    expect(rows && rows.t === 'academy' && rows.phase === 'directory' && rows.rows.map((r) => r.name)).toEqual(['Sol']);
    closeDatabase(dir);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
