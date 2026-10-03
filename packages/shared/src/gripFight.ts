/**
 * Academia tatame — grip contest (replaces the quiz bout). Pure rules: grips on gola / manga / calça,
 * pegar or soltar, puxar or empurrar only on a grip you hold. Wrong force bounces; the partner takes the beat.
 * A round is one position (~one minute), first to two clean steps or a finish wins the round.
 */
import type { Bilingual } from './types.js';
import type { PartnerProfile } from './academia.js';
import type { Rng } from './meveum.js';
import type { BjjPositionId } from './academia.js';

export const GRIP_FIGHT_PROTOCOL = 1;
export const ROUND_CLOCK_MS = 60_000;
export const STEPS_TO_WIN = 2;
export const BEAT_PICK_MS = 8_000;

export type GripSpot = 'gola' | 'manga' | 'calca';
export type GripForce = 'puxar' | 'empurrar';

export type GripMoveId =
  | `pegar_${GripSpot}`
  | `soltar_${GripSpot}`
  | `puxar_${GripSpot}`
  | `empurrar_${GripSpot}`
  | 'finalizar';

export interface GripFightState {
  position: BjjPositionId;
  clockMs: number;
  stepsYou: number;
  stepsThem: number;
  /** grips you hold on the partner */
  holdYou: GripSpot[];
  /** grips the partner holds on you */
  holdThem: GripSpot[];
  turn: 'you' | 'partner';
  exchange: number;
  /** same position rematch: bot targets the spot you whiffed most */
  weakSpot?: GripSpot;
}

export interface GripMoveDef {
  id: GripMoveId;
  pt: string;
  en: string;
}

export interface GripBeatEvent {
  type: 'grip' | 'step' | 'bounce' | 'finish' | 'turn';
  who: 'you' | 'partner';
  spot?: GripSpot;
  force?: GripForce;
  line?: Bilingual;
}

const SPOT_LABEL: Record<GripSpot, Bilingual> = {
  gola: { pt: 'gola', en: 'collar' },
  manga: { pt: 'manga', en: 'sleeve' },
  calca: { pt: 'calça', en: 'pants' },
};

/** Which force scores a clean step when you attack that grip (closed guard fundamentals). */
export const VALID_STEP_FORCE: Record<GripSpot, GripForce> = {
  gola: 'puxar',
  manga: 'empurrar',
  calca: 'empurrar',
};

export function newGripState(position: BjjPositionId = 'guarda_fechada'): GripFightState {
  return {
    position,
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
  const [verb, spot] = id.split('_') as [string, GripSpot];
  const s = SPOT_LABEL[spot];
  if (verb === 'pegar') return { pt: `Pegar ${s.pt}`, en: `Take ${s.en}` };
  if (verb === 'soltar') return { pt: `Soltar ${s.pt}`, en: `Release ${s.en}` };
  if (verb === 'puxar') return { pt: `Puxar ${s.pt}`, en: `Pull ${s.en}` };
  return { pt: `Empurrar ${s.pt}`, en: `Push ${s.en}` };
}

function has(arr: GripSpot[], s: GripSpot): boolean {
  return arr.includes(s);
}

function addGrip(arr: GripSpot[], s: GripSpot): GripSpot[] {
  return has(arr, s) ? arr : [...arr, s];
}

function dropGrip(arr: GripSpot[], s: GripSpot): GripSpot[] {
  return arr.filter((x) => x !== s);
}

export function gripCanFinish(st: GripFightState): boolean {
  return st.stepsYou >= 1 && st.holdYou.length >= 2 && st.position === 'guarda_fechada';
}

/** Legal moves for the side whose turn it is. */
export function offerMoves(st: GripFightState, side: 'you' | 'partner'): GripMoveDef[] {
  const hold = side === 'you' ? st.holdYou : st.holdThem;
  const theirs = side === 'you' ? st.holdThem : st.holdYou;
  const out: GripMoveDef[] = [];
  for (const spot of ['gola', 'manga', 'calca'] as GripSpot[]) {
    if (!has(hold, spot)) out.push({ id: `pegar_${spot}`, ...gripMoveLabel(`pegar_${spot}`) });
    else {
      out.push({ id: `soltar_${spot}`, ...gripMoveLabel(`soltar_${spot}`) });
      out.push({ id: `puxar_${spot}`, ...gripMoveLabel(`puxar_${spot}`) });
      out.push({ id: `empurrar_${spot}`, ...gripMoveLabel(`empurrar_${spot}`) });
    }
    if (has(theirs, spot)) out.push({ id: `soltar_${spot}`, ...gripMoveLabel(`soltar_${spot}`) });
  }
  if (side === 'you' && gripCanFinish(st)) out.push({ id: 'finalizar', ...gripMoveLabel('finalizar') });
  return out.slice(0, 6);
}

function spendTurn(st: GripFightState, ms: number): GripFightState {
  return { ...st, clockMs: Math.max(0, st.clockMs - ms), exchange: st.exchange + 1 };
}

function swapTurn(st: GripFightState): GripFightState {
  return { ...st, turn: st.turn === 'you' ? 'partner' : 'you' };
}

export interface BeatResult {
  state: GripFightState;
  events: GripBeatEvent[];
  /** move label shown after it lands (player-facing PT) */
  landed?: Bilingual;
}

function applyGripChange(st: GripFightState, side: 'you' | 'partner', id: GripMoveId): BeatResult {
  const events: GripBeatEvent[] = [];
  let s = { ...st, holdYou: [...st.holdYou], holdThem: [...st.holdThem] };
  const [verb, spot] = id.split('_') as [string, GripSpot];
  const label = gripMoveLabel(id);
  if (verb === 'pegar') {
    if (side === 'you') s.holdYou = addGrip(s.holdYou, spot);
    else s.holdThem = addGrip(s.holdThem, spot);
    events.push({ type: 'grip', who: side, spot, line: label });
  } else if (verb === 'soltar') {
    if (side === 'you') {
      if (has(s.holdYou, spot)) s.holdYou = dropGrip(s.holdYou, spot);
      else if (has(s.holdThem, spot)) s.holdThem = dropGrip(s.holdThem, spot);
    } else {
      if (has(s.holdThem, spot)) s.holdThem = dropGrip(s.holdThem, spot);
      else if (has(s.holdYou, spot)) s.holdYou = dropGrip(s.holdYou, spot);
    }
    events.push({ type: 'grip', who: side, spot, line: label });
  }
  s = spendTurn(s, 900);
  s = swapTurn(s);
  return { state: s, events, landed: label };
}

function applyForce(st: GripFightState, side: 'you' | 'partner', spot: GripSpot, force: GripForce): BeatResult {
  const events: GripBeatEvent[] = [];
  let s = { ...st, holdYou: [...st.holdYou], holdThem: [...st.holdThem] };
  const hold = side === 'you' ? s.holdYou : s.holdThem;
  const id = `${force}_${spot}` as GripMoveId;
  const label = gripMoveLabel(id);
  if (!has(hold, spot)) {
    events.push({ type: 'bounce', who: side, spot, force, line: { pt: 'Escorregou!', en: 'Slipped!' } });
    s = spendTurn(s, 700);
    s = swapTurn(s);
    return { state: s, events, landed: label };
  }
  const need = VALID_STEP_FORCE[spot];
  if (force !== need) {
    events.push({ type: 'bounce', who: side, spot, force, line: { pt: 'Força errada!', en: 'Wrong force!' } });
    s = spendTurn(s, 700);
    s = swapTurn(s);
    return { state: s, events, landed: label };
  }
  if (side === 'you') s.stepsYou = Math.min(STEPS_TO_WIN, s.stepsYou + 1);
  else s.stepsThem = Math.min(STEPS_TO_WIN, s.stepsThem + 1);
  events.push({ type: 'step', who: side, spot, force, line: label });
  s = spendTurn(s, 1_100);
  s = swapTurn(s);
  return { state: s, events, landed: label };
}

export function applyGripMove(st: GripFightState, side: 'you' | 'partner', move: GripMoveId): BeatResult {
  if (move === 'finalizar' && side === 'you' && gripCanFinish(st)) {
    const s = spendTurn({ ...st, stepsYou: STEPS_TO_WIN }, 1_500);
    return {
      state: s,
      events: [{ type: 'finish', who: 'you', line: { pt: 'Final!', en: 'Finish!' } }],
      landed: { pt: 'Final!', en: 'Finish!' },
    };
  }
  const [verb, spot] = move.split('_') as [string, GripSpot];
  if (verb === 'puxar' || verb === 'empurrar') return applyForce(st, side, spot, verb as GripForce);
  return applyGripChange(st, side, move);
}

/** Partner picks a move (contests grips; hounds `weakSpot` when set). */
export function botMove(st: GripFightState, partner: PartnerProfile, rng: Rng): GripMoveId {
  const moves = offerMoves(st, 'partner');
  if (!moves.length) return 'pegar_gola';
  const agg = partner.aggression;
  const forceMoves = moves.filter((m) => m.id.startsWith('puxar_') || m.id.startsWith('empurrar_'));
  if (forceMoves.length && rng() < 0.35 + agg * 0.35) {
    const valid = forceMoves.filter((m) => {
      const [, spot] = m.id.split('_') as [string, GripSpot];
      const f = m.id.startsWith('puxar_') ? 'puxar' : 'empurrar';
      return f === VALID_STEP_FORCE[spot];
    });
    const pool = valid.length ? valid : forceMoves;
    return pool[Math.floor(rng() * pool.length)]!.id;
  }
  if (st.weakSpot) {
    const peg = moves.find((m) => m.id === `pegar_${st.weakSpot}`);
    if (peg && rng() < 0.55) return peg.id;
  }
  const pegar = moves.filter((m) => m.id.startsWith('pegar_'));
  const pool = pegar.length ? pegar : moves;
  return pool[Math.floor(rng() * pool.length)]!.id;
}

export function roundWinner(st: GripFightState): 'you' | 'partner' | 'draw' | null {
  if (st.stepsYou >= STEPS_TO_WIN) return 'you';
  if (st.stepsThem >= STEPS_TO_WIN) return 'partner';
  if (st.clockMs > 0) return null;
  if (st.stepsYou !== st.stepsThem) return st.stepsYou > st.stepsThem ? 'you' : 'partner';
  return 'draw';
}

/** After a player whiffed force on a spot, remember for the next round in the same position. */
export function noteWeakSpot(st: GripFightState, events: GripBeatEvent[]): GripSpot | undefined {
  const bounce = events.find((e) => e.type === 'bounce' && e.who === 'you' && e.spot);
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
  return {
    rung: Math.max(-2, Math.min(2, lead)),
    momentum: lead * 20,
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
