/**
 * Academia mat fight. One function resolves a turn for either fighter (a second human can sit in the same call later).
 * Rolls stay on the server. The client shows the percent (and what moved it) before the player confirms.
 *
 * Grips are strategy, not a flat bonus (docs/lifesim/DECISIONS.md, "Tatame v2"):
 *  - Gola (collar): Queda +20, and opens Arrastar. A collar with no sleeve is punished: their Abraço gets +15.
 *  - Manga (sleeve): their attacks on you are −20, and opens Puxar (pull them down; you keep the sleeve, so the next sweep is +20).
 *  - Both: open Arremesso, the strongest throw.
 *  - Postura strips their grips and braces against grips; Base braces against takedowns (and sweeps, from on top).
 *    An attack that runs into a brace and misses is a Vantagem for the defender. A brace waits for one move only.
 *  - A grip held through three of your turns slips, and you are tired (−10) for one move. Advantages break a points tie.
 * The partner telegraphs its next move (`planBot`), and the moves that answer it are flagged.
 *
 * needs_br: true on every new Portuguese label below. The words reuse academia copy where it already exists
 * (pegar, gola, manga, segurar, em pé). No quiz and no new technique name in the diary.
 */
import type { Bilingual } from './types.js';
import type { Belt } from './academia.js';
import type { BjjPositionId } from './academia.js';
import { diaryKey, diaryWord, normalizeDiary, type DiaryWord } from './diary.js';

export const MAT_TURNS = 10;
export const PERCENT_CAP = 95;
export const PERCENT_FLOOR = 5;

/** What each grip is worth (percent points). */
export const COLLAR_QUEDA = 20;
export const SLEEVE_SHIELD = 20;
export const LONE_COLLAR_PUNISH = 15;
export const SLEEVE_SWEEP = 20;
export const SLEEVE_ANKLE = 15;
/** A grip slips at the end of the holder's third turn holding it. */
export const GRIP_SLIP = 3;
export const TIRED_MALUS = 10;

/**
 * How long the client holds a move's cartoon, and how long it then waits while the opponent decides.
 * The next pick is not on screen until your cartoon, that pause, and their cartoon have all played.
 * The server pick clock waits the same span, or Hold fires while the cartoons are still up.
 */
export const MAT_CARTOON_MS = 2_000;
export const MAT_THINK_MS = 3_200;
export const MAT_INTENT_REVEAL_MS = MAT_CARTOON_MS + MAT_THINK_MS + MAT_CARTOON_MS;

export const BELT_ORDER = ['branca', 'azul', 'roxa', 'marrom', 'preta'] as const satisfies readonly Belt[];

export type MatMoveId =
  | 'collar_tie'
  | 'sleeve_grip'
  | 'double_leg'
  | 'body_lock'
  | 'single_leg'
  | 'collar_drag'
  | 'sleeve_pull'
  | 'hip_throw'
  | 'hook_sweep'
  | 'scissor_sweep'
  | 'hip_bump'
  | 'posture'
  | 'passar'
  | 'knee_on_belly'
  | 'back_take'
  | 'sprawl'
  | 'frame'
  | 'escape_back'
  | 'armbar'
  | 'americana'
  | 'rnc'
  | 'hold';

export type MatKind = 'standing' | 'closed_guard' | 'side_control' | 'knee_on_belly' | 'mount' | 'back_control';
export type MatSide = 'you' | 'them';

/** `top` is who is on top, from the player's seat. Standing has no top. */
export type MatPosition = { kind: 'standing' } | { kind: Exclude<MatKind, 'standing'>; top: MatSide };

export interface GripFlags {
  collar: boolean;
  sleeve: boolean;
}
export type GripId = keyof GripFlags;

/** A defense waiting for the other fighter's next move. */
export type MatBrace = 'postura' | 'base' | 'recuperar';
/** What an attack is, for braces and the sleeve's shield. */
export type MatAttack = 'pegada' | 'queda' | 'raspagem' | 'passagem' | 'final';

/** How much each brace takes off each kind of attack. */
export const BRACE_CUT: Record<MatBrace, Partial<Record<MatAttack, number>>> = {
  postura: { pegada: 30, queda: 15 },
  base: { queda: 30, raspagem: 30 },
  recuperar: { passagem: 30 },
};

type Pair<T> = { you: T; them: T };

export interface MatState {
  position: MatPosition;
  points: Pair<number>;
  /** Vantagens: a brace that stopped an attack. They break a points tie. */
  adv: Pair<number>;
  /** Turns already played, counting both fighters. The match ends at {@link MAT_TURNS}. */
  turnsUsed: number;
  actor: MatSide;
  grips: Pair<GripFlags>;
  /** Own turns each held grip has been kept. It slips at {@link GRIP_SLIP}. */
  gripAge: Pair<{ collar: number; sleeve: number }>;
  brace: Pair<MatBrace | null>;
  /** A grip slipped: the next move is −{@link TIRED_MALUS}. */
  tired: Pair<boolean>;
  /** -1..1 from the player's seat: who won the last exchange (a landed move, or the other side's miss). Feeds the meter. */
  flow: number;
  /** Position keys already paid this exchange (`you:mount`). Cleared on a reset to standing or a missed submission. */
  scored: string[];
  over: boolean;
  winner: 'you' | 'them' | 'draw' | null;
  reason: 'submission' | 'points' | 'advantages' | 'draw' | null;
}

export type MatSound = 'hit' | 'whoosh' | 'mount' | 'sub' | 'none';

/** What changed besides the position, so the mat can draw the grip snap, the strip, the slip and the advantage. */
export type MatEvent =
  | { kind: 'grip'; side: MatSide; grip: GripId }
  | { kind: 'strip'; side: MatSide; grips: GripId[] }
  | { kind: 'slip'; side: MatSide; grips: GripId[] }
  | { kind: 'brace'; side: MatSide; brace: MatBrace }
  | { kind: 'blocked'; side: MatSide };

export interface MatResult {
  state: MatState;
  ok: boolean;
  success: boolean;
  points: number;
  submission: boolean;
  sound: MatSound;
  line: Bilingual;
  from: BjjPositionId;
  to: BjjPositionId;
  fromAhead: 'you' | 'partner' | null;
  toAhead: 'you' | 'partner' | null;
  fromRung: number;
  toRung: number;
  /** The percent the roll was made against. */
  percent: number;
  events: MatEvent[];
  meterFrom: number;
  meterTo: number;
}

// needs_br: true
export const MOVE_LABEL: Record<MatMoveId, Bilingual> = {
  collar_tie: { pt: 'Pegar a gola', en: 'Collar grip' },
  sleeve_grip: { pt: 'Pegar a manga', en: 'Sleeve grip' },
  double_leg: { pt: 'Queda', en: 'Takedown' },
  body_lock: { pt: 'Abraço', en: 'Body lock trip' },
  // needs_br: true — Tornozelo. A later takedown from standing into the knee.
  single_leg: { pt: 'Tornozelo', en: 'Ankle pick' },
  // needs_br: true — Arrastar, Puxar, Arremesso: plain verbs/nouns, opened by the grips (no technique names).
  collar_drag: { pt: 'Arrastar', en: 'Drag (needs collar)' },
  sleeve_pull: { pt: 'Puxar', en: 'Pull down (needs sleeve)' },
  hip_throw: { pt: 'Arremesso', en: 'Throw (needs both)' },
  // needs_br: true — Gancho. A basic closed-guard sweep, distinct from Tesoura and Quadril.
  hook_sweep: { pt: 'Gancho', en: 'Hook sweep' },
  scissor_sweep: { pt: 'Tesoura', en: 'Scissor sweep' },
  hip_bump: { pt: 'Quadril', en: 'Hip bump' },
  // needs_br: true — Postura. A basic standing defense, distinct from Base.
  posture: { pt: 'Postura', en: 'Posture' },
  // needs_br: true — Passar. From the top after Queda, or from the top of closed guard.
  passar: { pt: 'Passar', en: 'Pass' },
  // needs_br: true — Joelho. From side control into the knee.
  knee_on_belly: { pt: 'Joelho', en: 'Knee ride' },
  // needs_br: true — Encaixe. From side, knee, or mount onto the back.
  back_take: { pt: 'Encaixe', en: 'Seatbelt' },
  sprawl: { pt: 'Base', en: 'Base' },
  frame: { pt: 'Recuperar', en: 'Frame and recover' },
  escape_back: { pt: 'Sair', en: 'Escape back' },
  armbar: { pt: 'Braço', en: 'Armbar' },
  americana: { pt: 'Americana', en: 'Arm lock' },
  rnc: { pt: 'Pescoço', en: 'Rear naked choke' },
  hold: { pt: 'Segurar', en: 'Hold' },
};

/** null = locked at that belt. Order is white, blue, purple, brown, black. */
const PERCENT: Record<Exclude<MatMoveId, 'hold'>, readonly (number | null)[]> = {
  collar_tie: [70, 78, 84, 90, 94],
  sleeve_grip: [65, 74, 82, 88, 93],
  double_leg: [45, 55, 65, 74, 82],
  body_lock: [50, 60, 70, 78, 85],
  single_leg: [null, null, 40, 52, 64],
  collar_drag: [52, 62, 70, 78, 85],
  sleeve_pull: [80, 85, 89, 92, 94],
  hip_throw: [62, 70, 78, 85, 90],
  hook_sweep: [38, 50, 62, 72, 80],
  scissor_sweep: [40, 52, 64, 74, 82],
  hip_bump: [48, 58, 68, 76, 84],
  posture: [55, 66, 76, 84, 90],
  passar: [50, 62, 72, 80, 88],
  knee_on_belly: [44, 56, 66, 76, 84],
  back_take: [null, null, 36, 50, 64],
  sprawl: [60, 70, 78, 85, 90],
  frame: [35, 48, 60, 72, 82],
  escape_back: [25, 38, 52, 66, 78],
  armbar: [18, 30, 42, 55, 68],
  americana: [null, 22, 28, 44, 60],
  rnc: [null, null, 24, 36, 55],
};

const POINTS: Partial<Record<MatMoveId, number>> = {
  double_leg: 2,
  body_lock: 2,
  single_leg: 2,
  collar_drag: 2,
  hip_throw: 2,
  hook_sweep: 2,
  scissor_sweep: 2,
  hip_bump: 2,
  passar: 3,
  knee_on_belly: 2,
  back_take: 4,
};

/**
 * One skill per award, in order. White belt is the belt being put on, not a win.
 * Day one is one move on each gag track: a grip, Queda, Gancho, Postura, Passar, and a weak submission.
 * Later awards fill the track. Sleeve, Abraço, Base, Tesoura, Quadril, Recuperar, Sair, Americana, and Pescoço stay on the same stripe.
 * The empty white stripe teaches Joelho. Purple then teaches Encaixe, so the choke can be reached, and Tornozelo, a third takedown.
 * The grip combos (Arrastar, Puxar, Arremesso) are not awards: owning the grips opens them ({@link COMBOS}).
 */
export const UNLOCK_ORDER: readonly { belt: Belt; stripes: number; move: MatMoveId }[] = [
  { belt: 'branca', stripes: 0, move: 'collar_tie' },
  { belt: 'branca', stripes: 0, move: 'double_leg' },
  { belt: 'branca', stripes: 0, move: 'hook_sweep' },
  { belt: 'branca', stripes: 0, move: 'posture' },
  { belt: 'branca', stripes: 0, move: 'passar' },
  { belt: 'branca', stripes: 0, move: 'armbar' },
  { belt: 'branca', stripes: 1, move: 'sleeve_grip' },
  { belt: 'branca', stripes: 2, move: 'knee_on_belly' },
  { belt: 'branca', stripes: 3, move: 'body_lock' },
  { belt: 'branca', stripes: 4, move: 'sprawl' },
  { belt: 'azul', stripes: 0, move: 'scissor_sweep' },
  { belt: 'azul', stripes: 1, move: 'hip_bump' },
  { belt: 'azul', stripes: 2, move: 'frame' },
  { belt: 'azul', stripes: 3, move: 'escape_back' },
  { belt: 'azul', stripes: 4, move: 'americana' },
  { belt: 'roxa', stripes: 0, move: 'rnc' },
  { belt: 'roxa', stripes: 1, move: 'back_take' },
  { belt: 'roxa', stripes: 2, move: 'single_leg' },
];

/** The follow-ups a grip opens: owning the grips (not a stripe) puts these in the fight. */
export const COMBOS: readonly { move: MatMoveId; needs: readonly MatMoveId[] }[] = [
  { move: 'collar_drag', needs: ['collar_tie'] },
  { move: 'sleeve_pull', needs: ['sleeve_grip'] },
  { move: 'hip_throw', needs: ['collar_tie', 'sleeve_grip'] },
];

const MOVE_IDS = new Set<string>(Object.keys(MOVE_LABEL));

export const isMatMove = (id: unknown): id is MatMoveId => typeof id === 'string' && MOVE_IDS.has(id);

export const beltIndex = (b: Belt): number => Math.max(0, BELT_ORDER.indexOf(b));

export function moveTaughtAt(belt: Belt, stripes: number): MatMoveId | null {
  return UNLOCK_ORDER.find((u) => u.belt === belt && u.stripes === stripes)?.move ?? null;
}

/** Every move whose award is this rank or earlier, including the move taught at this exact stripe. */
export function movesThrough(belt: Belt, stripes: number): MatMoveId[] {
  const idx = beltIndex(belt);
  const out: MatMoveId[] = [];
  for (const u of UNLOCK_ORDER) {
    const ui = beltIndex(u.belt);
    if (ui < idx || (ui === idx && u.stripes <= stripes)) out.push(u.move);
  }
  return out;
}

/** The full pool of one belt: the belt award plus that belt's four stripes, and everything earlier. */
export function rankPool(belt: Belt): MatMoveId[] {
  return movesThrough(belt, 4);
}

/** The pool plus the follow-ups its grips open. */
export function withCombos(moves: readonly MatMoveId[]): MatMoveId[] {
  const out = [...moves];
  for (const c of COMBOS) if (c.needs.every((n) => moves.includes(n)) && !out.includes(c.move)) out.push(c.move);
  return out;
}

/**
 * Moves this fighter may play.
 * Same belt: only what they personally have unlocked.
 * Higher belt: the lower belt's whole pool (belt award + four stripes), even if the lower fighter is missing stripes.
 * Lower belt: only their own unlocks. They cannot reach a move that first unlocks higher.
 * The grip follow-ups come with the grips.
 */
export function fightMoves(args: { belt: Belt; unlocked: readonly MatMoveId[]; opponentBelt: Belt }): MatMoveId[] {
  const own = args.unlocked.filter((id) => isMatMove(id) && rankPool(args.belt).includes(id));
  if (beltIndex(args.belt) > beltIndex(args.opponentBelt)) return withCombos(rankPool(args.opponentBelt));
  return withCombos(own);
}

/** The bot is a student at `belt`: the whole pool of that belt, then the cross-rank cap. */
export function botMoves(belt: Belt, opponentBelt: Belt): MatMoveId[] {
  return fightMoves({ belt, unlocked: rankPool(belt), opponentBelt });
}

/** Plain table percent at this belt, plus a flat `bonus` (capped). Hold is certain. Locked moves are 0. */
export function movePercent(id: MatMoveId, belt: Belt, bonus = 0): number {
  if (id === 'hold') return 100;
  const row = PERCENT[id][beltIndex(belt)];
  if (row == null) return 0;
  return Math.max(PERCENT_FLOOR, Math.min(PERCENT_CAP, row + bonus));
}

const emptyGrips = (): GripFlags => ({ collar: false, sleeve: false });
const zeroAge = () => ({ collar: 0, sleeve: 0 });

export function newMat(): MatState {
  return {
    position: { kind: 'standing' },
    points: { you: 0, them: 0 },
    adv: { you: 0, them: 0 },
    turnsUsed: 0,
    actor: 'you',
    grips: { you: emptyGrips(), them: emptyGrips() },
    gripAge: { you: zeroAge(), them: zeroAge() },
    brace: { you: null, them: null },
    tired: { you: false, them: false },
    flow: 0,
    scored: [],
    over: false,
    winner: null,
    reason: null,
  };
}

export const other = (s: MatSide): MatSide => (s === 'you' ? 'them' : 'you');

/** The position as the actor sees it: "top" means the actor is on top. */
export function seenBy(pos: MatPosition, actor: MatSide): MatPosition {
  if (pos.kind === 'standing' || actor === 'you') return pos;
  return { kind: pos.kind, top: pos.top === 'you' ? 'them' : 'you' };
}

type View = 'standing' | 'closed_top' | 'closed_bottom' | 'side_bottom' | 'knee_bottom' | 'mount_bottom' | 'mount_top' | 'back_bottom' | 'back_top' | 'side_top' | 'knee_top';

function viewKind(pos: MatPosition, actor: MatSide): View {
  const s = seenBy(pos, actor);
  if (s.kind === 'standing') return 'standing';
  const top = s.top === 'you';
  if (s.kind === 'closed_guard') return top ? 'closed_top' : 'closed_bottom';
  if (s.kind === 'side_control') return top ? 'side_top' : 'side_bottom';
  if (s.kind === 'knee_on_belly') return top ? 'knee_top' : 'knee_bottom';
  if (s.kind === 'mount') return top ? 'mount_top' : 'mount_bottom';
  return top ? 'back_top' : 'back_bottom';
}

/** Position-only legality. Grip-gated follow-ups also need {@link gripReady}. */
export function moveLegal(pos: MatPosition, actor: MatSide, id: MatMoveId): boolean {
  if (id === 'hold') return true;
  const v = viewKind(pos, actor);
  switch (id) {
    case 'collar_tie':
    case 'sleeve_grip':
    case 'double_leg':
    case 'body_lock':
    case 'single_leg':
    case 'collar_drag':
    case 'sleeve_pull':
    case 'hip_throw':
    case 'posture':
      return v === 'standing';
    case 'sprawl':
      return v === 'standing' || v === 'closed_top';
    case 'knee_on_belly':
      return v === 'side_top';
    case 'back_take':
      return v === 'side_top' || v === 'knee_top' || v === 'mount_top';
    case 'passar':
      return v === 'closed_top' || v === 'side_top' || v === 'knee_top';
    case 'hook_sweep':
    case 'scissor_sweep':
    case 'hip_bump':
      return v === 'closed_bottom';
    case 'frame':
      return v === 'side_bottom' || v === 'knee_bottom' || v === 'mount_bottom' || v === 'closed_bottom';
    case 'escape_back':
      return v === 'back_bottom';
    case 'armbar':
      return v === 'mount_top' || v === 'back_top';
    case 'americana':
      return v === 'closed_top' || v === 'mount_top';
    case 'rnc':
      return v === 'back_top';
    default:
      return false;
  }
}

/** The grips a follow-up needs are in hand. */
export function gripReady(state: MatState, actor: MatSide, id: MatMoveId): boolean {
  const g = state.grips[actor];
  if (id === 'collar_drag') return g.collar;
  if (id === 'sleeve_pull') return g.sleeve;
  if (id === 'hip_throw') return g.collar && g.sleeve;
  return true;
}

/** A grip this fighter already holds is not offered again (re-taking it would only burn the turn). */
export function gripHeld(state: MatState, actor: MatSide, id: MatMoveId): boolean {
  return (id === 'collar_tie' && state.grips[actor].collar) || (id === 'sleeve_grip' && state.grips[actor].sleeve);
}

export function matLegalMoves(state: MatState, actor: MatSide, allowed: readonly MatMoveId[]): MatMoveId[] {
  const set = new Set<MatMoveId>(withCombos(allowed));
  set.add('hold');
  return (Object.keys(MOVE_LABEL) as MatMoveId[]).filter((id) => set.has(id) && moveLegal(state.position, actor, id) && gripReady(state, actor, id) && !gripHeld(state, actor, id));
}

const ART: Record<MatKind, BjjPositionId> = {
  standing: 'de_pe',
  closed_guard: 'guarda_fechada',
  side_control: 'cem_quilos',
  knee_on_belly: 'joelho',
  mount: 'montada',
  back_control: 'costas',
};

export function artOf(pos: MatPosition): { position: BjjPositionId; ahead: 'you' | 'partner' | null; rung: number } {
  if (pos.kind === 'standing') return { position: 'de_pe', ahead: null, rung: 0 };
  const mag = pos.kind === 'closed_guard' ? 1 : pos.kind === 'side_control' ? 2 : pos.kind === 'knee_on_belly' ? 3 : 4;
  const youTop = pos.top === 'you';
  return { position: ART[pos.kind], ahead: youTop ? 'you' : 'partner', rung: youTop ? mag : -mag };
}

function place(actor: MatSide, kind: Exclude<MatKind, 'standing'>, actorOnTop: boolean): MatPosition {
  const top: MatSide = actorOnTop ? actor : other(actor);
  return { kind, top };
}

function clone(st: MatState): MatState {
  // older snapshots (tests, a reconnect) may lack the v2 fields: fill them in
  const base = newMat();
  return {
    ...base,
    ...st,
    points: { ...st.points },
    adv: { ...(st.adv ?? base.adv) },
    grips: { you: { ...st.grips.you }, them: { ...st.grips.them } },
    gripAge: { you: { ...(st.gripAge?.you ?? zeroAge()) }, them: { ...(st.gripAge?.them ?? zeroAge()) } },
    brace: { ...(st.brace ?? base.brace) },
    tired: { ...(st.tired ?? base.tired) },
    flow: st.flow ?? 0,
    scored: [...st.scored],
    position: st.position.kind === 'standing' ? { kind: 'standing' } : { kind: st.position.kind, top: st.position.top },
  };
}

function finishScore(st: MatState): void {
  if (st.points.you !== st.points.them) {
    st.winner = st.points.you > st.points.them ? 'you' : 'them';
    st.reason = 'points';
  } else if (st.adv.you !== st.adv.them) {
    st.winner = st.adv.you > st.adv.them ? 'you' : 'them';
    st.reason = 'advantages';
  } else {
    st.winner = 'draw';
    st.reason = 'draw';
  }
  st.over = true;
}

const SUBS = new Set<MatMoveId>(['armbar', 'americana', 'rnc']);
const TAKEDOWNS = new Set<MatMoveId>(['double_leg', 'body_lock', 'single_leg', 'collar_drag', 'hip_throw']);
const SWEEPS = new Set<MatMoveId>(['hook_sweep', 'scissor_sweep', 'hip_bump']);
const PASSES = new Set<MatMoveId>(['passar', 'knee_on_belly', 'back_take']);

export const isSubmission = (id: MatMoveId): boolean => SUBS.has(id);
export const isTakedown = (id: MatMoveId): boolean => TAKEDOWNS.has(id);

export function attackOf(id: MatMoveId): MatAttack | null {
  if (id === 'collar_tie' || id === 'sleeve_grip') return 'pegada';
  if (TAKEDOWNS.has(id)) return 'queda';
  if (SWEEPS.has(id)) return 'raspagem';
  if (PASSES.has(id)) return 'passagem';
  if (SUBS.has(id)) return 'final';
  return null;
}

/** The brace a defense sets, if it lands, where it is played. */
function braceOf(state: MatState, actor: MatSide, id: MatMoveId): MatBrace | null {
  if (id === 'posture') return 'postura';
  if (id === 'sprawl') return 'base';
  if (id === 'frame' && viewKind(state.position, actor) === 'closed_bottom') return 'recuperar';
  return null;
}

// ---------------------------------------------------------------- odds

/** One line of the odds breakdown the card shows ("Gola +20%"). needs_br: true */
export interface OddsPart {
  pt: string;
  en: string;
  delta: number;
}

/** The percent this move would roll at right now, and what moved it off the belt table. */
export function matOdds(state: MatState, actor: MatSide, id: MatMoveId, belt: Belt, edge = 0): { percent: number; base: number; parts: OddsPart[] } {
  if (id === 'hold') return { percent: 100, base: 100, parts: [] };
  const base = movePercent(id, belt);
  if (base <= 0) return { percent: 0, base: 0, parts: [] };
  const raw = PERCENT[id][beltIndex(belt)] ?? 0;
  const foe = other(actor);
  const mine = state.grips[actor];
  const theirs = state.grips[foe];
  const atk = attackOf(id);
  const parts: OddsPart[] = [];
  if (id === 'double_leg' && mine.collar) parts.push({ pt: 'Gola', en: 'Collar', delta: COLLAR_QUEDA });
  if (id === 'single_leg' && mine.sleeve) parts.push({ pt: 'Manga', en: 'Sleeve', delta: SLEEVE_ANKLE });
  if (SWEEPS.has(id) && mine.sleeve) parts.push({ pt: 'Manga', en: 'Sleeve', delta: SLEEVE_SWEEP });
  if (id === 'body_lock' && theirs.collar && !theirs.sleeve) parts.push({ pt: 'Gola sozinha', en: 'Lone collar', delta: LONE_COLLAR_PUNISH });
  if (atk && atk !== 'pegada' && theirs.sleeve) parts.push({ pt: 'Manga dele', en: 'Their sleeve', delta: -SLEEVE_SHIELD });
  const brace = state.brace?.[foe];
  const cut = brace && atk ? (BRACE_CUT[brace][atk] ?? 0) : 0;
  if (cut) parts.push({ pt: 'Defesa dele', en: 'Their defense', delta: -cut });
  if (state.tired?.[actor]) parts.push({ pt: 'Cansaço', en: 'Tired', delta: -TIRED_MALUS });
  if (edge) parts.push({ pt: 'Precisão', en: 'Accuracy', delta: edge });
  const sum = parts.reduce((a, p) => a + p.delta, 0);
  const percent = Math.max(PERCENT_FLOOR, Math.min(PERCENT_CAP, raw + sum));
  return { percent, base, parts };
}

// ---------------------------------------------------------------- the meter

const gripCount = (g: GripFlags): number => (g.collar ? 1 : 0) + (g.sleeve ? 1 : 0);

/**
 * The control meter, -100 (the partner owns the match) .. 100 (you do), from the player's seat:
 * the position, the grips each side holds, advantages, a brace up, a tired fighter, and who won the last exchange.
 * Every move moves it, so every answer reads as ground gained or lost.
 */
export function matMeter(st: MatState): number {
  let v = artOf(st.position).rung * 17;
  v += (gripCount(st.grips.you) - gripCount(st.grips.them)) * 9;
  v += ((st.adv?.you ?? 0) - (st.adv?.them ?? 0)) * 5;
  v += (st.brace?.you ? 4 : 0) - (st.brace?.them ? 4 : 0);
  v += (st.tired?.them ? 4 : 0) - (st.tired?.you ? 4 : 0);
  v += (st.flow ?? 0) * 7;
  return Math.max(-100, Math.min(100, Math.round(v)));
}

// ---------------------------------------------------------------- resolve

const SOUND_NONE: MatSound = 'none';

function soundFor(id: MatMoveId, success: boolean, next: MatPosition): MatSound {
  if (SUBS.has(id)) return 'sub';
  if (!success || id === 'hold') return SOUND_NONE;
  if (TAKEDOWNS.has(id) || id === 'sleeve_pull') return 'whoosh';
  if (next.kind === 'mount') return 'mount';
  return 'hit';
}

/**
 * Resolve one fighter's move. `roll` is in [0, 1). Success when roll < percent/100.
 * `force` guarantees success (the professor's drill). A miss on a submission dumps both fighters
 * to closed guard with the attacker on the bottom. `edge` is the partner's accuracy (percent points).
 */
export function resolveMat(state: MatState, actor: MatSide, id: MatMoveId, roll: number, belt: Belt, force = false, edge = 0): MatResult {
  const from = artOf(state.position);
  const meterFrom = matMeter(state);
  const fail = (line: Bilingual): MatResult => ({
    state,
    ok: false,
    success: false,
    points: 0,
    submission: false,
    sound: 'none',
    line,
    from: from.position,
    to: from.position,
    fromAhead: from.ahead,
    toAhead: from.ahead,
    fromRung: from.rung,
    toRung: from.rung,
    percent: 0,
    events: [],
    meterFrom,
    meterTo: meterFrom,
  });
  if (state.over || state.actor !== actor || !isMatMove(id)) return fail({ pt: 'Não.', en: 'No.' });
  if (!moveLegal(state.position, actor, id) || gripHeld(state, actor, id) || (!force && !gripReady(state, actor, id))) return fail({ pt: 'Não.', en: 'No.' });
  const st = clone(state);
  const foe = other(actor);
  const percent = matOdds(st, actor, id, belt, edge).percent;
  if (!force && percent <= 0) return fail({ pt: 'Não.', en: 'No.' });
  const events: MatEvent[] = [];
  const atk = attackOf(id);
  const foeBrace = st.brace[foe];
  const braced = !!(foeBrace && atk && BRACE_CUT[foeBrace][atk]);
  const keepSleeve = id === 'sleeve_pull';
  // a throw spends the grips it was set up with, whether it lands or not
  if (TAKEDOWNS.has(id)) {
    st.grips[actor] = emptyGrips();
    st.gripAge[actor] = zeroAge();
  }
  st.tired[actor] = false;
  const success = force || id === 'hold' || roll < percent / 100;
  let points = 0;
  let submission = false;
  const before = st.position;
  if (!success && SUBS.has(id)) {
    st.position = place(actor, 'closed_guard', false);
    st.scored = [];
  } else if (!success && braced) {
    st.adv[foe] += 1;
    events.push({ kind: 'blocked', side: foe });
  } else if (success) {
    const next = applySuccess(st, actor, id, events);
    st.position = next.position;
    if (next.resetScored) st.scored = [];
    const raw = POINTS[id] ?? 0;
    if (raw > 0 && next.scoreKey && !st.scored.includes(next.scoreKey)) {
      points = raw;
      st.scored.push(next.scoreKey);
      st.points[actor] += points;
    }
    submission = !!next.submission;
  }
  const moved = st.position.kind !== before.kind || (st.position.kind !== 'standing' && before.kind !== 'standing' && st.position.top !== before.top);
  if (moved) {
    // a new position: the grips go (Puxar keeps the sleeve it pulled with), and every brace is spent
    const kept = keepSleeve && st.grips[actor].sleeve;
    const age = st.gripAge[actor].sleeve;
    st.grips = { you: emptyGrips(), them: emptyGrips() };
    st.gripAge = { you: zeroAge(), them: zeroAge() };
    if (kept) {
      st.grips[actor].sleeve = true;
      st.gripAge[actor].sleeve = age;
    }
    st.brace = { you: null, them: null };
  } else {
    // the other fighter's brace waited for this move; it is spent now
    st.brace[foe] = null;
  }
  // the grips this fighter kept through the move get older; the third turn of holding lets go and tires them
  const slipped: GripId[] = [];
  for (const g of ['collar', 'sleeve'] as const) {
    if (!st.grips[actor][g]) continue;
    st.gripAge[actor][g] += 1;
    if (st.gripAge[actor][g] >= GRIP_SLIP) {
      st.grips[actor][g] = false;
      st.gripAge[actor][g] = 0;
      slipped.push(g);
    }
  }
  if (slipped.length) {
    st.tired[actor] = true;
    events.push({ kind: 'slip', side: actor, grips: slipped });
  }
  if (id !== 'hold') {
    const won = success ? actor : foe;
    st.flow = won === 'you' ? 1 : -1;
  } else st.flow = 0;
  st.turnsUsed += 1;
  const to = artOf(st.position);
  if (submission) {
    st.over = true;
    st.winner = actor === 'you' ? 'you' : 'them';
    st.reason = 'submission';
  } else if (st.turnsUsed >= MAT_TURNS) {
    finishScore(st);
  } else {
    st.actor = foe;
  }
  const blocked = events.some((e) => e.kind === 'blocked');
  const line = submission
    ? { pt: 'Final!', en: 'Finish!' }
    : points >= 4
      ? { pt: 'Quatro pontos!', en: 'Four points!' }
      : points === 3
        ? { pt: 'Três pontos!', en: 'Three points!' }
        : points === 2
          ? { pt: 'Dois pontos!', en: 'Two points!' }
          : blocked
            ? { pt: 'Vantagem!', en: 'Advantage!' }
            : success
              ? MOVE_LABEL[id]
              : { pt: 'Errou!', en: 'Missed!' };
  return {
    state: st,
    ok: true,
    success,
    points,
    submission,
    sound: blocked ? 'hit' : soundFor(id, success, st.position),
    line,
    from: from.position,
    to: to.position,
    fromAhead: from.ahead,
    toAhead: to.ahead,
    fromRung: from.rung,
    toRung: to.rung,
    percent,
    events,
    meterFrom,
    meterTo: matMeter(st),
  };
}

function applySuccess(st: MatState, actor: MatSide, id: MatMoveId, events: MatEvent[]): { position: MatPosition; resetScored: boolean; scoreKey: string | null; submission: boolean } {
  const stay = { position: st.position, resetScored: false, scoreKey: null, submission: false };
  const foe = other(actor);
  if (id === 'collar_tie' || id === 'sleeve_grip') {
    const g: GripId = id === 'collar_tie' ? 'collar' : 'sleeve';
    st.grips[actor][g] = true;
    st.gripAge[actor][g] = 0;
    events.push({ kind: 'grip', side: actor, grip: g });
    return stay;
  }
  const brace = braceOf(st, actor, id);
  if (id === 'posture') {
    const had = (['collar', 'sleeve'] as const).filter((g) => st.grips[foe][g]);
    st.grips[foe] = emptyGrips();
    st.gripAge[foe] = zeroAge();
    if (had.length) events.push({ kind: 'strip', side: actor, grips: had });
  }
  if (brace) {
    st.brace[actor] = brace;
    events.push({ kind: 'brace', side: actor, brace });
    return stay;
  }
  if (id === 'hold') return stay;
  if (id === 'passar') {
    const v = viewKind(st.position, actor);
    if (v === 'closed_top') return landed(actor, 'side_control', true);
    return landed(actor, 'mount', true);
  }
  if (id === 'double_leg') return landed(actor, 'side_control', true);
  if (id === 'hip_throw') return landed(actor, 'side_control', true);
  if (id === 'collar_drag') return landed(actor, 'back_control', true);
  if (id === 'body_lock') return landed(actor, 'closed_guard', true);
  if (id === 'single_leg') return landed(actor, 'knee_on_belly', true);
  if (id === 'sleeve_pull') return { position: place(actor, 'closed_guard', false), resetScored: false, scoreKey: null, submission: false };
  if (id === 'knee_on_belly') return landed(actor, 'knee_on_belly', true);
  if (id === 'back_take') return landed(actor, 'back_control', true);
  if (id === 'hook_sweep') return landed(actor, 'side_control', true);
  if (id === 'scissor_sweep') return landed(actor, 'mount', true);
  if (id === 'hip_bump') return landed(actor, 'side_control', true);
  if (id === 'frame' || id === 'escape_back') return { position: place(actor, 'closed_guard', false), resetScored: true, scoreKey: null, submission: false };
  if (SUBS.has(id)) return { ...stay, submission: true };
  return stay;
}

function landed(actor: MatSide, kind: Exclude<MatKind, 'standing'>, onTop: boolean): { position: MatPosition; resetScored: boolean; scoreKey: string | null; submission: boolean } {
  return { position: place(actor, kind, onTop), resetScored: false, scoreKey: `${actor}:${kind}`, submission: false };
}

export function turnsLeft(st: MatState): number {
  return Math.max(0, MAT_TURNS - st.turnsUsed);
}

// ---------------------------------------------------------------- partner style and AI

/** How a partner fights: an accuracy edge on their odds (percent points), and the leanings the AI weighs. */
export interface MatStyle {
  edge: number;
  speed: number;
  aggression: number;
  defense: number;
}

/** A partner card's numbers as a fighting style. Accuracy 0.6 (Mateus) is the plain belt odds. */
export function matStyle(p: { accuracy: number; speed: number; aggression: number; defense: number }): MatStyle {
  return { edge: Math.round((p.accuracy - 0.6) * 40), speed: p.speed, aggression: p.aggression, defense: p.defense };
}

/** How long a partner thinks before their move (quick Felipe, careful Helena), inside the 2-5 s the slower opponent turn asked for. */
export function thinkMsFor(style?: Pick<MatStyle, 'speed'> | null): number {
  if (!style) return MAT_THINK_MS;
  return Math.round(Math.min(4600, Math.max(2200, 4200 - style.speed * 2200)));
}

const NEUTRAL: MatStyle = { edge: 0, speed: 0.5, aggression: 0.5, defense: 0.5 };
const POS_VALUE: Record<MatKind, number> = { standing: 0, closed_guard: 0.5, side_control: 1.1, knee_on_belly: 1.3, mount: 1.9, back_control: 2.2 };

/** How good this state is for `side`, in points. The partner's style weighs what it values. */
function valueFor(st: MatState, side: MatSide, style: MatStyle): number {
  const foe = other(side);
  if (st.over) {
    if (st.winner === 'draw') return 0;
    return st.winner === side ? 12 : -12;
  }
  const late = Math.min(1, turnsLeft(st) / 4);
  let v = (st.points[side] - st.points[foe]) * (1 + 0.3 * style.aggression);
  v += (st.adv[side] - st.adv[foe]) * 0.4;
  if (st.position.kind !== 'standing') {
    const pv = POS_VALUE[st.position.kind];
    v += (st.position.top === side ? pv : -pv * (0.8 + 0.6 * style.defense)) * late;
  }
  const mine = st.grips[side];
  const theirs = st.grips[foe];
  const gripW = 1.25 - 0.6 * style.speed;
  v += (gripCount(mine) * 0.45 + (mine.collar && mine.sleeve ? 0.35 : 0)) * gripW * late;
  v -= (gripCount(theirs) * 0.45 + (theirs.collar && theirs.sleeve ? 0.35 : 0)) * (0.8 + 0.6 * style.defense) * late;
  if (st.tired[side]) v -= 0.3 * late;
  if (st.tired[foe]) v += 0.3 * late;
  return v;
}

/** The expected value of `id` for its actor (the state's actor), looking one reply ahead when `depth` allows. */
function expectFor(st: MatState, id: MatMoveId, belt: Belt, edgeOf: (s: MatSide) => number, side: MatSide, style: MatStyle, foeAllowed: readonly MatMoveId[], ownAllowed: readonly MatMoveId[], depth: number): number {
  const actor = st.actor;
  const hit = resolveMat(st, actor, id, 0, belt, false, edgeOf(actor));
  if (!hit.ok) return -Infinity;
  const p = hit.percent / 100;
  const miss = id === 'hold' || p >= 1 ? null : resolveMat(st, actor, id, 0.99999, belt, false, edgeOf(actor));
  const leaf = (s: MatState) => {
    if (depth <= 0 || s.over) return valueFor(s, side, style);
    // the other fighter answers with what is best for them (worst for `side`)
    const nextAllowed = s.actor === side ? ownAllowed : foeAllowed;
    const replies = matLegalMoves(s, s.actor, nextAllowed);
    let best = s.actor === side ? -Infinity : Infinity;
    for (const r of replies) {
      const v = expectFor(s, r, belt, edgeOf, side, style, foeAllowed, ownAllowed, depth - 1);
      if (s.actor === side ? v > best : v < best) best = v;
    }
    return Number.isFinite(best) ? best : valueFor(s, side, style);
  };
  return p * leaf(hit.state) + (miss ? (1 - p) * leaf(miss.state) : 0);
}

/** What the partner is about to do, as the overlay says it ("Mateus vai tentar a queda."). */
export type MatPlanKind = 'gola' | 'manga' | 'queda' | 'contra' | 'soltar' | 'base' | 'puxar' | 'raspar' | 'passar' | 'subir' | 'finalizar' | 'sair' | 'travar' | 'segurar';

export interface MatPlan {
  move: MatMoveId;
  kind: MatPlanKind;
}

export function planKindOf(state: MatState, actor: MatSide, id: MatMoveId): MatPlanKind {
  const foe = other(actor);
  if (id === 'collar_tie') return 'gola';
  if (id === 'sleeve_grip') return 'manga';
  if (id === 'body_lock' && state.grips[foe].collar && !state.grips[foe].sleeve) return 'contra';
  if (TAKEDOWNS.has(id)) return 'queda';
  if (id === 'posture') return state.grips[foe].collar || state.grips[foe].sleeve ? 'soltar' : 'base';
  if (id === 'sprawl') return 'base';
  if (id === 'sleeve_pull') return 'puxar';
  if (SWEEPS.has(id)) return 'raspar';
  if (id === 'passar') return 'passar';
  if (PASSES.has(id)) return 'subir';
  if (SUBS.has(id)) return 'finalizar';
  if (id === 'frame' && viewKind(state.position, actor) === 'closed_bottom') return 'travar';
  if (id === 'frame' || id === 'escape_back') return 'sair';
  return 'segurar';
}

/**
 * The partner's next move: the legal move with the best expected value two moves deep (its move, then your best reply),
 * weighed by the partner card (fast fighters value grips less and shoot sooner, defensive ones fear being under, aggressive ones
 * want the points). The plan is computed during your turn and shown to you; the partner then commits to it if it is still legal.
 * `foeAllowed` is what the player can play (their reply).
 */
export function planBot(state: MatState, belt: Belt, allowed: readonly MatMoveId[], style?: MatStyle, foeAllowed?: readonly MatMoveId[]): MatPlan {
  const st: MatState = state.actor === 'them' ? state : { ...state, actor: 'them' };
  const s = style ?? NEUTRAL;
  const legal = matLegalMoves(st, 'them', allowed);
  if (!legal.length) return { move: 'hold', kind: 'segurar' };
  const edgeOf = (side: MatSide) => (side === 'them' ? s.edge : 0);
  let best: MatMoveId = 'hold';
  let bestV = -Infinity;
  for (const id of legal) {
    const v = expectFor(st, id, belt, edgeOf, 'them', s, foeAllowed ?? allowed, allowed, 1);
    if (v > bestV + 1e-9) {
      bestV = v;
      best = id;
    }
  }
  return { move: best, kind: planKindOf(st, 'them', best) };
}

/** The partner's move this turn (the plan, re-read from the state as it is now). */
export function chooseBot(state: MatState, belt: Belt, allowed: readonly MatMoveId[], style?: MatStyle, foeAllowed?: readonly MatMoveId[]): MatMoveId {
  return planBot(state, belt, allowed, style, foeAllowed).move;
}

/** The plan still stands after your move: same fighter to move, and the move is still legal. Otherwise the partner re-plans. */
export function planStands(state: MatState, plan: MatPlan | null, allowed: readonly MatMoveId[]): boolean {
  return !!plan && !state.over && state.actor === 'them' && matLegalMoves(state, 'them', allowed).includes(plan.move);
}

/** Your moves that answer the partner's plan: a brace, a strip, the shield, or using your grips before they are stripped. */
export function planAnswers(state: MatState, plan: MatPlan, legal: readonly MatMoveId[]): MatMoveId[] {
  const pick = (ids: MatMoveId[]) => ids.filter((id) => legal.includes(id));
  switch (plan.kind) {
    case 'queda':
      return pick(['sprawl', 'posture', 'sleeve_grip']);
    case 'contra':
      return pick(['sleeve_grip', 'sprawl', 'posture']);
    case 'gola':
    case 'manga':
    case 'puxar':
      return pick(['posture']);
    case 'soltar':
      return pick(['hip_throw', 'collar_drag', 'sleeve_pull', 'double_leg', 'single_leg']);
    case 'base':
      return pick(['collar_tie', 'sleeve_grip']);
    case 'raspar':
      return pick(['sprawl', 'passar']);
    case 'passar':
    case 'subir':
    case 'finalizar':
      return pick(['frame', 'escape_back', 'hook_sweep', 'scissor_sweep', 'hip_bump']);
    case 'sair':
      return pick(['armbar', 'americana', 'rnc', 'passar', 'knee_on_belly', 'back_take']);
    default:
      return [];
  }
}

/** needs_br: true — the telegraph line, with the partner's name. No position or technique names (#49). */
export function planLine(kind: MatPlanKind, name: string): Bilingual {
  const L: Record<MatPlanKind, [string, string]> = {
    gola: ['vai pegar a sua gola.', 'is reaching for your collar.'],
    manga: ['vai pegar a sua manga.', 'is reaching for your sleeve.'],
    queda: ['vai tentar a queda.', 'is about to shoot a takedown.'],
    contra: ['vai castigar a sua gola sozinha.', 'will punish your lone collar grip.'],
    soltar: ['vai soltar as suas pegadas.', 'is going to strip your grips.'],
    base: ['vai firmar a base.', 'is setting their base.'],
    puxar: ['vai te puxar pro chão.', 'is going to pull you down.'],
    raspar: ['vai tentar te virar.', 'is going to try to sweep you.'],
    passar: ['vai tentar passar.', 'is going to try to pass.'],
    subir: ['vai subir mais.', 'is going to climb higher.'],
    finalizar: ['vai tentar finalizar!', 'is going for the finish!'],
    sair: ['vai tentar sair de baixo.', 'is going to escape from underneath.'],
    travar: ['vai travar você.', 'is going to block your pass.'],
    segurar: ['vai segurar.', 'is going to hold.'],
  };
  const [pt, en] = L[kind];
  return { pt: `${name} ${pt}`, en: `${name} ${en}` };
}

/** needs_br: true — what a setup move opens, in a few words, for its card. Null for moves whose card shows points or who ends on top. */
export function moveSetsUp(state: MatState, actor: MatSide, id: MatMoveId): Bilingual | null {
  const g = state.grips[actor];
  const theirs = state.grips[other(actor)];
  switch (id) {
    case 'collar_tie':
      return g.sleeve ? { pt: 'Abre o Arremesso', en: 'Opens the Throw' } : { pt: `Queda +${COLLAR_QUEDA}% · abre Arrastar`, en: `Takedown +${COLLAR_QUEDA}% · opens Drag` };
    case 'sleeve_grip':
      return g.collar ? { pt: 'Abre o Arremesso · protege você', en: 'Opens the Throw · shields you' } : { pt: `Protege você · abre Puxar`, en: `Shields you (−${SLEEVE_SHIELD}% on them) · opens Pull` };
    case 'collar_drag':
      return { pt: '+2 · você atrás dele', en: '+2 · you end up behind them' };
    case 'hip_throw':
      return { pt: '+2 · a queda mais forte', en: '+2 · the strongest throw' };
    case 'sleeve_pull':
      return { pt: `Puxa pro chão · Raspagem +${SLEEVE_SWEEP}%`, en: `Pulls them down · sweeps +${SLEEVE_SWEEP}%` };
    case 'posture':
      return theirs.collar || theirs.sleeve ? { pt: 'Solta as pegadas dele', en: 'Strips their grips' } : { pt: 'Trava as pegadas dele', en: 'Blocks their grips' };
    case 'sprawl':
      return viewKind(state.position, actor) === 'closed_top' ? { pt: 'Trava a raspagem dele', en: 'Stops their sweep' } : { pt: 'Trava a queda dele', en: 'Stops their takedown' };
    case 'frame':
      return viewKind(state.position, actor) === 'closed_bottom' ? { pt: 'Trava a passagem dele', en: 'Blocks their pass' } : null;
    default:
      return null;
  }
}

/** What a move does if it lands, for the picker: points, where the pair ends up, a finish, or a grip. */
export interface MatEffect {
  points: number;
  to: BjjPositionId;
  toAhead: 'you' | 'partner' | null;
  submission: boolean;
  /** a miss on a finish drops the attacker to the bottom of closed guard */
  riskBottom: boolean;
}

export function matEffect(state: MatState, actor: MatSide, id: MatMoveId): MatEffect | null {
  if (state.actor !== actor) state = { ...state, actor };
  const r = resolveMat(state, actor, id, 0, 'preta', true);
  if (!r.ok) return null;
  return { points: r.points, to: r.to, toAhead: r.toAhead, submission: r.submission, riskBottom: SUBS.has(id) };
}

/** Where the professor places a compliant partner so the new move is legal. */
export function drillPosition(id: MatMoveId): MatPosition {
  switch (id) {
    case 'hook_sweep':
    case 'scissor_sweep':
    case 'hip_bump':
      return { kind: 'closed_guard', top: 'them' };
    case 'frame':
      return { kind: 'side_control', top: 'them' };
    case 'escape_back':
      return { kind: 'back_control', top: 'them' };
    case 'passar':
    case 'knee_on_belly':
      return { kind: 'side_control', top: 'you' };
    case 'back_take':
      return { kind: 'mount', top: 'you' };
    case 'armbar':
      return { kind: 'mount', top: 'you' };
    case 'americana':
      return { kind: 'closed_guard', top: 'you' };
    case 'rnc':
      return { kind: 'back_control', top: 'you' };
    default:
      return { kind: 'standing' };
  }
}

// ---------------------------------------------------------------- diary words (one ordered list; replace the array when curriculum sends a longer one)

/** Existing diary ids, in curriculum order. Do not add, drop, or reorder here. */
export const MAT_WORD_IDS: readonly string[] = [
  'diary.rua.academia',
  'diary.academia.treino',
  'diary.academia.respeito',
  'diary.academia.agua',
  'diary.academia.faixa',
  'diary.academia.kimono',
  'diary.academia.tatame',
  'diary.academia.treinar',
  'diary.academia.parceiro',
  'diary.academia.vestiario',
  'diary.academia.bebedouro',
  'diary.kitnet.toalha',
  'diary.academia.sapato',
  'diary.academia.meia',
  'diary.rua.tenis',
  'diary.kitnet.chinelo',
  'diary.chegada.mochila',
  'diary.kitnet.chuveiro',
  'diary.academia.squeeze',
  'diary.academia.isotonico',
  'diary.academia.corda',
  'diary.academia.cronometro',
  'diary.academia.apito',
  'diary.academia.placar',
  'diary.academia.medalha',
  'diary.academia.trofeu',
  'diary.academia.podio',
  'diary.academia.arquibancada',
  'diary.academia.bandeira',
  'diary.academia.presenca',
  'diary.academia.sabado',
  'diary.praca.horario',
  'diary.academia.professora',
  'diary.academia.disciplina',
  'diary.academia.sorriso',
  'diary.praca.ajuda',
  'diary.academia.recepcao',
  'diary.academia.armario',
  'diary.praca.entrada',
  'diary.praca.banheiro',
  'diary.kitnet.espelho',
  'diary.praca.cuidado',
  'diary.praca.emergencia',
  'diary.academia.extintor',
  'diary.academia.prancheta',
  'diary.praca.bone',
];

/** The next diary word this win can teach, or null when the list is exhausted or already known. */
export function nextMatWord(earned: readonly string[] | undefined): DiaryWord | null {
  const have = new Set(normalizeDiary(earned));
  const keys = new Set([...have].map((id) => diaryKey(diaryWord(id)?.pt ?? '')));
  for (const id of MAT_WORD_IDS) {
    const w = diaryWord(id);
    if (!w || have.has(w.id) || keys.has(diaryKey(w.pt))) continue;
    return w;
  }
  return null;
}
