/**
 * "Treino no tatame": what the bout's presentation shares (server, client and tests): the protocol version, the referee's calls,
 * the crowd cues, the events of a resolved move, the end lines and the scoreboard clock. The rules of a move live in `matFight.ts`
 * (Tatame v3 "Comando": chains of A1 commands, a defense pad, no dice). The v1 momentum simulation and its quiz are gone.
 *
 * Locks: nothing here is technique trivia; no "Oss" / "rola" in copy; no position or submission names (#49).
 */
import type { Bilingual } from './types.js';
import { type BjjPositionId, type BoutReason, type BoutWinner } from './academia.js';

/** v2: `pick` / `tap` / `defend` (Tatame v3). A v1 client (`intent` / `answer`) is told to reload. */
export const BOUT_PROTOCOL_VERSION = 2;

export const RUNG_MAX = 4;
/** The walk-on, the fist bump and Bia's "Combate!". */
export const INTRO_MS = 4_200;

export interface Score {
  you: number;
  partner: number;
}

export type FinishPosition = 'montada' | 'costas';

export interface PositionView {
  id: BjjPositionId;
  /** who is on top, null standing */
  ahead: 'you' | 'partner' | null;
}

/** The pose of a ladder rung (-4..4, positive: you are ahead). Pose ids are internal: they pick the mat art, never a label. */
export function positionOf(st: { rung: number; top: FinishPosition }): PositionView {
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

// ---------------------------------------------------------------- the events of a resolved move

export type ExchangeEvent =
  | { type: 'points'; side: 'you' | 'partner'; pts: number; signal: RefSignal; line: Bilingual }
  | { type: 'advantage'; side: 'you' | 'partner'; signal: 'vantagem'; line: Bilingual }
  | { type: 'transition'; from: BjjPositionId; to: BjjPositionId; rungFrom: number; rungTo: number; gain: 'you' | 'partner' | null };

// ---------------------------------------------------------------- the end

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
