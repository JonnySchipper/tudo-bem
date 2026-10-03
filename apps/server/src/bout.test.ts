import { beforeEach, describe, expect, it } from 'vitest';
import {
  ROUND_CLOCK_MS,
  DEFAULT_APPEARANCE,
  ROLL_RV_LOSS,
  ROLL_RV_WIN,
  type BoutServerMsg,
  type ClientMsg,
  type ServerMsg,
} from '@tudobem/shared';

import { World, type Session, type WorldOptions } from './world.js';
import { ProfileStore } from './store.js';
import { AuthoredNpcDialogue, MemoryModerationQueue, InMemoryStudentModel, JevStubSafety, PhrasebookGloss } from './services/stubs.js';

let clock = 5_000_000;
const pending: { fn: () => void; at: number }[] = [];

function advance(ms: number) {
  const end = clock + ms;
  for (let guard = 0; guard < 2000; guard++) {
    const due = pending.filter((p) => p.at <= end).sort((a, b) => a.at - b.at)[0];
    if (!due) break;
    pending.splice(pending.indexOf(due), 1);
    clock = Math.max(clock, due.at);
    due.fn();
  }
  clock = end;
}

type Bout = Extract<ServerMsg, { t: 'bout' }>;
type Phase<P extends BoutServerMsg['phase']> = Extract<BoutServerMsg, { phase: P }>;

interface Client {
  s: Session;
  inbox: ServerMsg[];
  send: (m: ClientMsg) => Promise<void>;
  bout: () => Bout[];
  last: <P extends BoutServerMsg['phase']>(p: P) => Phase<P> | undefined;
  lastBout: () => Bout | undefined;
}

let n = 0;
async function setup(extra: Partial<WorldOptions> = {}): Promise<{ world: World; a: Client }> {
  const world = new World(
    new ProfileStore(null),
    { safety: new JevStubSafety(), gloss: new PhrasebookGloss(), npc: new AuthoredNpcDialogue(), student: new InMemoryStudentModel(), moderation: new MemoryModerationQueue() },
    { roomCap: 16, mgGapMs: 0, now: () => clock, schedule: (fn, ms) => pending.push({ fn, at: clock + ms }), testRollHints: true, rng: () => 0.42, ...extra },
  );
  const inbox: ServerMsg[] = [];
  const s = world.connect(`b${n++}`, (m) => inbox.push(m), () => {});
  const a: Client = {
    s,
    inbox,
    send: (m) => world.handle(s, m),
    bout: () => inbox.filter((m): m is Bout => m.t === 'bout'),
    last: (p) => [...inbox].reverse().find((m) => m.t === 'bout' && (m as Bout).phase === p) as never,
    lastBout: () => [...inbox].reverse().find((m): m is Bout => m.t === 'bout'),
  };
  await a.send({ t: 'hello' });
  await a.send({ t: 'createProfile', name: `Ana${n}`, pronoun: 'ela', appearance: DEFAULT_APPEARANCE });
  a.s.profile!.giOwned = true;
  a.s.profile!.bjj = { belt: 'branca', stripes: 0, wins: 0 };
  await a.send({ t: 'join', room: 'academia' });
  return { world, a };
}

/** Play a bout to its end: pick a grip move each beat. */
async function play(a: Client, opts: { maxSteps?: number } = {}) {
  const answeredSeqs = new Set<number>();
  for (let guard = 0; guard < (opts.maxSteps ?? 400); guard++) {
    if (a.last('end')) return a.last('end')!;
    const m = a.lastBout()!;
    if (m.phase === 'intent' && !answeredSeqs.has(m.seq)) {
      answeredSeqs.add(m.seq);
      advance(300);
      const pick = m.finish ? 'finalizar' : (m.intents.find((i) => i.id.startsWith('puxar_') || i.id.startsWith('empurrar_')) ?? m.intents[0]!).id;
      await a.send({ t: 'bout', v: 1, action: 'intent', seq: m.seq, intent: pick });
    } else advance(250);
  }
  throw new Error('bout did not finish: ' + JSON.stringify(a.lastBout()).slice(0, 300));
}

const start = async (a: Client, partner = 'mateus') => {
  await a.send({ t: 'bout', v: 1, action: 'start', partner: partner as 'mateus' });
};

describe('Treino no tatame (server)', () => {
  beforeEach(() => {
    clock = 5_000_000;
    pending.length = 0;
  });

  it('opens a lobby with five partners; only the first is unlocked for a new player', async () => {
    const { a } = await setup();
    await a.send({ t: 'bout', v: 1, action: 'open' });
    const lobby = a.last('lobby')!;
    expect(lobby.partners).toHaveLength(5);
    expect(lobby.partners.filter((p) => p.unlocked).map((p) => p.id)).toEqual(['mateus']);
    expect(lobby.level).toBe(0);
    expect(lobby.bjj.belt).toBe('branca');
    expect(lobby.suggested).toBe('mateus');
    for (const p of lobby.partners) {
      expect(p.bio.pt.length).toBeGreaterThan(10);
      expect(JSON.stringify(p)).not.toMatch(/\boss\b|\brola\b|gracie/i);
    }
  });

  it('only opens in the academia and refuses a locked or unknown partner', async () => {
    const { a } = await setup();
    await start(a, 'rafael');
    expect(a.inbox.at(-1)).toMatchObject({ t: 'error', code: 'bout' });
    expect(a.s.bout).toBeUndefined();
    await a.send({ t: 'bout', v: 1, action: 'start', partner: 'nobody' as never });
    expect(a.inbox.at(-1)).toMatchObject({ t: 'error', code: 'bout' });
    await a.send({ t: 'join', room: 'praca' });
    await a.send({ t: 'bout', v: 1, action: 'open' });
    expect(a.inbox.at(-1)).toMatchObject({ t: 'error', code: 'bout' });
    // a client speaking another protocol version is told to reload, nothing starts
    await a.send({ t: 'join', room: 'academia' });
    await a.send({ t: 'bout', v: 2 as never, action: 'start', partner: 'mateus' });
    expect(a.inbox.at(-1)).toMatchObject({ t: 'error', code: 'bout' });
    expect(a.s.bout).toBeUndefined();
  });

  it('plays a full match: intro, exchanges, an end with rewards through the normal paths', async () => {
    const { a } = await setup();
    const coins0 = a.s.profile!.coins;
    await start(a);
    const intro = a.last('intro')!;
    expect(intro.partner.id).toBe('mateus');
    expect(intro.line.pt).toBe('Combate!');
    expect(intro.st.clockMs).toBe(ROUND_CLOCK_MS);
    advance(1000);
    const end = await play(a);
    expect(end.winner).toBe('you');
    expect(['pontos', 'finalizacao']).toContain(end.reason);
    expect(end.rv).toBe(ROLL_RV_WIN);
    expect(a.s.profile!.coins).toBe(coins0 + end.rv);
    expect(a.inbox.some((m) => m.t === 'reward' && m.amount === end.rv)).toBe(true);
    expect(a.s.profile!.bjj?.wins).toBe(1);
    expect(end.bjj.wins).toBe(1);
    expect(end.thanks.pt).toBe('Obrigado pela partida.');
    expect(a.s.bout).toBeUndefined();
    // the points were announced in Portuguese by Bia
    const lines = a.bout().flatMap((m) => (m.phase === 'resolve' ? m.events : []).flatMap((e) => ('line' in e ? [e.line.pt] : [])));
    expect(lines.length).toBeGreaterThan(0);
  });

  it('a long round can end with the partner ahead on steps', async () => {
    const { a } = await setup({ rng: () => 0.99 });
    await start(a);
    advance(1000);
    const end = await play(a, { maxSteps: 200 });
    expect(end.winner).toBeTruthy();
    if (end.winner === 'partner') expect(end.rv).toBe(ROLL_RV_LOSS);
  });

  it('a grip move resolves in one beat (no quiz challenge)', async () => {
    const { a } = await setup({ testRollHints: false });
    await start(a);
    advance(5000);
    const intent = a.last('intent')!;
    expect(intent.intents.length).toBeGreaterThanOrEqual(2);
    advance(400);
    await a.send({ t: 'bout', v: 1, action: 'intent', seq: intent.seq, intent: intent.intents[0]!.id });
    expect(a.last('challenge')).toBeUndefined();
    expect(a.last('resolve')).toBeTruthy();
  });

  it('ignores stale, foreign and impossible messages', async () => {
    const { a } = await setup();
    await start(a);
    advance(2000);
    const intent = a.last('intent')!;
    const n0 = a.bout().length;
    await a.send({ t: 'bout', v: 1, action: 'answer', seq: intent.seq, answer: { kind: 'choice', index: 0 } });
    await a.send({ t: 'bout', v: 1, action: 'intent', seq: intent.seq + 999, intent: intent.intents[0]!.id });
    await a.send({ t: 'bout', v: 1, action: 'intent', seq: intent.seq, intent: 'nope' as never });
    await a.send({ t: 'bout', v: 1, action: 'intent', seq: intent.seq, intent: 'finalizar' });
    expect(a.bout().length).toBe(n0);
    advance(300);
    await a.send({ t: 'bout', v: 1, action: 'intent', seq: intent.seq, intent: intent.intents[0]!.id });
    expect(a.last('resolve')).toBeTruthy();
  });

  it('nobody picking a move is not stuck: the first grip chip is chosen', async () => {
    const { a } = await setup();
    await start(a);
    advance(1000);
    const intent = a.last('intent')!;
    advance(intent.pickMs + 1000);
    expect(a.last('resolve')).toBeTruthy();
  });

  it('an idle bout (no moves played) pays nothing', async () => {
    const { a } = await setup();
    const coins0 = a.s.profile!.coins;
    await start(a);
    advance(30 * 60_000);
    const end = a.last('end')!;
    expect(end).toBeTruthy();
    expect(end.rv).toBe(0);
    expect(end.winner).not.toBe('you');
    expect(a.s.profile!.coins).toBe(coins0);
    expect(a.s.profile!.bjj?.wins ?? 0).toBe(0);
    expect(a.s.bout).toBeUndefined();
  });

  it('quitting pays nothing and clears the bout; leaving the room too', async () => {
    const { a } = await setup();
    const coins0 = a.s.profile!.coins;
    await start(a);
    advance(1000);
    await a.send({ t: 'bout', v: 1, action: 'quit' });
    expect(a.last('end')).toMatchObject({ winner: 'none', reason: 'quit', rv: 0 });
    expect(a.s.bout).toBeUndefined();
    expect(a.s.profile!.coins).toBe(coins0);
    await start(a);
    expect(a.s.bout).toBeDefined();
    await a.send({ t: 'join', room: 'praca' });
    expect(a.s.bout).toBeUndefined();
    // the scheduled steps of the dead bout do nothing
    const n0 = a.bout().length;
    advance(60_000);
    expect(a.bout().length).toBe(n0);
  });

  it('a second start while one is running is ignored', async () => {
    const { a } = await setup();
    await start(a);
    const token = a.s.bout!.token;
    await start(a);
    expect(a.s.bout!.token).toBe(token);
  });

  it('can finish the round from the grip contest when Final! is offered', async () => {
    const { a } = await setup();
    await start(a);
    advance(1000);
    const b = a.s.bout!;
    const intent = a.last('intent')!;
    b.grip = { ...b.grip, stepsYou: 1, holdYou: ['gola', 'manga'], turn: 'you' };
    advance(300);
    await a.send({ t: 'bout', v: 1, action: 'intent', seq: intent.seq, intent: 'finalizar' });
    advance(5000);
    const end = a.last('end')!;
    expect(end).toMatchObject({ winner: 'you' });
    expect(end.rv).toBeGreaterThan(0);
  });

  it('a win moves stripes; four round wins earn the blue belt', async () => {
    const { world, a } = await setup();
    a.s.profile!.bjj = { belt: 'branca', stripes: 3, wins: 3 };
    await start(a);
    advance(1000);
    a.s.bout!.grip = { ...a.s.bout!.grip, stepsYou: 2, turn: 'you' };
    advance(500);
    const end = a.last('end') ?? (await play(a));
    expect(end.winner).toBe('you');
    expect(end.beltUp).toBe(true);
    expect(end.belt).toBe('azul');
    expect(a.s.profile!.bjj).toMatchObject({ belt: 'azul', stripes: 0, wins: 4 });
    expect(a.inbox.some((m) => m.t === 'avatarUpdated' && m.avatar.belt === 'azul')).toBe(true);
    expect(world.publicAvatar(a.s).belt).toBe('azul');
    expect(end.bond).toBeGreaterThan(0);
    for (let i = 0; i < 4; i++) {
      pending.length = 0;
      await a.send({ t: 'bout', v: 1, action: 'start', partner: 'mateus' });
      advance(1000);
      await play(a);
    }
    expect(a.s.profile!.bjj!.bondToday).toBeLessThanOrEqual(8);
  });

  it('after a loss, rematch restarts the same guard with bot memory', async () => {
    const { a } = await setup();
    await start(a);
    advance(1000);
    a.s.bout!.grip = { ...a.s.bout!.grip, stepsThem: 2, weakSpot: 'gola', turn: 'partner' };
    const intent = a.last('intent')!;
    advance(intent.pickMs + 3000);
    const end = a.last('end');
    expect(end).toBeTruthy();
    expect(end!.rematchSamePosition).toBe(true);
    expect(a.s.boutRematch?.weakSpot).toBe('gola');
    await a.send({ t: 'bout', v: 1, action: 'start', partner: 'mateus', rematch: true });
    advance(500);
    expect(a.s.bout!.grip.weakSpot).toBe('gola');
    expect(a.s.bout!.grip.position).toBe('guarda_fechada');
  });

  it('a profile saved with only the old fields still loads coherently', async () => {
    const { world, a } = await setup();
    expect(world.publicAvatar(a.s).belt).toBe('branca');
    expect(world.publicAvatar(a.s).gi).toBe(true);
    a.s.profile!.bjj = { belt: 'branca', stripes: 2, wins: 2 };
    await a.send({ t: 'bout', v: 1, action: 'open' });
    expect(a.last('lobby')!.level).toBe(2);
    expect(a.last('lobby')!.partners.filter((p) => p.unlocked).map((p) => p.id)).toEqual(['mateus', 'felipe', 'helena']);
  });
});
