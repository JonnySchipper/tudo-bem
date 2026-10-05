/**
 * Academia mat fight. One function resolves a turn for either fighter (a second human can sit in the same call later).
 * Rolls stay on the server. The client shows the percent before the player confirms.
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
export const GRIP_BONUS = 10;

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
  | 'scissor_sweep'
  | 'hip_bump'
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

export interface MatState {
  position: MatPosition;
  points: { you: number; them: number };
  /** Turns already played, counting both fighters. The match ends at {@link MAT_TURNS}. */
  turnsUsed: number;
  actor: MatSide;
  grips: { you: GripFlags; them: GripFlags };
  /** Position keys already paid this exchange (`you:mount`). Cleared on a reset to standing or a missed submission. */
  scored: string[];
  over: boolean;
  winner: 'you' | 'them' | 'draw' | null;
  reason: 'submission' | 'points' | 'draw' | null;
}

export type MatSound = 'hit' | 'whoosh' | 'mount' | 'sub' | 'none';

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
}

// needs_br: true
export const MOVE_LABEL: Record<MatMoveId, Bilingual> = {
  collar_tie: { pt: 'Pegar a gola', en: 'Collar tie' },
  sleeve_grip: { pt: 'Pegar a manga', en: 'Sleeve grip' },
  double_leg: { pt: 'Queda', en: 'Double leg' },
  body_lock: { pt: 'Abraço', en: 'Body lock trip' },
  scissor_sweep: { pt: 'Tesoura', en: 'Scissor sweep' },
  hip_bump: { pt: 'Quadril', en: 'Hip bump' },
  sprawl: { pt: 'Base', en: 'Sprawl' },
  frame: { pt: 'Recuperar', en: 'Frame and recover' },
  escape_back: { pt: 'Sair', en: 'Escape back' },
  armbar: { pt: 'Braço', en: 'Armbar' },
  americana: { pt: 'Americana', en: 'Americana' },
  rnc: { pt: 'Pescoço', en: 'Rear naked choke' },
  hold: { pt: 'Segurar', en: 'Hold' },
};

/** null = locked at that belt. Order is white, blue, purple, brown, black. */
const PERCENT: Record<Exclude<MatMoveId, 'hold'>, readonly (number | null)[]> = {
  collar_tie: [70, 78, 84, 90, 94],
  sleeve_grip: [65, 74, 82, 88, 93],
  double_leg: [45, 55, 65, 74, 82],
  body_lock: [50, 60, 70, 78, 85],
  scissor_sweep: [40, 52, 64, 74, 82],
  hip_bump: [48, 58, 68, 76, 84],
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
  scissor_sweep: 2,
  hip_bump: 2,
};

/**
 * One skill per award, in order. White belt is the belt being put on, not a win.
 * Day one is a grip, Queda, and a weak submission, so a new player can leave standing.
 * Later awards fill the track, so a higher belt is choosing among several takedowns or several submissions.
 */
export const UNLOCK_ORDER: readonly { belt: Belt; stripes: number; move: MatMoveId }[] = [
  { belt: 'branca', stripes: 0, move: 'collar_tie' },
  { belt: 'branca', stripes: 0, move: 'double_leg' },
  { belt: 'branca', stripes: 0, move: 'armbar' },
  { belt: 'branca', stripes: 1, move: 'sleeve_grip' },
  { belt: 'branca', stripes: 3, move: 'body_lock' },
  { belt: 'branca', stripes: 4, move: 'sprawl' },
  { belt: 'azul', stripes: 0, move: 'scissor_sweep' },
  { belt: 'azul', stripes: 1, move: 'hip_bump' },
  { belt: 'azul', stripes: 2, move: 'frame' },
  { belt: 'azul', stripes: 3, move: 'escape_back' },
  { belt: 'azul', stripes: 4, move: 'americana' },
  { belt: 'roxa', stripes: 0, move: 'rnc' },
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

/**
 * Moves this fighter may play.
 * Same belt: only what they personally have unlocked.
 * Higher belt: the lower belt's whole pool (belt award + four stripes), even if the lower fighter is missing stripes.
 * Lower belt: only their own unlocks. They cannot reach a move that first unlocks higher.
 */
export function fightMoves(args: { belt: Belt; unlocked: readonly MatMoveId[]; opponentBelt: Belt }): MatMoveId[] {
  const own = args.unlocked.filter((id) => isMatMove(id) && rankPool(args.belt).includes(id));
  if (beltIndex(args.belt) > beltIndex(args.opponentBelt)) return rankPool(args.opponentBelt);
  return own;
}

/** The bot is a student at `belt`: the whole pool of that belt, then the cross-rank cap. */
export function botMoves(belt: Belt, opponentBelt: Belt): MatMoveId[] {
  return fightMoves({ belt, unlocked: rankPool(belt), opponentBelt });
}

export function gripBonus(g: GripFlags | undefined): number {
  if (!g) return 0;
  return (g.collar ? GRIP_BONUS : 0) + (g.sleeve ? GRIP_BONUS : 0);
}

/** Success percent at this belt. Takedowns add a live grip bonus and cap at 95. Hold is certain. Locked moves are 0. */
export function movePercent(id: MatMoveId, belt: Belt, bonus = 0): number {
  if (id === 'hold') return 100;
  const row = PERCENT[id][beltIndex(belt)];
  if (row == null) return 0;
  const extra = id === 'double_leg' || id === 'body_lock' ? Math.max(0, bonus) : 0;
  return Math.min(PERCENT_CAP, row + extra);
}

export function newMat(): MatState {
  return {
    position: { kind: 'standing' },
    points: { you: 0, them: 0 },
    turnsUsed: 0,
    actor: 'you',
    grips: { you: { collar: false, sleeve: false }, them: { collar: false, sleeve: false } },
    scored: [],
    over: false,
    winner: null,
    reason: null,
  };
}

const other = (s: MatSide): MatSide => (s === 'you' ? 'them' : 'you');

/** The position as the actor sees it: "top" means the actor is on top. */
export function seenBy(pos: MatPosition, actor: MatSide): MatPosition {
  if (pos.kind === 'standing' || actor === 'you') return pos;
  return { kind: pos.kind, top: pos.top === 'you' ? 'them' : 'you' };
}

function viewKind(pos: MatPosition, actor: MatSide): 'standing' | 'closed_top' | 'closed_bottom' | 'side_bottom' | 'knee_bottom' | 'mount_bottom' | 'mount_top' | 'back_bottom' | 'back_top' | 'side_top' | 'knee_top' | 'closed_top_only' {
  const s = seenBy(pos, actor);
  if (s.kind === 'standing') return 'standing';
  const top = s.top === 'you';
  if (s.kind === 'closed_guard') return top ? 'closed_top' : 'closed_bottom';
  if (s.kind === 'side_control') return top ? 'side_top' : 'side_bottom';
  if (s.kind === 'knee_on_belly') return top ? 'knee_top' : 'knee_bottom';
  if (s.kind === 'mount') return top ? 'mount_top' : 'mount_bottom';
  return top ? 'back_top' : 'back_bottom';
}

export function moveLegal(pos: MatPosition, actor: MatSide, id: MatMoveId): boolean {
  if (id === 'hold') return true;
  const v = viewKind(pos, actor);
  switch (id) {
    case 'collar_tie':
    case 'sleeve_grip':
    case 'double_leg':
    case 'body_lock':
    case 'sprawl':
      return v === 'standing';
    case 'scissor_sweep':
    case 'hip_bump':
      return v === 'closed_bottom';
    case 'frame':
      return v === 'side_bottom' || v === 'knee_bottom' || v === 'mount_bottom';
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

export function matLegalMoves(state: MatState, actor: MatSide, allowed: readonly MatMoveId[]): MatMoveId[] {
  const set = new Set<MatMoveId>(allowed);
  set.add('hold');
  return (Object.keys(MOVE_LABEL) as MatMoveId[]).filter((id) => set.has(id) && moveLegal(state.position, actor, id));
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

function emptyGrips(): GripFlags {
  return { collar: false, sleeve: false };
}

function clone(st: MatState): MatState {
  return {
    ...st,
    points: { ...st.points },
    grips: { you: { ...st.grips.you }, them: { ...st.grips.them } },
    scored: [...st.scored],
    position: st.position.kind === 'standing' ? { kind: 'standing' } : { kind: st.position.kind, top: st.position.top },
  };
}

function finishScore(st: MatState): void {
  if (st.points.you === st.points.them) {
    st.winner = 'draw';
    st.reason = 'draw';
  } else {
    st.winner = st.points.you > st.points.them ? 'you' : 'them';
    st.reason = 'points';
  }
  st.over = true;
}

const SUBS = new Set<MatMoveId>(['armbar', 'americana', 'rnc']);
const TAKEDOWNS = new Set<MatMoveId>(['double_leg', 'body_lock']);

function soundFor(id: MatMoveId, success: boolean, next: MatPosition): MatSound {
  if (SUBS.has(id)) return 'sub';
  if (!success || id === 'hold') return 'none';
  if (TAKEDOWNS.has(id)) return 'whoosh';
  if (next.kind === 'mount') return 'mount';
  return 'hit';
}

/**
 * Resolve one fighter's move. `roll` is in [0, 1). Success when roll < percent/100.
 * `force` guarantees success (the professor's drill). A miss on a submission dumps both fighters
 * to closed guard with the attacker on the bottom.
 */
export function resolveMat(state: MatState, actor: MatSide, id: MatMoveId, roll: number, belt: Belt, force = false): MatResult {
  const from = artOf(state.position);
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
  });
  if (state.over || state.actor !== actor || !isMatMove(id)) return fail({ pt: 'Não.', en: 'No.' });
  const st = clone(state);
  const bonus = gripBonus(st.grips[actor]);
  const percent = movePercent(id, belt, bonus);
  if (!moveLegal(st.position, actor, id)) return fail({ pt: 'Não.', en: 'No.' });
  if (!force && percent <= 0 && id !== 'hold') return fail({ pt: 'Não.', en: 'No.' });
  if (TAKEDOWNS.has(id)) st.grips[actor] = emptyGrips();
  const success = force || id === 'hold' || roll < percent / 100;
  let points = 0;
  let submission = false;
  if (!success && SUBS.has(id)) {
    st.position = place(actor, 'closed_guard', false);
    st.scored = [];
    st.grips = { you: emptyGrips(), them: emptyGrips() };
  } else if (success) {
    const next = applySuccess(st, actor, id);
    st.position = next.position;
    if (next.resetScored) st.scored = [];
    if (next.clearGrips) st.grips = { you: emptyGrips(), them: emptyGrips() };
    const raw = POINTS[id] ?? 0;
    if (raw > 0 && next.scoreKey) {
      if (!st.scored.includes(next.scoreKey)) {
        points = raw;
        st.scored.push(next.scoreKey);
        st.points[actor] += points;
      }
    }
    submission = !!next.submission;
  }
  st.turnsUsed += 1;
  const to = artOf(st.position);
  if (submission) {
    st.over = true;
    st.winner = actor === 'you' ? 'you' : 'them';
    st.reason = 'submission';
  } else if (st.turnsUsed >= MAT_TURNS) {
    finishScore(st);
  } else {
    st.actor = other(actor);
  }
  const line = submission
    ? { pt: 'Final!', en: 'Finish!' }
    : points >= 4
      ? { pt: 'Quatro pontos!', en: 'Four points!' }
      : points === 3
        ? { pt: 'Três pontos!', en: 'Three points!' }
        : points === 2
          ? { pt: 'Dois pontos!', en: 'Two points!' }
          : success
            ? MOVE_LABEL[id]
            : { pt: 'Errou!', en: 'Missed!' };
  return {
    state: st,
    ok: true,
    success,
    points,
    submission,
    sound: soundFor(id, success, st.position),
    line,
    from: from.position,
    to: to.position,
    fromAhead: from.ahead,
    toAhead: to.ahead,
    fromRung: from.rung,
    toRung: to.rung,
  };
}

function applySuccess(st: MatState, actor: MatSide, id: MatMoveId): { position: MatPosition; resetScored: boolean; clearGrips: boolean; scoreKey: string | null; submission: boolean } {
  const grip = () => {
    if (id === 'collar_tie') st.grips[actor].collar = true;
    if (id === 'sleeve_grip') st.grips[actor].sleeve = true;
  };
  if (id === 'collar_tie' || id === 'sleeve_grip') {
    grip();
    return { position: { kind: 'standing' }, resetScored: false, clearGrips: false, scoreKey: null, submission: false };
  }
  if (id === 'sprawl') return { position: { kind: 'standing' }, resetScored: true, clearGrips: true, scoreKey: null, submission: false };
  if (id === 'hold') return { position: st.position, resetScored: false, clearGrips: false, scoreKey: null, submission: false };
  if (id === 'double_leg') return landed(actor, 'side_control', true);
  if (id === 'body_lock') return landed(actor, 'closed_guard', true);
  if (id === 'scissor_sweep') return landed(actor, 'mount', true);
  if (id === 'hip_bump') return landed(actor, 'side_control', true);
  if (id === 'frame' || id === 'escape_back') return { position: place(actor, 'closed_guard', false), resetScored: true, clearGrips: true, scoreKey: null, submission: false };
  if (SUBS.has(id)) return { position: st.position, resetScored: false, clearGrips: false, scoreKey: null, submission: true };
  return { position: st.position, resetScored: false, clearGrips: false, scoreKey: null, submission: false };
}

function landed(actor: MatSide, kind: Exclude<MatKind, 'standing'>, onTop: boolean): { position: MatPosition; resetScored: boolean; clearGrips: boolean; scoreKey: string | null; submission: boolean } {
  return { position: place(actor, kind, onTop), resetScored: false, clearGrips: true, scoreKey: `${actor}:${kind}`, submission: false };
}

export function turnsLeft(st: MatState): number {
  return Math.max(0, MAT_TURNS - st.turnsUsed);
}

/**
 * Bot policy. White prefers a grip, then the higher-percent takedown.
 * An armbar is only thrown when it is the best way to finish a match the bot is losing.
 * From purple up, Americana (and the choke at brown) come out when the bot is behind with 2 turns or fewer left.
 * Otherwise the legal move with the highest expected points. Hold only when ahead and every scoring move expects under 1.
 */
export function chooseBot(state: MatState, belt: Belt, allowed: readonly MatMoveId[]): MatMoveId {
  const legal = matLegalMoves(state, state.actor, allowed);
  if (!legal.length) return 'hold';
  const pct = (id: MatMoveId) => movePercent(id, belt, gripBonus(state.grips[state.actor]));
  const best = (ids: MatMoveId[]) => ids.reduce((a, b) => (pct(b) > pct(a) ? b : a));
  const behind = state.points[state.actor] < state.points[other(state.actor)];
  const ahead = state.points[state.actor] > state.points[other(state.actor)];
  const subs = legal.filter((id) => SUBS.has(id));
  if (behind && beltIndex(belt) >= beltIndex('roxa') && turnsLeft(state) <= 2) {
    const clutch = subs.filter((id) => id === 'americana' || (id === 'rnc' && beltIndex(belt) >= beltIndex('marrom')));
    if (clutch.length) return best(clutch);
  }
  if (behind && legal.includes('armbar')) {
    const arm = pct('armbar');
    if (subs.every((id) => pct(id) <= arm)) return 'armbar';
  }
  const seen = seenBy(state.position, state.actor);
  if (belt === 'branca' && seen.kind === 'standing') {
    const grips = legal.filter((id) => id === 'collar_tie' || id === 'sleeve_grip');
    const flags = state.grips[state.actor];
    if (grips.length && !(flags.collar && flags.sleeve)) {
      const fresh = grips.filter((id) => (id === 'collar_tie' ? !flags.collar : !flags.sleeve));
      return best(fresh.length ? fresh : grips);
    }
    const td = legal.filter((id) => TAKEDOWNS.has(id));
    if (td.length) return best(td);
  }
  if (beltIndex(belt) >= beltIndex('azul') && seen.kind === 'closed_guard' && seen.top !== 'you') {
    const sweeps = legal.filter((id) => id === 'scissor_sweep' || id === 'hip_bump');
    if (sweeps.length) return bestEv(sweeps, pct);
  }
  const scoring = legal.filter((id) => (POINTS[id] ?? 0) > 0);
  const ev = (id: MatMoveId) => (pct(id) / 100) * (POINTS[id] ?? 0);
  if (ahead && legal.includes('hold') && scoring.every((id) => ev(id) < 1)) return 'hold';
  const ranked = legal.filter((id) => id !== 'hold');
  if (!ranked.length) return 'hold';
  return bestEv(ranked, pct);
}

function bestEv(ids: MatMoveId[], pct: (id: MatMoveId) => number): MatMoveId {
  return ids.reduce((a, b) => {
    const ea = (pct(a) / 100) * (POINTS[a] ?? 0);
    const eb = (pct(b) / 100) * (POINTS[b] ?? 0);
    if (eb !== ea) return eb > ea ? b : a;
    return pct(b) > pct(a) ? b : a;
  });
}

/** Where the professor places a compliant partner so the new move is legal. */
export function drillPosition(id: MatMoveId): MatPosition {
  switch (id) {
    case 'scissor_sweep':
    case 'hip_bump':
      return { kind: 'closed_guard', top: 'them' };
    case 'frame':
      return { kind: 'side_control', top: 'them' };
    case 'escape_back':
      return { kind: 'back_control', top: 'them' };
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
