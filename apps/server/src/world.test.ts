import { describe, expect, it, beforeEach } from 'vitest';
import { buildGrid, CPU_NAMES, DEFAULT_APPEARANCE, ECONOMY, isCpuId, isWalkable, MISSION_REWARD, mulberry32, ROOMS, type ServerMsg, type ClientMsg, type PublicAvatar } from '@tudobem/shared';
import { World, type Session, type WorldOptions } from './world.js';
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

function makeWorld(cap = 16, extra: Partial<WorldOptions> = {}) {
  const moderation = new MemoryModerationQueue();
  const student = new InMemoryStudentModel();
  const world = new World(
    new ProfileStore(null),
    { safety: new JevStubSafety(), gloss: new PhrasebookGloss(), npc: new AuthoredNpcDialogue(), student, moderation },
    { roomCap: cap, mgGapMs: 0, now, schedule: (fn, ms) => pending.push({ fn, at: clock + ms }), ...extra },
  );
  return { world, moderation, student };
}

/** Advance in 1 s steps so the CPU tick loop (which reschedules itself) keeps running. */
function run(ms: number) {
  for (let t = 0; t < ms; t += 1000) advance(1000);
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
    await a.send({ t: 'chat', text: 'aquele preto ali' });
    expect(b.all('chat').length).toBe(before);
    const esc = moderation.recent(1)[0];
    expect(esc).toMatchObject({ kind: 'escalate', surface: 'chat', status: 'pending', text: 'aquele preto ali', rules: ['slurs.preto'] });
    expect(esc.toxicity).toBeGreaterThan(0);
  });

  it('runs typed Carlos replies through safety and logs Jev NPC-reply answers', async () => {
    const { world, moderation, student } = makeWorld();
    const a = await client(world);
    await a.send({ t: 'join', room: 'padaria' });
    await a.send({ t: 'scene', action: 'start', npc: 'carlos' });
    const node = a.last('scene')!.view.nodeId;
    await a.send({ t: 'scene', action: 'type', text: 'Me vê uma cerveja' });
    expect(a.last('notice')!.level).toBe('block');
    expect(a.last('scene')!.view.nodeId).toBe(node);
    expect(moderation.recent(1)[0]).toMatchObject({ kind: 'block', surface: 'npc_reply', labels: ['prohibited_substance'] });
    await a.send({ t: 'scene', action: 'type', text: 'Bom dia, Seu Carlos!' });
    expect(student.log.at(-1)).toMatchObject({ channel: 'type', score: 3, jev: { constitution_ok: true, language: 'pt' } });
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

describe('Praça ambiance CPUs + daily kiosk (Live Ops Phase 0)', () => {
  beforeEach(() => {
    clock = 1_000_000;
    pending.length = 0;
  });
  const ambient = (cap = 16, seed = 7) => makeWorld(cap, { ambiance: true, rng: mulberry32(seed) });
  /** CPUs a client currently knows about, rebuilt from its inbox. */
  const cpusSeen = (c: Client) => {
    const live = new Map<string, PublicAvatar>();
    for (const m of c.inbox) {
      if (m.t === 'roomState') {
        live.clear();
        for (const a of m.avatars) if (a.cpu) live.set(a.id, a);
      } else if (m.t === 'avatarJoined' && m.avatar.cpu) live.set(m.avatar.id, m.avatar);
      else if (m.t === 'avatarLeft') live.delete(m.id);
    }
    return [...live.values()];
  };
  const fromCpu = (m: ServerMsg) => ('id' in m && typeof m.id === 'string' && isCpuId(m.id)) || (m.t === 'avatarJoined' && !!m.avatar.cpu);

  it('is off unless the host turns it on (LIVEOPS_CPU_AMBIANCE)', async () => {
    const { world } = makeWorld();
    const a = await client(world);
    run(5000);
    expect(cpusSeen(a)).toHaveLength(0);
    expect(world.stats().ambiance).toBe('off');
  });

  it('fills an empty praça with Verde CPUs named from the Curriculum allowlist', async () => {
    const { world } = ambient();
    const a = await client(world);
    const cpus = cpusSeen(a);
    expect(cpus.length).toBeGreaterThanOrEqual(4);
    expect(cpus.length).toBeLessThanOrEqual(6);
    expect(CPU_NAMES).toHaveLength(48);
    for (const c of cpus) {
      expect(isCpuId(c.id)).toBe(true);
      expect(c.nameplate).toBe('verde');
      expect(CPU_NAMES).toContain(c.name);
      expect(c.name).not.toMatch(/\s/);
    }
    expect(new Set(cpus.map((c) => c.name)).size).toBe(cpus.length);
    expect(cpus.filter((c) => c.sitting).length).toBeGreaterThan(cpus.length / 2);
    expect(world.stats().instances['praca#1']).toBe(1);
  });

  it('CPUs sit outside the player cap: two players fit a cap-2 instance alongside them', async () => {
    const { world } = ambient(2);
    const a = await client(world, 'Ana');
    const b = await client(world, 'Beto', 'ele');
    const c = await client(world, 'Caio', 'ele');
    expect(a.last('roomState')!.instanceId).toBe('praca#1');
    expect(b.last('roomState')!.instanceId).toBe('praca#1');
    expect(b.last('roomState')!.avatars.filter((x) => x.cpu).length).toBeGreaterThan(0);
    expect(b.last('roomState')!.cap).toBe(2);
    expect(c.last('roomState')!.instanceId).toBe('praca#2');
  });

  it('thins out as players arrive, and never follows anyone into the Padaria or a Kitnet', async () => {
    const { world } = ambient();
    const players: Client[] = [];
    for (let i = 0; i < 9; i++) players.push(await client(world, `Gente${String.fromCharCode(65 + i)}`));
    run(60_000);
    expect(cpusSeen(players[0]).length).toBeLessThanOrEqual(1);
    await players[0].send({ t: 'join', room: 'padaria' });
    expect(players[0].last('roomState')!.avatars.some((x) => x.cpu)).toBe(false);
    await players[1].send({ t: 'join', room: 'kitnet' });
    expect(players[1].last('roomState')!.avatars.some((x) => x.cpu)).toBe(false);
    const mark = players[0].inbox.length;
    run(10_000);
    expect(players[0].inbox.slice(mark).some(fromCpu)).toBe(false);
  });

  it('CPUs never chat: over a long session they only join, walk, leave and wave', async () => {
    const { world } = ambient(16, 3);
    const a = await client(world);
    await a.send({ t: 'move', x: 8, y: 6 });
    run(180_000);
    const msgs = a.inbox.filter(fromCpu);
    expect(msgs.some((m) => m.t === 'avatarMoved')).toBe(true);
    for (const m of msgs) expect(['avatarJoined', 'avatarMoved', 'emote', 'avatarLeft']).toContain(m.t);
    for (const m of msgs) if (m.t === 'emote') expect(m.kind).toBe('oi');
    expect(a.all('chat').filter((m) => isCpuId(m.id))).toEqual([]);
  });

  it('keeps every ambiance tile walkable and off doors, spawn and interact tiles', async () => {
    const { PRACA_AMBIANCE } = await import('@tudobem/shared');
    const room = ROOMS.praca;
    const grid = buildGrid(room);
    const reserved = new Set([
      `${room.spawn.x},${room.spawn.y}`,
      ...room.portals.flatMap((p) => [`${p.x},${p.y}`, `${p.arrive.x},${p.arrive.y}`]),
      ...room.props.filter((p) => p.interact).map((p) => `${p.interact!.x},${p.interact!.y}`),
      ...room.npcs.map((n) => `${n.interact.x},${n.interact.y}`),
    ]);
    for (const t of [...PRACA_AMBIANCE.spots, ...PRACA_AMBIANCE.doorSpots, ...PRACA_AMBIANCE.entries]) {
      expect(isWalkable(grid, t.x, t.y), `${t.x},${t.y}`).toBe(true);
      expect(reserved.has(`${t.x},${t.y}`), `${t.x},${t.y}`).toBe(false);
    }
  });

  it('a CPU gets up when a player heads for its bench', async () => {
    const { world } = ambient();
    const a = await client(world);
    const sitter = cpusSeen(a).find((c) => c.sitting)!;
    expect(sitter).toBeTruthy();
    await a.send({ t: 'move', x: sitter.x, y: sitter.y, sit: true });
    const moved = a.all('avatarMoved').filter((m) => m.id === sitter.id).at(-1)!;
    expect(moved).toBeTruthy();
    expect(moved.path.at(-1)).not.toEqual({ x: sitter.x, y: sitter.y });
    run(15_000);
    expect(a.s.profile!.tutorial.sentar).toBe(true);
    const b = await client(world, 'Beto', 'ele');
    const onBench = b.last('roomState')!.avatars.filter((x) => x.x === sitter.x && x.y === sitter.y);
    expect(onBench.map((x) => x.cpu ?? false)).toEqual([false]);
  });

  it('daily kiosk Set A: take mission → Cumprimenta → Pede → Monta pays 25 RV once', async () => {
    const { world } = ambient();
    const a = await client(world, 'Ana', 'ela');
    expect(a.last('welcome')!.profile.mission).toMatchObject({ taken: false, rewarded: false });

    // Greeting before taking the mission doesn't count.
    await a.send({ t: 'emote', kind: 'oi' });
    expect(a.s.profile!.mission?.steps.cumprimenta ?? false).toBe(false);

    await a.send({ t: 'join', room: 'padaria' });
    await a.send({ t: 'mission', action: 'take' });
    expect(a.last('error')!.code).toBe('mission');
    await a.send({ t: 'join', room: 'praca' });
    await a.send({ t: 'mission', action: 'take' });
    expect(a.last('profile')!.profile.mission!.taken).toBe(true);

    // Nobody but CPUs around: waving at them counts.
    await a.send({ t: 'emote', kind: 'oi' });
    expect(a.last('profile')!.profile.mission!.steps.cumprimenta).toBe(true);
    expect(a.last('notice')!.pt).toBe('✓ Cumprimenta alguém na praça');

    await a.send({ t: 'join', room: 'padaria' });
    await a.send({ t: 'scene', action: 'start', npc: 'carlos' });
    for (let i = 0; i < 5; i++) await a.send({ t: 'scene', action: 'choose', chip: 0 });
    expect(a.s.profile!.mission!.steps.pede).toBe(true);

    const coins = a.s.profile!.coins;
    await a.send({ t: 'mg', action: 'start' });
    const order = world.debugOrder(a.s)!;
    clock += 1000;
    await a.send({ t: 'mg', action: 'submit', tray: Object.fromEntries(order.lines.map((l) => [l.itemId, l.qty])), mods: order.mods });
    const m = a.s.profile!.mission!;
    expect(m.steps).toEqual({ cumprimenta: true, pede: true, monta: true });
    expect(m.rewarded).toBe(true);
    expect(a.all('reward').filter((r) => r.amount === MISSION_REWARD && r.reason.pt === 'Missão completa! +25 RV')).toHaveLength(1);
    expect(a.s.profile!.coins).toBe(coins + MISSION_REWARD);

    // A second correct order doesn't pay again.
    const o2 = world.debugOrder(a.s)!;
    clock += 1000;
    await a.send({ t: 'mg', action: 'submit', tray: Object.fromEntries(o2.lines.map((l) => [l.itemId, l.qty])), mods: o2.mods });
    expect(a.all('reward').filter((r) => r.amount === MISSION_REWARD).length).toBe(1);
  });

  it('greeting in chat counts only with company, and yesterday’s mission resets', async () => {
    const { world } = makeWorld();
    const a = await client(world, 'Ana');
    await a.send({ t: 'mission', action: 'take' });
    await a.send({ t: 'chat', text: 'Oi, gente!' });
    expect(a.s.profile!.mission!.steps.cumprimenta).toBe(false);
    await client(world, 'Beto', 'ele');
    await a.send({ t: 'chat', text: 'Boa tarde!' });
    expect(a.s.profile!.mission!.steps.cumprimenta).toBe(false);
    await a.send({ t: 'chat', text: 'Olá, Beto!' });
    expect(a.s.profile!.mission!.steps.cumprimenta).toBe(true);

    a.s.profile!.mission!.date = '2000-01-01';
    await a.send({ t: 'equipHat', hatId: null });
    expect(a.last('profile')!.profile.mission).toMatchObject({ taken: false, steps: { cumprimenta: false } });
  });
});
