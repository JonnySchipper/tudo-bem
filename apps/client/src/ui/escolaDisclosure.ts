/**
 * What the Escola home shows, by what the player has done (SIMPLIFICATION-REVIEW D2). The first visit is Dona Lúcia, the word count and one
 * start button; the rest waits for the first finished lesson, the third, or the regular-player trigger. Pure, like `hudShows()`.
 */
import { S3_DIARY, S3_RECADOS, stage, type DisclosureProfile } from './disclosure';

export interface EscolaDisclosureProfile extends DisclosureProfile {
  escola?: { lessons?: number; streak?: number };
}

export interface EscolaHomeShows {
  /** The streak flame: after the first finished lesson. */
  flame: boolean;
  /** The unit path: after the first finished lesson. */
  path: boolean;
  /** The daily goal picker: after three finished lessons. */
  goalPick: boolean;
  /** Tier bar, streak freezes and the daily word mission: S3 (25 diary words, 3 recados done, or a gi). */
  deep: boolean;
}

export const ESCOLA_GOAL_PICK_LESSONS = 3;
export const ESCOLA_DEEP_DIARY = S3_DIARY;
export const ESCOLA_DEEP_RECADOS = S3_RECADOS;

export function escolaHomeShows(p: EscolaDisclosureProfile): EscolaHomeShows {
  const lessons = p.escola?.lessons ?? 0;
  // A running streak means a lesson was finished (profiles seeded by the screenshot scripts carry a streak but no lesson count).
  const first = lessons >= 1 || (p.escola?.streak ?? 0) > 0;
  // the regular-player stage (ui/disclosure.ts), less its own lesson trigger: lessons open the path and the goal picker here, not the deep parts
  const deep = stage({ ...p, escola: undefined }) === 'S3';
  return { flame: first, path: first, goalPick: lessons >= ESCOLA_GOAL_PICK_LESSONS, deep };
}
