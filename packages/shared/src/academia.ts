/**
 * Academia do Bairro: the profile side of "Treino no tatame" (belts, stripes, partners, rewards, position labels).
 * The bout rules live in `bout.ts` and the Portuguese challenge bank in `challenges.ts`; this file is what the profile,
 * the lobby and the end card share. Pure logic for server + client + tests.
 *
 * Locks (CEO / Product B, docs/lifesim/ACADEMIA-REDESIGN.md): the learning content is everyday A1 Portuguese, never technique
 * trivia; no "Oss", "rola" or technique nameplates in learner-facing copy (no position or submission names either: #49, enforced by
 * academia-lock.test.ts, which also greps the client bundle); no brand names (academia-branding.test.ts).
 */
import type { Bilingual } from './types.js';
import { beltIndex, isMatMove, moveTaughtAt, movesThrough, UNLOCK_ORDER, type MatMoveId } from './matFight.js';

export type BjjPositionId =
  | 'de_pe'
  | 'guarda_fechada'
  | 'meia_guarda'
  | 'cem_quilos'
  | 'joelho'
  | 'montada'
  | 'costas';

/**
 * Learner-facing bout steps (the #49 lock): the overlay never names a position. Pose ids above are internal (they pick the mat art) and have
 * no readable label anywhere in the client bundle. The step is the size of the lead: Vantagem, Pressão, Quase lá, then Final at the top of the ladder.
 * Virada is reserved for a reversal toast; level ground is just "Em pé".
 */
export const BOUT_STEP_CHROME: Bilingual[] = [
  { pt: 'Vantagem', en: 'Advantage' },
  { pt: 'Pressão', en: 'Pressure' },
  { pt: 'Quase lá', en: 'Almost there' },
  { pt: 'Virada', en: 'Reversal' },
  { pt: 'Final', en: 'Finish' },
];
export const BOUT_STEP_STANDING: Bilingual = { pt: 'Em pé', en: 'Standing' };

/** The neutral step for a ladder rung (-4..4): its size, not its sign; the first three steps, then Final at the top. */
export function boutStepLabel(rung: number): Bilingual {
  const a = Math.min(4, Math.abs(Math.round(Number.isFinite(rung) ? rung : 0)));
  if (a === 0) return BOUT_STEP_STANDING;
  return a === 4 ? BOUT_STEP_CHROME[4] : BOUT_STEP_CHROME[a - 1];
}

// ---------------------------------------------------------------- belts and stripes (never purchasable)

export type Belt = 'branca' | 'azul' | 'roxa' | 'marrom' | 'preta';

export const BELT_LABELS: Record<Belt, Bilingual> = {
  // needs_br: true (roxa, marrom and preta; branca and azul were already on the wall)
  branca: { pt: 'Faixa branca', en: 'White belt' },
  azul: { pt: 'Faixa azul', en: 'Blue belt' },
  roxa: { pt: 'Faixa roxa', en: 'Purple belt' },
  marrom: { pt: 'Faixa marrom', en: 'Brown belt' },
  preta: { pt: 'Faixa preta', en: 'Black belt' },
};

export const BELT_COLORS: Record<Belt, string> = {
  branca: '#f4f1ea',
  azul: '#2f5fb0',
  roxa: '#6b3fa0',
  marrom: '#6b3a1f',
  preta: '#1c1c28',
};

/**
 * Wins per stripe. Four stripes promote: the fourth stripe is the new belt, so a belt is worn with 0–3 stripes.
 * Each belt doubles. Black keeps earning stripes and does not promote.
 *
 * Jonny lock 2026-10-05. Cumulative wins to wear the next belt, summing 4 × the stripe rate:
 * white → blue 20, blue → purple 60, purple → brown 140, brown → black 300.
 * The product brief's cumulative cells said brown 100 and black 260. Those were arithmetic typos.
 * CEO confirmed the 4× totals: brown unlocks at 140 wins and black at 300. This ladder is the source of truth.
 * Fundar reads brown off this same rank, so it opens at 140 wins.
 * A draw is not a win. A loss does not remove a stripe. The win count on the account is the rank.
 */
export const BELT_LADDER: readonly { belt: Belt; per: number }[] = [
  { belt: 'branca', per: 5 },
  { belt: 'azul', per: 10 },
  { belt: 'roxa', per: 20 },
  { belt: 'marrom', per: 40 },
  { belt: 'preta', per: 80 },
];
export const STRIPES_PER_BELT = 4;
/** @deprecated White's rate only. The live curve is {@link BELT_LADDER}; each later belt doubles. */
export const WINS_PER_STRIPE = BELT_LADDER[0].per;
/** Cumulative wins to first wear the blue belt. */
export const BLUE_BELT_WINS = BELT_LADDER[0].per * STRIPES_PER_BELT;

/** Cumulative wins to first wear `belt`. Derived from {@link BELT_LADDER}, not a second counter. */
export function winsToBelt(belt: Belt): number {
  let total = 0;
  for (const step of BELT_LADDER) {
    if (step.belt === belt) return total;
    total += step.per * STRIPES_PER_BELT;
  }
  return total;
}

/** One-time kimono purchase at the vestiário; required before rolling on the mat. */
export const GI_PRICE = 18;
export const GI_ITEM_ID = 'kimono';

export interface BjjProgress {
  belt: Belt;
  stripes: number;
  wins: number;
  /** Skills finished on this account. They stay across matches, sessions and devices. */
  unlocked: MatMoveId[];
  /** A stripe is already saved; the professor drill still has to land this move. */
  pendingDrill?: MatMoveId | null;
  /** Bond points paid today for bouts (a small daily cap keeps friendship from being farmed). */
  bondDay?: string;
  bondToday?: number;
}

/** Belt and stripes from a win count. Wins are the source of truth on the account. */
export function progressForWins(wins: number): { belt: Belt; stripes: number } {
  let w = Math.max(0, Math.floor(Number.isFinite(wins) ? wins : 0));
  for (const step of BELT_LADDER) {
    if (step.belt === 'preta') return { belt: 'preta', stripes: Math.floor(w / step.per) };
    const span = step.per * STRIPES_PER_BELT;
    if (w < span) return { belt: step.belt, stripes: Math.min(STRIPES_PER_BELT, Math.floor(w / step.per)) };
    w -= span;
  }
  return { belt: 'preta', stripes: 0 };
}

/** Awards inserted onto stripes that older saves may already have passed. */
const LATER_AWARDS = ['knee_on_belly', 'back_take', 'single_leg'] as const satisfies readonly MatMoveId[];

/**
 * The move taught at four stripes. That stripe is the promotion, so the move joins the account
 * when the next belt is put on. It is not a second win counter and it does not change the fight.
 */
function movesPassedWithTheBelt(belt: Belt): MatMoveId[] {
  const out: MatMoveId[] = [];
  for (const step of BELT_LADDER) {
    if (step.belt === belt) break;
    const move = moveTaughtAt(step.belt, STRIPES_PER_BELT);
    if (move) out.push(move);
  }
  return out;
}

function cleanMoves(raw: unknown, through: readonly MatMoveId[]): MatMoveId[] {
  const allow = new Set(through);
  const out: MatMoveId[] = [];
  if (!Array.isArray(raw)) return out;
  for (const id of raw) if (isMatMove(id) && allow.has(id) && !out.includes(id)) out.push(id);
  return out;
}

/** Old saves and hand-edited ones come back coherent. Never throws. Wins decide the belt. */
export function normalizeBjj(p?: Partial<BjjProgress> | null): BjjProgress {
  const wins = Math.max(0, Math.floor(Number(p?.wins) || 0));
  const { belt, stripes } = progressForWins(wins);
  const through = movesThrough(belt, stripes);
  const stored = cleanMoves(p?.unlocked, through);
  // a save from before skills were stored keeps every move those wins already earned
  const base = !stored.length && wins > 0 ? [...through] : stored.includes('collar_tie') ? stored : ['collar_tie' as const, ...stored];
  const starters = movesThrough('branca', 0);
  const unlocked = [...base];
  for (const id of starters) if (through.includes(id) && !unlocked.includes(id)) unlocked.push(id);
  // Moves added onto stripes some accounts had already passed. They join once that stripe is behind.
  // The stripe the account is on still waits for the professor drill.
  for (const id of LATER_AWARDS) {
    if (!through.includes(id) || unlocked.includes(id)) continue;
    const award = UNLOCK_ORDER.find((u) => u.move === id);
    if (!award) continue;
    const passed = beltIndex(award.belt) < beltIndex(belt) || (award.belt === belt && award.stripes < stripes);
    if (passed) unlocked.push(id);
  }
  for (const id of movesPassedWithTheBelt(belt)) if (through.includes(id) && !unlocked.includes(id)) unlocked.push(id);
  const taught = moveTaughtAt(belt, stripes);
  let pending: MatMoveId | null = isMatMove(p?.pendingDrill) ? p!.pendingDrill! : null;
  if (pending && (unlocked.includes(pending) || !through.includes(pending) || pending !== taught)) pending = null;
  if (!pending && taught && (LATER_AWARDS as readonly MatMoveId[]).includes(taught) && !unlocked.includes(taught)) pending = taught;
  const out: BjjProgress = { belt, stripes, wins, unlocked, ...(pending ? { pendingDrill: pending } : {}) };
  if (typeof p?.bondDay === 'string') out.bondDay = p.bondDay;
  if (Number.isFinite(Number(p?.bondToday))) out.bondToday = Math.max(0, Math.floor(Number(p!.bondToday)));
  return out;
}

/** Partner unlocks: white stripes 0..4, then each later belt adds four. */
export function bjjLevel(p?: Partial<BjjProgress> | null): number {
  const n = normalizeBjj(p);
  const idx = Math.max(0, BELT_LADDER.findIndex((b) => b.belt === n.belt));
  return idx * STRIPES_PER_BELT + Math.min(STRIPES_PER_BELT, n.stripes);
}

export interface WinResult {
  progress: BjjProgress;
  /** a stripe was added on the same belt */
  stripeUp: boolean;
  /** the belt changed */
  beltUp: boolean;
  /** The skill this award teaches, waiting on the professor drill. Null when the list is exhausted. */
  move: MatMoveId | null;
}

export function recordWin(p?: Partial<BjjProgress> | null): WinResult {
  const before = normalizeBjj(p);
  const wins = before.wins + 1;
  const now = progressForWins(wins);
  const changed = now.belt !== before.belt || now.stripes !== before.stripes;
  const taught = changed ? moveTaughtAt(now.belt, now.stripes) : null;
  const move = taught && !before.unlocked.includes(taught) ? taught : null;
  const progress = normalizeBjj({
    ...before,
    wins,
    belt: now.belt,
    stripes: now.stripes,
    unlocked: before.unlocked,
    pendingDrill: move,
  });
  return { progress, stripeUp: now.belt === before.belt && now.stripes > before.stripes, beltUp: now.belt !== before.belt, move };
}

/** The drill landed. The skill joins the account and the pending drill clears. */
export function completeDrill(p: BjjProgress | null | undefined, move: MatMoveId): BjjProgress {
  const n = normalizeBjj(p);
  if (n.pendingDrill !== move || n.unlocked.includes(move)) {
    const { pendingDrill: _pending, ...rest } = n;
    return rest;
  }
  const { pendingDrill: _drop, ...rest } = n;
  return { ...rest, unlocked: [...n.unlocked, move] };
}

// ---------------------------------------------------------------- partners

export type PartnerId = 'mateus' | 'felipe' | 'helena' | 'daniel' | 'rafael';

export interface PartnerProfile {
  id: PartnerId;
  /** A first name from the CPU allowlist: the same neighbours that train in the academia. */
  name: string;
  /** Bjj level (see `bjjLevel`) needed to pick this partner. */
  unlockLevel: number;
  /** 0..1 chance to get a challenge right */
  accuracy: number;
  /** 0..1 how fast it answers (the speed factor it brings to a push) */
  speed: number;
  /** 0..1 how often it picks bold intents and goes for the finish early */
  aggression: number;
  /** 0..1 how much it blunts your pushes when you are ahead, and how much harder a finalização against it is */
  defense: number;
  style: { pt: string; en: string };
  bio: Bilingual;
}

// needs_br: true (names are from the CPU allowlist; styles and one-line bios are new copy)
export const PARTNERS: readonly PartnerProfile[] = [
  {
    id: 'mateus',
    name: 'Mateus',
    unlockLevel: 0,
    accuracy: 0.6,
    speed: 0.45,
    aggression: 0.45,
    defense: 0.45,
    style: { pt: 'Equilibrado', en: 'Balanced' },
    bio: { pt: 'Calmo e justo. Um ótimo parceiro pra começar.', en: 'Calm and fair. A great partner to start with.' },
  },
  {
    id: 'felipe',
    name: 'Felipe',
    unlockLevel: 1,
    accuracy: 0.54,
    speed: 0.9,
    aggression: 0.55,
    defense: 0.25,
    style: { pt: 'Rápido, mas bagunçado', en: 'Fast but sloppy' },
    bio: { pt: 'Rápido demais, erra bastante. Chega antes, mas nem sempre acerta.', en: 'Very quick, misses a lot. Gets there first, not always right.' },
  },
  {
    id: 'helena',
    name: 'Helena',
    unlockLevel: 2,
    accuracy: 0.86,
    speed: 0.32,
    aggression: 0.3,
    defense: 0.6,
    style: { pt: 'Lenta e precisa', en: 'Slow and precise' },
    bio: { pt: 'Devagar, mas quase nunca erra. Paciência é tudo.', en: 'Slow, but almost never wrong. Patience is everything.' },
  },
  {
    id: 'daniel',
    name: 'Daniel',
    unlockLevel: 3,
    accuracy: 0.72,
    speed: 0.5,
    aggression: 0.2,
    defense: 0.92,
    style: { pt: 'Defensivo', en: 'Defensive' },
    bio: { pt: 'Difícil de vencer no final. Segura firme e espera o erro.', en: 'Hard to put away. Holds tight and waits for a mistake.' },
  },
  {
    id: 'rafael',
    name: 'Rafael',
    unlockLevel: 4,
    accuracy: 0.74,
    speed: 0.62,
    aggression: 0.92,
    defense: 0.35,
    style: { pt: 'Agressivo', en: 'Aggressive' },
    bio: { pt: 'Vai pra cima desde o começo e procura o final cedo.', en: 'Comes forward from the start and hunts for the finish early.' },
  },
];

export const partnerById = (id: unknown): PartnerProfile | undefined => PARTNERS.find((p) => p.id === id);

export const partnerUnlocked = (p: PartnerProfile, prog?: Partial<BjjProgress> | null): boolean => bjjLevel(prog) >= p.unlockLevel;

// ---------------------------------------------------------------- rewards

export const ROLL_RV_WIN = 12;
export const ROLL_RV_FINISH = 18;
export const ROLL_RV_DRAW = 7;
export const ROLL_RV_LOSS = 5;
/** Friendship with Professora Bia: points per finished bout (a win pays a little more) and the daily cap. */
export const BOUT_BOND_PLAY = 1;
export const BOUT_BOND_WIN = 3;
export const BOUT_BOND_DAILY_CAP = 8;

export type BoutWinner = 'you' | 'partner' | 'draw';
export type BoutReason = 'finalizacao' | 'pontos' | 'vantagens' | 'empate' | 'quit';

export function boutRv(winner: BoutWinner, reason: BoutReason): number {
  if (winner === 'you') return reason === 'finalizacao' ? ROLL_RV_FINISH : ROLL_RV_WIN;
  if (winner === 'draw') return ROLL_RV_DRAW;
  return ROLL_RV_LOSS;
}

/** Bond points for a finished bout, honouring today's cap (`today` is any day string; the counter resets when it changes). */
export function boutBond(winner: BoutWinner, prog: BjjProgress, today: string): { gain: number; next: BjjProgress } {
  const used = prog.bondDay === today ? (prog.bondToday ?? 0) : 0;
  const want = winner === 'you' ? BOUT_BOND_WIN : BOUT_BOND_PLAY;
  const gain = Math.max(0, Math.min(want, BOUT_BOND_DAILY_CAP - used));
  return { gain, next: { ...prog, bondDay: today, bondToday: used + gain } };
}

/** The door the old `ROLL_CPU_PARTNER` export used to be: the default partner a fresh player meets. */
export const DEFAULT_PARTNER: PartnerId = 'mateus';
