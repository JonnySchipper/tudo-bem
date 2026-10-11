import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, freshMission, type ClientMsg, type ServerMsg } from '@tudobem/shared';
import { World, type Session } from './world.js';
import { ProfileStore } from './store.js';
import { AuthoredNpcDialogue, InMemoryStudentModel, JevStubSafety, MemoryModerationQueue, PhrasebookGloss } from './services/stubs.js';

// 02:00 UTC on 10-09 is 23:00 on 10-08 in São Paulo (UTC-3) and 11:00 on 10-09 in Tokyo (UTC+9)
let clock = Date.parse('2026-10-09T02:00:00.000Z');

const makeWorld = (store = new ProfileStore(null)) =>
  new World(
    store,
    { safety: new JevStubSafety(), gloss: new PhrasebookGloss(), npc: new AuthoredNpcDialogue(), student: new InMemoryStudentModel(), moderation: new MemoryModerationQueue() },
    { now: () => clock, schedule: () => {} },
  );

let n = 0;
function connect(world: World) {
  const inbox: ServerMsg[] = [];
  const s: Session = world.connect(`d${n++}`, (m) => inbox.push(m), () => {});
  const send = (m: ClientMsg) => world.handle(s, m);
  const last = <T extends ServerMsg['t']>(t: T) => [...inbox].reverse().find((m) => m.t === t) as Extract<ServerMsg, { t: T }> | undefined;
  return { s, inbox, send, last };
}

async function player(world: World, tz?: number) {
  const c = connect(world);
  await c.send(tz === undefined ? { t: 'hello' } : { t: 'hello', tz });
  await c.send({ t: 'createProfile', name: `Dia${n++}`, pronoun: 'ela', appearance: DEFAULT_APPEARANCE });
  await c.send({ t: 'join', room: 'praca' });
  return c;
}

describe('the player day on the server (D1)', () => {
  it('stores the hello offset on the profile, the one field every cap reads', async () => {
    clock = Date.parse('2026-10-09T02:00:00.000Z');
    const world = makeWorld();
    const sp = await player(world, -180);
    expect(sp.s.profile!.escola?.tz).toBe(-180);
    // the kiosk mission the client is sent is keyed on the player's day, not the server's
    expect(sp.last('welcome')!.profile.mission?.date).toBe('2026-10-08');
    const utc = await player(world);
    expect(utc.s.profile!.escola?.tz).toBeUndefined();
    expect(utc.last('welcome')!.profile.mission?.date).toBe('2026-10-09');
  });

  it('a reconnect from a zone that would replay today keeps the stored offset', async () => {
    clock = Date.parse('2026-10-09T02:00:00.000Z');
    const store = new ProfileStore(null);
    const world = makeWorld(store);
    const a = await player(world, 540);
    const token = a.s.profile!.token;
    const back = connect(world);
    await back.send({ t: 'hello', token, tz: -180 });
    expect(back.s.profile!.escola?.tz).toBe(540);
    // once the new zone reaches the same date it is taken
    clock = Date.parse('2026-10-09T05:00:00.000Z');
    const later = connect(world);
    await later.send({ t: 'hello', token, tz: -180 });
    expect(later.s.profile!.escola?.tz).toBe(-180);
  });

  it('the kiosk mission: a UTC key from an older save, ahead of the player day, is today (kept); an earlier key rolls over', async () => {
    clock = Date.parse('2026-10-09T02:00:00.000Z');
    const world = makeWorld();
    const c = await player(world, -180);
    const p = c.s.profile!;
    // finished and paid on the old server (UTC) day 10-09; the player's own day is still 10-08: the same day, not paid twice
    p.mission = { ...freshMission('2026-10-09'), taken: true, steps: { cumprimenta: true, pede: true, monta: true }, rewarded: true };
    await c.send({ t: 'mission', action: 'take' });
    expect(p.mission).toMatchObject({ date: '2026-10-08', taken: true, rewarded: true });
    // an earlier day's mission rolls over
    p.mission = { ...freshMission('2026-10-07'), taken: true, steps: { cumprimenta: true, pede: true, monta: true }, rewarded: true };
    await c.send({ t: 'mission', action: 'take' });
    expect(p.mission).toMatchObject({ date: '2026-10-08', taken: true, rewarded: false, steps: { cumprimenta: false, pede: false, monta: false } });
  });
});
