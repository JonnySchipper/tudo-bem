/**
 * Escola da Praça on the server: Dona Lúcia's lessons. The server plans the lesson from the player's diary and its spaced-repetition state,
 * deals one exercise at a time (never with its answer), checks every answer, and at the end commits word strength, XP, the streak, the daily
 * goal, the RV (virtual, capped) and the nameplate tier. Rules live in shared escola.ts; this is the session state and the wiring.
 */
import {
  DIARY_WORDS,
  ESCOLA_LESSON,
  ESCOLA_RV,
  ESCOLA_XP,
  ESCOLA_GOALS,
  ESCOLA_MAX_BOX,
  HOTSPOT_READ_RANGE,
  LUCIA_LINES,
  LUCIA_RIGHT,
  LUCIA_TIER_UP,
  ROOMS,
  addCalendarDays,
  addXp,
  areaHunts,
  bumpStreak,
  checkExercise,
  checkPair,
  dealExercise,
  diaryArea,
  diaryGamesIn,
  earnedTier,
  hotspotDistance,
  localDay,
  acceptTz,
  normalizeEscola,
  payRv,
  pickMission,
  planLesson,
  revealOf,
  reviewWord,
  rvRoom,
  tierProgress,
  tierRank,
  tierRule,
  tileDistance,
  xpFor,
  type Bilingual,
  type ClientMsg,
  type DiaryWord,
  type EscolaGoal,
  type EscolaState,
  type EscolaSummary,
  type ExerciseKey,
  type Nameplate,
  type NpcId,
  type PlannedExercise,
  type RoomId,
  type StrengthenedWord,
  type Tile,
} from '@tudobem/shared';
import type { ProfileStore, StoredProfile } from './store.js';
import type { Session } from './world.js';

const DIARY = new Map(DIARY_WORDS.map((w) => [w.id, w]));

export interface EscolaDeps {
  store: ProfileStore;
  reward: (s: Session, amount: number, reason: Bilingual) => void;
  pushProfile: (s: Session) => void;
  tileOf: (s: Session) => Tile;
  roomOf: (s: Session) => RoomId | null;
  npcsIn: (room: RoomId) => { id: NpcId; tile: Tile; interact: Tile }[];
  rng: () => number;
  now: () => number;
  /** The plate colour changed: show it to everyone in the room. */
  avatarChanged: (s: Session) => void;
  /** A short line to the other players in the same room. */
  tellRoom: (s: Session, pt: string, en: string) => void;
  /** The practice game's own word (aula), taught by a finished lesson once. */
  teachLessonWord: (s: Session, gameId: string) => DiaryWord | null;
}

interface Lesson {
  gameId: string;
  plan: PlannedExercise[];
  i: number;
  cur: { ex: PlannedExercise; key: ExerciseKey } | null;
  answered: boolean;
  /** wordId -> right on every try so far (one miss sticks). */
  results: Map<string, boolean>;
  retries: number;
  right: number;
  total: number;
  combo: number;
  bestCombo: number;
  xp: number;
  /** Match race: the Portuguese cards already paired, and whether any tap missed. */
  matched: Set<number>;
  matchMissed: boolean;
  tz: number;
}

/** The escola state on a profile, repaired in place (old saves have none). */
export function escolaOf(p: StoredProfile): EscolaState {
  p.escola = normalizeEscola(p.escola, p.diary);
  return p.escola;
}

/** The plate a profile shows: the escola tier it earned. */
export function nameplateOf(p: { escola?: EscolaState; diary?: string[] }): Nameplate {
  return earnedTier(normalizeEscola(p.escola, p.diary), p.diary);
}

export class EscolaTracker {
  private readonly lessons = new WeakMap<Session, Lesson>();

  constructor(private readonly d: EscolaDeps) {}

  handle(s: Session, msg: Extract<ClientMsg, { t: 'escola' }>) {
    switch (msg.action) {
      case 'start':
        return this.start(s, msg.area, msg.tz);
      case 'answer':
        return this.answer(s, msg);
      case 'pair':
        return this.pair(s, msg.pt, msg.en);
      case 'next':
        return this.next(s);
      case 'quit':
        return this.drop(s);
      case 'goal':
        return this.setGoal(s, msg.goal, msg.tz);
    }
  }

  /** Leaving (quit, a closed tab, a new lesson over an old one): what was answered still counts, without the finishing bonuses. */
  drop(s: Session) {
    if (this.lessons.has(s)) this.finish(s, true);
  }

  /** Next to Dona Lúcia's desk, or to Dona Lúcia herself. */
  private near(s: Session): { gameId: string } | null {
    const room = this.d.roomOf(s);
    if (!room) return null;
    const game = diaryGamesIn(room).find((g) => g.kind !== 'correria');
    if (!game) return null;
    const tile = this.d.tileOf(s);
    const desk = ROOMS[room].props.find((q) => q.action === 'escola');
    const host = this.d.npcsIn(room).find((n) => n.id === game.host.npc);
    const nearDesk = !!desk && hotspotDistance(desk, tile) <= HOTSPOT_READ_RANGE;
    const nearHost = !!host && (tileDistance(tile, host.tile) <= HOTSPOT_READ_RANGE || tileDistance(tile, host.interact) <= HOTSPOT_READ_RANGE);
    return nearDesk || nearHost ? { gameId: game.id } : null;
  }

  private start(s: Session, area: unknown, tz: unknown) {
    const p = s.profile;
    if (!p) return;
    const at = this.near(s);
    // needs_br: true
    if (!at) return s.send({ t: 'escola', phase: 'closed', line: { pt: 'Chegue mais perto da Dona Lúcia.', en: 'Walk closer to Dona Lúcia.' } });
    this.drop(s);
    const st = escolaOf(p);
    st.tz = acceptTz(this.d.now(), st.tz, tz);
    const unit = typeof area === 'string' && diaryArea(area) ? area : undefined;
    const plan = planLesson(st, p.diary, this.d.now(), this.d.rng, unit);
    if (!plan) return s.send({ t: 'escola', phase: 'closed', line: LUCIA_LINES.greetEmpty });
    this.lessons.set(s, {
      gameId: at.gameId,
      plan: plan.exercises,
      i: 0,
      cur: null,
      answered: false,
      results: new Map(),
      retries: 0,
      right: 0,
      total: 0,
      combo: 0,
      bestCombo: 0,
      xp: 0,
      matched: new Set(),
      matchMissed: false,
      tz: st.tz ?? 0,
    });
    this.deal(s);
  }

  private deal(s: Session) {
    const l = this.lessons.get(s);
    if (!l) return;
    while (l.i < l.plan.length) {
      const ex = l.plan[l.i]!;
      const dealt = dealExercise(ex, this.d.rng);
      if (dealt) {
        l.cur = { ex, key: dealt.key };
        l.answered = false;
        l.matched = new Set();
        l.matchMissed = false;
        s.send({ t: 'escola', phase: 'exercise', ex: dealt.view, index: l.i, total: l.plan.length, combo: l.combo, lessonXp: l.xp, retry: !!ex.retry });
        return;
      }
      l.i++;
    }
    this.finish(s, false);
  }

  /** One try at the exercise on screen. */
  private answer(s: Session, msg: { choice?: unknown; text?: unknown; order?: unknown }) {
    const l = this.lessons.get(s);
    if (!l?.cur || l.answered || l.cur.key.kind === 'match') return;
    const result = checkExercise(l.cur.key, {
      choice: typeof msg.choice === 'string' ? msg.choice.slice(0, 80) : undefined,
      text: typeof msg.text === 'string' ? msg.text.slice(0, 80) : undefined,
      order: Array.isArray(msg.order) ? msg.order.slice(0, 16).map(Number) : undefined,
    });
    this.settle(s, l, result.correct, result.almost);
  }

  /** One tap of the match race: right pairs stay matched, a wrong one counts the Portuguese card's word as missed. */
  private pair(s: Session, pt: unknown, en: unknown) {
    const l = this.lessons.get(s);
    const key = l?.cur?.key;
    if (!l || !key || key.kind !== 'match' || l.answered) return;
    const a = Number(pt);
    const b = Number(en);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || a >= key.pairs.length || l.matched.has(a)) return;
    const ok = checkPair(key, a, b);
    if (ok) l.matched.add(a);
    else {
      l.matchMissed = true;
      l.results.set(key.wordIds[a]!, false);
    }
    s.send({ t: 'escola', phase: 'pair', pt: a, en: b, ok });
    if (l.matched.size === key.pairs.length) this.settle(s, l, !l.matchMissed);
  }

  /** The verdict on the exercise on screen: XP and combo, the word results, a retry for a miss. */
  private settle(s: Session, l: Lesson, correct: boolean, almost?: 'accent' | 'typo') {
    const cur = l.cur!;
    l.answered = true;
    l.total++;
    for (const id of cur.ex.wordIds) {
      // the match race marks its own misses per word; everything else is one word
      if (cur.ex.kind === 'match') {
        if (!l.results.has(id)) l.results.set(id, true);
      } else l.results.set(id, (l.results.get(id) ?? true) && correct);
    }
    let xp = 0;
    let retry = false;
    if (correct) {
      l.right++;
      l.combo++;
      l.bestCombo = Math.max(l.bestCombo, l.combo);
      xp = xpFor(l.combo);
      l.xp += xp;
    } else {
      l.combo = 0;
      if (cur.ex.kind !== 'match' && l.retries < ESCOLA_LESSON.retries) {
        l.retries++;
        retry = true;
        l.plan.push({ kind: cur.ex.kind, wordIds: cur.ex.wordIds, retry: true });
      }
    }
    const line: Bilingual = !correct
      ? LUCIA_LINES.wrong
      : almost
        ? LUCIA_LINES[almost]
        : l.combo === ESCOLA_XP.comboAt
          ? LUCIA_LINES.combo
          : LUCIA_RIGHT[Math.floor(this.d.rng() * LUCIA_RIGHT.length) % LUCIA_RIGHT.length]!;
    s.send({
      t: 'escola',
      phase: 'checked',
      correct,
      ...(almost ? { almost } : {}),
      reveal: revealOf(cur.key),
      xp,
      combo: l.combo,
      lessonXp: l.xp,
      retry,
      line,
    });
  }

  private next(s: Session) {
    const l = this.lessons.get(s);
    if (!l?.answered) return;
    l.i++;
    this.deal(s);
  }

  private setGoal(s: Session, goal: unknown, tz: unknown) {
    const p = s.profile;
    if (!p || !(ESCOLA_GOALS as readonly number[]).includes(goal as number)) return;
    const st = escolaOf(p);
    st.goal = goal as EscolaGoal;
    st.tz = acceptTz(this.d.now(), st.tz, tz);
    this.d.store.save(p.id);
    this.d.pushProfile(s);
  }

  /** A word found in the world: today's word mission, when it is in the mission's area, pays its bonus XP once. */
  onWord(s: Session, word: DiaryWord) {
    const p = s.profile;
    if (!p) return;
    const st = escolaOf(p);
    const today = addCalendarDays(localDay(this.d.now(), st.tz), p.testDayOffset ?? 0);
    const m = st.mission;
    if (!m || m.done || m.day !== today || m.area !== word.area) return;
    m.done = true;
    addXp(st, today, ESCOLA_XP.mission);
    this.d.store.save(p.id);
    this.d.pushProfile(s);
    // needs_br: true
    s.send({ t: 'notice', level: 'reward', pt: `Missão de palavras cumprida! +${ESCOLA_XP.mission} XP`, en: `Word mission done! +${ESCOLA_XP.mission} XP` });
  }

  /** Commit the lesson. `partial`: the player left early (no finishing bonus, no streak day, no summary). */
  private finish(s: Session, partial: boolean) {
    const l = this.lessons.get(s);
    this.lessons.delete(s);
    const p = s.profile;
    if (!l || !p) return;
    const st = escolaOf(p);
    const now = this.d.now();
    const today = addCalendarDays(localDay(now, l.tz), p.testDayOffset ?? 0);
    const strengthened: StrengthenedWord[] = [];
    let newlyMastered = 0;
    for (const [id, right] of l.results) {
      const before = st.words[id]?.b ?? 0;
      st.words[id] = reviewWord(st.words[id], right, now);
      const after = st.words[id]!.b;
      if (after > before) {
        const w = DIARY.get(id);
        if (w) strengthened.push({ pt: w.pt, en: w.en, from: before, to: after });
        if (after >= ESCOLA_MAX_BOX) newlyMastered++;
      }
    }
    const perfect = !partial && l.total > 0 && l.right === l.total;
    let xp = l.xp;
    let streak = { streak: st.streak, extended: false, usedFreezes: 0, earnedFreeze: false };
    if (!partial && l.total > 0) {
      xp += ESCOLA_XP.lesson + (perfect ? ESCOLA_XP.perfect : 0);
      st.lessons++;
      if (perfect) st.perfect++;
      streak = bumpStreak(st, today);
    }
    const goalMet = addXp(st, today, xp);
    const rv = Math.min(l.right * ESCOLA_RV.perRight, rvRoom(st, today, 0));
    if (rv > 0) payRv(st, today, rv);
    const before = st.tier;
    const tier = earnedTier(st, p.diary);
    const tierUp = tierRank(tier) > tierRank(before) ? tier : null;
    st.tier = tier;
    p.nameplate = p.verdeMode ? 'verde' : tier;
    let mission = null;
    if (!partial) {
      if (st.mission?.day !== today) {
        const pick = pickMission(p.diary, today);
        st.mission = pick ? { day: today, area: pick.area, done: false } : undefined;
      }
      mission = st.mission && !st.mission.done ? (areaHunts(p.diary).find((h) => h.area === st.mission!.area) ?? null) : null;
    }
    this.d.store.save(p.id);
    if (rv > 0) this.d.reward(s, rv, { pt: 'Dona Lúcia paga a aula.', en: 'Dona Lúcia pays for the class.' });
    const granted = partial ? null : this.d.teachLessonWord(s, l.gameId);
    this.d.pushProfile(s);
    if (tierUp) {
      this.d.avatarChanged(s);
      const rule = tierRule(tierUp);
      // needs_br: true
      this.d.tellRoom(s, `${p.name} ganhou a placa ${rule.pt.toLowerCase()} na escola!`, `${p.name} earned the ${rule.en.toLowerCase()} nameplate at the school!`);
    }
    if (partial) return;
    const summary: EscolaSummary = {
      xp,
      right: l.right,
      total: l.total,
      accuracy: l.total ? Math.round((100 * l.right) / l.total) : 0,
      perfect,
      bestCombo: l.bestCombo,
      strengthened,
      newlyMastered,
      streak: streak.streak,
      streakExtended: streak.extended,
      freezeEarned: streak.earnedFreeze,
      freezes: st.freezes,
      goal: st.goal,
      dayXp: st.dayXp,
      goalMet,
      tier,
      tierUp,
      progress: tierProgress(st, p.diary),
      rv,
      mission,
      granted: granted ? { pt: granted.pt, en: granted.en } : null,
      line: tierUp && tierUp !== 'verde' ? LUCIA_TIER_UP[tierUp] : perfect ? LUCIA_LINES.perfect : goalMet ? LUCIA_LINES.goal : LUCIA_LINES.done,
    };
    s.send({ t: 'escola', phase: 'done', summary });
  }
}
