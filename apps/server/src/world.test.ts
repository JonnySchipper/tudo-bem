import { describe, expect, it, beforeEach } from 'vitest';
import {
  buildGrid,
  CPU_NAMES,
  openMatTiles,
  DEFAULT_APPEARANCE,
  ECONOMY,
  ROLL_RV_WIN,
  isCpuId,
  isWalkable,
  MISSION_REWARD,
  mgBuiltForTray,
  mgPayout,
  mgPerfectBuilt,
  mulberry32,
  ROOMS,
  SCORE_FEEDBACK,
  seatTiles,
  TYPED_MISS_HINT,
  type ServerMsg,
  type ClientMsg,
  type PublicAvatar,
  type Tile,
} from '@tudobem/shared';
import { sanitizeAppearance, World, MG_RESUME_MS, type AccountLink, type Session, type WorldOptions } from './world.js';
import { ProfileStore, type StoredProfile } from './store.js';
import { AuthoredNpcDialogue, MemoryModerationQueue, InMemoryStudentModel, JevStubSafety, PhrasebookGloss } from './services/stubs.js';

let clock = 1_000_000;
const now = () => clock;
const pending: { fn: () => void; at: number }[] = [];
function advance(ms: number) {
  clock += ms;
  for (let guard = 0; guard < 200; guard++) {
    const ready = pending.filter((p) => p.at <= clock);
    if (!ready.length) break;
    for (const p of ready) {
      pending.splice(pending.indexOf(p), 1);
      p.fn();
    }
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
function connectBare(world: World): Client {
  const inbox: ServerMsg[] = [];
  const s = world.connect(`c${n++}`, (m) => inbox.push(m), () => {});
  return {
    s,
    inbox,
    send: (m) => world.handle(s, m),
    last: (t) => [...inbox].reverse().find((m) => m.t === t) as never,
    all: (t) => inbox.filter((m) => m.t === t) as never,
  };
}

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
  await c.send({ t: 'createProfile', name, pronoun, appearance: DEFAULT_APPEARANCE });
  await c.send({ t: 'join', room: 'praca' });
  return c;
}

describe('World', () => {
  beforeEach(() => {
    clock = 1_000_000;
    pending.length = 0;
  });

  it('sanitizes the character-redesign fields and fills them in for older saves', () => {
    const legacy = { body: 'medio', skin: 2, hair: 'curto', hairColor: 1, top: 'camiseta', topColor: 1, bottom: 'calca', bottomColor: 2, shoes: 0 } as const;
    expect(sanitizeAppearance(legacy)).toMatchObject({ face: 'suave', extra: 'nenhum', idle: 'solto' });
    expect(sanitizeAppearance({ ...legacy, face: 'maduro', extra: 'oculos', idle: 'cafe' })).toMatchObject({ face: 'maduro', extra: 'oculos', idle: 'cafe' });
    expect(sanitizeAppearance({ ...legacy, face: 'x' as never, extra: '<b>' as never, idle: 'dance' as never })).toMatchObject({ face: 'suave', extra: 'nenhum', idle: 'solto' });
  });

  it('asks no age questions in the avatar creator (no birth date, no 18+ tick); the name filter still applies', async () => {
    const { world } = makeWorld();
    const inbox: ServerMsg[] = [];
    const s = world.connect('x', (m) => inbox.push(m), () => {});
    await world.handle(s, { t: 'hello' });
    expect(inbox.at(-1)).toEqual({ t: 'needProfile' });
    const base = { t: 'createProfile' as const, name: 'Teste', pronoun: 'ele' as const, appearance: DEFAULT_APPEARANCE };
    await world.handle(s, { ...base, name: 'shit' });
    expect(inbox.at(-1)).toMatchObject({ t: 'error', code: 'name' });
    expect(s.profile).toBeUndefined();
    // Old clients may still send birth / confirm fields; they're ignored and never stored.
    await world.handle(s, { ...base, confirm18: true, birthYear: 2015, birthMonth: 1 } as ClientMsg);
    expect(inbox.at(-1)).toMatchObject({ t: 'welcome' });
    expect(s.profile?.ageGate18).toBe(true);
    expect(JSON.stringify(s.profile)).not.toMatch(/birth|confirm18/i);
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
    expect(esc).toMatchObject({ kind: 'escalate', surface: 'chat', status: 'pending', text: 'aquele preto ali', labels: ['ethnic_review'], rules: ['ethnic-tokens.preto_context'] });
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

  it('Gate A warn on typed Pedido echoes verbatim without advancing or scoring the order', async () => {
    const { world, moderation, student } = makeWorld();
    const a = await client(world);
    await a.send({ t: 'join', room: 'padaria' });
    await a.send({ t: 'scene', action: 'start', npc: 'carlos' });
    const node = a.last('scene')!.view.nodeId;
    const line = 'Essa coxinha tá gostosa!';
    await a.send({ t: 'scene', action: 'type', text: line });
    const scene = a.last('scene')!;
    expect(scene.view.nodeId).toBe(node);
    expect(scene.said).toEqual({ pt: line, en: '' });
    expect(scene.fillTicket).toBe(false);
    expect(scene.notice?.level).toBe('warn');
    expect(scene.lastScore).toBeUndefined();
    expect(student.log.filter((e) => e.channel === 'type').length).toBe(0);
    expect(moderation.recent(3).some((e) => e.kind === 'warn')).toBe(true);
  });

  it('points a typed Pedido rápido miss at Conversa instead of the chip miss line', async () => {
    const { world } = makeWorld();
    const a = await client(world);
    await a.send({ t: 'join', room: 'padaria' });
    await a.send({ t: 'scene', action: 'start', npc: 'carlos' });
    const node = a.last('scene')!.view.nodeId;
    await a.send({ t: 'scene', action: 'type', text: 'Tudo e com voce?' });
    const scene = a.last('scene')!;
    expect(scene.view.nodeId).toBe(node);
    expect(scene.lastScore).toBe(0);
    expect(scene.feedback).toEqual(TYPED_MISS_HINT);
    expect(scene.feedback).not.toEqual(SCORE_FEEDBACK[0]);
    expect(TYPED_MISS_HINT.pt.toLowerCase()).toMatch(/convers/);
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
      await a.send({ t: 'mg', action: 'submit', tray, mods: order.mods, built: mgPerfectBuilt(order) });
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

  it('Pedido rápido daily RV gate: once per America/São_Paulo calendar day', async () => {
    const { world } = makeWorld();
    const a = await client(world, 'Ana', 'ela');

    // First Pedido rápido: should get RV
    await a.send({ t: 'join', room: 'padaria' });
    await a.send({ t: 'scene', action: 'start', npc: 'carlos' });
    for (let i = 0; i < 5; i++) await a.send({ t: 'scene', action: 'choose', chip: 0 });
    const first = a.last('scene')!;
    expect(first.view.end).toBe(true);
    expect(first.payout).toBe(ECONOMY.sceneMax);
    expect(first.dailyBlocked).toBeFalsy();
    const coinsAfterFirst = a.s.profile!.coins;

    // Second Pedido rápido same day: should get 0 RV and dailyBlocked flag
    await a.send({ t: 'scene', action: 'start', npc: 'carlos' });
    for (let i = 0; i < 5; i++) await a.send({ t: 'scene', action: 'choose', chip: 0 });
    const second = a.last('scene')!;
    expect(second.view.end).toBe(true);
    expect(second.payout).toBe(0);
    expect(second.dailyBlocked).toBe(true);
    expect(a.s.profile!.coins).toBe(coinsAfterFirst);
  });

  it('rejects a correct tray without station-built units (no shelf→tray bypass)', async () => {
    const { world } = makeWorld();
    const a = await client(world);
    await a.send({ t: 'join', room: 'padaria' });
    await a.send({ t: 'mg', action: 'start' });
    const order = world.debugOrder(a.s)!;
    clock += 1000;
    await a.send({
      t: 'mg',
      action: 'submit',
      tray: Object.fromEntries(order.lines.map((l) => [l.itemId, l.qty])),
      mods: order.mods,
    });
    expect(a.all('mg').at(-2)).toMatchObject({ phase: 'result', outcome: 'repita' });
    expect(a.s.mg!.repeated).toBe(true);
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
    // Outside the repeat-grace window, an empty tray is the real second miss.
    clock += 1000;
    await a.send({ t: 'mg', action: 'submit', tray: {} });
    expect(a.all('mg').at(-2)).toMatchObject({ phase: 'result', outcome: 'errou' });
    expect(a.all('mg').at(-1)).toMatchObject({ phase: 'order', round: 1 });
  });

  it('mid-order echo does not skip the retry or advance without a ticket', async () => {
    const { world } = makeWorld();
    const a = await client(world);
    await a.send({ t: 'join', room: 'padaria' });
    await a.send({ t: 'mg', action: 'start' });
    for (let r = 0; r < 2; r++) {
      const order = world.debugOrder(a.s)!;
      clock += 1000;
      await a.send({ t: 'mg', action: 'submit', tray: Object.fromEntries(order.lines.map((l) => [l.itemId, l.qty])), mods: order.mods, built: mgPerfectBuilt(order) });
    }
    expect(a.all('mg').at(-1)).toMatchObject({ phase: 'order', round: 2 });
    const mid = world.debugOrder(a.s)!;
    const partial = { [mid.lines[0]!.itemId]: 1 };
    clock += 1000;
    await a.send({ t: 'mg', action: 'submit', tray: partial, built: mgBuiltForTray(mid, partial) });
    expect(a.all('mg').at(-2)).toMatchObject({ phase: 'result', outcome: 'repita', round: 2 });
    expect(a.all('mg').at(-1)).toMatchObject({ phase: 'order', round: 2, repeat: true });

    // Double-click / empty tray in the same beat as the repeat must not burn it.
    await a.send({ t: 'mg', action: 'submit', tray: {} });
    await a.send({ t: 'mg', action: 'submit', tray: partial, built: mgBuiltForTray(mid, partial) });
    expect(world.debugOrder(a.s)!.pt).toBe(mid.pt);
    expect(a.s.mg!.round).toBe(2);
    expect(a.all('mg').at(-1)).toMatchObject({ phase: 'order', round: 2, repeat: true, resync: true });
    expect(a.all('mg').flatMap((m) => (m.phase === 'result' && m.round === 2 ? [m.outcome] : []))).toEqual(['repita']);

    // A real correction still inside the grace window scores and advances with a new ticket.
    clock += 50;
    await a.send({ t: 'mg', action: 'submit', tray: Object.fromEntries(mid.lines.map((l) => [l.itemId, l.qty])), mods: mid.mods, built: mgPerfectBuilt(mid) });
    expect(a.all('mg').filter((m) => m.phase === 'result').at(-1)).toMatchObject({ outcome: 'segunda', round: 2 });
    expect(a.all('mg').at(-1)).toMatchObject({ phase: 'order', round: 3 });
    expect(a.all('mg').at(-1)).not.toMatchObject({ pt: mid.pt });
  });

  it('a timeout in the first instant of a retry does not skip it', async () => {
    const { world } = makeWorld();
    const a = await client(world);
    await a.send({ t: 'join', room: 'padaria' });
    await a.send({ t: 'mg', action: 'start' });
    const pt = world.debugOrder(a.s)!.pt;
    clock += 1000;
    await a.send({ t: 'mg', action: 'submit', tray: {} });
    expect(a.all('mg').at(-2)).toMatchObject({ phase: 'result', outcome: 'repita' });
    clock += 10;
    await a.send({ t: 'mg', action: 'timeout' });
    expect(a.all('mg').some((m) => m.phase === 'result' && m.outcome === 'tempo')).toBe(false);
    expect(a.last('mg')).toMatchObject({ phase: 'order', round: 0, repeat: true, resync: true, pt });
    expect(a.s.mg!.repeated).toBe(true);
  });

  it('a late miss still gets a full retry, then an empty bar advances', async () => {
    const { world } = makeWorld();
    const a = await client(world);
    await a.send({ t: 'join', room: 'padaria' });
    await a.send({ t: 'mg', action: 'start' });
    const order = world.debugOrder(a.s)!;
    clock += order.timeMs + 1_400;
    await a.send({ t: 'mg', action: 'submit', tray: {} });
    expect(a.all('mg').at(-2)).toMatchObject({ phase: 'result', outcome: 'repita' });
    expect(a.all('mg').at(-1)).toMatchObject({ phase: 'order', repeat: true, round: 0 });
    expect(a.all('mg').at(-1)).not.toMatchObject({ resync: true });
    clock += 10;
    await a.send({ t: 'mg', action: 'timeout' });
    expect(a.last('mg')).toMatchObject({ phase: 'order', repeat: true, resync: true });
    expect(a.s.mg!.round).toBe(0);
    clock += order.timeMs;
    await a.send({ t: 'mg', action: 'timeout' });
    expect(a.all('mg').filter((m) => m.phase === 'result').at(-1)).toMatchObject({ outcome: 'tempo' });
    expect(a.last('mg')).toMatchObject({ phase: 'order', round: 1 });
  });

  it('a retry ends on its own if the client never sends the second timeout', async () => {
    const { world } = makeWorld();
    const a = await client(world);
    await a.send({ t: 'join', room: 'padaria' });
    await a.send({ t: 'mg', action: 'start' });
    const order = world.debugOrder(a.s)!;
    clock += 1_000;
    await a.send({ t: 'mg', action: 'submit', tray: {} });
    expect(a.all('mg').at(-2)).toMatchObject({ phase: 'result', outcome: 'repita' });
    expect(a.s.mg!.repeated).toBe(true);
    advance(order.timeMs + 2_000);
    expect(a.all('mg').filter((m) => m.phase === 'result').at(-1)).toMatchObject({ outcome: 'tempo' });
    expect(a.last('mg')).toMatchObject({ phase: 'order', round: 1 });
    expect(a.s.mg!.round).toBe(1);
  });

  it('does not grant another full retry after the round budget', async () => {
    const { world } = makeWorld();
    const a = await client(world);
    await a.send({ t: 'join', room: 'padaria' });
    await a.send({ t: 'mg', action: 'start' });
    const order = world.debugOrder(a.s)!;
    a.s.mg!.repeated = false;
    a.s.mg!.orderAt = clock;
    a.s.mg!.roundStartedAt = clock - (order.timeMs * 2 + 3_001);
    await a.send({ t: 'mg', action: 'timeout' });
    expect(a.all('mg').filter((m) => m.phase === 'result').at(-1)).toMatchObject({ outcome: 'tempo' });
    expect(a.s.mg!.round).toBe(1);
  });

  it('sync during the order gap deals the next ticket', async () => {
    const { world } = makeWorld(16, { mgGapMs: 5_000 });
    const a = await client(world);
    await a.send({ t: 'join', room: 'padaria' });
    await a.send({ t: 'mg', action: 'start' });
    const first = world.debugOrder(a.s)!;
    clock += 1_000;
    await a.send({
      t: 'mg',
      action: 'submit',
      tray: Object.fromEntries(first.lines.map((l) => [l.itemId, l.qty])),
      mods: first.mods,
      built: mgPerfectBuilt(first),
    });
    expect(a.s.mg).toMatchObject({ waiting: true, round: 1 });
    await a.send({ t: 'mg', action: 'sync' });
    expect(a.s.mg?.waiting).toBe(false);
    expect(a.last('mg')).toMatchObject({ phase: 'order', round: 1 });
    expect(world.debugOrder(a.s)!.pt).not.toBe(first.pt);
  });

  it('an early timeout resyncs the same ticket instead of stalling', async () => {
    const { world } = makeWorld();
    const a = await client(world);
    await a.send({ t: 'join', room: 'padaria' });
    await a.send({ t: 'mg', action: 'start' });
    const pt = world.debugOrder(a.s)!.pt;
    await a.send({ t: 'mg', action: 'timeout' });
    expect(a.all('mg').some((m) => m.phase === 'result')).toBe(false);
    expect(a.all('mg').at(-1)).toMatchObject({ phase: 'order', round: 0, resync: true, pt });
    expect(a.s.mg!.round).toBe(0);
    clock += 1000;
    const order = world.debugOrder(a.s)!;
    await a.send({ t: 'mg', action: 'submit', tray: Object.fromEntries(order.lines.map((l) => [l.itemId, l.qty])), mods: order.mods, built: mgPerfectBuilt(order) });
    expect(a.all('mg').at(-1)).toMatchObject({ phase: 'order', round: 1 });
  });

  it('reconnect keeps the repeat grace, then a real tray still advances', async () => {
    const { world } = makeWorld();
    const a = await client(world);
    await a.send({ t: 'join', room: 'padaria' });
    await a.send({ t: 'mg', action: 'start' });
    await a.send({ t: 'mg', action: 'submit', tray: {} });
    const mid = world.debugOrder(a.s)!;
    expect(a.s.mg).toMatchObject({ round: 0, repeated: true });
    const token = a.s.profile!.token;
    world.disconnect(a.s);

    const b = connectBare(world);
    await b.send({ t: 'hello', token });
    await b.send({ t: 'join', room: 'padaria' });
    expect(world.debugOrder(b.s)!.pt).toBe(mid.pt);
    expect(b.last('mg')).toMatchObject({ phase: 'order', round: 0, repeat: true, resync: true, pt: mid.pt });

    // Echo of the empty tray still must not burn the retry.
    await b.send({ t: 'mg', action: 'submit', tray: {} });
    expect(b.s.mg!.round).toBe(0);
    expect(b.s.mg!.repeated).toBe(true);
    expect(b.all('mg').some((m) => m.phase === 'result')).toBe(false);
    expect(b.last('mg')).toMatchObject({ phase: 'order', round: 0, repeat: true, resync: true });

    clock += 50;
    await b.send({
      t: 'mg',
      action: 'submit',
      tray: Object.fromEntries(mid.lines.map((l) => [l.itemId, l.qty])),
      mods: mid.mods,
      built: mgPerfectBuilt(mid),
    });
    expect(b.all('mg').filter((m) => m.phase === 'result').at(-1)).toMatchObject({ outcome: 'segunda', round: 0 });
    expect(b.last('mg')).toMatchObject({ phase: 'order', round: 1 });
    expect(b.last('mg')).not.toMatchObject({ pt: mid.pt });
  });

  it('a dropped connection during the order gap still deals the next ticket once', async () => {
    const { world } = makeWorld(16, { mgGapMs: 5_000 });
    const a = await client(world);
    await a.send({ t: 'join', room: 'padaria' });
    await a.send({ t: 'mg', action: 'start' });
    const first = world.debugOrder(a.s)!;
    clock += 1000;
    await a.send({
      t: 'mg',
      action: 'submit',
      tray: Object.fromEntries(first.lines.map((l) => [l.itemId, l.qty])),
      mods: first.mods,
      built: mgPerfectBuilt(first),
    });
    expect(a.s.mg).toMatchObject({ waiting: true, round: 1 });
    const token = a.s.profile!.token;
    world.disconnect(a.s);
    advance(5_000);

    const b = connectBare(world);
    await b.send({ t: 'hello', token });
    await b.send({ t: 'join', room: 'padaria' });
    expect(b.last('mg')).toMatchObject({ phase: 'order', round: 1 });
    expect(world.debugOrder(b.s)!.pt).not.toBe(first.pt);
    expect(b.s.mg?.waiting).toBe(false);
    const pt = world.debugOrder(b.s)!.pt;
    advance(5_000);
    expect(world.debugOrder(b.s)!.pt).toBe(pt);
    expect(b.all('mg').filter((m) => m.phase === 'order')).toHaveLength(1);
  });

  it('does not resume a ticket after the reconnect window', async () => {
    const { world } = makeWorld();
    const a = await client(world);
    await a.send({ t: 'join', room: 'padaria' });
    await a.send({ t: 'mg', action: 'start' });
    const token = a.s.profile!.token;
    world.disconnect(a.s);
    clock += MG_RESUME_MS + 1;
    const b = connectBare(world);
    await b.send({ t: 'hello', token });
    await b.send({ t: 'join', room: 'padaria' });
    expect(b.all('mg')).toHaveLength(0);
    expect(b.s.mg).toBeUndefined();
  });

  it('mg sync re-sends the open ticket with resync', async () => {
    const { world } = makeWorld();
    const a = await client(world);
    await a.send({ t: 'join', room: 'padaria' });
    await a.send({ t: 'mg', action: 'start' });
    const pt = world.debugOrder(a.s)!.pt;
    a.inbox.length = 0;
    await a.send({ t: 'mg', action: 'sync' });
    expect(a.last('mg')).toMatchObject({ phase: 'order', round: 0, resync: true, pt });
  });

  it('a second hello resumes the open ticket instead of deleting it', async () => {
    const { world } = makeWorld();
    const a = await client(world);
    await a.send({ t: 'join', room: 'padaria' });
    await a.send({ t: 'mg', action: 'start' });
    const pt = world.debugOrder(a.s)!.pt;
    const token = a.s.profile!.token;
    let kicked = false;
    const orig = a.s.close;
    a.s.close = (reason) => {
      kicked = true;
      orig(reason);
    };
    const b = connectBare(world);
    await b.send({ t: 'hello', token });
    expect(kicked).toBe(true);
    expect(a.s.profile).toBeUndefined();
    await b.send({ t: 'join', room: 'padaria' });
    expect(b.last('mg')).toMatchObject({ phase: 'order', round: 0, resync: true, pt });
    expect(world.debugOrder(b.s)!.pt).toBe(pt);
  });

  it('quitting mid-shift pays for points already scored instead of wiping them', async () => {
    const { world } = makeWorld();
    const a = await client(world);
    await a.send({ t: 'join', room: 'padaria' });
    await a.send({ t: 'mg', action: 'start' });
    const before = a.s.profile!.coins;
    const order = world.debugOrder(a.s)!;
    clock += 1000;
    await a.send({
      t: 'mg',
      action: 'submit',
      tray: Object.fromEntries(order.lines.map((l) => [l.itemId, l.qty])),
      mods: order.mods,
      built: mgPerfectBuilt(order),
    });
    expect(a.s.mg).toMatchObject({ round: 1 });
    const points = a.s.mg!.points;
    expect(points).toBeGreaterThan(0);
    await a.send({ t: 'mg', action: 'quit' });
    const end = a.last('mg') as Extract<ServerMsg, { t: 'mg'; phase: 'end' }>;
    expect(end).toMatchObject({ phase: 'end', points, coins: mgPayout(points) });
    expect(a.s.mg).toBeUndefined();
    expect(a.s.profile!.coins).toBe(before + mgPayout(points));
    advance(120_000);
    expect(a.all('mg').filter((m) => m.phase === 'order' && m.round > 1)).toHaveLength(0);
    await a.send({ t: 'mg', action: 'start' });
    expect(a.last('mg')).toMatchObject({ phase: 'order', round: 0 });
    expect(a.s.mg!.points).toBe(0);
  });

  it('quitting before any point does not pay the shift minimum', async () => {
    const { world } = makeWorld();
    const a = await client(world);
    await a.send({ t: 'join', room: 'padaria' });
    await a.send({ t: 'mg', action: 'start' });
    const before = a.s.profile!.coins;
    await a.send({ t: 'mg', action: 'quit' });
    expect(a.all('mg').some((m) => m.phase === 'end')).toBe(false);
    expect(a.last('notice')).toMatchObject({ level: 'info' });
    expect(a.s.mg).toBeUndefined();
    expect(a.s.profile!.coins).toBe(before);
  });

  it('quitting after only misses ends the shift in the open instead of restarting silently', async () => {
    const { world } = makeWorld();
    const a = await client(world);
    await a.send({ t: 'join', room: 'padaria' });
    await a.send({ t: 'mg', action: 'start' });
    const before = a.s.profile!.coins;
    clock += 1000;
    await a.send({ t: 'mg', action: 'submit', tray: {} });
    clock += 1000;
    await a.send({ t: 'mg', action: 'submit', tray: {} });
    expect(a.s.mg).toMatchObject({ round: 1, points: 0 });
    await a.send({ t: 'mg', action: 'quit' });
    expect(a.last('mg')).toMatchObject({ phase: 'end', points: 0, coins: 0 });
    expect(a.s.mg).toBeUndefined();
    expect(a.s.profile!.coins).toBe(before);
    expect(a.s.profile!.tutorial.meveum).toBeFalsy();
  });

  it('missing ticket history still advances to the next order', async () => {
    const { world } = makeWorld();
    const a = await client(world);
    await a.send({ t: 'join', room: 'padaria' });
    await a.send({ t: 'mg', action: 'start' });
    a.s.mg!.served = undefined;
    const order = world.debugOrder(a.s)!;
    clock += 1000;
    await a.send({ t: 'mg', action: 'submit', tray: Object.fromEntries(order.lines.map((l) => [l.itemId, l.qty])), mods: order.mods, built: mgPerfectBuilt(order) });
    expect(a.all('mg').at(-2)).toMatchObject({ phase: 'result', outcome: 'perfeito', round: 0 });
    expect(a.all('mg').at(-1)).toMatchObject({ phase: 'order', round: 1 });
    expect(world.debugOrder(a.s)!.pt.length).toBeGreaterThan(0);
    expect(Array.isArray(a.s.mg!.served)).toBe(true);
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

  const ambianceTilesOk = (roomId: 'praca' | 'academia', map: { spots: Tile[]; doorSpots: Tile[]; entries: Tile[] }) => {
    const room = ROOMS[roomId];
    const grid = buildGrid(room);
    const reserved = new Set([
      `${room.spawn.x},${room.spawn.y}`,
      ...room.portals.flatMap((p) => [`${p.x},${p.y}`, `${p.arrive.x},${p.arrive.y}`]),
      ...room.props.filter((p) => p.interact).map((p) => `${p.interact!.x},${p.interact!.y}`),
      ...room.npcs.map((n) => `${n.interact.x},${n.interact.y}`),
    ]);
    const mat = new Set(openMatTiles(room).map((t) => `${t.x},${t.y}`));
    for (const t of [...map.spots, ...map.doorSpots, ...map.entries]) {
      expect(isWalkable(grid, t.x, t.y), `${roomId} ${t.x},${t.y}`).toBe(true);
      expect(reserved.has(`${t.x},${t.y}`), `${roomId} ${t.x},${t.y}`).toBe(false);
      expect(mat.has(`${t.x},${t.y}`), `${roomId} ${t.x},${t.y} on tatame`).toBe(false);
    }
    for (const s of seatTiles(room)) expect(mat.has(`${s.x},${s.y}`), `${roomId} seat ${s.prop.id} ${s.x},${s.y}`).toBe(false);
  };

  it('keeps every ambiance tile walkable and off doors, spawn and interact tiles', async () => {
    const { PRACA_AMBIANCE, ACADEMIA_AMBIANCE } = await import('@tudobem/shared');
    ambianceTilesOk('praca', PRACA_AMBIANCE);
    ambianceTilesOk('academia', ACADEMIA_AMBIANCE);
  });

  it('fills Academia do Bairro with Verde CPUs outside the player cap (roll queue untouched)', async () => {
    const { world } = ambient();
    const a = connectBare(world);
    await a.send({ t: 'hello' });
    await a.send({ t: 'createProfile', name: 'Rafa', pronoun: 'ele', appearance: DEFAULT_APPEARANCE });
    await a.send({ t: 'join', room: 'academia' });
    const cpus = cpusSeen(a);
    expect(cpus.length).toBeGreaterThanOrEqual(1);
    expect(cpus.length).toBeLessThanOrEqual(6);
    const mat = new Set(openMatTiles(ROOMS.academia).map((t) => `${t.x},${t.y}`));
    for (const c of cpus) {
      expect(c.cpu).toBe(true);
      expect(c.nameplate).toBe('verde');
      expect(CPU_NAMES).toContain(c.name);
      expect(mat.has(`${c.x},${c.y}`), `${c.name} spawned on tatame`).toBe(false);
    }
    const amb = world.stats().ambiance;
    expect(typeof amb).toBe('object');
    expect((amb as Record<string, number>)['academia#1']).toBeGreaterThanOrEqual(1);
    await a.send({ t: 'roll', action: 'queue' });
    expect(a.all('roll').some((m) => m.phase === 'queue' && m.opponent === 'cpu')).toBe(true);
    expect(world.stats().instances['academia#1']).toBe(1);
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
    await a.send({ t: 'mg', action: 'submit', tray: Object.fromEntries(order.lines.map((l) => [l.itemId, l.qty])), mods: order.mods, built: mgPerfectBuilt(order) });
    const m = a.s.profile!.mission!;
    expect(m.steps).toEqual({ cumprimenta: true, pede: true, monta: true });
    expect(m.rewarded).toBe(true);
    expect(a.all('reward').filter((r) => r.amount === MISSION_REWARD && r.reason.pt === 'Missão completa! +25 RV')).toHaveLength(1);
    expect(a.s.profile!.coins).toBe(coins + MISSION_REWARD);

    // A second correct order doesn't pay again.
    const o2 = world.debugOrder(a.s)!;
    clock += 1000;
    await a.send({ t: 'mg', action: 'submit', tray: Object.fromEntries(o2.lines.map((l) => [l.itemId, l.qty])), mods: o2.mods, built: mgPerfectBuilt(o2) });
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

describe('pushProfileById', () => {
  beforeEach(() => {
    clock = 1_000_000;
    pending.length = 0;
  });

  it('sends the stored profile to the live session', async () => {
    const { world } = makeWorld();
    const a = await client(world);
    a.s.profile!.coins = 77;
    world.pushProfileById(a.s.profile!.id);
    expect(a.last('profile')!.profile.coins).toBe(77);
    expect(a.last('profile')!.profile.id).toBe(a.s.profile!.id);
  });

  it('plays a CPU roll in the Academia through queue → duel → end', async () => {
    const { world } = makeWorld(16, {
      rollQueueMs: 0,
      testRollHints: true,
      schedule: (fn) => {
        pending.push({ fn, at: clock });
      },
    });
    const a = await client(world);
    await a.send({ t: 'join', room: 'academia' });
    expect(a.last('roomState')!.room).toBe('academia');
    expect(a.last('roomState')!.instanceName).toMatch(/^Academia do Bairro/);
    const coins0 = a.s.profile!.coins;
    await a.send({ t: 'roll', action: 'queue' });
    expect(a.all('roll').some((m) => m.phase === 'queue')).toBe(true);
    advance(1);
    advance(5000);
    const answerDuel = async (duel: Extract<ServerMsg, { t: 'roll'; phase: 'duel' }>) => {
      const hint = duel.debugCorrect;
      if (duel.puzzle.kind === 'reorder' && Array.isArray(hint)) await a.send({ t: 'roll', action: 'answer', order: hint });
      else await a.send({ t: 'roll', action: 'answer', choice: hint as number });
    };
    let duel = a.all('roll').find((m) => m.phase === 'duel') as Extract<ServerMsg, { t: 'roll'; phase: 'duel' }> | undefined;
    expect(duel).toBeTruthy();
    await answerDuel(duel!);
    for (let i = 0; i < 40 && !a.all('roll').some((m) => m.phase === 'end'); i++) {
      advance(2500);
      const next = a.all('roll').filter((m) => m.phase === 'duel').at(-1) as Extract<ServerMsg, { t: 'roll'; phase: 'duel' }> | undefined;
      if (next && next.round !== duel?.round) {
        duel = next;
        await answerDuel(duel);
      }
    }
    const end = a.last('roll') as Extract<ServerMsg, { t: 'roll'; phase: 'end' }>;
    expect(end?.phase).toBe('end');
    expect(end.rv).toBeGreaterThanOrEqual(5);
    expect(a.s.profile!.bjj?.belt).toBe('branca');
    if (end.winner === 'player') expect(a.s.profile!.coins).toBeGreaterThanOrEqual(coins0 + ROLL_RV_WIN - 1);
  });
});

class FakeAccounts implements AccountLink {
  links = new Map<string, string>();
  profileIdFor(id: string) {
    return this.links.get(id);
  }
  linkProfile(id: string, profileId: string) {
    this.links.set(id, profileId);
  }
}

function connectAs(world: World, accountId?: string) {
  const inbox: ServerMsg[] = [];
  const closed: string[] = [];
  const s = world.connect(`acc${n++}`, (m) => inbox.push(m), (r) => closed.push(r), { accountId });
  return { s, inbox, closed, send: (m: ClientMsg) => world.handle(s, m) };
}

describe('World with email/password accounts', () => {
  beforeEach(() => {
    clock = 1_000_000;
    pending.length = 0;
  });

  it('lets a guest (no session) play with a token avatar that stays unlinked', async () => {
    const accounts = new FakeAccounts();
    const { world } = makeWorld(16, { accounts });
    const guest = connectAs(world);
    await guest.send({ t: 'hello' });
    expect(guest.inbox.at(-1)).toEqual({ t: 'needProfile' });
    await guest.send({ t: 'createProfile', name: 'Visita', pronoun: 'ela', appearance: DEFAULT_APPEARANCE });
    const welcome = guest.inbox.at(-1) as Extract<ServerMsg, { t: 'welcome' }>;
    expect(welcome.t).toBe('welcome');
    await guest.send({ t: 'join', room: 'padaria' });
    expect(guest.inbox.at(-1)).toMatchObject({ t: 'roomState', room: 'padaria' });
    expect(guest.s.profile!.accountId).toBeUndefined();
    expect(accounts.links.size).toBe(0);
    world.disconnect(guest.s);

    const back = connectAs(world);
    await back.send({ t: 'hello', token: welcome.token });
    expect(back.inbox.at(-1)).toMatchObject({ t: 'welcome', profile: { id: welcome.profile.id } });
  });

  it('a guest token never opens an account\'s avatar (e.g. a stale token left after logout)', async () => {
    const accounts = new FakeAccounts();
    const { world } = makeWorld(16, { accounts });
    const owner = connectAs(world, 'acc-1');
    await owner.send({ t: 'hello' });
    await owner.send({ t: 'createProfile', name: 'Jonny', pronoun: 'ele', appearance: DEFAULT_APPEARANCE });
    const { token } = owner.inbox.at(-1) as Extract<ServerMsg, { t: 'welcome' }>;
    world.disconnect(owner.s);

    const sneaky = connectAs(world);
    await sneaky.send({ t: 'hello', token });
    expect(sneaky.inbox.at(-1)).toEqual({ t: 'needProfile' });
    expect(sneaky.s.profile).toBeUndefined();
  });

  it('a guest who creates an account keeps the same avatar and RV', async () => {
    const accounts = new FakeAccounts();
    const { world } = makeWorld(16, { accounts });
    const guest = connectAs(world);
    await guest.send({ t: 'hello' });
    await guest.send({ t: 'createProfile', name: 'Visita', pronoun: 'ela', appearance: DEFAULT_APPEARANCE });
    const { token, profile } = guest.inbox.at(-1) as Extract<ServerMsg, { t: 'welcome' }>;
    guest.s.profile!.coins = 42;
    world.disconnect(guest.s);

    const signedUp = connectAs(world, 'acc-new');
    await signedUp.send({ t: 'hello', token });
    expect(signedUp.inbox.at(-1)).toMatchObject({ t: 'welcome', profile: { id: profile.id, coins: 42 } });
    expect(accounts.links.get('acc-new')).toBe(profile.id);
  });

  it('creates the avatar for the account, then finds it on the next visit', async () => {
    const accounts = new FakeAccounts();
    const { world } = makeWorld(16, { accounts });
    const a = connectAs(world, 'acc-1');
    await a.send({ t: 'hello' });
    expect(a.inbox.at(-1)).toEqual({ t: 'needProfile' });
    await a.send({ t: 'createProfile', name: 'Jonny', pronoun: 'ele', appearance: DEFAULT_APPEARANCE });
    expect(a.inbox.at(-1)).toMatchObject({ t: 'welcome' });
    const id = a.s.profile!.id;
    expect(accounts.links.get('acc-1')).toBe(id);
    expect(a.s.profile!.accountId).toBe('acc-1');
    expect(JSON.stringify(a.inbox.at(-1))).not.toContain('acc-1');
    world.disconnect(a.s);

    const again = connectAs(world, 'acc-1');
    await again.send({ t: 'hello' });
    expect(again.inbox.at(-1)).toMatchObject({ t: 'welcome', profile: { id, name: 'Jonny' } });
  });

  it('lets a pre-accounts browser claim its old avatar once, by token', async () => {
    const accounts = new FakeAccounts();
    const { world } = makeWorld(16, { accounts });
    const legacy: StoredProfile = {
      ...(await client(makeWorld().world, 'Antiga')).s.profile!,
    };
    world.store.add(legacy);

    const owner = connectAs(world, 'acc-owner');
    await owner.send({ t: 'hello', token: legacy.token });
    expect(owner.inbox.at(-1)).toMatchObject({ t: 'welcome', profile: { id: legacy.id } });
    expect(accounts.links.get('acc-owner')).toBe(legacy.id);
    world.disconnect(owner.s);

    const thief = connectAs(world, 'acc-other');
    await thief.send({ t: 'hello', token: legacy.token });
    expect(thief.inbox.at(-1)).toEqual({ t: 'needProfile' });
    expect(thief.s.profile).toBeUndefined();
  });

  it('logout closes every socket of that account', async () => {
    const accounts = new FakeAccounts();
    const { world } = makeWorld(16, { accounts });
    const a = connectAs(world, 'acc-1');
    await a.send({ t: 'hello' });
    await a.send({ t: 'createProfile', name: 'Jonny', pronoun: 'ele', appearance: DEFAULT_APPEARANCE });
    await a.send({ t: 'join', room: 'praca' });
    const other = connectAs(world, 'acc-2');
    world.dropAccount('acc-1');
    expect(a.closed).toEqual(['logout']);
    expect(other.closed).toEqual([]);
    expect(world.stats().players).toBe(0);
  });
});

describe('Idle kick', () => {
  beforeEach(() => {
    clock = 1_000_000;
    pending.length = 0;
  });

  const MIN = 60_000;

  it('warns at 14 min and kicks at 15 min with no real input, freeing the seat', async () => {
    const { world } = makeWorld(2);
    const a = await client(world, 'Parado');
    const b = await client(world, 'Beto', 'ele');
    let closed: string | null = null;
    a.s.close = (r) => (closed = r);
    expect(world.stats().instances['praca#1']).toBe(2);

    for (let t = 25_000; t < 14 * MIN; t += 25_000) {
      clock += 25_000;
      await a.send({ t: 'ping' });
      await a.send({ t: 'hello', token: a.s.profile!.token });
      await b.send({ t: 'active' });
      world.sweepIdle();
    }
    expect(a.all('idleWarning')).toHaveLength(0);
    clock += 15_000;
    world.sweepIdle();
    const warn = a.last('idleWarning')!;
    expect(warn.msLeft).toBeLessThanOrEqual(MIN);
    expect(warn.pt).toMatch(/Ainda tá aí\?/);
    world.sweepIdle();
    expect(a.all('idleWarning')).toHaveLength(1);

    clock += MIN;
    world.sweepIdle();
    expect(a.last('kicked')).toMatchObject({ reason: 'idle', pt: expect.stringContaining('15 minutos') });
    expect(closed).toBe('idle');
    expect(a.s.profile).toBeUndefined();
    expect(world.stats().instances['praca#1']).toBe(1);
    expect(b.last('avatarLeft')).toMatchObject({ id: expect.any(String) });
    expect(b.s.profile).toBeTruthy();
  });

  it('real input (move, chat, UI activity) resets the clock; client timers do not', async () => {
    const { world } = makeWorld();
    const a = await client(world);
    let closed: string | null = null;
    a.s.close = (r) => (closed = r);

    clock += 10 * MIN;
    await a.send({ t: 'move', x: 8, y: 6 });
    clock += 10 * MIN;
    await a.send({ t: 'chat', text: 'Oi, tudo bem?' });
    clock += 10 * MIN;
    await a.send({ t: 'active' });
    clock += 10 * MIN;
    world.sweepIdle();
    expect(closed).toBeNull();

    await a.send({ t: 'mg', action: 'timeout' });
    await a.send({ t: 'roll', action: 'timeout' });
    clock += 5 * MIN;
    world.sweepIdle();
    expect(closed).toBe('idle');
  });

  it('input after the warning cancels it', async () => {
    const { world } = makeWorld();
    const a = await client(world);
    let closed: string | null = null;
    a.s.close = (r) => (closed = r);
    clock += 14.5 * MIN;
    world.sweepIdle();
    expect(a.all('idleWarning')).toHaveLength(1);
    // A late sweep still reads as the calm nominal "1 minuto", while msLeft carries the exact figure.
    expect(a.last('idleWarning')).toMatchObject({ msLeft: 0.5 * MIN, pt: expect.stringContaining('Em 1 minuto') });
    await a.send({ t: 'active' });
    clock += 1 * MIN;
    world.sweepIdle();
    expect(closed).toBeNull();
    clock += 13 * MIN;
    world.sweepIdle();
    expect(a.all('idleWarning')).toHaveLength(2);
    expect(closed).toBeNull();
  });

  it('ignores sockets that are still on the login / avatar screen', async () => {
    const { world } = makeWorld();
    const bare = connectBare(world);
    let closed = false;
    bare.s.close = () => (closed = true);
    clock += 60 * MIN;
    world.sweepIdle();
    expect(closed).toBe(false);
  });

  it('honors a custom idle window', async () => {
    const { world } = makeWorld(16, { idleKickMs: 90_000 });
    const a = await client(world);
    let closed: string | null = null;
    a.s.close = (r) => (closed = r);
    clock += 45_000;
    world.sweepIdle();
    expect(a.last('idleWarning')?.pt).toMatch(/45 segundos/);
    clock += 45_000;
    world.sweepIdle();
    expect(closed).toBe('idle');
  });
});
