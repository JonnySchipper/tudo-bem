import { describe, expect, it } from 'vitest';
import {
  AREA_IN,
  ESCOLA_FREEZE,
  ESCOLA_INTERVAL_MS,
  ESCOLA_LESSON,
  ESCOLA_MAX_BOX,
  ESCOLA_REVIEW_MS,
  ESCOLA_RV,
  NAMEPLATE_TIERS,
  addXp,
  areaHunts,
  bumpStreak,
  buildLine,
  checkExercise,
  checkPair,
  checkTyped,
  currentStreak,
  dealExercise,
  earnedTier,
  escolaPath,
  freshEscola,
  localDay,
  normalizeEscola,
  pickMission,
  planLesson,
  reviewWord,
  rvRoom,
  payRv,
  tierFor,
  tierProgress,
  wordCounts,
  type EscolaState,
} from './escola.js';
import { DIARY_WORDS, diaryWord } from './diary.js';
import { luciaGreeting, LUCIA_LINES } from './escolaCopy.js';

const H = 3_600_000;
const D = 24 * H;
const T0 = Date.parse('2026-10-08T12:00:00Z');

/** A deterministic rng. */
function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** The words of the hint templates themselves. */
const HINT_WORDS = new Set(['tire', 'foto', 'das', 'coisas', 'leia', 'as', 'placas', 'converse', 'com', 'o', 'pessoal', 'e', 'jogue', 'a', 'termine', 'uma', 'lição', 'dona', 'lúcia', 'seu', 'carlos', 'correria', 'no', 'balcão']);

const ids = (n: number, from = 0) => DIARY_WORDS.slice(from, from + n).map((w) => w.id);

function withBoxes(diary: string[], boxes: Record<string, number>, due = 0): EscolaState {
  const st = freshEscola();
  for (const [id, b] of Object.entries(boxes)) st.words[id] = { b, due, last: 0, n: b, miss: 0 };
  return normalizeEscola(st, diary);
}

describe('spaced repetition (Leitner boxes)', () => {
  it('a new word answered right goes to box 1, due at once; then up one box per due review with growing gaps', () => {
    let w = reviewWord(undefined, true, T0);
    expect(w).toMatchObject({ b: 1, due: T0, n: 1, miss: 0 });
    let now = T0;
    for (let b = 2; b <= ESCOLA_MAX_BOX; b++) {
      now = w.due;
      w = reviewWord(w, true, now);
      expect(w.b).toBe(b);
      expect(w.due - now).toBe(ESCOLA_INTERVAL_MS[b]);
    }
    // the gaps only grow
    const gaps = [1, 2, 3, 4, 5].map((b) => ESCOLA_INTERVAL_MS[b]!);
    expect([...gaps].sort((a, b) => a - b)).toEqual(gaps);
    // mastered and right again: it rests a week
    const rest = reviewWord(w, true, w.due);
    expect(rest).toMatchObject({ b: ESCOLA_MAX_BOX, due: w.due + ESCOLA_REVIEW_MS });
  });

  it('a word that is not due yet does not gain strength (no cramming)', () => {
    const w = { b: 2, due: T0 + H, last: T0, n: 2, miss: 0 };
    const again = reviewWord(w, true, T0 + 1000);
    expect(again.b).toBe(2);
    expect(again.due).toBe(T0 + H);
    expect(again.n).toBe(3);
  });

  it('a miss drops two boxes (never below 1) and is due at once', () => {
    expect(reviewWord({ b: 5, due: 0, last: 0, n: 5, miss: 0 }, false, T0)).toMatchObject({ b: 3, due: T0, miss: 1 });
    expect(reviewWord({ b: 2, due: 0, last: 0, n: 2, miss: 0 }, false, T0)).toMatchObject({ b: 1 });
    expect(reviewWord(undefined, false, T0)).toMatchObject({ b: 1, due: T0, miss: 1 });
  });

  it('mastering the first words takes about two days of short visits, not one long session', () => {
    let w = reviewWord(undefined, true, T0);
    let now = T0;
    let visits = 1;
    // lessons every 10 minutes for a whole day: only due visits count
    while (w.b < ESCOLA_MAX_BOX && now < T0 + 3 * D) {
      now += 10 * 60_000;
      w = reviewWord(w, true, now);
      visits++;
    }
    expect(w.b).toBe(ESCOLA_MAX_BOX);
    expect(now - T0).toBeGreaterThan(D);
    expect(now - T0).toBeLessThan(2 * D);
    expect(visits).toBeGreaterThan(4);
  });
});

describe('nameplate tiers', () => {
  it('thresholds: verde for everyone, amarelo 15, azul 60, roxo 150, dourado 300 with a 30-day streak', () => {
    expect(NAMEPLATE_TIERS.map((t) => [t.tier, t.mastered, t.streak ?? 0])).toEqual([
      ['verde', 0, 0],
      ['amarelo', 15, 0],
      ['azul', 60, 0],
      ['roxo', 150, 0],
      ['dourado', 300, 30],
    ]);
    expect(tierFor(0, 0)).toBe('verde');
    expect(tierFor(14, 99)).toBe('verde');
    expect(tierFor(15, 0)).toBe('amarelo');
    expect(tierFor(59, 0)).toBe('amarelo');
    expect(tierFor(60, 0)).toBe('azul');
    expect(tierFor(150, 0)).toBe('roxo');
    expect(tierFor(489, 29)).toBe('roxo');
    expect(tierFor(300, 30)).toBe('dourado');
  });

  it('every tier is reachable with the catalog as it is', () => {
    const top = NAMEPLATE_TIERS.at(-1)!;
    expect(DIARY_WORDS.length).toBeGreaterThanOrEqual(top.mastered);
  });

  it('counts mastered words from the diary only, and never takes an earned plate back', () => {
    const diary = ids(20);
    const boxes = Object.fromEntries(diary.slice(0, 15).map((id) => [id, ESCOLA_MAX_BOX]));
    const st = withBoxes(diary, boxes);
    expect(earnedTier(st, diary)).toBe('amarelo');
    // without those words in the diary they do not count
    expect(earnedTier(normalizeEscola(st, diary.slice(5)), diary.slice(5))).toBe('verde');
    // a stored plate stays even when a miss knocks a word back down
    st.tier = 'amarelo';
    st.words[diary[0]!]!.b = 3;
    expect(earnedTier(st, diary)).toBe('amarelo');
  });

  it('the progress bar runs from this tier to the next', () => {
    const diary = ids(40);
    const st = withBoxes(diary, Object.fromEntries(diary.slice(0, 30).map((id) => [id, ESCOLA_MAX_BOX])));
    const p = tierProgress(st, diary);
    expect(p).toMatchObject({ tier: 'amarelo', mastered: 30, need: 30 });
    expect(p.next?.tier).toBe('azul');
    expect(p.frac).toBeCloseTo((30 - 15) / (60 - 15));
  });
});

describe('streak, daily goal, RV cap', () => {
  it('counts the player’s own calendar day', () => {
    const late = Date.parse('2026-10-08T02:30:00Z');
    expect(localDay(late, 0)).toBe('2026-10-08');
    expect(localDay(late, -180)).toBe('2026-10-07'); // São Paulo, 23:30 the day before
    expect(localDay(late, 99999)).toBe(localDay(late, 14 * 60));
  });

  it('grows once a day, restarts after a missed day, and is bridged by an earned freeze', () => {
    const st = freshEscola();
    expect(bumpStreak(st, '2026-10-01')).toMatchObject({ streak: 1, extended: true });
    expect(bumpStreak(st, '2026-10-01')).toMatchObject({ streak: 1, extended: false });
    expect(bumpStreak(st, '2026-10-02').streak).toBe(2);
    expect(currentStreak(st, '2026-10-03')).toBe(2);
    expect(currentStreak(st, '2026-10-04')).toBe(0);
    expect(bumpStreak(st, '2026-10-05')).toMatchObject({ streak: 1 });
    expect(st.best).toBe(2);
  });

  it('a freeze is earned every 7 days (at most 2) and covers a missed day', () => {
    const st = freshEscola();
    for (let d = 1; d <= ESCOLA_FREEZE.every; d++) bumpStreak(st, `2026-10-${String(d).padStart(2, '0')}`);
    expect(st.streak).toBe(7);
    expect(st.freezes).toBe(1);
    // missed the 8th
    expect(currentStreak(st, '2026-10-09')).toBe(7);
    expect(bumpStreak(st, '2026-10-09')).toMatchObject({ streak: 8, usedFreezes: 1 });
    expect(st.freezes).toBe(0);
    for (let d = 10; d <= 30; d++) bumpStreak(st, `2026-10-${d}`);
    expect(st.freezes).toBeLessThanOrEqual(ESCOLA_FREEZE.max);
  });

  it('today’s XP resets on a new day and reports crossing the goal once', () => {
    const st = freshEscola();
    st.goal = 20;
    expect(addXp(st, '2026-10-08', 12)).toBe(false);
    expect(addXp(st, '2026-10-08', 9)).toBe(true);
    expect(addXp(st, '2026-10-08', 9)).toBe(false);
    expect(st.dayXp).toBe(30);
    expect(addXp(st, '2026-10-09', 1)).toBe(false);
    expect(st.dayXp).toBe(1);
    expect(st.xp).toBe(31);
  });

  it('RV is capped per lesson and per day', () => {
    const st = freshEscola();
    expect(rvRoom(st, '2026-10-08', 0)).toBe(ESCOLA_RV.perLesson);
    payRv(st, '2026-10-08', ESCOLA_RV.perDay - 4);
    expect(rvRoom(st, '2026-10-08', 0)).toBe(4);
    expect(rvRoom(st, '2026-10-09', 0)).toBe(ESCOLA_RV.perLesson);
  });

  it('Dona Lúcia greets by the streak', () => {
    expect(luciaGreeting({ words: 0, streak: 0, best: 0, goalMet: false })).toBe(LUCIA_LINES.greetEmpty);
    expect(luciaGreeting({ words: 5, streak: 0, best: 0, goalMet: false })).toBe(LUCIA_LINES.greetNew);
    expect(luciaGreeting({ words: 5, streak: 0, best: 4, goalMet: false })).toBe(LUCIA_LINES.greetLost);
    expect(luciaGreeting({ words: 5, streak: 3, best: 4, goalMet: false })).toBe(LUCIA_LINES.greetHot);
    expect(luciaGreeting({ words: 5, streak: 9, best: 9, goalMet: false })).toBe(LUCIA_LINES.greetWeek);
    expect(luciaGreeting({ words: 5, streak: 9, best: 9, goalMet: true })).toBe(LUCIA_LINES.greetDone);
  });
});

describe('planning a lesson', () => {
  it('due words come first (weakest first), then a few new ones; nothing new beyond the cap', () => {
    const diary = ids(30);
    const boxes: Record<string, number> = {};
    diary.slice(0, 3).forEach((id, i) => (boxes[id] = 3 - i)); // 3, 2, 1 — all due
    diary.slice(3, 8).forEach((id) => (boxes[id] = 4)); // not due
    const st = withBoxes(diary, boxes);
    for (const id of diary.slice(3, 8)) st.words[id]!.due = T0 + D;
    const plan = planLesson(st, diary, T0, seeded())!;
    expect(plan.focus.slice(0, 3)).toEqual([diary[2], diary[1], diary[0]]);
    const fresh = plan.focus.filter((id) => !st.words[id]);
    expect(fresh.length).toBe(ESCOLA_LESSON.newWords);
    expect(plan.focus.length).toBeLessThanOrEqual(ESCOLA_LESSON.words);
    expect(plan.exercises.length).toBeLessThanOrEqual(ESCOLA_LESSON.exercises);
    expect(plan.exercises.some((e) => e.kind === 'match' && e.wordIds.length === ESCOLA_LESSON.pairs)).toBe(true);
    // a new word is recognised before it is heard
    const firstNew = fresh[0]!;
    const kinds = plan.exercises.filter((e) => e.wordIds.length === 1 && e.wordIds[0] === firstNew).map((e) => e.kind);
    expect(kinds[0]).toBe('pick');
  });

  it('one word still makes a short lesson; no words make none', () => {
    const one = ids(1);
    const plan = planLesson(freshEscola(), one, T0, seeded())!;
    expect(plan.exercises.length).toBe(ESCOLA_LESSON.minExercises);
    expect(planLesson(freshEscola(), [], T0, seeded())).toBeNull();
  });

  it('a unit lesson keeps to its area when the diary has words there', () => {
    const feira = DIARY_WORDS.filter((w) => w.area === 'feira').slice(0, 6).map((w) => w.id);
    const diary = [...ids(10), ...feira];
    const plan = planLesson(freshEscola(), diary, T0, seeded(), 'feira')!;
    expect(plan.focus.every((id) => diaryWord(id)?.area === 'feira')).toBe(true);
    // a unit with nothing found yet falls back to the whole diary
    expect(planLesson(freshEscola(), ids(5), T0, seeded(), 'academia')).not.toBeNull();
  });

  it('strong words are typed or built; new words get recognition first', () => {
    const diary = ids(6);
    const st = withBoxes(diary, Object.fromEntries(diary.map((id) => [id, 4])));
    const plan = planLesson(st, diary, T0, seeded())!;
    const single = plan.exercises.filter((e) => e.kind !== 'match');
    expect(single.every((e) => e.kind === 'type' || e.kind === 'build')).toBe(true);
  });
});

describe('dealing and checking exercises', () => {
  const word = DIARY_WORDS.find((w) => w.id === 'diary.praca.arvore') ?? DIARY_WORDS.find((w) => /[áéíóú]/.test(w.pt))!;

  it('pick cards: the views hold four distinct options and only the key knows the answer', () => {
    for (const kind of ['pick', 'pick_en', 'listen'] as const) {
      const dealt = dealExercise({ kind, wordIds: [word.id] }, seeded(3))!;
      const opts = (dealt.view as { options: string[] }).options;
      expect(opts).toHaveLength(ESCOLA_LESSON.options);
      expect(new Set(opts.map((o) => o.toLowerCase())).size).toBe(opts.length);
      expect(JSON.stringify(dealt.view)).not.toMatch(/wordId|"answer"/);
      const right = kind === 'pick' ? word.pt : word.en;
      expect(opts).toContain(right);
      expect(checkExercise(dealt.key, { choice: right }).correct).toBe(true);
      expect(checkExercise(dealt.key, { choice: opts.find((o) => o !== right)! }).correct).toBe(false);
      expect(checkExercise(dealt.key, {}).correct).toBe(false);
    }
  });

  it('listening hides the Portuguese in the prompt and asks for its meaning', () => {
    const dealt = dealExercise({ kind: 'listen', wordIds: [word.id] }, seeded(5))!;
    expect(dealt.view.kind).toBe('listen');
    expect((dealt.view as { options: string[] }).options).not.toContain(word.pt);
  });

  it('typing forgives accents and a one-letter slip on longer words, with a note', () => {
    expect(checkTyped('árvore', 'árvore')).toEqual({ correct: true });
    expect(checkTyped(' Árvore ', 'árvore')).toEqual({ correct: true });
    expect(checkTyped('arvore', 'árvore')).toEqual({ correct: true, almost: 'accent' });
    expect(checkTyped('arvori', 'árvore')).toEqual({ correct: true, almost: 'typo' });
    expect(checkTyped('pao', 'pão')).toEqual({ correct: true, almost: 'accent' });
    expect(checkTyped('pai', 'pão')).toEqual({ correct: false });
    expect(checkTyped('', 'pão')).toEqual({ correct: false });
    expect(checkTyped('mesa', 'árvore')).toEqual({ correct: false });
  });

  it('build-the-phrase uses a real line the word came from, in tiles, checked by order', () => {
    const w = DIARY_WORDS.find((x) => buildLine(x))!;
    expect(w).toBeTruthy();
    const line = buildLine(w)!;
    const dealt = dealExercise({ kind: 'build', wordIds: [w.id] }, seeded(7))!;
    if (dealt.view.kind !== 'build' || dealt.key.kind !== 'build') throw new Error('not a build');
    expect(dealt.view.en).toBe(line.en);
    const want = line.pt.split(/\s+/).map((t) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').toLowerCase()).filter(Boolean);
    const used = new Set<number>();
    const order = want.map((t) => {
      const i = dealt.view.kind === 'build' ? dealt.view.tiles.findIndex((x, j) => !used.has(j) && x.toLowerCase() === t) : -1;
      used.add(i);
      return i;
    });
    expect(checkExercise(dealt.key, { order }).correct).toBe(true);
    expect(checkExercise(dealt.key, { order: [...order].reverse() }).correct).toBe(order.length < 2);
    expect(checkExercise(dealt.key, { order: [0, 0, 0] }).correct).toBe(false);
  });

  it('camera words have no line to build: the exercise falls back to typing', () => {
    const cam = DIARY_WORDS.find((x) => x.source === 'camera')!;
    expect(buildLine(cam)).toBeNull();
    expect(dealExercise({ kind: 'build', wordIds: [cam.id] }, seeded())!.view.kind).toBe('type');
  });

  it('the match race checks each pair against the key', () => {
    const words = ids(5);
    const dealt = dealExercise({ kind: 'match', wordIds: words }, seeded(11))!;
    if (dealt.view.kind !== 'match' || dealt.key.kind !== 'match') throw new Error('not a match');
    for (let i = 0; i < 5; i++) {
      const pt = dealt.view.pt[i]!;
      const en = DIARY_WORDS.find((w) => w.pt === pt && words.includes(w.id))!.en;
      expect(checkPair(dealt.key, i, dealt.view.en.indexOf(en))).toBe(true);
      expect(checkPair(dealt.key, i, (dealt.view.en.indexOf(en) + 1) % 5)).toBe(false);
    }
  });
});

describe('progress path, hunts and the word mission', () => {
  it('one unit per area in arrival order, nodes done by strength, the checkpoint last', () => {
    const empty = escolaPath(freshEscola(), []);
    expect(empty.map((u) => u.id)).toEqual(['chegada', 'praca', 'rua', 'padaria', 'feira', 'kitnet', 'academia', 'escola', 'praia']);
    expect(empty[0]!.nodes).toEqual(['current', 'locked', 'locked', 'locked', 'locked']);
    const chegada = DIARY_WORDS.filter((w) => w.area === 'chegada').map((w) => w.id);
    const full = escolaPath(withBoxes(chegada, Object.fromEntries(chegada.map((id) => [id, ESCOLA_MAX_BOX]))), chegada)[0]!;
    expect(full).toMatchObject({ crowns: 5, mastered: chegada.length, found: chegada.length, strength: 1 });
    expect(full.nodes.every((n) => n === 'done')).toBe(true);
    expect(full.hunt).toBeNull();
  });

  it('a hunt says how many words are left and where to look, never the word', () => {
    const hunts = areaHunts(ids(10));
    const feira = hunts.find((h) => h.area === 'feira')!;
    expect(feira.line.pt).toMatch(/^Faltam \d+ palavras pra descobrir na feira$/);
    expect(feira.line.en).toMatch(/words left to find at the street market/);
    for (const h of hunts) {
      const missing = DIARY_WORDS.filter((w) => w.area === h.area && !ids(10).includes(w.id));
      expect(h.missing).toBe(missing.length);
      // the hint names a place, a kind of thing to do or a neighbour, but none of the missing words
      // (the place itself is fair: "no aeroporto" names the area, not a word to find)
      // (and so are the hint's own verbs: "tire foto", "leia as placas")
      const said = h.hint.pt.toLowerCase().split(/[\s,.]+/).filter((t) => !HINT_WORDS.has(t));
      for (const w of missing) if (w.pt.length > 3 && !AREA_IN[h.area]!.pt.includes(w.pt.toLowerCase())) expect(said).not.toContain(w.pt.toLowerCase());
    }
    expect(hunts.find((h) => h.area === 'feira')?.hint.pt).toMatch(/foto|placas|Converse|Jogue|Termine/);
  });

  it('the mission picks an area with words left, and turns with the day', () => {
    const diary = ids(5);
    const a = pickMission(diary, '2026-10-08')!;
    expect(areaHunts(diary).map((h) => h.area)).toContain(a.area);
    const days = new Set(['2026-10-08', '2026-10-09', '2026-10-10'].map((d) => pickMission(diary, d)!.area));
    expect(days.size).toBeGreaterThan(1);
    expect(pickMission(DIARY_WORDS.map((w) => w.id), '2026-10-08')).toBeNull();
  });

  it('word counts: learned vs studied vs mastered vs still to find, overall and per area', () => {
    const diary = ids(10);
    const st = withBoxes(diary, { [diary[0]!]: ESCOLA_MAX_BOX, [diary[1]!]: 2 });
    st.words[diary[1]!]!.due = T0 + D;
    const c = wordCounts(st, diary, T0);
    expect(c).toMatchObject({ learned: 10, studied: 2, mastered: 1, fresh: 8, due: 1, catalog: DIARY_WORDS.length, toFind: DIARY_WORDS.length - 10 });
  });
});

describe('normalizeEscola', () => {
  it('repairs anything', () => {
    for (const raw of [null, 7, 'x', [], { words: 5 }, { goal: 'muito', streak: -3, tier: 'platina' }]) {
      const st = normalizeEscola(raw, ids(3));
      expect(st.goal).toBe(10);
      expect(st.tier).toBe('verde');
      expect(st.streak).toBeGreaterThanOrEqual(0);
      expect(st.words).toEqual({});
    }
  });
});
