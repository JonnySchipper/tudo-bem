/**
 * The fishing fight (PRAIA-PLAN.md 2.1, 2.3): one pure, seeded simulation that the client plays for display and the server replays to
 * judge. The client never sends a fish, a size or an amount: only when it tapped and when it held. Times are ms from the moment the
 * bobber lands. Nothing here is shown as a number on the stage.
 *
 *   roll     `pescaRoll(cast)`: what bites (by water, weather, hour and how far the cast went), when, the fake nibbles before it, its size
 *            and how it fights (its runs, in ms from the hook)
 *   fight    `pescaStep(state, roll, holding, dt)`: hold to reel, let go while it runs. Holding against a run fills the tension (it snaps at
 *            1); letting go drains it while the fish swims off a little. Holding between runs brings it in (caught at progress 1).
 *   judge    `pescaJudge(cast, events, elapsedMs)`: replays the taps and holds over the roll, refuses a list a person could not have made
 */
import { mulberry32 } from './meveum.js';
import { FISH, POOLS, isFishId, isJunkId, isTrophy, sizeWord, type Catchable, type FishId, type JunkId, type SizeWord } from './fish.js';
import type { WaterId } from './pesca.js';
import type { Weather } from './weather.js';

export interface PescaCast {
  seed: number;
  water: WaterId;
  weather: Weather;
  /** game-clock minute of the day (0..1439) */
  minute: number;
  /** how far the cast went, 0 (perto) .. 1 (longe) */
  power: number;
  /** fish this player had landed before this cast (the first three get a wider bite window) */
  firstCatches: number;
}

export type PescaEvent = { k: 'hook'; ms: number } | { k: 'hold'; down: boolean; ms: number } | { k: 'quit'; ms: number };

export interface PescaRun {
  /** ms after the hook */
  at: number;
  len: number;
  /** how hard (multiplies the tension it puts on a held line) */
  pull: number;
}

export interface PescaRoll {
  catch: Catchable;
  cm: number;
  biteAtMs: number;
  nibblesAtMs: number[];
  runs: PescaRun[];
  /** past this (ms after the hook) the fish has worn the line out and gets away */
  fightMaxMs: number;
}

export type PescaOutcome =
  | { kind: 'caught'; fish: FishId; cm: number; sizeWord: SizeWord; trophy: boolean }
  | { kind: 'junk'; junk: JunkId }
  | { kind: 'released'; fish: 'baiacu' }
  | { kind: 'early' | 'late' | 'snapped' | 'escaped' | 'quit' | 'rejected'; reason?: string };

export const PESCA_FIGHT = {
  tick: 50,
  /** tension per second while holding against a run, times its pull */
  runFill: 0.7,
  /** tension per second while holding between runs (negative: a calm fish lets the line ease) */
  holdFill: -0.3,
  /** tension drained per second with the line let go */
  restDrain: 0.9,
  /** progress per second holding between runs */
  progressHold: 0.24,
  /** progress per second holding during a run, times its pull (negative: the fish takes line) */
  progressRunHold: -0.15,
  /** progress lost per second with the line let go (times the run's pull while it runs) */
  driftFree: 0.06,
  startProgress: 0.25,
  snapAt: 1,
  caughtAt: 1,
  biteWindowMs: 1200,
  biteWindowFirstMs: 1800,
  /** holding the cast this long tangles the line (client only: a free re-cast) */
  tangleMs: 3200,
  /** a run is telegraphed this long before it starts (the rod dips) */
  telegraphMs: 300,
  maxEvents: 200,
} as const;

/** The bite window this cast gets. */
export const biteWindow = (cast: Pick<PescaCast, 'firstCatches'>): number => (cast.firstCatches < 3 ? PESCA_FIGHT.biteWindowFirstMs : PESCA_FIGHT.biteWindowMs);

const NIGHT = (m: number) => m >= 19 * 60 || m < 5 * 60;
const DAWN = (m: number) => m >= 5 * 60 && m < 7 * 60;
/** dawn or dusk: when the tide word can be learned */
export const isTideHour = (m: number): boolean => DAWN(m) || (m >= 17 * 60 && m < 19 * 60);

/** The pool of a water with this cast's weights (weather, hour, distance). */
export function pescaWeights(cast: Pick<PescaCast, 'water' | 'weather' | 'minute' | 'power'>): { c: Catchable; w: number }[] {
  const power = Math.max(0, Math.min(1, cast.power));
  return POOLS[cast.water].map(({ c, w }) => {
    let m = 1;
    if (isFishId(c)) {
      const r = FISH[c].rarity;
      if ((cast.weather === 'chuva' || cast.weather === 'garoa') && r === 'comum') m *= 1.5;
      if (NIGHT(cast.minute) && (c === 'sardinha' || c === 'bagre')) m *= 1.6;
      if (DAWN(cast.minute) && c === 'robalo') m *= 1.5;
      if (r === 'incomum' || r === 'raro') m *= 1 + 0.4 * power;
      if (r === 'trofeu') m *= 1 + 0.2 * power;
    }
    return { c, w: w * m };
  });
}

/** How a species fights: [runs min, runs max, pull min, pull max, run length min, max ms]. */
const FIGHT_OF: Record<string, [number, number, number, number, number, number]> = {
  comum: [1, 2, 0.45, 0.9, 450, 900],
  incomum: [2, 3, 0.7, 1.35, 600, 1300],
  raro: [3, 4, 0.9, 1.45, 750, 1400],
  trofeu: [5, 8, 1.25, 1.75, 1000, 1700],
};

export function pescaRoll(cast: PescaCast): PescaRoll {
  const rng = mulberry32(cast.seed >>> 0);
  const pool = pescaWeights(cast);
  const total = pool.reduce((a, p) => a + p.w, 0);
  let pick = rng() * total;
  let c: Catchable = pool[0]!.c;
  for (const p of pool) {
    pick -= p.w;
    if (pick <= 0) {
      c = p.c;
      break;
    }
  }
  const biteAtMs = Math.round(2000 + rng() * 7000);
  const nibbles = rng() < 0.7 ? (rng() < 0.5 ? 2 : 1) : 0;
  const nibblesAtMs: number[] = [];
  for (let i = 0; i < nibbles; i++) nibblesAtMs.push(Math.round(800 + rng() * Math.max(200, biteAtMs - 1600)));
  nibblesAtMs.sort((a, b) => a - b);
  if (!isFishId(c)) return { catch: c, cm: 0, biteAtMs, nibblesAtMs, runs: [], fightMaxMs: 0 };
  const def = FISH[c];
  // a triangular size inside the range
  const cm = Math.round(def.cm[0] + ((rng() + rng()) / 2) * (def.cm[1] - def.cm[0]));
  if (c === 'baiacu') return { catch: c, cm, biteAtMs, nibblesAtMs, runs: [], fightMaxMs: 0 };
  const [rMin, rMax, pMin, pMax, lMin, lMax] = FIGHT_OF[def.rarity]!;
  // the catfish barely pulls; a big one of its kind pulls harder
  const big = (cm - def.cm[0]) / Math.max(1, def.cm[1] - def.cm[0]);
  const soft = c === 'bagre' ? 0.6 : 1;
  const n = rMin + Math.floor(rng() * (rMax - rMin + 1));
  const runs: PescaRun[] = [];
  let t = 600 + rng() * 700;
  for (let i = 0; i < n; i++) {
    const len = Math.round(lMin + rng() * (lMax - lMin));
    const pull = +((pMin + rng() * (pMax - pMin)) * soft * (0.85 + 0.3 * big)).toFixed(3);
    runs.push({ at: Math.round(t), len, pull });
    t += len + 700 + rng() * 900;
  }
  return { catch: c, cm, biteAtMs, nibblesAtMs, runs, fightMaxMs: Math.round(Math.min(def.rarity === 'trofeu' ? 12_000 : 14_000, Math.max(3_000, t + 2_600))) };
}

export interface FightState {
  /** ms since the hook */
  t: number;
  tension: number;
  progress: number;
  done: null | 'caught' | 'snapped' | 'escaped';
}

export const fightStart = (): FightState => ({ t: 0, tension: 0, progress: PESCA_FIGHT.startProgress, done: null });

/** The run under way at `t` (ms after the hook), if any. */
export const runAt = (roll: PescaRoll, t: number): PescaRun | undefined => roll.runs.find((r) => t >= r.at && t < r.at + r.len);

/** One step of the fight. */
export function pescaStep(st: FightState, roll: PescaRoll, holding: boolean, dtMs: number): FightState {
  if (st.done) return st;
  const F = PESCA_FIGHT;
  const dt = dtMs / 1000;
  const run = runAt(roll, st.t);
  let { tension, progress } = st;
  if (holding) {
    tension = Math.max(0, tension + (run ? F.runFill * run.pull : F.holdFill) * dt);
    progress += (run ? F.progressRunHold * run.pull : F.progressHold) * dt;
  } else {
    tension = Math.max(0, tension - F.restDrain * dt);
    progress -= F.driftFree * (run ? run.pull : 1) * dt;
  }
  const t = st.t + dtMs;
  let done: FightState['done'] = null;
  if (tension >= F.snapAt) done = 'snapped';
  else if (progress >= F.caughtAt) done = 'caught';
  else if (progress <= 0 || t >= roll.fightMaxMs) done = 'escaped';
  return { t, tension: Math.min(1, tension), progress: Math.max(0, Math.min(1, progress)), done };
}

/** Plays the fight from the hook with a hold timeline (`holdAt(t)`: is the line held `t` ms after the hook). Returns the end and when. */
export function playFight(roll: PescaRoll, holdAt: (t: number) => boolean): { done: Exclude<FightState['done'], null>; atMs: number } {
  let st = fightStart();
  while (!st.done) st = pescaStep(st, roll, holdAt(st.t), PESCA_FIGHT.tick);
  return { done: st.done, atMs: st.t };
}

/** The roll a test run pins (`TB_TEST_PESCA` / `?pescatest`): a bagre at the beach, a short robalo on the boats. */
export function pinnedRoll(water: WaterId): PescaRoll {
  if (water === 'praia' || water === 'lagoa')
    return { catch: water === 'praia' ? 'bagre' : 'tilapia', cm: 30, biteAtMs: 1500, nibblesAtMs: [], runs: [], fightMaxMs: 8000 };
  return { catch: 'robalo', cm: 60, biteAtMs: 1500, nibblesAtMs: [], runs: [{ at: 400, len: 300, pull: 0.5 }], fightMaxMs: 8000 };
}

const isEvent = (e: unknown): e is PescaEvent => {
  if (!e || typeof e !== 'object') return false;
  const o = e as Record<string, unknown>;
  if (typeof o.ms !== 'number' || !Number.isFinite(o.ms) || o.ms < 0) return false;
  if (o.k === 'hook' || o.k === 'quit') return true;
  return o.k === 'hold' && typeof o.down === 'boolean';
};

/** A client's event list, checked: at most 200, each well formed, times never going back. Null when it is not something a person sent. */
export function parsePescaEvents(raw: unknown): PescaEvent[] | null {
  if (!Array.isArray(raw) || raw.length > PESCA_FIGHT.maxEvents) return null;
  let last = 0;
  const out: PescaEvent[] = [];
  for (const e of raw) {
    if (!isEvent(e) || e.ms < last) return null;
    last = e.ms;
    out.push(e.k === 'hold' ? { k: 'hold', down: e.down, ms: Math.round(e.ms) } : { k: e.k, ms: Math.round(e.ms) });
  }
  return out;
}

/**
 * Replays a cast. `elapsedMs` is the time the server measured between the cast and the result: a result that claims a fight longer than
 * the time that really passed is refused (`rejected`), as is a malformed list. A tap before the bite is `early`, none in the window `late`.
 * `roll` defaults to the cast's own; a test pins one.
 */
export function pescaJudge(cast: PescaCast, events: readonly PescaEvent[] | null, elapsedMs: number, roll = pescaRoll(cast)): PescaOutcome {
  if (!events) return { kind: 'rejected', reason: 'events' };
  for (let i = 1; i < events.length; i++) if (events[i]!.ms < events[i - 1]!.ms) return { kind: 'rejected', reason: 'order' };
  if (events.length > PESCA_FIGHT.maxEvents) return { kind: 'rejected', reason: 'events' };
  const slack = 400;
  const hook = events.find((e) => e.k === 'hook');
  const quit = events.find((e) => e.k === 'quit');
  if (quit && (!hook || quit.ms < hook.ms)) return { kind: 'quit' };
  const window = biteWindow(cast);
  if (!hook) return elapsedMs + slack >= roll.biteAtMs + window ? { kind: 'late' } : { kind: 'quit' };
  if (hook.ms < roll.biteAtMs) return { kind: 'early' };
  if (hook.ms > roll.biteAtMs + window) return { kind: 'late' };
  if (elapsedMs + slack < hook.ms) return { kind: 'rejected', reason: 'too_fast' };
  if (isJunkId(roll.catch)) return { kind: 'junk', junk: roll.catch };
  if (roll.catch === 'baiacu') return { kind: 'released', fish: 'baiacu' };
  // the holds after the hook, as a timeline from the hook
  const holds = events.filter((e): e is Extract<PescaEvent, { k: 'hold' }> => e.k === 'hold' && e.ms >= hook.ms).map((e) => ({ t: e.ms - hook.ms, down: e.down }));
  const holdAt = (t: number) => {
    let down = false;
    for (const h of holds) {
      if (h.t > t) break;
      down = h.down;
    }
    return down;
  };
  const end = playFight(roll, holdAt);
  if (quit && quit.ms - hook.ms < end.atMs) return { kind: 'quit' };
  if (elapsedMs + slack < hook.ms + end.atMs) return { kind: 'rejected', reason: 'too_fast' };
  if (end.done === 'snapped') return { kind: 'snapped' };
  if (end.done === 'escaped') return { kind: 'escaped' };
  const fish = roll.catch as FishId;
  const def = FISH[fish];
  return { kind: 'caught', fish, cm: roll.cm, sizeWord: sizeWord(def, roll.cm), trophy: isTrophy(def, roll.cm) };
}
