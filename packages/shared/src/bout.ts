/**
 * "Treino no tatame": the rules of one bout, as pure functions over a plain `BoutState` (server, client and tests share them).
 *
 * The shape of it:
 *  - A position ladder, `rung` -4..+4 (positive: you are ahead). de pé at 0; guarda fechada / meia-guarda at ±1; cem quilos ±2; joelho
 *    na barriga ±3; montada or costas at ±4. One exchange moves at most one rung.
 *  - A tug-of-war `momentum` bar. Each exchange you pick an INTENT (risk and reward), answer a Portuguese challenge, and your correctness
 *    and speed push the bar against what the partner's skill profile pushes back. Crossing +-THRESHOLD moves a rung.
 *  - BJJ-style points when a side climbs (2, 3, 2, 4), advantages for near misses, a pegada (grip) meter that fast answers fill, a
 *    finalização chance at the top of the ladder with a full pegada, and an escape when the partner has you pinned and goes for it.
 *  - A 5:00 clock that runs faster than real time (CLOCK_RATE), so a match lasts about two to three minutes.
 *
 * Locks: the challenges stay A1 Portuguese (`challenges.ts`); nothing here is technique trivia; no "Oss" / "rola" in copy.
 */
import type { Bilingual } from './types.js';
import type { Rng } from './meveum.js';
import { mulberry32 } from './meveum.js';
import { type BjjPositionId, type BoutReason, type BoutWinner, type PartnerProfile } from './academia.js';
import type { ChallengeKind } from './challenges.js';

export const BOUT_PROTOCOL_VERSION = 1;

// ---------------------------------------------------------------- tuning

export const RUNG_MAX = 4;
/** Match clock: 5:00 of game time, counting down CLOCK_RATE times faster than real time. */
export const BOUT_CLOCK_MS = 300_000;
export const CLOCK_RATE = 2;
/** Real time the resolve beat (transition, Bia's call) costs on the clock, on top of the time the exchange itself took. */
export const RESOLVE_MS = 2_000;
export const INTRO_MS = 4_200;
export const MAX_EXCHANGES = 18;
/** Game ms an exchange costs at least: quick answers still use up the clock by the last exchange, so the 5:00 and the cap agree. */
const MIN_COST_MS = Math.ceil(BOUT_CLOCK_MS / MAX_EXCHANGES);
/** Game ms the clock loses for `realMs` of play plus the resolve beat. */
export const clockCost = (realMs: number): number => Math.max(MIN_COST_MS, Math.round((Math.max(0, realMs) + RESOLVE_MS) * CLOCK_RATE));

/** Momentum is -100..100. A push past +-THRESHOLD moves a rung and leaves +-CARRY. */
export const MOMENTUM_THRESHOLD = 26;
export const MOMENTUM_CARRY = 9;
export const MOMENTUM_DECAY = 0.8;
/** Pressing past this (without moving a rung) earns the presser one advantage per rung. */
export const MOMENTUM_NEAR = 17;
/** The partner pushes a little harder than the raw numbers, so a careless player does lose rungs. */
export const PARTNER_PUSH = 1.3;

export const PEGADA_MAX = 3;
/** An answer within this share of the time limit is full speed; a speed factor of FAST_AT or more counts as fast (about the first half of the time). */
export const SPEED_GRACE = 0.2;
export const FAST_AT = 0.6;

// ---------------------------------------------------------------- intents

export type IntentId = 'segurar' | 'puxar' | 'empurrar' | 'levantar' | 'girar' | 'esperar';

export interface IntentDef {
  id: IntentId;
  pt: string;
  en: string;
  /** momentum pushed when answered right (before speed) */
  power: number;
  /** momentum lost when answered wrong or too late */
  miss: number;
  /** 1 safe, 2 steady, 3 bold: the pip icon on the chip */
  risk: 1 | 2 | 3;
  /** kinds of challenge this intent draws (weights) */
  kinds: Partial<Record<ChallengeKind, number>>;
}

// needs_br: true (A1 verbs as intents; the glosses are the English line)
export const INTENTS: Record<IntentId, IntentDef> = {
  esperar: { id: 'esperar', pt: 'Esperar', en: 'Wait', power: 4, miss: 0, risk: 1, kinds: { choice: 3, cloze: 3, listening: 2 } },
  segurar: { id: 'segurar', pt: 'Segurar', en: 'Hold', power: 9, miss: 3, risk: 1, kinds: { choice: 3, cloze: 3, listening: 2 } },
  puxar: { id: 'puxar', pt: 'Puxar', en: 'Pull', power: 15, miss: 7, risk: 2, kinds: { cloze: 3, choice: 2, reorder: 2, listening: 2, typed: 1 } },
  empurrar: { id: 'empurrar', pt: 'Empurrar', en: 'Push', power: 15, miss: 7, risk: 2, kinds: { cloze: 3, choice: 2, reorder: 2, listening: 2, typed: 1 } },
  levantar: { id: 'levantar', pt: 'Levantar', en: 'Lift', power: 21, miss: 12, risk: 3, kinds: { reorder: 3, typed: 3, listening: 2, cloze: 1 } },
  girar: { id: 'girar', pt: 'Girar', en: 'Spin', power: 25, miss: 16, risk: 3, kinds: { reorder: 3, typed: 3, listening: 2, cloze: 1 } },
};

/** Which intents fit a rung (seen from the side that picks): always a safe one, a steady one and, mostly, a bold one. */
const INTENT_SETS: Record<string, IntentId[]> = {
  '0': ['segurar', 'puxar', 'empurrar'],
  '1': ['segurar', 'puxar', 'levantar'],
  '2': ['segurar', 'empurrar', 'girar'],
  '3': ['segurar', 'levantar', 'girar'],
  '4': ['segurar', 'puxar', 'empurrar'],
  '-1': ['esperar', 'empurrar', 'levantar'],
  '-2': ['esperar', 'puxar', 'girar'],
  '-3': ['esperar', 'empurrar', 'girar'],
  '-4': ['esperar', 'segurar', 'girar'],
};

export const intentSet = (rung: number): IntentDef[] => (INTENT_SETS[String(Math.max(-RUNG_MAX, Math.min(RUNG_MAX, Math.trunc(rung))))] ?? INTENT_SETS['0']!).map((id) => INTENTS[id]);

/** The kinds of challenge for the escape (defense) and the finalização. */
export const ESCAPE_KINDS: Partial<Record<ChallengeKind, number>> = { choice: 3, cloze: 3, listening: 1 };

// ---------------------------------------------------------------- timers (generous at the start, shrinking only with the level)

/** 1.0 for a new player, down to 0.55 at the top: the only thing that shortens a timer. */
export const timerScale = (level: number): number => Math.max(0.55, 1 - 0.06 * Math.max(0, level));

const LIMIT_MS: Record<ChallengeKind, number> = { choice: 14_000, cloze: 14_000, listening: 15_000, typed: 20_000, reorder: 22_000 };

export const challengeLimitMs = (kind: ChallengeKind, level: number): number => Math.round((LIMIT_MS[kind] * timerScale(level)) / 100) * 100;
export const intentPickMs = (level: number): number => Math.round((10_000 * Math.max(0.7, timerScale(level))) / 100) * 100;
export const ESCAPE_BASE_MS = 9_000;
export const FINISH_REORDER_MS = 17_000;
export const FINISH_STEP_MS = 7_500;
export const FINISH_STEPS = 3;

/** Escape: one quick prompt. */
export const escapeLimitMs = (level: number): number => Math.round((ESCAPE_BASE_MS * Math.max(0.65, timerScale(level))) / 100) * 100;

/** A finalização is one long reorder or three quick prompts in a row; a defensive partner makes it tighter. */
export function finishPlan(partner: PartnerProfile, level: number, rng: Rng): { mode: 'reorder' | 'triple'; limitMs: number[] } {
  const tight = 1 - 0.2 * partner.defense;
  const sc = Math.max(0.65, timerScale(level)) * tight;
  // against the hardest defender it is always the triple
  const mode = partner.defense >= 0.9 ? 'triple' : rng() < 0.5 ? 'reorder' : 'triple';
  if (mode === 'reorder') return { mode, limitMs: [Math.round((FINISH_REORDER_MS * sc) / 100) * 100] };
  return { mode, limitMs: Array.from({ length: FINISH_STEPS }, () => Math.round((FINISH_STEP_MS * sc) / 100) * 100) };
}

/** 0..1: full when answered within the grace share of the limit, 0 at the limit; a wrong or missing answer has no speed. */
export function speedFactor(elapsedMs: number, limitMs: number): number {
  if (!(limitMs > 0)) return 0;
  const e = Math.max(0, elapsedMs) / limitMs;
  return Math.max(0, Math.min(1, 1 - (e - SPEED_GRACE) / (1 - SPEED_GRACE - 0.1)));
}

// ---------------------------------------------------------------- state

export interface Score {
  you: number;
  partner: number;
}

export type FinishPosition = 'montada' | 'costas';

export interface BoutState {
  /** -4..4, positive when you are ahead */
  rung: number;
  /** -100..100, positive pushes toward you */
  momentum: number;
  points: Score;
  adv: Score;
  /** grip meters, 0..PEGADA_MAX */
  pegada: number;
  pegadaB: number;
  /** game milliseconds left */
  clockMs: number;
  exchange: number;
  /** which of the two top positions a climb to +-4 lands in */
  top: FinishPosition;
  /** an advantage was already given for pressing at this rung, per side */
  nearGiven: { you: boolean; partner: boolean };
  /** answers right in a row */
  streak: number;
}

export function newBoutState(): BoutState {
  return { rung: 0, momentum: 0, points: { you: 0, partner: 0 }, adv: { you: 0, partner: 0 }, pegada: 0, pegadaB: 0, clockMs: BOUT_CLOCK_MS, exchange: 0, top: 'montada', nearGiven: { you: false, partner: false }, streak: 0 };
}

export interface PositionView {
  id: BjjPositionId;
  /** who is on top, null standing */
  ahead: 'you' | 'partner' | null;
}

export function positionOf(st: Pick<BoutState, 'rung' | 'top'>): PositionView {
  const r = st.rung;
  const a = Math.abs(r);
  const ahead = r > 0 ? 'you' : r < 0 ? 'partner' : null;
  if (a === 0) return { id: 'de_pe', ahead };
  if (a === 1) return { id: r > 0 ? 'guarda_fechada' : 'meia_guarda', ahead };
  if (a === 2) return { id: 'cem_quilos', ahead };
  if (a === 3) return { id: 'joelho', ahead };
  return { id: st.top, ahead };
}

export const rungOfPosition = (id: BjjPositionId): number => ({ de_pe: 0, guarda_fechada: 1, meia_guarda: 1, cem_quilos: 2, joelho: 3, montada: 4, costas: 4 })[id];

/** Every ordered pair of positions one rung apart (the transition art: `bjj/trans_<from>__<to>_<n>`), both directions. */
export const ADJACENT_POSITIONS: readonly (readonly [BjjPositionId, BjjPositionId])[] = [
  ['de_pe', 'guarda_fechada'],
  ['de_pe', 'meia_guarda'],
  ['guarda_fechada', 'cem_quilos'],
  ['meia_guarda', 'cem_quilos'],
  ['cem_quilos', 'joelho'],
  ['joelho', 'montada'],
  ['joelho', 'costas'],
];

// ---------------------------------------------------------------- the referee

export type RefSignal = 'combate' | 'pontos2' | 'pontos3' | 'pontos4' | 'vantagem' | 'parar' | 'vitoria';

// needs_br: true (Bia's calls: points double as number practice)
export const REF_LINES: Record<RefSignal, Bilingual> = {
  combate: { pt: 'Combate!', en: 'Begin!' },
  pontos2: { pt: 'Dois pontos!', en: 'Two points!' },
  pontos3: { pt: 'Três pontos!', en: 'Three points!' },
  pontos4: { pt: 'Quatro pontos!', en: 'Four points!' },
  vantagem: { pt: 'Vantagem!', en: 'Advantage!' },
  parar: { pt: 'Pare!', en: 'Stop!' },
  vitoria: { pt: 'Vitória!', en: 'Victory!' },
};

export const signalForPoints = (pts: number): RefSignal => (pts >= 4 ? 'pontos4' : pts === 3 ? 'pontos3' : 'pontos2');

/** Points for a side climbing TO this rung magnitude (a takedown, a pass, the knee, the top). */
export const POINTS_FOR_RUNG: Record<number, number> = { 1: 2, 2: 3, 3: 2, 4: 4 };

// ---------------------------------------------------------------- crowd (bleacher reactions: presentation only)

export type CrowdCue = 'start' | 'points_you' | 'points_partner' | 'advantage' | 'near' | 'miss' | 'finish_you' | 'tap' | 'escape' | 'end';

// needs_br: true (short shouts)
export const CROWD_SHOUTS: readonly string[] = ['Vai!', 'Isso!', 'Segura!', 'Boa!'];
export const CROWD: Record<CrowdCue, { icons: string[]; shouts: string[] }> = {
  start: { icons: ['👏'], shouts: ['Vai!'] },
  points_you: { icons: ['👏', '🔥'], shouts: ['Isso!', 'Boa!'] },
  points_partner: { icons: ['😮', '👏'], shouts: ['Segura!', 'Vai!'] },
  advantage: { icons: ['👏'], shouts: ['Boa!'] },
  near: { icons: ['😮'], shouts: ['Vai!'] },
  miss: { icons: ['😮'], shouts: ['Segura!'] },
  finish_you: { icons: ['🔥', '😮'], shouts: ['Vai!', 'Isso!'] },
  tap: { icons: ['🔥', '👏'], shouts: ['Boa!', 'Isso!'] },
  escape: { icons: ['😮', '👏'], shouts: ['Isso!'] },
  end: { icons: ['👏'], shouts: ['Boa!'] },
};

// ---------------------------------------------------------------- partner

export interface PartnerTurn {
  intent: IntentId;
  correct: boolean;
  /** speed factor 0..1 it brought */
  speed: number;
  force: number;
}

/** What the partner does in one exchange, from its skill profile (accuracy, speed, aggression). */
export function partnerTurn(p: PartnerProfile, rung: number, rng: Rng): PartnerTurn {
  const set = intentSet(-rung);
  // aggression picks the bold intent, caution the safe one; the middle is steady
  const r = rng();
  const boldP = 0.15 + 0.6 * p.aggression;
  const safeP = 0.25 + 0.35 * (1 - p.aggression);
  const intent = (r < boldP ? set[set.length - 1]! : r > 1 - safeP ? set[0]! : set[Math.min(1, set.length - 1)]!).id;
  const def = INTENTS[intent];
  const correct = rng() < Math.max(0.05, p.accuracy - 0.04 * (def.risk - 1));
  const speed = Math.max(0.05, Math.min(1, p.speed + (rng() - 0.5) * 0.3));
  const force = correct ? def.power * (0.55 + 0.45 * speed) * PARTNER_PUSH : -def.miss * 0.6;
  return { intent, correct, speed, force };
}

/** Chance per step that a partner pinning you with a full pegada goes for the finish. */
export const partnerFinishDrive = (p: PartnerProfile): number => 0.3 + 0.65 * p.aggression;

// ---------------------------------------------------------------- one exchange

export interface ExchangeInput {
  intent: IntentId;
  correct: boolean;
  /** how long the challenge took (capped at the limit by the caller) */
  elapsedMs: number;
  limitMs: number;
  /** real ms the whole exchange cost (intent pick + challenge), for the clock */
  spentMs: number;
}

export type ExchangeEvent =
  | { type: 'points'; side: 'you' | 'partner'; pts: number; signal: RefSignal; line: Bilingual }
  | { type: 'advantage'; side: 'you' | 'partner'; signal: 'vantagem'; line: Bilingual }
  | { type: 'transition'; from: BjjPositionId; to: BjjPositionId; rungFrom: number; rungTo: number; gain: 'you' | 'partner' | null };

export interface ExchangeResult {
  state: BoutState;
  yours: { correct: boolean; speed: number; fast: boolean; force: number };
  partner: PartnerTurn;
  /** net momentum push this exchange (positive: toward you) */
  delta: number;
  events: ExchangeEvent[];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const cloneState = (s: BoutState): BoutState => ({ ...s, points: { ...s.points }, adv: { ...s.adv }, nearGiven: { ...s.nearGiven } });

export function resolveExchange(prev: BoutState, input: ExchangeInput, partner: PartnerProfile, rng: Rng): ExchangeResult {
  const st = cloneState(prev);
  const def = INTENTS[input.intent];
  const events: ExchangeEvent[] = [];
  st.exchange += 1;
  st.clockMs = Math.max(0, st.clockMs - clockCost(input.spentMs));

  // you
  const speed = input.correct ? speedFactor(input.elapsedMs, input.limitMs) : 0;
  const fast = input.correct && speed >= FAST_AT;
  let yours = input.correct ? def.power * (0.55 + 0.45 * speed) : -def.miss;
  // them
  const them = partnerTurn(partner, prev.rung, rng);
  let theirs = them.force;
  // waiting halves what comes at you; a defender blunts your push when you are already ahead
  if (input.intent === 'esperar' && theirs > 0) theirs *= 0.5;
  if (yours > 0 && prev.rung >= 2) yours *= 1 - 0.35 * partner.defense;
  const delta = yours - theirs;

  // pegada: fast right answers fill it, a miss drains it, holding fills it when right
  if (input.correct && (fast || input.intent === 'segurar')) st.pegada = Math.min(PEGADA_MAX, st.pegada + 1);
  else if (!input.correct) st.pegada = Math.max(0, st.pegada - 1);
  if (them.correct && theirs > yours && them.speed >= 0.55) st.pegadaB = Math.min(PEGADA_MAX, st.pegadaB + 1);
  else if (!them.correct) st.pegadaB = Math.max(0, st.pegadaB - 1);
  st.streak = input.correct ? st.streak + 1 : 0;

  // momentum
  st.momentum = clamp(prev.momentum * MOMENTUM_DECAY + delta, -100, 100);

  const rungFrom = st.rung;
  const from = positionOf(prev);
  if (st.momentum >= MOMENTUM_THRESHOLD && st.rung < RUNG_MAX) {
    st.rung += 1;
    st.momentum = MOMENTUM_CARRY;
    if (st.rung === RUNG_MAX) st.top = input.intent === 'girar' ? 'costas' : 'montada';
  } else if (st.momentum <= -MOMENTUM_THRESHOLD && st.rung > -RUNG_MAX) {
    st.rung -= 1;
    st.momentum = -MOMENTUM_CARRY;
    if (st.rung === -RUNG_MAX) st.top = them.intent === 'girar' ? 'costas' : 'montada';
  }

  if (st.rung !== rungFrom) {
    const to = positionOf(st);
    // the side that climbed scores; moving back toward standing (or over to the other side) scores nothing
    const gain: 'you' | 'partner' | null = st.rung > rungFrom ? (st.rung > 0 ? 'you' : null) : st.rung < 0 ? 'partner' : null;
    events.push({ type: 'transition', from: from.id, to: to.id, rungFrom, rungTo: st.rung, gain });
    if (gain) {
      const pts = POINTS_FOR_RUNG[Math.abs(st.rung)] ?? 2;
      st.points[gain] += pts;
      const signal = signalForPoints(pts);
      events.push({ type: 'points', side: gain, pts, signal, line: REF_LINES[signal] });
    } else {
      // pushed back a rung: that side's grip loosens
      const lost: 'you' | 'partner' = st.rung > rungFrom ? 'partner' : 'you';
      if (lost === 'you') st.pegada = Math.max(0, st.pegada - 1);
      else st.pegadaB = Math.max(0, st.pegadaB - 1);
    }
    st.nearGiven = { you: false, partner: false };
  } else {
    // an advantage for pressing close to a rung without getting it, once per rung and side
    if (st.momentum >= MOMENTUM_NEAR && st.rung < RUNG_MAX && !st.nearGiven.you) {
      st.nearGiven.you = true;
      st.adv.you += 1;
      events.push({ type: 'advantage', side: 'you', signal: 'vantagem', line: REF_LINES.vantagem });
    } else if (st.momentum <= -MOMENTUM_NEAR && st.rung > -RUNG_MAX && !st.nearGiven.partner) {
      st.nearGiven.partner = true;
      st.adv.partner += 1;
      events.push({ type: 'advantage', side: 'partner', signal: 'vantagem', line: REF_LINES.vantagem });
    }
  }
  return { state: st, yours: { correct: input.correct, speed, fast, force: yours }, partner: them, delta, events };
}

// ---------------------------------------------------------------- what comes next

export type NextStep = 'intent' | 'escape' | 'end';

/** After a resolve: time up ends it, a pinned player with the partner's pegada full may face an escape, otherwise the next exchange. */
export function nextStep(st: BoutState, partner: PartnerProfile, rng: Rng): NextStep {
  if (st.clockMs <= 0 || st.exchange >= MAX_EXCHANGES) return 'end';
  if (st.rung === -RUNG_MAX && st.pegadaB >= PEGADA_MAX && rng() < partnerFinishDrive(partner)) return 'escape';
  return 'intent';
}

/** Your finalização chance: at the top of the ladder with a full pegada. */
export const canFinish = (st: Pick<BoutState, 'rung' | 'pegada'>): boolean => st.rung === RUNG_MAX && st.pegada >= PEGADA_MAX;

export interface Offer {
  intents: IntentDef[];
  finish: boolean;
}

export const boutOffer = (st: BoutState): Offer => ({ intents: intentSet(st.rung), finish: canFinish(st) });

/** The finalização failed: the partner escapes back to guard. */
export function finishFailed(prev: BoutState): BoutState {
  const st = cloneState(prev);
  st.rung = 1;
  st.momentum = 0;
  st.pegada = 0;
  st.nearGiven = { you: false, partner: false };
  st.streak = 0;
  return st;
}

/** The escape worked: back to cem quilos with the partner's grip gone. */
export function escapeWorked(prev: BoutState): BoutState {
  const st = cloneState(prev);
  st.rung = -2;
  st.momentum = 10;
  st.pegadaB = 0;
  st.nearGiven = { you: false, partner: false };
  return st;
}

/** Spend real ms on the clock without an exchange (a finalização or escape attempt). */
export function spendClock(prev: BoutState, realMs: number): BoutState {
  const st = cloneState(prev);
  st.clockMs = Math.max(0, st.clockMs - clockCost(realMs));
  return st;
}

// ---------------------------------------------------------------- the decision

export function decide(st: BoutState): { winner: BoutWinner; reason: Exclude<BoutReason, 'finalizacao' | 'quit'> } {
  if (st.points.you !== st.points.partner) return { winner: st.points.you > st.points.partner ? 'you' : 'partner', reason: 'pontos' };
  if (st.adv.you !== st.adv.partner) return { winner: st.adv.you > st.adv.partner ? 'you' : 'partner', reason: 'vantagens' };
  return { winner: 'draw', reason: 'empate' };
}

// needs_br: true (the end lines)
export function endLine(winner: BoutWinner, reason: BoutReason): Bilingual {
  if (reason === 'finalizacao') {
    return winner === 'you'
      ? { pt: 'Final! Vitória sua!', en: 'Finish! You win!' }
      : { pt: 'Final! Boa defesa da próxima vez.', en: 'Finish! Better defence next time.' };
  }
  if (reason === 'quit') return { pt: 'Partida encerrada.', en: 'Match ended.' };
  if (winner === 'draw') return { pt: 'Empate!', en: 'A draw!' };
  const how = reason === 'pontos' ? 'nos pontos' : 'nas vantagens';
  const howEn = reason === 'pontos' ? 'on points' : 'on advantages';
  return winner === 'you' ? { pt: `Vitória ${how}!`, en: `You win ${howEn}!` } : { pt: `Vitória do parceiro ${how}.`, en: `Your partner wins ${howEn}.` };
}

export const THANKS_LINE: Bilingual = { pt: 'Obrigado pela partida.', en: 'Thanks for the match.' };

export function formatBoutClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ---------------------------------------------------------------- simulation (balance tests and tuning)

export interface SimPlayer {
  /** chance to answer right */
  accuracy: number;
  /** mean fraction of the time limit used before answering */
  usedShare: number;
  /** which intent to pick from the offer */
  policy: 'bold' | 'steady' | 'safe' | 'mixed';
}

export interface SimResult {
  winner: BoutWinner;
  reason: BoutReason;
  state: BoutState;
  realMs: number;
}

export function simulateBout(seed: number, partner: PartnerProfile, player: SimPlayer, level = 0): SimResult {
  const rng = mulberry32(seed);
  let st = newBoutState();
  let realMs = 0;
  for (let guard = 0; guard < 80; guard++) {
    const step = nextStep(st, partner, rng);
    if (step === 'end') break;
    if (step === 'escape') {
      const ok = rng() < player.accuracy;
      st = spendClock(st, 5_000);
      realMs += 5_000;
      if (ok) st = escapeWorked(st);
      else return { winner: 'partner', reason: 'finalizacao', state: st, realMs };
      continue;
    }
    const offer = boutOffer(st);
    if (offer.finish) {
      const plan = finishPlan(partner, level, rng);
      const p = plan.mode === 'triple' ? player.accuracy ** 3 : player.accuracy ** 1.6;
      const ok = rng() < p;
      st = spendClock(st, 9_000);
      realMs += 9_000;
      if (ok) return { winner: 'you', reason: 'finalizacao', state: st, realMs };
      st = finishFailed(st);
      continue;
    }
    const set = offer.intents;
    const pick = player.policy === 'bold' ? set[set.length - 1]! : player.policy === 'safe' ? set[0]! : player.policy === 'steady' ? set[Math.min(1, set.length - 1)]! : set[Math.floor(rng() * set.length)]!;
    const kind: ChallengeKind = 'cloze';
    const limit = challengeLimitMs(kind, level);
    const correct = rng() < player.accuracy;
    const used = Math.max(0.1, Math.min(1, player.usedShare + (rng() - 0.5) * 0.3));
    const elapsed = Math.round(used * limit);
    const spent = 2_500 + elapsed;
    realMs += spent + RESOLVE_MS;
    st = resolveExchange(st, { intent: pick.id, correct, elapsedMs: elapsed, limitMs: limit, spentMs: spent }, partner, rng).state;
  }
  const d = decide(st);
  return { ...d, state: st, realMs };
}
