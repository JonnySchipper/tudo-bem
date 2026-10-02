/**
 * Academia do Bairro: the profile side of "Treino no tatame" (belts, stripes, partners, rewards, position labels).
 * The bout rules live in `bout.ts` and the Portuguese challenge bank in `challenges.ts`; this file is what the profile,
 * the lobby and the end card share. Pure logic for server + client + tests.
 *
 * Locks (CEO / Product B, docs/lifesim/ACADEMIA-REDESIGN.md): the learning content is everyday A1 Portuguese, never technique
 * trivia; no "Oss", "rola" or technique nameplates in learner-facing copy; no brand names (academia-branding.test.ts). Position names are labels only.
 */
import type { Bilingual } from './types.js';

export type BjjPositionId =
  | 'de_pe'
  | 'guarda_fechada'
  | 'meia_guarda'
  | 'cem_quilos'
  | 'joelho'
  | 'montada'
  | 'costas';

export const POSITION_LABELS: Record<BjjPositionId, Bilingual> = {
  de_pe: { pt: 'De pé', en: 'Standing' },
  guarda_fechada: { pt: 'Guarda fechada', en: 'Closed guard' },
  meia_guarda: { pt: 'Meia-guarda', en: 'Half guard' },
  cem_quilos: { pt: 'Cem quilos', en: 'Side control' },
  joelho: { pt: 'Joelho na barriga', en: 'Knee on belly' },
  montada: { pt: 'Montada', en: 'Mount' },
  costas: { pt: 'Costas', en: 'Back control' },
};

// ---------------------------------------------------------------- belts and stripes (never purchasable)

export type Belt = 'branca' | 'azul';

export const BELT_LABELS: Record<Belt, Bilingual> = {
  // needs_br: true
  branca: { pt: 'Faixa branca', en: 'White belt' },
  azul: { pt: 'Faixa azul', en: 'Blue belt' },
};

export const BELT_COLORS: Record<Belt, string> = { branca: '#f4f1ea', azul: '#2f5fb0' };

/** Wins per stripe, stripes per belt. Four stripes on the white belt earn the blue belt. */
export const WINS_PER_STRIPE = 3;
export const STRIPES_PER_BELT = 4;
export const BLUE_BELT_WINS = WINS_PER_STRIPE * STRIPES_PER_BELT;

export interface BjjProgress {
  belt: Belt;
  stripes: number;
  wins: number;
  /** Bond points paid today for bouts (a small daily cap keeps friendship from being farmed). */
  bondDay?: string;
  bondToday?: number;
}

/** Belt and stripes from a win count (the single source of truth: the stored fields can only agree with it or be older). */
export function progressForWins(wins: number): { belt: Belt; stripes: number } {
  const w = Math.max(0, Math.floor(Number.isFinite(wins) ? wins : 0));
  if (w < BLUE_BELT_WINS) return { belt: 'branca', stripes: Math.floor(w / WINS_PER_STRIPE) };
  return { belt: 'azul', stripes: Math.min(STRIPES_PER_BELT, Math.floor((w - BLUE_BELT_WINS) / WINS_PER_STRIPE)) };
}

/** Old saves (white belt, stripes only, no `belt`) and hand-edited ones come back coherent. Never throws. */
export function normalizeBjj(p?: Partial<BjjProgress> | null): BjjProgress {
  const wins = Math.max(0, Math.floor(Number(p?.wins) || 0));
  const fromWins = progressForWins(wins);
  const storedStripes = Number.isFinite(Number(p?.stripes)) ? Math.min(STRIPES_PER_BELT, Math.max(0, Math.floor(Number(p!.stripes)))) : 0;
  // never go backwards: a save with more stripes than its wins explain (older rule) keeps them, and four stripes on white are a blue belt
  const storedBelt: Belt = p?.belt === 'azul' ? 'azul' : 'branca';
  let belt: Belt = storedBelt === 'azul' || fromWins.belt === 'azul' ? 'azul' : 'branca';
  let stripes = belt === fromWins.belt ? fromWins.stripes : 0;
  // the stored stripes only count on the belt they were earned on
  if (belt === storedBelt) stripes = Math.max(stripes, storedStripes);
  if (belt === 'branca' && stripes >= STRIPES_PER_BELT) {
    belt = 'azul';
    stripes = 0;
  }
  const out: BjjProgress = { belt, stripes, wins };
  if (typeof p?.bondDay === 'string') out.bondDay = p.bondDay;
  if (Number.isFinite(Number(p?.bondToday))) out.bondToday = Math.max(0, Math.floor(Number(p!.bondToday)));
  return out;
}

/** 0..8: white belt stripes 0..3, then the blue belt (4) plus its stripes. Timers and partner unlocks follow it. */
export function bjjLevel(p?: Partial<BjjProgress> | null): number {
  const n = normalizeBjj(p);
  return (n.belt === 'azul' ? STRIPES_PER_BELT : 0) + n.stripes;
}

export interface WinResult {
  progress: BjjProgress;
  /** a stripe was added */
  stripeUp: boolean;
  /** the blue belt was earned this time */
  beltUp: boolean;
}

export function recordWin(p?: Partial<BjjProgress> | null): WinResult {
  const before = normalizeBjj(p);
  const wins = before.wins + 1;
  const now = progressForWins(wins);
  const progress = normalizeBjj({ ...before, wins, belt: now.belt, stripes: now.stripes });
  return { progress, stripeUp: now.belt === before.belt && progress.stripes > before.stripes, beltUp: before.belt === 'branca' && progress.belt === 'azul' };
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
    bio: { pt: 'Difícil de finalizar. Segura firme e espera o erro.', en: 'Hard to finish. Holds tight and waits for a mistake.' },
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
    bio: { pt: 'Vai pra cima desde o começo e procura a finalização cedo.', en: 'Comes forward from the start and hunts for the finish early.' },
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
