import { beforeEach, describe, expect, it } from 'vitest';
import {
  BOUT_CLOCK_MS,
  DEFAULT_APPEARANCE,
  PEGADA_MAX,
  ROLL_RV_FINISH,
  ROLL_RV_LOSS,
  ROLL_RV_WIN,
  type BoutServerMsg,
  type ClientMsg,
  type ServerMsg,
} from '@tudobem/shared';
import { World, type Session, type WorldOptions } from './world.js';
import { ProfileStore } from './store.js';
import { AuthoredNpcDialogue, MemoryModerationQueue, InMemoryStudentModel, JevStubSafety, PhrasebookGloss } from './services/stubs.js';
import { ANSWER_GRACE_MS, MIN_REACTION_MS } from './bout.js';

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

/** Answer whatever challenge is open with the debug hint; true when something was answered. */
async function answerRight(a: Client, challenge: Phase<'challenge'>) {
  const hint = challenge.challenge.debugCorrect;
  if (challenge.challenge.kind === 'reorder') return a.send({ t: 'bout', v: 1, action: 'answer', seq: challenge.seq, answer: { kind: 'order', order: hint as number[] } });
  if (challenge.challenge.kind === 'typed') return a.send({ t: 'bout', v: 1, action: 'answer', seq: challenge.seq, answer: { kind: 'text', text: hint as string } });
  return a.send({ t: 'bout', v: 1, action: 'answer', seq: challenge.seq, answer: { kind: 'choice', index: hint as number } });
}

/** Play a bout to its end: a policy decides the intent and whether the answer is right. */
async function play(a: Client, opts: { right?: boolean | ((i: number) => boolean); pick?: 'safe' | 'bold'; maxSteps?: number } = {}) {
  const answeredSeqs = new Set<number>();
  let i = 0;
  for (let guard = 0; guard < (opts.maxSteps ?? 400); guard++) {
    if (a.last('end')) return a.last('end')!;
    const m = a.lastBout()!;
    if (m.phase === 'intent' && !answeredSeqs.has(m.seq)) {
      answeredSeqs.add(m.seq);
      advance(300);
      const intent = m.finish ? 'finalizar' : opts.pick === 'safe' ? m.intents[0]!.id : m.intents.at(-1)!.id;
      await a.send({ t: 'bout', v: 1, action: 'intent', seq: m.seq, intent });
    } else if (m.phase === 'challenge' && !answeredSeqs.has(m.seq)) {
      answeredSeqs.add(m.seq);
      advance(400);
      const want = typeof opts.right === 'function' ? opts.right(i++) : (opts.right ?? true);
      if (want) await answerRight(a, m);
      else await a.send({ t: 'bout', v: 1, action: 'answer', seq: m.seq, answer: { kind: 'choice', index: 99 } });
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
    expect(intro.st.clockMs).toBe(BOUT_CLOCK_MS);
    advance(1000);
    const end = await play(a, { right: true, pick: 'bold' });
    expect(end.winner).toBe('you');
    expect(['finalizacao', 'pontos', 'vantagens']).toContain(end.reason);
    expect(end.rv).toBe(end.reason === 'finalizacao' ? ROLL_RV_FINISH : ROLL_RV_WIN);
    expect(a.s.profile!.coins).toBe(coins0 + end.rv);
    expect(a.inbox.some((m) => m.t === 'reward' && m.amount === end.rv)).toBe(true);
    expect(a.s.profile!.bjj?.wins).toBe(1);
    expect(end.bjj.wins).toBe(1);
    expect(end.thanks.pt).toBe('Obrigado pela partida.');
    expect(a.s.bout).toBeUndefined();
    // the points were announced in Portuguese by Bia
    const lines = a.bout().flatMap((m) => (m.phase === 'resolve' ? m.events : []).flatMap((e) => ('line' in e ? [e.line.pt] : [])));
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(['Dois pontos!', 'Três pontos!', 'Quatro pontos!', 'Vantagem!']).toContain(l);
  });

  it('a player who always misses loses, earns the small reward, and is never promoted', async () => {
    const { a } = await setup();
    await start(a);
    advance(1000);
    // wrong answers still count as answers (they were sent), so the practice reward applies
    const end = await play(a, { right: false, pick: 'safe' });
    expect(end.winner).not.toBe('you');
    expect(end.bjj.wins).toBe(0);
    expect(a.s.profile!.bjj?.stripes ?? 0).toBe(0);
    if (end.winner === 'partner') expect(end.rv).toBe(ROLL_RV_LOSS);
  });

  it('every challenge view is safe (no answer) unless the CI hint is on, and the first answer wins the prompt', async () => {
    const { a } = await setup({ testRollHints: false });
    await start(a);
    advance(5000);
    const intent = a.last('intent')!;
    expect(intent.intents.length).toBeGreaterThanOrEqual(2);
    expect(intent.intents.length).toBeLessThanOrEqual(3);
    advance(400);
    await a.send({ t: 'bout', v: 1, action: 'intent', seq: intent.seq, intent: intent.intents[0]!.id });
    const ch = a.last('challenge')!;
    expect(ch.challenge.debugCorrect).toBeUndefined();
    expect(JSON.stringify(ch)).not.toContain('"perm"');
    expect(ch.limitMs).toBeGreaterThanOrEqual(8000);
    advance(400);
    await a.send({ t: 'bout', v: 1, action: 'answer', seq: ch.seq, answer: { kind: 'choice', index: 0 } });
    expect(a.last('resolve')).toBeTruthy();
    const before = a.bout().length;
    await a.send({ t: 'bout', v: 1, action: 'answer', seq: ch.seq, answer: { kind: 'choice', index: 1 } });
    expect(a.bout().length).toBe(before);
  });

  it('ignores stale, foreign and impossible messages', async () => {
    const { a } = await setup();
    await start(a);
    advance(2000);
    const intent = a.last('intent')!;
    const n0 = a.bout().length;
    // an answer before any challenge, a wrong seq, an intent that was not offered
    await a.send({ t: 'bout', v: 1, action: 'answer', seq: intent.seq, answer: { kind: 'choice', index: 0 } });
    await a.send({ t: 'bout', v: 1, action: 'intent', seq: intent.seq + 999, intent: intent.intents[0]!.id });
    await a.send({ t: 'bout', v: 1, action: 'intent', seq: intent.seq, intent: 'girar' === intent.intents[0]!.id ? 'puxar' : ('nope' as never) });
    await a.send({ t: 'bout', v: 1, action: 'intent', seq: intent.seq, intent: 'finalizar' });
    expect(a.bout().length).toBe(n0);
    advance(300);
    await a.send({ t: 'bout', v: 1, action: 'intent', seq: intent.seq, intent: intent.intents[0]!.id });
    const ch = a.last('challenge')!;
    expect(ch.seq).not.toBe(intent.seq);
    // a stale seq (the intent's) cannot answer the challenge
    advance(300);
    const n1 = a.bout().length;
    await a.send({ t: 'bout', v: 1, action: 'answer', seq: intent.seq, answer: { kind: 'choice', index: 0 } });
    expect(a.bout().length).toBe(n1);
    // garbage answers are just wrong, never a crash
    await a.send({ t: 'bout', v: 1, action: 'answer', seq: ch.seq, answer: { kind: 'text', text: 'x'.repeat(5000) } });
    expect(a.last('resolve')?.yours.correct).toBe(false);
  });

  it('the server owns the timer: an unanswered challenge times out by itself and a late answer is a miss', async () => {
    const { a } = await setup();
    await start(a);
    advance(1000);
    const intent = a.last('intent')!;
    advance(300);
    await a.send({ t: 'bout', v: 1, action: 'intent', seq: intent.seq, intent: intent.intents[0]!.id });
    const ch = a.last('challenge')!;
    // no message from the client: the server resolves it as a miss
    advance(ch.limitMs + ANSWER_GRACE_MS + 50);
    const r = a.last('resolve')!;
    expect(r.seq).toBe(ch.seq);
    expect(r.yours.correct).toBe(false);
    expect(r.yours.speed).toBe(0);
    // then a late answer for it does nothing
    const n0 = a.bout().length;
    await answerRight(a, ch);
    expect(a.bout().length).toBe(n0);
  });

  it('an answer inside the grace window still counts, with no speed bonus', async () => {
    const { a } = await setup();
    await start(a);
    advance(1000);
    const intent = a.last('intent')!;
    advance(300);
    await a.send({ t: 'bout', v: 1, action: 'intent', seq: intent.seq, intent: intent.intents[0]!.id });
    const ch = a.last('challenge')!;
    advance(ch.limitMs + 200);
    await answerRight(a, ch);
    const r = a.last('resolve')!;
    expect(r.yours.correct).toBe(true);
    expect(r.yours.speed).toBe(0);
    expect(r.yours.fast).toBe(false);
  });

  it('answers faster than a person can read are ignored (the prompt stays open)', async () => {
    const { a } = await setup({ testRollHints: false });
    await start(a);
    advance(5000);
    const intent = a.last('intent')!;
    advance(400);
    await a.send({ t: 'bout', v: 1, action: 'intent', seq: intent.seq, intent: intent.intents[0]!.id });
    const ch = a.last('challenge')!;
    await a.send({ t: 'bout', v: 1, action: 'answer', seq: ch.seq, answer: { kind: 'choice', index: 0 } });
    expect(a.last('resolve')).toBeUndefined();
    advance(MIN_REACTION_MS + 10);
    await a.send({ t: 'bout', v: 1, action: 'answer', seq: ch.seq, answer: { kind: 'choice', index: 0 } });
    expect(a.last('resolve')).toBeTruthy();
  });

  it('nobody picking an intent is not stuck: the safe one is chosen and the bout carries on', async () => {
    const { a } = await setup();
    await start(a);
    advance(1000);
    const intent = a.last('intent')!;
    advance(intent.pickMs + 1000);
    expect(a.last('challenge')?.intent).toBe(intent.intents[0]!.id);
  });

  it('an idle bout (nothing ever answered) pays nothing', async () => {
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

  it('plays the finalização end to end (win) and the failed one (escape back to guard)', async () => {
    for (const succeed of [true, false]) {
      pending.length = 0;
      const { a } = await setup();
      await start(a);
      advance(1000);
      const b = a.s.bout!;
      b.st.rung = 4;
      b.st.pegada = PEGADA_MAX;
      // the intent step already ran: answer its challenge, then the next offer carries the chance
      let guard = 0;
      while (!a.last('intent')?.finish && guard++ < 40) {
        const m = a.lastBout()!;
        if (m.phase === 'intent') {
          advance(300);
          await a.send({ t: 'bout', v: 1, action: 'intent', seq: m.seq, intent: m.intents[0]!.id });
        } else if (m.phase === 'challenge') {
          advance(300);
          await answerRight(a, m);
        } else advance(500);
        b.st.rung = 4;
        b.st.pegada = PEGADA_MAX;
        b.st.momentum = 0;
      }
      const chance = a.last('intent')!;
      expect(chance.finish).toBe(true);
      advance(300);
      await a.send({ t: 'bout', v: 1, action: 'intent', seq: chance.seq, intent: 'finalizar' });
      let step = a.lastBout() as Phase<'challenge'>;
      expect(step.phase).toBe('challenge');
      expect(step.role).toBe('finish');
      expect(step.steps === 1 || step.steps === 3).toBe(true);
      // the finish is on a tighter timer than a normal prompt
      expect(step.limitMs).toBeLessThanOrEqual(17_000);
      for (let i = 0; i < step.steps; i++) {
        const cur = a.lastBout() as Phase<'challenge'>;
        advance(300);
        if (succeed) await answerRight(a, cur);
        else await a.send({ t: 'bout', v: 1, action: 'answer', seq: cur.seq, answer: { kind: 'choice', index: 99 } });
        if (!succeed) break;
        advance(900);
      }
      advance(5000);
      if (succeed) {
        expect(a.last('finish_end')).toMatchObject({ kind: 'finalizacao', success: true });
        const end = a.last('end')!;
        expect(end).toMatchObject({ winner: 'you', reason: 'finalizacao' });
        expect(end.rv).toBe(ROLL_RV_FINISH);
      } else {
        expect(a.last('finish_end')).toMatchObject({ kind: 'finalizacao', success: false });
        expect(a.last('finish_end')!.st.rung).toBe(1);
        expect(a.last('finish_end')!.st.pegada).toBe(0);
        expect(a.last('end')).toBeUndefined();
        expect(a.lastBout()!.phase).toBe('intent');
      }
    }
  });

  it('the partner can finish you: a pinned player faces an escape, and failing it loses by finalização', async () => {
    for (const escape of [true, false]) {
      pending.length = 0;
      const { a } = await setup({ rng: () => 0.01 });
      // Rafael (aggressive) is unlocked by the blue belt
      a.s.profile!.bjj = { belt: 'azul', stripes: 0, wins: 12 };
      await start(a, 'rafael');
      advance(1500);
      const b = a.s.bout!;
      expect(b.partner.id).toBe('rafael');
      let guard = 0;
      while (a.lastBout()!.phase !== 'challenge' || (a.lastBout() as Phase<'challenge'>).role !== 'escape') {
        if (guard++ > 60) throw new Error('no escape offered');
        const m = a.lastBout()!;
        b.st.rung = -4;
        b.st.pegadaB = PEGADA_MAX;
        if (m.phase === 'intent') {
          advance(300);
          await a.send({ t: 'bout', v: 1, action: 'intent', seq: m.seq, intent: m.intents[0]!.id });
        } else if (m.phase === 'challenge') {
          advance(300);
          await answerRight(a, m);
        } else advance(500);
      }
      const ch = a.lastBout() as Phase<'challenge'>;
      expect(ch.limitMs).toBeLessThanOrEqual(9000);
      expect(['choice', 'cloze', 'listening']).toContain(ch.challenge.kind);
      advance(300);
      if (escape) await answerRight(a, ch);
      else await a.send({ t: 'bout', v: 1, action: 'answer', seq: ch.seq, answer: { kind: 'choice', index: 99 } });
      advance(5000);
      if (escape) {
        expect(a.last('finish_end')).toMatchObject({ kind: 'escape', success: true });
        expect(a.last('finish_end')!.st.rung).toBe(-2);
      } else {
        expect(a.last('finish_end')).toMatchObject({ kind: 'escape', success: false });
        expect(a.last('end')).toMatchObject({ winner: 'partner', reason: 'finalizacao' });
      }
    }
  });

  it('a win moves stripes, four stripes become the blue belt, and Bia is happier (with a daily cap)', async () => {
    const { world, a } = await setup();
    a.s.profile!.bjj = { belt: 'branca', stripes: 3, wins: 11 };
    await start(a);
    advance(1000);
    const end = await play(a, { right: true, pick: 'bold' });
    expect(end.winner).toBe('you');
    expect(end.beltUp).toBe(true);
    expect(end.belt).toBe('azul');
    expect(a.s.profile!.bjj).toMatchObject({ belt: 'azul', stripes: 0, wins: 12 });
    // the room is told: the public avatar carries the new belt (worn in the academia, shown on the profile card)
    expect(a.inbox.some((m) => m.t === 'avatarUpdated' && m.avatar.belt === 'azul')).toBe(true);
    expect(world.publicAvatar(a.s).belt).toBe('azul');
    expect(end.bond).toBeGreaterThan(0);
    expect((a.s.profile!.bond?.prof ?? 0)).toBeGreaterThan(0);
    // the daily bond cap: play more and the total stays under it
    for (let i = 0; i < 4; i++) {
      pending.length = 0;
      await a.send({ t: 'bout', v: 1, action: 'start', partner: 'mateus' });
      advance(1000);
      await play(a, { right: true, pick: 'bold' });
    }
    expect(a.s.profile!.bjj!.bondToday).toBeLessThanOrEqual(8);
  });

  it('feeds the Caderno: prompts are seen, a typed word is used, listening is heard', async () => {
    const { a } = await setup();
    await start(a);
    advance(1000);
    await play(a, { right: true, pick: 'bold' });
    const cad = a.s.profile!.caderno ?? {};
    expect(Object.keys(cad).length).toBeGreaterThan(0);
    expect(Object.values(cad).some((e) => e.seen > 0)).toBe(true);
  });

  it('a profile saved with only the old fields still loads as a white belt', async () => {
    const { world, a } = await setup();
    expect(world.publicAvatar(a.s).belt).toBe('branca');
    expect(world.publicAvatar(a.s).gi).toBe(true);
    a.s.profile!.bjj = { belt: 'branca', stripes: 2, wins: 6 };
    await a.send({ t: 'bout', v: 1, action: 'open' });
    expect(a.last('lobby')!.level).toBe(2);
    expect(a.last('lobby')!.partners.filter((p) => p.unlocked).map((p) => p.id)).toEqual(['mateus', 'felipe', 'helena']);
  });
});
