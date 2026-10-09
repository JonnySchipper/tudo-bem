import { beforeEach, describe, expect, it } from 'vitest';
import {
  CLOCK_OFFSET_MS,
  DEFAULT_APPEARANCE,
  DIARY_WORDS,
  ECONOMY,
  ESCOLA_LESSON,
  ESCOLA_MAX_BOX,
  ESCOLA_RV,
  ESCOLA_XP,
  GAME_DAY_MS,
  LUCIA_LINES,
  MS_PER_GAME_MINUTE,
  NAMEPLATE_TIERS,
  diaryWord,
  localDay,
  wordCounts,
  type ClientMsg,
  type ServerMsg,
} from '@tudobem/shared';
import { World, type Session } from './world.js';
import { ProfileStore, normalizeProfile, type StoredProfile } from './store.js';
import { AuthoredNpcDialogue, InMemoryStudentModel, JevStubSafety, MemoryModerationQueue, PhrasebookGloss } from './services/stubs.js';
import { playLesson, rightAnswer, type EscolaClient } from './escolaTestKit.js';

let clock = 0;
function setGameTime(h: number, day = 3) {
  clock = day * GAME_DAY_MS + h * 60 * MS_PER_GAME_MINUTE - CLOCK_OFFSET_MS;
}

function makeWorld(rng?: () => number) {
  return new World(
    new ProfileStore(null),
    { safety: new JevStubSafety(), gloss: new PhrasebookGloss(), npc: new AuthoredNpcDialogue(), student: new InMemoryStudentModel(), moderation: new MemoryModerationQueue() },
    { mgGapMs: 0, now: () => clock, schedule: () => {}, ...(rng ? { rng } : {}) },
  );
}

interface Client extends EscolaClient {
  s: Session;
  all: <T extends ServerMsg['t']>(t: T) => Extract<ServerMsg, { t: T }>[];
}

let n = 0;
async function client(world: World, name = `Esc${n++}`, room: 'escola' | 'praca' = 'escola'): Promise<Client> {
  const inbox: ServerMsg[] = [];
  const s = world.connect(`e${n++}`, (m) => inbox.push(m), () => {});
  const c: Client = {
    s,
    inbox,
    send: (m: ClientMsg) => world.handle(s, m),
    held: () => s.profile?.diary ?? [],
    all: (t) => inbox.filter((m) => m.t === t) as never,
  };
  await c.send({ t: 'hello' });
  await c.send({ t: 'createProfile', name, pronoun: 'ela', appearance: DEFAULT_APPEARANCE });
  await c.send({ t: 'join', room });
  await c.send({ t: 'arrival', action: 'finish' });
  return c;
}

const escolaMsgs = (c: Client) => c.all('escola');
const seed = (world: World, c: Client, o: { words: number; mastered?: number; ready?: number; streak?: number }) =>
  expect(world.testSeedEscola(c.s.profile!.name, { mastered: 0, ready: 0, streak: 0, ...o })).toBe(true);

describe('escola lessons on the server', () => {
  beforeEach(() => setGameTime(10));

  it('only deals a lesson at Dona Lúcia’s desk, and not from an empty diary', async () => {
    const world = makeWorld();
    const far = await client(world, 'Longe', 'praca');
    await far.send({ t: 'escola', action: 'start' });
    expect(escolaMsgs(far).at(-1)).toMatchObject({ phase: 'closed' });
    expect(escolaMsgs(far).some((m) => m.phase === 'exercise')).toBe(false);

    const empty = await client(world, 'Vazio');
    empty.s.profile!.diary = [];
    await empty.send({ t: 'escola', action: 'start' });
    expect(escolaMsgs(empty).at(-1)).toMatchObject({ phase: 'closed', line: LUCIA_LINES.greetEmpty });
  });

  it('deals exercises without their answers, checks every try, and commits strength, XP, streak, RV and the lesson word', async () => {
    const world = makeWorld();
    const a = await client(world);
    seed(world, a, { words: 12 });
    const coins = a.s.profile!.coins;
    const { msgs, summary } = await playLesson(a);
    const dealt = msgs.filter((m): m is Extract<typeof m, { phase: 'exercise' }> => m.phase === 'exercise');
    expect(dealt.length).toBeGreaterThanOrEqual(ESCOLA_LESSON.minExercises);
    expect(dealt.length).toBeLessThanOrEqual(ESCOLA_LESSON.exercises);
    // the views carry the prompt and the cards, never which card is right
    for (const m of dealt) {
      const json = JSON.stringify(m.ex);
      // match property names only (followed by ':'), so an option like "key" is not a leak
      expect(json).not.toMatch(/"(answer|correct|pairs|key|wordId)":/);
    }
    // several exercise shapes in one lesson (a new word is recognised, heard, and the diary is big enough for the match race)
    expect(new Set(dealt.map((m) => m.ex.kind)).size).toBeGreaterThanOrEqual(3);
    expect(dealt.some((m) => m.ex.kind === 'match')).toBe(true);
    const checked = msgs.filter((m) => m.phase === 'checked');
    expect(checked.every((m) => m.phase === 'checked' && m.correct)).toBe(true);

    expect(summary.perfect).toBe(true);
    expect(summary.accuracy).toBe(100);
    expect(summary.streak).toBe(1);
    expect(summary.streakExtended).toBe(true);
    const answerXp = checked.reduce((s, m) => s + (m.phase === 'checked' ? m.xp : 0), 0);
    expect(summary.xp).toBe(answerXp + ESCOLA_XP.lesson + ESCOLA_XP.perfect);
    expect(summary.rv).toBe(Math.min(ESCOLA_RV.perLesson, summary.right));
    expect(a.s.profile!.coins).toBe(coins + summary.rv);
    expect(summary.granted).toEqual({ pt: 'aula', en: 'class' });
    expect(summary.strengthened.length).toBeGreaterThan(0);
    expect(summary.strengthened.every((w) => w.to === w.from + 1)).toBe(true);
    expect(summary.tier).toBe('verde');
    expect(summary.mission?.line.pt).toMatch(/^Falta/);

    const st = a.s.profile!.escola!;
    expect(st.lessons).toBe(1);
    expect(st.xp).toBe(summary.xp);
    expect(st.lastDay).toBe(localDay(clock, st.tz));
    expect(Object.values(st.words).every((w) => w.b === 1)).toBe(true);

    // a second lesson the same day: the words (box 1, due at once) go up again; the streak does not count the day twice
    const second = await playLesson(a);
    expect(second.summary.streak).toBe(1);
    expect(second.summary.streakExtended).toBe(false);
    expect(second.summary.granted).toBeNull();
    expect(Object.values(a.s.profile!.escola!.words).some((w) => w.b === 2)).toBe(true);
  });

  it('a miss shows the right answer, resets the combo, comes back at the end, and weakens the word', async () => {
    const world = makeWorld();
    const a = await client(world);
    seed(world, a, { words: 3, ready: 3 });
    const { msgs, summary } = await playLesson(a, (i) => i === 0);
    const first = msgs.find((m) => m.phase === 'checked');
    expect(first).toMatchObject({ correct: false, combo: 0, xp: 0, retry: true, line: LUCIA_LINES.wrong });
    if (first?.phase === 'checked') expect(first.reveal.pt).toBeTruthy();
    const dealt = msgs.filter((m): m is Extract<typeof m, { phase: 'exercise' }> => m.phase === 'exercise');
    expect(dealt.at(-1)?.retry).toBe(true);
    expect(summary.perfect).toBe(false);
    expect(summary.accuracy).toBeLessThan(100);
    // the missed word dropped two boxes (4 -> 2) and is due at once; the other ready words went up to mastered
    const missed = first?.phase === 'checked' ? DIARY_WORDS.find((w) => w.pt === first.reveal.pt && a.held().includes(w.id))! : null;
    const st = a.s.profile!.escola!;
    expect(st.words[missed!.id]).toMatchObject({ b: ESCOLA_MAX_BOX - 3, due: clock, miss: 1 });
    expect(Object.values(st.words).filter((w) => w.b === ESCOLA_MAX_BOX)).toHaveLength(2);
  });

  it('the typed answer forgives a missing accent with “quase! faltou o acento”', async () => {
    const world = makeWorld();
    const a = await client(world);
    a.s.profile!.diary = [];
    seed(world, a, { words: 0 });
    // one accented word, strong enough that it is typed
    const word = DIARY_WORDS.find((w) => /[áéíóúâêôãõç]/.test(w.pt) && !w.pt.includes(' ') && w.source === 'camera')!;
    a.s.profile!.diary = [word.id];
    a.s.profile!.escola = { ...a.s.profile!.escola!, words: { [word.id]: { b: 4, due: 0, last: 0, n: 4, miss: 0 } } };
    await a.send({ t: 'escola', action: 'start' });
    const ex = escolaMsgs(a).find((m) => m.phase === 'exercise');
    if (ex?.phase !== 'exercise') throw new Error('no exercise');
    expect(ex.ex.kind).toBe('type');
    const bare = word.pt.normalize('NFD').replace(/[̀-ͯ]/g, '');
    await a.send({ t: 'escola', action: 'answer', text: bare });
    expect(escolaMsgs(a).at(-1)).toMatchObject({ phase: 'checked', correct: true, almost: 'accent', line: LUCIA_LINES.accent });
  });

  it('earns the amarelo plate at 15 words mastered: the profile, the room and the friends list see it', async () => {
    const world = makeWorld();
    const a = await client(world, 'Lia');
    const b = await client(world, 'Bia');
    seed(world, a, { words: 20, mastered: 14, ready: 3 });
    expect(a.s.profile!.nameplate).toBe('verde');
    const { summary } = await playLesson(a);
    expect(summary.tierUp).toBe('amarelo');
    expect(summary.tier).toBe('amarelo');
    expect(summary.newlyMastered).toBeGreaterThanOrEqual(1);
    expect(summary.line.pt).toMatch(/amarela/);
    expect(a.s.profile!.nameplate).toBe('amarelo');
    expect(a.s.profile!.escola!.tier).toBe('amarelo');
    // Bia, in the same room, sees the new plate and a short line about it
    const seen = b.all('avatarUpdated').filter((m) => m.avatar.id === a.s.profile!.id).at(-1);
    expect(seen?.avatar.nameplate).toBe('amarelo');
    expect(b.all('notice').some((m) => /Lia ganhou a placa amarela/.test(m.pt))).toBe(true);
    // a fresh session sees it too (the plate is persisted, not recomputed from a session)
    const next = summary.progress;
    expect(next.next?.tier).toBe('azul');
    expect(next.need).toBe(NAMEPLATE_TIERS[2]!.mastered - next.mastered);

    // friends see it in their list
    await b.send({ t: 'friend', action: 'request', targetId: a.s.profile!.id });
    await a.send({ t: 'friend', action: 'accept', targetId: b.s.profile!.id });
    await b.send({ t: 'friends' });
    expect(b.all('friends').at(-1)?.friends.find((f) => f.id === a.s.profile!.id)?.nameplate).toBe('amarelo');
  });

  it('pays the word mission once when a new word is found in its area today', async () => {
    const world = makeWorld(() => 0);
    const a = await client(world);
    seed(world, a, { words: 6 });
    await playLesson(a);
    const st = a.s.profile!.escola!;
    st.mission = { day: localDay(clock, st.tz), area: 'padaria', done: false };
    const xp = st.dayXp;
    const diary = (world as unknown as { diary: { onCorreriaWin: (s: Session, items: string[]) => void } }).diary;
    diary.onCorreriaWin(a.s, ['bolo']);
    expect(diaryWord('diary.padaria.bolo')?.area).toBe('padaria');
    expect(a.s.profile!.escola!.dayXp).toBe(xp + ESCOLA_XP.mission);
    expect(a.s.profile!.escola!.mission?.done).toBe(true);
    expect(a.all('notice').some((m) => /Missão de palavras/.test(m.pt))).toBe(true);
    diary.onCorreriaWin(a.s, ['coxinha']);
    expect(a.s.profile!.escola!.dayXp).toBe(xp + ESCOLA_XP.mission);
  });

  it('caps the RV per day, so the desk is not a farm', async () => {
    const world = makeWorld();
    const a = await client(world);
    seed(world, a, { words: 30 });
    const coins = a.s.profile!.coins;
    let paid = 0;
    for (let i = 0; i < 6; i++) paid += (await playLesson(a)).summary.rv;
    expect(paid).toBe(ESCOLA_RV.perDay);
    expect(a.s.profile!.coins).toBe(coins + ESCOLA_RV.perDay);
    expect(coins).toBeGreaterThanOrEqual(ECONOMY.startingCoins);
  });

  it('a lesson left halfway still strengthens what was answered, without the finishing bonus or a streak day', async () => {
    const world = makeWorld();
    const a = await client(world);
    seed(world, a, { words: 4 });
    await a.send({ t: 'escola', action: 'start' });
    const ex = escolaMsgs(a).find((m) => m.phase === 'exercise');
    if (ex?.phase !== 'exercise') throw new Error('no exercise');
    for (const m of rightAnswer(a, ex.ex)) await a.send(m);
    await a.send({ t: 'escola', action: 'quit' });
    const st = a.s.profile!.escola!;
    expect(Object.values(st.words).filter((w) => w.b >= 1).length).toBeGreaterThan(0);
    expect(st.lessons).toBe(0);
    expect(st.streak).toBe(0);
    expect(escolaMsgs(a).some((m) => m.phase === 'done')).toBe(false);
    // the lesson is gone: a stray answer does nothing
    await a.send({ t: 'escola', action: 'next' });
    expect(escolaMsgs(a).at(-1)?.phase).toBe('checked');
  });

  it('sets the daily goal to 10, 20 or 30 XP only', async () => {
    const world = makeWorld();
    const a = await client(world);
    await a.send({ t: 'escola', action: 'goal', goal: 30 });
    expect(a.s.profile!.escola!.goal).toBe(30);
    await a.send({ t: 'escola', action: 'goal', goal: 999 });
    expect(a.s.profile!.escola!.goal).toBe(30);
  });
});

describe('escola profile migration', () => {
  const old = (extra: Partial<StoredProfile> = {}): StoredProfile =>
    ({
      id: 'p1',
      token: 't',
      ageGate18: true,
      name: 'Velha',
      pronoun: 'ela',
      appearance: DEFAULT_APPEARANCE,
      nameplate: 'verde',
      coins: 10,
      hats: [],
      hat: null,
      furniture: {},
      apartment: [],
      parrotOwned: false,
      parrotEquipped: false,
      friends: [],
      tutorial: {},
      tutorialRewarded: false,
      createdAt: 0,
      daily: { date: '2026-01-01', sceneClears: {} },
      lastSeen: 0,
      diary: DIARY_WORDS.slice(0, 40).map((w) => w.id),
      ...extra,
    }) as StoredProfile;

  it('a save from before the escola: every diary word learned, none mastered, the plate Verde', () => {
    const p = normalizeProfile(old());
    expect(p.escola).toMatchObject({ words: {}, xp: 0, streak: 0, tier: 'verde', goal: 10 });
    expect(p.nameplate).toBe('verde');
    const counts = wordCounts(p.escola!, p.diary, 0);
    expect(counts).toMatchObject({ learned: p.diary!.length, studied: 0, mastered: 0, fresh: p.diary!.length });
  });

  it('keeps an earned tier, drops strength for words no longer in the diary, and is idempotent', () => {
    const [w0, w1] = [DIARY_WORDS[0]!.id, 'not.a.word'];
    const p = normalizeProfile(
      old({ nameplate: 'verde', escola: { words: { [w0]: { b: 9, due: 1, last: 1, n: 1, miss: 0 }, [w1]: { b: 3, due: 0, last: 0, n: 1, miss: 0 } }, tier: 'azul', goal: 7 } as never }),
    );
    expect(p.escola!.words[w0]!.b).toBe(ESCOLA_MAX_BOX);
    expect(p.escola!.words[w1]).toBeUndefined();
    expect(p.escola!.goal).toBe(10);
    expect(p.escola!.tier).toBe('azul');
    expect(p.nameplate).toBe('azul');
    expect(normalizeProfile(structuredClone(p))).toEqual(p);
  });
});
