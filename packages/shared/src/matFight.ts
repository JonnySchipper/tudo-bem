/**
 * Academia mat fight, Tatame v3 "Comando" (docs/lifesim/TATAME-V3.md). One function resolves a turn for either fighter.
 * There are no dice and no percentages: a move lands because its fighter did it.
 *
 *  - Every move is a fixed chain of 1–4 A1 commands (Pega! Puxa! Empurra! Gira! Levanta! Aperta!). Professora Bia calls each one and
 *    the player taps it on the command pad inside a window (`cmdWindowMs`). The move lands only when every command is hit.
 *  - The partner's attack is a defense beat: a four-button pad (Postura! Base! Trava! Sai!) and one window (`defWindowMs`). A partner
 *    that is not clean (`partnerClean`) botches on its own, with no defense beat.
 *  - Grips are still strategy: the collar makes every throw one command shorter; the sleeve is the shield (your defense windows ×1.35);
 *    both open Arremesso. A grip slips after three of your own turns, and Postura strips one.
 *  - A brace (Postura, Base, Recuperar) still waits for one move: it blocks the matching attack with no tap (a Vantagem for the one
 *    who braced), for either fighter. Nobody braces twice in a row.
 *  - Ritmo: three all-Perfeito chains in a row are a Vantagem. A defensive partner (`defense ≥ 0.75`) costs one more command to finish.
 * The partner telegraphs its next move (`planBot`); from blue belt an aggressive partner sometimes feints (`feintMove`).
 * The AI reads no table: it weighs what lands by the player's own play this match (`MatRates`).
 *
 * needs_br: true on every new Portuguese label below (the commands, the defenses, the card lines). No position or submission names.
 */
import type { Bilingual } from './types.js';
import type { Belt } from './academia.js';
import type { BjjPositionId } from './academia.js';
import { diaryKey, diaryWord, normalizeDiary, type DiaryWord } from './diary.js';

/** Exchanges in a match, counting both fighters (eight attacks each). */
export const MAT_TURNS = 16;
/** The scoreboard's 2:00 of game time: each exchange costs 7.5 s of it. */
export const EXCHANGE_CLOCK_MS = 7_500;
export const MATCH_CLOCK_MS = MAT_TURNS * EXCHANGE_CLOCK_MS;
/** A grip slips at the end of the holder's third turn holding it. */
export const GRIP_SLIP = 3;

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
  | 'virar'
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
/** What an attack is: a grip, a takedown, a sweep, a pass (or a climb), a finish. */
export type MatAttack = 'pegada' | 'queda' | 'raspagem' | 'passagem' | 'final';

type Pair<T> = { you: T; them: T };

export interface MatState {
  position: MatPosition;
  points: Pair<number>;
  /** Vantagens: a block, a defended attack, a Ritmo. They break a points tie. */
  adv: Pair<number>;
  /** Turns already played, counting both fighters. The match ends at {@link MAT_TURNS}. */
  turnsUsed: number;
  actor: MatSide;
  grips: Pair<GripFlags>;
  /** Own turns each held grip has been kept. It slips at {@link GRIP_SLIP}. */
  gripAge: Pair<{ collar: number; sleeve: number }>;
  brace: Pair<MatBrace | null>;
  /** This fighter's last move set a brace: it cannot brace again on its very next move (no hiding behind a shield). */
  braced: Pair<boolean>;
  /** The player's all-Perfeito chains in a row (Ritmo). Three are a Vantagem, then it counts again. */
  ritmo: number;
  /** -1..1 from the player's seat: who won the last exchange (a landed move, or the other side's miss). Feeds the meter. */
  flow: number;
  /** Position keys already paid this exchange (`you:mount`). Cleared on a reset to standing or a missed submission. */
  scored: string[];
  over: boolean;
  winner: 'you' | 'them' | 'draw' | null;
  reason: 'submission' | 'points' | 'advantages' | 'draw' | null;
}

export type MatSound = 'hit' | 'whoosh' | 'mount' | 'sub' | 'none';

/** What changed besides the position, so the mat can draw the grip snap, the strip, the slip, a block and a Ritmo. */
export type MatEvent =
  | { kind: 'grip'; side: MatSide; grip: GripId }
  | { kind: 'strip'; side: MatSide; grips: GripId[] }
  | { kind: 'slip'; side: MatSide; grips: GripId[] }
  | { kind: 'brace'; side: MatSide; brace: MatBrace }
  /** a brace stopped the attack (no tap): a Vantagem for `side`, the defender */
  | { kind: 'blocked'; side: MatSide }
  /** `side` tapped the right defense in time; `adv` when the attack was worth points (or the match) */
  | { kind: 'defended'; side: MatSide; adv: boolean }
  /** `side` strung three all-Perfeito chains: a Vantagem */
  | { kind: 'ritmo'; side: MatSide };

export interface MatResult {
  state: MatState;
  ok: boolean;
  /** every command was hit (or the drill forced it) */
  landed: boolean;
  points: number;
  submission: boolean;
  sound: MatSound;
  /** Bia's call for this move (points, Vantagem, Defendeu!, Escapou!, Final!) */
  line: Bilingual;
  from: BjjPositionId;
  to: BjjPositionId;
  fromAhead: 'you' | 'partner' | null;
  toAhead: 'you' | 'partner' | null;
  fromRung: number;
  toRung: number;
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
  sprawl: { pt: 'Base', en: 'Sprawl' },
  frame: { pt: 'Recuperar', en: 'Frame and recover' },
  escape_back: { pt: 'Sair', en: 'Escape back' },
  armbar: { pt: 'Braço', en: 'Armbar' },
  americana: { pt: 'Americana', en: 'Arm lock' },
  rnc: { pt: 'Pescoço', en: 'Rear naked choke' },
  // needs_br: true — Virar: everyone's way out from under (no stripe), a plain verb
  virar: { pt: 'Virar', en: 'Turn over' },
  hold: { pt: 'Segurar', en: 'Hold' },
};

// ---------------------------------------------------------------- the commands and the defenses (the pads)

/** The six commands, in the pad's fixed order (keys 1–6). */
export type MatCommand = 'pega' | 'puxa' | 'empurra' | 'gira' | 'levanta' | 'aperta';
export const COMMANDS: readonly MatCommand[] = ['pega', 'puxa', 'empurra', 'gira', 'levanta', 'aperta'];

// needs_br: true — A1 imperatives (Total Physical Response); Bia calls them, the buttons are them
export const COMMAND_LABEL: Record<MatCommand, Bilingual> = {
  pega: { pt: 'Pega!', en: 'Grab!' },
  puxa: { pt: 'Puxa!', en: 'Pull!' },
  empurra: { pt: 'Empurra!', en: 'Push!' },
  gira: { pt: 'Gira!', en: 'Turn!' },
  levanta: { pt: 'Levanta!', en: 'Lift!' },
  aperta: { pt: 'Aperta!', en: 'Squeeze!' },
};

/** The four defenses, in the defense pad's fixed order (keys 1–4). */
export type MatDefense = 'postura' | 'base' | 'trava' | 'sai';
export const DEFENSES: readonly MatDefense[] = ['postura', 'base', 'trava', 'sai'];

// needs_br: true — the defense pad: the word, its gloss, and what it stops (the EN line under the button)
export const DEFENSE_LABEL: Record<MatDefense, Bilingual & { stops: Bilingual }> = {
  postura: { pt: 'Postura!', en: 'Posture!', stops: { pt: 'contra a pegada', en: 'stops a grip' } },
  base: { pt: 'Base!', en: 'Base!', stops: { pt: 'contra a queda', en: 'stops a takedown or a sweep' } },
  trava: { pt: 'Trava!', en: 'Block!', stops: { pt: 'contra a passagem', en: 'stops a pass or an escape' } },
  sai: { pt: 'Sai!', en: 'Get out!', stops: { pt: 'contra o final', en: 'stops a finish' } },
};

export const isCommand = (c: unknown): c is MatCommand => typeof c === 'string' && (COMMANDS as readonly string[]).includes(c);
export const isDefense = (c: unknown): c is MatDefense => typeof c === 'string' && (DEFENSES as readonly string[]).includes(c);

// ---------------------------------------------------------------- windows and grades

/** A white belt's command window. It shrinks 5% per level (stripe) down to half. */
export const CMD_WINDOW_MS = 2_200;
/** A first-ever match (wins 0) gets this much more time on every window. */
export const FIRST_MATCH_SLACK = 1.4;
/** A tap within this share of its window is Perfeito; within the window, Boa. */
export const PERFECT_SHARE = 0.45;
/** The last Aperta! of a finish is squeezed onto a tighter window. */
export const FINAL_SQUEEZE = 0.8;
/**
 * The partner's attack: its window is the chain window × (DEF_BASE − DEF_SPEED × speed); the sleeve grip widens it.
 * Tuned (matSim.test.ts): the brief's 1.1 made every partner a pushover (an average player beat Mateus 73%), so the base is 0.8.
 */
export const DEF_BASE = 0.8;
export const DEF_SPEED = 0.4;
export const SLEEVE_SHIELD = 1.35;
/** An escape from under (Virar, Recuperar, Sair) is slower than a throw: the defense window against it is this much longer. */
export const ESCAPE_DEF = 1.3;
/** Each Sai! of the escape mash against a finish is this share of a defense window. */
export const SAI_SHARE = 0.75;
/** Network slack the server gives every deadline on top of the window (it never relaxes the grade). */
export const NET_GRACE_MS = 450;
/** The partner's wind-up (clip frames 0–3) before the defense pad appears. */
export const WINDUP_MS = 700;
/** Three all-Perfeito chains in a row are a Vantagem. */
export const RITMO_RUN = 3;

/** One command's window at this bjj level (`bjjLevel`): 2.2 s for a new white belt, 1.76 s at blue, 1.1 s at the floor. */
export function cmdWindowMs(level: number, first = false): number {
  const lv = Math.max(0, Number.isFinite(level) ? level : 0);
  const ms = Math.round(CMD_WINDOW_MS * Math.max(0.5, 1 - 0.05 * lv));
  return first ? Math.round(ms * FIRST_MATCH_SLACK) : ms;
}

/** The defense window against a partner of this `speed`: Felipe (0.9) gives about 0.44 of a chain window, Helena (0.32) about 0.67. */
export function defWindowMs(level: number, speed: number, sleeve: boolean, first = false): number {
  const f = Math.max(0.3, DEF_BASE - DEF_SPEED * Math.max(0, Math.min(1, speed)));
  return Math.round(cmdWindowMs(level, first) * f * (sleeve ? SLEEVE_SHIELD : 1));
}

export type TapGrade = 'perfeito' | 'boa' | 'errou' | 'tarde';

/** How one tap went: the wrong button is Errou!, past the window Tarde!, inside 45% of it Perfeito!, else Boa!. */
export function gradeTap(want: string, got: string | null | undefined, ms: number, windowMs: number): TapGrade {
  if (got !== want) return got == null ? 'tarde' : 'errou';
  if (!(ms <= windowMs)) return 'tarde';
  return ms <= windowMs * PERFECT_SHARE ? 'perfeito' : 'boa';
}

export const isHitGrade = (g: TapGrade): boolean => g === 'perfeito' || g === 'boa';

// needs_br: true — Bia's grade calls
export const GRADE_LABEL: Record<TapGrade, Bilingual> = {
  perfeito: { pt: 'Perfeito!', en: 'Perfect!' },
  boa: { pt: 'Boa!', en: 'Good!' },
  errou: { pt: 'Errou!', en: 'Wrong!' },
  tarde: { pt: 'Tarde!', en: 'Too late!' },
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

/**
 * Moves every fighter has from day one, whatever the stripes: Segurar, and Virar (the plain way out from under). Neither is in
 * UNLOCK_ORDER; the stripe lessons Recuperar and Sair stay strictly better escapes (shorter, and they reset the exchange).
 */
export const ALWAYS_MOVES: readonly MatMoveId[] = ['hold', 'virar'];

/** The bot is a student at `belt`: the whole pool of that belt, then the cross-rank cap, plus the moves everyone has. */
export function botMoves(belt: Belt, opponentBelt: Belt): MatMoveId[] {
  const out = fightMoves({ belt, unlocked: rankPool(belt), opponentBelt });
  if (!out.includes('virar')) out.push('virar');
  return out;
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
    braced: { you: false, them: false },
    ritmo: 0,
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
  if (id === 'virar') return v === 'side_bottom' || v === 'knee_bottom' || v === 'mount_bottom' || v === 'back_bottom';
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

/**
 * The grips a move needs are in hand. v3: the plain throws (Queda, Abraço, Tornozelo) go without a grip (the collar only makes them a
 * command shorter); the follow-ups the grips open still need them: Arrastar the collar, Puxar the sleeve, Arremesso both.
 */
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

/** A brace right after a brace: not allowed (a brace waits for one move, then you have to do something). */
export function braceRested(state: MatState, actor: MatSide, id: MatMoveId): boolean {
  return !state.braced?.[actor] || !braceOf(state, actor, id);
}

export function matLegalMoves(state: MatState, actor: MatSide, allowed: readonly MatMoveId[]): MatMoveId[] {
  const set = new Set<MatMoveId>(withCombos(allowed));
  for (const id of ALWAYS_MOVES) set.add(id);
  return (Object.keys(MOVE_LABEL) as MatMoveId[]).filter(
    (id) => set.has(id) && moveLegal(state.position, actor, id) && gripReady(state, actor, id) && !gripHeld(state, actor, id) && braceRested(state, actor, id),
  );
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
  // older snapshots (tests, a reconnect) may lack the later fields: fill them in
  const base = newMat();
  return {
    ...base,
    ...st,
    points: { ...st.points },
    adv: { ...(st.adv ?? base.adv) },
    grips: { you: { ...st.grips.you }, them: { ...st.grips.them } },
    gripAge: { you: { ...(st.gripAge?.you ?? zeroAge()) }, them: { ...(st.gripAge?.them ?? zeroAge()) } },
    brace: { ...(st.brace ?? base.brace) },
    braced: { ...(st.braced ?? base.braced) },
    ritmo: st.ritmo ?? 0,
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
/** The ways out from under: Virar (everyone), Recuperar as an escape (not the guard brace), Sair from the back. */
export function isEscape(state: MatState, actor: MatSide, id: MatMoveId): boolean {
  return id === 'virar' || id === 'escape_back' || (id === 'frame' && viewKind(state.position, actor) !== 'closed_bottom');
}
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

/**
 * The defense that stops this move, or null when it cannot be defended (Hold, a brace, a strip): a grip → Postura!, a takedown, the
 * pull to the ground or a sweep → Base!, a pass, a climb or an escape from under → Trava!, a finish → Sai!.
 */
export function defenseOf(state: MatState, actor: MatSide, id: MatMoveId): MatDefense | null {
  if (id === 'collar_tie' || id === 'sleeve_grip') return 'postura';
  if (TAKEDOWNS.has(id) || SWEEPS.has(id) || id === 'sleeve_pull') return 'base';
  if (PASSES.has(id) || id === 'escape_back' || id === 'virar') return 'trava';
  if (id === 'frame') return braceOf(state, actor, id) ? null : 'trava';
  if (SUBS.has(id)) return 'sai';
  return null;
}

/** The defense pad button a brace stands in for. */
const BRACE_DEFENSE: Record<MatBrace, MatDefense> = { postura: 'postura', base: 'base', recuperar: 'trava' };

/** The other fighter's brace is waiting for exactly this move: it stops it with no tap, and that is the defender's Vantagem. */
export function braceBlocks(state: MatState, actor: MatSide, id: MatMoveId): boolean {
  // the guard brace (Recuperar) waits for a pass; it does not stop the other fighter turning over from under
  if (id === 'virar') return false;
  const b = state.brace?.[other(actor)];
  const d = defenseOf(state, actor, id);
  return !!b && !!d && BRACE_DEFENSE[b] === d;
}

// ---------------------------------------------------------------- chains

const BASE_CHAIN: Record<Exclude<MatMoveId, 'hold' | 'frame' | 'passar' | 'virar'>, readonly MatCommand[]> = {
  collar_tie: ['pega'],
  sleeve_grip: ['pega'],
  posture: ['levanta'],
  sprawl: ['empurra'],
  sleeve_pull: ['puxa'],
  double_leg: ['puxa', 'levanta'],
  body_lock: ['pega', 'gira'],
  collar_drag: ['puxa', 'gira'],
  hip_throw: ['puxa', 'gira', 'levanta'],
  single_leg: ['puxa', 'levanta', 'gira'],
  hook_sweep: ['puxa', 'gira'],
  hip_bump: ['levanta', 'empurra'],
  scissor_sweep: ['puxa', 'empurra', 'gira'],
  knee_on_belly: ['levanta', 'empurra'],
  back_take: ['puxa', 'gira', 'pega'],
  // the stripe lesson Sair: one command shorter than Virar from the back
  escape_back: ['empurra', 'gira'],
  americana: ['pega', 'empurra', 'aperta'],
  armbar: ['pega', 'gira', 'levanta', 'aperta'],
  rnc: ['pega', 'gira', 'aperta'],
};

/** The move's own chain from here, before grips, braces and the partner's defense: the "technique" the drill teaches. */
export function baseChain(state: MatState, actor: MatSide, id: MatMoveId): MatCommand[] {
  if (id === 'hold') return [];
  // Recuperar is one command, as the guard brace and as the escape (the stripe lesson beats Virar's two)
  if (id === 'frame') return ['empurra'];
  // Virar, everyone's escape: two commands, three from the back
  if (id === 'virar') return viewKind(state.position, actor) === 'back_bottom' ? ['empurra', 'gira', 'levanta'] : ['empurra', 'gira'];
  if (id === 'passar') return viewKind(state.position, actor) === 'closed_top' ? ['empurra', 'levanta', 'gira'] : ['empurra', 'gira'];
  return [...BASE_CHAIN[id]];
}

/** A partner this hard to put away (Daniel) costs one more command on a finish and on any attack worth 3+ points. */
export const TOUGH_DEFENSE = 0.75;

/**
 * The chain the actor must tap for this move right now:
 *  - the collar grip makes every throw one command shorter (the first one, min 1);
 *  - a tough defender (`foeDefense ≥ 0.75`) adds a command before the last on a finish or a 3+ point attack.
 */
export function chainFor(state: MatState, actor: MatSide, id: MatMoveId, foeDefense = 0): MatCommand[] {
  const cmds = baseChain(state, actor, id);
  if (!cmds.length) return cmds;
  if (TAKEDOWNS.has(id) && state.grips[actor].collar && cmds.length > 1) cmds.shift();
  if (foeDefense >= TOUGH_DEFENSE && (SUBS.has(id) || pointsIfLands(state, actor, id) >= 3)) cmds.splice(cmds.length - 1, 0, SUBS.has(id) ? 'puxa' : 'empurra');
  return cmds;
}

/** Each command's window: the level's window, the first-match slack, and the tight last Aperta! of a finish. */
export function chainWindows(cmds: readonly MatCommand[], id: MatMoveId, level: number, first = false): number[] {
  const w = cmdWindowMs(level, first);
  return cmds.map((c, i) => (SUBS.has(id) && i === cmds.length - 1 && c === 'aperta' ? Math.round(w * FINAL_SQUEEZE) : w));
}

/**
 * v3 tuning (matSim.test.ts): the partner card's accuracy is lifted by this much before the chain penalty, so a partner lands often
 * enough to make the defense beat matter. The cards themselves (`PARTNERS`) are unchanged; the spread between them is kept.
 */
export const CLEAN_LIFT = 0.3;
/** The partner lands a chain of this length on its own (no botch) at `accuracy + CLEAN_LIFT − 0.04 × (length − 1)`, at most 0.97. */
export function partnerClean(accuracy: number, chainLength: number): number {
  return Math.max(0.05, Math.min(0.97, accuracy + CLEAN_LIFT - 0.04 * Math.max(0, chainLength - 1)));
}

/** Sai! taps in a row the player needs against the partner's finish (a tough defender's grip takes four). */
export const saiCount = (partnerDefense: number): number => (partnerDefense >= TOUGH_DEFENSE ? 4 : 3);

/** Feint chance per point of aggression (TATAME-V3 §C.7: 0.15). */
export const FEINT_RATE = 0.15;
/** Whether the partner feints this attack: from blue belt (level 4), an aggressive partner (≥ 0.5) with chance FEINT_RATE × aggression. */
export function shouldFeint(level: number, aggression: number, roll: number): boolean {
  return level >= 4 && aggression >= 0.5 && roll < FEINT_RATE * aggression;
}

// ---------------------------------------------------------------- the meter

const gripCount = (g: GripFlags): number => (g.collar ? 1 : 0) + (g.sleeve ? 1 : 0);

/**
 * The control meter, -100 (the partner owns the match) .. 100 (you do), from the player's seat:
 * the position, the grips each side holds, advantages, a brace up, and who won the last exchange.
 */
export function matMeter(st: MatState): number {
  let v = artOf(st.position).rung * 17;
  v += (gripCount(st.grips.you) - gripCount(st.grips.them)) * 9;
  v += ((st.adv?.you ?? 0) - (st.adv?.them ?? 0)) * 5;
  v += (st.brace?.you ? 4 : 0) - (st.brace?.them ? 4 : 0);
  v += (st.flow ?? 0) * 7;
  return Math.max(-100, Math.min(100, Math.round(v)));
}

// ---------------------------------------------------------------- resolve

function soundFor(id: MatMoveId, landed: boolean, next: MatPosition): MatSound {
  if (SUBS.has(id)) return 'sub';
  if (!landed || id === 'hold') return 'none';
  if (TAKEDOWNS.has(id) || id === 'sleeve_pull') return 'whoosh';
  if (next.kind === 'mount') return 'mount';
  return 'hit';
}

export interface ResolveOpts {
  /** The professor's drill: it lands whatever happens. */
  force?: boolean;
  /** The defender tapped the right defense in time (Defendeu!). A scoring attack stopped that way is their Vantagem. */
  defended?: boolean;
  /** Every command of the chain was Perfeito (the player's Ritmo). */
  perfect?: boolean;
}

// needs_br: true — Bia's calls
export const MAT_CALLS = {
  final: { pt: 'Final!', en: 'Finish!' },
  four: { pt: 'Quatro pontos!', en: 'Four points!' },
  three: { pt: 'Três pontos!', en: 'Three points!' },
  two: { pt: 'Dois pontos!', en: 'Two points!' },
  vantagem: { pt: 'Vantagem!', en: 'Advantage!' },
  ritmo: { pt: 'Que ritmo!', en: 'What rhythm!' },
  defendeu: { pt: 'Defendeu!', en: 'Defended!' },
  escapou: { pt: 'Escapou!', en: 'Escaped!' },
  errou: { pt: 'Errou!', en: 'Missed!' },
} as const satisfies Record<string, Bilingual>;

/**
 * Resolve one fighter's move. `landed` is the skill beat's verdict (every command hit, or the defender failed to stop it); there is no
 * roll. A finish that does not land drops the attacker to the bottom of the guard. An attack that does not land into the other's brace
 * is their Vantagem; one the defender stopped with the right tap is their Vantagem when it was worth points (`opts.defended`).
 */
export function resolveMat(state: MatState, actor: MatSide, id: MatMoveId, landed: boolean, opts: ResolveOpts = {}): MatResult {
  const from = artOf(state.position);
  const meterFrom = matMeter(state);
  const fail = (line: Bilingual): MatResult => ({
    state,
    ok: false,
    landed: false,
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
    events: [],
    meterFrom,
    meterTo: meterFrom,
  });
  const no = { pt: 'Não.', en: 'No.' };
  if (state.over || state.actor !== actor || !isMatMove(id)) return fail(no);
  if (!moveLegal(state.position, actor, id) || gripHeld(state, actor, id) || (!opts.force && !gripReady(state, actor, id))) return fail(no);
  const st = clone(state);
  const foe = other(actor);
  const events: MatEvent[] = [];
  const hit = !!opts.force || id === 'hold' || landed;
  const braced = !hit && braceBlocks(state, actor, id);
  const worth = SUBS.has(id) || pointsIfLands(state, actor, id) > 0;
  const keepSleeve = id === 'sleeve_pull';
  // a throw commits the grips it was set up with: hit or miss, they are gone
  if (TAKEDOWNS.has(id)) {
    st.grips[actor] = emptyGrips();
    st.gripAge[actor] = zeroAge();
  }
  let points = 0;
  let submission = false;
  let ritmo = false;
  const before = st.position;
  if (!hit && SUBS.has(id)) {
    st.position = place(actor, 'closed_guard', false);
    st.scored = [];
  }
  if (braced) {
    st.adv[foe] += 1;
    events.push({ kind: 'blocked', side: foe });
  } else if (!hit && opts.defended) {
    if (worth) st.adv[foe] += 1;
    events.push({ kind: 'defended', side: foe, adv: worth });
  } else if (hit) {
    const next = applySuccess(st, actor, id, events);
    st.position = next.position;
    if (next.resetScored) st.scored = [];
    if (next.points > 0 && next.scoreKey && !st.scored.includes(next.scoreKey)) {
      points = next.points;
      st.scored.push(next.scoreKey);
      st.points[actor] += points;
    }
    submission = next.submission;
  }
  // Ritmo: the player's all-Perfeito chains in a row; anything less starts the count again
  if (actor === 'you' && id !== 'hold' && !opts.force) {
    if (hit && opts.perfect) {
      st.ritmo += 1;
      if (st.ritmo >= RITMO_RUN) {
        st.ritmo = 0;
        st.adv.you += 1;
        ritmo = true;
        events.push({ kind: 'ritmo', side: 'you' });
      }
    } else st.ritmo = 0;
  }
  st.braced[actor] = hit && !!braceOf(state, actor, id);
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
  // the grips this fighter kept through the move get older; the third turn of holding lets go
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
  if (slipped.length) events.push({ kind: 'slip', side: actor, grips: slipped });
  if (id !== 'hold') st.flow = (hit ? actor : foe) === 'you' ? 1 : -1;
  else st.flow = 0;
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
  const advanced = events.some((e) => e.kind === 'blocked' || (e.kind === 'defended' && e.adv));
  const line: Bilingual = submission
    ? MAT_CALLS.final
    : points >= 4
      ? MAT_CALLS.four
      : points === 3
        ? MAT_CALLS.three
        : points === 2
          ? MAT_CALLS.two
          : ritmo
            ? MAT_CALLS.ritmo
            : advanced
              ? MAT_CALLS.vantagem
              : !hit && SUBS.has(id)
                ? MAT_CALLS.escapou
                : !hit && opts.defended
                  ? MAT_CALLS.defendeu
                  : hit
                    ? MOVE_LABEL[id]
                    : MAT_CALLS.errou;
  return {
    state: st,
    ok: true,
    landed: hit,
    points,
    submission,
    sound: braced || (opts.defended && !hit) ? 'hit' : soundFor(id, hit, st.position),
    line,
    from: from.position,
    to: to.position,
    fromAhead: from.ahead,
    toAhead: to.ahead,
    fromRung: from.rung,
    toRung: to.rung,
    events,
    meterFrom,
    meterTo: matMeter(st),
  };
}

interface Landing {
  position: MatPosition;
  resetScored: boolean;
  scoreKey: string | null;
  points: number;
  submission: boolean;
}

/** Points a move scores if it lands from here (before the once-per-exchange rule): 2 a takedown or sweep, 3 a pass, 2 the knee, 4 the top. */
function pointsIfLands(state: MatState, actor: MatSide, id: MatMoveId): number {
  if (TAKEDOWNS.has(id) || SWEEPS.has(id) || id === 'knee_on_belly') return 2;
  if (id === 'back_take') return 4;
  if (id === 'passar') return viewKind(state.position, actor) === 'closed_top' ? 3 : 4;
  return 0;
}

function applySuccess(st: MatState, actor: MatSide, id: MatMoveId, events: MatEvent[]): Landing {
  const stay: Landing = { position: st.position, resetScored: false, scoreKey: null, points: 0, submission: false };
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
    // one grip breaks: the collar first (it is the bigger threat), else the sleeve
    const g: GripId | null = st.grips[foe].collar ? 'collar' : st.grips[foe].sleeve ? 'sleeve' : null;
    if (g) {
      st.grips[foe][g] = false;
      st.gripAge[foe][g] = 0;
      events.push({ kind: 'strip', side: actor, grips: [g] });
    }
  }
  if (brace) {
    st.brace[actor] = brace;
    events.push({ kind: 'brace', side: actor, brace });
    return stay;
  }
  if (id === 'hold') return stay;
  const pts = pointsIfLands(st, actor, id);
  const landed = (kind: Exclude<MatKind, 'standing'>): Landing => ({ position: place(actor, kind, true), resetScored: false, scoreKey: `${actor}:${kind}`, points: pts, submission: false });
  if (id === 'passar') return viewKind(st.position, actor) === 'closed_top' ? landed('side_control') : landed('mount');
  if (id === 'double_leg') return landed('side_control');
  if (id === 'hip_throw') return landed('knee_on_belly');
  if (id === 'collar_drag') return landed('back_control');
  if (id === 'body_lock') return landed('closed_guard');
  if (id === 'single_leg') return landed('knee_on_belly');
  if (id === 'sleeve_pull') return { ...stay, position: place(actor, 'closed_guard', false) };
  if (id === 'knee_on_belly') return landed('knee_on_belly');
  if (id === 'back_take') return landed('back_control');
  if (id === 'hook_sweep') return landed('side_control');
  if (id === 'scissor_sweep') return landed('mount');
  if (id === 'hip_bump') return landed('side_control');
  if (id === 'frame' || id === 'escape_back') return { ...stay, position: place(actor, 'closed_guard', false), resetScored: true };
  // Virar gets out but does not start the exchange again: the top fighter cannot farm the same points by letting it happen
  if (id === 'virar') return { ...stay, position: place(actor, 'closed_guard', false) };
  if (SUBS.has(id)) return { ...stay, submission: true };
  return stay;
}

export function turnsLeft(st: MatState): number {
  return Math.max(0, MAT_TURNS - st.turnsUsed);
}

// ---------------------------------------------------------------- partner style and AI

/** How a partner fights: the card's numbers. Accuracy is its clean chance, speed shortens your defense window. */
export interface MatStyle {
  accuracy: number;
  speed: number;
  aggression: number;
  defense: number;
}

export function matStyle(p: { accuracy: number; speed: number; aggression: number; defense: number }): MatStyle {
  return { accuracy: p.accuracy, speed: p.speed, aggression: p.aggression, defense: p.defense };
}

/** What the partner has seen of the player this match: the share of its attacks you stopped, and of your chains that landed. */
export interface MatRates {
  block: number;
  chain: number;
}
export const START_RATES: MatRates = { block: 0.5, chain: 0.7 };

/** How a move from `actor` would go: the chance it lands, the chance the defender stops it with a tap; the rest is a botch or a miss. */
export interface MoveOdds {
  land: number;
  stopped: number;
}

/**
 * Who reads what lands. `odds` decides a move's chances; the partner AI's own (`partnerOdds`) uses its clean chance against your
 * observed block rate, and your observed chain rate for your replies. A simulated player plugs in its own.
 */
export interface MatAi {
  style: MatStyle;
  allowed: Pair<readonly MatMoveId[]>;
  odds: (st: MatState, actor: MatSide, id: MatMoveId) => MoveOdds;
}

/**
 * The partner's read (TATAME-V3 §I): its move lands at its clean chance × (1 − your block rate) and you stop it the rest of the time it
 * was clean; your move lands at your chain rate. A brace waiting for the move stops it outright, either way.
 */
export function partnerOdds(style: MatStyle, rates: MatRates = START_RATES): MatAi['odds'] {
  return (st, actor, id) => {
    if (id === 'hold') return { land: 1, stopped: 0 };
    if (braceBlocks(st, actor, id)) return { land: 0, stopped: 1 };
    if (actor === 'you') return { land: rates.chain, stopped: 0 };
    const clean = partnerClean(style.accuracy, chainFor(st, actor, id).length);
    const d = defenseOf(st, actor, id);
    return d ? { land: clean * (1 - rates.block), stopped: clean * rates.block } : { land: clean, stopped: 0 };
  };
}

const NEUTRAL: MatStyle = { accuracy: 0.6, speed: 0.5, aggression: 0.5, defense: 0.5 };
const POS_VALUE: Record<MatKind, number> = { standing: 0, closed_guard: 0.5, side_control: 1.1, knee_on_belly: 1.3, mount: 1.9, back_control: 2.2 };
/**
 * Roughly what an attack is worth if it lands, for the AI's threat read: points, the position it reaches, and (for a throw)
 * the attacks it opens on the ground. A grip is worth exactly how much it shortens the next one of these.
 */
const ATTACK_GAIN: Partial<Record<MatMoveId, number>> = {
  double_leg: 4.4,
  body_lock: 3.6,
  single_leg: 4.6,
  collar_drag: 5.5,
  hip_throw: 4.7,
  sleeve_pull: 1.2,
  hook_sweep: 3.6,
  scissor_sweep: 4.4,
  hip_bump: 3.6,
  passar: 4.2,
  knee_on_belly: 2.2,
  back_take: 4.9,
};

/** What an attack is worth to the AI's threat read; an escape is worth the ground it recovers (back to the bottom of the guard). */
function attackGain(st: MatState, s: MatSide, id: MatMoveId): number {
  if (isEscape(st, s, id) && st.position.kind !== 'standing') return Math.max(0, POS_VALUE[st.position.kind] - POS_VALUE.closed_guard);
  return ATTACK_GAIN[id] ?? 0;
}

/** The best attack `s` could make from here, as an expected gain. */
function threat(st: MatState, s: MatSide, ai: MatAi): number {
  let best = 0;
  const seen: MatState = st.actor === s ? st : { ...st, actor: s };
  for (const id of ai.allowed[s]) {
    const gain = attackGain(st, s, id);
    if (!gain || !moveLegal(st.position, s, id) || !gripReady(st, s, id)) continue;
    const p = ai.odds(seen, s, id).land;
    if (p * gain > best) best = p * gain;
  }
  return best;
}

/** How good this state is for `side`, in points. The style weighs what it values. */
function valueFor(st: MatState, side: MatSide, ai: MatAi): number {
  const foe = other(side);
  const style = ai.style;
  if (st.over) {
    if (st.winner === 'draw') return 0;
    return st.winner === side ? 12 : -12;
  }
  const late = Math.min(1, turnsLeft(st) / 4);
  let v = (st.points[side] - st.points[foe]) * (1 + 0.3 * style.aggression);
  v += (st.adv[side] - st.adv[foe]) * 0.45;
  if (st.position.kind !== 'standing') {
    const pv = POS_VALUE[st.position.kind];
    v += (st.position.top === side ? pv : -pv * (0.8 + 0.6 * style.defense)) * late;
  }
  // the next attack each side has lined up: the one to move can take it now, the other has to survive a turn first
  const nowW = st.actor === side ? 0.9 : 0.5;
  const thenW = st.actor === side ? 0.5 : 0.9;
  v += threat(st, side, ai) * nowW * (0.85 + 0.3 * style.aggression) * late;
  v -= threat(st, foe, ai) * thenW * (0.8 + 0.4 * style.defense) * late;
  // holding grips is its own comfort (the shield, the shorter throws); a fast fighter cares less and shoots sooner
  v += gripCount(st.grips[side]) * 0.2 * (1.2 - 0.6 * style.speed) * late;
  v -= gripCount(st.grips[foe]) * 0.15 * late;
  return v;
}

/** The expected value of `id` for the state's actor, from `side`'s seat, looking one reply ahead when `depth` allows. */
function expectFor(st: MatState, id: MatMoveId, side: MatSide, ai: MatAi, depth: number): number {
  const actor = st.actor;
  const hit = resolveMat(st, actor, id, true);
  if (!hit.ok) return -Infinity;
  const o = id === 'hold' ? { land: 1, stopped: 0 } : ai.odds(st, actor, id);
  const land = Math.max(0, Math.min(1, o.land));
  const stopped = Math.max(0, Math.min(1 - land, o.stopped));
  const miss = Math.max(0, 1 - land - stopped);
  const leaf = (s: MatState) => {
    if (depth <= 0 || s.over) return valueFor(s, side, ai);
    // the other fighter answers with what is best for them (worst for `side`)
    const replies = matLegalMoves(s, s.actor, ai.allowed[s.actor]);
    let best = s.actor === side ? -Infinity : Infinity;
    for (const r of replies) {
      const v = expectFor(s, r, side, ai, depth - 1);
      if (s.actor === side ? v > best : v < best) best = v;
    }
    return Number.isFinite(best) ? best : valueFor(s, side, ai);
  };
  let v = land * leaf(hit.state);
  if (stopped > 1e-6) v += stopped * leaf(resolveMat(st, actor, id, false, { defended: true }).state);
  if (miss > 1e-6) v += miss * leaf(resolveMat(st, actor, id, false).state);
  return v;
}

/** Every legal move of `side` with its two-ply value (the AI's whole read; the partner uses it as `them`, the simulation as `you`). */
export function matValues(state: MatState, side: MatSide, ai: MatAi): [MatMoveId, number][] {
  const st: MatState = state.actor === side ? state : { ...state, actor: side };
  return matLegalMoves(st, side, ai.allowed[side]).map((id) => [id, expectFor(st, id, side, ai, 1)]);
}

function bestOf(values: [MatMoveId, number][]): { move: MatMoveId; value: number } {
  let best: MatMoveId = 'hold';
  let bestV = -Infinity;
  for (const [id, v] of values) {
    if (v > bestV + 1e-9) {
      bestV = v;
      best = id;
    }
  }
  return { move: best, value: bestV };
}

/** What the partner is about to do, as the overlay says it ("Mateus vai tentar a queda."). */
export type MatPlanKind = 'gola' | 'manga' | 'queda' | 'soltar' | 'base' | 'puxar' | 'raspar' | 'passar' | 'subir' | 'finalizar' | 'sair' | 'travar' | 'segurar';

export interface MatPlan {
  move: MatMoveId;
  kind: MatPlanKind;
}

export function planKindOf(state: MatState, actor: MatSide, id: MatMoveId): MatPlanKind {
  const foe = other(actor);
  if (id === 'collar_tie') return 'gola';
  if (id === 'sleeve_grip') return 'manga';
  if (TAKEDOWNS.has(id)) return 'queda';
  if (id === 'posture') return state.grips[foe].collar || state.grips[foe].sleeve ? 'soltar' : 'base';
  if (id === 'sprawl') return 'base';
  if (id === 'sleeve_pull') return 'puxar';
  if (SWEEPS.has(id)) return 'raspar';
  if (id === 'passar') return 'passar';
  if (PASSES.has(id)) return 'subir';
  if (SUBS.has(id)) return 'finalizar';
  if (id === 'frame' && viewKind(state.position, actor) === 'closed_bottom') return 'travar';
  if (id === 'frame' || id === 'escape_back' || id === 'virar') return 'sair';
  return 'segurar';
}

/** The partner's AI: its card, the pools, and what it has seen of you this match. */
export interface BotCtx {
  allowed: readonly MatMoveId[];
  /** what the player can play (their reply); defaults to `allowed` */
  foeAllowed?: readonly MatMoveId[];
  style?: MatStyle;
  rates?: MatRates;
}

/** A fighter's pool plus the moves everyone has (Virar), for the AI's read. */
export const withAlways = (moves: readonly MatMoveId[]): MatMoveId[] => {
  const out = withCombos(moves);
  for (const id of ALWAYS_MOVES) if (id !== 'hold' && !out.includes(id)) out.push(id);
  return out;
};

export function botAi(ctx: BotCtx): MatAi {
  const style = ctx.style ?? NEUTRAL;
  return { style, allowed: { them: withAlways(ctx.allowed), you: withAlways(ctx.foeAllowed ?? ctx.allowed) }, odds: partnerOdds(style, ctx.rates) };
}

/** Every legal partner move with its two-ply value. */
export function planValues(state: MatState, ctx: BotCtx): [MatMoveId, number][] {
  return matValues(state, 'them', botAi(ctx));
}

/**
 * The partner's next move: the legal move with the best expected value two moves deep (its move, then your best reply), weighed by the
 * partner card and by how you have been playing (your block and chain rates). It is computed during your turn and shown to you.
 */
export function planBot(state: MatState, ctx: BotCtx): MatPlan {
  const st: MatState = state.actor === 'them' ? state : { ...state, actor: 'them' };
  const { move } = bestOf(planValues(state, ctx));
  return { move, kind: planKindOf(st, 'them', move) };
}

/** The partner's move this turn (the plan, re-read from the state as it is now). */
export function chooseBot(state: MatState, ctx: BotCtx): MatMoveId {
  return planBot(state, ctx).move;
}

/** The plan still stands after your move: same fighter to move, and the move is still legal. Otherwise the partner re-plans. */
export function planStands(state: MatState, plan: MatPlan | null, allowed: readonly MatMoveId[]): boolean {
  return !!plan && !state.over && state.actor === 'them' && matLegalMoves(state, 'them', allowed).includes(plan.move);
}

/** How much worse (in points) the telegraphed move may have become before the partner drops it for a better one. */
export const PLAN_INERTIA = 0.6;

/**
 * The partner's move on its turn: the telegraphed plan, unless your move broke it (made it illegal, or made it clearly worse
 * than its best option now). `replanned` says the telegraph was not kept.
 */
export function botCommit(state: MatState, plan: MatPlan | null, ctx: BotCtx): { move: MatMoveId; replanned: boolean } {
  const values = planValues(state, ctx);
  const best = bestOf(values);
  const kept = plan ? values.find(([id]) => id === plan.move) : undefined;
  if (kept && kept[1] >= best.value - PLAN_INERTIA) return { move: kept[0], replanned: false };
  return { move: best.move, replanned: !!plan };
}

/**
 * A feint (from blue belt): the telegraph names one attack, the partner does its best move of another kind (one the telegraphed
 * defense does not stop). Null when nothing else is worth it.
 */
export function feintMove(state: MatState, plan: MatPlan, ctx: BotCtx): MatMoveId | null {
  const st: MatState = state.actor === 'them' ? state : { ...state, actor: 'them' };
  const shown = defenseOf(st, 'them', plan.move);
  if (!shown) return null;
  const pick = bestOf(planValues(st, ctx).filter(([id]) => id !== plan.move && !!defenseOf(st, 'them', id) && defenseOf(st, 'them', id) !== shown));
  return Number.isFinite(pick.value) ? pick.move : null;
}

/** Your moves that answer the partner's plan: a brace, a strip, the shield, or using your grips (or the top) before it comes. */
export function planAnswers(state: MatState, plan: MatPlan, legal: readonly MatMoveId[]): MatMoveId[] {
  const pick = (ids: MatMoveId[]) => ids.filter((id) => legal.includes(id));
  switch (plan.kind) {
    case 'queda':
    case 'puxar':
      return pick(['sprawl', 'sleeve_grip']);
    case 'gola':
    case 'manga':
      return pick(['posture']);
    case 'soltar':
      return pick(['hip_throw', 'collar_drag', 'double_leg', 'single_leg', 'body_lock']);
    case 'base':
      return pick(['collar_tie', 'sleeve_grip']);
    case 'raspar':
      return pick(['sprawl', 'passar']);
    case 'passar':
    case 'subir':
    case 'finalizar':
      return pick(['frame', 'escape_back', 'virar', 'hook_sweep', 'scissor_sweep', 'hip_bump']);
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

// ---------------------------------------------------------------- the cards (at most four, no percentages)

/** What a move does if it lands, for the picker: points, where the pair ends up, a finish, or a grip. */
export interface MatEffect {
  points: number;
  to: BjjPositionId;
  toAhead: 'you' | 'partner' | null;
  submission: boolean;
  /** a miss on a finish drops the attacker to the bottom of the guard */
  riskBottom: boolean;
}

export function matEffect(state: MatState, actor: MatSide, id: MatMoveId): MatEffect | null {
  if (state.actor !== actor) state = { ...state, actor };
  const r = resolveMat(state, actor, id, true, { force: true });
  if (!r.ok) return null;
  return { points: r.points, to: r.to, toAhead: r.toAhead, submission: r.submission, riskBottom: SUBS.has(id) };
}

export type MatCardKind = 'attack' | 'finish' | 'setup' | 'defense';

export interface MatCard {
  move: MatMoveId;
  kind: MatCardKind;
  /** commands to tap (the chevrons) */
  chain: number;
  points: number;
  /** it answers the partner's telegraph */
  answers: boolean;
  /** what it does, in plain words. needs_br: true */
  does: Bilingual;
  /** a finish that misses leaves you on the bottom */
  risk?: Bilingual;
}

/** needs_br: true — the card's one line: what a move does if it lands. No position names, only who ends on top. */
export function moveDoes(state: MatState, actor: MatSide, id: MatMoveId): Bilingual {
  const g = state.grips[actor];
  const theirs = state.grips[other(actor)];
  switch (id) {
    case 'hold':
      return { pt: 'Passa a vez', en: 'Pass the turn' };
    case 'collar_tie':
      return g.sleeve ? { pt: 'Abre o Arremesso', en: 'Opens the Throw' } : { pt: 'Quedas mais curtas', en: 'Shorter takedowns' };
    case 'sleeve_grip':
      return g.collar ? { pt: 'Abre o Arremesso · protege você', en: 'Opens the Throw · shields you' } : { pt: 'Protege você', en: 'Shields you: more time to defend' };
    case 'posture':
      return theirs.collar || theirs.sleeve ? { pt: 'Solta a pegada dele', en: 'Breaks their grip' } : { pt: 'Trava a pegada dele', en: 'Blocks their grip' };
    case 'sprawl':
      return viewKind(state.position, actor) === 'closed_top' ? { pt: 'Trava a raspagem dele', en: 'Stops their sweep' } : { pt: 'Trava a queda dele', en: 'Stops their takedown' };
    case 'sleeve_pull':
      return { pt: 'Puxa pro chão', en: 'Pulls them down to the mat' };
    case 'frame':
      return braceOf(state, actor, id) ? { pt: 'Trava a passagem dele', en: 'Blocks their pass' } : { pt: 'Sai de baixo', en: 'Gets out from under' };
    case 'escape_back':
    case 'virar':
      return { pt: 'Sai de baixo', en: 'Gets out from under' };
  }
  if (SUBS.has(id)) return { pt: 'Vale a vitória!', en: 'Wins the match!' };
  const e = matEffect(state, actor, id);
  if (!e) return { pt: '', en: '' };
  if (e.points > 0) return { pt: `+${e.points} · você por cima`, en: `+${e.points} · you on top` };
  return e.toAhead === (actor === 'you' ? 'you' : 'partner') ? { pt: 'Você por cima', en: 'You on top' } : { pt: '', en: '' };
}

function cardOf(state: MatState, id: MatMoveId, answers: readonly MatMoveId[], foeDefense: number): MatCard {
  const e = matEffect(state, 'you', id);
  const kind: MatCardKind = SUBS.has(id) ? 'finish' : (e?.points ?? 0) > 0 ? 'attack' : braceOf(state, 'you', id) || id === 'frame' || id === 'escape_back' || id === 'virar' ? 'defense' : 'setup';
  return {
    move: id,
    kind,
    chain: chainFor(state, 'you', id, foeDefense).length,
    points: e?.points ?? 0,
    answers: answers.includes(id),
    does: moveDoes(state, 'you', id),
    // needs_br: true
    ...(SUBS.has(id) ? { risk: { pt: 'Se errar: você por baixo', en: 'Miss: you end on the bottom' } } : {}),
  };
}

export const MAX_CARDS = 4;

/**
 * The pick: at most four cards (Hold is its own small button), ranked
 *  1. the move that answers the partner's telegraph ("Responde!");
 *  2. the best scoring attack (most points; the grip follow-ups first, then the shorter chain);
 *  3. a finish, when one is legal;
 *  4. a setup or a defense (a grip you do not hold, Postura, Base, Recuperar);
 * then whatever else is legal, attacks first.
 */
export function offerCards(state: MatState, allowed: readonly MatMoveId[], plan: MatPlan | null, foeDefense = 0): MatCard[] {
  const st: MatState = state.actor === 'you' ? state : { ...state, actor: 'you' };
  const legal = matLegalMoves(st, 'you', allowed).filter((id) => id !== 'hold');
  const answers = plan ? planAnswers(st, plan, legal) : [];
  const all = legal.map((id) => cardOf(st, id, answers, foeDefense));
  const combos = new Set(COMBOS.map((c) => c.move));
  const out: MatCard[] = [];
  const take = (c: MatCard | undefined) => {
    if (c && out.length < MAX_CARDS && !out.some((o) => o.move === c.move)) out.push(c);
  };
  take(answers.map((id) => all.find((c) => c.move === id)).find(Boolean));
  const attacks = all.filter((c) => c.kind === 'attack').sort((a, b) => b.points - a.points || Number(combos.has(b.move)) - Number(combos.has(a.move)) || a.chain - b.chain);
  take(attacks[0]);
  take(all.find((c) => c.kind === 'finish'));
  take(all.find((c) => c.kind === 'setup' || c.kind === 'defense'));
  const order: MatCardKind[] = ['attack', 'finish', 'setup', 'defense'];
  for (const c of [...all].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || b.points - a.points)) take(c);
  return out;
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
