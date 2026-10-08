import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  buildGrid,
  CPU_NAMES,
  DIARY_WORDS,
  gameMinutes,
  greetingCap,
  greetingFor,
  openMatTiles,
  DEFAULT_APPEARANCE,
  ECONOMY,
  isCpuId,
  isWalkable,
  MISSION_REWARD,
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
import { serveFront } from './correriaTestKit.js';
import { ProfileStore, normalizeProfile, type StoredProfile } from './store.js';
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
    { roomCap: cap, mgGapMs: 0, testMg: true, now, schedule: (fn, ms) => pending.push({ fn, at: clock + ms }), ...extra },
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

  it('stamps welcome and roomState with serverNow (the game clock reference)', async () => {
    const { world } = makeWorld();
    const c = await client(world, 'Relogio');
    expect(typeof c.last('welcome')?.serverNow).toBe('number');
    expect(typeof c.last('roomState')?.serverNow).toBe('number');
    expect(c.last('welcome')?.serverNow).toBe(clock);
    advance(5_000);
    await c.send({ t: 'join', room: 'padaria' });
    expect(c.last('roomState')?.serverNow).toBe(clock);
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
    await a.send({ t: 'move', x: 11, y: 6, sit: true });
    advance(30_000);
    expect(a.s.profile!.tutorial.sentar).toBe(true);
    await a.send({ t: 'emote', kind: 'oi' });
    await a.send({ t: 'chat', text: 'Bom dia, pessoal!' });

    // Walk off the north edge of the praça: the Rua dos Ipês, then in through the padaria door
    await a.send({ t: 'move', x: 15, y: 0 });
    advance(60_000);
    expect(a.last('roomState')!.room).toBe('rua');
    await a.send({ t: 'move', x: 4, y: 5 });
    advance(60_000);
    await a.send({ t: 'portal', portalId: 'praca_padaria' });
    expect(a.last('roomState')!.room).toBe('padaria');

    // Carlos scene with best chips
    await a.send({ t: 'scene', action: 'start', npc: 'carlos' });
    // the greeting follows the game clock (the test clock is `clock`)
    expect(a.last('scene')!.view.line.pt).toBe(`${greetingCap(greetingFor(gameMinutes(clock)))}! Tudo bem?`);
    for (let i = 0; i < 5; i++) await a.send({ t: 'scene', action: 'choose', chip: 0 });
    const endScene = a.last('scene')!;
    expect(endScene.view.end).toBe(true);
    expect(endScene.payout).toBe(ECONOMY.sceneMax);

    // Me vê um… — play through the shift using the server's order (test hook)
    await a.send({ t: 'mg', action: 'start' });
    for (let r = 0; r < 40 && a.last('mg')!.phase !== 'end'; r++) await serveFront(world, a, advance);
    const end = a.last('mg') as Extract<ServerMsg, { t: 'mg'; phase: 'end' }>;
    expect(end.phase).toBe('end');
    expect(end.end.served).toBeGreaterThan(10);
    expect(end.end.coins).toBeGreaterThanOrEqual(ECONOMY.minigameMin);
    expect(end.end.coins).toBeLessThanOrEqual(ECONOMY.minigameMax);

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
    expect(p.coins).toBe(start + ECONOMY.sceneMax + end.end.coins - 12 + ECONOMY.tutorialBonus);
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

  it('does not sell the baker hat at Nanda’s stall, and keeps a hat someone already owns', async () => {
    const { world } = makeWorld();
    const a = await client(world);
    a.s.profile!.coins = 100;
    await a.send({ t: 'buy', kind: 'hat', itemId: 'chapeu_chef' });
    expect(a.s.profile!.hats).not.toContain('chapeu_chef');
    expect(a.s.profile!.coins).toBe(100);
    await a.send({ t: 'buy', kind: 'hat', itemId: 'chapeu_padeiro_casa' });
    expect(a.s.profile!.hats).not.toContain('chapeu_padeiro_casa');
    expect(a.s.profile!.coins).toBe(100);
    a.s.profile!.hats.push('chapeu_chef');
    await a.send({ t: 'equipHat', hatId: 'chapeu_chef' });
    expect(a.s.profile!.hat).toBe('chapeu_chef');
  });

  it('buying a papagaio colour keeps the ones already owned', async () => {
    const { world } = makeWorld();
    const a = await client(world);
    a.s.profile!.coins = 40;
    await a.send({ t: 'parrot', action: 'adopt' });
    await a.send({ t: 'buy', kind: 'parrot', itemId: 'azul' });
    expect(a.s.profile!.parrotColors).toEqual(['verde', 'azul']);
    expect(a.s.profile!.parrotColor).toBe('azul');
    expect(a.s.profile!.parrotOwned).toBe(true);
    expect(a.s.profile!.parrotEquipped).toBe(true);
    expect(a.s.profile!.coins).toBe(28);
    expect(world.publicAvatar(a.s).parrot).toBe(true);
    expect(world.publicAvatar(a.s).parrotColor).toBe('azul');

    await a.send({ t: 'buy', kind: 'parrot', itemId: 'azul' });
    expect(a.s.profile!.parrotColors).toEqual(['verde', 'azul']);
    expect(a.s.profile!.coins).toBe(28);

    const broke = a.s.profile! as StoredProfile;
    broke.parrotOwned = true;
    broke.parrotEquipped = true;
    broke.parrotColor = 'verde';
    (broke as { parrotColors?: unknown }).parrotColors = 'verde';
    broke.coins = 40;
    await a.send({ t: 'buy', kind: 'parrot', itemId: 'azul' });
    expect(a.s.profile!.parrotColors).toEqual(['verde', 'azul']);
    expect(a.s.profile!.coins).toBe(28);

    a.s.profile!.coins = 0;
    a.s.profile!.parrotColors = ['verde'];
    a.s.profile!.parrotColor = 'verde';
    await a.send({ t: 'buy', kind: 'parrot', itemId: 'canarinho' });
    expect(a.last('error')!.code).toBe('coins');
    expect(a.s.profile!.parrotColors).toEqual(['verde']);
    expect(a.s.profile!.parrotColor).toBe('verde');
    expect(a.s.profile!.coins).toBe(0);
  });

  it('repairs a wiped papagaio list when the profile loads', () => {
    const wiped = { parrotOwned: true, parrotColors: [] as string[], parrotColor: null } as unknown as StoredProfile;
    normalizeProfile(wiped);
    expect(wiped.parrotColors).toEqual(['verde']);
    expect(wiped.parrotColor).toBe('verde');
    expect(wiped.parrotOwned).toBe(true);

    const blueOnly = { parrotOwned: true, parrotColors: ['azul'], parrotColor: 'azul' } as unknown as StoredProfile;
    normalizeProfile(blueOnly);
    expect(blueOnly.parrotColors).toEqual(['azul']);

    const fresh = { parrotOwned: false, parrotColors: [] as string[], parrotColor: null } as unknown as StoredProfile;
    normalizeProfile(fresh);
    expect(fresh.parrotOwned).toBe(false);
    expect(fresh.parrotColors).toEqual([]);
    expect(fresh.parrotColor).toBeNull();

    const legacy = { parrotOwned: true, parrotColors: ['verde', 'amarelo', 'vermelho'], parrotColor: 'laranja' } as unknown as StoredProfile;
    normalizeProfile(legacy);
    expect(legacy.parrotColors).toEqual(['verde', 'canarinho', 'vermelha', 'periquito']);
    expect(legacy.parrotColor).toBe('periquito');
  });

  it('sells salty popcorn for 5 RV, sweet for 7, and condensed milk only with the sweet one', async () => {
    const { world } = makeWorld();
    const a = await client(world);
    a.s.avatar!.from = { x: 19, y: 20 };
    a.s.avatar!.path = [];
    a.s.profile!.coins = 30;
    await a.send({ t: 'snack', action: 'buy', itemId: 'pipoca_salgada' });
    expect(a.s.profile!.coins).toBe(25);
    expect(a.s.carry).toBe('pipoca_salgada');
    expect(world.publicAvatar(a.s).carry).toBe('pipoca_salgada');
    await a.send({ t: 'snack', action: 'buy', itemId: 'pipoca_doce' });
    expect(a.s.profile!.coins).toBe(18);
    expect(a.s.carry).toBe('pipoca_doce');
    await a.send({ t: 'snack', action: 'buy', itemId: 'pipoca_doce_leite' });
    expect(a.s.profile!.coins).toBe(8);
    expect(a.s.carry).toBe('pipoca_doce_leite');
    await a.send({ t: 'snack', action: 'buy', itemId: 'pipoca_salgada_leite' });
    expect(a.s.profile!.coins).toBe(8);
    expect(a.s.carry).toBe('pipoca_doce_leite');
    await a.send({ t: 'snack', action: 'buy', itemId: 'pipoca' });
    expect(a.s.profile!.coins).toBe(3);
    expect(a.s.carry).toBe('pipoca_salgada');
    a.s.profile!.coins = 2;
    await a.send({ t: 'snack', action: 'buy', itemId: 'pipoca_doce' });
    expect(a.last('error')!.code).toBe('coins');
    expect(a.s.carry).toBe('pipoca_salgada');
    expect(a.s.profile!.coins).toBe(2);
  });

  it('eats or drinks what you are holding and tosses the empty, nicer beside a lixeira', async () => {
    const { world } = makeWorld();
    const a = await client(world);
    const stand = (x: number, y: number) => {
      a.s.avatar!.from = { x, y };
      a.s.avatar!.path = [];
    };
    const freshNotices = async (send: () => Promise<void>) => {
      const n = a.all('notice').length;
      await send();
      return a.all('notice').slice(n);
    };

    a.s.profile!.coins = 40;
    stand(19, 20);
    await a.send({ t: 'snack', action: 'buy', itemId: 'pipoca_salgada' });
    expect(a.s.carry).toBe('pipoca_salgada');
    let added = await freshNotices(() => a.send({ t: 'carry', action: 'consume' }));
    expect(a.s.carry).toBe('saquinho_vazio');
    expect(world.publicAvatar(a.s).carry).toBe('saquinho_vazio');
    expect(added[0]).toMatchObject({ t: 'notice', pt: 'Que delícia!', en: 'Delicious!' });
    added = await freshNotices(() => a.send({ t: 'carry', action: 'consume' }));
    expect(added).toHaveLength(0);
    expect(a.s.carry).toBe('saquinho_vazio');
    added = await freshNotices(() => a.send({ t: 'carry', action: 'toss' }));
    expect(a.s.carry).toBeNull();
    expect(world.publicAvatar(a.s).carry).toBeNull();
    expect(added[0]).toMatchObject({ pt: 'Jogou fora o saquinho vazio', en: 'Tossed the empty popcorn bag' });

    stand(19, 9);
    a.s.carry = 'saquinho_vazio';
    added = await freshNotices(() => a.send({ t: 'carry', action: 'toss' }));
    expect(added[0]?.pt).toBe('Jogou fora o saquinho vazio');

    stand(24, 10);
    added = await freshNotices(() => a.send({ t: 'snack', action: 'buy', itemId: 'agua_de_coco' }));
    expect(a.s.carry).toBe('agua_de_coco');
    added = await freshNotices(() => a.send({ t: 'carry', action: 'consume' }));
    expect(a.s.carry).toBe('coco_vazio');
    expect(added[0]).toMatchObject({ pt: 'Que delícia!', en: 'Delicious!' });
    stand(19, 8);
    added = await freshNotices(() => a.send({ t: 'carry', action: 'toss' }));
    expect(a.s.carry).toBeNull();
    expect(added[0]).toMatchObject({ pt: 'Lixo no lixo!', en: 'Trash in the trash!' });

    a.s.carry = 'pao_de_queijo';
    await a.send({ t: 'carry', action: 'consume' });
    expect(a.s.carry).toBeNull();
    a.s.carry = 'coxinha';
    await a.send({ t: 'carry', action: 'consume' });
    expect(a.s.carry).toBeNull();
    a.s.carry = 'pao_na_chapa';
    await a.send({ t: 'carry', action: 'consume' });
    expect(a.s.carry).toBeNull();
    a.s.carry = 'cafe';
    await a.send({ t: 'carry', action: 'consume' });
    expect(a.s.carry).toBe('copinho_vazio');
    a.s.carry = 'cafezinho';
    await a.send({ t: 'carry', action: 'consume' });
    expect(a.s.carry).toBe('copinho_vazio');
    a.s.carry = 'cafe_com_leite';
    await a.send({ t: 'carry', action: 'consume' });
    expect(a.s.carry).toBe('copinho_vazio');
    a.s.carry = 'suco_de_laranja';
    await a.send({ t: 'carry', action: 'consume' });
    expect(a.s.carry).toBe('copo_vazio');
    a.s.carry = 'agua';
    await a.send({ t: 'carry', action: 'consume' });
    expect(a.s.carry).toBe('copo_vazio');
    await a.send({ t: 'carry', action: 'toss' });
    expect(a.s.carry).toBeNull();

    added = await freshNotices(() => a.send({ t: 'carry', action: 'toss' }));
    expect(added).toHaveLength(0);
    expect(a.s.carry).toBeNull();
    await a.send({ t: 'buy', kind: 'hat', itemId: 'bone_verde' });
    expect(a.s.carry).toBeNull();
    expect(a.s.profile!.hat).toBe('bone_verde');
    a.s.carry = 'bone_verde' as never;
    added = await freshNotices(() => a.send({ t: 'carry', action: 'consume' }));
    expect(added).toHaveLength(0);
    added = await freshNotices(() => a.send({ t: 'carry', action: 'toss' }));
    expect(added).toHaveLength(0);
    expect(a.s.carry).toBe('bone_verde');
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
    expect(cpus.length).toBeGreaterThanOrEqual(3);
    expect(cpus.length).toBeLessThanOrEqual(4);
    expect(CPU_NAMES).toHaveLength(48);
    for (const c of cpus) {
      expect(isCpuId(c.id)).toBe(true);
      expect(c.nameplate).toBe('verde');
      expect(CPU_NAMES).toContain(c.name);
      expect(c.name).not.toMatch(/\s/);
    }
    expect(new Set(cpus.map((c) => c.name)).size).toBe(cpus.length);
    expect(cpus.filter((c) => c.sitting).length).toBeGreaterThanOrEqual(cpus.length / 2);
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

  const ambianceTilesOk = (roomId: 'praca' | 'rua' | 'feira' | 'academia', map: { spots: Tile[]; doorSpots: Tile[]; entries: Tile[] }) => {
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
    const { PRACA_AMBIANCE, RUA_AMBIANCE, FEIRA_AMBIANCE, ACADEMIA_AMBIANCE } = await import('@tudobem/shared');
    ambianceTilesOk('praca', PRACA_AMBIANCE);
    ambianceTilesOk('rua', RUA_AMBIANCE);
    ambianceTilesOk('feira', FEIRA_AMBIANCE);
    // the feira's shoppers browse on the free paving in front of the stalls
    for (const t of FEIRA_AMBIANCE.feiraSpots!) expect(isWalkable(buildGrid(ROOMS.feira), t.x, t.y), `feira shopper spot ${t.x},${t.y}`).toBe(true);
    ambianceTilesOk('academia', ACADEMIA_AMBIANCE);
  });

  it('fills Academia do Bairro with Verde CPUs outside the player cap (the bout lobby untouched)', async () => {
    const { world } = ambient();
    const a = connectBare(world);
    await a.send({ t: 'hello' });
    await a.send({ t: 'createProfile', name: 'Rafa', pronoun: 'ele', appearance: DEFAULT_APPEARANCE });
    await a.send({ t: 'join', room: 'academia' });
    a.s.profile!.giOwned = true;
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
    await a.send({ t: 'bout', v: 1, action: 'open' });
    expect(a.all('bout').some((m) => m.phase === 'lobby')).toBe(true);
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
    await serveFront(world, a, advance);
    const m = a.s.profile!.mission!;
    expect(m.steps).toEqual({ cumprimenta: true, pede: true, monta: true });
    expect(m.rewarded).toBe(true);
    expect(a.all('reward').filter((r) => r.amount === MISSION_REWARD && r.reason.pt === 'Missão completa! +25 RV')).toHaveLength(1);
    expect(a.s.profile!.coins).toBe(coins + MISSION_REWARD);

    // A second served order in the same shift doesn't pay the mission again.
    await serveFront(world, a, advance);
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

  it('refuses sockets without a signed-in account (the intro\'s guest path is solo-only)', async () => {
    const accounts = new FakeAccounts();
    const { world } = makeWorld(16, { accounts });
    const guest = connectAs(world);
    await guest.send({ t: 'hello' });
    expect(guest.inbox.at(-1)).toEqual({ t: 'authRequired' });
    await guest.send({ t: 'createProfile', name: 'Pirata', pronoun: 'ele', appearance: DEFAULT_APPEARANCE });
    expect(guest.inbox.at(-1)).toEqual({ t: 'authRequired' });
    await guest.send({ t: 'join', room: 'praca' });
    expect(guest.inbox.at(-1)).toMatchObject({ t: 'error', code: 'no_profile' });
    expect(world.store.count()).toBe(0);
  });

  it('a token alone never opens an account\'s avatar (e.g. a stale token left after logout)', async () => {
    const accounts = new FakeAccounts();
    const { world } = makeWorld(16, { accounts });
    const owner = connectAs(world, 'acc-1');
    await owner.send({ t: 'hello' });
    await owner.send({ t: 'createProfile', name: 'Jonny', pronoun: 'ele', appearance: DEFAULT_APPEARANCE });
    const { token } = owner.inbox.at(-1) as Extract<ServerMsg, { t: 'welcome' }>;
    world.disconnect(owner.s);

    const sneaky = connectAs(world);
    await sneaky.send({ t: 'hello', token });
    expect(sneaky.inbox.at(-1)).toEqual({ t: 'authRequired' });
    const other = connectAs(world, 'acc-2');
    await other.send({ t: 'hello', token });
    expect(other.inbox.at(-1)).toEqual({ t: 'needProfile' });
    expect(other.s.profile).toBeUndefined();
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

    await a.send({ t: 'ping' });
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

describe('Admin panel', () => {
  beforeEach(() => {
    clock = 1_000_000;
    pending.length = 0;
  });

  it('rejects a wrong password and stays locked', async () => {
    const { world } = makeWorld(16, { adminPassword: 'tb-admin-praca' });
    const a = await client(world, 'Ops');
    await a.send({ t: 'admin', action: 'login', password: 'nope-nope' });
    expect(a.last('admin')).toMatchObject({ phase: 'auth', ok: false });
    await a.send({ t: 'admin', action: 'money', amount: 50 });
    expect(a.last('admin')).toMatchObject({ phase: 'auth', ok: false });
    expect(a.s.profile!.coins).toBe(ECONOMY.startingCoins);
  });

  it('reports disabled when the world has no admin password', async () => {
    const { world } = makeWorld(16, { adminPassword: null });
    const a = await client(world, 'Ops');
    await a.send({ t: 'admin', action: 'login', password: 'tb-admin-praca' });
    expect(a.last('admin')).toMatchObject({ phase: 'disabled' });
  });

  it('unlocks, grants money, pins weather and clock, and kicks another player', async () => {
    const { world } = makeWorld(16, { adminPassword: 'tb-admin-praca' });
    const a = await client(world, 'Admin');
    const b = await client(world, 'Alvo', 'ele');
    let closed: string | null = null;
    b.s.close = (r) => (closed = r);

    expect(a.last('welcome')).toMatchObject({ weather: null, serverNow: expect.any(Number) });

    await a.send({ t: 'admin', action: 'login', password: 'tb-admin-praca' });
    expect(a.last('admin')).toMatchObject({ phase: 'players' });
    expect(a.all('admin').some((m) => m.phase === 'auth' && m.ok)).toBe(true);

    const before = a.s.profile!.coins;
    await a.send({ t: 'admin', action: 'money', amount: 100 });
    expect(a.last('reward')).toMatchObject({ amount: 100, coins: before + 100 });
    expect(a.s.profile!.coins).toBe(before + 100);

    await a.send({ t: 'admin', action: 'weather', weather: 'chuva' });
    expect(a.last('sky')).toMatchObject({ weather: 'chuva' });
    expect(b.last('sky')).toMatchObject({ weather: 'chuva' });

    await a.send({ t: 'admin', action: 'clock', minute: 510 });
    expect(world.gameMinuteNow()).toBe(510);
    expect(a.last('sky')?.serverNow).toBeTypeOf('number');
    expect(b.last('sky')?.serverNow).toBe(a.last('sky')?.serverNow);

    await a.send({ t: 'admin', action: 'kick', targetId: b.s.profile!.id });
    expect(b.last('kicked')).toMatchObject({ reason: 'admin' });
    expect(closed).toBe('admin');
    expect(world.stats().players).toBe(1);
    const roster = a.last('admin');
    expect(roster).toMatchObject({ phase: 'players' });
    if (roster?.phase === 'players') expect(roster.players.map((p) => p.name)).toEqual(['Admin']);
  });

  it('requires the admin password to turn a Feira cart game on, then tells everyone', async () => {
    const { world } = makeWorld(16, { adminPassword: 'tb-admin-praca' });
    const a = await client(world, 'Admin');
    const b = await client(world, 'Lia');
    await a.send({ t: 'join', room: 'feira' });
    const entered = a.last('roomState');
    expect(entered && entered.t === 'roomState' && entered.feiraCart).toMatchObject({ closed: true, game: null });

    await a.send({ t: 'admin', action: 'feiraCartSet', game: 'tapioca', mode: 'on' });
    expect(a.last('admin')).toMatchObject({ phase: 'auth', ok: false });

    await a.send({ t: 'admin', action: 'login', password: 'tb-admin-praca' });
    await a.send({ t: 'admin', action: 'feiraCart' });
    const locked = a.last('admin');
    expect(locked?.phase).toBe('feiraCart');
    if (locked?.phase === 'feiraCart') {
      expect(locked.featured).toBeNull();
      expect(locked.games.map((g) => g.id)).toEqual(['tapioca', 'pastel', 'caldo']);
      expect(locked.games.every((g) => g.mode === 'off')).toBe(true);
      expect(locked.games.find((g) => g.id === 'pastel')).toMatchObject({ mode: 'off', implemented: true });
      expect(locked.games.find((g) => g.id === 'caldo')).toMatchObject({ mode: 'off', implemented: true });
    }

    await a.send({ t: 'admin', action: 'feiraCartSet', game: 'tapioca', mode: 'on' });
    expect(a.last('admin')).toMatchObject({ phase: 'feiraCart', featured: 'tapioca' });
    expect(b.last('feiraGame')).toMatchObject({ phase: 'cart', closed: false, game: 'tapioca' });

    await a.send({ t: 'admin', action: 'feiraCartSet', game: 'not-a-game', mode: 'on' });
    expect(a.last('error')).toMatchObject({ code: 'admin' });
    const still = a.all('admin').filter((m) => m.phase === 'feiraCart').at(-1);
    expect(still && still.phase === 'feiraCart' && still.games.find((g) => g.id === 'tapioca')?.mode).toBe('on');
    expect(still && still.phase === 'feiraCart' && still.games.find((g) => g.id === 'pastel')?.mode).toBe('off');
  });

  it('lets you walk the cart tiles while every game is off, then shows Pastel live to people already there and to a new joiner', async () => {
    const { world } = makeWorld(16, { adminPassword: 'tb-admin-praca' });
    const a = await client(world, 'Admin');
    const b = await client(world, 'Lia');
    await a.send({ t: 'join', room: 'feira' });
    await b.send({ t: 'join', room: 'feira' });
    expect(a.last('roomState')?.feiraCart).toMatchObject({ closed: true, game: null });

    const before = a.all('avatarMoved').length;
    await a.send({ t: 'move', x: 22, y: 7, sit: false });
    const onto = a.all('avatarMoved').at(-1);
    expect(a.all('avatarMoved').length).toBe(before + 1);
    expect(onto?.path.at(-1)).toEqual({ x: 22, y: 7 });

    await a.send({ t: 'admin', action: 'login', password: 'tb-admin-praca' });
    await a.send({ t: 'admin', action: 'feiraCartSet', game: 'pastel', mode: 'on' });
    expect(b.last('feiraGame')).toMatchObject({ phase: 'cart', closed: false, game: 'pastel' });
    expect(a.last('feiraGame')).toMatchObject({ phase: 'cart', closed: false, game: 'pastel' });

    const stuck = b.all('avatarMoved').length;
    await b.send({ t: 'move', x: 18, y: 7, sit: false });
    expect(b.all('avatarMoved').length).toBe(stuck);

    const c = await client(world, 'Nova');
    await c.send({ t: 'join', room: 'feira' });
    const entered = c.last('roomState');
    expect(entered && entered.t === 'roomState' && entered.feiraCart).toMatchObject({ closed: false, game: 'pastel' });
  });

  it('rejects every Testes action without the admin password', async () => {
    const { world } = makeWorld(16, { adminPassword: 'tb-admin-praca' });
    const a = await client(world, 'Jonny');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const coins = a.s.profile!.coins;
    const minute = world.gameMinuteNow();
    const day = a.s.profile!.recados?.day;
    const actions: ClientMsg[] = [
      { t: 'admin', action: 'testes' },
      { t: 'admin', action: 'testBelt', belt: 'azul' },
      { t: 'admin', action: 'testCoins', coins: 500 },
      { t: 'admin', action: 'testProgress', xp: 20, goal: 30, verde: true },
      { t: 'admin', action: 'testEscola', streak: 4, words: 3 },
      { t: 'admin', action: 'testTeleport', room: 'escola' },
      { t: 'admin', action: 'testClock', minute: 120 },
      { t: 'admin', action: 'testClock', rollDay: true },
      { t: 'admin', action: 'testCaps' },
      { t: 'admin', action: 'testTutorial', mode: 'skip' },
      { t: 'admin', action: 'testPadaria', menu: 6, stage: 2 },
      { t: 'admin', action: 'testPerk', grant: true, pet: 'dog', bubble: 'sol' },
      { t: 'admin', action: 'testPerk', revoke: true },
      { t: 'admin', action: 'testReset', confirm: true },
    ];
    for (const msg of actions) {
      await a.send(msg);
      expect(a.last('admin')).toMatchObject({ phase: 'auth', ok: false });
    }
    expect(a.s.profile!.coins).toBe(coins);
    expect(a.s.profile!.testUser).not.toBe(true);
    expect(a.s.profile!.bjj?.wins ?? 0).toBe(0);
    expect(a.s.instance?.def.id).toBe('praca');
    expect(world.gameMinuteNow()).toBe(minute);
    expect(a.s.profile!.recados?.day).toBe(day);
    expect(log.mock.calls.some((c) => String(c[0]).includes('[admin-testes] rejected'))).toBe(true);
    log.mockRestore();
  });

  it('sets a belt from wins, promotes on the fourth stripe, and unlocks founding at brown', async () => {
    const { world } = makeWorld(16, { adminPassword: 'tb-admin-praca' });
    const a = await client(world, 'Jonny');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await a.send({ t: 'admin', action: 'login', password: 'tb-admin-praca' });
    await a.send({ t: 'admin', action: 'testBelt', belt: 'branca', stripes: 3 });
    expect(a.s.profile!.bjj).toMatchObject({ belt: 'branca', stripes: 3, wins: 15 });
    expect(a.last('admin')).toMatchObject({ phase: 'testes', state: { belt: 'branca', stripes: 3, wins: 15, canFound: false } });
    await a.send({ t: 'admin', action: 'testBelt', stripes: 4 });
    expect(a.s.profile!.bjj).toMatchObject({ belt: 'azul', stripes: 0, wins: 20 });
    await a.send({ t: 'admin', action: 'testBelt', belt: 'marrom' });
    expect(a.s.profile!.bjj).toMatchObject({ belt: 'marrom', stripes: 0, wins: 140 });
    expect(a.s.profile!.testUser).toBe(true);
    expect(a.last('avatarUpdated')?.avatar.belt).toBe('marrom');
    await a.send({ t: 'admin', action: 'testTeleport', room: 'academia' });
    expect(a.s.instance?.def.id).toBe('academia');
    await a.send({ t: 'academy', action: 'directory' });
    expect(a.last('academy')).toMatchObject({ phase: 'directory', canFound: true });
    await a.send({ t: 'admin', action: 'testBelt', wins: 139 });
    expect(a.s.profile!.bjj).toMatchObject({ belt: 'roxa', wins: 139 });
    await a.send({ t: 'academy', action: 'directory' });
    expect(a.last('academy')).toMatchObject({ phase: 'directory', canFound: false });
    expect(log.mock.calls.some((c) => String(c[0]).startsWith('[admin-testes]'))).toBe(true);
    log.mockRestore();
  });

  it('leaves admin-adjusted profiles off the public words and streak boards', async () => {
    const { world } = makeWorld(16, { adminPassword: 'tb-admin-praca' });
    const admin = await client(world, 'Jonny');
    const other = await client(world, 'Lia');
    other.s.profile!.diary = DIARY_WORDS.slice(0, 2).map((w) => w.id);
    const words = Math.min(8, DIARY_WORDS.length);
    expect(words).toBeGreaterThan(2);
    await admin.send({ t: 'admin', action: 'login', password: 'tb-admin-praca' });
    await admin.send({ t: 'admin', action: 'testEscola', words, streak: 12, tz: 0 });
    expect(admin.s.profile!.testUser).toBe(true);
    expect(admin.s.profile!.diary).toHaveLength(words);
    await other.send({ t: 'leaderboards' });
    const board = other.last('leaderboards');
    expect(board?.words.some((row) => row.name === 'Jonny')).toBe(false);
    expect(board?.streak.some((row) => row.name === 'Jonny')).toBe(false);
    expect(board?.words.some((row) => row.name === 'Lia' && row.score === 2)).toBe(true);
  });
});
