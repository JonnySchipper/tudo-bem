import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, REPORT_LIMITS, type ClientMsg, type ServerMsg } from '@tudobem/shared';
import { World, type CloseReason, type Session } from './world.js';
import { ProfileStore } from './store.js';
import { AuthoredNpcDialogue, InMemoryStudentModel, JevStubSafety, MemoryModerationQueue, PhrasebookGloss } from './services/stubs.js';
import { moderationRows, ReportLimiter, snapshotLines } from './playerModeration.js';

let clock = 1_000_000;
const now = () => clock;

function makeWorld() {
  const moderation = new MemoryModerationQueue();
  const store = new ProfileStore(null);
  const world = new World(
    store,
    { safety: new JevStubSafety(), gloss: new PhrasebookGloss(), npc: new AuthoredNpcDialogue(), student: new InMemoryStudentModel(), moderation },
    { roomCap: 16, now, schedule: () => {}, adminPassword: 'tb-admin-praca' },
  );
  return { world, moderation, store };
}

interface Client {
  s: Session;
  inbox: ServerMsg[];
  closed: CloseReason[];
  send: (m: ClientMsg) => Promise<void>;
  all: <T extends ServerMsg['t']>(t: T) => Extract<ServerMsg, { t: T }>[];
  last: <T extends ServerMsg['t']>(t: T) => Extract<ServerMsg, { t: T }> | undefined;
  id: string;
}

let n = 0;
function bare(world: World): Client {
  const inbox: ServerMsg[] = [];
  const closed: CloseReason[] = [];
  const s = world.connect(`m${n++}`, (m) => inbox.push(m), (r) => closed.push(r));
  return {
    s,
    inbox,
    closed,
    send: (m) => world.handle(s, m),
    all: (t) => inbox.filter((m) => m.t === t) as never,
    last: (t) => [...inbox].reverse().find((m) => m.t === t) as never,
    get id() {
      return s.profile?.id ?? '';
    },
  };
}

async function client(world: World, name: string): Promise<Client> {
  const c = bare(world);
  await c.send({ t: 'hello' });
  await c.send({ t: 'createProfile', name, pronoun: 'ela', appearance: DEFAULT_APPEARANCE });
  await c.send({ t: 'join', room: 'praca' });
  return c;
}

async function admin(world: World) {
  const a = await client(world, 'Admin');
  await a.send({ t: 'admin', action: 'login', password: 'tb-admin-praca' });
  return a;
}

beforeEach(() => {
  clock = 1_000_000;
});

describe('reports', () => {
  it('snapshots the target’s own delivered lines on the server and ignores client-sent text', async () => {
    const { world, moderation } = makeWorld();
    const a = await client(world, 'Ana');
    const b = await client(world, 'Bia');
    await b.send({ t: 'chat', text: 'oi gente' });
    clock += 2_000;
    await a.send({ t: 'chat', text: 'oi Bia' });
    clock += 2_000;
    await b.send({ t: 'chat', text: 'tudo bem?' });
    await a.send({ t: 'report', targetId: b.id, reason: 'spam', text: 'forged words she never said' } as ClientMsg);
    const ev = moderation.recent(10).find((e) => e.kind === 'report')!;
    expect(ev).toMatchObject({ targetId: b.id, targetName: 'Bia', reason: 'spam', lines: ['oi gente', 'tudo bem?'], status: 'pending', playerName: 'Ana' });
    expect(JSON.stringify(ev)).not.toContain('forged');
    expect(a.last('notice')?.en).toMatch(/Thanks/);
  });

  it('falls back to "outro" for an unknown reason and rejects unknown or long-gone targets', async () => {
    const { world, moderation, store } = makeWorld();
    const a = await client(world, 'Ana');
    const b = await client(world, 'Bia');
    await a.send({ t: 'report', targetId: 'nobody-here' });
    expect(a.last('error')).toMatchObject({ code: 'report' });
    await a.send({ t: 'report', targetId: a.id });
    expect(moderation.recent(10).filter((e) => e.kind === 'report')).toHaveLength(0);

    await a.send({ t: 'report', targetId: b.id, reason: 'nonsense' as never });
    expect(moderation.recent(10).at(-1)).toMatchObject({ kind: 'report', reason: 'outro' });

    // Bia leaves and an hour passes: no longer "recently seen".
    const bId = b.id;
    world.disconnect(b.s);
    clock += 60 * 60_000;
    expect(store.get(bId)).toBeTruthy();
    const c = await client(world, 'Caio');
    await c.send({ t: 'report', targetId: bId });
    expect(c.last('error')).toMatchObject({ code: 'report' });
  });

  it('dedupes the same target and caps reports per minute and per day', async () => {
    const { world, moderation } = makeWorld();
    const a = await client(world, 'Ana');
    const targets: Client[] = [];
    for (let i = 0; i < 8; i++) targets.push(await client(world, `Alvo${i}`));
    const reports = () => moderation.recent(1000).filter((e) => e.kind === 'report').length;

    await a.send({ t: 'report', targetId: targets[0]!.id, reason: 'assedio' });
    await a.send({ t: 'report', targetId: targets[0]!.id, reason: 'assedio' });
    expect(reports()).toBe(1);
    expect(a.last('notice')?.en).toMatch(/already reported/);

    for (let i = 1; i < 8; i++) await a.send({ t: 'report', targetId: targets[i]!.id });
    expect(reports()).toBe(REPORT_LIMITS.perMinute);
    expect(a.last('notice')?.en).toMatch(/Too many reports/);

    clock += 61_000;
    await a.send({ t: 'report', targetId: targets[6]!.id });
    expect(reports()).toBe(REPORT_LIMITS.perMinute + 1);
  });

  it('ReportLimiter enforces the daily cap and lets the dedupe window expire', () => {
    const l = new ReportLimiter();
    let t = 0;
    for (let i = 0; i < REPORT_LIMITS.perDay; i++) {
      expect(l.check('r', `t${i}`, t)).toBe('ok');
      l.record('r', `t${i}`, t);
      t += 61_000;
    }
    expect(l.check('r', 'fresh', t)).toBe('daily');
    expect(l.check('r', 't0', REPORT_LIMITS.dedupeMs + 1)).not.toBe('dupe');
    t += 24 * 60 * 60_000;
    expect(l.check('r', 'fresh', t)).toBe('ok');
  });

  it('snapshotLines keeps only the target’s recent lines', () => {
    const log = [
      { playerId: 'x', text: 'old', at: 0 },
      { playerId: 'y', text: 'other', at: 700_000 },
      { playerId: 'x', text: 'new', at: 700_000 },
    ];
    expect(snapshotLines(log, 'x', 700_000)).toEqual(['new']);
    expect(moderationRows([{ kind: 'warn', surface: 'chat', playerId: 'p', playerName: 'P', room: 'r', text: 't', labels: [], at: 1 }], 10)).toHaveLength(1);
  });
});

describe('admin mute / ban', () => {
  it('mute refuses chat politely until it runs out; 0 lifts it', async () => {
    const { world } = makeWorld();
    const a = await admin(world);
    const b = await client(world, 'Bia');
    await a.send({ t: 'admin', action: 'mute', targetId: b.id, minutes: 10 });
    expect(b.last('notice')?.pt).toMatch(/pausado por 10 min/);
    const chatsBefore = a.all('chat').length;
    await b.send({ t: 'chat', text: 'oi' });
    expect(a.all('chat').length).toBe(chatsBefore);
    expect(b.last('notice')).toMatchObject({ level: 'warn', en: expect.stringMatching(/paused for 10 min/) });

    // Survives a reconnect (stored on the profile).
    clock += 5 * 60_000;
    await b.send({ t: 'chat', text: 'oi' });
    expect(b.last('notice')?.en).toMatch(/5 min/);

    await a.send({ t: 'admin', action: 'mute', targetId: b.id, minutes: 0 });
    await b.send({ t: 'chat', text: 'oi de novo' });
    expect(a.last('chat')).toMatchObject({ text: 'oi de novo' });

    await a.send({ t: 'admin', action: 'mute', targetId: b.id, minutes: 3 });
    clock += 3 * 60_000 + 1;
    await b.send({ t: 'chat', text: 'voltei' });
    expect(a.last('chat')).toMatchObject({ text: 'voltei' });
  });

  it('mute needs an admin session', async () => {
    const { world } = makeWorld();
    const a = await client(world, 'Ana');
    const b = await client(world, 'Bia');
    await a.send({ t: 'admin', action: 'mute', targetId: b.id, minutes: 10 });
    expect(a.last('admin')).toMatchObject({ phase: 'auth', ok: false });
    expect(b.s.profile!.mutedUntil).toBeUndefined();
  });

  it('ban kicks with the banned close, refuses the next hello, and unban lets them back', async () => {
    const { world } = makeWorld();
    const a = await admin(world);
    const b = await client(world, 'Bia');
    const token = b.last('welcome')!.token;
    const bId = b.id;
    await a.send({ t: 'admin', action: 'ban', targetId: bId });
    expect(b.last('kicked')).toMatchObject({ reason: 'banned', en: expect.stringMatching(/suspended/) });
    expect(b.closed).toEqual(['banned']);
    expect(a.last('admin')).toMatchObject({ phase: 'banned', banned: [{ id: bId, name: 'Bia' }] });

    const again = bare(world);
    await again.send({ t: 'hello', token });
    expect(again.last('kicked')).toMatchObject({ reason: 'banned' });
    expect(again.closed).toEqual(['banned']);
    expect(again.s.profile).toBeUndefined();

    await a.send({ t: 'admin', action: 'unban', targetId: bId });
    expect(a.last('admin')).toMatchObject({ phase: 'banned', banned: [] });
    const back = bare(world);
    await back.send({ t: 'hello', token });
    expect(back.last('welcome')?.profile.id).toBe(bId);
    // Kick stays a plain kick: rejoin works right away.
    await a.send({ t: 'admin', action: 'kick', targetId: bId });
    const rejoin = bare(world);
    await rejoin.send({ t: 'hello', token });
    expect(rejoin.last('welcome')?.profile.id).toBe(bId);
  });

  it('lists reports for the admin panel', async () => {
    const { world } = makeWorld();
    const a = await admin(world);
    const b = await client(world, 'Bia');
    const c = await client(world, 'Caio');
    await c.send({ t: 'chat', text: 'oi' });
    await b.send({ t: 'report', targetId: c.id, reason: 'linguagem' });
    await a.send({ t: 'admin', action: 'moderation' });
    const m = a.last('admin');
    expect(m).toMatchObject({ phase: 'moderation' });
    if (m?.phase === 'moderation') expect(m.items[0]).toMatchObject({ kind: 'report', targetName: 'Caio', reason: 'linguagem', lines: ['oi'] });
  });
});

describe('block', () => {
  it('hides chat and emotes from blocked players, swallows their friend requests, and unblock restores it', async () => {
    const { world } = makeWorld();
    const a = await client(world, 'Ana');
    const b = await client(world, 'Bia');
    const c = await client(world, 'Caio');
    await a.send({ t: 'block', action: 'block', targetId: b.id });
    expect(a.last('profile')?.profile.blocked).toEqual([b.id]);
    expect(a.last('friends')?.blocked).toEqual([{ id: b.id, name: 'Bia' }]);

    const before = a.inbox.length;
    await b.send({ t: 'chat', text: 'oi Ana' });
    await b.send({ t: 'emote', kind: 'oi' });
    expect(a.inbox.slice(before).filter((m) => m.t === 'chat' || m.t === 'emote')).toEqual([]);
    expect(c.last('chat')).toMatchObject({ text: 'oi Ana' });
    expect(c.last('emote')).toMatchObject({ id: b.id });

    await b.send({ t: 'friend', action: 'request', targetId: a.id });
    expect(a.all('friendRequest')).toEqual([]);
    expect(b.last('notice')?.en).toMatch(/Friend request sent/);

    // Ana can't friend someone she blocked without unblocking.
    await a.send({ t: 'friend', action: 'request', targetId: b.id });
    expect(a.last('error')).toMatchObject({ code: 'friend' });

    await a.send({ t: 'block', action: 'unblock', targetId: b.id });
    expect(a.last('profile')?.profile.blocked).toEqual([]);
    await b.send({ t: 'chat', text: 'e agora?' });
    expect(a.last('chat')).toMatchObject({ text: 'e agora?' });
  });

  it('blocking a friend ends the friendship', async () => {
    const { world } = makeWorld();
    const a = await client(world, 'Ana');
    const b = await client(world, 'Bia');
    await a.send({ t: 'friend', action: 'request', targetId: b.id });
    await b.send({ t: 'friend', action: 'accept', targetId: a.id });
    expect(a.s.profile!.friends).toContain(b.id);
    await a.send({ t: 'block', action: 'block', targetId: b.id });
    expect(a.s.profile!.friends).not.toContain(b.id);
    expect(b.s.profile!.friends).not.toContain(a.id);
  });
});
