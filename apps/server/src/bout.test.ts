import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_APPEARANCE,
  MAT_INTENT_REVEAL_MS,
  MAT_TURNS,
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
  a.s.profile!.bjj = { belt: 'branca', stripes: 0, wins: 0, unlocked: ['collar_tie'] };
  await a.send({ t: 'join', room: 'academia' });
  return { world, a };
}

/** Pick whatever is offered until the match or the professor drill ends the turn loop. */
async function play(a: Client) {
  const answeredSeqs = new Set<number>();
  for (let guard = 0; guard < 80; guard++) {
    if (a.last('end') || a.last('drill')) return;
    const m = a.lastBout();
    if (m?.phase === 'intent' && !answeredSeqs.has(m.seq)) {
      answeredSeqs.add(m.seq);
      await a.send({ t: 'bout', v: 1, action: 'intent', seq: m.seq, intent: m.intents[0]!.id });
    }
    advance(40);
  }
  throw new Error('bout did not finish: ' + JSON.stringify(a.lastBout()).slice(0, 300));
}

const start = async (a: Client, partner = 'mateus') => {
  await a.send({ t: 'bout', v: 1, action: 'start', partner: partner as 'mateus' });
};

/** The player's tenth turn is Hold, so the score on the mat decides the match. */
async function holdOut(a: Client, you: number, them: number) {
  advance(1000);
  const b = a.s.bout!;
  b.mat.turnsUsed = MAT_TURNS - 1;
  b.mat.points = { you, them };
  b.mat.actor = 'you';
  b.mat.over = false;
  b.mat.winner = null;
  const intent = a.last('intent')!;
  await a.send({ t: 'bout', v: 1, action: 'intent', seq: intent.seq, intent: 'hold' });
  advance(2000);
}

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
    expect(lobby.bjj.unlocked).toEqual(['collar_tie', 'double_leg', 'hook_sweep', 'posture', 'passar', 'armbar']);
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
    await a.send({ t: 'join', room: 'academia' });
    await a.send({ t: 'bout', v: 2 as never, action: 'start', partner: 'mateus' });
    expect(a.inbox.at(-1)).toMatchObject({ t: 'error', code: 'bout' });
    expect(a.s.bout).toBeUndefined();
  });

  it('shows the percent before a move, and Hold has none', async () => {
    const { a } = await setup();
    await start(a);
    advance(1000);
    const intent = a.last('intent')!;
    expect(intent.st.exchange).toBe(0);
    expect(intent.st.position).toBe('de_pe');
    const collar = intent.intents.find((i) => i.id === 'collar_tie')!;
    const hold = intent.intents.find((i) => i.id === 'hold')!;
    expect(collar.percent).toBe(70);
    expect(collar.sets).toEqual({ pt: 'Queda +25% · abre Arrastar', en: 'Takedown +25% · opens Drag' });
    expect(hold.percent).toBeUndefined();
    // every throw waits for a grip: Queda is owned, not on offer, and says why
    expect(intent.intents.some((i) => i.id === 'double_leg')).toBe(false);
    expect(intent.owned?.find((i) => i.id === 'double_leg')?.needs).toEqual({ pt: 'Precisa de uma pegada', en: 'Needs a grip' });
    expect(intent.intents.find((i) => i.id === 'posture')?.percent).toBe(55);
    // the partner telegraphs before you choose, by name, and the meter starts level
    expect(intent.plan?.line.pt.startsWith('Mateus vai')).toBe(true);
    expect(intent.plan?.line.en.startsWith('Mateus ')).toBe(true);
    expect(intent.st.meter).toBe(0);
    expect(intent.st.grips).toEqual({ you: { collar: false, sleeve: false, age: { collar: 0, sleeve: 0 } }, partner: { collar: false, sleeve: false, age: { collar: 0, sleeve: 0 } } });
    expect(intent.intents.some((i) => i.id === 'body_lock')).toBe(false);
    expect(intent.intents.some((i) => i.id === 'hook_sweep')).toBe(false);
    expect(intent.intents.some((i) => i.id === 'armbar')).toBe(false);
    expect(intent.intents.some((i) => i.id === 'passar')).toBe(false);
    expect(intent.owned?.find((i) => i.id === 'passar')?.percent).toBe(50);
    expect(intent.owned?.find((i) => i.id === 'armbar')?.percent).toBe(18);
    expect(intent.owned?.find((i) => i.id === 'hook_sweep')?.percent).toBe(38);
    expect(intent.owned?.find((i) => i.id === 'double_leg')?.percent).toBe(45);
    const standing = intent.intents.filter((i) => i.id !== 'hold');
    expect(standing.map((i) => i.id).sort()).toEqual(['collar_tie', 'posture']);
    expect(Math.max(...standing.map((i) => i.percent ?? 0))).toBe(70);
    expect(a.last('challenge')).toBeUndefined();
  });

  it('a connected takedown carries a whoosh, a mount a thump, a submission attempt the same tone either way', async () => {
    const { a } = await setup();
    a.s.profile!.bjj = { belt: 'branca', stripes: 2, wins: 10, unlocked: ['collar_tie', 'sleeve_grip', 'double_leg', 'knee_on_belly'] };
    await start(a);
    advance(1000);
    a.s.bout!.rng = () => 0;
    const grip = a.last('intent')!;
    await a.send({ t: 'bout', v: 1, action: 'intent', seq: grip.seq, intent: 'collar_tie' });
    const gripped = a.last('resolve')!;
    expect(gripped.sound).toBe('hit');
    expect(gripped.grip).toEqual([{ kind: 'grip', side: 'you', grip: 'collar' }]);
    expect(gripped.st.grips?.you.collar).toBe(true);
    expect(gripped.meterTo!).toBeGreaterThan(gripped.meterFrom!);

    a.s.profile!.bjj = { belt: 'branca', stripes: 2, wins: 10, unlocked: ['collar_tie', 'sleeve_grip', 'double_leg', 'knee_on_belly'] };
    await a.send({ t: 'bout', v: 1, action: 'quit' });
    await start(a);
    advance(1000);
    a.s.bout!.rng = () => 0;
    a.s.bout!.mat.grips.you.collar = true;
    const td = a.last('intent')!;
    await a.send({ t: 'bout', v: 1, action: 'intent', seq: td.seq, intent: 'double_leg' });
    const whoosh = a.last('resolve')!;
    expect(whoosh.sound).toBe('whoosh');
    expect(whoosh.percent).toBe(70);
    expect(whoosh.st.points.you).toBe(2);
    expect(whoosh.st.position).toBe('cem_quilos');

    await a.send({ t: 'bout', v: 1, action: 'quit' });
    a.s.profile!.bjj = {
      belt: 'azul',
      stripes: 0,
      wins: 20,
      unlocked: ['collar_tie', 'sleeve_grip', 'double_leg', 'body_lock', 'sprawl', 'scissor_sweep'],
    };
    await start(a);
    advance(1000);
    a.s.bout!.mat.position = { kind: 'closed_guard', top: 'them' };
    a.s.bout!.rng = () => 0;
    const sweep = a.last('intent')!;
    await a.send({ t: 'bout', v: 1, action: 'intent', seq: sweep.seq, intent: 'scissor_sweep' });
    const mounted = a.last('resolve')!;
    expect(mounted.sound).toBe('mount');
    expect(mounted.st.position).toBe('montada');

    await a.send({ t: 'bout', v: 1, action: 'quit' });
    a.s.profile!.bjj = {
      belt: 'azul',
      stripes: 3,
      wins: 50,
      unlocked: ['collar_tie', 'sleeve_grip', 'double_leg', 'body_lock', 'sprawl', 'scissor_sweep', 'hip_bump', 'frame', 'escape_back', 'armbar'],
    };
    await start(a);
    advance(1000);
    a.s.bout!.mat.position = { kind: 'mount', top: 'you' };
    a.s.bout!.rng = () => 0.99;
    const miss = a.last('intent')!;
    await a.send({ t: 'bout', v: 1, action: 'intent', seq: miss.seq, intent: 'armbar' });
    const sub = a.last('resolve')!;
    expect(sub.sound).toBe('sub');
    expect(sub.st.position).toBe('guarda_fechada');
    expect(sub.st.ahead).toBe('partner');
  });

  it('a win pays one diary word and keeps the belt on the account after the match is gone', async () => {
    const { a } = await setup();
    const coins0 = a.s.profile!.coins;
    await start(a);
    await holdOut(a, 2, 0);
    const end = a.last('end')!;
    expect(end.winner).toBe('you');
    expect(end.reason).toBe('pontos');
    expect(end.rv).toBe(ROLL_RV_WIN);
    expect(end.word).toEqual({ pt: 'academia', en: 'gym' });
    expect(end.stripeUp).toBe(false);
    expect(a.s.profile!.coins).toBe(coins0 + end.rv);
    expect(a.s.profile!.bjj).toMatchObject({ belt: 'branca', stripes: 0, wins: 1, unlocked: ['collar_tie', 'double_leg', 'hook_sweep', 'posture', 'passar', 'armbar'] });
    expect(a.s.profile!.diary).toEqual(['diary.rua.academia']);
    expect(a.s.bout).toBeUndefined();
    await a.send({ t: 'bout', v: 1, action: 'open' });
    expect(a.last('lobby')!.bjj.wins).toBe(1);
  });

  it('a loss earns no word and takes no stripe', async () => {
    const { a } = await setup();
    a.s.profile!.diary = ['diary.rua.academia'];
    a.s.profile!.bjj = { belt: 'branca', stripes: 1, wins: 5, unlocked: ['collar_tie', 'sleeve_grip'] };
    await start(a);
    await holdOut(a, 0, 4);
    const end = a.last('end')!;
    expect(end.winner).toBe('partner');
    expect(end.rv).toBe(ROLL_RV_LOSS);
    expect(end.word ?? null).toBeNull();
    expect(end.stripeUp).toBe(false);
    expect(end.beltUp).toBe(false);
    expect(a.s.profile!.bjj).toMatchObject({ belt: 'branca', stripes: 1, wins: 5 });
    expect(a.s.profile!.diary).toEqual(['diary.rua.academia']);
  });

  it('a draw earns no win and takes no stripe', async () => {
    const { a } = await setup();
    a.s.profile!.bjj = { belt: 'branca', stripes: 1, wins: 5, unlocked: ['collar_tie', 'sleeve_grip'] };
    await start(a);
    await holdOut(a, 1, 1);
    const end = a.last('end')!;
    expect(end.winner).toBe('draw');
    expect(end.stripeUp).toBe(false);
    expect(end.beltUp).toBe(false);
    expect(a.s.profile!.bjj).toMatchObject({ belt: 'branca', stripes: 1, wins: 5 });
  });

  it('the fifth win starts the professor drill, and landing it unlocks the move', async () => {
    const { a } = await setup();
    a.s.profile!.bjj = { belt: 'branca', stripes: 0, wins: 4, unlocked: ['collar_tie'] };
    await start(a);
    await holdOut(a, 2, 0);
    const drill = a.last('drill')!;
    expect(drill.move.id).toBe('sleeve_grip');
    expect(a.s.profile!.bjj).toMatchObject({ belt: 'branca', stripes: 1, wins: 5, pendingDrill: 'sleeve_grip' });
    expect(a.s.bout).toBeDefined();
    await a.send({ t: 'bout', v: 1, action: 'intent', seq: drill.seq, intent: 'sleeve_grip' });
    advance(2000);
    const end = a.last('end')!;
    expect(end.stripeUp).toBe(true);
    expect(end.word).toEqual({ pt: 'academia', en: 'gym' });
    expect(a.s.profile!.bjj?.unlocked).toEqual(['collar_tie', 'double_leg', 'hook_sweep', 'posture', 'passar', 'armbar', 'sleeve_grip']);
    expect(a.s.profile!.bjj?.pendingDrill).toBeUndefined();
    expect(a.s.bout).toBeUndefined();
  });

  it('a pending drill is still there on the next visit', async () => {
    const { a } = await setup();
    a.s.profile!.bjj = { belt: 'branca', stripes: 1, wins: 5, unlocked: ['collar_tie'], pendingDrill: 'sleeve_grip' };
    await a.send({ t: 'bout', v: 1, action: 'open' });
    expect(a.last('drill')!.move.id).toBe('sleeve_grip');
    expect(a.last('lobby')).toBeUndefined();
  });

  it('twenty wins put on the blue belt', async () => {
    const { world, a } = await setup();
    a.s.profile!.bjj = { belt: 'branca', stripes: 3, wins: 19, unlocked: ['collar_tie', 'sleeve_grip', 'double_leg', 'body_lock'] };
    await start(a);
    await holdOut(a, 2, 0);
    const drill = a.last('drill')!;
    expect(drill.move.id).toBe('scissor_sweep');
    expect(a.s.profile!.bjj).toMatchObject({ belt: 'azul', stripes: 0, wins: 20, pendingDrill: 'scissor_sweep' });
    expect(a.s.profile!.bjj?.unlocked).toContain('sprawl');
    expect(a.inbox.some((m) => m.t === 'avatarUpdated' && m.avatar.belt === 'azul')).toBe(true);
    expect(world.publicAvatar(a.s).belt).toBe('azul');
  });

  it('plays a full ten-turn match without a quiz', async () => {
    const { a } = await setup();
    await start(a);
    const intro = a.last('intro')!;
    expect(intro.partner.id).toBe('mateus');
    expect(intro.line.pt).toBe('Combate!');
    await play(a);
    const end = a.last('end') ?? a.last('drill');
    expect(end).toBeTruthy();
    expect(a.last('challenge')).toBeUndefined();
    const resolves = a.bout().filter((m) => m.phase === 'resolve');
    expect(resolves.length).toBeGreaterThan(0);
    expect(resolves.length).toBeLessThanOrEqual(MAT_TURNS);
  });

  it('ignores stale, foreign and impossible messages', async () => {
    const { a } = await setup();
    await start(a);
    advance(1000);
    const intent = a.last('intent')!;
    const n0 = a.bout().length;
    await a.send({ t: 'bout', v: 1, action: 'answer', seq: intent.seq, answer: { kind: 'choice', index: 0 } });
    await a.send({ t: 'bout', v: 1, action: 'intent', seq: intent.seq + 999, intent: 'hold' });
    await a.send({ t: 'bout', v: 1, action: 'intent', seq: intent.seq, intent: 'nope' });
    await a.send({ t: 'bout', v: 1, action: 'intent', seq: intent.seq, intent: 'finalizar' });
    expect(a.bout().length).toBe(n0);
    await a.send({ t: 'bout', v: 1, action: 'intent', seq: intent.seq, intent: 'hold' });
    expect(a.last('resolve')).toBeTruthy();
  });

  it('a later pick waits out the cartoons and the think pause before Hold can fire', async () => {
    const { a } = await setup();
    await start(a);
    advance(1000);
    const first = a.last('intent')!;
    await a.send({ t: 'bout', v: 1, action: 'intent', seq: first.seq, intent: 'collar_tie' });
    advance(500);
    const second = a.last('intent')!;
    expect(second.seq).not.toBe(first.seq);
    const timed = () => a.bout().filter((m) => m.phase === 'resolve' && m.yours.timeout);
    expect(timed()).toHaveLength(0);
    // The offer itself is already on the wire. The advertised pick is not, until the reveal finishes.
    advance(second.pickMs + 1000);
    expect(timed()).toHaveLength(0);
    expect(a.last('intent')!.seq).toBe(second.seq);
    advance(MAT_INTENT_REVEAL_MS);
    expect(timed().length).toBeGreaterThan(0);
  });

  it('nobody picking a move is not stuck: Hold is played and pays nothing', async () => {
    const { a } = await setup();
    await start(a);
    advance(1000);
    const intent = a.last('intent')!;
    advance(intent.pickMs + 1000);
    const res = a.bout().find((m): m is Phase<'resolve'> => m.phase === 'resolve' && m.yours.timeout);
    expect(res?.sound).toBe('none');
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
    expect(end.word ?? null).toBeNull();
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

  it('rematch is one tap into a fresh standing match', async () => {
    const { a } = await setup();
    await start(a);
    await holdOut(a, 0, 2);
    const end = a.last('end')!;
    expect(end.rematchSamePosition).toBe(true);
    expect(end.winner).toBe('partner');
    await a.send({ t: 'bout', v: 1, action: 'start', partner: 'mateus', rematch: true });
    advance(500);
    expect(a.s.bout!.mat.turnsUsed).toBe(0);
    expect(a.s.bout!.mat.points).toEqual({ you: 0, them: 0 });
    expect(a.s.bout!.mat.position).toEqual({ kind: 'standing' });
    expect(a.last('intro')!.st.position).toBe('de_pe');
  });

  it('a profile saved with only the old fields follows the win count', async () => {
    const { a } = await setup();
    a.s.profile!.bjj = { belt: 'azul', stripes: 0, wins: 10, unlocked: [] };
    await a.send({ t: 'bout', v: 1, action: 'open' });
    const lobby = a.last('lobby')!;
    expect(lobby.bjj).toMatchObject({ belt: 'branca', stripes: 2, wins: 10 });
    expect(lobby.level).toBe(2);
    expect(lobby.partners.filter((p) => p.unlocked).map((p) => p.id)).toEqual(['mateus', 'felipe', 'helena']);
  });
});

describe('polish: partners and academy floors', () => {
  beforeEach(() => {
    pending.length = 0;
  });

  it('every offered move says what it does if it lands, and a held grip is not offered again', async () => {
    const { a } = await setup();
    await a.send({ t: 'bout', v: 1, action: 'start', partner: 'mateus' });
    advance(2000);
    const first = a.last('intent')!;
    for (const i of first.intents.filter((x) => x.id !== 'hold')) expect(i.effect, i.id).toBeDefined();
    await a.send({ t: 'bout', v: 1, action: 'intent', seq: first.seq, intent: 'collar_tie' });
    advance(20_000);
    const next = a.last('intent')!;
    expect(next.seq).not.toBe(first.seq);
    const mine = a.bout().find((m): m is Phase<'resolve'> => m.phase === 'resolve' && m.actor === 'you');
    // a landed collar tie is held, so it is not offered again; a missed one still is
    if (mine?.yours.correct) expect(next.intents.map((i) => i.id)).not.toContain('collar_tie');
    else expect(next.intents.map((i) => i.id)).toContain('collar_tie');
  });

  it('the intro carries the partner think time', async () => {
    const { a } = await setup();
    await a.send({ t: 'bout', v: 1, action: 'start', partner: 'mateus' });
    const intro = a.last('intro')!;
    expect(intro.thinkMs).toBeGreaterThanOrEqual(2000);
    expect(intro.thinkMs).toBeLessThanOrEqual(5000);
  });

  it('an academy floor has its own mat: a bout runs there', async () => {
    const { world, a } = await setup();
    a.s.profile!.bjj = { belt: 'marrom', stripes: 0, wins: 140, unlocked: [] };
    await a.send({ t: 'academy', action: 'directory' });
    await a.send({ t: 'academy', action: 'found', name: 'Equipe Teste', crest: 'ipe', giColor: 'azul', giStamp: 'sol' });
    expect(a.s.instance?.def.id).toBe('andar');
    await a.send({ t: 'bout', v: 1, action: 'open' });
    expect(a.last('lobby')).toBeDefined();
    await a.send({ t: 'bout', v: 1, action: 'start', partner: 'mateus' });
    await play(a);
    expect(a.last('end')).toBeDefined();
    void world;
  });
});
