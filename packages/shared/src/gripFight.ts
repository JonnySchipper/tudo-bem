/**
 * Academia tatame — a shared beat on the mat (replaces the quiz and the "one correct force per grip" chart).
 *
 * Both of you move at once. The posture on screen says which force scores: Perto → empurrar, Longe → puxar.
 * A fast or tricky partner hides that word, or shows the wrong one. You can only pull or push a grip you hold;
 * the same handhold grabbed by both of you goes to neither; clearing a grip races the force on it.
 * A clean step walks the picture along the mat. First to four steps, or Final!, wins the round.
 *
 * Learner-facing copy stays everyday Portuguese (no position names, no "Oss").
 */
import type { Bilingual } from './types.js';
import type { PartnerProfile } from './academia.js';
import type { Rng } from './meveum.js';
import type { BjjPositionId } from './academia.js';

export const GRIP_FIGHT_PROTOCOL = 1;
export const ROUND_CLOCK_MS = 75_000;
/** Clean steps that end the round. Enough to walk the picture from the start to the top. */
export const STEPS_TO_WIN = 4;
export const BEAT_PICK_MS = 8_000;

export type GripSpot = 'gola' | 'manga' | 'calca';
export type GripForce = 'puxar' | 'empurrar';
export type Posture = 'perto' | 'longe';

export type GripMoveId =
  | `pegar_${GripSpot}`
  | `soltar_${GripSpot}`
  | `puxar_${GripSpot}`
  | `empurrar_${GripSpot}`
  | 'finalizar';

export type GripVerb = 'pegar' | 'soltar' | 'puxar' | 'empurrar' | 'finalizar';

export interface GripFightState {
  /** picture on the mat right now */
  position: BjjPositionId;
  /** picture the round started on; a tied lead comes back here */
  home: BjjPositionId;
  clockMs: number;
  stepsYou: number;
  stepsThem: number;
  /** grips you hold on the partner */
  holdYou: GripSpot[];
  /** grips the partner holds on you */
  holdThem: GripSpot[];
  turn: 'you' | 'partner';
  exchange: number;
  /** same-position rematch: bot targets the spot you whiffed most */
  weakSpot?: GripSpot;
}

export interface GripMoveDef {
  id: GripMoveId;
  pt: string;
  en: string;
  verb: GripVerb;
  spot?: GripSpot;
}

export interface GripBeatEvent {
  type: 'grip' | 'step' | 'bounce' | 'finish' | 'turn';
  who: 'you' | 'partner';
  spot?: GripSpot;
  force?: GripForce;
  line?: Bilingual;
}

export const SPOT_NAME: Record<GripSpot, Bilingual> = {
  gola: { pt: 'Gola', en: 'Collar' },
  manga: { pt: 'Manga', en: 'Sleeve' },
  calca: { pt: 'Calça', en: 'Pants' },
};

const SPOT_IN: Record<GripSpot, Bilingual> = {
  gola: { pt: 'a gola', en: 'the collar' },
  manga: { pt: 'a manga', en: 'the sleeve' },
  calca: { pt: 'a calça', en: 'the pants' },
};

export const POSTURE_LABEL: Record<Posture, Bilingual> = {
  perto: { pt: 'Perto', en: 'Close' },
  longe: { pt: 'Longe', en: 'Far' },
};

/** The one rule on the panel. Close enough to push; far enough that you have to pull. */
export const POSTURE_RULE: Bilingual = {
  pt: 'Perto: empurre. Longe: puxe.',
  en: 'Close: push. Far: pull.',
};

/** Which force scores while the partner is in that posture. */
export const forceForPosture = (p: Posture): GripForce => (p === 'perto' ? 'empurrar' : 'puxar');

const YOU_PATH: readonly BjjPositionId[] = ['cem_quilos', 'joelho', 'montada', 'montada'];
const THEM_PATH: readonly BjjPositionId[] = ['de_pe', 'meia_guarda', 'cem_quilos', 'joelho'];

/** The mat picture for a lead (positive: you have stepped ahead). Lead 0 is the round's start. */
export function pictureForLead(lead: number, home: BjjPositionId = 'guarda_fechada'): BjjPositionId {
  if (lead === 0) return home;
  if (lead > 0) return YOU_PATH[Math.min(YOU_PATH.length - 1, lead - 1)]!;
  return THEM_PATH[Math.min(THEM_PATH.length - 1, -lead - 1)]!;
}

export function newGripState(position: BjjPositionId = 'guarda_fechada'): GripFightState {
  return {
    position,
    home: position,
    clockMs: ROUND_CLOCK_MS,
    stepsYou: 0,
    stepsThem: 0,
    holdYou: [],
    holdThem: [],
    turn: 'you',
    exchange: 0,
  };
}

export function gripMoveLabel(id: GripMoveId): Bilingual {
  if (id === 'finalizar') return { pt: 'Final!', en: 'Finish!' };
  const [verb, spot] = id.split('_') as [GripVerb, GripSpot];
  const s = SPOT_IN[spot];
  if (verb === 'pegar') return { pt: `Pegar ${s.pt}`, en: `Take ${s.en}` };
  if (verb === 'soltar') return { pt: `Tirar ${s.pt}`, en: `Clear ${s.en}` };
  if (verb === 'puxar') return { pt: `Puxar ${s.pt}`, en: `Pull ${s.en}` };
  return { pt: `Empurrar ${s.pt}`, en: `Push ${s.en}` };
}

const SHORT: Record<Exclude<GripVerb, 'finalizar'>, Bilingual> = {
  pegar: { pt: 'Pegar', en: 'Take' },
  soltar: { pt: 'Tirar', en: 'Clear' },
  puxar: { pt: 'Puxar', en: 'Pull' },
  empurrar: { pt: 'Empurrar', en: 'Push' },
};

function has(arr: GripSpot[], s: GripSpot): boolean {
  return arr.includes(s);
}

export function gripCanFinish(st: GripFightState): boolean {
  return st.stepsYou >= 1 && st.holdYou.length >= 2;
}

function moveDef(verb: Exclude<GripVerb, 'finalizar'>, spot: GripSpot, pt?: string, en?: string): GripMoveDef {
  const s = SHORT[verb];
  return { id: `${verb}_${spot}`, pt: pt ?? s.pt, en: en ?? s.en, verb, spot };
}

/** Legal moves for one side, spot by spot: take an open handhold, clear theirs, or pull/push one you hold. */
export function offerMoves(st: GripFightState, side: 'you' | 'partner'): GripMoveDef[] {
  const mine = side === 'you' ? st.holdYou : st.holdThem;
  const theirs = side === 'you' ? st.holdThem : st.holdYou;
  const out: GripMoveDef[] = [];
  for (const spot of ['gola', 'manga', 'calca'] as GripSpot[]) {
    const iHold = has(mine, spot);
    const theyHold = has(theirs, spot);
    if (iHold) {
      out.push(moveDef('puxar', spot));
      out.push(moveDef('empurrar', spot));
    }
    if (theyHold) out.push(moveDef('soltar', spot));
    else if (!iHold) out.push(moveDef('pegar', spot));
  }
  if (side === 'you' && gripCanFinish(st)) out.push({ id: 'finalizar', ...gripMoveLabel('finalizar'), verb: 'finalizar' });
  return out;
}

interface Act {
  verb: GripVerb;
  spot?: GripSpot;
}

function parseMove(id: GripMoveId): Act {
  if (id === 'finalizar') return { verb: 'finalizar' };
  const [verb, spot] = id.split('_') as [GripVerb, GripSpot];
  return { verb, spot };
}

function clone(st: GripFightState): GripFightState {
  return { ...st, holdYou: [...st.holdYou], holdThem: [...st.holdThem] };
}

function placePicture(st: GripFightState): GripFightState {
  return { ...st, position: pictureForLead(st.stepsYou - st.stepsThem, st.home) };
}

export interface BeatCommit {
  you: GripMoveId;
  them: GripMoveId;
  /** the posture that actually decides the force */
  posture: Posture;
  /** the posture that was on screen (a trick when it differs) */
  shown: Posture;
  feint: boolean;
  /** real ms the player spent choosing; the round clock loses at least a beat */
  spentMs: number;
  /** a one-sided check: the other side's Final! is only a placeholder */
  solo?: 'you' | 'partner';
}

export interface BeatResult {
  state: GripFightState;
  events: GripBeatEvent[];
  landed?: Bilingual;
  feint: boolean;
  posture: Posture;
  shown: Posture;
}

const other = (side: 'you' | 'partner'): 'you' | 'partner' => (side === 'you' ? 'partner' : 'you');

/**
 * One shared beat. Grips are read from the start of the beat, so a pull and a clear on the same
 * handhold race: the right force scores and keeps the grip; the wrong force slips and the clear lands.
 */
export function resolveBeat(st: GripFightState, c: BeatCommit): BeatResult {
  const events: GripBeatEvent[] = [];
  const meta = { feint: c.feint, posture: c.posture, shown: c.shown };
  if (c.you === 'finalizar' && c.solo !== 'partner' && gripCanFinish(st)) {
    const s = placePicture({ ...clone(st), stepsYou: STEPS_TO_WIN, clockMs: Math.max(0, st.clockMs - Math.max(1_200, c.spentMs)), exchange: st.exchange + 1, turn: 'you' });
    const line = { pt: 'Final!', en: 'Finish!' };
    return { state: s, events: [{ type: 'finish', who: 'you', line }], landed: line, ...meta };
  }

  const youHold = new Set(st.holdYou);
  const themHold = new Set(st.holdThem);
  let stepsYou = st.stepsYou;
  let stepsThem = st.stepsThem;
  const you = parseMove(c.you);
  const them = parseMove(c.them);
  const need = forceForPosture(c.posture);
  const consumed = { you: false, partner: false };

  const holdOf = (side: 'you' | 'partner') => (side === 'you' ? youHold : themHold);
  const actOf = (side: 'you' | 'partner') => (side === 'you' ? you : them);

  const attack = (side: 'you' | 'partner') => {
    const act = actOf(side);
    if (act.verb !== 'puxar' && act.verb !== 'empurrar') return;
    const spot = act.spot!;
    const label = gripMoveLabel(`${act.verb}_${spot}` as GripMoveId);
    if (!holdOf(side).has(spot)) {
      events.push({ type: 'bounce', who: side, spot, force: act.verb, line: { pt: 'Escorregou!', en: 'Slipped!' } });
      consumed[side] = true;
      return;
    }
    const opp = actOf(other(side));
    const racing = opp.verb === 'soltar' && opp.spot === spot && holdOf(side).has(spot);
    if (act.verb !== need) {
      events.push({ type: 'bounce', who: side, spot, force: act.verb, line: { pt: 'Força errada!', en: 'Wrong force!' } });
      if (racing) {
        holdOf(side).delete(spot);
        consumed[other(side)] = true;
        const bit = SPOT_IN[spot];
        events.push({ type: 'grip', who: other(side), spot, line: { pt: `Tirou ${bit.pt}!`, en: `Cleared ${bit.en}!` } });
      }
      consumed[side] = true;
      return;
    }
    if (side === 'you') stepsYou = Math.min(STEPS_TO_WIN, stepsYou + 1);
    else stepsThem = Math.min(STEPS_TO_WIN, stepsThem + 1);
    events.push({ type: 'step', who: side, spot, force: act.verb, line: { pt: `${label.pt}!`, en: `${label.en}!` } });
    if (racing) consumed[other(side)] = true;
    consumed[side] = true;
  };

  attack('you');
  attack('partner');

  const hands = (side: 'you' | 'partner') => {
    if (consumed[side]) return;
    const act = actOf(side);
    const spot = act.spot;
    if (!spot) return;
    const mine = holdOf(side);
    const opp = holdOf(other(side));
    const foe = actOf(other(side));
    if (act.verb === 'pegar') {
      if (foe.verb === 'pegar' && foe.spot === spot) {
        if (side === 'you') events.push({ type: 'bounce', who: 'you', spot, line: { pt: 'Os dois!', en: 'Both of you!' } });
        consumed.you = true;
        consumed.partner = true;
        return;
      }
      if (!mine.has(spot)) {
        mine.add(spot);
        const bit = SPOT_IN[spot];
        events.push({ type: 'grip', who: side, spot, line: { pt: `Pegou ${bit.pt}!`, en: `Took ${bit.en}!` } });
      }
      return;
    }
    if (act.verb === 'soltar') {
      if (opp.has(spot)) {
        opp.delete(spot);
        const bit = SPOT_IN[spot];
        events.push({ type: 'grip', who: side, spot, line: { pt: `Tirou ${bit.pt}!`, en: `Cleared ${bit.en}!` } });
      } else if (mine.has(spot)) {
        mine.delete(spot);
        const bit = SPOT_IN[spot];
        events.push({ type: 'grip', who: side, spot, line: { pt: `Soltou ${bit.pt}.`, en: `Let go of ${bit.en}.` } });
      }
    }
  };
  hands('you');
  hands('partner');

  const s = placePicture({
    ...st,
    holdYou: [...youHold],
    holdThem: [...themHold],
    stepsYou,
    stepsThem,
    clockMs: Math.max(0, st.clockMs - Math.max(1_400, Math.round(c.spentMs))),
    exchange: st.exchange + 1,
    turn: 'you',
  });
  return { state: s, events, landed: outcomeLine({ events, feint: c.feint, posture: c.posture }), ...meta };
}

/** The line the player should read (and hear) after their half of the beat. */
export function outcomeLine(r: Pick<BeatResult, 'events' | 'feint' | 'posture'>): Bilingual {
  const mine = r.events.filter((e) => e.who === 'you' || e.type === 'finish');
  const wrong = mine.find((e) => e.type === 'bounce' && e.line?.pt === 'Força errada!');
  if (r.feint && wrong) {
    return r.posture === 'perto'
      ? { pt: 'Truque! Estava perto.', en: 'A trick! They were close.' }
      : { pt: 'Truque! Estava longe.', en: 'A trick! They were far.' };
  }
  const step = mine.find((e) => e.type === 'step' || e.type === 'finish');
  if (step?.line) return step.type === 'finish' ? step.line : { pt: `Passo! ${step.line.pt}`, en: `Step! ${step.line.en}` };
  const otherEv = mine.find((e) => e.line);
  if (otherEv?.line) return otherEv.line;
  return { pt: 'Nada.', en: 'Nothing.' };
}

/** One side's move on its own (nobody answers it). Default posture is Longe, so a pull scores. */
export function applyGripMove(st: GripFightState, side: 'you' | 'partner', move: GripMoveId, posture: Posture = 'longe'): BeatResult {
  const wait: GripMoveId = 'finalizar';
  // finalizar on the waiting side is a no-op (only your own Final! ends it, and only when you pick it)
  return resolveBeat(st, {
    you: side === 'you' ? move : wait,
    them: side === 'partner' ? move : wait,
    posture,
    shown: posture,
    feint: false,
    spentMs: 900,
    solo: side,
  });
}

export interface PostureRoll {
  posture: Posture;
  shown: Posture;
  feint: boolean;
  tellMs: number;
}

/** How long the posture stays up. Slow partners leave it; fast ones flash it. New players get longer. */
export function tellWindowMs(speed: number, level: number): number {
  const s = Math.max(0, Math.min(1, speed));
  const base = Math.round(3400 - 2100 * s);
  const learn = level <= 1 ? 1.55 : level <= 3 ? 1.2 : 1;
  return Math.max(850, Math.round((base * learn) / 50) * 50);
}

export function feintChance(p: PartnerProfile, level: number): number {
  const raw = Math.max(0, (p.aggression - 0.4) * 0.7);
  return level <= 1 ? raw * 0.25 : raw;
}

export function rollPosture(p: PartnerProfile, rng: Rng, level: number): PostureRoll {
  const posture: Posture = rng() < 0.5 ? 'perto' : 'longe';
  const feint = rng() < feintChance(p, level);
  const shown: Posture = feint ? (posture === 'perto' ? 'longe' : 'perto') : posture;
  return { posture, shown, feint, tellMs: tellWindowMs(p.speed, level) };
}

/** What this partner feels like on the card, in one line. */
export function partnerHabit(p: PartnerProfile): Bilingual {
  if (p.aggression >= 0.85) return { pt: 'Usa truques', en: 'Uses tricks' };
  if (p.speed >= 0.8) return { pt: 'A postura some rápido', en: 'The posture vanishes fast' };
  if (p.defense >= 0.85) return { pt: 'Tira a sua pegada', en: 'Clears your grip' };
  if (p.accuracy >= 0.8) return { pt: 'Quase não erra a força', en: 'Almost never misses the force' };
  return { pt: 'Postura clara', en: 'A clear posture' };
}

/**
 * What a frozen player does when the beat timer runs out.
 * Reach for an open spot, or clear one of theirs. Never spend the force that would score a step,
 * so standing still cannot walk the round.
 */
export function idleMove(st: GripFightState, posture: Posture = 'longe'): GripMoveId {
  const moves = offerMoves(st, 'you').filter((m) => m.id !== 'finalizar');
  const grab = moves.find((m) => m.verb === 'pegar');
  if (grab) return grab.id;
  const clear = moves.find((m) => m.verb === 'soltar');
  if (clear) return clear.id;
  const wrong: GripForce = forceForPosture(posture) === 'puxar' ? 'empurrar' : 'puxar';
  return moves.find((m) => m.verb === wrong)?.id ?? moves[0]?.id ?? 'pegar_gola';
}

/** Partner picks a move from the true posture (contests grips; hounds `weakSpot` when set). */
export function botMove(st: GripFightState, partner: PartnerProfile, rng: Rng, posture: Posture = 'longe'): GripMoveId {
  const moves = offerMoves(st, 'partner').filter((m) => m.id !== 'finalizar');
  if (!moves.length) return 'pegar_gola';
  if (st.holdYou.length && rng() < partner.defense * 0.72) {
    const wanted = st.weakSpot && st.holdYou.includes(st.weakSpot) ? st.weakSpot : st.holdYou[Math.floor(rng() * st.holdYou.length)];
    const strip = moves.find((m) => m.verb === 'soltar' && m.spot === wanted) ?? moves.find((m) => m.verb === 'soltar' && m.spot && st.holdYou.includes(m.spot));
    if (strip) return strip.id;
  }
  const attacks = moves.filter((m) => m.verb === 'puxar' || m.verb === 'empurrar');
  if (attacks.length && rng() < 0.22 + partner.aggression * 0.55) {
    const right = forceForPosture(posture);
    const good = attacks.filter((m) => m.verb === right);
    const bad = attacks.filter((m) => m.verb !== right);
    const honest = rng() < partner.accuracy;
    const pool = honest && good.length ? good : bad.length && !honest ? bad : good.length ? good : attacks;
    return pool[Math.floor(rng() * pool.length)]!.id;
  }
  if (st.weakSpot) {
    const peg = moves.find((m) => m.id === `pegar_${st.weakSpot}`);
    if (peg && rng() < 0.62) return peg.id;
  }
  const pegar = moves.filter((m) => m.verb === 'pegar');
  const pool = pegar.length ? pegar : moves;
  return pool[Math.floor(rng() * pool.length)]!.id;
}

export function roundWinner(st: GripFightState): 'you' | 'partner' | 'draw' | null {
  if (st.stepsYou >= STEPS_TO_WIN && st.stepsThem >= STEPS_TO_WIN) return st.stepsYou === st.stepsThem ? 'draw' : st.stepsYou > st.stepsThem ? 'you' : 'partner';
  if (st.stepsYou >= STEPS_TO_WIN) return 'you';
  if (st.stepsThem >= STEPS_TO_WIN) return 'partner';
  if (st.clockMs > 0) return null;
  if (st.stepsYou !== st.stepsThem) return st.stepsYou > st.stepsThem ? 'you' : 'partner';
  return 'draw';
}

/** After a player whiffed force on a spot, remember it for the next round in the same position. */
export function noteWeakSpot(st: GripFightState, events: GripBeatEvent[]): GripSpot | undefined {
  const bounce = events.find((e) => e.type === 'bounce' && e.who === 'you' && e.spot && e.line?.pt === 'Força errada!');
  return bounce?.spot ?? st.weakSpot;
}

/** Map grip state into the legacy bout snapshot the mat renderer already understands. */
export function gripToSnapshot(st: GripFightState): {
  rung: number;
  momentum: number;
  points: { you: number; partner: number };
  adv: { you: number; partner: number };
  pegada: number;
  pegadaB: number;
  clockMs: number;
  exchange: number;
  position: BjjPositionId;
  ahead: 'you' | 'partner' | null;
  streak: number;
} {
  const lead = st.stepsYou - st.stepsThem;
  const rung = Math.max(-4, Math.min(4, lead));
  return {
    rung,
    momentum: Math.max(-100, Math.min(100, lead * 24)),
    points: { you: st.stepsYou, partner: st.stepsThem },
    adv: { you: 0, partner: 0 },
    pegada: st.holdYou.length,
    pegadaB: st.holdThem.length,
    clockMs: st.clockMs,
    exchange: st.exchange,
    position: st.position,
    ahead: lead > 0 ? 'you' : lead < 0 ? 'partner' : null,
    streak: 0,
  };
}

/** Learner-facing chrome for the grip round (no position names; steps only). */
export function gripRoundChrome(st: Pick<GripFightState, 'stepsYou' | 'stepsThem'>): Bilingual {
  return { pt: `Passos ${st.stepsYou}–${st.stepsThem}`, en: `Steps ${st.stepsYou}–${st.stepsThem}` };
}
