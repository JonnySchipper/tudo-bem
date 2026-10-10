/**
 * What the Escola home shows, by what the player has done (SIMPLIFICATION-REVIEW D2). The first visit is Dona Lúcia, the word count and one
 * start button; the rest waits for the first finished lesson, the third, or the regular-player trigger. Pure, like `hudShows()`.
 */
export interface EscolaDisclosureProfile {
  escola?: { lessons?: number; streak?: number };
  diary?: readonly string[];
  recados?: { done?: readonly string[] };
  giOwned?: boolean;
}

export interface EscolaHomeShows {
  /** The streak flame: after the first finished lesson. */
  flame: boolean;
  /** The unit path: after the first finished lesson. */
  path: boolean;
  /** The daily goal picker: after three finished lessons. */
  goalPick: boolean;
  /** Tier bar, streak freezes and the daily word mission: 25 diary words, 3 recados done, or a gi. */
  deep: boolean;
}

export const ESCOLA_GOAL_PICK_LESSONS = 3;
export const ESCOLA_DEEP_DIARY = 25;
export const ESCOLA_DEEP_RECADOS = 3;

export function escolaHomeShows(p: EscolaDisclosureProfile): EscolaHomeShows {
  const lessons = p.escola?.lessons ?? 0;
  // A running streak means a lesson was finished (profiles seeded by the screenshot scripts carry a streak but no lesson count).
  const first = lessons >= 1 || (p.escola?.streak ?? 0) > 0;
  const deep = (p.diary?.length ?? 0) >= ESCOLA_DEEP_DIARY || (p.recados?.done?.length ?? 0) >= ESCOLA_DEEP_RECADOS || !!p.giOwned;
  return { flame: first, path: first, goalPick: lessons >= ESCOLA_GOAL_PICK_LESSONS, deep };
}
