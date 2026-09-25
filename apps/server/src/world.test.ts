import { describe, expect, it, beforeEach } from 'vitest';
import { DEFAULT_APPEARANCE, ECONOMY, type ServerMsg, type ClientMsg } from '@tudobem/shared';
import { World, type Session } from './world.js';
import { ProfileStore } from './store.js';
import { AuthoredNpcDialogue, MemoryModerationQueue, InMemoryStudentModel, JevStubSafety, PhrasebookGloss } from './services/stubs.js';

let clock = 1_000_000;
const now = () => clock;
const pending: { fn: () => void; at: number }[] = [];
function advance(ms: number) {
  clock += ms;
  for (const p of pending.splice(0)) {
    if (p.at <= clock) p.fn();
    else pending.push(p);
  }
}

function makeWorld(cap = 16) {
  const moderation = new MemoryModerationQueue();
  const world = new World(
    new ProfileStore(null),
    { safety: new JevStubSafety(), gloss: new PhrasebookGloss(), npc: new AuthoredNpcDialogue(), student: new InMemoryStudentModel(), moderation },
    { roomCap: cap, mgGapMs: 0, now, schedule: (fn, ms) => pending.push({ fn, at: clock + ms }) },
  );
  return { world, moderation };
}

interface Client {
  s: Session;
  inbox: ServerMsg[];
  send: (m: ClientMsg) => Promise<void>;
  last: <T extends ServerMsg['t']>(t: T) => Extract<ServerMsg, { t: T }> | undefined;
  all: <T extends ServerMsg['t']>(t: T) => Extract<ServerMsg, { t: T }>[];
}

let n = 0;
async function client(world: World, name = `Ana${n++}`, pronoun: 'ele' | 'ela' | 'nome' = 'ela'): Promise<Client> {
  const inbox: ServerMsg[] = [];
  const s = world.connect(`c${n++}`, (m) => inbox.push(m), () => {});
  const c: Client = {
    s,
    inbox,
    send: (m) => world.handle(s, m),
    last: (t) => [...inbox].reverse().find((m) => m.t === t) as never,
    all: (t) => inbox.filter((m) => m.t === t) as never,
  };
  await c.send({ t: 'hello' });
  await c.send({ t: 'createProfile', name, pronoun, appearance: DEFAULT_APPEARANCE, birthYear: 2000, birthMonth: 1, confirm18: true });
  await c.send({ t: 'join', room: 'praca' });
  return c;
}

describe('World', () => {
  beforeEach(() => {
    clock = 1_000_000;
    pending.length = 0;
  });

  it('enforces the 18+ age gate, explicit adult confirmation, and name filter', async () => {
    const { world } = makeWorld();
    const inbox: ServerMsg[] = [];
    const s = world.connect('x', (m) => inbox.push(m), () => {});
    const now = new Date();
    const year = now.getFullYear();
    const base = { t: 'createProfile' as const, name: 'Teste', pronoun: 'ele' as const, appearance: DEFAULT_APPEARANCE, birthMonth: 1, confirm18: true };
    for (const age of [10, 13, 16, 17]) {
      await world.handle(s, { ...base, birthYear: year - age - 1, birthMonth: 12 });
      expect(inbox.at(-1), `age ${age}`).toMatchObject({ t: 'error', code: 'age_gate' });
    }
    // Turns 18 later this year → still 17 today.
    if (now.getMonth() < 11) {
      await world.handle(s, { ...base, birthYear: year - 18, birthMonth: 12 });
      expect(inbox.at(-1)).toMatchObject({ t: 'error', code: 'age_gate' });
    }
    await world.handle(s, { ...base, birthYear: 1990, confirm18: false });
    expect(inbox.at(-1)).toMatchObject({ t: 'error', code: 'age_confirm' });
    await world.handle(s, { ...base, birthYear: 1990, name: 'shit' });
    expect(inbox.at(-1)).toMatchObject({ t: 'error', code: 'name' });
    expect(s.profile).toBeUndefined();
    await world.handle(s, { ...base, birthYear: year - 18, birthMonth: 1 });
    expect(inbox.at(-1)).toMatchObject({ t: 'welcome' });
    expect(s.profile?.ageGate18).toBe(true);
  });

  it('makes profiles from the old 13+ policy sign up again', async () => {
    const { world } = makeWorld();
    const a = await client(world, 'Legacy');
    const token = a.s.profile!.token;
    delete (a.s.profile as unknown as Record<string, unknown>).ageGate18;
    const inbox: ServerMsg[] = [];
    const s = world.connect('y', (m) => inbox.push(m), () => {});
    await world.handle(s, { t: 'hello', token });
    expect(inbox.at(-1)).toMatchObject({ t: 'needProfile' });
  });

  it('places the 17th player in a new instance (cap 16)', async () => {
    const { world } = makeWorld(16);
    const clients: Client[] = [];
    for (let i = 0; i < 17; i++) clients.push(await client(world, `Pessoa${String.fromCharCode(65 + i)}`));
    const ids = clients.map((c) => c.last('roomState')!.instanceId);
    expect(ids.slice(0, 16).every((id) => id === 'praca#1')).toBe(true);
    expect(ids[16]).toBe('praca#2');
    expect(clients[16].last('roomState')!.instanceName).toBe('Praça Central · Sul');
  });

  it('broadcasts chat verbatim with gloss, warns without rewriting, blocks PII + alcohol', async () => {
    const { world, moderation } = makeWorld();
    const a = await client(world, 'Ana');
    const b = await client(world, 'Beto', 'ele');
    await a.send({ t: 'chat', text: 'Oi, tudo bem?' });
    const got = b.last('chat')!;
    expect(got.text).toBe('Oi, tudo bem?');
    expect(got.gloss).toMatch(/hi/i);
    await a.send({ t: 'chat', text: 'bora jogar uma pelada?' });
    expect(b.last('chat')!.text).toBe('bora jogar uma pelada?');
    expect(b.last('chat')!.action).toBe('warn');
    expect(a.last('notice')!.level).toBe('warn');
    expect(moderation.recent(5).some((e) => e.kind === 'warn')).toBe(true);
    const before = b.all('chat').length;
    await a.send({ t: 'chat', text: 'bora tomar uma cerveja' });
    expect(b.all('chat').length).toBe(before);
    await a.send({ t: 'chat', text: 'me liga 11 98765-4321' });
    expect(b.all('chat').length).toBe(before);
    expect(a.last('notice')!.level).toBe('block');
    expect(moderation.recent(5).some((e) => e.labels.includes('pii'))).toBe(true);
  });

  it('rate-limits chat', async () => {
    const { world } = makeWorld();
    const a = await client(world);
    for (let i = 0; i < 8; i++) await a.send({ t: 'chat', text: `oi ${i}` });
    expect(a.all('chat').length).toBe(5);
  });

  it('plays the whole Phase 0 path: Carlos → Me vê um… → hat → kitnet chair', async () => {
    const { world } = makeWorld();
    const a = await client(world, 'Ana', 'ela');
    const start = a.s.profile!.coins;

    // Walk + sit + wave in the praça
    await a.send({ t: 'move', x: 7, y: 7, sit: true });
    advance(5_000);
    expect(a.s.profile!.tutorial.sentar).toBe(true);
    await a.send({ t: 'emote', kind: 'oi' });
    await a.send({ t: 'chat', text: 'Bom dia, pessoal!' });

    // Enter padaria through the door
    await a.send({ t: 'move', x: 5, y: 0 });
    advance(60_000);
    await a.send({ t: 'portal', portalId: 'praca_padaria' });
    expect(a.last('roomState')!.room).toBe('padaria');

    // Carlos scene with best chips
    await a.send({ t: 'scene', action: 'start', npc: 'carlos' });
    expect(a.last('scene')!.view.line.pt).toBe('Bom dia! Tudo bem?');
    for (let i = 0; i < 5; i++) await a.send({ t: 'scene', action: 'choose', chip: 0 });
    const endScene = a.last('scene')!;
    expect(endScene.view.end).toBe(true);
    expect(endScene.payout).toBe(ECONOMY.sceneMax);

    // Me vê um… — answer every order correctly using the server's order (test hook)
    await a.send({ t: 'mg', action: 'start' });
    for (let r = 0; r < 6; r++) {
      const order = world.debugOrder(a.s)!;
      const tray = Object.fromEntries(order.lines.map((l) => [l.itemId, l.qty]));
      clock += 1000;
      await a.send({ t: 'mg', action: 'submit', tray, mods: order.mods });
    }
    const end = a.last('mg') as Extract<ServerMsg, { t: 'mg'; phase: 'end' }>;
    expect(end.phase).toBe('end');
    expect(end.coins).toBe(ECONOMY.minigameMax);

    // Back to praça, buy + equip a hat
    await a.send({ t: 'join', room: 'praca' });
    await a.send({ t: 'buy', kind: 'hat', itemId: 'boina_vermelha' });
    expect(a.s.profile!.hat).toBe('boina_vermelha');

    // Kitnet: place the starter chair
    await a.send({ t: 'join', room: 'kitnet' });
    expect(a.last('roomState')!.ownerId).toBe(a.s.profile!.id);
    await a.send({ t: 'furniture', action: 'place', itemId: 'cadeira_madeira', x: 3, y: 4, rot: 0 });
    expect(a.last('furnitureState')!.furniture).toHaveLength(1);

    const p = a.s.profile!;
    expect(Object.values(p.tutorial).every(Boolean)).toBe(true);
    expect(p.tutorialRewarded).toBe(true);
    expect(p.coins).toBe(start + ECONOMY.sceneMax + ECONOMY.minigameMax - 12 + ECONOMY.tutorialBonus);
  });

  it('Carlos repeats once on a wrong tray, then moves on', async () => {
    const { world } = makeWorld();
    const a = await client(world);
    await a.send({ t: 'join', room: 'padaria' });
    await a.send({ t: 'mg', action: 'start' });
    await a.send({ t: 'mg', action: 'submit', tray: {} });
    const mgs = a.all('mg');
    expect(mgs.at(-2)).toMatchObject({ phase: 'result', outcome: 'repita' });
    expect(mgs.at(-1)).toMatchObject({ phase: 'order', repeat: true, round: 0 });
    await a.send({ t: 'mg', action: 'submit', tray: {} });
    expect(a.all('mg').at(-2)).toMatchObject({ phase: 'result', outcome: 'errou' });
    expect(a.all('mg').at(-1)).toMatchObject({ phase: 'order', round: 1 });
  });

  it('refuses to buy without coins and only decorates your own kitnet', async () => {
    const { world } = makeWorld();
    const a = await client(world, 'Ana');
    const b = await client(world, 'Beto', 'ele');
    await a.send({ t: 'buy', kind: 'hat', itemId: 'cartola' });
    expect(a.last('error')!.code).toBe('coins');
    expect(a.s.profile!.hats).not.toContain('cartola');

    // Not friends yet → cannot visit
    await b.send({ t: 'join', room: 'kitnet', ownerId: a.s.profile!.id });
    expect(b.last('error')!.code).toBe('join');

    await a.send({ t: 'friend', action: 'request', targetId: b.s.profile!.id });
    expect(b.last('friendRequest')!.fromName).toBe('Ana');
    await b.send({ t: 'friend', action: 'accept', targetId: a.s.profile!.id });
    expect(a.s.profile!.friends).toContain(b.s.profile!.id);

    await a.send({ t: 'join', room: 'kitnet' });
    await b.send({ t: 'join', room: 'kitnet', ownerId: a.s.profile!.id });
    expect(b.last('roomState')!.ownerName).toBe('Ana');
    await b.send({ t: 'furniture', action: 'place', itemId: 'cadeira_madeira', x: 3, y: 3, rot: 0 });
    expect(b.last('error')!.code).toBe('furniture');
  });

  it('free hats cost nothing and parrot hint has a cooldown', async () => {
    const { world } = makeWorld();
    const a = await client(world);
    const coins = a.s.profile!.coins;
    await a.send({ t: 'buy', kind: 'hat', itemId: 'bone_verde' });
    expect(a.s.profile!.coins).toBe(coins);
    await a.send({ t: 'parrot', action: 'adopt' });
    await a.send({ t: 'parrot', action: 'hint' });
    expect(a.last('parrotHint')!.word.pt).toBeTruthy();
    await a.send({ t: 'parrot', action: 'hint' });
    expect(a.last('notice')!.en).toMatch(/resting/);
  });
});
