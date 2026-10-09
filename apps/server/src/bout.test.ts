import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_APPEARANCE,
  MAT_TURNS,
  NET_GRACE_MS,
  ROLL_RV_LOSS,
  ROLL_RV_WIN,
  WINDUP_MS,
  type BoutServerMsg,
  type ClientMsg,
  type MatAttack,
  type MatDefense,
  type ServerMsg,
} from '@tudobem/shared';

import { World, type Session, type WorldOptions } from './world.js';
import { ProfileStore } from './store.js';
import { AuthoredNpcDialogue, MemoryModerationQueue, InMemoryStudentModel, JevStubSafety, PhrasebookGloss } from './services/stubs.js';

let clock = 5_000_000;
const pending: { fn: () => void; at: number }[] = [];

function advance(ms: number) {
  const end = clock + ms;
  for (let guard = 0; guard < 4000; guard++) {
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

const WHITE = { belt: 'branca' as const, stripes: 0, wins: 1, unlocked: ['collar_tie' as const] };

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
  a.s.profile!.bjj = { ...WHITE };
  await a.send({ t: 'join', room: 'academia' });
  return { world, a };
}

const start = async (a: Client, partner = 'mateus') => {
  await a.send({ t: 'bout', v: 2, action: 'start', partner: partner as 'mateus' });
};

/** The defense that stops an attack kind (what a reading player taps from blue belt). */
const DEF: Record<MatAttack, MatDefense> = { pegada: 'postura', queda: 'base', raspagem: 'base', passagem: 'trava', final: 'sai' };

/** Pick a move on the pick on screen. */
async function pick(a: Client, move: string) {
  const p = a.last('pick')!;
  await a.send({ t: 'bout', v: 2, action: 'pick', seq: p.seq, move });
}

/** Tap the chain on screen: right by default, `wrongAt` taps a wrong command at that step. */
async function tapChain(a: Client, o: { wrongAt?: number; ms?: number } = {}) {
  const c = a.last('chain')!;
  for (let i = 0; i < c.cmds.length; i++) {
    const cmd = i === o.wrongAt ? (c.cmds[i] === 'pega' ? 'puxa' : 'pega') : c.cmds[i]!;
    await a.send({ t: 'bout', v: 2, action: 'tap', seq: c.seq, step: i, cmd, ms: o.ms ?? 200 });
    if (i === o.wrongAt) return;
  }
}

/** Answer the defense on screen (after the wind-up): right by default. */
async function defendBeat(a: Client, right = true) {
  const d = a.last('defend')!;
  advance(d.leadMs + 50);
  const want = d.call ?? DEF[d.attack];
  for (let i = 0; i < d.count; i++) {
    await a.send({ t: 'bout', v: 2, action: 'defend', seq: d.seq, step: i, cmd: right ? want : want === 'base' ? 'trava' : 'base', ms: 150 });
    if (!right) return;
  }
}

/** Play whatever is on screen until the match (or the professor drill) ends: the first card, every command right. */
async function play(a: Client, o: { defend?: boolean } = {}) {
  const done = new Set<number>();
  for (let guard = 0; guard < 600; guard++) {
    if (a.last('end') || (a.last('chain')?.drill && !a.s.bout?.beat?.seq)) return;
    const m = a.lastBout();
    if (m?.phase === 'chain' && m.drill) return;
    if (m && 'seq' in m && !done.has(m.seq)) {
      if (m.phase === 'pick') {
        done.add(m.seq);
        await pick(a, m.cards[0]?.id ?? 'hold');
      } else if (m.phase === 'chain') {
        done.add(m.seq);
        await tapChain(a);
      } else if (m.phase === 'defend') {
        done.add(m.seq);
        await defendBeat(a, o.defend ?? true);
      }
    }
    advance(60);
  }
  throw new Error('bout did not finish: ' + JSON.stringify(a.lastBout()).slice(0, 300));
}

/** Jump to the last exchange with this score, then Hold: the score on the mat decides the match. */
async function holdOut(a: Client, you: number, them: number) {
  advance(1000);
  const b = a.s.bout!;
  b.mat.turnsUsed = MAT_TURNS - 1;
  b.mat.points = { you, them };
  b.mat.actor = 'you';
  b.mat.over = false;
  b.mat.winner = null;
  await deal(a, 'hold');
  advance(2000);
}

/** Deal a pick with these cards on the mat as it is now (a test shortcut to a position or a card the ranking would not show). */
async function deal(a: Client, move: string) {
  const b = a.s.bout!;
  b.phase = 'pick';
  b.beat = null;
  b.offered = [move as never, 'hold'];
  b.seq += 1000;
  await a.send({ t: 'bout', v: 2, action: 'pick', seq: b.seq, move });
}

/** Make the partner's next move this one (the server's test-only slot, honoured whenever legal); `feint` plays it as a feint. */
const force = (a: Client, move: string, feint = false) => {
  a.s.bout!.forced = { move: move as never, feint };
};

describe('Treino no tatame v3 (server)', () => {
  beforeEach(() => {
    clock = 5_000_000;
    pending.length = 0;
  });

  it('opens a lobby with five partners; only the first is unlocked for a new player', async () => {
    const { a } = await setup();
    a.s.profile!.bjj = { belt: 'branca', stripes: 0, wins: 0, unlocked: ['collar_tie'] };
    await a.send({ t: 'bout', v: 2, action: 'open' });
    const lobby = a.last('lobby')!;
    expect(lobby.v).toBe(2);
    expect(lobby.partners).toHaveLength(5);
    expect(lobby.partners.filter((p) => p.unlocked).map((p) => p.id)).toEqual(['mateus']);
    expect(lobby.level).toBe(0);
    expect(lobby.bjj.unlocked).toEqual(['collar_tie', 'double_leg', 'hook_sweep', 'posture', 'passar', 'armbar']);
    for (const p of lobby.partners) expect(JSON.stringify(p)).not.toMatch(/\boss\b|\brola\b|gracie/i);
  });

  it('rejects protocol v1, a locked or unknown partner, and a bout away from the mat', async () => {
    const { a } = await setup();
    await a.send({ t: 'bout', v: 1, action: 'start', partner: 'mateus' } as never);
    expect(a.inbox.at(-1)).toMatchObject({ t: 'error', code: 'bout' });
    expect(a.s.bout).toBeUndefined();
    await a.send({ t: 'bout', v: 1, action: 'intent', seq: 1, intent: 'hold' } as never);
    expect(a.inbox.at(-1)).toMatchObject({ t: 'error', code: 'bout' });
    await start(a, 'rafael');
    expect(a.inbox.at(-1)).toMatchObject({ t: 'error', code: 'bout' });
    await start(a, 'nobody');
    expect(a.inbox.at(-1)).toMatchObject({ t: 'error', code: 'bout' });
    await a.send({ t: 'join', room: 'praca' });
    await a.send({ t: 'bout', v: 2, action: 'open' });
    expect(a.inbox.at(-1)).toMatchObject({ t: 'error', code: 'bout' });
  });

  it('the pick: at most four cards with chevrons and plain words, Segurar apart, the telegraph, no percent anywhere', async () => {
    const { a } = await setup();
    await start(a);
    const intro = a.last('intro')!;
    expect(intro).toMatchObject({ turns: 16, first: false, line: { pt: 'Combate!' } });
    advance(1000);
    const p = a.last('pick')!;
    expect(p.cards.length).toBeGreaterThan(0);
    expect(p.cards.length).toBeLessThanOrEqual(4);
    expect(p.cards.map((c) => c.id)).not.toContain('hold');
    const queda = p.cards.find((c) => c.id === 'double_leg')!;
    expect(queda).toMatchObject({ chain: 2, points: 2, kind: 'attack', does: { pt: '+2 · você por cima' } });
    expect(p.plan?.line.pt.startsWith('Mateus vai')).toBe(true);
    expect(JSON.stringify(p)).not.toMatch(/%|percent/);
    expect(p.st).toMatchObject({ clockMs: 120_000, exchange: 0, turns: 16, meter: 0, ritmo: 0 });
    // a first-ever match is flagged (coach notes, longer windows)
    await a.send({ t: 'bout', v: 2, action: 'quit' });
    a.s.profile!.bjj = { belt: 'branca', stripes: 0, wins: 0, unlocked: ['collar_tie'] };
    await start(a);
    expect(a.last('intro')!.first).toBe(true);
  });

  it('a chain tapped right lands the move: Queda scores two and Bia calls it', async () => {
    const { a } = await setup();
    await start(a);
    advance(1000);
    await pick(a, 'double_leg');
    const c = a.last('chain')!;
    expect(c).toMatchObject({ cmds: ['puxa', 'levanta'], windowMs: [2200, 2200], from: 'de_pe', sub: false, move: { id: 'double_leg', pt: 'Queda' } });
    await tapChain(a);
    const r = a.last('resolve')!;
    expect(r).toMatchObject({ actor: 'you', move: 'double_leg', landed: true, how: 'landed', points: 2, sound: 'whoosh', say: { pt: 'Dois pontos!' } });
    expect(r.grades).toEqual(['perfeito', 'perfeito']);
    expect(r.st.position).toBe('cem_quilos');
    expect(r.st.points.you).toBe(2);
    expect(r.st.clockMs).toBe(15 * 7_500);
  });

  it('a wrong tap ends the chain there (Errou!), a late one too (Tarde!), and so does the deadline with no tap', async () => {
    const { a } = await setup();
    await start(a);
    advance(1000);
    await pick(a, 'double_leg');
    await tapChain(a, { wrongAt: 1 });
    let r = a.last('resolve')!;
    expect(r).toMatchObject({ landed: false, how: 'wrong', step: 1, points: 0 });
    expect(r.grades).toEqual(['perfeito', 'errou']);
    expect(r.st.position).toBe('de_pe');

    await a.send({ t: 'bout', v: 2, action: 'quit' });
    await start(a);
    advance(1000);
    await pick(a, 'double_leg');
    const c = a.last('chain')!;
    advance(c.windowMs[0]! + 100);
    // the deadline (window + network grace) has not fired yet, but the tap itself was timed past the window
    await a.send({ t: 'bout', v: 2, action: 'tap', seq: c.seq, step: 0, cmd: 'puxa', ms: c.windowMs[0]! + 80 });
    r = a.last('resolve')!;
    expect(r).toMatchObject({ landed: false, how: 'late', step: 0 });
    expect(r.grades).toEqual(['tarde']);

    await a.send({ t: 'bout', v: 2, action: 'quit' });
    await start(a);
    advance(1000);
    await pick(a, 'double_leg');
    const c2 = a.last('chain')!;
    advance(c2.windowMs[0]! + NET_GRACE_MS + 5);
    r = a.last('resolve')!;
    expect(r.seq).toBe(c2.seq);
    expect(r).toMatchObject({ landed: false, how: 'late', step: 0, grades: ['tarde'] });
  });

  it('the server clock bounds the grade: a tap claimed fast after a slow wait is only Boa; stale and out-of-order taps are ignored', async () => {
    const { a } = await setup();
    await start(a);
    advance(1000);
    await pick(a, 'double_leg');
    const c = a.last('chain')!;
    advance(1800);
    await a.send({ t: 'bout', v: 2, action: 'tap', seq: c.seq, step: 1, cmd: 'levanta', ms: 10 });
    await a.send({ t: 'bout', v: 2, action: 'tap', seq: c.seq + 99, step: 0, cmd: 'puxa', ms: 10 });
    expect(a.last('resolve')).toBeUndefined();
    await a.send({ t: 'bout', v: 2, action: 'tap', seq: c.seq, step: 0, cmd: 'puxa', ms: 10 });
    await a.send({ t: 'bout', v: 2, action: 'tap', seq: c.seq, step: 0, cmd: 'puxa', ms: 10 });
    await a.send({ t: 'bout', v: 2, action: 'tap', seq: c.seq, step: 1, cmd: 'levanta', ms: 10 });
    const r = a.last('resolve')!;
    expect(r.grades).toEqual(['boa', 'perfeito']);
    expect(r.landed).toBe(true);
  });

  it("the partner's attack is a defense beat after its wind-up: the right tap is Defendeu! and a Vantagem", async () => {
    const { a } = await setup();
    await start(a);
    advance(1000);
    a.s.bout!.rng = () => 0;
    await pick(a, 'collar_tie');
    await tapChain(a);
    force(a, 'double_leg');
    advance(100);
    const d = a.last('defend')!;
    expect(d).toMatchObject({ move: { id: 'double_leg' }, attack: 'queda', call: 'base', count: 1, leadMs: WINDUP_MS });
    expect(d.line.pt).toBe('Mateus vai tentar a queda.');
    // Mateus (speed 0.45): a shorter window than a chain window; nothing happens before the wind-up is over
    expect(d.windowMs).toBeLessThan(2200);
    await defendBeat(a, true);
    const r = a.last('resolve')!;
    expect(r).toMatchObject({ actor: 'partner', move: 'double_leg', landed: false, how: 'defended', say: { pt: 'Vantagem!' } });
    expect(r.st.adv.you).toBe(1);
    expect(r.grip).toContainEqual({ kind: 'defended', side: 'you', adv: true });
    advance(100);
    expect(a.last('pick')!.seq).toBeGreaterThan(d.seq);
  });

  it('a wrong or missing defense lets the attack land in full', async () => {
    const { a } = await setup();
    await start(a);
    advance(1000);
    a.s.bout!.rng = () => 0;
    await pick(a, 'collar_tie');
    await tapChain(a);
    force(a, 'double_leg');
    advance(100);
    await defendBeat(a, false);
    let r = a.last('resolve')!;
    expect(r).toMatchObject({ actor: 'partner', landed: true, how: 'wrong', points: 2 });
    expect(r.st.points.partner).toBe(2);

    await a.send({ t: 'bout', v: 2, action: 'quit' });
    await start(a);
    advance(1000);
    a.s.bout!.rng = () => 0;
    await pick(a, 'collar_tie');
    await tapChain(a);
    force(a, 'double_leg');
    advance(100);
    const d = a.last('defend')!;
    advance(d.leadMs + d.windowMs + NET_GRACE_MS + 5);
    r = a.last('resolve')!;
    expect(r).toMatchObject({ actor: 'partner', landed: true, how: 'late' });
  });

  it('your sleeve grip widens the defense window by 1.35', async () => {
    const { a } = await setup();
    a.s.profile!.bjj = { belt: 'branca', stripes: 1, wins: 5, unlocked: ['collar_tie', 'sleeve_grip'] };
    await start(a);
    advance(1000);
    a.s.bout!.rng = () => 0;
    await pick(a, 'collar_tie');
    await tapChain(a);
    force(a, 'double_leg');
    advance(100);
    const plain = a.last('defend')!.windowMs;
    await defendBeat(a, true);
    advance(2000);
    await pick(a, 'sleeve_grip');
    await tapChain(a);
    force(a, 'sleeve_grip');
    advance(100);
    expect(Math.abs(a.last('defend')!.windowMs - plain * 1.35)).toBeLessThanOrEqual(1);
  });

  it('a brace you put up blocks the matching attack with no tap (Vantagem), and the partner botches on its own sometimes', async () => {
    const { a } = await setup();
    a.s.profile!.bjj = { belt: 'azul', stripes: 0, wins: 20, unlocked: ['collar_tie', 'sleeve_grip', 'knee_on_belly', 'body_lock', 'sprawl'] };
    await start(a);
    advance(1000);
    a.s.bout!.rng = () => 0;
    await deal(a, 'sprawl');
    await tapChain(a);
    expect(a.last('resolve')!.st.brace?.you).toBe('base');
    force(a, 'double_leg');
    advance(100);
    let r = a.last('resolve')!;
    expect(r).toMatchObject({ actor: 'partner', how: 'blocked', landed: false, say: { pt: 'Vantagem!' } });
    expect(a.bout().filter((m) => m.phase === 'defend')).toHaveLength(0);
    expect(r.st.adv.you).toBe(1);

    advance(100);
    await deal(a, 'collar_tie');
    await tapChain(a);
    a.s.bout!.rng = () => 0.999;
    force(a, 'double_leg');
    advance(100);
    r = a.last('resolve')!;
    expect(r).toMatchObject({ actor: 'partner', how: 'botched', landed: false, say: { pt: 'Errou!' } });
    expect(r.st.adv.you).toBe(1);
  });

  it("the partner's finish is the escape mash: three Sai! (Daniel's four); miss one and you tap", async () => {
    const { a } = await setup();
    await start(a);
    advance(1000);
    a.s.bout!.rng = () => 0;
    await pick(a, 'hold');
    a.s.bout!.mat.position = { kind: 'mount', top: 'them' };
    force(a, 'armbar');
    advance(100);
    let d = a.last('defend')!;
    expect(d).toMatchObject({ attack: 'final', call: 'sai', count: 3 });
    await defendBeat(a, true);
    const r = a.last('resolve')!;
    expect(r).toMatchObject({ how: 'defended', landed: false });
    expect(r.st.position).toBe('guarda_fechada');
    expect(r.st.ahead).toBe('you');

    await a.send({ t: 'bout', v: 2, action: 'quit' });
    a.s.profile!.bjj = { belt: 'branca', stripes: 3, wins: 15, unlocked: ['collar_tie', 'sleeve_grip', 'knee_on_belly'] };
    await start(a, 'daniel');
    advance(1000);
    a.s.bout!.rng = () => 0;
    await pick(a, 'hold');
    a.s.bout!.mat.position = { kind: 'mount', top: 'them' };
    force(a, 'armbar');
    advance(100);
    d = a.last('defend')!;
    expect(d.count).toBe(4);
    advance(d.leadMs + 50);
    await a.send({ t: 'bout', v: 2, action: 'defend', seq: d.seq, step: 0, cmd: 'sai', ms: 100 });
    advance(d.windowMs + NET_GRACE_MS + 5);
    expect(a.last('resolve')).toMatchObject({ actor: 'partner', landed: true, how: 'late' });
    advance(2000);
    expect(a.last('end')).toMatchObject({ winner: 'partner', reason: 'finalizacao' });
  });

  it('your finish: the last Aperta! is tight; a landed chain ends the match, a missed one leaves you underneath (Escapou!)', async () => {
    const { a } = await setup();
    await start(a);
    advance(1000);
    // put the pair on the mount and deal the pick from there
    a.s.bout!.mat.position = { kind: 'mount', top: 'you' };
    await deal(a, 'armbar');
    const c = a.last('chain')!;
    expect(c).toMatchObject({ cmds: ['pega', 'gira', 'levanta', 'aperta'], windowMs: [2200, 2200, 2200, 1760], sub: true });
    await tapChain(a, { wrongAt: 3 });
    expect(a.last('resolve')).toMatchObject({ landed: false, how: 'wrong', say: { pt: 'Escapou!' } });
    expect(a.last('resolve')!.st).toMatchObject({ position: 'guarda_fechada', ahead: 'partner' });
  });

  it('Ritmo: three all-Perfeito chains in a row are a Vantagem; the end card counts the perfect commands and lists the words', async () => {
    const { a } = await setup();
    await start(a);
    advance(1000);
    for (let i = 0; i < 3; i++) {
      a.s.bout!.mat.grips = { you: { collar: false, sleeve: false }, them: { collar: false, sleeve: false } };
      a.s.bout!.mat.brace = { you: null, them: null };
      a.s.bout!.mat.braced = { you: false, them: false };
      a.s.bout!.mat.actor = 'you';
      await deal(a, 'collar_tie');
      await tapChain(a, { ms: 100 });
    }
    const r = a.last('resolve')!;
    expect(r.grip).toContainEqual({ kind: 'ritmo', side: 'you' });
    expect(r.say?.pt).toBe('Que ritmo!');
    expect(r.st.adv.you).toBe(1);
    await holdOut(a, 2, 0);
    const end = a.last('end')!;
    expect(end.perfect).toBe(3);
    expect(end.words).toEqual([{ pt: 'Pega!', en: 'Grab!' }]);
  });

  it('feints: from blue belt Bia is silent, the line is the telegraph, and the attack may be another kind', async () => {
    const { a } = await setup();
    a.s.profile!.bjj = { belt: 'azul', stripes: 0, wins: 20, unlocked: ['collar_tie', 'double_leg', 'hook_sweep', 'posture', 'passar', 'armbar', 'sleeve_grip', 'knee_on_belly', 'body_lock', 'sprawl', 'scissor_sweep'] };
    await start(a, 'rafael');
    advance(1000);
    a.s.bout!.rng = () => 0;
    a.s.bout!.plan = { move: 'double_leg', kind: 'queda' };
    await pick(a, 'hold');
    force(a, 'collar_tie', true);
    advance(100);
    const d = a.last('defend')!;
    expect(d.call).toBeUndefined();
    expect(d.line.pt).toBe('Rafael vai tentar a queda.');
    expect(d.attack).toBe('pegada');
    // the reading player taps Base for the telegraphed takedown: wrong
    advance(d.leadMs + 50);
    await a.send({ t: 'bout', v: 2, action: 'defend', seq: d.seq, step: 0, cmd: 'base', ms: 100 });
    expect(a.last('resolve')).toMatchObject({ landed: true, how: 'wrong', feint: true });
  });

  it('from blue belt a partner that changed plans (no feint) is described as it is: the line names the move it plays', async () => {
    const { a } = await setup();
    a.s.profile!.bjj = { belt: 'azul', stripes: 0, wins: 20, unlocked: ['collar_tie', 'double_leg', 'hook_sweep', 'posture', 'passar', 'armbar', 'sleeve_grip', 'knee_on_belly', 'body_lock', 'sprawl', 'scissor_sweep'] };
    await start(a, 'helena');
    advance(1000);
    a.s.bout!.rng = () => 0;
    a.s.bout!.plan = { move: 'double_leg', kind: 'queda' };
    await pick(a, 'hold');
    force(a, 'collar_tie');
    advance(100);
    const d = a.last('defend')!;
    expect(d.call).toBeUndefined();
    expect(d.line.pt).toBe('Helena vai pegar a sua gola.');
    expect(d.attack).toBe('pegada');
  });

  it('a feint picked at the offer is dropped when it would run into the brace you just raised', async () => {
    const { a } = await setup();
    a.s.profile!.bjj = { belt: 'azul', stripes: 0, wins: 20, unlocked: ['collar_tie', 'double_leg', 'hook_sweep', 'posture', 'passar', 'armbar', 'sleeve_grip', 'knee_on_belly', 'body_lock', 'sprawl', 'scissor_sweep'] };
    await start(a, 'rafael');
    advance(1000);
    a.s.bout!.rng = () => 0;
    await deal(a, 'sprawl');
    a.s.bout!.feint = 'double_leg';
    await tapChain(a);
    expect(a.last('resolve')!.st.brace?.you).toBe('base');
    advance(100);
    const msgs = [...a.bout()].reverse();
    const partnerMove = msgs.map((m) => (m.phase === 'defend' ? m.move.id : m.phase === 'resolve' && m.actor === 'partner' ? m.move : null)).find(Boolean);
    expect(partnerMove).toBeTruthy();
    expect(partnerMove).not.toBe('double_leg');
    const res = msgs.find((m) => m.phase === 'resolve' && m.actor === 'partner');
    if (res && res.phase === 'resolve') expect(res.feint).toBeUndefined();
  });

  it('the pick never shrinks behind a brace: a move the partner’s Base would stop is left out before the four are kept', async () => {
    const { a } = await setup();
    a.s.profile!.bjj = { belt: 'roxa', stripes: 2, wins: 100, unlocked: ['double_leg', 'body_lock', 'single_leg', 'collar_tie', 'sleeve_grip', 'posture'] };
    await start(a);
    advance(1000);
    a.s.bout!.rng = () => 0;
    await pick(a, 'hold');
    force(a, 'sprawl');
    advance(100);
    const p = a.last('pick')!;
    expect(p.st.brace?.partner).toBe('base');
    // the three takedowns are braced out before the cut: four cards stay (the grips, Postura, and the Base the rank fills in)
    const ids = p.cards.map((c) => c.id);
    expect(ids).toHaveLength(4);
    expect(ids).toEqual(expect.arrayContaining(['collar_tie', 'sleeve_grip', 'posture']));
    for (const t of ['double_leg', 'body_lock', 'single_leg']) expect(ids).not.toContain(t);
  });

  it('a move that is no longer legal when its chain ends is played as a hold: the match goes on', async () => {
    const { a } = await setup();
    await start(a);
    advance(1000);
    await deal(a, 'double_leg');
    const c = a.last('chain')!;
    a.s.bout!.mat.position = { kind: 'mount', top: 'you' };
    await tapChain(a);
    const r = a.last('resolve')!;
    expect(r).toMatchObject({ actor: 'you', move: 'hold', how: 'hold' });
    expect(r.seq).toBeGreaterThanOrEqual(c.seq);
    advance(2000);
    const next = a.lastBout()!;
    expect(next).not.toBe(r);
    expect(['pick', 'defend', 'resolve', 'chain']).toContain(next.phase);
  });

  it('a tap whose ms is not a number is timed by the server gap (null, true and an empty string are not 0 ms)', async () => {
    for (const ms of [null, true, '']) {
      const { a } = await setup();
      await start(a);
      advance(1000);
      await deal(a, 'collar_tie');
      const c = a.last('chain')!;
      advance(1200);
      await a.send({ t: 'bout', v: 2, action: 'tap', seq: c.seq, step: 0, cmd: 'pega', ms: ms as never });
      expect(a.last('resolve')!.grades, String(ms)).toEqual(['boa']);
    }
  });

  it('comfort windows: losses in a row widen a white belt’s next match quietly; a win or a draw resets it; a quit does not count', async () => {
    const { a } = await setup();
    await start(a);
    await holdOut(a, 0, 2);
    expect(a.last('end')!.winner).toBe('partner');
    expect(a.s.profile!.bjj.lossStreak).toBe(1);
    // the next match: every window ×1.12 (chain and defense), and nothing in the messages says so
    a.inbox.length = 0;
    await start(a);
    advance(1000);
    await deal(a, 'collar_tie');
    expect(a.last('chain')!.windowMs).toEqual([Math.round(2200 * 1.12)]);
    await a.send({ t: 'bout', v: 2, action: 'quit' });
    expect(a.s.profile!.bjj.lossStreak).toBe(1);
    a.inbox.length = 0;
    await start(a);
    await holdOut(a, 0, 2);
    await start(a);
    await holdOut(a, 0, 2);
    await start(a);
    await holdOut(a, 0, 2);
    expect(a.s.profile!.bjj.lossStreak).toBe(4);
    a.inbox.length = 0;
    await start(a);
    advance(1000);
    await deal(a, 'collar_tie');
    // three losses or more: ×1.36, no further
    expect(a.last('chain')!.windowMs).toEqual([Math.round(2200 * 1.36)]);
    await a.send({ t: 'bout', v: 2, action: 'quit' });
    await start(a);
    await holdOut(a, 0, 0);
    expect(a.last('end')!.winner).toBe('draw');
    expect(a.s.profile!.bjj.lossStreak).toBe(0);
    a.s.profile!.bjj.lossStreak = 2;
    await start(a);
    await holdOut(a, 2, 0);
    expect(a.s.profile!.bjj.lossStreak).toBe(0);
  });

  it('comfort windows stop at blue belt', async () => {
    const { a } = await setup();
    a.s.profile!.bjj = { belt: 'azul', stripes: 0, wins: 20, unlocked: ['collar_tie'], lossStreak: 3 };
    await start(a);
    advance(1000);
    await deal(a, 'collar_tie');
    expect(a.last('chain')!.windowMs).toEqual([Math.round(2200 * 0.8)]);
  });

  it('plays a full sixteen-exchange match by taps, and every beat is a pick, a chain, a defense or a resolve', async () => {
    const { a } = await setup();
    await start(a);
    await play(a);
    const end = a.last('end') ?? a.last('chain');
    expect(end).toBeTruthy();
    const phases = new Set(a.bout().map((m) => m.phase));
    for (const p of phases) expect(['intro', 'pick', 'chain', 'defend', 'resolve', 'end']).toContain(p);
    const resolves = a.bout().filter((m) => m.phase === 'resolve');
    expect(resolves.length).toBeGreaterThan(0);
    expect(resolves.length).toBeLessThanOrEqual(MAT_TURNS);
    // the mat feeds the Caderno: every command Bia called is heard, every one tapped right is used
    const tapped = new Set(a.bout().flatMap((m) => (m.phase === 'chain' ? m.cmds : [])));
    expect(tapped.size).toBeGreaterThan(0);
    for (const c of tapped) expect(a.s.profile!.caderno?.[`lex.tatame.${c}`], c).toMatchObject({ used: expect.any(Number), heard: expect.any(Number) });
    expect(Object.keys(a.s.profile!.caderno ?? {}).some((id) => id.startsWith('lex.tatame.') && a.s.profile!.caderno![id]!.used >= 1)).toBe(true);
  });

  it('a win pays one diary word and keeps the belt on the account after the match is gone', async () => {
    const { a } = await setup();
    const coins0 = a.s.profile!.coins;
    await start(a);
    await holdOut(a, 2, 0);
    const end = a.last('end')!;
    expect(end).toMatchObject({ winner: 'you', reason: 'pontos', rv: ROLL_RV_WIN, word: { pt: 'academia', en: 'gym' }, stripeUp: false });
    expect(a.s.profile!.coins).toBe(coins0 + end.rv);
    expect(a.s.profile!.bjj).toMatchObject({ belt: 'branca', stripes: 0, wins: 2 });
    expect(a.s.profile!.diary).toEqual(['diary.rua.academia']);
    expect(a.s.bout).toBeUndefined();
  });

  it('a loss earns no word and takes no stripe; a draw earns no win', async () => {
    const { a } = await setup();
    a.s.profile!.diary = ['diary.rua.academia'];
    a.s.profile!.bjj = { belt: 'branca', stripes: 1, wins: 5, unlocked: ['collar_tie', 'sleeve_grip'] };
    await start(a);
    await holdOut(a, 0, 4);
    const end = a.last('end')!;
    expect(end).toMatchObject({ winner: 'partner', rv: ROLL_RV_LOSS, stripeUp: false, beltUp: false });
    expect(end.word ?? null).toBeNull();
    expect(a.s.profile!.bjj).toMatchObject({ belt: 'branca', stripes: 1, wins: 5 });
    await start(a);
    await holdOut(a, 1, 1);
    expect(a.last('end')!.winner).toBe('draw');
    expect(a.s.profile!.bjj).toMatchObject({ wins: 5 });
  });

  it('the fifth win starts the professor drill: the new move as a slow chain with no timer, then it is yours', async () => {
    const { a } = await setup();
    a.s.profile!.bjj = { belt: 'branca', stripes: 0, wins: 4, unlocked: ['collar_tie'] };
    await start(a);
    await holdOut(a, 2, 0);
    const drill = a.last('chain')!;
    expect(drill).toMatchObject({ drill: true, move: { id: 'sleeve_grip' }, cmds: ['pega'], windowMs: [0], line: { pt: 'Agora você.' } });
    expect(a.s.profile!.bjj).toMatchObject({ belt: 'branca', stripes: 1, wins: 5, pendingDrill: 'sleeve_grip' });
    advance(60_000);
    expect(a.last('end')).toBeUndefined();
    // a wrong button is not the next step
    await a.send({ t: 'bout', v: 2, action: 'tap', seq: drill.seq, step: 0, cmd: 'gira', ms: 0 });
    expect(a.s.profile!.bjj?.pendingDrill).toBe('sleeve_grip');
    await a.send({ t: 'bout', v: 2, action: 'tap', seq: drill.seq, step: 0, cmd: 'pega', ms: 0 });
    advance(2000);
    const end = a.last('end')!;
    expect(end.stripeUp).toBe(true);
    expect(end.word).toEqual({ pt: 'academia', en: 'gym' });
    expect(a.s.profile!.bjj?.unlocked).toContain('sleeve_grip');
    expect(a.s.profile!.bjj?.pendingDrill).toBeUndefined();
    expect(a.s.bout).toBeUndefined();
  });

  it('a pending drill is still there on the next visit, and twenty wins put on the blue belt', async () => {
    const { world, a } = await setup();
    a.s.profile!.bjj = { belt: 'branca', stripes: 1, wins: 5, unlocked: ['collar_tie'], pendingDrill: 'sleeve_grip' };
    await a.send({ t: 'bout', v: 2, action: 'open' });
    expect(a.last('chain')).toMatchObject({ drill: true, move: { id: 'sleeve_grip' } });
    expect(a.last('lobby')).toBeUndefined();
    await a.send({ t: 'bout', v: 2, action: 'quit' });
    a.s.profile!.bjj = { belt: 'branca', stripes: 3, wins: 19, unlocked: ['collar_tie', 'sleeve_grip', 'double_leg', 'body_lock'] };
    await start(a);
    await holdOut(a, 2, 0);
    expect(a.last('chain')).toMatchObject({ drill: true, move: { id: 'scissor_sweep' }, cmds: ['puxa', 'empurra', 'gira'] });
    expect(a.s.profile!.bjj).toMatchObject({ belt: 'azul', stripes: 0, wins: 20, pendingDrill: 'scissor_sweep' });
    expect(world.publicAvatar(a.s).belt).toBe('azul');
  });

  it('nobody picking is not stuck: Hold is played, and an idle bout pays nothing', async () => {
    const { a } = await setup();
    const coins0 = a.s.profile!.coins;
    await start(a);
    advance(1000);
    const p = a.last('pick')!;
    advance(p.pickMs + 1000);
    expect(a.bout().some((m) => m.phase === 'resolve' && m.how === 'hold' && m.actor === 'you')).toBe(true);
    advance(30 * 60_000);
    const end = a.last('end')!;
    expect(end.rv).toBe(0);
    expect(end.winner).not.toBe('you');
    expect(a.s.profile!.coins).toBe(coins0);
    expect(a.s.bout).toBeUndefined();
  });

  it('quitting pays nothing and clears the bout; leaving the room too; a second start is ignored; a rematch is fresh', async () => {
    const { a } = await setup();
    const coins0 = a.s.profile!.coins;
    await start(a);
    advance(1000);
    await a.send({ t: 'bout', v: 2, action: 'quit' });
    expect(a.last('end')).toMatchObject({ winner: 'none', reason: 'quit', rv: 0 });
    expect(a.s.profile!.coins).toBe(coins0);
    await start(a);
    const token = a.s.bout!.token;
    await start(a);
    expect(a.s.bout!.token).toBe(token);
    await a.send({ t: 'join', room: 'praca' });
    expect(a.s.bout).toBeUndefined();
    const n0 = a.bout().length;
    advance(60_000);
    expect(a.bout().length).toBe(n0);
    await a.send({ t: 'join', room: 'academia' });
    await start(a);
    await holdOut(a, 0, 2);
    expect(a.last('end')!.rematchSamePosition).toBe(true);
    await a.send({ t: 'bout', v: 2, action: 'start', partner: 'mateus', rematch: true });
    advance(500);
    expect(a.s.bout!.mat).toMatchObject({ turnsUsed: 0, points: { you: 0, them: 0 }, position: { kind: 'standing' } });
  });

  it('a profile saved with only the old fields follows the win count', async () => {
    const { a } = await setup();
    a.s.profile!.bjj = { belt: 'azul', stripes: 0, wins: 10, unlocked: [] };
    await a.send({ t: 'bout', v: 2, action: 'open' });
    const lobby = a.last('lobby')!;
    expect(lobby.bjj).toMatchObject({ belt: 'branca', stripes: 2, wins: 10 });
    expect(lobby.partners.filter((p) => p.unlocked).map((p) => p.id)).toEqual(['mateus', 'felipe', 'helena']);
  });

  it('an academy floor has its own mat: a bout runs there', async () => {
    const { a } = await setup();
    a.s.profile!.bjj = { belt: 'marrom', stripes: 0, wins: 140, unlocked: [] };
    await a.send({ t: 'academy', action: 'directory' });
    await a.send({ t: 'academy', action: 'found', name: 'Equipe Teste', crest: 'ipe', giColor: 'azul', giStamp: 'sol' });
    expect(a.s.instance?.def.id).toBe('andar');
    await a.send({ t: 'bout', v: 2, action: 'open' });
    expect(a.last('lobby')).toBeDefined();
    await start(a);
    await play(a);
    expect(a.last('end')).toBeDefined();
  });
});
